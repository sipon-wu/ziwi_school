package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"
)

type MaterialHandler struct {
	repo *repository.MaterialRepository
}

func NewMaterialHandler(repo *repository.MaterialRepository) *MaterialHandler {
	return &MaterialHandler{repo}
}

func (h *MaterialHandler) ListMaterials(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	items, err := h.repo.List(schoolID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

// GetMaterial 按 ID 获取单个素材（含 content，供 AI 课件生成读取参照课件正文）
func (h *MaterialHandler) GetMaterial(c *gin.Context) {
	id := c.Param("id")
	m, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "素材不存在"})
		return
	}
	c.JSON(http.StatusOK, m)
}

func (h *MaterialHandler) UploadMaterial(c *gin.Context) {
	userID, _ := c.Get("user_id")
	schoolID, _ := c.Get("school_id")

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请选择文件"})
		return
	}
	defer file.Close()

	if header.Size > 50*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件不能超过50MB"})
		return
	}

	uploadDir := "uploads"
	os.MkdirAll(uploadDir, 0755)
	ext := filepath.Ext(header.Filename)
	storedName := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	fullPath := filepath.Join(uploadDir, storedName)

	dst, err := os.Create(fullPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "文件保存失败"})
		return
	}
	defer dst.Close()
	io.Copy(dst, file)

	m := &model.Material{
		Name:      c.PostForm("name"),
		SchoolID:  schoolID.(string),
		UserID:    userID.(string),
		Type:      c.PostForm("type"),
		Format:    c.PostForm("format"),
		Size:      formatFileSize(header.Size),
		Tag:       c.PostForm("tag"),
		URL:       "/uploads/" + storedName,
		CreatedAt: time.Now(),
	}
	if m.Name == "" {
		m.Name = header.Filename
	}
	if m.Type == "" {
		m.Type = guessType(ext)
	}
	if m.Format == "" {
		m.Format = m.Type // 文件上传无显式 format 时，默认与 type 同（如 video）
	}

	if err := h.repo.Create(m); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, m)
}

// CreateMaterialJSON 以 JSON 方式创建素材（用于程序化写入 AI 生成的课件）
// POST /api/materials/json
func (h *MaterialHandler) CreateMaterialJSON(c *gin.Context) {
	userID, _ := c.Get("user_id")
	schoolID, _ := c.Get("school_id")
	var body struct {
		Name    string `json:"name"`
		Type    string `json:"type"`
		Format  string `json:"format"`
		Tag     string `json:"tag"`
		URL     string `json:"url"`
		Content string `json:"content"`
		Status  string `json:"status"`
		Grade   string `json:"grade"`
		Subject string `json:"subject"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数有误"})
		return
	}
	if body.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写素材名称"})
		return
	}
	m := &model.Material{
		Name:      body.Name,
		SchoolID:  schoolID.(string),
		UserID:    userID.(string),
		Type:      body.Type,
		Format:    body.Format,
		Tag:       body.Tag,
		URL:       body.URL,
		Content:   body.Content,
		Status:    body.Status,
		Grade:     body.Grade,
		Subject:   body.Subject,
		CreatedAt: time.Now(),
	}
	if m.Type == "" {
		m.Type = "courseware"
	}
	if m.Status == "" {
		m.Status = "active"
	}
	if err := h.repo.Create(m); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, m)
}

// UpdateMaterial 更新素材（课件草稿/发布落库复用）
// PUT /api/materials/:id
func (h *MaterialHandler) UpdateMaterial(c *gin.Context) {
	id := c.Param("id")
	existing, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "素材不存在"})
		return
	}
	var body struct {
		Name    string `json:"name"`
		Type    string `json:"type"`
		Format  string `json:"format"`
		Tag     string `json:"tag"`
		URL     string `json:"url"`
		Content string `json:"content"`
		Status  string `json:"status"`
		Grade   string `json:"grade"`
		Subject string `json:"subject"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数有误"})
		return
	}
	existing.Name = body.Name
	existing.Type = body.Type
	if body.Format != "" {
		existing.Format = body.Format
	}
	existing.Tag = body.Tag
	existing.URL = body.URL
	existing.Content = body.Content
	if body.Status != "" {
		existing.Status = body.Status
	}
	existing.Grade = body.Grade
	existing.Subject = body.Subject
	if err := h.repo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, existing)
}

func formatFileSize(sz int64) string {
	switch {
	case sz >= 1024*1024*1024:
		return fmt.Sprintf("%.1fGB", float64(sz)/(1024*1024*1024))
	case sz >= 1024*1024:
		return fmt.Sprintf("%.1fMB", float64(sz)/(1024*1024))
	case sz >= 1024:
		return fmt.Sprintf("%.1fKB", float64(sz)/1024)
	default:
		return fmt.Sprintf("%dB", sz)
	}
}

func guessType(ext string) string {
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg":
		return "image"
	case ".mp3", ".wav", ".flac", ".m4a", ".aac":
		return "audio"
	case ".mp4", ".avi", ".mov", ".mkv", ".webm":
		return "video"
	case ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt":
		return "doc"
	default:
		return "other"
	}
}
