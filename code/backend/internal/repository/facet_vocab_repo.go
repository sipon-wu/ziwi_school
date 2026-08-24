package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
)

// ListFacets 按 type 列出受控词（motif/medium...）。
func (r *MaterialRepository) ListFacets(ctx context.Context, typ string) ([]model.FacetVocab, error) {
	var list []model.FacetVocab
	err := r.db.WithContext(ctx).Where("type = ?", typ).Order("sort ASC, value ASC").Find(&list).Error
	return list, err
}

// UpsertFacet 新增/更新受控词。
func (r *MaterialRepository) UpsertFacet(ctx context.Context, f *model.FacetVocab) error {
	if f.ID == "" {
		f.ID = "fv-" + f.Type + "-" + f.Value
		f.CreatedAt = time.Now()
	}
	var existing model.FacetVocab
	err := r.db.WithContext(ctx).Where("id = ?", f.ID).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return r.db.WithContext(ctx).Create(f).Error
	}
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Model(&existing).Updates(map[string]interface{}{
		"label":  f.Label,
		"parent": f.Parent,
		"sort":   f.Sort,
	}).Error
}

// DeleteFacet 删除受控词。
func (r *MaterialRepository) DeleteFacet(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.FacetVocab{}).Error
}
