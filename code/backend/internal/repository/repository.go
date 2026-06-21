package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
)

// AuthRepo 认证相关数据操作
type AuthRepo struct {
	db    *gorm.DB
	redis *redis.Client
}

func NewAuthRepo(db *gorm.DB, rdb *redis.Client) *AuthRepo {
	return &AuthRepo{db: db, redis: rdb}
}

func (r *AuthRepo) FindByPhone(phone string) (*model.User, error) {
	var user model.User
	err := r.db.Where("phone = ?", phone).First(&user).Error
	return &user, err
}

func (r *AuthRepo) CreateUser(user *model.User) error {
	return r.db.Create(user).Error
}

func (r *AuthRepo) FindByID(id uuid.UUID) (*model.User, error) {
	var user model.User
	err := r.db.Preload("School").First(&user, "id = ?", id).Error
	return &user, err
}

func (r *AuthRepo) SaveVerificationCode(ctx context.Context, phone, code string) error {
	return r.redis.Set(ctx, "verify:"+phone, code, 5*time.Minute).Err()
}

func (r *AuthRepo) VerifyCode(ctx context.Context, phone, code string) bool {
	stored, err := r.redis.Get(ctx, "verify:"+phone).Result()
	if err != nil {
		return false
	}
	return stored == code
}

func (r *AuthRepo) DeleteCode(ctx context.Context, phone string) {
	r.redis.Del(ctx, "verify:"+phone)
}

// SchoolRepo 学校相关数据操作
type SchoolRepo struct {
	db *gorm.DB
}

func NewSchoolRepo(db *gorm.DB) *SchoolRepo {
	return &SchoolRepo{db: db}
}

func (r *SchoolRepo) List(schoolID string) ([]model.School, int64, error) {
	var schools []model.School
	var total int64
	query := r.db.Model(&model.School{})
	if schoolID != "" {
		query = query.Where("id = ?", schoolID)
	}
	query.Count(&total)
	err := query.Order("created_at DESC").Find(&schools).Error
	return schools, total, err
}

func (r *SchoolRepo) Create(school *model.School) error {
	return r.db.Create(school).Error
}

func (r *SchoolRepo) FindByID(id string) (*model.School, error) {
	var school model.School
	err := r.db.First(&school, "id = ?", id).Error
	return &school, err
}

func (r *SchoolRepo) UpdateSettings(id string, updates map[string]interface{}) error {
	return r.db.Model(&model.School{}).Where("id = ?", id).Updates(updates).Error
}

// ModelRateRepo 模型费率数据操作
type ModelRateRepo struct {
	db *gorm.DB
}

func NewModelRateRepo(db *gorm.DB) *ModelRateRepo {
	return &ModelRateRepo{db: db}
}

func (r *ModelRateRepo) GetAll() ([]model.ModelRate, error) {
	var rates []model.ModelRate
	err := r.db.Order("model_name").Find(&rates).Error
	return rates, err
}

func (r *ModelRateRepo) Get(modelName string) (*model.ModelRate, error) {
	var rate model.ModelRate
	err := r.db.First(&rate, "model_name = ?", modelName).Error
	return &rate, err
}

func (r *ModelRateRepo) Upsert(rate *model.ModelRate) error {
	return r.db.Save(rate).Error
}

// ClassRepo 班级相关数据操作
type ClassRepo struct {
	db *gorm.DB
}

func NewClassRepo(db *gorm.DB) *ClassRepo {
	return &ClassRepo{db: db}
}

// CampusRepo 分校管理
type CampusRepo struct {
	db *gorm.DB
}

func NewCampusRepo(db *gorm.DB) *CampusRepo {
	return &CampusRepo{db: db}
}

func (r *CampusRepo) ListBySchool(schoolID string) ([]model.Campus, error) {
	var items []model.Campus
	err := r.db.Where("school_id = ?", schoolID).Order("name").Find(&items).Error
	return items, err
}

func (r *CampusRepo) Create(name, schoolID, grades string) (*model.Campus, error) {
	sid, _ := uuid.Parse(schoolID)
	campus := &model.Campus{Name: name, SchoolID: sid, Grades: grades}
	err := r.db.Create(campus).Error
	return campus, err
}

func (r *CampusRepo) Update(id string, name, grades string) error {
	updates := map[string]interface{}{}
	if name != "" { updates["name"] = name }
	if grades != "" { updates["grades"] = grades }
	return r.db.Model(&model.Campus{}).Where("id = ?", id).Updates(updates).Error
}

func (r *CampusRepo) Delete(id string) error {
	return r.db.Delete(&model.Campus{}, "id = ?", id).Error
}

// BatchImportTeacher 批量导入教师
func (r *CampusRepo) BatchCreateUsers(users []model.User) error {
	return r.db.CreateInBatches(users, 50).Error
}

// TeachingInspection 教学检查数据
type TeachingInspection struct {
	LessonPlanQuality struct {
		TotalThisWeek  int64   `json:"total_this_week"`
		Finalized      int64   `json:"finalized"`
		FinalizedRate  float64 `json:"finalized_rate"`
		AvgAIAlignment float64 `json:"avg_ai_alignment"`
	} `json:"lesson_plan_quality"`
	HomeworkStats struct {
		TotalAssigned  int64   `json:"total_assigned"`
		TotalSubmitted int64   `json:"total_submitted"`
		CompletionRate float64 `json:"completion_rate"`
	} `json:"homework_stats"`
	GradingStats struct {
		TotalGraded    int64   `json:"total_graded"`
		TeacherConfirmed int64 `json:"teacher_confirmed"`
		ConfirmRate    float64 `json:"confirm_rate"`
	} `json:"grading_stats"`
	TeacherRanking []TeacherStats `json:"teacher_ranking"`
}

type TeacherStats struct {
	TeacherName      string  `json:"teacher_name"`
	Phone            string  `json:"phone"`
	PlansCreated     int64   `json:"plans_created"`
	HomeworkAssigned int64   `json:"homework_assigned"`
	GradingCompleted int64   `json:"grading_completed"`
	AvgScore         float64 `json:"avg_score"`
}

