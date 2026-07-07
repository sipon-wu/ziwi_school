package repository

import (
	"time"

	"gorm.io/gorm"
)

// Assignment 作业模型
type Assignment struct {
	ID            string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	TeacherID     string    `gorm:"type:varchar(50);not null;index" json:"teacher_id"`
	SchoolID      string    `gorm:"type:varchar(50);not null;index" json:"school_id"`
	ClassID       string    `gorm:"type:varchar(50);not null" json:"class_id"`
	Subject       string    `gorm:"type:varchar(20);not null" json:"subject"`
	Title         string    `gorm:"type:varchar(300);not null" json:"title"`
	AssignmentType string   `gorm:"type:varchar(20);default:regular" json:"assignment_type"`
	Questions     string    `gorm:"type:jsonb" json:"questions"`
	TotalScore    float64   `gorm:"type:decimal(6,2)" json:"total_score"`
	DueType       string    `gorm:"type:varchar(10);default:relative" json:"due_type"`
	DueHours      int       `json:"due_hours"`
	DueAt         *time.Time `json:"due_at"`
	PublishedAt   *time.Time `json:"published_at"`
	GradingStatus string    `gorm:"type:varchar(20);default:pending" json:"grading_status"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (Assignment) TableName() string {
	return "assignments"
}

type AssignmentRepository struct {
	db *gorm.DB
}

func NewAssignmentRepository(db *gorm.DB) *AssignmentRepository {
	return &AssignmentRepository{db: db}
}

// AutoMigrate 自动迁移
func (r *AssignmentRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&Assignment{})
}

// Create 创建作业
func (r *AssignmentRepository) Create(a *Assignment) error {
	return r.db.Create(a).Error
}

// FindByID 按 ID 查询作业
func (r *AssignmentRepository) FindByID(id string, teacherID string) (*Assignment, error) {
	var a Assignment
	err := r.db.Where("id = ? AND teacher_id = ?", id, teacherID).First(&a).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListByTeacher 按教师查询作业列表（分页）
func (r *AssignmentRepository) ListByTeacher(teacherID string, page, pageSize int) ([]Assignment, int64, error) {
	var assignments []Assignment
	var total int64

	query := r.db.Where("teacher_id = ?", teacherID)

	if err := query.Model(&Assignment{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&assignments).Error
	return assignments, total, err
}
