package main

// 公共装饰素材库采集 + 受控词表初始化 + 准入校验
//
// 设计依据（运行态代码，非纯文档）：
//   - material.go:34-40  装饰字段 Category/DecorFacets(jsonb)/Applicable/MotifRoot/ColorRoot/PageType
//   - material_decor.go  4 维 facet，motif/color 必须同源 cwTemplate.ts 的 STYLE_LABELS/COLOR_FAMILIES
//   - material_handler.go ListDecor(scope=public) → user_id='' 即公共库
//   - facet_vocab.go      受控词表（运营维护）
//
// 公共素材库定义（准入规则 R0-R5，见 validate）：
//   R0 权属: user_id='' 且 category∈{decor_element,decor_component}
//   R1 受控词表: applicable/motif/color/page_type 值必须∈ facet_vocab
//   R2 零依赖: public 资产 URL 不得是 /uploads/*，必须内联 dataURL 或稳定静态域
//   R3 格式: svg-mono 单色可着色 → color 应落 黑白系/灰系
//   R4 覆盖: 8 风格母题均有元件
//   R5 隔离: 公共查询不应泄漏 user_id<>'' 的私有元件
//
// 设计原则（用户拍板 2026-09-02）：**只描述，不替 Skill 决策** ——
//   本采集只负责把资产属性如实描述清楚：
//     format=svg-mono  表明单色、可跟随 styleDNA 重新着色
//     color=黑白系     表明当前是单色（非已上色的彩色位图）
//     applicable=common 表明跨 PPT/H5 媒介均可用
//   "某元件是否可万能匹配到任意风格/色系" 由上层 Skill 读到上述描述后自行判断，
//   不在采集侧或匹配器里做特例放行 —— 因此不改动 ListPublicDecor 的 color/page 过滤逻辑。
//
// 运行（默认从 code/backend 目录）：
//   go run ./cmd/seed/decor ingest     # 初始化受控词表 + 采集 assets/svg/* 为 public 元件
//   go run ./cmd/seed/decor validate   # 跑 R0-R5 准入校验
//   go run ./cmd/seed/decor            # 同 ingest
//
// 资产目录（ai-service 与 backend 平级）：
//   DECOR_ASSETS_DIR=../ai-service/assets   （含 svg/ 与 tags.json）

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/zhiwei/backend/internal/model"
)

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func must(err error, msg string) {
	if err != nil {
		log.Fatalf("%s: %v", msg, err)
	}
}

func main() {
	mode := "ingest"
	if len(os.Args) > 1 {
		mode = os.Args[1]
	}

	db := connectDB()

	switch mode {
	case "validate":
		validate(db)
	case "ingest", "":
		seedVocab(db)
		ingestAssets(db)
		// 采完即校验，给出准入结论
		validate(db)
	default:
		log.Fatalf("未知模式: %s（可选 ingest | validate）", mode)
	}
}

// ── DB ──
func connectDB() *gorm.DB {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		host := getEnv("DB_HOST", "postgres")
		port := getEnv("DB_PORT", "5432")
		user := getEnv("DB_USER", "zhiwei")
		pass := getEnv("DB_PASSWORD", "zhiwei2026")
		dbname := getEnv("DB_NAME", "zhiwei")
		dsn = "postgresql://" + user + ":" + pass + "@" + host + ":" + port + "/" + dbname + "?sslmode=disable"
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	must(err, "connect db")
	// 幂等建列（与运行时代码 model 一致）
	must(db.AutoMigrate(&model.Material{}, &model.FacetVocab{}), "automigrate")
	return db
}

