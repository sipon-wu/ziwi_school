package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequireRole 检查用户角色是否在允许列表中
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("user_role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"code":    "ROLE_NOT_FOUND",
				"message": "会话角色缺失，请重新登录",
			})
			return
		}

		userRole, ok := role.(string)
		if !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"code":    "INVALID_ROLE_TYPE",
				"message": "会话角色无效，请重新登录",
			})
			return
		}

		for _, allowed := range allowedRoles {
			if userRole == allowed {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"code":     "INSUFFICIENT_PERMISSIONS",
			"message":  "当前账号无访问该资源的权限",
			"required": allowedRoles,
			"current":  userRole,
		})
	}
}

// RoleMatrix 定义 8 角色权限矩阵
var RoleMatrix = map[string][]string{
	"teacher": {
		"lesson:read", "lesson:write", "lesson:review",
		"question:read", "question:write",
		"exam:read", "exam:write",
		"assignment:read", "assignment:write",
		"grading:read", "grading:write",
		"analytics:read",
		"parent:read",
		"material:read", "material:write",
	},
	"head_teacher": {
		// 班主任 = 教师全部能力 + 家长签字统计(parent:read) + 学情(analytics:read)
		// 班级管理(class:manage)、家长关系维护(parent:write)归任课/教务职能（A5）
		"lesson:read", "lesson:write", "lesson:review",
		"question:read", "question:write",
		"exam:read", "exam:write",
		"assignment:read", "assignment:write",
		"grading:read", "grading:write",
		"analytics:read",
		"parent:read",
		"material:read", "material:write",
	},
	"research_lead": {
		"lesson:read", "lesson:review", "review:assign",
		"analytics:read", "research:read", "research:write",
	},
	"registrar": {
		"class:manage", "schedule:manage", "semester:manage",
		"teacher:assign", "course:manage",
	},
	"principal": {
		"analytics:read", "dashboard:read", "report:read",
	},
	"it_admin": {
		"user:manage", "permission:manage",
		"contact:manage", "textbook:manage",
	},
	"platform_ops": {
		"token:manage", "license:manage", "announcement:manage",
		"audit:manage", "finance:read", "support:manage",
		"textbook:platform",
	},
	"platform_devops": {
		"monitor:read", "log:read", "backup:manage", "security:manage",
	},
}
