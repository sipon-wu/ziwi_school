package model

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"gorm.io/gorm"
)

// ── 用户与学校 ──

// School 学校（租户）

func randomHex(n int) string {
	b := make([]byte, n/2+1)
	rand.Read(b)
	return hex.EncodeToString(b)[:n]
}

type School struct {
	ID               string     `gorm:"type:varchar(30);primaryKey" json:"id"`
	FullName         string     `gorm:"type:varchar(200);not null" json:"full_name"`
	ShortName        string     `gorm:"type:varchar(100)" json:"short_name"`
	CloudTenantID    *string    `gorm:"type:varchar(50);index" json:"cloud_tenant_id"` // 对应 cloud IdP 的 tenant_id（统一登录 P0）
	SystemType       string     `gorm:"type:varchar(10);default:六三制" json:"system_type"`
	Region           string     `gorm:"type:varchar(100)" json:"region"`
	Status           string     `gorm:"type:varchar(20);default:active" json:"status"`
	LicenseStatus    string     `gorm:"type:varchar(20);default:none;index" json:"license_status"` // active/trial/none（V2.5 教材版本配置 P0）
	LicenseExpiresAt *time.Time `json:"license_expires_at"`
	TokenQuota       int64      `gorm:"default:0" json:"token_quota"`
	TokenUsed        int64      `gorm:"default:0" json:"token_used"`
	// 心跳上报（P2 私有部署心跳对齐）
	LastHeartbeatAt    *time.Time `json:"last_heartbeat_at"`
	HeartbeatFailCount int        `gorm:"default:0" json:"heartbeat_fail_count"`
	// 教案互审开关（规格书 §2.2.4，默认关闭；教师/IT 可在设置开启；开启后发布=送审 pending）
	LessonReviewEnabled bool `gorm:"default:false" json:"lesson_review_enabled"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// Campus 校区字典（A1 一校多区：同 School 下的正式校区，users/classes.campus_id 引用其 ID）
type Campus struct {
	ID        string    `gorm:"type:varchar(50);primaryKey" json:"id"`
	SchoolID  string    `gorm:"type:varchar(50);not null;uniqueIndex:uk_campus_school_name" json:"school_id"`
	Name      string    `gorm:"type:varchar(100);not null;uniqueIndex:uk_campus_school_name" json:"name"`
	Address   string    `gorm:"type:varchar(300)" json:"address"`
	SortOrder int       `gorm:"default:0" json:"sort_order"`
	Status    string    `gorm:"type:varchar(20);default:active" json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Campus) TableName() string { return "campuses" }

// LicenseStatus constants
const (
	LicenseActive = "active" // 学校版已开通
	LicenseTrial  = "trial"  // 试用期（宽限期）
	LicenseNone   = "none"   // 未开通（个人试用/SaaS 模式）
)

