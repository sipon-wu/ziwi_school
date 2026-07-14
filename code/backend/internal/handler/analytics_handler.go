package handler

import (
	"log"
	"net/http"
	"strconv"

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
// GET /api/analytics/teacher-dashboard?days=7|30&class_id=&subject=&grade=
func (h *AnalyticsHandler) GetTeacherDashboard(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, ok := teacherID.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "未登录"})
		return
	}

	days := 7
	if d, err := strconv.Atoi(c.DefaultQuery("days", "7")); err == nil && (d == 7 || d == 30) {
		days = d
	}
	classID := c.Query("class_id")
	subject := c.Query("subject")
	grade := c.Query("grade")

	stats, err := h.dashboardRepo.GetTeacherStats(teacherIDStr, days, classID, subject, grade)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取统计数据失败"})
		return
	}

	// 近期草稿展示教师全部最近教案（不按学科/年级过滤），与「教案草稿箱」保持一致
	recent, err := h.dashboardRepo.GetRecentLessonPlans(teacherIDStr, "", "", 5)
	if err != nil {
		log.Printf("[analytics] GetRecentLessonPlans failed for %s: %v", teacherIDStr, err)
		recent = []repository.RecentLessonPlan{}
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
