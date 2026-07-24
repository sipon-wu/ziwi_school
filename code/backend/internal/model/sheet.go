package model

import "time"

type Sheet struct {
	ID               string    `gorm:"column:id;type:varchar(50);primaryKey" json:"id"`
	SchoolID         string    `gorm:"column:school_id;type:varchar(50);not null;index" json:"school_id"`
	TeacherID        string    `gorm:"column:teacher_id;type:varchar(50);not null;index" json:"teacher_id"`
	Title            string    `gorm:"column:title;type:varchar(200);not null" json:"title"`
	Subject          string    `gorm:"column:subject;type:varchar(20);not null" json:"subject"`
	Grade            string    `gorm:"column:grade;type:varchar(20);not null" json:"grade"`
	TargetClassID    string    `gorm:"column:target_class_id;type:varchar(50)" json:"target_class_id"`
	TargetClassName  string    `gorm:"column:target_class_name;type:varchar(100)" json:"target_class_name"`
	Deadline         string    `gorm:"column:deadline;type:varchar(20)" json:"deadline"`
	Questions        string    `gorm:"column:questions;type:jsonb;default:'[]'" json:"questions"`
	Difficulty       string    `gorm:"column:difficulty;type:varchar(10);default:L2" json:"difficulty"`
	TotalCount       int       `gorm:"column:total_count;default:0" json:"total_count"`
	Status           string    `gorm:"column:status;type:varchar(20);default:draft" json:"status"`
	CreatedAt        time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (Sheet) TableName() string { return "sheets" }
