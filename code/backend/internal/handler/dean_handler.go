package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/repository"
)

type DeanHandler struct {
	repo *repository.DeanRepository
}

func NewDeanHandler(repo *repository.DeanRepository) *DeanHandler {
	return &DeanHandler{repo: repo}
}

// ── 班级调度 ──

// ListClasses 班级列表
// GET /api/dean/classes
func (h *DeanHandler) ListClasses(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	classes, err := h.repo.ListClasses(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取班级列表失败"})
		return
	}
	if classes == nil {
		classes = []repository.DeanClass{}
	}
	c.JSON(http.StatusOK, gin.H{"items": classes})
}

// ── 课程安排 ──

// ListCourseSchedules 课程列表
// GET /api/dean/schedule
func (h *DeanHandler) ListCourseSchedules(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	schedules, err := h.repo.ListCourseSchedules(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取课程安排失败"})
		return
	}
	if schedules == nil {
		schedules = []repository.CourseSchedule{}
	}
	c.JSON(http.StatusOK, gin.H{"items": schedules})
}

// CreateCourseSchedule 添加课程
// POST /api/dean/schedule
func (h *DeanHandler) CreateCourseSchedule(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	var req struct {
		ClassID   string `json:"class_id" binding:"required"`
		Subject   string `json:"subject" binding:"required"`
		TeacherID string `json:"teacher_id" binding:"required"`
		DayOfWeek int    `json:"day_of_week" binding:"required,min=1,max=5"`
		Period    int    `json:"period" binding:"required,min=1,max=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请填写完整信息"})
		return
	}

	s := &repository.CourseSchedule{
		SchoolID:  schoolIDStr,
		ClassID:   req.ClassID,
		Subject:   req.Subject,
		TeacherID: req.TeacherID,
		DayOfWeek: req.DayOfWeek,
		Period:    req.Period,
		CreatedAt: time.Now(),
	}
	if err := h.repo.CreateCourseSchedule(s); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "CREATE_FAILED", "message": "添加课程失败"})
		return
	}
	c.JSON(http.StatusCreated, s)
}

// ── 教师管理 ──

// ListTeachers 教师列表
// GET /api/dean/teachers
func (h *DeanHandler) ListTeachers(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	teachers, err := h.repo.ListTeachers(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取教师列表失败"})
		return
	}
	if teachers == nil {
		teachers = []repository.DeanTeacher{}
	}
	c.JSON(http.StatusOK, gin.H{"items": teachers})
}

// ── 学期管理 ──

// ListSemesters 学期列表
// GET /api/dean/semesters
func (h *DeanHandler) ListSemesters(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	semesters, err := h.repo.ListSemesters(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取学期列表失败"})
		return
	}
	if semesters == nil {
		semesters = []repository.Semester{}
	}
	c.JSON(http.StatusOK, gin.H{"items": semesters})
}

// CreateSemester 创建学期
// POST /api/dean/semesters
func (h *DeanHandler) CreateSemester(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	var req struct {
		Name      string `json:"name" binding:"required"`
		StartDate string `json:"start_date" binding:"required"`
		EndDate   string `json:"end_date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请填写完整信息"})
		return
	}

	startDate, _ := time.Parse("2006-01-02", req.StartDate)
	endDate, _ := time.Parse("2006-01-02", req.EndDate)

	s := &repository.Semester{
		SchoolID:  schoolIDStr,
		Name:      req.Name,
		StartDate: startDate,
		EndDate:   endDate,
		CreatedAt: time.Now(),
	}
	if err := h.repo.CreateSemester(s); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "CREATE_FAILED", "message": "创建学期失败"})
		return
	}
	c.JSON(http.StatusCreated, s)
}
