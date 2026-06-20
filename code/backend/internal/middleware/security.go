package middleware

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// SecurityHeaders 添加安全响应头（Go 层面兜底）
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Next()
	}
}

// CSRFProtection Double Submit Cookie 模式
func CSRFProtection() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 跳过 GET/HEAD/OPTIONS
		if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		// 获取 CSRF Token（Header 或 Cookie）
		headerToken := c.GetHeader("X-CSRF-Token")
		cookieToken, _ := c.Cookie("csrf_token")

		if headerToken == "" || cookieToken == "" || headerToken != cookieToken {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "CSRF 验证失败"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// GenerateCSRFToken 生成 CSRF Token 并写入 Cookie
func GenerateCSRFToken() (token string, cookieStr string) {
	b := make([]byte, 32)
	rand.Read(b)
	token = base64.URLEncoding.EncodeToString(b)
	cookieStr = "csrf_token=" + token + "; Path=/; SameSite=Strict; HttpOnly; Max-Age=86400"
	return
}

// SanitizeInput 输入清洗：移除危险字符
func SanitizeInput(input string) string {
	// 移除 null 字节
	result := strings.ReplaceAll(input, "\x00", "")
	// 限制长度（防止超长输入）
	if len(result) > 10000 {
		result = result[:10000]
	}
	return result
}

// HashToken 对敏感 token 做单向哈希
func HashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
