package scheduler

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/zhiwei/backend/internal/model"
)

func TestBuildFacets(t *testing.T) {
	r := &aiTagResult{Motif: "自然", Color: "蓝系", PageType: "content", Applicable: "ppt"}
	f := buildFacets(r)
	want := map[string]bool{
		"motif.自然": true, "color.蓝系": true, "page_type.content": true, "applicable.ppt": true,
	}
	if len(f) != 4 {
		t.Fatalf("期望 4 个 facet，实际 %d: %v", len(f), f)
	}
	for _, p := range f {
		if !want[p] {
			t.Errorf("意外 facet: %s", p)
		}
	}
}

func TestStripCodeFence(t *testing.T) {
	cases := []struct{ in, want string }{
		{`{"motif":"国风"}`, `{"motif":"国风"}`},
		{"```json\n{\"motif\":\"国风\"}\n```", `{"motif":"国风"}`},
		{"  {\"motif\":\"科技\"}  ", `{"motif":"科技"}`},
	}
	for _, c := range cases {
		if got := stripCodeFence(c.in); got != c.want {
			t.Errorf("stripCodeFence(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestNormalizeVocabNewWordRegisters(t *testing.T) {
	s := &AITagScheduler{
		knownVocab: map[string]map[string]bool{"motif": {"国风": true}},
	}
	// 模拟 UpsertFacet 不报错（用闭包无法注入，故仅验证注册逻辑触发标注）
	got := s.normalizeVocab(nil, "motif", "多巴胺")
	// 词表外新词应被保留并标记（注册由 db 调用，此处只验证返回值与集合更新）
	if got != "多巴胺" {
		t.Errorf("normalizeVocab 应返回原值，got=%q", got)
	}
	if !s.knownVocab["motif"]["多巴胺"] {
		t.Errorf("新词应被加入 knownVocab 集合")
	}
}

func TestJoinKeys(t *testing.T) {
	m := map[string]bool{"a": true, "b": true}
	if got := joinKeys(m); !strings.Contains(got, "a") || !strings.Contains(got, "b") {
		t.Errorf("joinKeys 应包含 a,b，got=%q", got)
	}
}

func TestDecorFacetsValue(t *testing.T) {
	f := model.DecorFacets{"motif.国风"}
	if v, err := f.Value(); err != nil || v == "" {
		t.Errorf("DecorFacets.Value 失败: %v", err)
	}
}

// TestRunOnceConcurrencyGuard 验证巡增进行中重复触发会被拒绝（防重入）。
func TestRunOnceConcurrencyGuard(t *testing.T) {
	s := &AITagScheduler{
		enabled:   false,
		aiBaseURL: "", // 空 URL，runOnce 会直接跳过，保证瞬间返回
		knownVocab: map[string]map[string]bool{},
	}
	// 第一次正常完成
	if _, err := s.RunOnce(context.Background()); err != nil {
		t.Fatalf("首次 RunOnce 不应报错: %v", err)
	}
	// 模拟正在运行：手动置 running=true，应返回 ErrAlreadyRunning
	s.mu.Lock()
	s.running = true
	s.mu.Unlock()
	_, err := s.RunOnce(context.Background())
	if !errors.Is(err, ErrAlreadyRunning) {
		t.Fatalf("重复触发应返回 ErrAlreadyRunning，got %v", err)
	}
}
