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

// SchoolTextbookOverride 学校自用教材版本覆盖层
// 学校基于平台公共库 tb_textbook_version 做本地化调整时落在此表：
// 仅对本校生效、不影响公共库，多校互不影响。上报平台审核并回灌公共库的能力后续扩展。
type SchoolTextbookOverride struct {
	ID          string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID    string    `gorm:"type:varchar(50);not null;uniqueIndex:uk_school_tb_override" json:"school_id"`
	Subject     string    `gorm:"type:varchar(20);not null;uniqueIndex:uk_school_tb_override" json:"subject"`
	Grade       string    `gorm:"type:varchar(20);not null;default:'';uniqueIndex:uk_school_tb_override" json:"grade"`
	Publisher   string    `gorm:"type:varchar(100)" json:"publisher"`
	VersionName string    `gorm:"type:varchar(200)" json:"version_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (SchoolTextbookOverride) TableName() string { return "school_textbook_override" }

// ── V2.5 教材版本三级配置表 ──

type TextbookConfigType string

const (
	ConfigTypeSchool       TextbookConfigType = "school"        // 学校级默认（学科→版本）
	ConfigTypeGradeSubject TextbookConfigType = "grade_subject" // 年级-学科级覆盖
	ConfigTypeClassSubject TextbookConfigType = "class_subject" // 班级级精细覆盖
)

// TextbookConfig 学校教材版本三级配置（V2.5 教材版本配置系统 P0）
// 优先级：class_subject > grade_subject > school
type TextbookConfig struct {
	ID          string             `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID    string             `gorm:"type:varchar(50);not null;index" json:"school_id"`
	ConfigType  TextbookConfigType `gorm:"type:varchar(20);not null" json:"config_type"` // school / grade_subject / class_subject
	Subject     string             `gorm:"type:varchar(20);not null" json:"subject"`     // 语文/数学/英语/...
	Grade       string             `gorm:"type:varchar(20);default:''" json:"grade"`     // 年级名，仅 grade_subject/class_subject
	ClassID     *string            `gorm:"type:varchar(50)" json:"class_id"`             // 班级ID，仅 class_subject
	Publisher   string             `gorm:"type:varchar(100)" json:"publisher"`
	VersionName string             `gorm:"type:varchar(200)" json:"version_name"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
}

func (TextbookConfig) TableName() string { return "textbook_config" }

// ResolvedTextbook 教材版本解析结果（含来源层级）
type ResolvedTextbook struct {
	Subject     string `json:"subject"`
	Publisher   string `json:"publisher"`
	VersionName string `json:"version_name"`
	SourceLevel string `json:"source_level"` // school / grade_subject / class_subject
}

// TeacherTextbookPref 教师个人教材偏好（per-user，跨设备同步，规格书 §5.1）。
// 维度升级为 年级+班级+学科：教师可在个人设置里为「每年级每班每学科」指定版本，
// 优先级高于学校级 textbook_config，仅影响该教师个人产出。唯一键 (teacher_id, grade, class_id, subject)。
type TeacherTextbookPref struct {
	ID          string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	TeacherID   string    `gorm:"type:varchar(50);not null;index" json:"teacher_id"`
	SchoolID    string    `gorm:"type:varchar(50);not null;index" json:"school_id"`
	Grade       string    `gorm:"type:varchar(20);not null;default:''" json:"grade"`    // 年级名；空=不限（仅按学科）
	ClassID     string    `gorm:"type:varchar(50);not null;default:''" json:"class_id"` // 班级ID；空=不限（按年级或仅学科）
	Subject     string    `gorm:"type:varchar(20);not null" json:"subject"`
	Publisher   string    `gorm:"type:varchar(100)" json:"publisher"`
	VersionName string    `gorm:"type:varchar(200)" json:"version_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (TeacherTextbookPref) TableName() string { return "teacher_textbook_pref" }
