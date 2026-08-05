package model

import "time"

type Material struct {
	ID        string    `json:"id" gorm:"type:varchar(50);default:gen_random_uuid()"`
	SchoolID  string    `json:"school_id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Format    string    `json:"format"` // ppt | h5 | video（课件形态，与 type 正交：courseware 可含 ppt/h5，video 独占）
	Size      string    `json:"size"`
	Tag       string    `json:"tag"`
	URL       string    `json:"url"`
	Content   string    `gorm:"type:text" json:"content,omitempty"`
	Status    string    `json:"status"` // draft | active（课件草稿/已发布，与 exercises.status 对齐）
	Grade     string    `json:"grade"`
	Subject   string    `json:"subject"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Material) TableName() string { return "materials" }
