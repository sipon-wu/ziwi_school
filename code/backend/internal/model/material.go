package model

import "time"

type Material struct {
	ID        string    `json:"id" gorm:"type:varchar(50);default:gen_random_uuid()"`
	SchoolID  string    `json:"school_id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Format    string    `json:"format"` // ppt | h5 | video（课件形态，与 type 正交：courseware 可含 ppt/h5，video 独占）
	Size      string    `json:"size"`
	Tag       string    `json:"tag"`
	URL       string    `json:"url"`
	Content   string    `gorm:"type:text" json:"content,omitempty"`
	H5HTML    string    `gorm:"type:text" json:"h5_html,omitempty"` // 自动生成的投屏互动 H5 课件完整 HTML（扫码可访问）
	InteractiveSlots string `gorm:"type:text" json:"interactive_slots,omitempty"` // 每页互动组件摘要快照（JSON 数组，按页存 interactive 或 null）；持久化兜底，编辑态还原靠 content 内 CW-IT
	Status    string    `json:"status"` // draft | active（课件草稿/已发布，与 exercises.status 对齐）
	Grade     string    `json:"grade"`
	Subject   string    `json:"subject"`
	ThemeID   string    `json:"theme_id,omitempty"` // 课件主题（配色方案），对应前端 pptThemes.ts 的 CwTheme.id

	// ── 装饰元件架构扩展（P0）──
	// 仅新增字段，不动既有字段语义。存量数据 category 默认 'courseware'。
	Category    string    `json:"category" gorm:"type:varchar(30);default:courseware"` // courseware|decor_element|decor_component
	DecorFacets DecorFacets `json:"decor_facets" gorm:"type:jsonb"` // 6维 facet 标签路径数组
	Applicable  string    `json:"applicable" gorm:"type:varchar(10)"` // ppt|h5|common（媒介适用性，冗余自 facet 便于索引）
	MotifRoot   string    `json:"motif_root" gorm:"type:varchar(40)"` // 母题一级（冗余自 facet 便于索引）
	Interaction string    `json:"interaction" gorm:"type:varchar(30)"` // 交互类型：静态|动效.浮动|响应.点读高亮 ...
	ParentIDs   StringSlice `json:"parent_ids" gorm:"type:jsonb"` // 组件指向其元件的 asset_id 数组

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Material) TableName() string { return "materials" }