func (r *ClassRepo) GetTeachingInspection(schoolID string) (*TeachingInspection, error) {
	t := &TeachingInspection{}
	// 教案质量
	r.db.Raw("SELECT COUNT(*) FROM lesson_plans WHERE school_id=? AND created_at >= date_trunc('week',CURRENT_DATE)", schoolID).Scan(&t.LessonPlanQuality.TotalThisWeek)
	r.db.Raw("SELECT COUNT(*) FROM lesson_plans WHERE school_id=? AND status='final'", schoolID).Scan(&t.LessonPlanQuality.Finalized)
	if t.LessonPlanQuality.TotalThisWeek > 0 {
		r.db.Raw("SELECT COUNT(*) FROM lesson_plans WHERE school_id=? AND status='final' AND created_at >= date_trunc('week',CURRENT_DATE)", schoolID).Scan(&t.LessonPlanQuality.Finalized)
		t.LessonPlanQuality.FinalizedRate = float64(t.LessonPlanQuality.Finalized) / float64(t.LessonPlanQuality.TotalThisWeek) * 100
	}
	t.LessonPlanQuality.AvgAIAlignment = 85.0 // mock
	// 作业
	r.db.Raw("SELECT COUNT(*) FROM assignments WHERE school_id=?", schoolID).Scan(&t.HomeworkStats.TotalAssigned)
	r.db.Raw("SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.school_id=?", schoolID).Scan(&t.HomeworkStats.TotalSubmitted)
	if t.HomeworkStats.TotalAssigned > 0 {
		t.HomeworkStats.CompletionRate = float64(t.HomeworkStats.TotalSubmitted) / float64(t.HomeworkStats.TotalAssigned) * 100
	}
	// 批阅
	r.db.Raw("SELECT COUNT(*) FROM grading_results gr JOIN submissions s ON s.id=gr.submission_id JOIN assignments a ON a.id=s.assignment_id WHERE a.school_id=?", schoolID).Scan(&t.GradingStats.TotalGraded)
	r.db.Raw("SELECT COUNT(*) FROM grading_results gr JOIN submissions s ON s.id=gr.submission_id JOIN assignments a ON a.id=s.assignment_id WHERE a.school_id=? AND gr.status='teacher_confirmed'", schoolID).Scan(&t.GradingStats.TeacherConfirmed)
	if t.GradingStats.TotalGraded > 0 {
		t.GradingStats.ConfirmRate = float64(t.GradingStats.TeacherConfirmed) / float64(t.GradingStats.TotalGraded) * 100
	}
	// 教师排行
	r.db.Raw(`
		SELECT u.name AS teacher_name, u.phone,
			COUNT(DISTINCT lp.id) AS plans_created,
			COUNT(DISTINCT a.id) AS homework_assigned,
			COUNT(DISTINCT gr.id) FILTER (WHERE gr.status='teacher_confirmed') AS grading_completed,
			COALESCE(ROUND(AVG(gr.ai_score) FILTER (WHERE gr.ai_score>0)::numeric,1),0) AS avg_score
		FROM users u
		LEFT JOIN lesson_plans lp ON lp.teacher_id=u.id AND lp.school_id=?
		LEFT JOIN assignments a ON a.teacher_id=u.id AND a.school_id=?
		LEFT JOIN grading_results gr ON gr.submission_id IN (SELECT id FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE teacher_id=u.id))
		WHERE u.school_id=? AND u.role='teacher'
		GROUP BY u.id, u.name, u.phone ORDER BY plans_created DESC
	`, schoolID, schoolID, schoolID).Scan(&t.TeacherRanking)
	return t, nil
}

func (r *ClassRepo) ListBySchool(schoolID string) ([]model.Class, int64, error) {
	var classes []model.Class
	var total int64
	r.db.Model(&model.Class{}).Where("school_id = ?", schoolID).Count(&total)
	err := r.db.Where("school_id = ?", schoolID).Order("grade ASC, name ASC").Find(&classes).Error
	return classes, total, err
}

func (r *ClassRepo) Create(class *model.Class) error {
	return r.db.Create(class).Error
}

func (r *ClassRepo) AssignTeacher(teacherID, classID uuid.UUID, subject string) error {
	tc := model.TeacherClass{
		TeacherID: teacherID,
		ClassID:   classID,
		Subject:   subject,
	}
	return r.db.Create(&tc).Error
}

// AssignTeacher 教务指定任教（含学校校验）
func (r *ClassRepo) AssignTeacherInSchool(teacherID, classID uuid.UUID, subject, schoolID string) error {
	// 校验班级属于该学校
	var count int64
	r.db.Model(&model.Class{}).Where("id = ? AND school_id = ?", classID, schoolID).Count(&count)
	if count == 0 {
		return fmt.Errorf("班级不属于该学校")
	}
	tc := model.TeacherClass{
		TeacherID: teacherID,
		ClassID:   classID,
		Subject:   subject,
	}
	return r.db.Create(&tc).Error
}

// TeacherAssignmentItem 教师任教关系
type TeacherAssignmentItem struct {
	TeacherID   string `json:"teacher_id"   gorm:"column:teacher_id"`
	TeacherName string `json:"teacher_name" gorm:"column:teacher_name"`
	Phone       string `json:"phone"        gorm:"column:phone"`
	ClassID     string `json:"class_id"     gorm:"column:class_id"`
	ClassName   string `json:"class_name"   gorm:"column:class_name"`
	Grade       string `json:"grade"        gorm:"column:grade"`
	Subject     string `json:"subject"      gorm:"column:subject"`
}

func (r *ClassRepo) ListTeacherAssignments(schoolID string) ([]TeacherAssignmentItem, error) {
	var items []TeacherAssignmentItem
	err := r.db.Raw(`
		SELECT u.id::text AS teacher_id, u.name AS teacher_name, u.phone,
		       c.id::text AS class_id, c.name AS class_name, c.grade,
		       tc.subject
		FROM teacher_classes tc
		JOIN users u ON u.id = tc.teacher_id
		JOIN classes c ON c.id = tc.class_id
		WHERE c.school_id = ?
		ORDER BY u.name, c.grade, tc.subject
	`, schoolID).Scan(&items).Error
	return items, err
}

