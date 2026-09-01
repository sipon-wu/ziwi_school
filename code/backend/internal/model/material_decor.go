package model

import (
	"database/sql/driver"
	"encoding/json"
	"strings"
)

// ── 装饰元件 facet 标签（收敛版，P0）──
// 本文件为装饰元件 facet 能力的 model 类型底座。
//
// 指导原则（用户拍板 2026-08-27）：AI 自动匹配是全局核心。facet 存在的唯一目的是
// 让 AI 在「套模板 / 换装饰 / 上传PPT转模板」时自动推荐最匹配的装饰元件，
// 而非让老师手动筛选。因此 facet 维度必须与模板的 styleTags / colorTags 同源。
//
// 收敛为 4 个维度（与前端 cwTemplate.ts 的 STYLE_LABELS / COLOR_FAMILIES 同源）：
//   applicable 媒介: ppt | h5 | common
//   page_type  页型: cover | content | summary | homework | ...（辅助按页型匹配）
//   motif      母题: 与模板风格标签同源（国风/科技/清新/...）
//   color      色系: 与模板色系标签同源（蓝系/红金系/暖棕系/...）
//
// DecorFacets 是层级路径数组，例: ["motif.国风", "color.蓝系", "page_type.cover", "applicable.ppt"]
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
		*f = DecorFacets{}
		return nil
	}
	if len(data) == 0 || string(data) == "null" {
		*f = DecorFacets{}
		return nil
	}
	// 主路径:字符串路径数组(设计形态)。解析失败(如历史上被误写入对象数组)时
	// 退化为空 facet,而非返回 error——单条异常数据不应拖垮整个素材库 List。
	if err := json.Unmarshal(data, f); err != nil {
		*f = DecorFacets{}
	}
	return nil
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
		*s = StringSlice{}
		return nil
	}
	if len(data) == 0 || string(data) == "null" {
		*s = StringSlice{}
		return nil
	}
	if err := json.Unmarshal(data, s); err != nil {
		*s = StringSlice{}
	}
	return nil
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
// 返回 true 表示该 facet 集合命中给定维度约束（applicable/motifRoot/color/pageType）。
// 约束为 OR 语义：传多个值（逗号分隔）时，任一中即命中，用于「聚类标签多选」。
func (f DecorFacets) Matches(applicable, motifRoot, color, pageType string) bool {
	// 无约束或空 facet（未打标签=不限维度）均视为命中
	if len(f) == 0 {
		return true
	}
	if applicable == "" && motifRoot == "" && color == "" && pageType == "" {
		return true
	}
	appOk := applicable == ""
	motifOk := motifRoot == ""
	colorOk := color == ""
	pageOk := pageType == ""
	for _, p := range f {
		dim, val := splitFacet(p)
		switch dim {
		case "applicable":
			if applicable != "" && !appOk {
				appOk = matchAny(val, applicable)
			}
		case "motif":
			if motifRoot != "" && !motifOk {
				motifOk = matchAny(val, motifRoot)
			}
		case "color":
			if color != "" && !colorOk {
				colorOk = matchAny(val, color)
			}
		case "page_type":
			if pageType != "" && !pageOk {
				pageOk = matchAny(val, pageType)
			}
		}
		if appOk && motifOk && colorOk && pageOk {
			return true
		}
	}
	return appOk && motifOk && colorOk && pageOk
}

// splitFacet 将 "dim.value" 拆成维度与一级值（"motif.国风.xx" -> "motif", "国风"）。
func splitFacet(p string) (string, string) {
	idx := indexDot(p)
	if idx < 0 {
		return p, ""
	}
	dim := p[:idx]
	rest := p[idx+1:]
	if j := indexDot(rest); j >= 0 {
		rest = rest[:j]
	}
	return dim, rest
}

// matchAny 逗号分隔的多值 OR 匹配（聚类标签多选）。
func matchAny(val, constraint string) bool {
	if val == "" || constraint == "" {
		return false
	}
	for _, c := range strings.Split(constraint, ",") {
		if c != "" && c == val {
			return true
		}
	}
	return false
}

func indexDot(s string) int {
	for i := 0; i < len(s); i++ {
		if s[i] == '.' {
			return i
		}
	}
	return -1
}
