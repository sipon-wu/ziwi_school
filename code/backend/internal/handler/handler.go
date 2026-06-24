package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/golang-jwt/jwt/v5"

	"github.com/zhiwei/backend/internal/service"
)

var validate = validator.New()

// AuthHandler 认证相关 HTTP 处理
type AuthHandler struct {
	authSvc *service.AuthService
	jwtKey  []byte
}

func NewAuthHandler(authSvc *service.AuthService, jwtKey []byte) *AuthHandler {
	return &AuthHandler{authSvc: authSvc, jwtKey: jwtKey}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var input service.RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误", "detail": err.Error()})
		return
	}

	// 部署模式校验
	isPrivate := h.authSvc.GetDeployMode() == "private"
	if isPrivate {
		if input.Username == "" {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "私有部署模式下用户名不能为空"})
			return
		}
	} else {
		if input.Phone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "手机号不能为空"})
			return
		}
	}

	if err := validate.Struct(input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数验证失败", "detail": err.Error()})
		return
	}

	user, err := h.authSvc.Register(c.Request.Context(), &input)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"code": 409, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "注册成功", "user_id": user.ID.String()})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var input service.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	// 部署模式校验：私有模式不校验 phone，SaaS 模式不校验 username
	isPrivate := h.authSvc.GetDeployMode() == "private"
	if isPrivate && input.Username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "私有部署模式下用户名不能为空"})
		return
	}
	if !isPrivate && input.Phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "手机号不能为空"})
		return
	}

	pair, err := h.authSvc.Login(c.Request.Context(), &input)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, pair)
}

func (h *AuthHandler) SendCode(c *gin.Context) {
	var req struct {
		Phone string `json:"phone" validate:"required,len=11"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	if err := h.authSvc.SendVerificationCode(c.Request.Context(), req.Phone); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "发送验证码失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "验证码已发送"})
}

func (h *AuthHandler) CodeLogin(c *gin.Context) {
	var req struct {
		Phone string `json:"phone" validate:"required,len=11"`
		Code  string `json:"code" validate:"required,len=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	pair, err := h.authSvc.VerifyCodeLogin(c.Request.Context(), req.Phone, req.Code)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, pair)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	// 从 Authorization header 提取旧 token
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		c.JSON(http.StatusUnauthorized, gin.H{"code":401,"message":"无效令牌"})
		return
	}
	// 解析旧 token 获取 user_id
	oldToken := strings.TrimPrefix(authHeader, "Bearer ")
	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(oldToken, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte("dev"), nil
	})
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code":401,"message":"令牌无效"})
		return
	}
	userID, _ := claims["user_id"].(string)
	// 颁发新 token（简化：直接签发）
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID, "exp": time.Now().Add(2*time.Hour).Unix(),
	})
	tokenStr, _ := token.SignedString([]byte("dev"))
	c.JSON(http.StatusOK, gin.H{"token": tokenStr, "expires_in": 7200})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")
	workMode, _ := c.Get("work_mode")
	userRole, _ := c.Get("user_role")

	// 从 DB 获取完整用户信息
	user, err := h.authSvc.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"user_id":   userID,
			"name":      userName,
			"role":      userRole,
			"work_mode": workMode,
		})
		return
	}

	info := service.UserInfo{
		ID:                user.ID.String(),
		Name:              user.Name,
		Username:          user.Username,
		Role:              user.Role,
		Phone:             user.Phone,
		Grade:             user.Grade,
		Subject:           user.Subject,
		WorkMode:          workMode.(string),
		AccountSource:     user.AccountSource,
		TokenQuotaMonthly: user.TokenQuotaMonthly,
		TokenUsedMonthly:  user.TokenUsedMonthly,
		TokenQuotaCustom:  user.TokenQuotaCustom,
		DeployMode:        h.authSvc.GetDeployMode(),
	}
	if user.School != nil {
		info.School = &service.SchoolBrief{ID: user.School.ID.String(), Name: user.School.Name}
		info.SchoolConfig = &service.SchoolConfigBrief{
			EnableKnowledgeGraph: user.School.EnableKnowledgeGraph,
			DefaultTokenQuota:    user.School.DefaultTokenQuota,
			AllowModelSwitch:     user.School.AllowModelSwitch,
			ShowModelUI:          user.School.ShowModelUI,
			AIModelTier:          user.School.AIModelTier,
		}
	}
	c.JSON(http.StatusOK, info)
}

