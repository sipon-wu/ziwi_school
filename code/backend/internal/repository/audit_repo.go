package repository

import (
	"log"
	"time"

	"github.com/google/uuid"
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

// BeforeCreate 统一生成主键（2026-09-18 修，**审计失效的直接原因**）。
//
// ⚠ 此前 AuditLog 没有任何主键生成逻辑：GORM 会显式写入空串 `id=''`，从而**绕过**建表时声明的
// `DEFAULT gen_random_uuid()` → 第一条以 id='' 落库，其后每一条都撞
// `duplicate key value violates unique constraint "audit_logs_pkey"`（SQLSTATE 23505）。
// 叠加调用点的 `_ = repo.Write(...)` 吞错，表现为"审计只有 0~1 条且无人察觉"
// （实测 staging 1 条 / **prod 0 条** —— IT 的教材版本增删改导入从未真正留痕）。
func (a *AuditLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	return nil
}

// Write 写入一条操作审计（由 IT 关键操作在成功落库后调用）。
// 失败**必须可见**（2026-09-18）：调用点多写 `_ = repo.Write(...)`，若这里不吭声，
// "审计静默失效"就永远查不出来（上面那条 23505 就是这么被埋了很久的）。
func (r *AuditRepository) Write(a *AuditLog) error {
	if err := r.db.Create(a).Error; err != nil {
		log.Printf("[audit] 操作审计写入失败 action=%s resource=%s/%v: %v", a.Action, a.ResourceType, a.ResourceID, err)
		return err
	}
	return nil
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
