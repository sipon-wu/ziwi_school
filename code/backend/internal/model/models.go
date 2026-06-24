package model

import (
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type School struct {
	ID                     uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name                   string     `gorm:"size:200;not null" json:"name"`
	Region                 string     `gorm:"size:100" json:"region"`
	AIModelTier            string     `gorm:"size:50;default:'qwen-plus'" json:"ai_model_tier"`
	AllowModelSwitch       bool       `gorm:"default:false" json:"allow_model_switch"`
	ShowModelUI            bool       `gorm:"default:false" json:"show_model_ui"`
	WorkMode               string     `gorm:"size:20;default:'formal'" json:"work_mode"`
	TrialDays              int        `gorm:"default:14" json:"trial_days,omitempty"`
	TrialQuota             int64      `gorm:"default:100000" json:"trial_quota,omitempty"`
	TrialStarted           *time.Time `json:"trial_started,omitempty"`
	EnableKnowledgeGraph   bool       `gorm:"default:false" json:"enable_knowledge_graph"`
	DefaultTokenQuota      int64      `gorm:"default:0" json:"default_token_quota"`
	CreatedAt              time.Time  `json:"created_at"`
	Classes                []Class    `gorm:"foreignKey:SchoolID" json:"classes,omitempty"`
	Users                  []User     `gorm:"foreignKey:SchoolID" json:"users,omitempty"`
}

func (School) TableName() string { return "schools" }

type User struct {
	ID                 uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID           *uuid.UUID `gorm:"type:uuid" json:"school_id,omitempty"`
	Phone              string     `gorm:"size:20;uniqueIndex" json:"phone"`
	Username           string     `gorm:"size:100;uniqueIndex" json:"username,omitempty"`
	PasswordHash       string     `gorm:"size:255;not null" json:"-"`
	Role               string     `gorm:"size:20;not null;check:role IN ('teacher','student','parent','admin','it_admin','academic_admin','principal')" json:"role"`
	Name               string     `gorm:"size:100;not null" json:"name"`
	AvatarURL          string     `gorm:"size:500" json:"avatar_url,omitempty"`
	Grade              string     `gorm:"size:20" json:"grade,omitempty"`
	Subject            string     `gorm:"size:20" json:"subject,omitempty"`
	ParentStudentID    *uuid.UUID `gorm:"type:uuid" json:"parent_student_id,omitempty"`
	AccountSource      string     `gorm:"size:20;default:'admin_created'" json:"account_source,omitempty"`
	TokenQuotaMonthly  int64      `gorm:"default:0" json:"token_quota_monthly,omitempty"`
	TokenQuotaCustom   bool       `gorm:"default:false" json:"token_quota_custom"`
	TokenUsedMonthly   int64      `gorm:"default:0" json:"token_used_monthly,omitempty"`
	TokenResetDate     *time.Time `json:"token_reset_date,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	// Associations
	School         *School         `gorm:"foreignKey:SchoolID" json:"-"`
	TeacherClasses []TeacherClass  `gorm:"foreignKey:TeacherID" json:"-"`
	StudentClasses []StudentClass  `gorm:"foreignKey:StudentID" json:"-"`
	LessonPlans    []LessonPlan    `gorm:"foreignKey:TeacherID" json:"-"`
}

func (User) TableName() string { return "users" }

type Class struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID  uuid.UUID `gorm:"type:uuid;not null;index" json:"school_id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	Grade     string    `gorm:"size:20;not null" json:"grade"`
	CreatedAt time.Time `json:"created_at"`
}

func (Class) TableName() string { return "classes" }

// Campus 分校
type Campus struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID  uuid.UUID `gorm:"type:uuid;not null;index" json:"school_id"`
	Name      string    `gorm:"size:200;not null" json:"name"`
	Grades    string    `gorm:"type:jsonb;default:'[]'" json:"grades"`
	CreatedAt time.Time `json:"created_at"`
}

func (Campus) TableName() string { return "campuses" }