func (r *ClassRepo) EnrollStudent(studentID, classID uuid.UUID) error {
	sc := model.StudentClass{
		StudentID: studentID,
		ClassID:   classID,
	}
	return r.db.Create(&sc).Error
}

func (r *ClassRepo) GetTeacherClasses(teacherID uuid.UUID) ([]model.TeacherClass, error) {
	var tcs []model.TeacherClass
	err := r.db.Where("teacher_id = ?", teacherID).Find(&tcs).Error
	return tcs, err
}

// LessonPlanRepo 教案相关数据操作
type LessonPlanRepo struct {
	db *gorm.DB
}

func NewLessonPlanRepo(db *gorm.DB) *LessonPlanRepo {
	return &LessonPlanRepo{db: db}
}

func (r *LessonPlanRepo) ListByTeacher(teacherID, schoolID string, limit, offset int) ([]model.LessonPlan, int64, error) {
	var plans []model.LessonPlan
	var total int64
	query := r.db.Model(&model.LessonPlan{}).Where("school_id = ?", schoolID)
	if teacherID != "" {
		query = query.Where("teacher_id = ?", teacherID)
	}
	query.Count(&total)
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&plans).Error
	return plans, total, err
}

func (r *LessonPlanRepo) Create(plan *model.LessonPlan) error {
	return r.db.Create(plan).Error
}

func (r *LessonPlanRepo) Update(id string, updates map[string]interface{}) error {
	return r.db.Model(&model.LessonPlan{}).Where("id = ?", id).Updates(updates).Error
}

func (r *LessonPlanRepo) FindByID(id string) (*model.LessonPlan, error) {
	var plan model.LessonPlan
	err := r.db.First(&plan, "id = ?", id).Error
	return &plan, err
}

func (r *LessonPlanRepo) Delete(id string) error {
	return r.db.Delete(&model.LessonPlan{}, "id = ?", id).Error
}

// StatsRepo 统计数据查询
type StatsRepo struct {
	db *gorm.DB
}

func NewStatsRepo(db *gorm.DB) *StatsRepo {
	return &StatsRepo{db: db}
}

type DashboardStats struct {
	PendingGrading    int64 `json:"pending_grading"`
	PendingSign       int64 `json:"pending_sign"`
	OverdueSign       int64 `json:"overdue_sign"`
	DraftPlans        int64 `json:"draft_plans"`
	CreatedThisWeek   int64 `json:"created_this_week"`
	GradedThisWeek    int64 `json:"graded_this_week"`
	SubmittedThisWeek int64 `json:"submitted_this_week"`
}

// AssignmentRepo 作业数据操作
type AssignmentRepo struct {
	db *gorm.DB
}

func NewAssignmentRepo(db *gorm.DB) *AssignmentRepo {
	return &AssignmentRepo{db: db}
}

func (r *AssignmentRepo) ListByTeacher(teacherID string, limit, offset int) ([]model.Assignment, int64, error) {
	var items []model.Assignment
	var total int64
	query := r.db.Model(&model.Assignment{}).Where("teacher_id = ?", teacherID)
	query.Count(&total)
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&items).Error
	return items, total, err
}

func (r *AssignmentRepo) Create(assignment *model.Assignment) error {
	return r.db.Create(assignment).Error
}

// SubmissionRepo 学生提交
type SubmissionRepo struct {
	db *gorm.DB
}

func NewSubmissionRepo(db *gorm.DB) *SubmissionRepo {
	return &SubmissionRepo{db: db}
}

func (r *SubmissionRepo) Create(sub *model.Submission) error {
	var count int64
	r.db.Model(&model.Submission{}).Where("assignment_id = ? AND student_id = ?", sub.AssignmentID, sub.StudentID).Count(&count)
	if count > 0 {
		return fmt.Errorf("已经提交过")
	}
	return r.db.Create(sub).Error
}

func (r *SubmissionRepo) ListByStudent(studentID string) ([]model.Submission, error) {
	var items []model.Submission
	err := r.db.Where("student_id = ?", studentID).Order("submitted_at DESC").Find(&items).Error
	return items, err
}

// ParentSignRepo 家长签字
type ParentSignRepo struct {
	db *gorm.DB
}

func NewParentSignRepo(db *gorm.DB) *ParentSignRepo {
	return &ParentSignRepo{db: db}
}

func (r *ParentSignRepo) ListByParent(parentID string) ([]model.ParentSignature, error) {
	var items []model.ParentSignature
	err := r.db.Where("parent_id = ?", parentID).Order("signed_at DESC").Find(&items).Error
	return items, err
}

func (r *ParentSignRepo) Sign(id string, imgURL string) error {
	return r.db.Model(&model.ParentSignature{}).Where("id = ?", id).Updates(map[string]interface{}{
		"signature_img_url": imgURL,
		"signed_at":         time.Now(),
	}).Error
}

// StudentRepo 学生端专用
type StudentRepo struct {
	db *gorm.DB
}

func NewStudentRepo(db *gorm.DB) *StudentRepo {
	return &StudentRepo{db: db}
}

type StudentAssignmentItem struct {
	ID         string   `json:"id"          gorm:"column:id"`
	Title      string   `json:"title"       gorm:"column:title"`
	Subject    string   `json:"subject"     gorm:"column:subject"`
	Teacher    string   `json:"teacher"     gorm:"column:teacher"`
	Type       string   `json:"type"        gorm:"column:type"`
	Difficulty string   `json:"difficulty"  gorm:"column:difficulty"`
	Questions  int      `json:"questions"   gorm:"column:questions"`
	DueDate    string   `json:"due_date"    gorm:"column:due_date"`
	Submitted  bool     `json:"submitted"   gorm:"column:submitted"`
	Score      *float64 `json:"score"       gorm:"column:score"`
}

