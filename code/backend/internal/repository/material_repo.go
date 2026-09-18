package repository

import (
	"context"
	"time"

	"github.com/zhiwei/backend/internal/model"
	"gorm.io/gorm"
)

type MaterialRepository struct{ db *gorm.DB }

func NewMaterialRepository(db *gorm.DB) *MaterialRepository { return &MaterialRepository{db} }

// listColumns 列表页所需列（刻意排除 content / h5_html / interactive_slots 大字段）：
// 2026-09-03 实测每份 H5 的 h5_html ≈90KB，105 份即 ~9.5MB 全量塞进列表 JSON，
// 导致课件库/宣发列表加载极慢（用户误判为"空"）。列表只要卡片字段；正文/快照走单条详情。
var listColumns = []string{
	"id", "school_id", "user_id", "name", "type", "format", "size", "tag", "url",
	"status", "grade", "subject", "theme_id", "category", "decor_facets", "applicable",
	"motif_root", "color_root", "page_type", "parent_ids", "created_at", "updated_at",
}

func (r *MaterialRepository) List(schoolID string) ([]model.Material, error) {
	var items []model.Material
	err := r.db.Select(listColumns).Where("school_id = ?", schoolID).Order("created_at DESC").Find(&items).Error
	return items, err
}

func (r *MaterialRepository) Create(m *model.Material) error {
	return r.db.Create(m).Error
}

// ListByType 按类型列出校内资产（notice 全校共用宣发 H5 用；空 type 不过滤）。
func (r *MaterialRepository) ListByType(schoolID, typ string) ([]model.Material, error) {
	var items []model.Material
	q := r.db.Select(listColumns).Where("school_id = ?", schoolID)
	if typ != "" {
		q = q.Where("type = ?", typ)
	}
	err := q.Order("created_at DESC").Find(&items).Error
	return items, err
}

// Update 更新素材（课件草稿/发布落库复用），仅更新可编辑字段
func (r *MaterialRepository) Update(m *model.Material) error {
	return r.db.Model(m).Where("id = ?", m.ID).Updates(map[string]interface{}{
		"name":      m.Name,
		"type":      m.Type,
		"tag":       m.Tag,
		"url":       m.URL,
		"content":   m.Content,
		"h5_html":   m.H5HTML,
		"status":           m.Status,
		"grade":            m.Grade,
		"subject":          m.Subject,
		"interactive_slots": m.InteractiveSlots,
		"category":          m.Category,
		"decor_facets":      m.DecorFacets,
		"applicable":        m.Applicable,
		"motif_root":        m.MotifRoot,
		"color_root":        m.ColorRoot,
		"page_type":         m.PageType,
		"parent_ids":        m.ParentIDs,
		"updated_at":        time.Now(),
	}).Error
}

// GetByID 按 ID 获取单个素材（含 content，供 AI 课件生成读取参照课件正文）
func (r *MaterialRepository) GetByID(id string) (*model.Material, error) {
	var m model.Material
	err := r.db.Where("id = ?", id).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// Delete 硬删除**自己名下**的素材，并级联清理挂在它上面的批注/版本。
//
// 为什么新增（2026-09-18）：后端此前**没有** DELETE /api/materials/:id —— 清空存量课件只能靠 SQL，
// e2e 守卫建出来的基线件也无法自清理（跑一次测试就在库里留一条）。
//
// 权限（有意从严）：只删 `user_id = 本人` 的行；**公共素材（user_id 为空，如装饰元件库）与别人的素材一律不删**。
// 返回 RowsAffected：0 表示"不存在或不属于本人"，由 handler 统一按 404 处理（不泄露存在性）。
//
// 级联：annotations / versions 以 `resource_id` 关联；历史数据里 `resource_type` 有 `material` 与 `courseware`
// 两种写法，且库内已实测存在孤儿行（引用早已删除的材料）—— 故此处按 resource_id 直接清，不挑 resource_type。
// 顺序：**先删本体并确认确实删到（本人）**，再级联 —— 否则非本人调用也能删掉别人的批注。
func (r *MaterialRepository) Delete(id, userID string) (int64, error) {
	res := r.db.Exec(`DELETE FROM materials WHERE id = ? AND user_id = ?`, id, userID)
	if res.Error != nil {
		return 0, res.Error
	}
	if res.RowsAffected == 0 {
		return 0, nil
	}
	if err := r.db.Exec(`DELETE FROM annotations WHERE resource_id = ?`, id).Error; err != nil {
		return res.RowsAffected, err
	}
	// ⚠ 只清 **snapshot**（草稿期快照），**保留 kind='release' 的发布留痕**（2026-09-18 修）。
	// 为什么：`Version.BeforeDelete` 已明确"release 版本不可删除（留痕须保留以备追溯）"，
	// 但此处用的是原生 `Exec`，**绕过 GORM 钩子**——于是删素材会把它的发布留痕一并抹掉，证据链断裂。
	// 审计口径：素材删除后仍应能回答"这份课件曾发布过什么、谁发布的、审没审"
	// （删除动作本身另记 audit_logs，见 handler.DeleteMaterial）。
	if err := r.db.Exec(`DELETE FROM versions WHERE resource_id = ? AND kind <> ?`, id, "release").Error; err != nil {
		return res.RowsAffected, err
	}
	return res.RowsAffected, nil
}

// ListUntaggedDecor 列出未打 facet 标签的装饰元件（供 AI 定时巡增标签任务扫描）。
// 未打标定义: category 为装饰类 且 (decor_facets 为 NULL 或空数组)。
// schoolID 为空串时查全平台（平台运维定时任务用）。
func (r *MaterialRepository) ListUntaggedDecor(ctx context.Context, schoolID string, limit int) ([]model.Material, error) {
	var items []model.Material
	q := r.db.WithContext(ctx).
		Where("category = ? OR category = ?", "decor_element", "decor_component").
		Where("(decor_facets IS NULL OR jsonb_array_length(decor_facets) = 0)")
	if schoolID != "" {
		q = q.Where("school_id = ?", schoolID)
	}
	q = q.Order("created_at ASC").Limit(limit)
	err := q.Find(&items).Error
	return items, err
}

// SaveDecorFacets 仅写回 facet 标签相关字段（AI 巡增任务用，避免触碰课件正文等大字段）。
func (r *MaterialRepository) SaveDecorFacets(ctx context.Context, id string, facets model.DecorFacets, motif, color, pageType, applicable string) error {
	return r.db.WithContext(ctx).Model(&model.Material{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"decor_facets": facets,
			"motif_root":   motif,
			"color_root":   color,
			"page_type":    pageType,
			"applicable":   applicable,
			"updated_at":   time.Now(),
		}).Error
}
