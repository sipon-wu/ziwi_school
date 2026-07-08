package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/repository"
)

type ITHandler struct {
	repo     *repository.ITRepository
	deanRepo *repository.DeanRepository
}

func NewITHandler(repo *repository.ITRepository, deanRepo *repository.DeanRepository) *ITHandler {
	return &ITHandler{repo: repo, deanRepo: deanRepo}
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

// UpdateUserRole 单用户改角色（角色分配/一键初始化）
// PUT /api/admin/users/:id/role
func (h *ITHandler) UpdateUserRole(c *gin.Context) {
	id := c.Param("id")
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "缺少 role 字段"})
		return
	}
	if err := h.repo.UpdateUserRole(schoolIDStr, id, req.Role); err != nil {
		if err.Error() == "user not found" {
			c.JSON(http.StatusNotFound, gin.H{"code": "USER_NOT_FOUND", "message": "用户不存在或不在本校"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"code": "UPDATE_FAILED", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "角色已更新", "role": req.Role})
}

// UpsertTextbook 教材版本学校级覆盖（批量 upsert）
// PUT /api/admin/textbooks  body: { "rows": [ {subject, grade, publisher, version_name}, ... ] }
func (h *ITHandler) UpsertTextbook(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	var req struct {
		Rows []struct {
			Subject     string `json:"subject" binding:"required"`
			Grade       string `json:"grade"`
			Publisher   string `json:"publisher" binding:"required"`
			VersionName string `json:"version_name" binding:"required"`
		} `json:"rows" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "rows 不能为空且每行的 subject/publisher/version_name 必填"})
		return
	}
	for _, row := range req.Rows {
		if err := h.repo.UpsertSchoolTextbook(schoolIDStr, row.Subject, row.Grade, row.Publisher, row.VersionName); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": "UPSERT_FAILED", "message": err.Error()})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "教材版本已保存", "count": len(req.Rows)})
}

// ListSemesters 学期列表（复用教务仓储，供 IT 初始化学期配置）
// GET /api/admin/semesters
func (h *ITHandler) ListSemesters(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	semesters, err := h.deanRepo.ListSemesters(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取学期列表失败"})
		return
	}
	if semesters == nil {
		semesters = []repository.Semester{}
	}
	c.JSON(http.StatusOK, gin.H{"items": semesters})
}

// CreateSemester 创建学期（复用教务仓储）
// POST /api/admin/semesters
func (h *ITHandler) CreateSemester(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	var req struct {
		Name      string `json:"name" binding:"required"`
		StartDate string `json:"start_date" binding:"required"`
		EndDate   string `json:"end_date" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请填写学期名称与起止日期"})
		return
	}
	startDate, _ := time.Parse("2006-01-02", req.StartDate)
	endDate, _ := time.Parse("2006-01-02", req.EndDate)
	s := &repository.Semester{
		SchoolID:  schoolIDStr,
		Name:      req.Name,
		StartDate: startDate,
		EndDate:   endDate,
		CreatedAt: time.Now(),
	}
	if err := h.deanRepo.CreateSemester(s); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "CREATE_FAILED", "message": "创建学期失败"})
		return
	}
	c.JSON(http.StatusCreated, s)
}