type TeacherClass struct {
	TeacherID uuid.UUID `gorm:"type:uuid;primaryKey" json:"teacher_id"`
	ClassID   uuid.UUID `gorm:"type:uuid;primaryKey" json:"class_id"`
	Subject   string    `gorm:"size:20;not null;primaryKey" json:"subject"`
}

func (TeacherClass) TableName() string { return "teacher_classes" }

type StudentClass struct {
	StudentID uuid.UUID `gorm:"type:uuid;primaryKey" json:"student_id"`
	ClassID   uuid.UUID `gorm:"type:uuid;primaryKey" json:"class_id"`
}

func (StudentClass) TableName() string { return "student_classes" }

type LessonPlan struct {
	ID                  uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TeacherID           uuid.UUID       `gorm:"type:uuid;not null;index" json:"teacher_id"`
	SchoolID            uuid.UUID       `gorm:"type:uuid;not null;index" json:"school_id"`
	Subject             string          `gorm:"size:20;not null" json:"subject"`
	Grade               string          `gorm:"size:20;not null" json:"grade"`
	TextbookUnit        string          `gorm:"size:200" json:"textbook_unit,omitempty"`
	LessonTitle         string          `gorm:"size:300;not null" json:"lesson_title"`
	Period              int             `gorm:"default:1" json:"period"`
	Content             string          `gorm:"type:jsonb;not null;default:'{}'" json:"content"`
	CurriculumAlignments string         `gorm:"type:jsonb;default:'[]'" json:"curriculum_alignments,omitempty"`
	KnowledgeNodeIDs    string          `gorm:"type:jsonb;default:'[]'" json:"knowledge_node_ids,omitempty"`
	FormatTemplate      string          `gorm:"size:50;default:'core_literacy'" json:"format_template"`
	AIGenerated         bool            `gorm:"default:false" json:"ai_generated"`
	AIModelVersion      string          `gorm:"size:50" json:"ai_model_version,omitempty"`
	GenerationTimeMs    *int            `json:"generation_time_ms,omitempty"`
	ManualEdited        bool            `gorm:"default:false" json:"manual_edited"`
	EditCount           int             `gorm:"default:0" json:"edit_count"`
	Status              string          `gorm:"size:20;default:'draft';check:status IN ('draft','final')" json:"status"`
	ReviewStatus        string          `gorm:"size:20;default:'none'" json:"review_status,omitempty"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

func (LessonPlan) TableName() string { return "lesson_plans" }

func (lp *LessonPlan) BeforeCreate(tx *gorm.DB) error {
	if lp.Status == "" {
		lp.Status = "draft"
	}
	return nil
}

type Assignment struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TeacherID      uuid.UUID `gorm:"type:uuid;not null;index" json:"teacher_id"`
	ClassID        uuid.UUID `gorm:"type:uuid;not null;index" json:"class_id"`
	SchoolID       uuid.UUID `gorm:"type:uuid;not null;index" json:"school_id"`
	Subject        string    `gorm:"size:20;not null" json:"subject"`
	Title          string    `gorm:"size:300;not null" json:"title"`
	Type           string    `gorm:"size:20;not null;check:type IN ('exercise','composition','exam','writing_game')" json:"type"`
	Questions      string    `gorm:"type:jsonb;not null;default:'[]'" json:"questions"`
	DifficultyLevel  string    `gorm:"size:5;default:'L2'" json:"difficulty_level"`
	KnowledgeNodeIDs string    `gorm:"type:jsonb;default:'[]'" json:"knowledge_node_ids,omitempty"`
	DueDate         *time.Time `json:"due_date,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

func (Assignment) TableName() string { return "assignments" }

type Submission struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AssignmentID uuid.UUID `gorm:"type:uuid;not null;index" json:"assignment_id"`
	StudentID    uuid.UUID `gorm:"type:uuid;not null;index" json:"student_id"`
	Answers      string    `gorm:"type:jsonb;not null;default:'[]'" json:"answers"`
	SubmittedAt  time.Time `json:"submitted_at"`
}

