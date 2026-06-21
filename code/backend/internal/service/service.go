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
	Phone    string `json:"phone" validate:"required,len=11"`
	Password string `json:"password" validate:"required,min=6"`
	Name     string `json:"name" validate:"required"`
	Role     string `json:"role" validate:"required,oneof=teacher student parent admin it_admin academic_admin principal"`
}

type LoginInput struct {
	Phone    string `json:"phone" validate:"required,len=11"`
	Password string `json:"password" validate:"required"`
}

type TokenPair struct {
	Token        string   `json:"token"`
	RefreshToken string   `json:"refresh_token"`
	ExpiresIn    int64    `json:"expires_in"`
	User         UserInfo `json:"user"`
}

type UserInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Role    string `json:"role"`
	Phone   string `json:"phone,omitempty"`
	Grade   string `json:"grade,omitempty"`
	Subject string `json:"subject,omitempty"`
	School  *SchoolBrief `json:"school,omitempty"`
	WorkMode string `json:"work_mode,omitempty"`
	AccountSource string `json:"account_source,omitempty"`
}

type SchoolBrief struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func (s *AuthService) Register(ctx context.Context, input *RegisterInput) (*model.User, error) {
	// 检查手机号是否已注册
	existing, _ := s.authRepo.FindByPhone(input.Phone)
	if existing != nil && existing.ID != uuid.Nil {
		return nil, fmt.Errorf("该手机号已注册")
	}

	// 密码哈希
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), 12)
	if err != nil {
		return nil, fmt.Errorf("密码加密失败")
	}

	user := &model.User{
		Phone:        input.Phone,
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
	user, err := s.authRepo.FindByPhone(input.Phone)
	if err != nil {
		return nil, fmt.Errorf("手机号或密码错误")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, fmt.Errorf("手机号或密码错误")
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
		ID:      user.ID.String(),
		Name:    user.Name,
		Role:    user.Role,
		Phone:   user.Phone,
		Grade:   user.Grade,
		Subject: user.Subject,
		WorkMode: workMode,
		AccountSource: user.AccountSource,
	}
	if user.School != nil {
		info.School = &SchoolBrief{ID: user.School.ID.String(), Name: user.School.Name}
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
		"ai_model_tier":      school.AIModelTier,
		"allow_model_switch": school.AllowModelSwitch,
		"show_model_ui":      school.ShowModelUI,
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
