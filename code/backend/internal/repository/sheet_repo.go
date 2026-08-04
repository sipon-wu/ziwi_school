package repository

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/zhiwei/backend/internal/model"
	"gorm.io/gorm"
)

type SheetRepo struct {
	db *gorm.DB
}

func NewSheetRepo(db *gorm.DB) *SheetRepo {
	return &SheetRepo{db: db}
}

func (r *SheetRepo) Create(sheet *model.Sheet) error {
	return r.db.Create(sheet).Error
}

func (r *SheetRepo) GetByID(id, schoolID string) (*model.Sheet, error) {
	var s model.Sheet
	err := r.db.Where("id = ? AND school_id = ?", id, schoolID).First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &s, err
}

func (r *SheetRepo) Update(sheet *model.Sheet) error {
	return r.db.Save(sheet).Error
}

func (r *SheetRepo) ListByTeacher(teacherID, schoolID string) ([]model.Sheet, error) {
	var sheets []model.Sheet
	err := r.db.Where("teacher_id = ? AND school_id = ?", teacherID, schoolID).
		Order("updated_at DESC").Find(&sheets).Error
	return sheets, err
}

// GetByIDAnySchool 跨学校按 ID 查询（作业回溯题单时用，仅取基础字段，不做越权校验）
func (r *SheetRepo) GetByIDAnySchool(id string) (*model.Sheet, error) {
	var s model.Sheet
	err := r.db.Where("id = ?", id).First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &s, err
}

// SetPublishMode 更新发布去向
func (r *SheetRepo) SetPublishMode(id, publishMode string, assignedClasses []string) error {
	acJSON, _ := json.Marshal(assignedClasses)
	return r.db.Model(&model.Sheet{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"publish_mode":     publishMode,
			"assigned_classes": string(acJSON),
			"status":           "published",
			"updated_at":       time.Now(),
		}).Error
}
