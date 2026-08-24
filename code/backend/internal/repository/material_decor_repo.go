package repository

// ── 装饰元件查询扩展（草稿，评审通过后并入 material_repo.go）──
// 仅新增装饰相关的查询方法，不改动既有 Material 查询。
//
// 设计要点（防坑）:
// - 高频过滤走冗余列 applicable / motif_root 索引，深 jsonb 仅用于精确匹配。
// - user_id 过滤保证"账号素材库"属性（素材库为账号属性）。

import (
	"context"

	"github.com/zhiwei/backend/internal/model"
)

// ListDecorByFacets 按账号 + facet 维度过滤装饰资产。
// medium: ppt|h5|common（空=不限）；motifRoot: 母题一级（空=不限）；
// kind: decor_element|decor_component（空=两者都要）。
func (r *MaterialRepository) ListDecorByFacets(ctx context.Context, userID string, medium, motifRoot, kind string) ([]model.Material, error) {
	q := r.db.WithContext(ctx).
		Where("category = ? OR category = ?", "decor_element", "decor_component")

	if medium != "" {
		q = q.Where("(applicable = ? OR applicable = 'common')", medium)
	}
	if motifRoot != "" {
		q = q.Where("motif_root = ?", motifRoot)
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

// ListPublicDecor 列出平台公共装饰库（source=public），按 medium / motif 过滤。
func (r *MaterialRepository) ListPublicDecor(ctx context.Context, medium, motif string) ([]model.Material, error) {
	q := r.db.WithContext(ctx).Where("category = ? OR category = ?", "decor_element", "decor_component")
	if medium != "" {
		q = q.Where("(applicable = ? OR applicable = 'common')", medium)
	}
	if motif != "" {
		q = q.Where("motif_root = ?", motif)
	}
	var items []model.Material
	if err := q.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}
