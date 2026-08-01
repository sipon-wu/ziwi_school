package model

import "time"

// Annotation 批注（通用，挂任意作品：课件/教案/试卷/习题/题单/单题）。
// 批注是作品的标注/评审资产，发布前后均可增删（不冻结）。
type Annotation struct {
	ID           string    `gorm:"column:id;type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID     string    `gorm:"column:school_id;type:varchar(50);not null;index" json:"school_id"`
	UserID       string    `gorm:"column:user_id;type:varchar(50);not null;index" json:"user_id"`
	ResourceType string    `gorm:"column:resource_type;type:varchar(20);not null;index:idx_ann_resource,priority:1" json:"resource_type"`
	ResourceID   string    `gorm:"column:resource_id;type:varchar(50);not null;index:idx_ann_resource,priority:2" json:"resource_id"`
	AnchorType   string    `gorm:"column:anchor_type;type:varchar(10);not null" json:"anchor_type"` // page(课件按页) | text(TipTap选中文字)
	Anchor       string    `gorm:"column:anchor;type:jsonb;default:'{}'" json:"anchor"`             // page→{"page":3}; text→{"text":"...","from":n,"to":n}
	Comment      string    `gorm:"column:comment;type:text;not null" json:"comment"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (Annotation) TableName() string { return "annotations" }

// Version 版本快照（通用）。仅草稿期可存/回退；作品发布(active)后版本只读、禁止恢复（后端强制）。
// payload 为多态 JSONB：课件=OutlineSlide[]、教案/试卷/习题=HTML字符串、组卷=questions数组。
type Version struct {
	ID           string    `gorm:"column:id;type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID     string    `gorm:"column:school_id;type:varchar(50);not null;index" json:"school_id"`
	UserID       string    `gorm:"column:user_id;type:varchar(50);not null;index" json:"user_id"`
	ResourceType string    `gorm:"column:resource_type;type:varchar(20);not null;index:idx_ver_resource,priority:1" json:"resource_type"`
	ResourceID   string    `gorm:"column:resource_id;type:varchar(50);not null;index:idx_ver_resource,priority:2" json:"resource_id"`
	Label        string    `gorm:"column:label;type:varchar(200)" json:"label"`
	Payload      string    `gorm:"column:payload;type:jsonb;not null" json:"payload"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
}

func (Version) TableName() string { return "versions" }
