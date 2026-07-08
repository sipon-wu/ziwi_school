package handler

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/repository"
)

// AnalyticsHandler 学情/仪表盘处理器
type AnalyticsHandler struct {
	dashboardRepo *repository.DashboardRepository
}

// NewAnalyticsHandler 创建学情处理器
func NewAnalyticsHandler(dashboardRepo *repository.DashboardRepository) *AnalyticsHandler {
	return &AnalyticsHandler{dashboardRepo: dashboardRepo}
}

// GetTeacherDashboard 获取教师仪表盘数据
// GET /api/analytics/teacher-dashboard
func (h *AnalyticsHandler) GetTeacherDashboard(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, ok := teacherID.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "未登录"})
		return
	}

	stats, err := h.dashboardRepo.GetTeacherStats(teacherIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取统计数据失败"})
		return
	}

	recent, err := h.dashboardRepo.GetRecentLessonPlans(teacherIDStr, 5)
	if err != nil {
		log.Printf("[analytics] GetRecentLessonPlans failed for %s: %v", teacherIDStr, err)
		recent = []repository.RecentLessonPlan{} // 空数组而非 null
	}

	c.JSON(http.StatusOK, gin.H{
		"stats":  stats,
		"recent": recent,
	})
}

// GetAnalytics 获取学情分析数据
// GET /api/analytics
func (h *AnalyticsHandler) GetAnalytics(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)

	data, err := h.dashboardRepo.GetAnalyticsData(teacherIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}
