package model

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// ── 装饰组件模板（P2 生产端）：元件组合 = 组件层级 ──
// 教师把多个装饰元件挂到插槽组合成「装饰组件模板」，保存为个人资产；
// 提交运营审核通过后进入公共模板供给（scope=public）。
// 本期个人模板存 DB（此前为 localStorage MVP）。

// DecorItem 装饰元件引用（挂到槽位时记录 id 归属 + url 渲染）。
type DecorItem struct {
	ID   string `json:"id"`
	URL  string `json:"url"`
	Name string `json:"name,omitempty"`
}

// DecorSlots 插槽式装饰结构（非自由画布，系统自动布局）。
// 各槽位挂装饰元件引用；background 为铺满背景图 URL。
type DecorSlots struct {
	Header   []DecorItem `json:"header,omitempty"`
	Footer   []DecorItem `json:"footer,omitempty"`
	Corners  []DecorItem `json:"corners,omitempty"`
	Float    []DecorItem `json:"floating,omitempty"`
	Background string    `json:"background,omitempty"`
}

// Value 实现 driver.Valuer：以 JSON 字符串写入 jsonb 列。
func (s DecorSlots) Value() (driver.Value, error) {
	if s.Header == nil && s.Footer == nil && s.Corners == nil && s.Float == nil && s.Background == "" {
		return "{}", nil
	}
	b, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

// Scan 实现 sql.Scanner：从 jsonb 读取 JSON 文本解析为 DecorSlots。
func (s *DecorSlots) Scan(src interface{}) error {
	if src == nil {
		*s = DecorSlots{}
		return nil
	}
	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return errors.New("DecorSlots.Scan: unsupported type")
	}
	return json.Unmarshal(data, s)
}

// DecorTemplate 装饰组件模板（组件层级）。
type DecorTemplate struct {
	ID        string    `json:"id" gorm:"primaryKey;type:varchar(50)"`
	UserID    string    `json:"user_id" gorm:"type:varchar(50);index"`
	Name      string    `json:"name" gorm:"type:varchar(120)"`
	Slots     DecorSlots `json:"slots" gorm:"type:jsonb"`
	Facets    StringSlice `json:"facets" gorm:"type:jsonb"` // 母题等受控词，便于检索与运营审核归类
	Status    string    `json:"status" gorm:"type:varchar(20);default:draft"` // draft|pending|approved|rejected
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (DecorTemplate) TableName() string { return "decor_templates" }