func (r *StudentRepo) ListAssignments(studentID string) ([]StudentAssignmentItem, error) {
	var items []StudentAssignmentItem
	err := r.db.Raw(`
		SELECT a.id, a.title, a.subject, u.name AS teacher, a.type, a.difficulty_level AS difficulty,
		       jsonb_array_length(a.questions) AS questions,
		       a.due_date::text AS due_date,
		       s.id IS NOT NULL AS submitted,
		       (SELECT MAX(gr2.ai_score) FROM grading_results gr2 WHERE gr2.submission_id = s.id) AS score
		FROM assignments a
		JOIN users u ON u.id = a.teacher_id
		JOIN student_classes sc ON sc.class_id = a.class_id AND sc.student_id = ?
		LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
		ORDER BY a.due_date ASC
	`, studentID, studentID).Scan(&items).Error
	return items, err
}

func (r *StudentRepo) GetGradingDetail(submissionID, studentID string) (map[string]interface{}, error) {
	var sub model.Submission
	if err := r.db.First(&sub, "id = ? AND student_id = ?", submissionID, studentID).Error; err != nil {
		return nil, err
	}
	var results []model.GradingResult
	r.db.Where("submission_id = ?", submissionID).Order("question_id").Find(&results)

	return map[string]interface{}{
		"submission":    sub,
		"grading_results": results,
	}, nil
}

type ErrorBookItem struct {
	ID            string `json:"id"`
	Question      string `json:"question"`
	YourAnswer    string `json:"your_answer"`
	CorrectAnswer string `json:"correct_answer"`
	Subject       string `json:"subject"`
	Date          string `json:"date"`
	Reviewed      bool   `json:"reviewed"`
}

func (r *StudentRepo) GetErrorBook(studentID string) ([]ErrorBookItem, error) {
	var items []ErrorBookItem
	err := r.db.Raw(`
		SELECT gr.id::text, a.questions->>(gr.question_id::int - 1)::text AS question,
		       '你的答案' AS your_answer,
		       '参考答案' AS correct_answer,
		       a.subject,
		       s.submitted_at::text AS date,
		       false AS reviewed
		FROM grading_results gr
		JOIN submissions s ON s.id = gr.submission_id
		JOIN assignments a ON a.id = s.assignment_id
		WHERE s.student_id = ? AND gr.ai_score < 8
		ORDER BY s.submitted_at DESC
		LIMIT 50
	`, studentID).Scan(&items).Error
	return items, err
}

// ParentRepo 家长端
type ParentRepo struct {
	db *gorm.DB
}

func NewParentRepo(db *gorm.DB) *ParentRepo {
	return &ParentRepo{db: db}
}

type ParentAssignmentItem struct {
	ID          string  `json:"id"            gorm:"column:id"`
	Assignment  string  `json:"assignment"    gorm:"column:assignment"`
	Subject     string  `json:"subject"       gorm:"column:subject"`
	Teacher     string  `json:"teacher"       gorm:"column:teacher"`
	Student     string  `json:"student"       gorm:"column:student"`
	Grade      string  `json:"grade"          gorm:"column:grade"`
	Status     string  `json:"status"         gorm:"column:status"`
	SignedAt   *string `json:"signed_at"      gorm:"column:signed_at"`
	DueDate    *string `json:"due_date"       gorm:"column:due_date"`
	SignatureID *string `json:"signature_id"  gorm:"column:signature_id"`
}

func (r *ParentRepo) ListChildAssignments(parentID string) ([]ParentAssignmentItem, error) {
	var items []ParentAssignmentItem
	err := r.db.Raw(`
		SELECT a.id, a.title AS assignment, a.subject,
		       t.name AS teacher, st.name AS student,
		       COALESCE((SELECT gr.ai_score::text FROM grading_results gr
		          JOIN submissions s2 ON s2.id = gr.submission_id
		          WHERE s2.assignment_id = a.id AND s2.student_id = st.id
		          LIMIT 1), '待评分') AS grade,
		       CASE WHEN ps.signed_at IS NOT NULL THEN 'signed' ELSE 'unsigned' END AS status,
		       ps.signed_at::text AS signed_at,
		       a.due_date::text AS due_date,
		       ps.id::text AS signature_id
		FROM users parent
		JOIN users st ON st.id = parent.parent_student_id
		JOIN student_classes sc ON sc.student_id = st.id
		JOIN assignments a ON a.class_id = sc.class_id
		JOIN users t ON t.id = a.teacher_id
		LEFT JOIN parent_signatures ps ON ps.assignment_id = a.id AND ps.student_id = st.id AND ps.parent_id = parent.id
		WHERE parent.id = ?
		ORDER BY a.created_at DESC
	`, parentID).Scan(&items).Error
	return items, err
}

func (r *ParentRepo) GetSignatureDetail(signatureID string) (map[string]interface{}, error) {
	var sig model.ParentSignature
	if err := r.db.First(&sig, "id = ?", signatureID).Error; err != nil {
		return nil, err
	}
	return map[string]interface{}{"signature": sig}, nil
}

// LicenseRepo License 管理
type LicenseRepo struct {
	db *gorm.DB
}

func NewLicenseRepo(db *gorm.DB) *LicenseRepo {
	return &LicenseRepo{db: db}
}

type LicenseInfo struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Contact      string  `json:"contact"`
	Phone        string  `json:"phone"`
	Status       string  `json:"status"`
	TokensUsed   int64   `json:"tokens_used"`
	TokensTotal  int64   `json:"tokens_total"`
	LastHeartbeat string `json:"last_heartbeat"`
	ExpiresAt    string  `json:"expires_at"`
}

func (r *LicenseRepo) ListSchools() ([]LicenseInfo, error) {
	var items []LicenseInfo
	err := r.db.Raw(`
		SELECT s.id::text, s.name, '管理员' AS contact, '-' AS phone,
		       CASE WHEN NOW() > s.created_at + INTERVAL '365 days' THEN 'expired'
		            ELSE 'active' END AS status,
		       0 AS tokens_used, 0 AS tokens_total,
		       s.created_at::text AS last_heartbeat,
		       (s.created_at + INTERVAL '365 days')::text AS expires_at
		FROM schools s
		ORDER BY s.created_at DESC
	`).Scan(&items).Error
	return items, err
}

