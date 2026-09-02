package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/policy"
	"github.com/zhiwei/backend/internal/repository"
)

type MaterialHandler struct {
	repo   *repository.MaterialRepository
	policy *policy.Client
	db     *gorm.DB // 写版本记录（审核留痕）
}

func NewMaterialHandler(repo *repository.MaterialRepository, pol *policy.Client, db *gorm.DB) *MaterialHandler {
	return &MaterialHandler{repo: repo, policy: pol, db: db}
}

// recordReleaseVersion 发布留痕：写入 versions（kind=release）。
//
// 设计原则：**版本即证据** —— 记录「内容 + 审核结论 + AI 归属 + 发布人」，只追加不修改。
// 写失败只记日志，不阻断发布：留痕是增强，不能因留痕失败而卡死业务。
//
// 参数 res 为 nil 表示审核没跑成（服务不可用），此时 review_status=pending，交人工兜底。
func (h *MaterialHandler) recordReleaseVersion(c *gin.Context, m *model.Material, res *policy.Result) {
	recordRelease(h.db, c, ReleaseMeta{
		ResourceType:   "courseware",
		ResourceID:     m.ID,
		Label:          m.Name,
		Payload:        m.Content,
		AIGenerated:    m.AIGenerated,
		AIModelVersion: m.AIModelVersion,
		HumanEdited:    m.HumanEdited,
	}, res, "")
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

// ListDecor 装饰元件查询接口。
// scope=public 查平台公共装饰库（user_id 为空）；scope=mine 查当前账号装饰元件。
// 支持 facet 过滤: medium(ppt|h5|common) / motif(母题一级，逗号多值OR) /
// color(色系一级，逗号多值OR) / pageType(适用页型) / kind(decor_element|decor_component)。
func (h *MaterialHandler) ListDecor(c *gin.Context) {
	scope := c.DefaultQuery("scope", "public")
	medium := c.Query("medium")
	motif := c.Query("motif")
	color := c.Query("color")
	pageType := c.Query("page_type")
	kind := c.Query("kind")

	var items []model.Material
	var err error
	if scope == "public" {
		items, err = h.repo.ListPublicDecor(c, medium, motif, color, pageType)
	} else {
		uidVal, ok := c.Get("user_id")
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		var uid string
		switch v := uidVal.(type) {
		case string:
			uid = v
		case float64:
			uid = fmt.Sprintf("%.0f", v)
		default:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "用户标识类型异常"})
			return
		}
		if uid == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		items, err = h.repo.ListDecorByFacets(c, uid, medium, motif, color, pageType, kind)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
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

	// 内容安全审核（红线锁）：草稿永远可编辑、不审查；
	// 只有「发布进素材库」（status=active）这一动作才过闸。
	var auditRes *policy.Result
	if m.Status == "active" && h.policy != nil && h.policy.Enabled() {
		res, err := h.policy.Check(c.Request.Context(), policy.CheckRequest{
			Text:    strings.TrimSpace(m.Name + "\n" + m.Content),
			Subject: m.Subject,
			Grade:   m.Grade,
		})
		if err != nil {
			// 审核没能跑成 ≠ 内容没问题：降级为草稿，避免内容"裸奔"到可用状态
			log.Printf("[policy] 课件审核服务不可用，课件降级为草稿: %v", err)
			m.Status = "draft"
		} else if blocking := res.Blocking(); len(blocking) > 0 {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    "CONTENT_BLOCKED",
				"message": "内容未通过安全审核，请修改后再发布",
				"issues":  blocking,
			})
			return
		} else {
			auditRes = res
		}
	}

	if err := h.repo.Create(m); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if m.Status == "active" {
		h.recordReleaseVersion(c, m, auditRes)
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
	originalContent := existing.Content // 用于判断是否真发生内容变更（决定是否记新版本）

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
	wasActive := existing.Status == "active"
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

	// 内容安全审核（红线锁）：草稿永远可编辑、不审查；
	// 只要最终状态为 active（含已发布内容的再次编辑），内容就必须过闸。
	var auditRes *policy.Result
	if existing.Status == "active" && h.policy != nil && h.policy.Enabled() {
		res, err := h.policy.Check(c.Request.Context(), policy.CheckRequest{
			Text:    strings.TrimSpace(existing.Name + "\n" + existing.Content),
			Subject: existing.Subject,
			Grade:   existing.Grade,
		})
		if err != nil {
			log.Printf("[policy] 课件审核服务不可用: %v", err)
			if !wasActive {
				// 尚未发布：不给可用状态，降级为草稿
				existing.Status = "draft"
			}
			// 已发布内容的再次编辑：审核不可用时保持放行，避免锁定正在使用的内容
		} else if blocking := res.Blocking(); len(blocking) > 0 {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    "CONTENT_BLOCKED",
				"message": "内容未通过安全审核，请修改后再发布",
				"issues":  blocking,
			})
			return
		} else {
			auditRes = res
		}
	}

	if err := h.repo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// 发布留痕：仅当内容真发生变化且最终为已发布状态才记新版本（避免改个标签也产生版本）
	if existing.Status == "active" && existing.Content != originalContent {
		h.recordReleaseVersion(c, existing, auditRes)
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

// extractUserID 从 gin context 的 user_id 值中解析出字符串（与 ListDecor 一致）。
func extractUserID(v interface{}) string {
	switch x := v.(type) {
	case string:
		return x
	case float64:
		return fmt.Sprintf("%.0f", x)
	default:
		return ""
	}
}

// ── facet 受控词表（运营维护母题/媒介等词库）──

// ListFacets 按 type 返回受控词（motif/medium...）。
func (h *MaterialHandler) ListFacets(c *gin.Context) {
	typ := c.Query("type")
	if typ == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少 type 参数"})
		return
	}
	list, err := h.repo.ListFacets(c, typ)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list, "total": len(list)})
}

// UpsertFacet 新增/更新受控词（运营后台）。
func (h *MaterialHandler) UpsertFacet(c *gin.Context) {
	var f model.FacetVocab
	if err := c.ShouldBindJSON(&f); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数解析失败: " + err.Error()})
		return
	}
	if f.Type == "" || f.Value == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type 与 value 必填"})
		return
	}
	if f.Label == "" {
		f.Label = f.Value
	}
	if err := h.repo.UpsertFacet(c, &f); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, f)
}

// DeleteFacet 删除受控词（运营后台）。
func (h *MaterialHandler) DeleteFacet(c *gin.Context) {
	id := c.Param("id")
	if err := h.repo.DeleteFacet(c, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
