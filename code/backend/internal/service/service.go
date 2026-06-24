package service

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/zhiwei/backend/internal/config"
	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"
)

// AuthService 认证业务逻辑
type AuthService struct {
	cfg      *config.Config
	authRepo *repository.AuthRepo
}

func NewAuthService(cfg *config.Config, authRepo *repository.AuthRepo) *AuthService {
	return &AuthService{cfg: cfg, authRepo: authRepo}
}

type RegisterInput struct {
	Phone    string `json:"phone"`
	Username string `json:"username"`
	Password string `json:"password" validate:"required,min=6"`
	Name     string `json:"name" validate:"required"`
	Role     string `json:"role" validate:"required,oneof=teacher student parent admin it_admin academic_admin principal"`
}

type LoginInput struct {
	Phone    string `json:"phone"`
	Username string `json:"username"`
	Password string `json:"password" validate:"required"`
}

type TokenPair struct {
	Token        string   `json:"token"`
	RefreshToken string   `json:"refresh_token"`
	ExpiresIn    int64    `json:"expires_in"`
	User         UserInfo `json:"user"`
}

type UserInfo struct {
	ID               string       `json:"id"`
	Name             string       `json:"name"`
	Username         string       `json:"username,omitempty"`
	Role             string       `json:"role"`
	Phone            string       `json:"phone,omitempty"`
	Grade            string       `json:"grade,omitempty"`
	Subject          string       `json:"subject,omitempty"`
	School           *SchoolBrief `json:"school,omitempty"`
	SchoolConfig     *SchoolConfigBrief `json:"school_config,omitempty"`
	WorkMode         string       `json:"work_mode,omitempty"`
	AccountSource    string       `json:"account_source,omitempty"`
	TokenQuotaMonthly int64       `json:"token_quota_monthly,omitempty"`
	TokenUsedMonthly  int64       `json:"token_used_monthly,omitempty"`
	TokenQuotaCustom  bool        `json:"token_quota_custom"`
	DeployMode        string      `json:"deploy_mode,omitempty"`
}

type SchoolBrief struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type SchoolConfigBrief struct {
	EnableKnowledgeGraph bool  `json:"enable_knowledge_graph"`
	DefaultTokenQuota    int64 `json:"default_token_quota"`
	AllowModelSwitch     bool  `json:"allow_model_switch"`
	ShowModelUI          bool  `json:"show_model_ui"`
	AIModelTier          string `json:"ai_model_tier"`
}

func (s *AuthService) GetDeployMode() string {
	return s.cfg.DeployMode
}

func (s *AuthService) GetUserByID(userID string) (*model.User, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}
	return s.authRepo.FindByID(id)
}

func (s *AuthService) Register(ctx context.Context, input *RegisterInput) (*model.User, error) {
	isPrivate := s.cfg.DeployMode == "private"

	if isPrivate {
		// 私有部署：用户名必填
		if input.Username == "" {
			return nil, fmt.Errorf("用户名不能为空")
		}
		existing, _ := s.authRepo.FindByUsername(input.Username)
		if existing != nil && existing.ID != uuid.Nil {
			return nil, fmt.Errorf("该用户名已存在")
		}
	} else {
		// SaaS：手机号必填
		if input.Phone == "" || len(input.Phone) != 11 {
			return nil, fmt.Errorf("手机号格式错误")
		}
		existing, _ := s.authRepo.FindByPhone(input.Phone)
		if existing != nil && existing.ID != uuid.Nil {
			return nil, fmt.Errorf("该手机号已注册")
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), 12)
	if err != nil {
		return nil, fmt.Errorf("密码加密失败")
	}

	user := &model.User{
		Phone:        input.Phone,
		Username:     input.Username,
		PasswordHash: string(hash),
		Name:         input.Name,
		Role:         input.Role,
	}
	if err := s.authRepo.CreateUser(user); err != nil {
		return nil, fmt.Errorf("创建用户失败")
	}
	return user, nil
}

func (s *AuthService) Login(ctx context.Context, input *LoginInput) (*TokenPair, error) {
	var user *model.User
	var err error

	isPrivate := s.cfg.DeployMode == "private"

	if isPrivate {
		// 私有部署：用户名登录
		if input.Username == "" {
			return nil, fmt.Errorf("请输入用户名")
		}
		user, err = s.authRepo.FindByUsername(input.Username)
	} else {
		// SaaS：手机号登录
		if input.Phone == "" {
			return nil, fmt.Errorf("请输入手机号")
		}
		user, err = s.authRepo.FindByPhone(input.Phone)
	}

	if err != nil {
		return nil, fmt.Errorf("账号或密码错误")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, fmt.Errorf("账号或密码错误")
	}

	// 加载 School 关联获取 work_mode
	user, _ = s.authRepo.FindByID(user.ID)
	return s.generateTokenPair(user)
}