func (Submission) TableName() string { return "submissions" }

type GradingResult struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SubmissionID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"submission_id"`
	QuestionID       string     `gorm:"size:50;not null" json:"question_id"`
	Type             string     `gorm:"size:20;not null" json:"type"`
	AIScore          *float64   `gorm:"type:decimal(5,2)" json:"ai_score,omitempty"`
	AIConfidence     *float64   `gorm:"type:decimal(4,3)" json:"ai_confidence,omitempty"`
	TeacherScore     *float64   `gorm:"type:decimal(5,2)" json:"teacher_score,omitempty"`
	TeacherAdjusted  bool       `gorm:"default:false" json:"teacher_adjusted"`
	AIFeedback       string     `gorm:"type:text" json:"ai_feedback,omitempty"`
	TeacherComment   string     `gorm:"type:text" json:"teacher_comment,omitempty"`
	CompositionScores string    `gorm:"type:jsonb" json:"composition_scores,omitempty"`
	Status           string     `gorm:"size:20;default:'pending';check:status IN ('pending','ai_graded','teacher_confirmed','parent_signed')" json:"status"`
	CreatedAt        time.Time  `json:"created_at"`
}

func (GradingResult) TableName() string { return "grading_results" }

type ParentSignature struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ParentID       uuid.UUID  `gorm:"type:uuid;not null;index" json:"parent_id"`
	StudentID      uuid.UUID  `gorm:"type:uuid;not null" json:"student_id"`
	AssignmentID   uuid.UUID  `gorm:"type:uuid;not null;index" json:"assignment_id"`
	SignatureImgURL string    `gorm:"size:500" json:"signature_img_url,omitempty"`
	SignedAt       *time.Time `json:"signed_at,omitempty"`
	NotifiedAt     *time.Time `json:"notified_at,omitempty"`
}

func (ParentSignature) TableName() string { return "parent_signatures" }

type CurriculumStandard struct {
	ID                 string  `gorm:"size:50;primaryKey" json:"id"`
	Subject            string  `gorm:"size:20;not null;index:idx_curriculum_subject" json:"subject"`
	Stage              string  `gorm:"size:20;not null;index:idx_curriculum_subject" json:"stage"`
	Domain             string  `gorm:"size:100;not null" json:"domain"`
	Code               string  `gorm:"size:20;not null" json:"code"`
	Content            string  `gorm:"type:text;not null" json:"content"`
	CompetencyDimension string `gorm:"size:100" json:"competency_dimension,omitempty"`
	QualityStandard    string  `gorm:"type:text" json:"quality_standard,omitempty"`
	Embedding          string  `gorm:"type:vector(768)" json:"-"` // pgvector
	CreatedAt          time.Time `json:"created_at"`
}

func (CurriculumStandard) TableName() string { return "curriculum_standards" }

type AuditLog struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID     uuid.UUID `gorm:"type:uuid;not null" json:"school_id"`
	UserID       uuid.UUID `gorm:"type:uuid;not null" json:"user_id"`
	UserRole     string    `gorm:"size:20;not null" json:"user_role"`
	Action       string    `gorm:"size:50;not null" json:"action"`
	ResourceType string    `gorm:"size:50;not null" json:"resource_type"`
	ResourceID   uuid.UUID `gorm:"type:uuid;not null" json:"resource_id"`
	Detail       string    `gorm:"type:jsonb;default:'{}'" json:"detail,omitempty"`
	IPAddress    string    `gorm:"type:inet" json:"ip_address,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

func (AuditLog) TableName() string { return "audit_logs" }

