package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/zhiwei/backend/internal/model"
	"gorm.io/gorm"
)

// AnnotationHandler 通用批注 + 版本快照端点（挂任意作品）。
// 批注：发布前后均可增删。版本：草稿期可存/回退，发布(active)后只读、禁恢复。
type AnnotationHandler struct {
	db *gorm.DB
}

func NewAnnotationHandler(db *gorm.DB) *AnnotationHandler {
	return &AnnotationHandler{db}
}

func (h *AnnotationHandler) ids(c *gin.Context) (schoolID, userID string) {
	s, _ := c.Get("school_id")
	u, _ := c.Get("user_id")
	schoolID, _ = s.(string)
	userID, _ = u.(string)
	return
}

// ── 批注 ──

func (h *AnnotationHandler) ListAnnotations(c *gin.Context) {
	schoolID, _ := h.ids(c)
	rt, rid := c.Query("resource_type"), c.Query("resource_id")
	if rt == "" || rid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "resource_type 与 resource_id 必填"})
		return
	}
	var items []model.Annotation
	if err := h.db.Where("school_id = ? AND resource_type = ? AND resource_id = ?", schoolID, rt, rid).
		Order("created_at DESC").Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *AnnotationHandler) CreateAnnotation(c *gin.Context) {
	schoolID, userID := h.ids(c)
	var body struct {
		ResourceType string `json:"resource_type"`
		ResourceID   string `json:"resource_id"`
		AnchorType   string `json:"anchor_type"`
		Anchor       string `json:"anchor"` // 已是 JSON 字符串（前端 JSON.stringify）
		Comment      string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.ResourceType == "" || body.ResourceID == "" || body.Comment == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "resource_type/resource_id/comment 必填"})
		return
	}
	if body.AnchorType == "" {
		body.AnchorType = "text"
	}
	if body.Anchor == "" {
		body.Anchor = "{}"
	}
	ann := model.Annotation{
		SchoolID: schoolID, UserID: userID,
		ResourceType: body.ResourceType, ResourceID: body.ResourceID,
		AnchorType: body.AnchorType, Anchor: body.Anchor, Comment: body.Comment,
	}
	if err := h.db.Create(&ann).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"item": ann})
}

func (h *AnnotationHandler) DeleteAnnotation(c *gin.Context) {
	schoolID, userID := h.ids(c)
	res := h.db.Where("id = ? AND school_id = ? AND user_id = ?", c.Param("id"), schoolID, userID).Delete(&model.Annotation{})
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": res.Error.Error()})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "批注不存在或无权限"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ── 版本快照 ──

func (h *AnnotationHandler) ListVersions(c *gin.Context) {
	schoolID, _ := h.ids(c)
	rt, rid := c.Query("resource_type"), c.Query("resource_id")
	if rt == "" || rid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "resource_type 与 resource_id 必填"})
		return
	}
	var items []model.Version
	if err := h.db.Where("school_id = ? AND resource_type = ? AND resource_id = ?", schoolID, rt, rid).
		Order("created_at DESC").Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *AnnotationHandler) CreateVersion(c *gin.Context) {
	schoolID, userID := h.ids(c)
	var body struct {
		ResourceType string `json:"resource_type"`
		ResourceID   string `json:"resource_id"`
		Label        string `json:"label"`
		Payload      string `json:"payload"` // 已是 JSON 字符串
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.ResourceType == "" || body.ResourceID == "" || body.Payload == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "resource_type/resource_id/payload 必填"})
		return
	}
	// 仅草稿期可存版本：发布(active)后禁止再存快照
	st := h.resourceStatus(body.ResourceType, body.ResourceID, schoolID)
	if st == "active" || st == "published" {
		c.JSON(http.StatusForbidden, gin.H{"error": "已发布定版，不可再存版本快照"})
		return
	}
	ver := model.Version{
		SchoolID: schoolID, UserID: userID,
		ResourceType: body.ResourceType, ResourceID: body.ResourceID,
		Label: body.Label, Payload: body.Payload,
	}
	if err := h.db.Create(&ver).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"item": ver})
}

// RestoreVersion 返回快照 payload，由前端写回作品。仅草稿期允许：发布(active)后禁止恢复。
func (h *AnnotationHandler) RestoreVersion(c *gin.Context) {
	schoolID, _ := h.ids(c)
	var ver model.Version
	if err := h.db.Where("id = ? AND school_id = ?", c.Param("id"), schoolID).First(&ver).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "版本不存在"})
		return
	}
	st := h.resourceStatus(ver.ResourceType, ver.ResourceID, schoolID)
	if st == "active" || st == "published" {
		c.JSON(http.StatusForbidden, gin.H{"error": "已发布定版，不可回退版本"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"item": ver})
}

// resourceStatus 按 resource_type 查作品的 status 列（materials/lesson_plans/exams/exercise_sheets/sheets）。
// 查不到返回空串（视为草稿，不阻断）。
func (h *AnnotationHandler) resourceStatus(rt, rid, schoolID string) string {
	table := map[string]string{
		"courseware":     "materials",
		"material":       "materials",
		"lesson_plan":    "lesson_plans",
		"exam":           "exams",
		"exercise_sheet": "exercise_sheets",
		"sheet":          "sheets",
		"question":       "questions",
	}[rt]
	if table == "" {
		return ""
	}
	var st string
	h.db.Table(table).Select("status").Where("id = ? AND school_id = ?", rid, schoolID).Scan(&st)
	return st
}
