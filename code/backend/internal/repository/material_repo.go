package repository

import (
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
		"status":    m.Status,
		"grade":     m.Grade,
		"subject":   m.Subject,
		"updated_at": time.Now(),
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
