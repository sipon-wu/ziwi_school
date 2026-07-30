package model

import "time"

type Exam struct {
	ID              string  `gorm:"column:id;type:varchar(50);primaryKey" json:"id"`
	SchoolID        string  `gorm:"column:school_id;type:varchar(50);not null;index" json:"school_id"`
	TeacherID       string  `gorm:"column:teacher_id;type:varchar(50);not null;index" json:"teacher_id"`
	Title           string  `gorm:"column:title;type:varchar(200);not null" json:"title"`
	Subject         string  `gorm:"column:subject;type:varchar(20);not null" json:"subject"`
	Grade           string  `gorm:"column:grade;type:varchar(20);not null" json:"grade"`
	Questions       string  `gorm:"column:questions;type:jsonb;default:'[]'" json:"questions"`
	CurriculumAlign string  `gorm:"column:curriculum_alignments;type:jsonb;default:'[]'" json:"curriculum_alignments"`
	TotalScore      float64 `gorm:"column:total_score;type:numeric(6,1);default:100" json:"total_score"`
	DurationMinutes int     `gorm:"column:duration_minutes;default:45" json:"duration_minutes"`
	Difficulty      string  `gorm:"column:difficulty;type:varchar(10);default:L2" json:"difficulty"`
	Status          string  `gorm:"column:status;type:varchar(20);default:draft" json:"status"`
	// 文档模式：自由排版 HTML 卷面 + 当前编辑模式 + 纸型（A3/A4）
	DocContent string    `gorm:"column:doc_content;type:text" json:"doc_content"`
	EditMode   string    `gorm:"column:edit_mode;type:varchar(10);default:'ai'" json:"edit_mode"`
	PaperSize  string    `gorm:"column:paper_size;type:varchar(4);default:'A3'" json:"paper_size"`
	CreatedAt  time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt  time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (Exam) TableName() string { return "exams" }
