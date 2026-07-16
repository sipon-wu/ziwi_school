package repository

import (
	"github.com/zhiwei/backend/internal/model"
	"gorm.io/gorm"
)

type ExerciseSheetRepository struct {
	db *gorm.DB
}

func NewExerciseSheetRepository(db *gorm.DB) *ExerciseSheetRepository {
	return &ExerciseSheetRepository{db: db}
}

func (r *ExerciseSheetRepository) List(schoolID string) ([]model.ExerciseSheet, error) {
	var items []model.ExerciseSheet
	err := r.db.Where("school_id = ?", schoolID).Order("created_at DESC").Find(&items).Error
	return items, err
}

func (r *ExerciseSheetRepository) GetByID(id string) (*model.ExerciseSheet, error) {
	var item model.ExerciseSheet
	err := r.db.Where("id = ?", id).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *ExerciseSheetRepository) Create(item *model.ExerciseSheet) error {
	return r.db.Create(item).Error
}

func (r *ExerciseSheetRepository) Update(item *model.ExerciseSheet) error {
	return r.db.Save(item).Error
}

func (r *ExerciseSheetRepository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&model.ExerciseSheet{}).Error
}
