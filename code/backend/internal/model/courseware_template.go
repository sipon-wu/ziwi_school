package model

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// TplTag 课件模板多维标签（与前端 cwTemplate.ts 的 TplTag 同源）。
// 风格/学段/学科/场景/页型混合，供面板多选筛选（OR 语义）。
type TplTag struct {
	Kind  string `json:"kind"`  // style | stage | subject | scenario | pageType
	Value string `json:"value"` // 具体标签值
}

// TplTags 模板标签数组，以 JSON 读写 jsonb 列。
type TplTags []TplTag

func (t TplTags) Value() (driver.Value, error) {
	if t == nil {
		return "[]", nil
	}
	b, err := json.Marshal(t)
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

func (t *TplTags) Scan(src interface{}) error {
	if src == nil {
		*t = TplTags{}
		return nil
	}
	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return errors.New("unsupported type for TplTags.Scan")
	}
	if len(data) == 0 {
		*t = TplTags{}
		return nil
	}
	return json.Unmarshal(data, t)
}

// CoursewareTemplate 课件模板（PPT/H5 共用，靠 Kind 区分）。
// 与前端 cwTemplate.ts 的 CwTemplate 字段对齐；内置装饰/版式骨架不落库（由 style 派生）。
type CoursewareTemplate struct {
	ID          string    `json:"id" gorm:"type:varchar(64);primaryKey"`
	Kind        string    `json:"kind" gorm:"type:varchar(16);not null;default:ppt"` // ppt | h5
	Name        string    `json:"name" gorm:"type:varchar(128);not null"`
	Style       string    `json:"style" gorm:"type:varchar(32);not null"`           // 主风格 (StyleTag)
	ColorFamily string    `json:"color_family" gorm:"type:varchar(32)"`              // 后生成色系描述
	ThemeID     string    `json:"theme_id" gorm:"type:varchar(64);not null"`         // 引用 pptThemes 的 CwTheme
	Tags        TplTags   `json:"tags" gorm:"type:jsonb"`                            // 多维标签
	Subjects    StringSlice `json:"subjects" gorm:"type:jsonb"`                     // 适配学科
	Grades      StringSlice `json:"grades" gorm:"type:jsonb"`                       // 适配学段
	DemoOutline string    `json:"demo_outline" gorm:"type:jsonb"`                   // OutlineSlide[] JSON
	IsBuiltin   bool      `json:"is_builtin" gorm:"not null;default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (CoursewareTemplate) TableName() string { return "courseware_templates" }
