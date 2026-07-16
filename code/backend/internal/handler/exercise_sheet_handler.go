package handler

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"
)

type ExerciseSheetHandler struct {
	repo *repository.ExerciseSheetRepository
}

func NewExerciseSheetHandler(repo *repository.ExerciseSheetRepository) *ExerciseSheetHandler {
	return &ExerciseSheetHandler{repo: repo}
}

func (h *ExerciseSheetHandler) ListSheets(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	items, err := h.repo.List(schoolID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = []model.ExerciseSheet{}
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

func (h *ExerciseSheetHandler) GetSheet(c *gin.Context) {
	item, err := h.repo.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "exercise sheet not found"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *ExerciseSheetHandler) CreateSheet(c *gin.Context) {
	var req struct {
		Title      string `json:"title" binding:"required"`
		Subject    string `json:"subject" binding:"required"`
		Grade      string `json:"grade" binding:"required"`
		Questions  string `json:"questions"`
		DocContent string `json:"doc_content"`
		EditMode   string `json:"edit_mode"`
		PaperSize  string `json:"paper_size"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	teacherID, _ := c.Get("user_id")
	schoolID, _ := c.Get("school_id")

	if req.EditMode == "" {
		req.EditMode = "ai"
	}
	if req.PaperSize == "" {
		req.PaperSize = "A4"
	}
	if req.Questions == "" {
		req.Questions = "[]"
	}

	item := &model.ExerciseSheet{
		ID:         uuid.New().String(),
		SchoolID:   schoolID.(string),
		TeacherID:  teacherID.(string),
		Title:      req.Title,
		Subject:    req.Subject,
		Grade:      req.Grade,
		Questions:  req.Questions,
		DocContent: req.DocContent,
		EditMode:   req.EditMode,
		PaperSize:  req.PaperSize,
		Status:     "draft",
	}
	if err := h.repo.Create(item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *ExerciseSheetHandler) UpdateSheet(c *gin.Context) {
	existing, err := h.repo.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "exercise sheet not found"})
		return
	}
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if v, ok := req["title"]; ok {
		existing.Title = v.(string)
	}
	if v, ok := req["questions"]; ok {
		existing.Questions = v.(string)
	}
	if v, ok := req["doc_content"]; ok {
		existing.DocContent = v.(string)
	}
	if v, ok := req["edit_mode"]; ok {
		existing.EditMode = v.(string)
	}
	if v, ok := req["paper_size"]; ok {
		existing.PaperSize = v.(string)
	}
	if v, ok := req["status"]; ok {
		existing.Status = v.(string)
	}
	existing.UpdatedAt = time.Now()
	if err := h.repo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, existing)
}

func (h *ExerciseSheetHandler) DeleteSheet(c *gin.Context) {
	if err := h.repo.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
