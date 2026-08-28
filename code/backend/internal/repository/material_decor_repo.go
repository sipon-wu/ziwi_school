package repository

// ── 装饰元件查询扩展 ──
// 仅新增装饰相关的查询方法，不改动既有 Material 查询。
//
// 设计要点（防坑）:
// - 高频过滤走冗余列 applicable / motif_root / color_root / page_type 索引。
// - user_id 过滤保证"账号素材库"属性（素材库为账号属性）。
// - color / pageType 供 AI 自动匹配：套模板时按模板标签推荐同源装饰元件。

import (
	"context"

	"github.com/zhiwei/backend/internal/model"
)

// ListDecorByFacets 按账号 + facet 维度过滤装饰资产（AI 自动匹配查询入口）。
// medium: ppt|h5|common（空=不限）；motifRoot: 母题一级（空=不限）；
// color: 色系一级（空=不限，支持逗号多值 OR）；pageType: 适用页型（空=不限）；
// kind: decor_element|decor_component（空=两者都要）。
func (r *MaterialRepository) ListDecorByFacets(ctx context.Context, userID string, medium, motifRoot, color, pageType, kind string) ([]model.Material, error) {
	q := r.db.WithContext(ctx).
		Where("category = ? OR category = ?", "decor_element", "decor_component")

	if medium != "" {
		q = q.Where("(applicable = ? OR applicable = 'common')", medium)
	}
	if motifRoot != "" {
		q = q.Where("motif_root IN (?)", splitCSV(motifRoot))
	}
	if color != "" {
		q = q.Where("color_root IN (?)", splitCSV(color))
	}
	if pageType != "" {
		q = q.Where("page_type = ?", pageType)
	}
	if kind != "" {
		q = q.Where("category = ?", kind)
	}
	// 账号素材库 = 我的上传 + 平台公共(空 user_id)，装修时可复用公共元件
	q = q.Where("user_id = ? OR user_id = ''", userID)
	var items []model.Material
	if err := q.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// ListPublicDecor 列出平台公共装饰库，按 medium / motif / color / pageType 过滤。
func (r *MaterialRepository) ListPublicDecor(ctx context.Context, medium, motif, color, pageType string) ([]model.Material, error) {
	q := r.db.WithContext(ctx).Where("category = ? OR category = ?", "decor_element", "decor_component")
	if medium != "" {
		q = q.Where("(applicable = ? OR applicable = 'common')", medium)
	}
	if motif != "" {
		q = q.Where("motif_root IN (?)", splitCSV(motif))
	}
	if color != "" {
		q = q.Where("color_root IN (?)", splitCSV(color))
	}
	if pageType != "" {
		q = q.Where("page_type = ?", pageType)
	}
	var items []model.Material
	if err := q.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// splitCSV 逗号分隔字符串 → 去空切片。
func splitCSV(s string) []string {
	var out []string
	for _, p := range splitComma(s) {
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func splitComma(s string) []string {
	// 轻量按逗号切分（不引号处理，facet 值无逗号场景足够）
	var parts []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	return parts
}