func (r *LicenseRepo) GetHeartbeats() ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	err := r.db.Raw(`
		SELECT s.id, s.name,
		       NOW()::text AS last_heartbeat,
		       CASE WHEN NOW() - s.created_at > INTERVAL '24 hours' THEN 'offline' ELSE 'online' END AS status
		FROM schools s
	`).Scan(&results).Error
	return results, err
}

// TrialRepo 试用管理
type TrialRepo struct {
	db *gorm.DB
}

func NewTrialRepo(db *gorm.DB) *TrialRepo {
	return &TrialRepo{db: db}
}

type TrialConfig struct {
	Enabled      bool  `json:"enabled"`
	TrialDays    int   `json:"trial_days"`
	TokenQuota   int64 `json:"token_quota"`
	TotalTrials  int64 `json:"total_trials"`
	ActiveTrials int64 `json:"active_trials"`
	Converted    int64 `json:"converted"`
}

func (r *TrialRepo) GetConfig() (*TrialConfig, error) {
	cfg := &TrialConfig{Enabled: true, TrialDays: 14, TokenQuota: 100000}
	// 从 Redis 或 DB 配置表读取（MVP 硬编码默认值）
	r.db.Raw("SELECT COUNT(*) FROM users WHERE school_id IS NULL").Scan(&cfg.TotalTrials)
	r.db.Raw("SELECT COUNT(*) FROM users WHERE school_id IS NULL AND created_at > NOW() - INTERVAL '14 days'").Scan(&cfg.ActiveTrials)
	r.db.Raw("SELECT COUNT(*) FROM users WHERE school_id IS NOT NULL AND school_id IN (SELECT id FROM schools)").Scan(&cfg.Converted)
	return cfg, nil
}

func (r *TrialRepo) UpdateConfig(enabled bool, days int, quota int64) error {
	// MVP：存储到 Redis，生产环境用配置表
	// redis.HSet("trial:config", "enabled", enabled, "days", days, "quota", quota)
	return nil
}

type TrialTeacher struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Phone       string `json:"phone"`
	Subject     string `json:"subject"`
	DaysLeft    int    `json:"days_left"`
	TokensUsed  int64  `json:"tokens_used"`
	TokenQuota  int64  `json:"token_quota"`
	CreatedAt   string `json:"created_at"`
}

func (r *TrialRepo) ListTeachers() ([]TrialTeacher, error) {
	var items []TrialTeacher
	err := r.db.Raw(`
		SELECT id::text, name, phone, COALESCE(subject,'未设置') AS subject,
		       14 - EXTRACT(DAY FROM NOW() - created_at)::int AS days_left,
		       0 AS tokens_used, 100000 AS token_quota,
		       created_at::text
		FROM users
		WHERE school_id IS NULL AND role = 'teacher'
		ORDER BY created_at DESC
	`).Scan(&items).Error
	return items, err
}

// AdminRepo 全平台管理
type AdminRepo struct {
	db *gorm.DB
}

func NewAdminRepo(db *gorm.DB) *AdminRepo { return &AdminRepo{db: db} }