// User 用户（8种校内角色 + 2种平台角色 + 学生 + 家长）
type User struct {
	ID             string     `gorm:"type:varchar(30);primaryKey" json:"id"`
	SchoolID       *string    `gorm:"type:varchar(50)" json:"school_id"`
	Phone          string     `gorm:"type:varchar(20);uniqueIndex;not null" json:"phone"`
	PasswordHash   string     `gorm:"type:varchar(255);not null" json:"-"`
	Role           string     `gorm:"type:varchar(30);not null" json:"role"`
	Name           string     `gorm:"type:varchar(100);not null" json:"name"`
	Email          string     `gorm:"type:varchar(200)" json:"email"`
	CloudUserID    *string    `gorm:"type:varchar(50);index" json:"cloud_user_id"` // 对应 cloud IdP 账号 sub（统一登录 P0，P1 用于绑定）
	AvatarURL      string     `gorm:"type:varchar(500)" json:"avatar_url"`
	WechatOpenID   string     `gorm:"type:varchar(100)" json:"wechat_openid"`
	CampusID       *string    `gorm:"type:varchar(50)" json:"campus_id"`
	StudentNumber  *string    `gorm:"type:varchar(50);index" json:"student_number"`
	ForceReset     bool       `gorm:"type:boolean;default:false" json:"force_reset"`
	Status         string     `gorm:"type:varchar(20);default:active" json:"status"`
	PhoneUpdatedAt *time.Time `json:"phone_updated_at"`
	LeftAt         *time.Time `json:"left_at"`
	SuccessorID    *string    `gorm:"type:varchar(50)" json:"successor_id"`
	StyleProfile   string     `gorm:"type:jsonb" json:"style_profile"`
	Subject        string     `gorm:"type:varchar(20)" json:"subject"` // 默认任教学科（登录后前端据此初始化）
	Grade          string     `gorm:"type:varchar(20)" json:"grade"`   // 默认任教学段（如 四年级）
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// Class 班级
type Class struct {
	ID            string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID      string    `gorm:"type:varchar(50);not null;index" json:"school_id"`
	CampusID      *string   `gorm:"type:varchar(50)" json:"campus_id"`
	Name          string    `gorm:"type:varchar(100);not null" json:"name"`
	Grade         string    `gorm:"type:varchar(20);not null" json:"grade"`
	ClassType     string    `gorm:"type:varchar(20);default:normal" json:"class_type"`
	HeadTeacherID *string   `gorm:"type:varchar(50);uniqueIndex" json:"head_teacher_id"`
	CreatedAt     time.Time `json:"created_at"`
}

// TeacherClass 教师-班级-学科关联
type TeacherClass struct {
	ID        string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	TeacherID string    `gorm:"type:varchar(50);not null;index" json:"teacher_id"`
	ClassID   string    `gorm:"type:varchar(50);not null;index" json:"class_id"`
	Subject   string    `gorm:"type:varchar(20);not null" json:"subject"`
	IsPrimary bool      `gorm:"default:false" json:"is_primary"`
	CreatedAt time.Time `json:"created_at"`
}

// StudentClass 学生-班级关联
type StudentClass struct {
	ID         string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	StudentID  string    `gorm:"type:varchar(50);not null;index" json:"student_id"`
	ClassID    string    `gorm:"type:varchar(50);not null;index" json:"class_id"`
	EnrolledAt time.Time `json:"enrolled_at"`
}

// ImportBatch 导入批次记录（支持按 batch_id 全回滚）
type ImportBatch struct {
	ID          string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID    string    `gorm:"type:varchar(50);not null;index" json:"school_id"`
	Type        string    `gorm:"type:varchar(20);not null" json:"type"` // classes/teachers/students/relations
	CreatedBy   string    `gorm:"type:varchar(50)" json:"created_by"`
	Status      string    `gorm:"type:varchar(20);default:committed" json:"status"` // committed/rolled_back
	TotalRows   int       `json:"total_rows"`
	CreatedRows int       `json:"created_rows"`
	SkippedRows int       `json:"skipped_rows"`
	Summary     string    `gorm:"type:jsonb" json:"summary"` // ImportBatchSummary 的 JSON
	CreatedAt   time.Time `json:"created_at"`
}

// ImportBatchSummary 记录本批次新建的实体 ID，供回滚时按逆序删除
type ImportBatchSummary struct {
	CreatedUserIDs         []string `json:"created_user_ids"`
	CreatedClassIDs        []string `json:"created_class_ids"`
	CreatedStudentClassIDs []string `json:"created_student_class_ids"`
	CreatedTeacherClassIDs []string `json:"created_teacher_class_ids"`
}

// ── 教案 ──

// LessonPlan 教案
type LessonPlan struct {
	ID               string    `gorm:"type:varchar(50);primaryKey" json:"id"`
	TeacherID        string    `gorm:"column:teacher_id;type:varchar(50);not null;index" json:"teacher_id"`
	SchoolID         string    `gorm:"column:school_id;type:varchar(50);not null;index" json:"school_id"`
	Subject          string    `gorm:"type:varchar(20);not null" json:"subject"`
	Grade            string    `gorm:"type:varchar(20);not null" json:"grade"`
	Title            string    `gorm:"column:title;type:varchar(200)" json:"title"`
	Unit             string    `gorm:"column:textbook_unit;type:varchar(100)" json:"unit"`
	LessonPeriod     int       `gorm:"column:period;default:1" json:"lesson_period"`
	TemplateType     string    `gorm:"column:format_template;type:varchar(50)" json:"template_type"`
	Content          string    `gorm:"type:text;not null" json:"content"`
	KnowledgeNodes   string    `gorm:"column:knowledge_node_ids;type:text" json:"knowledge_nodes"`
	CurriculumAlign  string    `gorm:"column:curriculum_alignments;type:text" json:"curriculum_alignments"`
	AIGenerated      bool      `gorm:"default:false" json:"ai_generated"`
	AIModelVersion   string    `gorm:"type:varchar(50)" json:"ai_model_version"`
	GenerationTimeMs int       `json:"generation_time_ms"`
	EditCount        int       `gorm:"default:0" json:"edit_count"`
	ReviewStatus     string    `gorm:"type:varchar(20);default:none" json:"review_status"`
	Status           string    `gorm:"type:varchar(20);default:draft" json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	// 模型中定义但DB暂无的字段
	ClassID           *string    `gorm:"-" json:"class_id,omitempty"`
	TextbookVersionID *string    `gorm:"-" json:"textbook_version_id,omitempty"`
	CustomTags        string     `gorm:"-" json:"custom_tags,omitempty"`
	SupplementText    string     `gorm:"-" json:"supplement_text,omitempty"`
	MaterialRefs      string     `gorm:"column:material_links;type:text" json:"material_refs,omitempty"`
	AIGenerationBasis string     `gorm:"-" json:"ai_generation_basis,omitempty"`
	LastEditedAt      *time.Time `gorm:"-" json:"last_edited_at,omitempty"`
	ReviewerID        *string    `gorm:"column:reviewer_id;type:varchar(50);index" json:"reviewer_id,omitempty"`
	ReviewComment     string     `gorm:"column:review_comment;type:text" json:"review_comment,omitempty"`
	ReviewedAt        *time.Time `gorm:"column:reviewed_at" json:"reviewed_at,omitempty"`
	PublishedAt       *time.Time `json:"published_at"`
}

// ReviewAssignment 教案审核分配
type ReviewAssignment struct {
	ID           string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	LessonPlanID string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"lesson_plan_id"`
	AssignMethod string    `gorm:"type:varchar(20);not null" json:"assign_method"`
	ReviewerID   *string   `gorm:"type:varchar(50);index" json:"reviewer_id"`
	AssignerID   *string   `gorm:"type:varchar(50)" json:"assigner_id"`
	AssignedAt   time.Time `json:"assigned_at"`
}

// ── 通用函数 ──

// BeforeCreate GORM hook: 设置创建/更新时间 + 生成短ID
func (u *User) BeforeCreate(tx *gorm.DB) error {
	now := time.Now()
	u.CreatedAt = now
	u.UpdatedAt = now
	if u.ID == "" {
		u.ID = GenUserID()
	}
	return nil
}

func (l *LessonPlan) BeforeCreate(tx *gorm.DB) error {
	if l.ID == "" {
		l.ID = "lp_" + randomHex(12)
	}
	now := time.Now()
	l.CreatedAt = now
	l.UpdatedAt = now
	return nil
}

// BeforeCreate for School — 生成 zw + 16位hex ID
func (s *School) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = GenAppID()
	}
	return nil
}
