package repository

import (
	"time"

	"gorm.io/gorm"
)

// AuditLog 对应迁移 001_init_schema.up.sql 的 audit_logs 表
// （该表此前仅定义、无写入逻辑；本文件补上 IT 操作历史的读写能力）
type AuditLog struct {
	ID           string                 `json:"id" gorm:"column:id"`
	UserID       string                 `json:"user_id" gorm:"column:user_id"`
	SchoolID     string                 `json:"school_id" gorm:"column:school_id"`
	Action       string                 `json:"action" gorm:"column:action"`
	ResourceType string                 `json:"resource_type" gorm:"column:resource_type"`
	ResourceID   *string                `json:"resource_id" gorm:"column:resource_id"`
	Details      map[string]interface{} `json:"details" gorm:"column:details;serializer:json"`
	CreatedAt    time.Time              `json:"created_at" gorm:"column:created_at"`
}

func (AuditLog) TableName() string { return "audit_logs" }

// AuditRepository IT 操作历史读写
type AuditRepository struct {
	db *gorm.DB
}

func NewAuditRepository(db *gorm.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

// Write 写入一条操作审计（由 IT 关键操作在成功落库后调用）
func (r *AuditRepository) Write(a *AuditLog) error {
	return r.db.Create(a).Error
}

// ListRecentIT 取本租户 IT 管理员最近的操作记录（按时间倒序）
func (r *AuditRepository) ListRecentIT(schoolID string, limit int) ([]AuditLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	var logs []AuditLog
	err := r.db.
		Table("audit_logs").
		Select("audit_logs.*").
		Joins("JOIN users u ON u.id = audit_logs.user_id").
		Where("audit_logs.school_id = ?", schoolID).
		Where("u.role = ?", "it_admin").
		Order("audit_logs.created_at DESC").
		Limit(limit).
		Find(&logs).Error
	return logs, err
}
