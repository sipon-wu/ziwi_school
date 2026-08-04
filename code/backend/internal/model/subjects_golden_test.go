package model

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// 黄金清单一致性断言（Go 端）。运行：go test ./internal/model/ -run Golden
// 任何与 code/shared/subjects.golden.json 的分叉都将 FAIL。

type goldenFile struct {
	StandardSubjects []string            `json:"standard_subjects"`
	RawToStandard    map[string]string   `json:"raw_to_standard"`
}

func loadGolden(t *testing.T) goldenFile {
	t.Helper()
	// 相对路径：internal/model -> ../../../shared
	p := filepath.Join("..", "..", "..", "shared", "subjects.golden.json")
	b, err := os.ReadFile(p)
	if err != nil {
		// 兜底：从仓库根找
		p2 := filepath.Join("..", "..", "shared", "subjects.golden.json")
		b, err = os.ReadFile(p2)
		if err != nil {
			t.Fatalf("无法读取黄金清单: %v", err)
		}
	}
	var g goldenFile
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("黄金清单 JSON 解析失败: %v", err)
	}
	return g
}

func TestGoldenSubjectsMatch(t *testing.T) {
	g := loadGolden(t)

	if !reflect.DeepEqual(StandardSubjects, g.StandardSubjects) {
		t.Fatalf("StandardSubjects 与黄金清单不一致:\n got=%v\nwant=%v", StandardSubjects, g.StandardSubjects)
	}

	for raw, want := range g.RawToStandard {
		got := NormalizeSubject(raw)
		if got != want {
			t.Errorf("NormalizeSubject(%q)=%q, 黄金清单期望 %q", raw, got, want)
		}
	}

	// 反向：所有标准学科自身归一应保持
	for _, s := range g.StandardSubjects {
		if NormalizeSubject(s) != s {
			t.Errorf("标准学科 %q 归一后丢失: %q", s, NormalizeSubject(s))
		}
	}
}

// TestNormalizeRejectsArtSportInfo 最严格负向：艺体/信息科技/未知学科必须归一为空，
// 否则会被 it_repo.go 的写入校验误放行。
func TestNormalizeRejectsArtSportInfo(t *testing.T) {
	rejected := []string{
		"音乐", "美术", "体育", "信息技术", "信息科技", "信息技术（新版）",
		"劳动", "综合实践", "心理健康", "人工智能", "未知学科X",
		" 语文", "语文 ", // 含空白变体不应被误判为标准
	}
	for _, raw := range rejected {
		if got := NormalizeSubject(raw); got != "" {
			t.Errorf("非边界学科 %q 应归一为空，实际 %q", raw, got)
		}
	}
}

// TestIsStandardSubjectMatchesGolden 与黄金清单互证。
func TestIsStandardSubjectMatchesGolden(t *testing.T) {
	g := loadGolden(t)
	for _, s := range g.StandardSubjects {
		if !IsStandardSubject(s) {
			t.Errorf("标准学科 %q 未被 IsStandardSubject 识别", s)
		}
	}
	for raw, std := range g.RawToStandard {
		if std == "" {
			if IsStandardSubject(raw) {
				t.Errorf("非边界原始名 %q 不应是标准学科", raw)
			}
			continue
		}
		// 归一结果要么是标准学科，要么是合法的合科标记（如"科学"：value 等于 key 且不在标准学科中）
		isCompound := std == raw && !IsStandardSubject(std)
		if !IsStandardSubject(std) && !isCompound {
			t.Errorf("归一结果 %q（来自 %q）既非标准学科也非合科标记", std, raw)
		}
	}
}

// TestEmptySubjectRejected 空串归一必须为空（写入校验的前置条件）。
func TestEmptySubjectRejected(t *testing.T) {
	if NormalizeSubject("") != "" {
		t.Errorf("空串应归一为空")
	}
}
