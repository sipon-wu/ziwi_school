package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"

	"github.com/zhiwei/backend/internal/repository"
)

// CareHandler 成长关爱处理器
type CareHandler struct {
	careRepo *repository.CareRepository
}

func NewCareHandler(careRepo *repository.CareRepository) *CareHandler {
	return &CareHandler{careRepo: careRepo}
}

type AddCareStudentRequest struct {
	StudentID   string `json:"student_id" binding:"required"`
	FocusArea   string `json:"focus_area"`
	Observation string `json:"observation"`
}

type UpdateCareRequest struct {
	FocusArea   string `json:"focus_area"`
	Observation string `json:"observation"`
	PlanStatus  string `json:"plan_status"`
}

type UpdatePlanRequest struct {
	WeeklyPlan datatypes.JSON `json:"weekly_plan"`
	PlanStatus string         `json:"plan_status"`
}

// ListCareStudents 获取教师所有关怀学生
// GET /api/care/students
func (h *CareHandler) ListCareStudents(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	schoolID, _ := c.Get("school_id")
	teacherIDStr, _ := teacherID.(string)
	schoolIDStr, _ := schoolID.(string)

	students, err := h.careRepo.ListByTeacher(teacherIDStr, schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取关怀学生列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": students})
}

// GetCareStudent 获取单个关怀学生详情
// GET /api/care/students/:id
func (h *CareHandler) GetCareStudent(c *gin.Context) {
	id := c.Param("id")

	care, err := h.careRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "关怀记录不存在"})
		return
	}

	c.JSON(http.StatusOK, care)
}

// AddCareStudent 添加学生到关怀组
// POST /api/care/students
func (h *CareHandler) AddCareStudent(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	schoolID, _ := c.Get("school_id")
	teacherIDStr, _ := teacherID.(string)
	schoolIDStr, _ := schoolID.(string)

	var req AddCareStudentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请提供学生ID"})
		return
	}

	// 查重
	existing, err := h.careRepo.FindByStudentAndTeacher(req.StudentID, teacherIDStr)
	if err == nil && existing != nil {
		c.JSON(http.StatusConflict, gin.H{"code": "DUPLICATE", "message": "该学生已在关怀组中"})
		return
	}

	record := &repository.GrowthCareRecord{
		StudentID:          req.StudentID,
		TeacherID:          teacherIDStr,
		SchoolID:           schoolIDStr,
		CurrentStatus:      "关注中",
		FocusArea:          req.FocusArea,
		TeacherObservation: req.Observation,
		PlanStatus:         "draft",
		DataBasis:          datatypes.JSON(`{}`),
		WeeklyPlan:         datatypes.JSON(`{}`),
	}

	if err := h.careRepo.Create(record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "CREATE_FAILED", "message": "添加失败"})
		return
	}

	c.JSON(http.StatusCreated, record)
}

// UpdateCareStudent 更新关怀学生信息
// PUT /api/care/students/:id
func (h *CareHandler) UpdateCareStudent(c *gin.Context) {
	id := c.Param("id")
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)

	existing, err := h.careRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "关怀记录不存在"})
		return
	}
	if existing.TeacherID != teacherIDStr {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "无权操作"})
		return
	}

	var req UpdateCareRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请求参数有误"})
		return
	}

	if req.FocusArea != "" {
		existing.FocusArea = req.FocusArea
	}
	if req.Observation != "" {
		existing.TeacherObservation = req.Observation
	}
	if req.PlanStatus != "" {
		existing.PlanStatus = req.PlanStatus
	}
	existing.UpdatedAt = time.Now()

	if err := h.careRepo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPDATE_FAILED", "message": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, existing)
}

// UpdateCarePlan 更新关怀方案
// PUT /api/care/students/:id/plan
func (h *CareHandler) UpdateCarePlan(c *gin.Context) {
	id := c.Param("id")
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)

	existing, err := h.careRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "关怀记录不存在"})
		return
	}
	if existing.TeacherID != teacherIDStr {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "无权操作"})
		return
	}

	var req UpdatePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请求参数有误"})
		return
	}

	if req.WeeklyPlan != nil && string(req.WeeklyPlan) != "null" {
		existing.WeeklyPlan = req.WeeklyPlan
	}
	if req.PlanStatus != "" {
		existing.PlanStatus = req.PlanStatus
	}
	existing.UpdatedAt = time.Now()

	if err := h.careRepo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPDATE_FAILED", "message": "更新方案失败"})
		return
	}

	c.JSON(http.StatusOK, existing)
}

// RemoveCareStudent 从关怀组移除（软删除）
// DELETE /api/care/students/:id
func (h *CareHandler) RemoveCareStudent(c *gin.Context) {
	id := c.Param("id")
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)

	if err := h.careRepo.SoftRemove(id, teacherIDStr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "REMOVE_FAILED", "message": "移除失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已移除"})
}
