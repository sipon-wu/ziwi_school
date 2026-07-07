package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/repository"
)

type ResearchHandler struct {
	repo *repository.ResearchRepository
}

func NewResearchHandler(repo *repository.ResearchRepository) *ResearchHandler {
	return &ResearchHandler{repo: repo}
}

// ListReviews 互审池
func (h *ResearchHandler) ListReviews(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	items, err := h.repo.ListReviews(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取失败"})
		return
	}
	if items == nil { items = []repository.ReviewItem{} }
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// GetDashboard 教研数据
func (h *ResearchHandler) GetDashboard(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	stats, err := h.repo.GetResearchStats(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取失败"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// ListMethodologies 方法论列表
func (h *ResearchHandler) ListMethodologies(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	items, err := h.repo.ListMethodologies(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取失败"})
		return
	}
	if items == nil { items = []repository.Methodology{} }
	c.JSON(http.StatusOK, gin.H{"items": items})
}
