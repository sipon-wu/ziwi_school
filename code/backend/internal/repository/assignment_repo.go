package repository

import (
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Assignment 作业模型
type Assignment struct {
	ID             string     `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	TeacherID      string     `gorm:"type:varchar(50);not null;index" json:"teacher_id"`
	SchoolID       string     `gorm:"type:varchar(50);not null;index" json:"school_id"`
	ClassID        string     `gorm:"type:varchar(50);not null" json:"class_id"`
	Subject        string     `gorm:"type:varchar(20);not null" json:"subject"`
	Title          string     `gorm:"type:varchar(300);not null" json:"title"`
	AssignmentType string     `gorm:"type:varchar(20);default:regular" json:"assignment_type"`
	Questions      string     `gorm:"type:jsonb" json:"questions"`
	TotalScore     float64    `gorm:"type:decimal(6,2)" json:"total_score"`
	DueType        string     `gorm:"type:varchar(10);default:relative" json:"due_type"`
	DueHours       int        `json:"due_hours"`
	DueAt          *time.Time `json:"due_at"`
	PublishedAt    *time.Time `json:"published_at"`
	GradingStatus  string     `gorm:"type:varchar(20);default:pending" json:"grading_status"`
	// SheetID 题单→作业追溯（从题单布置而来时回填；单独组作业则为空）
	SheetID        string     `gorm:"type:varchar(50);index" json:"sheet_id"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

func (Assignment) TableName() string {
	return "assignments"
}

// AssignmentQuestionLog 题目粒度布置日志（避免同师同年级同学科各班重复布置同一题单/题目）
// 复合唯一索引 uk_aql_t_s_c_q (teacher_id, school_id, class_id, question_id) 由 main.go 迁移块手动创建，
// 此处不声明 unique 索引 tag，避免 GORM 生成错误的单字段索引。
type AssignmentQuestionLog struct {
	ID            string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	TeacherID     string    `gorm:"type:varchar(50);not null;index" json:"teacher_id"`
	SchoolID      string    `gorm:"type:varchar(50);not null;index" json:"school_id"`
	ClassID       string    `gorm:"type:varchar(50);not null;index" json:"class_id"`
	Subject       string    `gorm:"type:varchar(20);not null;index" json:"subject"`
	QuestionID    string    `gorm:"type:varchar(50);not null;index" json:"question_id"`
	SheetID       string    `gorm:"type:varchar(50);index" json:"sheet_id"`
	AssignmentID  string    `gorm:"type:varchar(50);index" json:"assignment_id"`
	AssignedAt    time.Time `gorm:"autoCreateTime" json:"assigned_at"`
}

func (AssignmentQuestionLog) TableName() string { return "assignment_question_logs" }

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

// Update 更新作业
func (r *AssignmentRepository) Update(id string, teacherID string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now()
	return r.db.Model(&Assignment{}).Where("id = ? AND teacher_id = ?", id, teacherID).Updates(updates).Error
}

// Delete 删除作业
func (r *AssignmentRepository) Delete(id string, teacherID string) error {
	return r.db.Where("id = ? AND teacher_id = ?", id, teacherID).Delete(&Assignment{}).Error
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

// ListBySheet 查询某题单已布置的作业（用于题单已布置历史）
func (r *AssignmentRepository) ListBySheet(sheetID, teacherID string) ([]Assignment, error) {
	var assignments []Assignment
	err := r.db.Where("sheet_id = ? AND teacher_id = ?", sheetID, teacherID).
		Order("created_at DESC").Find(&assignments).Error
	if assignments == nil {
		assignments = []Assignment{}
	}
	return assignments, err
}

// ListAssignedClassNames 返回某题单已布置到的班级名列表（去重）
func (r *AssignmentRepository) ListAssignedClassNames(sheetID, teacherID string) ([]string, error) {
	var classIDs []string
	err := r.db.Model(&Assignment{}).
		Where("sheet_id = ? AND teacher_id = ?", sheetID, teacherID).
		Pluck("DISTINCT class_id", &classIDs).Error
	if classIDs == nil {
		classIDs = []string{}
	}
	return classIDs, err
}

// LogQuestions 写入题目粒度布置日志（ignore duplicate：同师+同学科+同班+同题 幂等）
func (r *AssignmentRepository) LogQuestions(logs []AssignmentQuestionLog) error {
	if len(logs) == 0 {
		return nil
	}
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "teacher_id"}, {Name: "school_id"}, {Name: "class_id"}, {Name: "question_id"}},
		DoNothing: true,
	}).Create(&logs).Error
}

// ListAssignedQuestionClasses 返回某题目已布置的班级名集合（题目粒度排重）
func (r *AssignmentRepository) ListAssignedQuestionClasses(questionID, teacherID string) ([]string, error) {
	var classIDs []string
	err := r.db.Model(&AssignmentQuestionLog{}).
		Where("question_id = ? AND teacher_id = ?", questionID, teacherID).
		Pluck("DISTINCT class_id", &classIDs).Error
	if classIDs == nil {
		classIDs = []string{}
	}
	return classIDs, err
}
