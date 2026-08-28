package repository

import (
	"context"
	"time"

	"github.com/zhiwei/backend/internal/model"
	"gorm.io/gorm"
)

type MaterialRepository struct{ db *gorm.DB }

func NewMaterialRepository(db *gorm.DB) *MaterialRepository { return &MaterialRepository{db} }

func (r *MaterialRepository) List(schoolID string) ([]model.Material, error) {
	var items []model.Material
	err := r.db.Where("school_id = ?", schoolID).Order("created_at DESC").Find(&items).Error
	return items, err
}

func (r *MaterialRepository) Create(m *model.Material) error {
	return r.db.Create(m).Error
}

// Update 更新素材（课件草稿/发布落库复用），仅更新可编辑字段
func (r *MaterialRepository) Update(m *model.Material) error {
	return r.db.Model(m).Where("id = ?", m.ID).Updates(map[string]interface{}{
		"name":      m.Name,
		"type":      m.Type,
		"tag":       m.Tag,
		"url":       m.URL,
		"content":   m.Content,
		"h5_html":   m.H5HTML,
		"status":           m.Status,
		"grade":            m.Grade,
		"subject":          m.Subject,
		"interactive_slots": m.InteractiveSlots,
		"category":          m.Category,
		"decor_facets":      m.DecorFacets,
		"applicable":        m.Applicable,
		"motif_root":        m.MotifRoot,
		"color_root":        m.ColorRoot,
		"page_type":         m.PageType,
		"parent_ids":        m.ParentIDs,
		"updated_at":        time.Now(),
	}).Error
}

// GetByID 按 ID 获取单个素材（含 content，供 AI 课件生成读取参照课件正文）
func (r *MaterialRepository) GetByID(id string) (*model.Material, error) {
	var m model.Material
	err := r.db.Where("id = ?", id).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ListUntaggedDecor 列出未打 facet 标签的装饰元件（供 AI 定时巡增标签任务扫描）。
// 未打标定义: category 为装饰类 且 (decor_facets 为 NULL 或空数组)。
// schoolID 为空串时查全平台（平台运维定时任务用）。
func (r *MaterialRepository) ListUntaggedDecor(ctx context.Context, schoolID string, limit int) ([]model.Material, error) {
	var items []model.Material
	q := r.db.WithContext(ctx).
		Where("category = ? OR category = ?", "decor_element", "decor_component").
		Where("(decor_facets IS NULL OR jsonb_array_length(decor_facets) = 0)")
	if schoolID != "" {
		q = q.Where("school_id = ?", schoolID)
	}
	q = q.Order("created_at ASC").Limit(limit)
	err := q.Find(&items).Error
	return items, err
}

// SaveDecorFacets 仅写回 facet 标签相关字段（AI 巡增任务用，避免触碰课件正文等大字段）。
func (r *MaterialRepository) SaveDecorFacets(ctx context.Context, id string, facets model.DecorFacets, motif, color, pageType, applicable string) error {
	return r.db.WithContext(ctx).Model(&model.Material{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"decor_facets": facets,
			"motif_root":   motif,
			"color_root":   color,
			"page_type":    pageType,
			"applicable":   applicable,
			"updated_at":   time.Now(),
		}).Error
}
