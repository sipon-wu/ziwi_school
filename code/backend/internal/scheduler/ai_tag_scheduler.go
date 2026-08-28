package scheduler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"
)

// AITagScheduler 周期性巡增装饰元件 facet 标签。
//
// 设计理念（用户拍板 2026-08-28）：AI 自动匹配是全局核心，facet 标签应由 AI
// 每月定期巡增一次，而非人工手写死。本调度器扫出未打标的装饰元件，调 AI 服务
// 推断其 motif(母题)/color(色系)/page_type(页型)/applicable(媒介) 四维标签，
// 写回 materials.decor_facets，并在发现词表外新词时自动注册进 facet_vocab
// （实现"标签生长"）。AI 调用复用既有 AIBaseURL（与 /api/ai/* 反向代理同源）。
type AITagScheduler struct {
	db          *repository.MaterialRepository
	aiBaseURL   string
	enabled     bool
	interval    time.Duration
	batchSize   int
	httpClient  *http.Client
	knownVocab  map[string]map[string]bool // dim -> set(value)，避免每次循环重复查库
	mu          sync.Mutex
	running     bool
	runTimeout  time.Duration
}

// ErrAlreadyRunning 表示巡增任务正在执行，拒绝重复触发（并发保护）。
var ErrAlreadyRunning = errors.New("ai-tag-scheduler: 巡增任务正在进行中，请稍后再试")

// New 创建调度器。interval 传 0 时用默认 30 天。enabled=false 时不启动定时器。
func New(db *repository.MaterialRepository, aiBaseURL string, enabled bool, interval time.Duration) *AITagScheduler {
	if interval <= 0 {
		interval = 30 * 24 * time.Hour
	}
	return &AITagScheduler{
		db:         db,
		aiBaseURL:  strings.TrimRight(aiBaseURL, "/"),
		enabled:    enabled,
		interval:   interval,
		batchSize:  50,
		httpClient: &http.Client{Timeout: 60 * time.Second},
		knownVocab: map[string]map[string]bool{},
		runTimeout: 30 * time.Minute, // 单次巡增硬超时，防止 AI 慢响应卡死
	}
}

// Start 启动每月定时巡增。enabled=false 时仅打印提示不启动。
func (s *AITagScheduler) Start() {
	if !s.enabled {
		log.Printf("[ai-tag-scheduler] disabled (AI_TAG_SCHEDULER_ENABLED != true)，跳过启动")
		return
	}
	// 启动即跑一次（首扫），随后按 interval 周期运行
	go func() {
		s.RunOnce(context.Background()) // 复用 RunOnce 的并发保护
		ticker := time.NewTicker(s.interval)
		defer ticker.Stop()
		for range ticker.C {
			s.RunOnce(context.Background())
		}
	}()
	log.Printf("[ai-tag-scheduler] started, interval=%s", s.interval)
}

// RunOnce 手动/定时触发一次全量巡增（带并发保护：已在跑则拒绝重复触发）。
func (s *AITagScheduler) RunOnce(ctx context.Context) (int, error) {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return 0, ErrAlreadyRunning
	}
	s.running = true
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
	}()
	// 套一层超时，避免单次巡增因 AI 慢响应无限挂起
	runCtx, cancel := context.WithTimeout(ctx, s.runTimeout)
	defer cancel()
	return s.runOnce(runCtx)
}

func (s *AITagScheduler) runOnce(ctx context.Context) (int, error) {
	if s.aiBaseURL == "" {
		log.Printf("[ai-tag-scheduler] AIBaseURL 为空，跳过本次巡增")
		return 0, nil
	}
	// 预载受控词表（motif/color/page_type/medium），用于约束与增量注册
	s.loadVocab(ctx)

	total := 0
	offset := 0
	for {
		items, err := s.db.ListUntaggedDecor(ctx, "", s.batchSize)
		if err != nil {
			return total, fmt.Errorf("list untagged decor: %w", err)
		}
		if len(items) == 0 {
			break
		}
		for _, m := range items {
			tags, err := s.tagOne(ctx, m)
			if err != nil {
				log.Printf("[ai-tag-scheduler] 素材 %s 打标失败: %v", m.ID, err)
				continue
			}
			if tags == nil {
				continue
			}
			facets := buildFacets(tags)
			if err := s.db.SaveDecorFacets(ctx, m.ID, facets, tags.Motif, tags.Color, tags.PageType, tags.Applicable); err != nil {
				log.Printf("[ai-tag-scheduler] 素材 %s 写回失败: %v", m.ID, err)
				continue
			}
			total++
		}
		offset += len(items)
		if len(items) < s.batchSize {
			break
		}
		_ = offset
	}
	log.Printf("[ai-tag-scheduler] 本次巡增完成，打标 %d 个素材", total)
	return total, nil
}

func (s *AITagScheduler) loadVocab(ctx context.Context) {
	for _, dim := range []string{"motif", "color", "page_type", "medium"} {
		list, err := s.db.ListFacets(ctx, dim)
		if err != nil {
			log.Printf("[ai-tag-scheduler] 加载 facet vocab %s 失败: %v", dim, err)
			continue
		}
		set := map[string]bool{}
		for _, f := range list {
			set[f.Value] = true
		}
		s.knownVocab[dim] = set
	}
}

