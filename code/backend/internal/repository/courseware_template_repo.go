package repository

import (
	"context"
	"time"

	"github.com/zhiwei/backend/internal/model"
	"gorm.io/gorm"
)

// CoursewareTemplateRepository 课件模板仓储（PPT/H5 共用）。
type CoursewareTemplateRepository struct {
	db *gorm.DB
}

func NewCoursewareTemplateRepository(db *gorm.DB) *CoursewareTemplateRepository {
	return &CoursewareTemplateRepository{db: db}
}

// TplFilter 列表过滤条件（全部可选；任一传入即按该维度 OR 命中）。
type TplFilter struct {
	Kind     string   // ppt | h5
	Styles   []string // 主风格
	Subjects []string // 学科
	Grades   []string // 学段
}

// List 按条件查询模板。subjects/grades 为 jsonb 数组，用 ? 包含匹配。
func (r *CoursewareTemplateRepository) List(ctx context.Context, f TplFilter) ([]model.CoursewareTemplate, error) {
	q := r.db.WithContext(ctx).Model(&model.CoursewareTemplate{})
	if f.Kind != "" {
		q = q.Where("kind = ?", f.Kind)
	}
	if len(f.Styles) > 0 {
		q = q.Where("style IN ?", f.Styles)
	}
	if len(f.Subjects) > 0 {
		q = q.Where("subjects ?| ?", f.Subjects) // jsonb ?| 任一元素命中
	}
	if len(f.Grades) > 0 {
		q = q.Where("grades ?| ?", f.Grades)
	}
	var items []model.CoursewareTemplate
	if err := q.Order("created_at ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// GetByID 按 ID 获取单个模板。
func (r *CoursewareTemplateRepository) GetByID(ctx context.Context, id string) (*model.CoursewareTemplate, error) {
	var t model.CoursewareTemplate
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&t).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

// Upsert 插入或更新模板（运营 CRUD 用）。
func (r *CoursewareTemplateRepository) Upsert(ctx context.Context, t *model.CoursewareTemplate) error {
	t.UpdatedAt = time.Now()
	var existing model.CoursewareTemplate
	err := r.db.WithContext(ctx).Where("id = ?", t.ID).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		t.CreatedAt = time.Now()
		return r.db.WithContext(ctx).Create(t).Error
	}
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Model(&existing).Updates(map[string]interface{}{
		"kind":         t.Kind,
		"name":         t.Name,
		"style":        t.Style,
		"color_family": t.ColorFamily,
		"theme_id":     t.ThemeID,
		"tags":         t.Tags,
		"subjects":     t.Subjects,
		"grades":       t.Grades,
		"demo_outline": t.DemoOutline,
		"is_builtin":   t.IsBuiltin,
		"updated_at":   t.UpdatedAt,
	}).Error
}

// Delete 删除模板（运营下架用）。
func (r *CoursewareTemplateRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.CoursewareTemplate{}).Error
}
