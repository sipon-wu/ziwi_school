package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/repository"
)

type OpsHandler struct {
	repo *repository.OpsRepository
}

func NewOpsHandler(repo *repository.OpsRepository) *OpsHandler {
	return &OpsHandler{repo: repo}
}

// ── Token管理 ──
func (h *OpsHandler) ListTokenUsage(c *gin.Context) {
	items, err := h.repo.ListTokenUsage()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取失败"})
		return
	}
	if items == nil { items = []repository.TokenUsageView{} }
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// ── License管理 ──
func (h *OpsHandler) ListLicenses(c *gin.Context) {
	items, err := h.repo.ListLicenses()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取失败"})
		return
	}
	if items == nil { items = []repository.LicenseView{} }
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// ── 公告管理 ──
func (h *OpsHandler) ListAnnouncements(c *gin.Context) {
	items, err := h.repo.ListAnnouncements()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取失败"})
		return
	}
	if items == nil { items = []repository.Announcement{} }
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *OpsHandler) CreateAnnouncement(c *gin.Context) {
	var req struct {
		Title   string `json:"title" binding:"required"`
		Content string `json:"content"`
		IsPinned bool  `json:"is_pinned"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请填写标题"})
		return
	}
	a := &repository.Announcement{
		Title: req.Title, Content: req.Content, IsPinned: req.IsPinned,
		Status: "published", CreatedAt: time.Now(),
	}
	if err := h.repo.CreateAnnouncement(a); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "CREATE_FAILED", "message": "创建失败"})
		return
	}
	c.JSON(http.StatusCreated, a)
}

// ── 教材审核（占位） ──
func (h *OpsHandler) ListContentAudit(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"items": []interface{}{}})
}

// ── 财务对账 ──
func (h *OpsHandler) GetFinanceSummary(c *gin.Context) {
	s, err := h.repo.GetFinanceSummary()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取失败"})
		return
	}
	c.JSON(http.StatusOK, s)
}

// ── 发票管理 ──
func (h *OpsHandler) ListInvoices(c *gin.Context) {
	items, err := h.repo.ListInvoices()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取失败"})
		return
	}
	if items == nil { items = []repository.Invoice{} }
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// ── 客服工单 ──
func (h *OpsHandler) ListSupportTickets(c *gin.Context) {
	items, err := h.repo.ListSupportTickets()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取失败"})
		return
	}
	if items == nil { items = []repository.SupportTicket{} }
	c.JSON(http.StatusOK, gin.H{"items": items})
}
