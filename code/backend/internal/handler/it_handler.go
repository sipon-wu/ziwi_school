package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/repository"
)

type ITHandler struct {
	repo *repository.ITRepository
}

func NewITHandler(repo *repository.ITRepository) *ITHandler {
	return &ITHandler{repo: repo}
}

// ListUsers 用户列表
// GET /api/admin/users
func (h *ITHandler) ListUsers(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	users, err := h.repo.ListAllUsers(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取用户列表失败"})
		return
	}
	if users == nil {
		users = []repository.ITUser{}
	}
	c.JSON(http.StatusOK, gin.H{"items": users})
}

// ListContacts 通讯录
// GET /api/admin/contacts
func (h *ITHandler) ListContacts(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	contacts, err := h.repo.ListContacts(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取通讯录失败"})
		return
	}
	if contacts == nil {
		contacts = []repository.Contact{}
	}
	c.JSON(http.StatusOK, gin.H{"items": contacts})
}

// ListTextbookVersions 教材版本
// GET /api/admin/textbooks
func (h *ITHandler) ListTextbookVersions(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	versions, err := h.repo.ListTextbookVersions(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取教材版本失败"})
		return
	}
	if versions == nil {
		versions = []repository.TextbookVersionView{}
	}
	c.JSON(http.StatusOK, gin.H{"items": versions})
}
