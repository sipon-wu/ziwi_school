package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"
)

type SheetHandler struct {
	repo *repository.SheetRepo
}

func NewSheetHandler(repo *repository.SheetRepo) *SheetHandler {
	return &SheetHandler{repo: repo}
}

func (h *SheetHandler) List(c *gin.Context) {
	teacherID := c.GetString("user_id")
	schoolID := c.GetString("school_id")
	sheets, err := h.repo.ListByTeacher(teacherID, schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	c.JSON(http.StatusOK, sheets)
}

func (h *SheetHandler) Get(c *gin.Context) {
	id := c.Param("id")
	schoolID := c.GetString("school_id")
	sheet, err := h.repo.GetByID(id, schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	if sheet == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "题单不存在"})
		return
	}
	c.JSON(http.StatusOK, sheet)
}

func (h *SheetHandler) Create(c *gin.Context) {
	var req struct {
		Title           string `json:"title"`
		Subject         string `json:"subject"`
		Grade           string `json:"grade"`
		TargetClassID   string `json:"target_class_id"`
		TargetClassName string `json:"target_class_name"`
		Deadline        string `json:"deadline"`
		Difficulty      string `json:"difficulty"`
		Questions       string `json:"questions"`
		TotalCount      int    `json:"total_count"`
		Status          string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}
	sheet := &model.Sheet{
		ID:              uuid.New().String(),
		SchoolID:        c.GetString("school_id"),
		TeacherID:       c.GetString("user_id"),
		Title:           req.Title,
		Subject:         req.Subject,
		Grade:           req.Grade,
		TargetClassID:   req.TargetClassID,
		TargetClassName: req.TargetClassName,
		Deadline:        req.Deadline,
		Difficulty:      req.Difficulty,
		Questions:       req.Questions,
		TotalCount:      req.TotalCount,
		Status:          req.Status,
	}
	if sheet.Status == "" {
		sheet.Status = "draft"
	}
	if sheet.Difficulty == "" {
		sheet.Difficulty = "L2"
	}
	if err := h.repo.Create(sheet); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存失败"})
		return
	}
	c.JSON(http.StatusOK, sheet)
}

func (h *SheetHandler) Update(c *gin.Context) {
	id := c.Param("id")
	schoolID := c.GetString("school_id")
	existing, err := h.repo.GetByID(id, schoolID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "题单不存在"})
		return
	}
	var req struct {
		Title           string `json:"title"`
		Subject         string `json:"subject"`
		Grade           string `json:"grade"`
		TargetClassID   string `json:"target_class_id"`
		TargetClassName string `json:"target_class_name"`
		Deadline        string `json:"deadline"`
		Difficulty      string `json:"difficulty"`
		Questions       string `json:"questions"`
		TotalCount      int    `json:"total_count"`
		Status          string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}
	existing.Title = req.Title
	existing.Subject = req.Subject
	existing.Grade = req.Grade
	existing.TargetClassID = req.TargetClassID
	existing.TargetClassName = req.TargetClassName
	existing.Deadline = req.Deadline
	existing.Difficulty = req.Difficulty
	existing.Questions = req.Questions
	existing.TotalCount = req.TotalCount
	if req.Status != "" {
		existing.Status = req.Status
	}
	if err := h.repo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失败"})
		return
	}
	c.JSON(http.StatusOK, existing)
}
