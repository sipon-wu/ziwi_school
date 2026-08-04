package model

import "time"

// ExerciseSheet 习题库（工作单 / 简单卷面）。
// 与试卷库(exams)同构：由若干单题(引用自题库)组成，编排后冻结为快照，保证审计口径一致。
// 习题 = "简单的卷面"；单题快照与 exams.Questions 同构，源单题后续变更不影响历史习题。
type ExerciseSheet struct {
	ID        string `gorm:"column:id;type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID  string `gorm:"column:school_id;type:varchar(50);not null;index" json:"school_id"`
	TeacherID string `gorm:"column:teacher_id;type:varchar(50);not null;index" json:"teacher_id"`
	Title     string `gorm:"column:title;type:varchar(200);not null" json:"title"`
	Subject   string `gorm:"column:subject;type:varchar(20);not null" json:"subject"`
	Grade     string `gorm:"column:grade;type:varchar(20);not null" json:"grade"`
	// Questions 内嵌单题快照（与 exams.Questions 同构），编排时冻结
	Questions string `gorm:"column:questions;type:jsonb;default:'[]'" json:"questions"`
	// DocContent 文档模式自由排版的 HTML 卷面（TipTap 产出）
	DocContent string    `gorm:"column:doc_content;type:text" json:"doc_content"`
	EditMode   string    `gorm:"column:edit_mode;type:varchar(10);default:'ai'" json:"edit_mode"`
	PaperSize  string    `gorm:"column:paper_size;type:varchar(4);default:'A4'" json:"paper_size"`
	Status     string    `gorm:"column:status;type:varchar(20);default:draft" json:"status"`
	// PublishMode 发布去向：bank=入题库（资产），assignment=已布置为作业
	PublishMode string `gorm:"column:publish_mode;type:varchar(20);default:''" json:"publish_mode"`
	// AssignedClasses 题目粒度已布置班级日志（JSON 数组，避免重复布置）
	AssignedClasses string `gorm:"column:assigned_classes;type:jsonb;default:'[]'" json:"assigned_classes"`
	CreatedAt  time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt  time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (ExerciseSheet) TableName() string { return "exercise_sheets" }
