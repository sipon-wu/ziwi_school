package repository

import (
	"time"

	"gorm.io/gorm"
)

// ITUser IT管理员用户视图
type ITUser struct {
	ID        string    `gorm:"type:varchar(50)" json:"id"`
	SchoolID  *string   `gorm:"type:varchar(50)" json:"school_id"`
	Phone     string    `gorm:"type:varchar(20)" json:"phone"`
	Name      string    `gorm:"type:varchar(100)" json:"name"`
	Role      string    `gorm:"type:varchar(30)" json:"role"`
	Status    string    `gorm:"type:varchar(20)" json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// Contact 校园通讯录
type Contact struct {
	ID    string `gorm:"type:varchar(50)" json:"id"`
	Name  string `gorm:"type:varchar(100)" json:"name"`
	Phone string `gorm:"type:varchar(20)" json:"phone"`
	Role  string `gorm:"type:varchar(30)" json:"role"`
	Dept  string `json:"dept"`
}

// TextbookVersionView 教材版本视图
type TextbookVersionView struct {
	ID          string `gorm:"type:varchar(50)" json:"id"`
	Subject     string `gorm:"type:varchar(20)" json:"subject"`
	Grade       string `gorm:"type:varchar(20)" json:"grade"`
	Publisher   string `gorm:"type:varchar(100)" json:"publisher"`
	VersionName string `gorm:"type:varchar(200)" json:"version_name"`
	Scope       string `gorm:"type:varchar(20)" json:"scope"`
	Status      string `gorm:"type:varchar(20)" json:"status"`
}

type ITRepository struct {
	db *gorm.DB
}

func NewITRepository(db *gorm.DB) *ITRepository {
	return &ITRepository{db: db}
}

// ListAllUsers 所有用户列表（IT管理员视角）
func (r *ITRepository) ListAllUsers(schoolID string) ([]ITUser, error) {
	var users []ITUser
	err := r.db.Table("users").
		Select("id, school_id, phone, name, role, status, created_at").
		Where("school_id = ?", schoolID).
		Order("created_at DESC").
		Find(&users).Error
	return users, err
}

// ListContacts 通讯录（按角色分组）
func (r *ITRepository) ListContacts(schoolID string) ([]Contact, error) {
	var contacts []Contact
	err := r.db.Raw(`
		SELECT u.id, u.name, u.phone, u.role,
			CASE u.role
				WHEN 'teacher' THEN '语文教研组'
				WHEN 'head_teacher' THEN '年级组'
				WHEN 'research_lead' THEN '教研组'
				WHEN 'registrar' THEN '教务处'
				WHEN 'principal' THEN '校长室'
				ELSE '其他'
			END as dept
		FROM users u
		WHERE u.school_id = ? AND u.status = 'active'
		ORDER BY u.role, u.name
	`, schoolID).Scan(&contacts).Error
	return contacts, err
}

// ListTextbookVersions 教材版本列表
func (r *ITRepository) ListTextbookVersions(schoolID string) ([]TextbookVersionView, error) {
	var versions []TextbookVersionView
	err := r.db.Table("textbook_versions").
		Select("id, subject, grade, publisher, version_name, scope, status").
		Where("school_id = ? OR scope = 'platform'", schoolID).
		Order("subject, grade").
		Find(&versions).Error
	return versions, err
}