// ── (c) 受控词表初始化 ──
func seedVocab(db *gorm.DB) {
	type vocabDef struct {
		typ    string
		values []string
	}
	defs := []vocabDef{
		{"motif", []string{"国风", "素净", "科技", "清新", "严谨", "卡通", "扁平", "沉稳", "通用"}},
		{"color", []string{"蓝系", "青绿系", "红金系", "暖棕系", "紫粉系", "灰系", "黑白系", "多彩渐变"}},
		{"medium", []string{"ppt", "h5", "common"}},
		{"page_type", []string{"cover", "content", "summary", "homework"}},
	}
	count := 0
	for _, d := range defs {
		for i, v := range d.values {
			fv := model.FacetVocab{
				ID:     d.typ + ":" + v,
				Type:   d.typ,
				Value:  v,
				Label:  v,
				Parent: "",
				Sort:   i,
			}
			must(db.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "id"}},
				DoUpdates: clause.AssignmentColumns([]string{"type", "value", "label", "sort"}),
			}).Create(&fv).Error, "upsert facet_vocab")
			count++
		}
	}
	log.Printf("[vocab] 受控词表就绪: %d 条", count)
}

// ── (a) 采集 assets/svg/* 为 public 装饰元件 ──
func ingestAssets(db *gorm.DB) {
	assetsDir := getEnv("DECOR_ASSETS_DIR", "../ai-service/assets")
	svgDir := filepath.Join(assetsDir, "svg")
	tagsPath := filepath.Join(assetsDir, "tags.json")

	if fi, err := os.Stat(svgDir); err != nil || !fi.IsDir() {
		log.Fatalf("未找到 SVG 目录: %s （请设置 DECOR_ASSETS_DIR 指向含 svg/ 的资产根目录）", svgDir)
	}

	// 读取语义标签（图标名 → 英文关键词）
	tags := loadTags(tagsPath)

	entries, err := os.ReadDir(svgDir)
	must(err, "read svg dir")

	total := 0
	skipped := 0
	t0 := time.Now()
	for _, e := range entries {
		if e.IsDir() || !strings.EqualFold(filepath.Ext(e.Name()), ".svg") {
			continue
		}
		stem := strings.TrimSuffix(e.Name(), filepath.Ext(e.Name()))
		raw, err := os.ReadFile(filepath.Join(svgDir, e.Name()))
		if err != nil {
			skipped++
			continue
		}
		svg := string(raw)

		motif := mapMotif(stem, tags[stem])
		// svg-mono 单色可着色 → 色系恒为黑白系（可跟随 styleDNA 重新着色）
		color := "黑白系"
		m := model.Material{
			ID:          "decor-" + stem,
			SchoolID:    "", // 平台公共资产，不挂靠具体学校
			UserID:      "", // 空 = 公共库（user_id=''）
			Name:        humanize(stem),
			Type:        "image",
			Format:      "svg-mono",
			Size:        humanSize(int64(len(raw))),
			Tag:         "装饰元件",
			URL:         dataURL(svg), // 零依赖：内联 dataURL，不依赖外部文件
			Content:     "",
			Status:      "active",
			Category:    "decor_element",
			Applicable:  "common",
			MotifRoot:   motif,
			ColorRoot:   color,
			PageType:    "content",
			DecorFacets: model.DecorFacets{
				"motif." + motif,
				"color." + color,
				"page_type.content",
				"applicable.common",
			},
		}
		// 幂等 upsert（按 id）
		if err := db.Save(&m).Error; err != nil {
			log.Printf("[warn] 写入 %s 失败: %v", m.ID, err)
			skipped++
			continue
		}
		total++
	}
	log.Printf("[ingest] 采集完成: %d 条 public 元件, 跳过 %d 条, 耗时 %s", total, skipped, time.Since(t0))
}

func loadTags(path string) map[string][]string {
	m := map[string][]string{}
	data, err := os.ReadFile(path)
	if err != nil {
		log.Printf("[warn] 未读取到 tags.json (%s)，将仅用文件名推断母题", path)
		return m
	}
	_ = json.Unmarshal(data, &m)
	return m
}

// mapMotif 由语义标签关键词映射到 8 风格母题之一；无命中归「通用」
func mapMotif(stem string, tags []string) string {
	seedTags := append([]string{stem}, tags...)
	score := map[string]int{}
	for _, t := range seedTags {
		tl := strings.ToLower(t)
		for motif, kws := range motifRules {
			for _, kw := range kws {
				if strings.Contains(tl, kw) {
					score[motif]++
				}
			}
		}
	}
	best := "通用"
	bestN := 0
	for motif, n := range score {
		if n > bestN {
			bestN = n
			best = motif
		}
	}
	return best
}