// aiTagResult AI 返回的标签结构
type aiTagResult struct {
	Motif      string `json:"motif"`
	Color      string `json:"color"`
	PageType   string `json:"page_type"`
	Applicable string `json:"applicable"`
}

// tagOne 调 AI 服务推断单个素材的 facet 标签，返回受 vocab 约束（或新注册）的结果。
func (s *AITagScheduler) tagOne(ctx context.Context, m model.Material) (*aiTagResult, error) {
	prompt := s.buildPrompt(m)
	raw, err := s.callAI(ctx, prompt)
	if err != nil {
		return nil, err
	}
	var r aiTagResult
	if err := json.Unmarshal([]byte(raw), &r); err != nil {
		return nil, fmt.Errorf("parse AI response: %w (raw=%s)", err, raw)
	}
	// 约束 + 增量注册：若返回词表外新值，注册进 vocab（实现标签生长）
	r.Motif = s.normalizeVocab(ctx, "motif", r.Motif)
	r.Color = s.normalizeVocab(ctx, "color", r.Color)
	r.PageType = s.normalizeVocab(ctx, "page_type", r.PageType)
	r.Applicable = s.normalizeVocab(ctx, "medium", r.Applicable)
	if r.Motif == "" && r.Color == "" && r.PageType == "" {
		return nil, nil // AI 无法确定，留待下次
	}
	return &r, nil
}

func (s *AITagScheduler) buildPrompt(m model.Material) string {
	allowedMotif := joinKeys(s.knownVocab["motif"])
	allowedColor := joinKeys(s.knownVocab["color"])
	allowedPage := joinKeys(s.knownVocab["page_type"])
	allowedMedium := joinKeys(s.knownVocab["medium"])
	return fmt.Sprintf(`你是一名 K12 课件装饰素材标注专家。请为以下装饰元件推断 4 维 facet 标签，并严格以 JSON 返回。
素材信息：
- 名称: %s
- 类型: %s
- 分类: %s
可选词表（若素材明显属于某新类别，可返回词表外的值，系统会自动注册）：
- motif(母题): [%s]
- color(色系): [%s]
- page_type(页型): [%s]（cover=封面, content=内容, summary=小结, homework=作业, common=通用）
- applicable(媒介): [%s]（ppt, h5, common）
只返回 JSON，如 {"motif":"自然","color":"蓝系","page_type":"content","applicable":"ppt"}`,
		m.Name, m.Type, m.Category, allowedMotif, allowedColor, allowedPage, allowedMedium)
}

// normalizeVocab 若 val 非空且不在词表，自动注册进 facet_vocab，并返回（实现巡增）。
func (s *AITagScheduler) normalizeVocab(ctx context.Context, dim, val string) string {
	val = strings.TrimSpace(val)
	if val == "" {
		return ""
	}
	if s.knownVocab[dim] == nil {
		s.knownVocab[dim] = map[string]bool{}
	}
	if !s.knownVocab[dim][val] {
		s.knownVocab[dim][val] = true // 先入内存集合，避免重复注册
		if s.db != nil {
			f := &model.FacetVocab{
				ID:    "fv-" + dim + "-" + val,
				Type:  dim,
				Value: val,
				Label: val,
			}
			if err := s.db.UpsertFacet(ctx, f); err != nil {
				log.Printf("[ai-tag-scheduler] 注册新 facet 词 %s/%s 失败: %v", dim, val, err)
			} else {
				log.Printf("[ai-tag-scheduler] 巡增新标签: %s=%s", dim, val)
			}
		}
	}
	return val
}

func (s *AITagScheduler) callAI(ctx context.Context, prompt string) (string, error) {
	body := map[string]interface{}{
		"model": os.Getenv("AI_TAG_MODEL"),
		"messages": []map[string]string{
			{"role": "system", "content": "你是 K12 课件素材标注助手，只输出 JSON。"},
			{"role": "user", "content": prompt},
		},
		"temperature": 0.2,
	}
	b, err := json.Marshal(body)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.aiBaseURL+"/v1/chat/completions", bytes.NewReader(b))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("ai http: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ai status %d", resp.StatusCode)
	}
	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("decode ai: %w", err)
	}
	if len(out.Choices) == 0 {
		return "", fmt.Errorf("ai empty choices")
	}
	// 容错：模型可能包裹 ```json ```，剥离后解析
	return stripCodeFence(out.Choices[0].Message.Content), nil
}

func stripCodeFence(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		if i := strings.Index(s, "\n"); i >= 0 {
			s = s[i+1:]
		}
		if j := strings.LastIndex(s, "```"); j >= 0 {
			s = s[:j]
		}
	}
	return strings.TrimSpace(s)
}

func buildFacets(t *aiTagResult) model.DecorFacets {
	var f model.DecorFacets
	if t.Motif != "" {
		f = append(f, "motif."+t.Motif)
	}
	if t.Color != "" {
		f = append(f, "color."+t.Color)
	}
	if t.PageType != "" {
		f = append(f, "page_type."+t.PageType)
	}
	if t.Applicable != "" {
		f = append(f, "applicable."+t.Applicable)
	}
	return f
}

func joinKeys(m map[string]bool) string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return strings.Join(keys, ",")
}
