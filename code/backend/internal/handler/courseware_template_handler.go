package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"
)

// CoursewareTemplateHandler 课件模板管理（PPT/H5 共用）。
type CoursewareTemplateHandler struct {
	repo *repository.CoursewareTemplateRepository
}

func NewCoursewareTemplateHandler(repo *repository.CoursewareTemplateRepository) *CoursewareTemplateHandler {
	return &CoursewareTemplateHandler{repo: repo}
}

// List 按条件列出模板（公开，供前端套模板/智能选模板拉取）。
// query: kind(ppt|h5)  style(subject=grade= 可多次) 至多按单维度过滤。
func (h *CoursewareTemplateHandler) List(c *gin.Context) {
	f := repository.TplFilter{
		Kind:     c.Query("kind"),
		Styles:   c.QueryArray("style"),
		Subjects: c.QueryArray("subject"),
		Grades:   c.QueryArray("grade"),
	}
	items, err := h.repo.List(c.Request.Context(), f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

// Create 运营新增模板（platform_devops 鉴权）。
func (h *CoursewareTemplateHandler) Create(c *gin.Context) {
	var t model.CoursewareTemplate
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	t.IsBuiltin = false
	if err := h.repo.Upsert(c.Request.Context(), &t); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, t)
}

// Update 运营更新模板（platform_devops 鉴权）。
func (h *CoursewareTemplateHandler) Update(c *gin.Context) {
	id := c.Param("id")
	existing, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "模板不存在"})
		return
	}
	var t model.CoursewareTemplate
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	t.ID = id
	t.IsBuiltin = existing.IsBuiltin
	if err := h.repo.Upsert(c.Request.Context(), &t); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, t)
}

// Delete 运营下架模板（platform_devops 鉴权）。
func (h *CoursewareTemplateHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted", "id": id})
}
