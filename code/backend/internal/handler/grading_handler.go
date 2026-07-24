package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/repository"
)

// GradingHandler 批阅处理器
type GradingHandler struct {
	attemptRepo *repository.AttemptEventRepository
}

func NewGradingHandler(attemptRepo *repository.AttemptEventRepository) *GradingHandler {
	return &GradingHandler{attemptRepo: attemptRepo}
}

// SubmitGradeRequest 提交批阅请求
type SubmitGradeRequest struct {
	StudentID    string           `json:"student_id" binding:"required"`
	AssignmentID string           `json:"assignment_id" binding:"required"`
	Results      []GradeItem      `json:"results" binding:"required"`
}

type GradeItem struct {
	QuestionID string `json:"question_id" binding:"required"`
	Correct    bool   `json:"correct"`
	Score      float64 `json:"score"`
	ErrorCause string `json:"error_cause"`
	TimeSpent  int    `json:"time_spent"`
}

// SubmitGrade 提交批阅结果并写入答题事件（AttemptEvents 写入 hook）
// POST /api/grading/batch
func (h *GradingHandler) SubmitGrade(c *gin.Context) {
	var req SubmitGradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请求参数有误"})
		return
	}

	// 构造 AttemptEvent 列表
	events := make([]repository.AttemptEvent, 0, len(req.Results))
	now := time.Now()
	for _, item := range req.Results {
		events = append(events, repository.AttemptEvent{
			StudentID:    req.StudentID,
			QuestionID:   item.QuestionID,
			AssignmentID: req.AssignmentID,
			Correct:      item.Correct,
			ErrorCause:   item.ErrorCause,
			TimeSpent:    item.TimeSpent,
			Timestamp:    now,
		})
	}

	if err := h.attemptRepo.BatchCreate(events); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "CREATE_FAILED", "message": "写入答题记录失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          "批阅结果已提交",
		"events_created":   len(events),
	})
}
