package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/model"
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

// UpsertTextbook 保存学校自用教材覆盖层（仅本校生效，不影响公共库 tb_textbook_version）
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
	c.JSON(http.StatusOK, gin.H{"message": "本校教材覆盖已保存", "count": len(req.Rows)})
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

// ── V2.5 教材版本三级配置 ──

// ListTextbookConfigs GET /admin/textbook-configs
func (h *ITHandler) ListTextbookConfigs(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	cfgs, err := h.repo.ListTextbookConfigs(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取教材配置失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": cfgs})
}

// UpsertTextbookConfig POST /admin/textbook-configs
func (h *ITHandler) UpsertTextbookConfig(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	var req struct {
		ConfigType  string  `json:"config_type" binding:"required"` // school / grade_subject / class_subject
		Subject     string  `json:"subject" binding:"required"`
		Grade       string  `json:"grade"`
		ClassID     *string `json:"class_id"`
		Publisher   string  `json:"publisher" binding:"required"`
		VersionName string  `json:"version_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "config_type/subject/publisher/version_name 必填"})
		return
	}
	if req.ConfigType != string(model.ConfigTypeSchool) &&
		req.ConfigType != string(model.ConfigTypeGradeSubject) &&
		req.ConfigType != string(model.ConfigTypeClassSubject) {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_CONFIG_TYPE", "message": "config_type 须为 school/grade_subject/class_subject"})
		return
	}
	cfg := &model.TextbookConfig{
		SchoolID:    schoolIDStr,
		ConfigType:  model.TextbookConfigType(req.ConfigType),
		Subject:     req.Subject,
		Grade:       req.Grade,
		ClassID:     req.ClassID,
		Publisher:   req.Publisher,
		VersionName: req.VersionName,
	}
	if err := h.repo.UpsertTextbookConfig(cfg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPSERT_FAILED", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "教材配置已保存"})
}

// DeleteTextbookConfig DELETE /admin/textbook-configs/:id
func (h *ITHandler) DeleteTextbookConfig(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	id := c.Param("id")
	if err := h.repo.DeleteTextbookConfig(schoolIDStr, id); err != nil {
		if err.Error() == "config not found" {
			c.JSON(http.StatusNotFound, gin.H{"code": "CONFIG_NOT_FOUND", "message": "配置不存在或已删除"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DELETE_FAILED", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "配置已删除"})
}

// ResolveTextbookConfig GET /admin/textbook-configs/resolve?subject=&grade=&class_id=
func (h *ITHandler) ResolveTextbookConfig(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	subject := c.Query("subject")
	grade := c.Query("grade")
	classIDParam := c.Query("class_id")
	if subject == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "subject 必填"})
		return
	}
	var classID *string
	if classIDParam != "" {
		classID = &classIDParam
	}
	res, err := h.repo.ResolveTextbookConfig(schoolIDStr, subject, grade, classID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "RESOLVE_FAILED", "message": err.Error()})
		return
	}
	if res == nil {
		c.JSON(http.StatusOK, gin.H{"resolved": nil, "configured": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"resolved": res, "configured": true})
}

// ── V2.5/2.6 教师个人教材偏好（per-user，跨设备同步，规格书 §5.1）──

// ListTeacherTextbookPrefs GET /me/textbook-prefs
func (h *ITHandler) ListTeacherTextbookPrefs(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	prefs, err := h.repo.ListTeacherTextbookPrefs(teacherIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取个人教材偏好失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": prefs})
}

// UpsertTeacherTextbookPref POST /me/textbook-prefs
func (h *ITHandler) UpsertTeacherTextbookPref(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	var req struct {
		Subject     string `json:"subject" binding:"required"`
		Grade       string `json:"grade"`
		ClassID     string `json:"class_id"`
		Publisher   string `json:"publisher" binding:"required"`
		VersionName string `json:"version_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "subject/publisher/version_name 必填"})
		return
	}
	if err := h.repo.UpsertTeacherTextbookPref(teacherIDStr, schoolIDStr, req.Grade, req.ClassID, req.Subject, req.Publisher, req.VersionName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPSERT_FAILED", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "个人教材偏好已保存"})
}

// DeleteTeacherTextbookPref DELETE /me/textbook-prefs?subject=&grade=&class_id=
func (h *ITHandler) DeleteTeacherTextbookPref(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	subject := c.Query("subject")
	grade := c.Query("grade")
	classID := c.Query("class_id")
	if subject == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "subject 必填"})
		return
	}
	if err := h.repo.DeleteTeacherTextbookPref(teacherIDStr, grade, classID, subject); err != nil {
		if err.Error() == "pref not found" {
			c.JSON(http.StatusNotFound, gin.H{"code": "PREF_NOT_FOUND", "message": "偏好不存在或已删除"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DELETE_FAILED", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "个人教材偏好已删除"})
}

// ── V2.6 全学科教材版本库维护（IT 管理员，数据团队数据导入/维护）──

// ListTextbookVersionLibrary GET /admin/textbook-versions（原始版本库）
func (h *ITHandler) ListTextbookVersionLibrary(c *gin.Context) {
	vs, err := h.repo.ListRawTextbookVersions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取教材版本库失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": vs})
}

// CreateTextbookVersion POST /admin/textbook-versions
func (h *ITHandler) CreateTextbookVersion(c *gin.Context) {
	var v model.TextbookVersion
	if err := c.ShouldBindJSON(&v); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "字段格式错误"})
		return
	}
	if v.VersionKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "version_key 必填"})
		return
	}
	if err := h.repo.UpsertTextbookVersion(&v); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPSERT_FAILED", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "教材版本已保存", "version_key": v.VersionKey})
}