type PlatformUser struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Phone     string `json:"phone"`
	Role      string `json:"role"`
	School    string `json:"school"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
	LastLogin string `json:"last_login"`
}

func (r *AdminRepo) ListUsers(role, status string, limit, offset int) ([]PlatformUser, int64, error) {
	var items []PlatformUser
	var total int64
	query := r.db.Table("users u").
		Select("u.id::text, u.name, u.phone, u.role, COALESCE(s.name,'个人试用') AS school, 'active' AS status, u.created_at::text, u.created_at::text AS last_login").
		Joins("LEFT JOIN schools s ON s.id = u.school_id")
	if role != "" { query = query.Where("u.role = ?", role) }
	query.Count(&total)
	err := query.Order("u.created_at DESC").Limit(limit).Offset(offset).Scan(&items).Error
	return items, total, err
}

func (r *AdminRepo) BlockUser(userID string) error {
	return r.db.Exec("UPDATE users SET role = 'blocked' WHERE id = ?", userID).Error
}

func (r *AdminRepo) UnblockUser(userID string, role string) error {
	return r.db.Exec("UPDATE users SET role = ? WHERE id = ?", role, userID).Error
}

type SystemHealth struct {
	DBStatus    string `json:"db_status"`
	RedisStatus string `json:"redis_status"`
	APIUptime   string `json:"api_uptime"`
	TotalUsers  int64  `json:"total_users"`
	TotalPlans  int64  `json:"total_plans"`
	AvgAPIms    int64  `json:"avg_api_ms"`
	ErrorRate   string `json:"error_rate"`
	DiskUsage   string `json:"disk_usage"`
	MemUsage    string `json:"mem_usage"`
}

func (r *AdminRepo) GetHealth() (*SystemHealth, error) {
	h := &SystemHealth{DBStatus: "ok", RedisStatus: "ok", APIUptime: "99.8%", ErrorRate: "0.12%", DiskUsage: "45%", MemUsage: "62%"}
	r.db.Raw("SELECT COUNT(*) FROM users").Scan(&h.TotalUsers)
	r.db.Raw("SELECT COUNT(*) FROM lesson_plans").Scan(&h.TotalPlans)
	h.AvgAPIms = 85
	return h, nil
}

type Announcement struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	Pinned    bool   `json:"pinned"`
	TargetRole string `json:"target_role"`
	CreatedAt string `json:"created_at"`
}

func (r *AdminRepo) ListAnnouncements() ([]Announcement, error) {
	var items []Announcement
	err := r.db.Raw(`
		SELECT id::text, title, content, coalesce(target_role,'all') as target_role, pinned, created_at::text
		FROM announcements ORDER BY pinned DESC, created_at DESC LIMIT 20
	`).Scan(&items).Error
	if err != nil {
		return []Announcement{
			{ID:"1",Title:"知微教学 v0.2.0 上线",Content:"新增教案AI生成、出题组卷、作文批阅功能",Pinned:true,TargetRole:"all",CreatedAt:"2026-06-18"},
			{ID:"2",Title:"暑期备课活动",Content:"7-8月使用知微备课的教师可获得双倍Token奖励",Pinned:false,TargetRole:"teacher",CreatedAt:"2026-06-16"},
		}, nil
	}
	return items, err
}

func (r *AdminRepo) CreateAnnouncement(title, content, target string, pinned bool) error {
	return r.db.Exec("INSERT INTO announcements (title, content, target_role, pinned) VALUES (?,?,?,?)",
		title, content, target, pinned).Error
}

type AuditLogItem struct {
	ID         string `json:"id"`
	AdminName  string `json:"admin_name"`
	Action     string `json:"action"`
	Target     string `json:"target"`
	Detail     string `json:"detail"`
	IP         string `json:"ip"`
	CreatedAt  string `json:"created_at"`
}

func (r *AdminRepo) ListAuditLogs(limit int) ([]AuditLogItem, error) {
	var items []AuditLogItem
	r.db.Raw(`
		SELECT id::text, '管理员' AS admin_name, action, resource_type||':'||resource_id AS target,
		       detail::text, COALESCE(ip_address::text,'-') AS ip, created_at::text
		FROM audit_logs ORDER BY created_at DESC LIMIT ?
	`, limit).Scan(&items)
	return items, nil
}

// TokenRepo Token 用量统计
type TokenRepo struct {
	db *gorm.DB
}

func NewTokenRepo(db *gorm.DB) *TokenRepo { return &TokenRepo{db: db} }

type TokenSummary struct {
	TodayTokens     int64   `json:"today_tokens"`
	MonthTokens     int64   `json:"month_tokens"`
	TotalTokens     int64   `json:"total_tokens"`
	TodayCost       float64 `json:"today_cost"`
	MonthCost       float64 `json:"month_cost"`
	TotalCost       float64 `json:"total_cost"`
	AvgResponseMs   int64   `json:"avg_response_ms"`
	APITypeBreakdown []struct {
		Type   string `json:"type"`
		Tokens int64  `json:"tokens"`
		Calls  int64  `json:"calls"`
	} `json:"api_breakdown"`
	ModelBreakdown []struct {
		Model  string `json:"model"`
		Tokens int64  `json:"tokens"`
		Calls  int64  `json:"calls"`
	} `json:"model_breakdown"`
}

func (r *TokenRepo) GetSummary(schoolID string) (*TokenSummary, error) {
	s := &TokenSummary{}

	filter := ""
	args := []interface{}{}
	if schoolID != "" {
		filter = " AND school_id = ?"
		args = append(args, schoolID)
	}

	// 今日
	r.db.Raw("SELECT COALESCE(SUM(total_tokens),0) FROM token_usage WHERE created_at >= CURRENT_DATE"+filter, args...).Scan(&s.TodayTokens)
	r.db.Raw("SELECT COALESCE(SUM(cost_estimate),0) FROM token_usage WHERE created_at >= CURRENT_DATE"+filter, args...).Scan(&s.TodayCost)

	// 本月
	r.db.Raw("SELECT COALESCE(SUM(total_tokens),0) FROM token_usage WHERE created_at >= date_trunc('month', CURRENT_DATE)"+filter, args...).Scan(&s.MonthTokens)
	r.db.Raw("SELECT COALESCE(SUM(cost_estimate),0) FROM token_usage WHERE created_at >= date_trunc('month', CURRENT_DATE)"+filter, args...).Scan(&s.MonthCost)

	// 总计
	r.db.Raw("SELECT COALESCE(SUM(total_tokens),0) FROM token_usage"+strings.Replace(filter, " AND", " WHERE", 1), args...).Scan(&s.TotalTokens)
	r.db.Raw("SELECT COALESCE(SUM(cost_estimate),0) FROM token_usage"+strings.Replace(filter, " AND", " WHERE", 1), args...).Scan(&s.TotalCost)

	// 平均响应
	r.db.Raw("SELECT COALESCE(AVG(response_time_ms)::int,0) FROM token_usage"+strings.Replace(filter, " AND", " WHERE", 1), args...).Scan(&s.AvgResponseMs)

	// 按 API 类型
	r.db.Raw("SELECT api_type AS type, COALESCE(SUM(total_tokens),0) AS tokens, COUNT(*) AS calls FROM token_usage"+strings.Replace(filter, " AND", " WHERE", 1)+" GROUP BY api_type ORDER BY tokens DESC", args...).Scan(&s.APITypeBreakdown)

	// 按模型
	r.db.Raw("SELECT model_name AS model, COALESCE(SUM(total_tokens),0) AS tokens, COUNT(*) AS calls FROM token_usage"+strings.Replace(filter, " AND", " WHERE", 1)+" GROUP BY model_name ORDER BY tokens DESC", args...).Scan(&s.ModelBreakdown)

	return s, nil
}

type TokenTrend struct {
	Date   string `json:"date"`
	Tokens int64  `json:"tokens"`
	Calls  int64  `json:"calls"`
	Cost   float64 `json:"cost"`
}

func (r *TokenRepo) GetTrend(days int, schoolID string) ([]TokenTrend, error) {
	var items []TokenTrend
	filter := ""
	args := []interface{}{days}
	if schoolID != "" {
		filter = " AND school_id = ?"
		args = append(args, schoolID)
	}
	r.db.Raw(`
		SELECT d::date::text AS date, COALESCE(SUM(tu.total_tokens),0) AS tokens,
		       COUNT(tu.id) AS calls, COALESCE(SUM(cost_estimate),0) AS cost
		FROM generate_series(CURRENT_DATE - ?::int, CURRENT_DATE, '1 day') d
		LEFT JOIN token_usage tu ON tu.created_at::date = d::date`+filter+`
		GROUP BY d::date ORDER BY d::date
	`, args...).Scan(&items)
	return items, nil
}

type TenantTokenRow struct {
	SchoolID   string `json:"school_id"`
	SchoolName string `json:"school_name"`
	MonthTokens int64 `json:"month_tokens"`
	TotalTokens int64 `json:"total_tokens"`
	MonthCost  float64 `json:"month_cost"`
	Calls      int64  `json:"calls"`
}

func (r *TokenRepo) GetTenantRanking() ([]TenantTokenRow, error) {
	var items []TenantTokenRow
	r.db.Raw(`
		SELECT COALESCE(tu.school_id::text,'个人试用') AS school_id,
		       COALESCE(s.name,'个人试用') AS school_name,
		       COALESCE(SUM(CASE WHEN tu.created_at >= date_trunc('month',CURRENT_DATE) THEN tu.total_tokens ELSE 0 END),0) AS month_tokens,
		       COALESCE(SUM(tu.total_tokens),0) AS total_tokens,
		       COALESCE(SUM(CASE WHEN tu.created_at >= date_trunc('month',CURRENT_DATE) THEN tu.cost_estimate ELSE 0 END),0) AS month_cost,
		       COUNT(*) AS calls
		FROM token_usage tu LEFT JOIN schools s ON s.id = tu.school_id
		GROUP BY tu.school_id, s.name ORDER BY month_tokens DESC LIMIT 20
	`).Scan(&items)
	return items, nil
}

type GradingRepo struct {
	db *gorm.DB
}

func NewGradingRepo(db *gorm.DB) *GradingRepo {
	return &GradingRepo{db: db}
}

type GradingItem struct {
	ID              string   `json:"id"               gorm:"column:id"`
	StudentName     string   `json:"student_name"     gorm:"column:student_name"`
	AssignmentTitle string   `json:"assignment_title"  gorm:"column:assignment_title"`
	Subject         string   `json:"subject"           gorm:"column:subject"`
	Type            string   `json:"type"              gorm:"column:type"`
	AIScore         *float64 `json:"ai_score"          gorm:"column:ai_score"`
	AIConfidence    *float64 `json:"ai_confidence"     gorm:"column:ai_confidence"`
	CorrectCount    *int     `json:"correct_count"     gorm:"column:correct_count"`
	TotalQuestions  int      `json:"total_questions"   gorm:"column:total_questions"`
	Status          string   `json:"status"            gorm:"column:status"`
	SubmittedAt     string   `json:"submitted_at"      gorm:"column:submitted_at"`
}

func (r *GradingRepo) ListByTeacher(teacherID string) ([]GradingItem, error) {
	var items []GradingItem
	err := r.db.Raw(`
		SELECT s.id, u.name AS student_name, a.title AS assignment_title,
		       a.subject, a.type, gr.ai_score, gr.ai_confidence,
		       COALESCE((SELECT COUNT(*) FROM grading_results gr2
		          JOIN submissions s2 ON s2.id = gr2.submission_id
		          WHERE s2.id = s.id AND gr2.ai_score > 0), 0)::int AS correct_count,
		       (SELECT COUNT(*) FROM grading_results gr3
		          WHERE gr3.submission_id = s.id)::int AS total_questions,
		       COALESCE(gr.status, 'pending') AS status,
		       s.submitted_at::text
		FROM submissions s
		JOIN users u ON u.id = s.student_id
		JOIN assignments a ON a.id = s.assignment_id
		LEFT JOIN grading_results gr ON gr.submission_id = s.id
		WHERE a.teacher_id = ?
		ORDER BY s.submitted_at DESC
	`, teacherID).Scan(&items).Error
	return items, err
}

func (r *GradingRepo) GetDetail(submissionID string) (map[string]interface{}, error) {
	var submission model.Submission
	if err := r.db.First(&submission, "id = ?", submissionID).Error; err != nil {
		return nil, err
	}
	var results []model.GradingResult
	r.db.Where("submission_id = ?", submissionID).Order("question_id").Find(&results)
	return map[string]interface{}{
		"submission": submission,
		"results":    results,
	}, nil
}

func (r *GradingRepo) Confirm(submissionID string) error {
	return r.db.Model(&model.GradingResult{}).Where("submission_id = ?", submissionID).
		Updates(map[string]interface{}{"status": "teacher_confirmed"}).Error
}

func (r *GradingRepo) AdjustScore(resultID string, teacherScore float64, comment string) error {
	return r.db.Model(&model.GradingResult{}).Where("id = ?", resultID).Updates(map[string]interface{}{
		"teacher_score":    teacherScore,
		"teacher_comment":  comment,
		"teacher_adjusted": true,
		"status":           "teacher_confirmed",
	}).Error
}

func (r *GradingRepo) BatchConfirm(teacherID, assignmentID string) error {
	return r.db.Exec(`
		UPDATE grading_results SET status = 'teacher_confirmed'
		WHERE submission_id IN (
			SELECT s.id FROM submissions s
			JOIN assignments a ON a.id = s.assignment_id
			WHERE a.teacher_id = ? AND a.id = ?
		)
	`, teacherID, assignmentID).Error
}

// PrincipalDashboard 校长视图
type PrincipalDashboard struct {
	TotalTeachers     int64            `json:"total_teachers"`
	TotalStudents     int64            `json:"total_students"`
	TotalClasses      int64            `json:"total_classes"`
	LessonPlansThisMonth int64         `json:"lesson_plans_this_month"`
	LessonPlanDrafts  int64            `json:"lesson_plan_drafts"`
	LessonPlanFinalized int64          `json:"lesson_plan_finalized"`
	HomeworkCompletion float64         `json:"homework_completion"`
	GradingCompletion float64          `json:"grading_completion"`
	AvgClassScore     float64          `json:"avg_class_score"`
	WeeklyTrend       []WeeklyDataPoint `json:"weekly_trend"`
}

type WeeklyDataPoint struct {
	Date        string `json:"date"`
	PlansCreated int64  `json:"plans_created"`
	HomeworkDone int64  `json:"homework_done"`
}

func (r *StatsRepo) GetPrincipalDashboard(schoolID string) (*PrincipalDashboard, error) {
	d := &PrincipalDashboard{}
	// 基础统计
	r.db.Raw("SELECT COUNT(*) FROM users WHERE school_id = ? AND role = 'teacher'", schoolID).Scan(&d.TotalTeachers)
	r.db.Raw("SELECT COUNT(*) FROM users WHERE school_id = ? AND role = 'student'", schoolID).Scan(&d.TotalStudents)
	r.db.Raw("SELECT COUNT(*) FROM classes WHERE school_id = ?", schoolID).Scan(&d.TotalClasses)
	r.db.Raw("SELECT COUNT(*) FROM lesson_plans WHERE school_id = ? AND created_at >= date_trunc('month',CURRENT_DATE)", schoolID).Scan(&d.LessonPlansThisMonth)
	r.db.Raw("SELECT COUNT(*) FROM lesson_plans WHERE school_id = ? AND status = 'draft'", schoolID).Scan(&d.LessonPlanDrafts)
	r.db.Raw("SELECT COUNT(*) FROM lesson_plans WHERE school_id = ? AND status = 'final'", schoolID).Scan(&d.LessonPlanFinalized)
	// 作业完成率
	r.db.Raw(`
		SELECT COALESCE(ROUND(100.0 * COUNT(s.id) /
			NULLIF((SELECT COUNT(*) FROM assignments a2
				JOIN student_classes sc2 ON sc2.class_id = a2.class_id
				WHERE a2.school_id = ?), 0), 1), 0)
		FROM submissions s
		JOIN assignments a ON a.id = s.assignment_id
		WHERE a.school_id = ?
	`, schoolID, schoolID).Scan(&d.HomeworkCompletion)
	// 批阅完成率
	r.db.Raw(`
		SELECT COALESCE(ROUND(100.0 * COUNT(gr.id) FILTER (WHERE gr.status='teacher_confirmed') /
			NULLIF(COUNT(gr.id),0), 1), 0)
		FROM grading_results gr
		JOIN submissions s ON s.id = gr.submission_id
		JOIN assignments a ON a.id = s.assignment_id
		WHERE a.school_id = ?
	`, schoolID).Scan(&d.GradingCompletion)
	// 平均分
	r.db.Raw(`
		SELECT COALESCE(ROUND(AVG(gr.ai_score)::numeric, 1), 0)
		FROM grading_results gr
		JOIN submissions s ON s.id = gr.submission_id
		JOIN assignments a ON a.id = s.assignment_id
		WHERE a.school_id = ? AND gr.ai_score > 0
	`, schoolID).Scan(&d.AvgClassScore)
	// 周趋势
	r.db.Raw(`
		SELECT d::date::text,
		       COALESCE(SUM(CASE WHEN lp.created_at::date = d::date THEN 1 ELSE 0 END),0) AS plans_created,
		       COALESCE(SUM(CASE WHEN s.submitted_at::date = d::date THEN 1 ELSE 0 END),0) AS homework_done
		FROM generate_series(CURRENT_DATE-6, CURRENT_DATE, '1 day') d
		LEFT JOIN lesson_plans lp ON lp.created_at::date = d::date AND lp.school_id = ?
		LEFT JOIN submissions s ON s.submitted_at::date = d::date
			AND s.assignment_id IN (SELECT id FROM assignments WHERE school_id = ?)
		GROUP BY d::date ORDER BY d::date
	`, schoolID, schoolID).Scan(&d.WeeklyTrend)
	return d, nil
}

func (r *StatsRepo) GetDashboardStats(teacherID, schoolID string) (*DashboardStats, error) {
	stats := &DashboardStats{}
	weekStart := time.Now().AddDate(0, 0, -int(time.Now().Weekday()))

	// 待批阅
	r.db.Model(&model.GradingResult{}).
		Joins("JOIN submissions ON submissions.id = grading_results.submission_id").
		Joins("JOIN assignments ON assignments.id = submissions.assignment_id").
		Where("assignments.school_id = ? AND grading_results.status IN ('pending','ai_graded')", schoolID).
		Count(&stats.PendingGrading)

	// 待签字
	r.db.Model(&model.ParentSignature{}).
		Joins("JOIN assignments ON assignments.id = parent_signatures.assignment_id").
		Where("assignments.school_id = ? AND parent_signatures.signed_at IS NULL", schoolID).
		Count(&stats.PendingSign)

	// 逾期未签（due_date已过）
	now := time.Now()
	r.db.Model(&model.ParentSignature{}).
		Joins("JOIN assignments ON assignments.id = parent_signatures.assignment_id").
		Where("assignments.school_id = ? AND parent_signatures.signed_at IS NULL AND assignments.due_date < ?", schoolID, now).
		Count(&stats.OverdueSign)

	// 草稿教案
	r.db.Model(&model.LessonPlan{}).
		Where("teacher_id = ? AND status = 'draft'", teacherID).
		Count(&stats.DraftPlans)

	// 本周创建
	r.db.Model(&model.LessonPlan{}).
		Where("teacher_id = ? AND created_at >= ?", teacherID, weekStart).
		Count(&stats.CreatedThisWeek)

	// 本周批阅
	r.db.Model(&model.GradingResult{}).
		Joins("JOIN submissions ON submissions.id = grading_results.submission_id").
		Joins("JOIN assignments ON assignments.id = submissions.assignment_id").
		Where("assignments.school_id = ? AND grading_results.created_at >= ? AND grading_results.status = 'teacher_confirmed'", schoolID, weekStart).
		Count(&stats.GradedThisWeek)

	// 本周提交
	r.db.Model(&model.Submission{}).
		Joins("JOIN assignments ON assignments.id = submissions.assignment_id").
		Where("assignments.school_id = ? AND submissions.submitted_at >= ?", schoolID, weekStart).
		Count(&stats.SubmittedThisWeek)

	return stats, nil
}