func (s *AuthService) VerifyCodeLogin(ctx context.Context, phone, code string) (*TokenPair, error) {
	if !s.authRepo.VerifyCode(ctx, phone, code) {
		return nil, fmt.Errorf("验证码错误或已过期")
	}
	s.authRepo.DeleteCode(ctx, phone)

	// 如果用户不存在（首次登录），自动注册为体验模式
	user, err := s.authRepo.FindByPhone(phone)
	if err != nil {
		user = &model.User{
			Phone:         phone,
			Name:          "用户" + phone[7:],
			Role:          "teacher",
			AccountSource: "self_registered",
		}
		if err := s.authRepo.CreateUser(user); err != nil {
			return nil, fmt.Errorf("创建用户失败")
		}
	}
	// 加载 School 关联获取 work_mode
	user, _ = s.authRepo.FindByID(user.ID)
	return s.generateTokenPair(user)
}

func (s *AuthService) SendVerificationCode(ctx context.Context, phone string) error {
	code := generateCode(6)
	// 开发阶段打印到日志（实际项目调用短信服务）
	fmt.Printf("[DEV] 验证码: %s -> %s\n", phone, code)
	return s.authRepo.SaveVerificationCode(ctx, phone, code)
}

func (s *AuthService) generateTokenPair(user *model.User) (*TokenPair, error) {
	now := time.Now()
	schoolID := ""
	workMode := "trial" // 默认体验模式
	if user.SchoolID != nil {
		schoolID = user.SchoolID.String()
	}
	if user.School != nil {
		workMode = user.School.WorkMode
	}

	claims := jwt.MapClaims{
		"user_id":   user.ID.String(),
		"name":      user.Name,
		"role":      user.Role,
		"school_id": schoolID,
		"work_mode": workMode,
		"exp":       now.Add(s.cfg.TokenExpiry).Unix(),
		"iat":       now.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(s.cfg.JWTPrivateKey))
	if err != nil {
		return nil, fmt.Errorf("生成令牌失败")
	}

	// Refresh token (简化版)
	refreshClaims := jwt.MapClaims{
		"user_id": user.ID.String(),
		"exp":     now.Add(s.cfg.RefreshExpiry).Unix(),
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshStr, _ := refreshToken.SignedString([]byte(s.cfg.JWTPrivateKey))

	info := UserInfo{
		ID:                user.ID.String(),
		Name:              user.Name,
		Username:          user.Username,
		Role:              user.Role,
		Phone:             user.Phone,
		Grade:             user.Grade,
		Subject:           user.Subject,
		WorkMode:          workMode,
		AccountSource:     user.AccountSource,
		TokenQuotaMonthly: user.TokenQuotaMonthly,
		TokenUsedMonthly:  user.TokenUsedMonthly,
		TokenQuotaCustom:  user.TokenQuotaCustom,
		DeployMode:        s.cfg.DeployMode,
	}
	if user.School != nil {
		info.School = &SchoolBrief{ID: user.School.ID.String(), Name: user.School.Name}
		info.SchoolConfig = &SchoolConfigBrief{
			EnableKnowledgeGraph: user.School.EnableKnowledgeGraph,
			DefaultTokenQuota:    user.School.DefaultTokenQuota,
			AllowModelSwitch:     user.School.AllowModelSwitch,
			ShowModelUI:          user.School.ShowModelUI,
			AIModelTier:          user.School.AIModelTier,
		}
	}

	return &TokenPair{
		Token:        tokenStr,
		RefreshToken: refreshStr,
		ExpiresIn:    int64(s.cfg.TokenExpiry.Seconds()),
		User:         info,
	}, nil
}

func generateCode(length int) string {
	code := ""
	for i := 0; i < length; i++ {
		n, _ := rand.Int(rand.Reader, big.NewInt(10))
		code += fmt.Sprintf("%d", n)
	}
	return code
}

// SchoolService 学校管理
type SchoolService struct {
	schoolRepo *repository.SchoolRepo
}

func NewSchoolService(schoolRepo *repository.SchoolRepo) *SchoolService {
	return &SchoolService{schoolRepo: schoolRepo}
}

func (s *SchoolService) List(schoolID string) ([]model.School, int64, error) {
	return s.schoolRepo.List(schoolID)
}

func (s *SchoolService) Get(id string) (*model.School, error) {
	return s.schoolRepo.FindByID(id)
}

func (s *SchoolService) Create(name, region, contact, phone string) (*model.School, error) {
	school := &model.School{
		Name:    name,
		Region:  region,
	}
	if err := s.schoolRepo.Create(school); err != nil {
		return nil, err
	}
	return school, nil
}

// GetSettings 获取学校AI模型设置（运营+租户可见）
func (s *SchoolService) GetSettings(schoolID string) (map[string]interface{}, error) {
	school, err := s.schoolRepo.FindByID(schoolID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"ai_model_tier":           school.AIModelTier,
		"allow_model_switch":      school.AllowModelSwitch,
		"show_model_ui":           school.ShowModelUI,
		"enable_knowledge_graph":  school.EnableKnowledgeGraph,
		"default_token_quota":     school.DefaultTokenQuota,
		"work_mode":               school.WorkMode,
	}, nil
}

// UpdateSettings 运营端更新学校模型策略
func (s *SchoolService) UpdateSettings(schoolID string, aiModelTier string, allowSwitch, showUI bool) error {
	updates := map[string]interface{}{}
	if aiModelTier != "" {
		updates["ai_model_tier"] = aiModelTier
	}
	updates["allow_model_switch"] = allowSwitch
	updates["show_model_ui"] = showUI
	return s.schoolRepo.UpdateSettings(schoolID, updates)
}

// FeatureRequest 教师申请开启学校功能
func (s *SchoolService) FeatureRequest(schoolID, teacherID, teacherName, feature string) error {
	// 记录到 audit_log（供管理员审核）
	return s.schoolRepo.CreateFeatureRequest(schoolID, teacherID, teacherName, feature)
}

// UpdateKnowledgeGraph 更新学校知识图谱开关
func (s *SchoolService) UpdateKnowledgeGraph(schoolID string, enabled bool) error {
	return s.schoolRepo.UpdateSettings(schoolID, map[string]interface{}{
		"enable_knowledge_graph": enabled,
	})
}

// ListTeachers 获取学校教师列表（含配额信息）
func (s *SchoolService) ListTeachers(schoolID string) ([]model.User, error) {
	return s.schoolRepo.ListTeachersBySchool(schoolID)
}

// BatchUpdateQuota 批量更新教师配额
func (s *SchoolService) BatchUpdateQuota(teacherIDs []string, quota int64, custom bool) error {
	return s.schoolRepo.BatchUpdateTokenQuota(teacherIDs, quota, custom)
}

// GetTeacherQuota 获取教师配额详情（含分类消耗）
func (s *SchoolService) GetTeacherQuota(teacherID string) (map[string]interface{}, error) {
	user, err := s.schoolRepo.FindUserByID(teacherID)
	if err != nil {
		return nil, err
	}

	// 计算各类 API 消耗
	type apiBreakdown struct {
		APIType string `json:"api_type"`
		Tokens  int64  `json:"tokens"`
	}
	var breakdown []apiBreakdown
	s.schoolRepo.GetQuotaBreakdown(teacherID, &breakdown)

	// 判断等级
	quota := user.TokenQuotaMonthly
	// 如果教师没有自定义配额，使用学校默认
	if !user.TokenQuotaCustom && user.School != nil {
		quota = user.School.DefaultTokenQuota
	}
	used := user.TokenUsedMonthly
	usagePct := 0.0
	if quota > 0 {
		usagePct = float64(used) / float64(quota) * 100
	}

	level := "normal"
	if quota > 0 {
		if used >= quota {
			level = "blocked"
		} else if usagePct >= 90 {
			level = "danger"
		} else if usagePct >= 80 {
			level = "warning"
		}
	}

	return map[string]interface{}{
		"quota_monthly": quota,
		"used_monthly":  used,
		"remaining":     quota - used,
		"usage_pct":     usagePct,
		"level":         level,
		"breakdown":     breakdown,
	}, nil
}

// ClassService 班级管理
type ClassService struct {
	classRepo *repository.ClassRepo
}

func NewClassService(classRepo *repository.ClassRepo) *ClassService {
	return &ClassService{classRepo: classRepo}
}

func (s *ClassService) ListBySchool(schoolID string) ([]model.Class, int64, error) {
	return s.classRepo.ListBySchool(schoolID)
}

func (s *ClassService) Create(name, grade, schoolID string) (*model.Class, error) {
	sid, err := uuid.Parse(schoolID)
	if err != nil {
		return nil, fmt.Errorf("无效的学校ID")
	}
	class := &model.Class{
		Name:     name,
		Grade:    grade,
		SchoolID: sid,
	}
	if err := s.classRepo.Create(class); err != nil {
		return nil, err
	}
	return class, nil
}

// DashboardService 工作台业务逻辑
type DashboardService struct {
	statsRepo     *repository.StatsRepo
	lessonPlanRepo *repository.LessonPlanRepo
}

func NewDashboardService(statsRepo *repository.StatsRepo, planRepo *repository.LessonPlanRepo) *DashboardService {
	return &DashboardService{statsRepo: statsRepo, lessonPlanRepo: planRepo}
}

type RecentPlan struct {
	ID          string    `json:"id"`
	LessonTitle string    `json:"lesson_title"`
	Subject     string    `json:"subject"`
	Grade       string    `json:"grade"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

func (s *DashboardService) GetHomeData(teacherID, schoolID string) (map[string]interface{}, error) {
	stats, err := s.statsRepo.GetDashboardStats(teacherID, schoolID)
	if err != nil {
		return nil, err
	}

	plans, _, err := s.lessonPlanRepo.ListByTeacher(teacherID, schoolID, 5, 0)
	if err != nil {
		return nil, err
	}

	var recentPlans []RecentPlan
	for _, p := range plans {
		recentPlans = append(recentPlans, RecentPlan{
			ID:          p.ID.String(),
			LessonTitle: p.LessonTitle,
			Subject:     p.Subject,
			Grade:       p.Grade,
			Status:      p.Status,
			CreatedAt:   p.CreatedAt,
		})
	}

	return map[string]interface{}{
		"stats":        stats,
		"recent_plans": recentPlans,
	}, nil
}
