package middleware

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
)

type contextKey string

const (
	KeyUserID    contextKey = "user_id"
	KeySchoolID  contextKey = "school_id"
	KeyUserRole  contextKey = "user_role"
	KeyUserName  contextKey = "user_name"
)

// JWTAuth 验证 JWT Token 并注入用户信息到上下文
func JWTAuth(jwtSecret []byte, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未提供有效的认证令牌"})
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("无效签名算法")
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "令牌已过期或无效"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "无法解析令牌"})
			c.Abort()
			return
		}

		userID := claims["user_id"].(string)
		role := claims["role"].(string)

		c.Set(string(KeyUserID), userID)
		c.Set(string(KeyUserRole), role)
		c.Set(string(KeyUserName), claims["name"].(string))

		// 如果有 school_id，注入并设置 PostgreSQL RLS 上下文
		if schoolID, ok := claims["school_id"].(string); ok && schoolID != "" {
			c.Set(string(KeySchoolID), schoolID)
			// PostgreSQL RLS: 设置当前会话的 school_id
			db.Exec("SELECT set_config('app.current_school_id', $1, true)", schoolID)
		}

		c.Next()
	}
}

// TenantScope 为 GORM 查询自动注入 school_id 过滤（防御性编程）
func TenantScope() gin.HandlerFunc {
	return func(c *gin.Context) {
		schoolID, _ := c.Get(string(KeySchoolID))
		if sid, ok := schoolID.(string); ok && sid != "" {
			c.Set("gorm:tenant_school_id", sid)
		}
		c.Next()
	}
}

// RequireRole 角色权限校验
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get(string(KeyUserRole))
		userRole := role.(string)

		for _, r := range roles {
			if userRole == r {
				c.Next()
				return
			}
		}
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "权限不足"})
		c.Abort()
	}
}

// RateLimit 简单 Redis 令牌桶限流
func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	// MVP 阶段使用内存计数器，后期可接入 Redis
	type counter struct {
		count    int
		resetAt  time.Time
	}
	store := make(map[string]*counter)

	return func(c *gin.Context) {
		key := c.ClientIP() + ":" + c.FullPath()
		now := time.Now()

		if entry, ok := store[key]; ok {
			if now.After(entry.resetAt) {
				entry.count = 1
				entry.resetAt = now.Add(window)
			} else if entry.count >= limit {
				c.JSON(http.StatusTooManyRequests, gin.H{"code": 429, "message": "请求频率过高，请稍后再试"})
				c.Abort()
				return
			} else {
				entry.count++
			}
		} else {
			store[key] = &counter{count: 1, resetAt: now.Add(window)}
		}
		c.Next()
	}
}

// CORS 跨域中间件
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Request-ID")
		c.Header("Access-Control-Max-Age", "86400")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

// Recovery 统一 panic 恢复 + 错误格式
func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, err interface{}) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    500,
			"message": "服务器内部错误",
			"detail":  fmt.Sprintf("%v", err),
		})
	})
}

// AuditLogger 关键操作审计日志记录
func AuditLogger(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		// 仅记录写操作
		if c.Request.Method == "GET" || c.Request.Method == "OPTIONS" {
			return
		}
		go func() {
			userID, _ := c.Get(string(KeyUserID))
			role, _ := c.Get(string(KeyUserRole))
			schoolID, _ := c.Get(string(KeySchoolID))

			log := model.AuditLog{
				UserID:   parseUUID(getString(userID)),
				UserRole: getString(role),
				SchoolID: parseUUID(getString(schoolID)),
				Action:   strings.ToLower(c.Request.Method) + ":" + c.FullPath(),
				ResourceType: strings.Split(strings.TrimPrefix(c.FullPath(), "/api/v1/"), "/")[0],
				IPAddress: c.ClientIP(),
			}
			db.Create(&log)
		}()
	}
}

func getString(v interface{}) string {
	if v == nil { return "" }
	if s, ok := v.(string); ok { return s }
	return ""
}

func parseUUID(s string) uuid.UUID {
	parsed, _ := uuid.Parse(s)
	return parsed
}
