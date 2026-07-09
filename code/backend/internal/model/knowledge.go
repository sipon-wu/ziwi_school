package model

import "time"

// ─────────────────────────────────────────────────────────────
// 课标 / 教材 / 知识图谱（数据初始化 v0.7 全国公共库）
// 表名统一前缀 tb_*，与运行期用户提交的 textbook_versions 并存不冲突。
// ─────────────────────────────────────────────────────────────

// TextbookVersion 教材版本（全国版本库锚点，数据团队维护）
type TextbookVersion struct {
	ID            int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	VersionKey    string    `gorm:"type:varchar(200);uniqueIndex;not null" json:"version_key"`
	XueDuan      string    `gorm:"type:varchar(20)" json:"xue_duan"`
	NianJi       string    `gorm:"type:varchar(20)" json:"nian_ji"`
	XueKe        string    `gorm:"type:varchar(20)" json:"xue_ke"`
	JiaoCaiMing  string    `gorm:"type:varchar(300)" json:"jiao_cai_ming"`
	ChuBanShe    string    `gorm:"type:varchar(100)" json:"chu_ban_she"`
	BanBenBiaoShi string   `gorm:"type:varchar(50)" json:"ban_ben_biao_shi"`
	CeBie        string    `gorm:"type:varchar(20)" json:"ce_bie"`
	MuLuURL      string    `gorm:"type:varchar(500)" json:"mu_lu_url"`
	Inferred     bool      `gorm:"type:boolean;default:false" json:"inferred"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (TextbookVersion) TableName() string { return "tb_textbook_version" }

// StandardClause 课标条款
type StandardClause struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	XueDuan      string    `gorm:"type:varchar(20);uniqueIndex:uk_clause" json:"xue_duan"`
	XueKe        string    `gorm:"type:varchar(20);uniqueIndex:uk_clause" json:"xue_ke"`
	TiaoMuLuJing string    `gorm:"type:varchar(500);uniqueIndex:uk_clause" json:"tiao_mu_lu_jing"`
	YeZiBianHao  string    `gorm:"type:varchar(50);uniqueIndex:uk_clause" json:"ye_zi_bian_hao"`
	ZhengWen     string    `gorm:"type:text" json:"zheng_wen"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (StandardClause) TableName() string { return "tb_standard_clause" }

// VersionStandardMap 教材版本↔课标映射
type VersionStandardMap struct {
	ID              int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	VersionID       int64     `gorm:"type:bigint;not null;index" json:"version_id"`
	DanYuan         string    `gorm:"type:varchar(200)" json:"dan_yuan"`
	StandardClauseID int64    `gorm:"type:bigint;index" json:"standard_clause_id"`
	PiPeiDu         string    `gorm:"type:varchar(20)" json:"pi_pei_du"`
	ZhiShiDian      string    `gorm:"type:varchar(200)" json:"zhi_shi_dian"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (VersionStandardMap) TableName() string { return "tb_version_standard_map" }

// KGNode 知识图谱节点（单元→知识点→子知识点，自引用 parent_id）
type KGNode struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	NodeKey      string    `gorm:"type:varchar(400);uniqueIndex;not null" json:"node_key"`
	VersionID    int64     `gorm:"type:bigint;not null;index" json:"version_id"`
	DanYuan      string    `gorm:"type:varchar(200)" json:"dan_yuan"`
	ParentID     *int64    `gorm:"type:bigint;index" json:"parent_id"`
	MingCheng    string    `gorm:"type:varchar(300)" json:"ming_cheng"`
	Level        int       `gorm:"type:int" json:"level"`
	QianZhi      string    `gorm:"type:jsonb" json:"qian_zhi"` // 前置知识点名称数组
	NanDu        string    `gorm:"type:varchar(10)" json:"nan_du"`
	NengLiWeiDu  string    `gorm:"type:varchar(100)" json:"neng_li_wei_du"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (KGNode) TableName() string { return "tb_kg_node" }

// KGEdge 知识图谱边（belong 归属 / prereq 前置）
type KGEdge struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	FromID       int64     `gorm:"type:bigint;not null;index" json:"from_id"`
	ToID         int64     `gorm:"type:bigint;not null;index" json:"to_id"`
	RelationType string    `gorm:"type:varchar(20)" json:"relation_type"`
	CreatedAt    time.Time `json:"created_at"`
}

func (KGEdge) TableName() string { return "tb_kg_edge" }
