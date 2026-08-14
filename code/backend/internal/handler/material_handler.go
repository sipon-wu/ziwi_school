package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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
		Name    string  `json:"name"`
		Type    string  `json:"type"`
		Format  string  `json:"format"`
		Tag     string  `json:"tag"`
		URL     string  `json:"url"`
		Content string  `json:"content"`
		H5HTML  string  `json:"h5_html"`
		Status  string  `json:"status"`
		Grade   string  `json:"grade"`
		Subject string  `json:"subject"`
		ThemeID string  `json:"theme_id"`
		InteractiveSlots *string `json:"interactive_slots"`
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
		H5HTML:    body.H5HTML,
		Status:    body.Status,
		Grade:     body.Grade,
		Subject:   body.Subject,
		ThemeID:   body.ThemeID,
		CreatedAt: time.Now(),
	}
	if body.InteractiveSlots != nil {
		m.InteractiveSlots = *body.InteractiveSlots
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
		Name    string  `json:"name"`
		Type    string  `json:"type"`
		Format  string  `json:"format"`
		Tag     string  `json:"tag"`
		URL     string  `json:"url"`
		Content string  `json:"content"`
		H5HTML  string  `json:"h5_html"`
		Status  string  `json:"status"`
		Grade   string  `json:"grade"`
		Subject string  `json:"subject"`
		ThemeID string  `json:"theme_id"`
		InteractiveSlots *string `json:"interactive_slots"`
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
	existing.H5HTML = body.H5HTML
	if body.Status != "" {
		existing.Status = body.Status
	}
	existing.Grade = body.Grade
	existing.Subject = body.Subject
	existing.ThemeID = body.ThemeID
	// 指针区分：nil=未传不动；传空串=真清空（解决"删光互动无法清快照"）
	if body.InteractiveSlots != nil {
		existing.InteractiveSlots = *body.InteractiveSlots
	}
	if err := h.repo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, existing)
}

// GetMaterialH5 公开端点：按素材 ID 返回投屏互动 H5 课件 HTML（供手机扫码访问，无需登录）
// GET /api/materials/:id/h5
func (h *MaterialHandler) GetMaterialH5(c *gin.Context) {
	id := c.Param("id")
	m, err := h.repo.GetByID(id)
	if err != nil {
		c.Data(http.StatusNotFound, "text/html;charset=utf-8", []byte("<h1>课件不存在</h1>"))
		return
	}
	// 优先返回前端自动生成的完整互动 HTML；若无则按 content 兜底渲染纯展示页
	if strings.TrimSpace(m.H5HTML) != "" {
		c.Data(http.StatusOK, "text/html;charset=utf-8", []byte(m.H5HTML))
		return
	}
	if strings.TrimSpace(m.Content) != "" {
		c.Data(http.StatusOK, "text/html;charset=utf-8", []byte(renderH5Fallback(m.Content, m.Name)))
		return
	}
	c.Data(http.StatusOK, "text/html;charset=utf-8", []byte("<h1>"+escapeHtml(m.Name)+"</h1><p>该课件暂无可展示内容</p>"))
}

// renderH5Fallback 将素材 content（OutlineSlide[] JSON）兜底渲染为纯展示 H5 页
func renderH5Fallback(content, name string) string {
	type slide struct {
		Title   string   `json:"title"`
		Heading string   `json:"heading"`
		Points  []string `json:"points"`
		Body    string   `json:"body"`
	}
	var slides []slide
	json.Unmarshal([]byte(content), &slides)
	if len(slides) == 0 {
		return "<h1>" + escapeHtml(name) + "</h1>"
	}
	var sb strings.Builder
	sb.WriteString(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>` + escapeHtml(name) + `</title><style>body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;background:#0f1226;margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh}.card{background:#fff;color:#222;border-radius:20px;padding:40px 56px;max-width:860px;box-shadow:0 20px 60px rgba(0,0,0,.4)}h1{color:#1A3A6B;margin:0 0 18px}h2{color:#1A3A6B;margin:18px 0 10px}ul{line-height:1.9;font-size:18px}.brand{position:fixed;top:16px;right:24px;color:rgba(255,255,255,.4);font-size:12px}</style></head><body><div class="brand">知微 · 互动课件</div><div class="card">`)
	sb.WriteString("<h1>" + escapeHtml(name) + "</h1>")
	for _, s := range slides {
		t := s.Title
		if t == "" {
			t = s.Heading
		}
		if t != "" {
			sb.WriteString("<h2>" + escapeHtml(t) + "</h2>")
		}
		if len(s.Points) > 0 {
			sb.WriteString("<ul>")
			for _, p := range s.Points {
				sb.WriteString("<li>" + escapeHtml(p) + "</li>")
			}
			sb.WriteString("</ul>")
		}
		if s.Body != "" {
			sb.WriteString("<p>" + escapeHtml(s.Body) + "</p>")
		}
	}
	sb.WriteString("</div></body></html>")
	return sb.String()
}

func escapeHtml(s string) string {
	r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\"", "&quot;")
	return r.Replace(s)
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