// SchoolHandler 学校管理
type SchoolHandler struct {
	schoolSvc *service.SchoolService
}

func NewSchoolHandler(schoolSvc *service.SchoolService) *SchoolHandler {
	return &SchoolHandler{schoolSvc: schoolSvc}
}

func (h *SchoolHandler) List(c *gin.Context) {
	schoolID := c.GetString("school_id") // 管理员可看全部
	schools, total, err := h.schoolSvc.List(schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": schools, "total": total})
}

func (h *SchoolHandler) Create(c *gin.Context) {
	var req struct {
		Name    string `json:"name" validate:"required"`
		Region  string `json:"region"`
		Contact string `json:"contact"`
		Phone   string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	school, err := h.schoolSvc.Create(req.Name, req.Region, req.Contact, req.Phone)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "学校创建成功", "school": school})
}

func (h *SchoolHandler) Get(c *gin.Context) {
	school, err := h.schoolSvc.Get(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code":404,"message":"学校不存在"})
		return
	}
	c.JSON(http.StatusOK, school)
}

// GetSettings 获取学校AI模型设置
func (h *SchoolHandler) GetSettings(c *gin.Context) {
	schoolID := c.GetString("school_id")
	if schoolID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "缺少学校ID"})
		return
	}
	settings, err := h.schoolSvc.GetSettings(schoolID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "学校不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "data": settings})
}

// UpdateSettings 运营端更新学校模型策略
func (h *SchoolHandler) UpdateSettings(c *gin.Context) {
	var req struct {
		AIModelTier          string `json:"ai_model_tier"`
		AllowModelSwitch     bool   `json:"allow_model_switch"`
		ShowModelUI          bool   `json:"show_model_ui"`
		EnableKnowledgeGraph *bool  `json:"enable_knowledge_graph,omitempty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}
	schoolID := c.Param("id")
	if schoolID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "缺少学校ID"})
		return
	}
	if err := h.schoolSvc.UpdateSettings(schoolID, req.AIModelTier, req.AllowModelSwitch, req.ShowModelUI); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}

	// 如果传了 enable_knowledge_graph，单独更新
	if req.EnableKnowledgeGraph != nil {
		if err := h.schoolSvc.UpdateKnowledgeGraph(schoolID, *req.EnableKnowledgeGraph); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "更新成功"})
}

// FeatureRequest 教师申请开启学校功能
func (h *SchoolHandler) FeatureRequest(c *gin.Context) {
	var req struct {
		Feature string `json:"feature" validate:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	// 白名单校验：仅允许申请已支持的功能
	allowedFeatures := map[string]bool{
		"knowledge_graph": true,
	}
	if !allowedFeatures[req.Feature] {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "不支持的功能申请"})
		return
	}

	schoolID := c.GetString("school_id")
	teacherID := c.GetString("user_id")
	teacherName := c.GetString("user_name")

	if err := h.schoolSvc.FeatureRequest(schoolID, teacherID, teacherName, req.Feature); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "申请提交失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "申请已提交，等待校方管理员审核"})
}

// ClassHandler 班级管理
type ClassHandler struct {
	classSvc *service.ClassService
}

func NewClassHandler(classSvc *service.ClassService) *ClassHandler {
	return &ClassHandler{classSvc: classSvc}
}

func (h *ClassHandler) List(c *gin.Context) {
	schoolID := c.GetString("school_id")
	if schoolID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "缺少学校ID"})
		return
	}
	classes, total, err := h.classSvc.ListBySchool(schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": classes, "total": total})
}

func (h *ClassHandler) Create(c *gin.Context) {
	var req struct {
		Name  string `json:"name" validate:"required"`
		Grade string `json:"grade" validate:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}
	schoolID := c.GetString("school_id")
	class, err := h.classSvc.Create(req.Name, req.Grade, schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "班级创建成功", "class": class})
}

// DashboardHandler 工作台
type DashboardHandler struct {
	dashSvc *service.DashboardService
}

func NewDashboardHandler(dashSvc *service.DashboardService) *DashboardHandler {
	return &DashboardHandler{dashSvc: dashSvc}
}

func (h *DashboardHandler) Home(c *gin.Context) {
	userID := c.GetString("user_id")
	schoolID := c.GetString("school_id")

	data, err := h.dashSvc.GetHomeData(userID, schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取工作台数据失败", "detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "data": data})
}
