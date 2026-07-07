package repository

import (
	"time"

	"gorm.io/gorm"
)

// Question 题目模型（用于仓库）
type Question struct {
	ID           string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	TeacherID    string    `gorm:"column:teacher_id;type:varchar(50);not null;index" json:"teacher_id"`
	SchoolID     string    `gorm:"column:school_id;type:varchar(50);not null;index" json:"school_id"`
	Subject      string    `gorm:"type:varchar(20);not null" json:"subject"`
	Grade        string    `gorm:"type:varchar(20);not null" json:"grade"`
	Content      string    `gorm:"column:content;type:text" json:"content"`
	Type         string    `gorm:"column:type;type:varchar(20)" json:"type"`
	Difficulty   string    `gorm:"column:difficulty;type:varchar(10)" json:"difficulty"`
	Options      string    `gorm:"column:options;type:jsonb" json:"options"`
	Answer       string    `gorm:"column:answer;type:text" json:"answer"`
	AnswerDetail string    `gorm:"column:answer_detail;type:text" json:"answer_detail"`
	Source       string    `gorm:"column:source;type:varchar(50)" json:"source"`
	IsPublic     bool      `gorm:"column:is_public" json:"is_public"`
	AuditStatus  string    `gorm:"column:audit_status;type:varchar(20)" json:"audit_status"`
	KnowledgePoints string `gorm:"column:knowledge_points;type:jsonb" json:"knowledge_points"`
	UsageCount   int       `gorm:"column:usage_count;default:0" json:"usage_count"`
	AvgRating    float64   `gorm:"column:avg_rating;default:0" json:"avg_rating"`
	CorrectRate  float64   `gorm:"column:correct_rate" json:"correct_rate"`
	AutoTags     string    `gorm:"column:auto_tags;type:jsonb" json:"auto_tags"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	// 兼容旧字段（写入时使用）
	Stem         string    `gorm:"-" json:"stem,omitempty"`
	Analysis     string    `gorm:"-" json:"analysis,omitempty"`
	QuestionType string    `gorm:"-" json:"question_type,omitempty"`
	UseCount     int       `gorm:"-" json:"use_count,omitempty"`
	Score        float64   `gorm:"-" json:"score,omitempty"`
	Status       string    `gorm:"-" json:"status"`
}

// AfterFind hook to derive status from audit_status
func (q *Question) AfterFind(tx *gorm.DB) error {
	if q.AuditStatus == "approved" {
		q.Status = "published"
	} else {
		q.Status = "draft"
	}
	return nil
}

func (Question) TableName() string {
	return "questions"
}

type ExerciseRepository struct {
	db *gorm.DB
}

func NewExerciseRepository(db *gorm.DB) *ExerciseRepository {
	return &ExerciseRepository{db: db}
}

// AutoMigrate 自动迁移
func (r *ExerciseRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&Question{})
}

// Create 创建题目
func (r *ExerciseRepository) Create(q *Question) error {
	return r.db.Create(q).Error
}

// FindByID 按 ID 查询题目
func (r *ExerciseRepository) FindByID(id string, teacherID string) (*Question, error) {
	var q Question
	err := r.db.Where("id = ? AND teacher_id = ?", id, teacherID).First(&q).Error
	if err != nil {
		return nil, err
	}
	return &q, nil
}

// ListByTeacher 按教师查询题目列表（分页）
func (r *ExerciseRepository) ListByTeacher(teacherID string, page, pageSize int) ([]Question, int64, error) {
	var questions []Question
	var total int64

	query := r.db.Where("teacher_id = ?", teacherID)

	if err := query.Model(&Question{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err := query.Order("updated_at DESC").Offset(offset).Limit(pageSize).Find(&questions).Error
	return questions, total, err
}

// Update 更新题目
func (r *ExerciseRepository) Update(q *Question) error {
	return r.db.Save(q).Error
}

// Delete 软删除题目
func (r *ExerciseRepository) Delete(id string, teacherID string) error {
	return r.db.Model(&Question{}).
		Where("id = ? AND teacher_id = ?", id, teacherID).
		Update("status", "deleted").Error
}
