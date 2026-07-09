package middleware

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/cloud"
)

// CloudTokenAuth 验证来自 cloud.ziwi.cn 的 RS256 token（JWKS 公钥独立验签）。
// P0 仅做：验签通过 → 把云端身份注入 gin context；不做本地用户绑定（绑定属 P1）。
//
// 避坑（来自 cloud-jwt-integration-guide.md §3.4）：
//  - token 过期 → 返回 401 + "token 已过期，请刷新"
//  - 签名无效 → 返回 401（指南说"重新拉取 JWKS 后重试"——这在 jwks.Verify() 内部已处理）
//  - cloud 不可达且无本地缓存 → 返回 503（不是 401！指南 §3.4 JWKS_UNAVAILABLE）
func CloudTokenAuth(jwks *cloud.CloudJWKS) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			log.Printf("[cloud-auth] 拒绝: 缺少 Authorization header (path=%s)", c.Request.URL.Path)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "MISSING_TOKEN",
				"message": "缺少认证信息",
			})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			log.Printf("[cloud-auth] 拒绝: 非 Bearer 格式 header=%s", authHeader[:min(len(authHeader), 20)])
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "INVALID_AUTH_FORMAT",
				"message": "认证格式错误，请使用 Bearer Token",
			})
			return
		}

		tokenStr := parts[1]
		if tokenStr == "" {
			log.Printf("[cloud-auth] 拒绝: 空 token")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "EMPTY_TOKEN",
				"message": "认证凭证为空",
			})
			return
		}

		claims, err := jwks.Verify(tokenStr)
		if err != nil {
			// 判断是否为过期错误（指南 §3.4 错误处理决策表）
			errStr := err.Error()
			if strings.Contains(errStr, "token is expired") || strings.Contains(errStr, "expired") {
				log.Printf("[cloud-auth] 拒绝: token 过期")
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error":   "TOKEN_EXPIRED",
					"message": "云端令牌已过期，请刷新",
				})
				return
			}
			// JWKS 不可达（无本地缓存降级）→ 503
			if strings.Contains(errStr, "JWKS") || strings.Contains(errStr, "unreachable") || strings.Contains(errStr, "unavailable") {
				log.Printf("[cloud-auth] 拒绝: JWKS 不可达 - %v", err)
				c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
					"error":   "JWKS_UNAVAILABLE",
					"message": "认证服务暂不可用，请稍后重试",
				})
				return
			}
			log.Printf("[cloud-auth] 拒绝: 验签失败 - %v", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "INVALID_TOKEN",
				"message": "无效的云认证凭证",
			})
			return
		}

		sub, _ := claims["sub"].(string)
		email, _ := claims["email"].(string)
		log.Printf("[cloud-auth] ✓ 验签通过: sub=%s email=%s path=%s", sub, email, c.Request.URL.Path)

		c.Set("cloud_sub", sub)
		c.Set("cloud_email", email)
		c.Set("cloud_tenant_id", claims["tenant_id"])
		c.Set("cloud_products", claims["products"])
		c.Next()
	}
}
