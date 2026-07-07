package repository

import (
	"time"

	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
)

type LessonRepository struct {
	db *gorm.DB
}

func NewLessonRepository(db *gorm.DB) *LessonRepository {
	return &LessonRepository{db: db}
}

// Create 创建教案草稿
func (r *LessonRepository) Create(plan *model.LessonPlan) error {
	return r.db.Create(plan).Error
}

// FindByID 按 ID 查询教案
func (r *LessonRepository) FindByID(id string, teacherID string) (*model.LessonPlan, error) {
	var plan model.LessonPlan
	err := r.db.Where("id = ? AND teacher_id = ?", id, teacherID).First(&plan).Error
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

// ListByTeacher 按教师查询教案列表（分页）
func (r *LessonRepository) ListByTeacher(teacherID string, page, pageSize int) ([]model.LessonPlan, int64, error) {
	var plans []model.LessonPlan
	var total int64

	query := r.db.Where("teacher_id = ? AND status != ?", teacherID, "archived")

	if err := query.Model(&model.LessonPlan{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err := query.Order("updated_at DESC").Offset(offset).Limit(pageSize).Find(&plans).Error
	return plans, total, err
}

// Update 更新教案
func (r *LessonRepository) Update(plan *model.LessonPlan) error {
	plan.UpdatedAt = time.Now()
	return r.db.Save(plan).Error
}

// Delete 软删除教案（标记为 archived）
func (r *LessonRepository) Delete(id string, teacherID string) error {
	return r.db.Model(&model.LessonPlan{}).
		Where("id = ? AND teacher_id = ?", id, teacherID).
		Update("status", "archived").Error
}

// AutoMigrate 自动迁移教案表
func (r *LessonRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&model.LessonPlan{})
}