type TokenUsage struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID        *uuid.UUID `gorm:"type:uuid;index" json:"school_id,omitempty"`
	UserID          uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	APIType         string     `gorm:"size:50;not null;index" json:"api_type"`
	ModelName       string     `gorm:"size:50;not null" json:"model_name"`
	PromptTokens    int        `gorm:"default:0" json:"prompt_tokens"`
	CompletionTokens int       `gorm:"default:0" json:"completion_tokens"`
	TotalTokens     int        `gorm:"default:0" json:"total_tokens"`
	CostEstimate    float64    `gorm:"type:decimal(10,6);default:0" json:"cost_estimate"`
	ResponseTimeMs  int        `json:"response_time_ms"`
	Status          string     `gorm:"size:20;default:'success'" json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
}

func (TokenUsage) TableName() string { return "token_usage" }

// ModelRate 模型费率（运营可实时调价）
type ModelRate struct {
	ModelName   string    `gorm:"size:50;primaryKey" json:"model_name"`
	InputPrice  float64   `gorm:"type:decimal(10,6);not null" json:"input_price"`
	OutputPrice float64   `gorm:"type:decimal(10,6);not null" json:"output_price"`
	Description string    `gorm:"size:200" json:"description,omitempty"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (ModelRate) TableName() string { return "model_rates" }

// DataScope 三模式数据作用域配置
type DataScope struct {
	ModeName             string `gorm:"size:20;primaryKey" json:"mode_name"`
	Description          string `gorm:"size:200" json:"description"`
	DemoSharedReadonly   bool   `gorm:"default:true" json:"demo_shared_readonly"`
	SalesPersonalPart    bool   `gorm:"default:true" json:"sales_personal_part"`
	TrialSharedReadonly  bool   `gorm:"default:true" json:"trial_shared_readonly"`
	TrialUGCPerUser      bool   `gorm:"default:true" json:"trial_ugc_per_user"`
	TenantPerTenant      bool   `gorm:"default:true" json:"tenant_per_tenant"`
	TokenQuotaEnforced   bool   `gorm:"default:false" json:"token_quota_enforced"`
	DataPersistent       bool   `gorm:"default:true" json:"data_persistent"`
	DataResetDaily       bool   `gorm:"default:false" json:"data_reset_daily"`
	AllowSelfRegister    bool   `gorm:"default:false" json:"allow_self_register"`
}

func (DataScope) TableName() string { return "data_scopes" }

// TextbookVersion 教材版本配置
type TextbookVersion struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID      uuid.UUID `gorm:"type:uuid;not null;index" json:"school_id"`
	Subject       string    `gorm:"size:20;not null" json:"subject"`
	Grade         string    `gorm:"size:20;not null" json:"grade"`
	Publisher     string    `gorm:"size:100;not null" json:"publisher"`
	Version       string    `gorm:"size:100" json:"version,omitempty"`
	CurriculumRef string    `gorm:"size:50" json:"curriculum_ref,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

func (TextbookVersion) TableName() string { return "textbook_versions" }

// CurriculumMapping 教材→课标对照
type CurriculumMapping struct {
	ID              string `gorm:"size:50;primaryKey" json:"id"`
	Subject         string `gorm:"size:20;not null" json:"subject"`
	Grade           string `gorm:"size:20;not null" json:"grade"`
	Publisher       string `gorm:"size:100" json:"publisher"`
	TextbookVersion string `gorm:"size:100" json:"textbook_version"`
	StandardCode    string `gorm:"size:50;not null" json:"standard_code"`
	StandardContent string `gorm:"type:text;not null" json:"standard_content"`
}

func (CurriculumMapping) TableName() string { return "curriculum_mapping" }

// LessonReview 互审记录
type LessonReview struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PlanID         uuid.UUID `gorm:"type:uuid;not null;index" json:"plan_id"`
	ReviewerID     uuid.UUID `gorm:"type:uuid;not null;index" json:"reviewer_id"`
	Rating         string    `gorm:"size:20;not null" json:"rating"`
	QuickFeedback  string    `gorm:"size:200" json:"quick_feedback,omitempty"`
	DetailFeedback string    `gorm:"type:text" json:"detail_feedback,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

func (LessonReview) TableName() string { return "lesson_reviews" }
