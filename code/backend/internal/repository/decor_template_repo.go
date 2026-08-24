package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
)

// SaveDecorTemplate 保存/提交装饰模板。status: draft(草稿) | pending(提交审核)。
func (r *MaterialRepository) SaveDecorTemplate(ctx context.Context, t *model.DecorTemplate) error {
	t.UpdatedAt = time.Now()
	if t.ID == "" {
		t.ID = "dt-" + time.Now().Format("20060102150405") + "-" + t.UserID
		t.CreatedAt = time.Now()
	}
	var existing model.DecorTemplate
	err := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", t.ID, t.UserID).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return r.db.WithContext(ctx).Create(t).Error
	}
	if err != nil {
		return err
	}
	// 仅允许作者本人更新自己的草稿/被驳回模板
	return r.db.WithContext(ctx).Model(&existing).
		Updates(map[string]interface{}{
			"name":        t.Name,
			"slots":       t.Slots,
			"facets":      t.Facets,
			"status":      t.Status,
			"updated_at":  t.UpdatedAt,
		}).Error
}

// ListDecorTemplates 按 scope 列出装饰模板。
// scope=mine: 当前账号全部；scope=public: 仅运营审核通过(approved)的。
func (r *MaterialRepository) ListDecorTemplates(ctx context.Context, userID, scope string) ([]model.DecorTemplate, error) {
	var list []model.DecorTemplate
	q := r.db.WithContext(ctx).Order("created_at DESC")
	switch scope {
	case "public":
		q = q.Where("status = ?", "approved")
	default:
		if userID == "" {
			return list, nil
		}
		q = q.Where("user_id = ?", userID)
	}
	err := q.Find(&list).Error
	return list, err
}