// motifRules 关键词→母题（优先级由 score 累计决定，并列取先命中者）
//
// 注意两点：
//  1. 刻意不使用过短的通用子串（如 "ai"/"key"/"line"），否则会误命中
//     email/chain/detail（ai）、monkey/turkey（key）、timeline/online（line）等无关图标。
//  2. 科学学科（理化生实验器材 + 电学元件）单独覆盖：
//     实验器材（flask/beaker/microscope/…）归「严谨」（学科学术），
//     电学元件（resistor/diode/battery/…）归「科技」。
var motifRules = map[string][]string{
	"国风": {"china", "dragon", "temple", "scroll", "taiji", "yin", "yang", "bamboo", "lantern", "lucky", "fortune", "chinese", "mask", "tea", "ink", "seal", "kung", "pagoda"},
	"清新": {"leaf", "plant", "flower", "tree", "nature", "grass", "sun", "cloud", "water", "wave", "bird", "fish", "animal", "bug", "leaflet", "botanical", "sprout", "branch", "petal", "bloom", "wind", "snow", "moon"},
	"严谨": {"book", "pencil", "ruler", "graduation", "school", "academic", "award", "medal", "certificate", "flag", "trophy", "diploma", "scholar", "library", "note", "clipboard", "checklist", "math", "formula", "biology", "physics",
		"science", "chemistry", "flask", "beaker", "microscope", "telescope", "magnet", "dna", "molecule", "thermometer", "experiment", "test-tube", "testtube", "lab-flask", "burner", "dropper", "funnel", "scale"},
	"科技": {"cpu", "chip", "circuit", "code", "binary", "network", "server", "database", "monitor", "device", "rocket", "atom", "wifi", "bluetooth", "signal", "robot", "brain", "satellite", "drone", "usb", "terminal",
		"electric", "resistor", "diode", "battery", "voltage", "transistor", "current", "circuit-board"},
	"卡通": {"star", "heart", "smile", "emoji", "balloon", "gift", "baby", "toy", "game", "candy", "cake", "party", "crown", "face", "thumb", "like", "cute"},
	"沉稳": {"shield", "lock", "building", "briefcase", "chart", "bank", "safe", "gear", "settings", "cog", "target", "compass"},
	"扁平": {"square", "circle", "dot", "grid", "minimal", "simple", "basic", "shape", "cube", "triangle", "hexagon", "diamond"},
	"素净": {"ring", "frame", "border", "divider", "thin", "plain", "deco", "ornament"},
}

func humanize(stem string) string {
	s := strings.ReplaceAll(stem, "-", " ")
	s = strings.ReplaceAll(s, "_", " ")
	return strings.ToUpper(s[:1]) + s[1:]
}

func dataURL(svg string) string {
	return "data:image/svg+xml;utf8," + url.QueryEscape(svg)
}

func humanSize(n int64) string {
	switch {
	case n >= 1024*1024:
		return fmt.Sprintf("%.1fMB", float64(n)/(1024*1024))
	case n >= 1024:
		return fmt.Sprintf("%.1fKB", float64(n)/1024)
	default:
		return fmt.Sprintf("%dB", n)
	}
}

