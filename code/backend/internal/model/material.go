package model

import "time"

type Material struct {
	ID        string    `json:"id" gorm:"type:varchar(50);default:gen_random_uuid()"`
	SchoolID  string    `json:"school_id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Size      string    `json:"size"`
	Tag       string    `json:"tag"`
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"created_at"`
}

func (Material) TableName() string { return "materials" }
