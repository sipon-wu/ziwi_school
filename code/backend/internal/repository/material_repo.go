package repository

import (
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

// GetByID 按 ID 获取单个素材（含 content，供 AI 课件生成读取参照课件正文）
func (r *MaterialRepository) GetByID(id string) (*model.Material, error) {
	var m model.Material
	err := r.db.Where("id = ?", id).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}
