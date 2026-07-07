package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"
)

type LessonHandler struct {
	repo *repository.LessonRepository
}

func NewLessonHandler(repo *repository.LessonRepository) *LessonHandler {
	return &LessonHandler{repo: repo}
}

// CreateLessonRequest 创建教案请求
type CreateLessonRequest struct {
	Title    string `json:"title" binding:"required"`
	Subject  string `json:"subject" binding:"required"`
	Grade    string `json:"grade" binding:"required"`
	Unit     string `json:"unit"`
	Content  string `json:"content" binding:"required"`
}

// UpdateLessonRequest 更新教案请求
type UpdateLessonRequest struct {
	Title   string `json:"title" binding:"max=12"`
	Subject string `json:"subject"`
	Grade   string `json:"grade"`
	Unit    string `json:"unit"`
	Content string `json:"content"`
}

// ListLessonPlans 教案草稿箱列表
// GET /api/lessons
func (h *LessonHandler) ListLessonPlans(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)

	page := 1
	pageSize := 20

	plans, total, err := h.repo.ListByTeacher(teacherIDStr, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取教案列表失败"})
		return
	}

	if plans == nil {
		plans = []model.LessonPlan{}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":     plans,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// CreateLessonPlan 创建教案草稿
// POST /api/lessons
func (h *LessonHandler) CreateLessonPlan(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	var req CreateLessonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请填写完整信息：标题(≤12字)、学科、年级、内容"})
		return
	}

	plan := &model.LessonPlan{
		TeacherID:    teacherIDStr,
		SchoolID:     schoolIDStr,
		Title:        req.Title,
		Subject:      req.Subject,
		Grade:        req.Grade,
		Unit:         req.Unit,
		Content:      req.Content,
		Status:       "draft",
		TemplateType: "core_literacy",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := h.repo.Create(plan); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "CREATE_FAILED", "message": "创建教案失败"})
		return
	}

	c.JSON(http.StatusCreated, plan)
}

// GetLessonPlan 获取教案详情
// GET /api/lessons/:id
func (h *LessonHandler) GetLessonPlan(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	id := c.Param("id")

	plan, err := h.repo.FindByID(id, teacherIDStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "教案不存在"})
		return
	}

	c.JSON(http.StatusOK, plan)
}

// UpdateLessonPlan 更新教案
// PUT /api/lessons/:id
func (h *LessonHandler) UpdateLessonPlan(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	id := c.Param("id")

	plan, err := h.repo.FindByID(id, teacherIDStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "教案不存在"})
		return
	}

	var req UpdateLessonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请求参数有误"})
		return
	}

	if req.Title != "" {
		plan.Title = req.Title
	}
	if req.Subject != "" {
		plan.Subject = req.Subject
	}
	if req.Grade != "" {
		plan.Grade = req.Grade
	}
	if req.Unit != "" {
		plan.Unit = req.Unit
	}
	if req.Content != "" {
		plan.Content = req.Content
	}
	plan.EditCount++
	plan.UpdatedAt = time.Now()

	if err := h.repo.Update(plan); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPDATE_FAILED", "message": "更新教案失败"})
		return
	}

	c.JSON(http.StatusOK, plan)
}

// DeleteLessonPlan 删除教案（归档）
// DELETE /api/lessons/:id
func (h *LessonHandler) DeleteLessonPlan(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	id := c.Param("id")

	if err := h.repo.Delete(id, teacherIDStr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DELETE_FAILED", "message": "删除教案失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已归档"})
}
