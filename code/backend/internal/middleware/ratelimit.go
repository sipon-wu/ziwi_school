package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RateLimiter 按角色分级的限流中间件（依赖 Redis）。
func RateLimiter(rdb *redis.Client) gin.HandlerFunc {
	rateLimits := map[string]int{
		"teacher":         100,
		"head_teacher":    100,
		"research_lead":   80,
		"registrar":       80,
		"principal":       50,
		"it_admin":        60,
		"platform_ops":    60,
		"platform_devops": 60,
		"student":         30,
		"parent":          30,
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
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":   "RATE_LIMIT_EXCEEDED",
				"message": "请求过于频繁，请稍后重试",
			})
			return
		}

		c.Next()
	}
}

// AuthRateLimiter 针对认证类端点的轻量限流，防凭据爆破与刷新风暴。
// 基于「客户端IP + 路由」固定窗口计数；内存实现、零外部依赖，单实例即可工作。
// 多实例横向扩展时建议替换为 Redis 版本（见上方 RateLimiter）。
func AuthRateLimiter(maxPerWindow int, window time.Duration) gin.HandlerFunc {
	type rlBucket struct {
		reset int64 // 窗口结束时间(UnixNano)
		count int
	}
	var (
		mu      sync.Mutex
		buckets = make(map[string]*rlBucket)
	)

	// 后台清理过期桶，避免内存随客户端数量增长而泄漏
	go func() {
		ticker := time.NewTicker(window)
		defer ticker.Stop()
		for range ticker.C {
			now := time.Now()
			mu.Lock()
			for k, b := range buckets {
				if now.UnixNano() >= b.reset {
					delete(buckets, k)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		// 预检请求不计数
		if c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		key := c.ClientIP() + "|" + c.FullPath()
		now := time.Now()
		mu.Lock()
		b, ok := buckets[key]
		if !ok || now.UnixNano() >= b.reset {
			b = &rlBucket{reset: now.Add(window).UnixNano()}
			buckets[key] = b
		}
		b.count++
		n := b.count
		mu.Unlock()

		if n > maxPerWindow {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":   "RATE_LIMIT_EXCEEDED",
				"message": "请求过于频繁，请稍后重试",
			})
			return
		}
		c.Next()
	}
}
