package repository

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// AttemptEvent 答题事件（有据引擎原子数据源）
// 每次学生提交一道题的结果即为一条事件，支撑双轴画像与学生级飞轮
type AttemptEvent struct {
	ID              string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	StudentID       string         `gorm:"column:student_id;type:varchar(30);not null;index:idx_attempt_student" json:"student_id"`
	QuestionID      string         `gorm:"column:question_id;type:varchar(50);not null;index" json:"question_id"`
	AssignmentID    string         `gorm:"column:assignment_id;type:varchar(50);index" json:"assignment_id"`
	Subject         string         `gorm:"type:varchar(20);not null;index" json:"subject"`
	Grade           string         `gorm:"type:varchar(20);not null" json:"grade"`
	KnowledgePoints datatypes.JSON `gorm:"column:knowledge_points;type:jsonb" json:"knowledge_points"`
	Type            string         `gorm:"column:type;type:varchar(20)" json:"type"`                                    // T: 题型
	Difficulty      string         `gorm:"column:difficulty;type:varchar(10)" json:"difficulty"`                        // D: 难度
	ScenarioVariant string         `gorm:"column:scenario_variant;type:varchar(20);default:''" json:"scenario_variant"` // V
	TrainingRole    string         `gorm:"column:training_role;type:varchar(20);default:''" json:"training_role"`       // R
	Correct         bool           `gorm:"column:correct;default:false" json:"correct"`
	ErrorCause      string         `gorm:"column:error_cause;type:varchar(50)" json:"error_cause"` // 错因标签
	TimeSpent       int            `gorm:"column:time_spent;default:0" json:"time_spent"`          // 耗时(秒)
	Timestamp       time.Time      `gorm:"column:timestamp;not null;index" json:"timestamp"`
	CreatedAt       time.Time      `json:"created_at"`
}

func (AttemptEvent) TableName() string {
	return "attempt_events"
}

// AttemptEventRepository 答题事件数据访问
type AttemptEventRepository struct {
	db *gorm.DB
}

func NewAttemptEventRepository(db *gorm.DB) *AttemptEventRepository {
	return &AttemptEventRepository{db: db}
}

func (r *AttemptEventRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&AttemptEvent{})
}

// BatchCreate 批量写入答题事件（一次作业提交对应多条）
func (r *AttemptEventRepository) BatchCreate(events []AttemptEvent) error {
	if len(events) == 0 {
		return nil
	}
	return r.db.CreateInBatches(events, 100).Error
}

// ListByStudent 按学生查询答题事件（用于飞轮计算）
func (r *AttemptEventRepository) ListByStudent(studentID string, limit int) ([]AttemptEvent, error) {
	var events []AttemptEvent
	err := r.db.Where("student_id = ?", studentID).
		Order("timestamp DESC").Limit(limit).Find(&events).Error
	return events, err
}

// ListByClass 按班级查询答题事件（用于班级画像聚合）
func (r *AttemptEventRepository) ListByClass(classID string, subject string, since time.Time) ([]AttemptEvent, error) {
	var events []AttemptEvent
	err := r.db.Table("attempt_events ae").
		Joins("JOIN student_classes sc ON ae.student_id = sc.student_id").
		Where("sc.class_id = ? AND ae.subject = ? AND ae.timestamp >= ?", classID, subject, since).
		Order("ae.timestamp DESC").Find(&events).Error
	return events, err
}

// StatsByKnowledge 按知识点统计班级掌握度
func (r *AttemptEventRepository) StatsByKnowledge(classID, subject string) ([]KnowledgeStat, error) {
	var stats []KnowledgeStat
	err := r.db.Table("attempt_events ae").
		Select(`
			jsonb_array_elements_text(ae.knowledge_points) AS knowledge_id,
			COUNT(*) AS total,
			SUM(CASE WHEN ae.correct THEN 1 ELSE 0 END) AS correct,
			ROUND(AVG(CASE WHEN ae.correct THEN 100.0 ELSE 0.0 END), 1) AS mastery
		`).
		Joins("JOIN student_classes sc ON ae.student_id = sc.student_id").
		Where("sc.class_id = ? AND ae.subject = ?", classID, subject).
		Group("knowledge_id").
		Find(&stats).Error
	return stats, err
}

// KnowledgeStat 知识点统计
type KnowledgeStat struct {
	KnowledgeID string  `json:"knowledge_id"`
	Total       int64   `json:"total"`
	Correct     int64   `json:"correct"`
	Mastery     float64 `json:"mastery"`
}
