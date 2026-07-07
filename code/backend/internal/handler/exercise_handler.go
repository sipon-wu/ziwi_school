package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/repository"
)

type ExerciseHandler struct {
	repo *repository.ExerciseRepository
}

func NewExerciseHandler(repo *repository.ExerciseRepository) *ExerciseHandler {
	return &ExerciseHandler{repo: repo}
}

// CreateQuestionRequest 创建题目请求
type CreateQuestionRequest struct {
	Stem         string  `json:"stem" binding:"required"`
	Answer       string  `json:"answer" binding:"required"`
	Analysis     string  `json:"analysis"`
	QuestionType string  `json:"question_type" binding:"required"`
	Subject      string  `json:"subject" binding:"required"`
	Grade        string  `json:"grade" binding:"required"`
	Score        float64 `json:"score"`
	Difficulty   string  `json:"difficulty"`
	Source       string  `json:"source"`
}

// ListQuestions 题库列表
// GET /api/questions
func (h *ExerciseHandler) ListQuestions(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)

	page := 1
	pageSize := 20

	questions, total, err := h.repo.ListByTeacher(teacherIDStr, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取题库失败"})
		return
	}

	if questions == nil {
		questions = []repository.Question{}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":     questions,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// CreateQuestion 创建题目
// POST /api/questions
func (h *ExerciseHandler) CreateQuestion(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	var req CreateQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请填写完整信息：题干、答案、题型、学科、年级"})
		return
	}

	if req.Difficulty == "" {
		req.Difficulty = "L2"
	}
	if req.Source == "" {
		req.Source = "original"
	}

	q := &repository.Question{
		TeacherID:    teacherIDStr,
		SchoolID:     schoolIDStr,
		Content:      req.Stem,
		Answer:       req.Answer,
		AnswerDetail: req.Analysis,
		Type:         req.QuestionType,
		Subject:      req.Subject,
		Grade:        req.Grade,
		Difficulty:   req.Difficulty,
		Source:       req.Source,
		AuditStatus:  "approved",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := h.repo.Create(q); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "CREATE_FAILED", "message": "创建题目失败"})
		return
	}

	c.JSON(http.StatusCreated, q)
}

// UpdateQuestion 更新题目
// PUT /api/questions/:id
func (h *ExerciseHandler) UpdateQuestion(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	id := c.Param("id")

	q, err := h.repo.FindByID(id, teacherIDStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "题目不存在"})
		return
	}

	var req CreateQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请求参数有误"})
		return
	}

	if req.Stem != "" {
		q.Content = req.Stem
	}
	if req.Answer != "" {
		q.Answer = req.Answer
	}
	if req.Analysis != "" {
		q.AnswerDetail = req.Analysis
	}
	if req.QuestionType != "" {
		q.Type = req.QuestionType
	}
	if req.Subject != "" {
		q.Subject = req.Subject
	}
	if req.Grade != "" {
		q.Grade = req.Grade
	}
	if req.Difficulty != "" {
		q.Difficulty = req.Difficulty
	}
	q.UpdatedAt = time.Now()

	if err := h.repo.Update(q); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPDATE_FAILED", "message": "更新题目失败"})
		return
	}

	c.JSON(http.StatusOK, q)
}
