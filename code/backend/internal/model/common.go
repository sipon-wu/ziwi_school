package model

import "time"

// Common 通用类型

// Pagination 分页请求
type Pagination struct {
	Page     int `form:"page" json:"page"`
	PageSize int `form:"page_size" json:"page_size"`
}

func (p *Pagination) Normalize() {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 || p.PageSize > 100 {
		p.PageSize = 20
	}
}

func (p *Pagination) Offset() int {
	return (p.Page - 1) * p.PageSize
}

// PaginatedResponse 分页响应
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

// Timestamp 时间戳（用于 JSON 响应）
type Timestamp struct {
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
