package repository

import (
	"time"

	"gorm.io/gorm"
)

// ReviewItem 互审条目
type ReviewItem struct {
	ID           string     `gorm:"type:varchar(50)" json:"id"`
	LessonTitle  string     `gorm:"type:varchar(12)" json:"lesson_title"`
	TeacherName  string     `gorm:"->" json:"teacher_name"`
	Subject      string     `gorm:"type:varchar(20)" json:"subject"`
	Grade        string     `gorm:"type:varchar(20)" json:"grade"`
	ReviewStatus string     `gorm:"type:varchar(20)" json:"review_status"`
	SubmittedAt  *time.Time `json:"submitted_at"`
}

// ResearchStats 教研统计
type ResearchStats struct {
	TotalReviews     int64 `json:"total_reviews"`
	PendingReviews   int64 `json:"pending_reviews"`
	ApprovedReviews  int64 `json:"approved_reviews"`
	MethodologyCount int64 `json:"methodology_count"`
}

// Methodology 方法论
type Methodology struct {
	ID           string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID     string    `gorm:"type:varchar(50);not null" json:"school_id"`
	Subject      string    `gorm:"type:varchar(20);not null" json:"subject"`
	Title        string    `gorm:"type:varchar(200);not null" json:"title"`
	Description  string    `gorm:"type:text" json:"description"`
	ReviewStatus string    `gorm:"type:varchar(20);default:pending" json:"review_status"`
	CreatedAt    time.Time `json:"created_at"`
}

func (Methodology) TableName() string { return "methodologies" }

type ResearchRepository struct {
	db *gorm.DB
}

func NewResearchRepository(db *gorm.DB) *ResearchRepository {
	return &ResearchRepository{db: db}
}

func (r *ResearchRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&Methodology{})
}

// ListReviews 互审池列表
func (r *ResearchRepository) ListReviews(schoolID string) ([]ReviewItem, error) {
	var items []ReviewItem
	err := r.db.Raw(`
		SELECT lp.id, lp.title as lesson_title, u.name as teacher_name,
			lp.subject, lp.grade, lp.review_status, lp.reviewed_at as submitted_at
		FROM lesson_plans lp
		JOIN users u ON u.id = lp.teacher_id
		WHERE lp.school_id = ? AND lp.review_status IN ('pending','approved','returned')
		ORDER BY lp.updated_at DESC
	`, schoolID).Scan(&items).Error
	return items, err
}

// GetResearchStats 教研统计
func (r *ResearchRepository) GetResearchStats(schoolID string) (*ResearchStats, error) {
	var s ResearchStats
	r.db.Raw(`SELECT COUNT(*) FROM lesson_plans WHERE school_id = ? AND review_status != 'none'`, schoolID).Scan(&s.TotalReviews)
	r.db.Raw(`SELECT COUNT(*) FROM lesson_plans WHERE school_id = ? AND review_status = 'pending'`, schoolID).Scan(&s.PendingReviews)
	r.db.Raw(`SELECT COUNT(*) FROM lesson_plans WHERE school_id = ? AND review_status = 'approved'`, schoolID).Scan(&s.ApprovedReviews)
	r.db.Raw(`SELECT COUNT(*) FROM methodologies WHERE school_id = ?`, schoolID).Scan(&s.MethodologyCount)
	return &s, nil
}

// ListMethodologies 方法论列表
func (r *ResearchRepository) ListMethodologies(schoolID string) ([]Methodology, error) {
	var items []Methodology
	err := r.db.Where("school_id = ?", schoolID).Order("created_at DESC").Find(&items).Error
	return items, err
}