// UpdateTextbookVersion PUT /admin/textbook-versions/:id
func (h *ITHandler) UpdateTextbookVersion(c *gin.Context) {
	id := c.Param("id")
	id64, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_ID", "message": "id 非法"})
		return
	}
	var v model.TextbookVersion
	if err := c.ShouldBindJSON(&v); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "字段格式错误"})
		return
	}
	if err := h.repo.UpdateTextbookVersion(id64, &v); err != nil {
		if err.Error() == "version not found" {
			c.JSON(http.StatusNotFound, gin.H{"code": "VERSION_NOT_FOUND", "message": "版本不存在或已删除"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPDATE_FAILED", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "教材版本已更新"})
}

// DeleteTextbookVersion DELETE /admin/textbook-versions/:id
func (h *ITHandler) DeleteTextbookVersion(c *gin.Context) {
	id := c.Param("id")
	id64, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_ID", "message": "id 非法"})
		return
	}
	if err := h.repo.DeleteTextbookVersion(id64); err != nil {
		if err.Error() == "version not found" {
			c.JSON(http.StatusNotFound, gin.H{"code": "VERSION_NOT_FOUND", "message": "版本不存在或已删除"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DELETE_FAILED", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "教材版本已删除"})
}

// ImportTextbookVersions POST /admin/textbook-versions/import
func (h *ITHandler) ImportTextbookVersions(c *gin.Context) {
	var req struct {
		Rows []model.TextbookVersion `json:"rows" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "rows 不能为空"})
		return
	}
	for i, row := range req.Rows {
		if row.VersionKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": fmt.Sprintf("第 %d 条缺少 version_key", i+1)})
			return
		}
	}
	n, err := h.repo.ImportTextbookVersions(req.Rows)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "IMPORT_FAILED", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "教材版本库已导入", "count": n})
}

// ── V2.6 教师有效教材版本解析 ──

// ResolveEffectiveTextbook GET /me/textbook-effective?subject=&grade=&class_id=
func (h *ITHandler) ResolveEffectiveTextbook(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	subject := c.Query("subject")
	grade := c.Query("grade")
	classIDParam := c.Query("class_id")
	if subject == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "subject 必填"})
		return
	}
	var classID *string
	if classIDParam != "" {
		classID = &classIDParam
	}
	res, src, err := h.repo.ResolveEffectiveTextbook(teacherIDStr, schoolIDStr, subject, grade, classID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "RESOLVE_FAILED", "message": err.Error()})
		return
	}
	if res == nil {
		c.JSON(http.StatusOK, gin.H{"resolved": nil, "configured": false, "source": "none"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"resolved": res, "configured": true, "source": src})
}
