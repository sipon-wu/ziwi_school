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

	// ── AI 生成标识（《生成式人工智能服务管理暂行办法》第四条：对生成内容应依法标识）──
	// 注意：教师修改后 AIGenerated 仍为 true（底稿由 AI 生成），同时 HumanEdited=true，
	// 以此如实反映"AI 参与程度"，不因人工碰过就摘掉 AI 标识。
	AIGenerated    bool   `json:"ai_generated" gorm:"column:ai_generated;not null;default:false"`
	AIModelVersion string `json:"ai_model_version,omitempty" gorm:"column:ai_model_version;type:varchar(50)"`
	HumanEdited    bool   `json:"human_edited" gorm:"column:human_edited;not null;default:false"`

	// ── 装饰元件架构扩展（P0）──
	// 仅新增字段，不动既有字段语义。存量数据 category 默认 'courseware'。
	// facet 维度收敛为 4 维：applicable(媒介) / motif(母题) / color(色系) / page_type(页型)，
	// 与前端 cwTemplate.ts 的 STYLE_LABELS / COLOR_FAMILIES 同源，供 AI 自动匹配。
	Category    string    `json:"category" gorm:"type:varchar(30);default:courseware"` // courseware|decor_element|decor_component
	DecorFacets DecorFacets `json:"decor_facets" gorm:"type:jsonb"` // 4维 facet 标签路径数组，如 ["motif.国风","color.蓝系","page_type.cover"]
	Applicable  string    `json:"applicable" gorm:"type:varchar(10)"` // ppt|h5|common（媒介适用性，冗余自 facet 便于索引）
	MotifRoot   string    `json:"motif_root" gorm:"type:varchar(40)"` // 母题一级（冗余自 facet 便于索引）
	ColorRoot   string    `json:"color_root" gorm:"type:varchar(40)"` // 色系一级（冗余自 facet，与 COLOR_FAMILIES 同源）
	PageType    string    `json:"page_type" gorm:"type:varchar(30)"` // 适用页型（cover|content|summary|homework...，冗余自 facet）
	ParentIDs   StringSlice `json:"parent_ids" gorm:"type:jsonb"` // 组件指向其元件的 asset_id 数组

	// OwnerName 归属教师显示名（列表页展示"谁的课件"用）。
	// 不入库（gorm:"-"），由 ListMaterials 动态填充：按 school 内 user_id 一次查询映射，避免 N+1。
	OwnerName string `json:"owner_name" gorm:"-"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Material) TableName() string { return "materials" }
