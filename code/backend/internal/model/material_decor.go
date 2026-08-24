package model

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
)

// ── 装饰元件资产架构扩展 ──
// 本文件为装饰模板/facet 能力所需的 model 类型底座。
// 仅定义装饰相关字段与 facet 结构类型，被 material.go / decor_template.go / seed 复用。

// DecorFacets 6维 facet 标签（层级路径数组）。
// 例: ["motif.自然.植物.树叶", "visual.风格.手绘感", "interaction.动效.浮动"]
// 数据库 jsonb 类型由 Material.DecorFacets 字段的 gorm tag 指定。
// 实现 Valuer/Scanner 使 gorm 以 JSON 文本读写 jsonb（避免被当成 Postgres record 类型）。
type DecorFacets []string

// Value 实现 driver.Valuer：以 JSON 字符串写入 jsonb 列。
func (f DecorFacets) Value() (driver.Value, error) {
	if f == nil {
		return "[]", nil
	}
	b, err := json.Marshal(f)
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

// Scan 实现 sql.Scanner：从 jsonb 读取 JSON 文本解析为 []string。
func (f *DecorFacets) Scan(src interface{}) error {
	if src == nil {
		*f = DecorFacets{}
		return nil
	}
	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return errors.New("DecorFacets.Scan: unsupported type")
	}
	return json.Unmarshal(data, f)
}

// StringSlice 通用字符串切片类型，以 JSON 读写 jsonb 列（避免 text[] 在 gorm+pgx 下 nil 切片扫描报错）。
type StringSlice []string

// Value 实现 driver.Valuer。
func (s StringSlice) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	b, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

// Scan 实现 sql.Scanner。
func (s *StringSlice) Scan(src interface{}) error {
	if src == nil {
		*s = StringSlice{}
		return nil
	}
	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return errors.New("StringSlice.Scan: unsupported type")
	}
	return json.Unmarshal(data, s)
}

// MaterialDecor 装饰相关字段（嵌入 Material 或作为子结构由 handler 组装）。
// 这里直接扩展 Material 结构体（见下方 Material 的追加字段注释）。
//
// 实际落地方式: 在 material.go 的 Material struct 中追加:
//   Category     string    `json:"category"`      // courseware|decor_element|decor_component
//   DecorFacets  DecorFacets `gorm:"type:jsonb" json:"decor_facets"`
//   Applicable   string    `json:"applicable"`    // ppt|h5|common
//   MotifRoot    string    `json:"motif_root"`
//   Interaction  string    `json:"interaction"`
//   ParentIDs    []string  `gorm:"type:text[]" json:"parent_ids"`
//
// 为避免在草稿阶段误改 material.go，本文件仅定义类型与辅助函数，
// 待评审通过后由实施 PR 正式改 material.go。

// MatchDecor 按 facet 过滤装饰资产（供 repository 查询复用）。
// 返回 true 表示该 facet 集合命中给定维度约束（applicable/motif_root）。
func (f DecorFacets) Matches(applicable, motifRoot string) bool {
	okApp, okMotif := true, true
	for _, p := range f {
		switch {
		case applicable != "" && len(p) > len("applicable.") && p[:len("applicable.")] == "applicable.":
			okApp = p[len("applicable."):] == applicable
		case motifRoot != "" && len(p) > len("motif.") && p[:len("motif.")] == "motif.":
			// motif_root 为一级: motif.自然 -> "自然"
			rest := p[len("motif."):]
			first := rest
			if idx := indexDot(rest); idx >= 0 {
				first = rest[:idx]
			}
			okMotif = first == motifRoot
		}
		if !okApp || !okMotif {
			return false
		}
	}
	return okApp && okMotif
}

func indexDot(s string) int {
	for i := 0; i < len(s); i++ {
		if s[i] == '.' {
			return i
		}
	}
	return -1
}
