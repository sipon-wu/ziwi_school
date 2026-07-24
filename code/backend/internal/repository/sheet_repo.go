package repository

import (
	"errors"

	"gorm.io/gorm"
	"github.com/zhiwei/backend/internal/model"
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
