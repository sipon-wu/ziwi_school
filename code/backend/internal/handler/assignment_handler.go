package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/repository"
)

type AssignmentHandler struct {
	repo *repository.AssignmentRepository
}

func NewAssignmentHandler(repo *repository.AssignmentRepository) *AssignmentHandler {
	return &AssignmentHandler{repo: repo}
}

// CreateAssignmentRequest 创建作业请求
type CreateAssignmentRequest struct {
	Title          string  `json:"title" binding:"required"`
	Subject        string  `json:"subject" binding:"required"`
	ClassID        string  `json:"class_id" binding:"required"`
	AssignmentType string  `json:"assignment_type"`
	Questions      []QuestionItem `json:"questions"`
	TotalScore     float64 `json:"total_score"`
	DueHours       int     `json:"due_hours"`
}

// QuestionItem 作业中的题目项
type QuestionItem struct {
	QuestionID string  `json:"question_id"`
	Score      float64 `json:"score"`
}

// ListAssignments 作业列表
// GET /api/assignments
func (h *AssignmentHandler) ListAssignments(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)

	page := 1
	pageSize := 20

	assignments, total, err := h.repo.ListByTeacher(teacherIDStr, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取作业列表失败"})
		return
	}

	if assignments == nil {
		assignments = []repository.Assignment{}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":     assignments,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// CreateAssignment 布置作业
// POST /api/assignments
func (h *AssignmentHandler) CreateAssignment(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	var req CreateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请填写完整信息：标题、学科、班级"})
		return
	}

	if req.AssignmentType == "" {
		req.AssignmentType = "regular"
	}

	// 序列化题目列表为 JSON
	questionsJSON, _ := json.Marshal(req.Questions)

	now := time.Now()
	a := &repository.Assignment{
		TeacherID:      teacherIDStr,
		SchoolID:       schoolIDStr,
		ClassID:        req.ClassID,
		Subject:        req.Subject,
		Title:          req.Title,
		AssignmentType: req.AssignmentType,
		Questions:      string(questionsJSON),
		TotalScore:     req.TotalScore,
		DueType:        "relative",
		DueHours:       req.DueHours,
		PublishedAt:    &now,
		GradingStatus:  "pending",
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := h.repo.Create(a); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "CREATE_FAILED", "message": "布置作业失败"})
		return
	}

	c.JSON(http.StatusCreated, a)
}
