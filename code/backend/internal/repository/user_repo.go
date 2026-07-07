package repository

import (
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// FindByPhone 按手机号查询用户，同时预加载关联的学校信息
func (r *UserRepository) FindByPhone(phone string) (*model.User, error) {
	var user model.User
	err := r.db.Where("phone = ? AND status = ?", phone, "active").First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByID 按 ID 查询用户
func (r *UserRepository) FindByID(id string) (*model.User, error) {
	var user model.User
	err := r.db.First(&user, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetSchool 获取学校信息
func (r *UserRepository) GetSchool(schoolID string) (*model.School, error) {
	var school model.School
	err := r.db.First(&school, "id = ?", schoolID).Error
	if err != nil {
		return nil, err
	}
	return &school, nil
}

// Create 创建用户（用于 seed 脚本）
func (r *UserRepository) Create(user *model.User) error {
	return r.db.Create(user).Error
}

func (r *UserRepository) UpdateUser(id string, updates map[string]interface{}) error {
	return r.db.Table("users").Where("id = ?", id).Updates(updates).Error
}
