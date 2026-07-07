package handler

import (
	"net/http"
	"time"

	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

type ExamHandler struct {
	repo *repository.ExamRepository
}

func NewExamHandler(repo *repository.ExamRepository) *ExamHandler {
	return &ExamHandler{repo: repo}
}

func (h *ExamHandler) ListExams(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	exams, err := h.repo.List(schoolID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if exams == nil {
		exams = []model.Exam{}
	}
	c.JSON(http.StatusOK, gin.H{"items": exams, "total": len(exams)})
}

func (h *ExamHandler) GetExam(c *gin.Context) {
	exam, err := h.repo.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "exam not found"})
		return
	}
	c.JSON(http.StatusOK, exam)
}

func (h *ExamHandler) CreateExam(c *gin.Context) {
	var req struct {
		Title           string `json:"title" binding:"required"`
		Subject         string `json:"subject" binding:"required"`
		Grade           string `json:"grade" binding:"required"`
		Questions       string `json:"questions"`
		TotalScore      float64 `json:"total_score"`
		DurationMinutes int    `json:"duration_minutes"`
		Difficulty      string `json:"difficulty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	teacherID, _ := c.Get("user_id")
	schoolID, _ := c.Get("school_id")

	exam := &model.Exam{
		ID:              "e" + time.Now().Format("20060102150405") + "0",
		SchoolID:        schoolID.(string),
		TeacherID:       teacherID.(string),
		Title:           req.Title,
		Subject:         req.Subject,
		Grade:           req.Grade,
		Questions:       req.Questions,
		TotalScore:      req.TotalScore,
		DurationMinutes: req.DurationMinutes,
		Difficulty:      req.Difficulty,
		Status:          "draft",
	}
	if exam.Questions == "" {
		exam.Questions = "[]"
	}
	if exam.TotalScore == 0 {
		exam.TotalScore = 100
	}
	if exam.DurationMinutes == 0 {
		exam.DurationMinutes = 45
	}

	if err := h.repo.Create(exam); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, exam)
}

func (h *ExamHandler) UpdateExam(c *gin.Context) {
	existing, err := h.repo.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "exam not found"})
		return
	}

	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if v, ok := req["title"]; ok { existing.Title = v.(string) }
	if v, ok := req["questions"]; ok { existing.Questions = v.(string) }
	if v, ok := req["total_score"]; ok { existing.TotalScore = v.(float64) }
	if v, ok := req["duration_minutes"]; ok { existing.DurationMinutes = int(v.(float64)) }
	if v, ok := req["difficulty"]; ok { existing.Difficulty = v.(string) }
	if v, ok := req["status"]; ok { existing.Status = v.(string) }
	existing.UpdatedAt = time.Now()

	if err := h.repo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, existing)
}

func (h *ExamHandler) DeleteExam(c *gin.Context) {
	if err := h.repo.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
