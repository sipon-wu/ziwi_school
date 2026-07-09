package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/zhiwei/backend/internal/cloud"
	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"
)

// AuthHandler 认证处理器
type AuthHandler struct {
	userRepo  *repository.UserRepository
	jwtSecret string
	cloudJWKS *cloud.CloudJWKS // P1: 云登录验签
}

// SetCloudJWKS 注入 cloud JWKS 验签器（P1）
func (h *AuthHandler) SetCloudJWKS(jwks *cloud.CloudJWKS) {
	h.cloudJWKS = jwks
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(userRepo *repository.UserRepository, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
	}
}

// LoginRequest 登录请求
type LoginRequest struct {
	Phone    string `json:"phone" binding:"required,len=11"`
	Password string `json:"password" binding:"required,min=6"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token string      `json:"token"`
	User  UserProfile `json:"user"`
}

// UserProfile 用户基本信息
type UserProfile struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Role       string `json:"role"`
	SchoolID   string `json:"school_id"`
	SchoolName string `json:"school_name"`
	AvatarURL  string `json:"avatar_url,omitempty"`
}

// Login 用户登录
// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "INVALID_REQUEST",
			"message": "请输入正确的11位手机号和密码",
		})
		return
	}

	// 1. 查询用户
	user, err := h.userRepo.FindByPhone(req.Phone)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code":    "INVALID_CREDENTIALS",
			"message": "手机号或密码错误",
		})
		return
	}

	// 2. 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code":    "INVALID_CREDENTIALS",
			"message": "手机号或密码错误",
		})
		return
	}

	// 3. 获取学校名称
	schoolName := ""
	schoolID := ""
	if user.SchoolID != nil {
		school, err := h.userRepo.GetSchool(*user.SchoolID)
		if err == nil {
			schoolName = school.FullName
			schoolID = school.ID
		}
	}

	// 4. 生成 JWT
	token, err := h.generateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "TOKEN_GENERATION_FAILED",
			"message": "登录失败，请重试",
		})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		Token: token,
		User: UserProfile{
			ID:         user.ID,
			Name:       user.Name,
			Role:       user.Role,
			SchoolID:   schoolID,
			SchoolName: schoolName,
			AvatarURL:  user.AvatarURL,
		},
	})
}

// RefreshToken 刷新 Token
// POST /api/auth/refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "MISSING_TOKEN", "message": "缺少认证信息"})
		return
	}

	// 解析旧 token（允许过期）
	tokenString := authHeader[7:] // 去掉 "Bearer "
	token, _ := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		return []byte(h.jwtSecret), nil
	})

	if token == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "INVALID_TOKEN", "message": "无效的认证信息"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "INVALID_TOKEN", "message": "无效的认证信息"})
		return
	}

	userID, _ := claims["sub"].(string)
	user, err := h.userRepo.FindByID(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "USER_NOT_FOUND", "message": "用户不存在"})
		return
	}

	newToken, err := h.generateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "REFRESH_FAILED", "message": "刷新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": newToken})
}

// generateToken 生成 JWT Token
func (h *AuthHandler) generateToken(user *model.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":       user.ID,
		"role":      user.Role,
		"school_id": user.SchoolID,
		"name":      user.Name,
		"exp":       time.Now().Add(2 * time.Hour).Unix(),
		"iat":       time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.jwtSecret))
}

// UpdateProfile 更新用户个人信息
// PUT /api/user/profile
func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var req struct {
		Name   string `json:"name"`
		Phone  string `json:"phone"`
		Email  string `json:"email"`
		Gender string `json:"gender"`
		Region string `json:"region"`
		Avatar string `json:"avatar"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updates := map[string]interface{}{}
	if req.Name != "" { updates["name"] = req.Name }
	if req.Phone != "" { updates["phone"] = req.Phone }
	if req.Email != "" { updates["email"] = req.Email }
	if req.Gender != "" { updates["gender"] = req.Gender }
	if req.Region != "" { updates["region"] = req.Region }
	if req.Avatar != "" { updates["avatar"] = req.Avatar }
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}
	if err := h.userRepo.UpdateUser(userID.(string), updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}
