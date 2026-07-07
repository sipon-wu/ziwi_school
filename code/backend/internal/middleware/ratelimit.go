package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RateLimiter 按角色分级的限流中间件
func RateLimiter(rdb *redis.Client) gin.HandlerFunc {
	rateLimits := map[string]int{
		"teacher":          100,
		"head_teacher":     100,
		"research_lead":    80,
		"registrar":        80,
		"principal":        50,
		"it_admin":         60,
		"platform_ops":     60,
		"platform_devops":  60,
		"student":          30,
		"parent":           30,
	}

	return func(c *gin.Context) {
		role, _ := c.Get("user_role")
		roleStr, ok := role.(string)
		if !ok {
			roleStr = "anonymous"
		}

		limit := rateLimits[roleStr]
		if limit == 0 {
			limit = 30
		}

		key := "ratelimit:" + roleStr + ":" + c.ClientIP()

		ctx := c.Request.Context()
		count, err := rdb.Incr(ctx, key).Result()
		if err == nil && count == 1 {
			rdb.Expire(ctx, key, time.Minute)
		}

		if count > int64(limit) {
			c.AbortWithStatusJSON(429, gin.H{"error": "rate limit exceeded"})
			return
		}

		c.Next()
	}
}