// ── (b) 准入校验 R0-R5 ──
func validate(db *gorm.DB) {
	var items []model.Material
	must(db.Where("category IN ?", []string{"decor_element", "decor_component"}).Find(&items).Error, "query decor")

	// 受控词表集合
	vocabSets := map[string]map[string]bool{}
	for _, t := range []string{"motif", "color", "medium", "page_type"} {
		vocabSets[t] = map[string]bool{}
		var vs []model.FacetVocab
		db.Where("type = ?", t).Find(&vs)
		for _, v := range vs {
			vocabSets[t][v.Value] = true
		}
	}

	fail := false
	line := func(name string, ok bool, detail string) {
		mark := "PASS"
		if !ok {
			mark = "FAIL"
			fail = true
		}
		log.Printf("  [R] %-4s %s —— %s", mark, name, detail)
	}

	// R0 权属: 装饰元件必须是公共（user_id=''）
	var r0 int64
	db.Model(&model.Material{}).Where("category IN ? AND user_id <> ''",
		[]string{"decor_element", "decor_component"}).Count(&r0)
	line("R0", r0 == 0, fmt.Sprintf("非公共(user_id<>'')装饰行: %d", r0))

	// R1 受控词表: facet 值必须∈ facet_vocab
	r1 := 0
	var r1ex []string
	for _, m := range items {
		bad := []string{}
		if m.Applicable != "" && !vocabSets["medium"][m.Applicable] {
			bad = append(bad, "applicable="+m.Applicable)
		}
		if m.MotifRoot != "" && !vocabSets["motif"][m.MotifRoot] {
			bad = append(bad, "motif="+m.MotifRoot)
		}
		if m.ColorRoot != "" && !vocabSets["color"][m.ColorRoot] {
			bad = append(bad, "color="+m.ColorRoot)
		}
		if m.PageType != "" && !vocabSets["page_type"][m.PageType] {
			bad = append(bad, "page_type="+m.PageType)
		}
		if len(bad) > 0 {
			r1++
			if len(r1ex) < 5 {
				r1ex = append(r1ex, m.ID+": "+strings.Join(bad, ","))
			}
		}
	}
	line("R1", r1 == 0, fmt.Sprintf("facet 越界 %d 条%s", r1, examples(r1ex)))

	// R2 零依赖: 公共资产不得引用 /uploads 或私有/相对路径
	r2 := 0
	for _, m := range items {
		if m.UserID != "" {
			continue
		}
		if strings.HasPrefix(m.URL, "/uploads") ||
			(m.URL != "" && !strings.Contains(m.URL, "data:") && !strings.HasPrefix(m.URL, "http")) {
			r2++
		}
	}
	line("R2", r2 == 0, fmt.Sprintf("公共资产含外部/私有依赖: %d 条", r2))

	// R3 格式: svg-mono 单色可着色 → 色系应落 黑白系/灰系
	r3 := 0
	for _, m := range items {
		if m.Format == "svg-mono" && m.ColorRoot != "" && m.ColorRoot != "黑白系" && m.ColorRoot != "灰系" {
			r3++
		}
	}
	line("R3", r3 == 0, fmt.Sprintf("svg-mono 但色系非黑白/灰: %d 条", r3))

	// R4 8 风格母题覆盖
	counts := map[string]int{}
	for _, m := range items {
		counts[m.MotifRoot]++
	}
	missing := []string{}
	for v := range vocabSets["motif"] {
		if v == "通用" {
			continue
		}
		if counts[v] == 0 {
			missing = append(missing, v)
		}
	}
	line("R4", len(missing) == 0, fmt.Sprintf("母题覆盖=%v 缺失=%v", counts, missing))

	// R5 公共查询隔离: 私有装饰不应出现在 public 列表（ListPublicDecor 需补 user_id='' 过滤）
	var r5 int64
	db.Model(&model.Material{}).Where("category IN ? AND user_id <> ''",
		[]string{"decor_element", "decor_component"}).Count(&r5)
	line("R5", r5 == 0, fmt.Sprintf("会泄漏进公共列表的私有装饰: %d 条", r5))

	log.Printf("[validate] 公共装饰总数=%d；受控词表 motif=%d color=%d medium=%d page=%d",
		len(items), len(vocabSets["motif"]), len(vocabSets["color"]), len(vocabSets["medium"]), len(vocabSets["page_type"]))
	if fail {
		log.Printf("[validate] 结论: 不通过 ❌")
	} else {
		log.Printf("[validate] 结论: 通过 ✅")
	}
}

func examples(ex []string) string {
	if len(ex) == 0 {
		return ""
	}
	return " e.g. " + strings.Join(ex, "; ")
}
