package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/cloud"
)

// CloudTokenAuth 验证来自 cloud.ziwi.cn 的 RS256 token（JWKS 公钥独立验签）。
// P0 仅做：验签通过 → 把云端身份注入 gin context；不做本地用户绑定（绑定属 P1）。
func CloudTokenAuth(jwks *cloud.CloudJWKS) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}

		claims, err := jwks.Verify(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid cloud token", "detail": err.Error()})
			return
		}

		c.Set("cloud_sub", claims["sub"])
		c.Set("cloud_email", claims["email"])
		c.Set("cloud_tenant_id", claims["tenant_id"])
		c.Set("cloud_products", claims["products"])
		c.Next()
	}
}
