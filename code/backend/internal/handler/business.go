package handler

import (
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"
)

// ── 教案 Handler ──

type LessonPlanHandler struct {
	repo *repository.LessonPlanRepo
}

func NewLessonPlanHandler(repo *repository.LessonPlanRepo) *LessonPlanHandler {
	return &LessonPlanHandler{repo: repo}
}

func (h *LessonPlanHandler) List(c *gin.Context) {
	teacherID := c.GetString("user_id")
	schoolID := c.GetString("school_id")
	limit := 20
	offset := 0

	plans, total, err := h.repo.ListByTeacher(teacherID, schoolID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"获取教案列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":plans,"total":total})
}

func (h *LessonPlanHandler) Create(c *gin.Context) {
	var req struct {
		Subject             string `json:"subject"`
		Grade               string `json:"grade"`
		LessonTitle         string `json:"lesson_title"`
		TextbookUnit        string `json:"textbook_unit,omitempty"`
		Period              int    `json:"period"`
		Content             string `json:"content"`
		FormatTemplate      string `json:"format_template,omitempty"`
		CurriculumAlignments string `json:"curriculum_alignments,omitempty"`
		KnowledgeNodeIDs    string `json:"knowledge_node_ids,omitempty"`
		AIGenerated         bool   `json:"ai_generated"`
		AIModelVersion      string `json:"ai_model_version,omitempty"`
		GenerationTimeMs    *int   `json:"generation_time_ms,omitempty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"参数错误","detail":err.Error()})
		return
	}

	teacherID, _ := uuid.Parse(c.GetString("user_id"))
	schoolID, _ := uuid.Parse(c.GetString("school_id"))

	if req.FormatTemplate == "" { req.FormatTemplate = "core_literacy" }
	if req.Period == 0 { req.Period = 1 }
	content := req.Content
	if content == "" { content = "{}" }
	curriculum := req.CurriculumAlignments
	if curriculum == "" { curriculum = "[]" }
	knowledgeNodeIDs := req.KnowledgeNodeIDs
	if knowledgeNodeIDs == "" { knowledgeNodeIDs = "[]" }

	plan := &model.LessonPlan{
		TeacherID:           teacherID,
		SchoolID:            schoolID,
		Subject:             req.Subject,
		Grade:               req.Grade,
		LessonTitle:         req.LessonTitle,
		TextbookUnit:        req.TextbookUnit,
		Period:              req.Period,
		Content:             content,
		FormatTemplate:      req.FormatTemplate,
		CurriculumAlignments: curriculum,
		KnowledgeNodeIDs:    knowledgeNodeIDs,
		AIGenerated:         req.AIGenerated,
		AIModelVersion:      req.AIModelVersion,
		Status:              "draft",
	}
	if req.GenerationTimeMs != nil {
		plan.GenerationTimeMs = req.GenerationTimeMs
	}

	if err := h.repo.Create(plan); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"创建教案失败","detail":err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message":"教案创建成功","id":plan.ID.String()})
}

func (h *LessonPlanHandler) Get(c *gin.Context) {
	plan, err := h.repo.FindByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code":404,"message":"教案不存在"})
		return
	}
	c.JSON(http.StatusOK, plan)
}

func (h *LessonPlanHandler) Update(c *gin.Context) {
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"参数错误"})
		return
	}
	// 防止篡改不可修改字段
	delete(updates, "id")
	delete(updates, "teacher_id")
	delete(updates, "school_id")
	delete(updates, "created_at")

	if err := h.repo.Update(c.Param("id"), updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"更新教案失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message":"教案已更新"})
}

func (h *LessonPlanHandler) Finalize(c *gin.Context) {
	if err := h.repo.Update(c.Param("id"), map[string]interface{}{"status":"final","review_status":"pending"}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"定稿失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message":"已定稿，进入互审队列"})
}

func (h *LessonPlanHandler) Delete(c *gin.Context) {
	if err := h.repo.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"删除失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message":"教案已删除"})
}


// ── Assignment Handler ──

type AssignmentHandler struct {
	repo        *repository.AssignmentRepo
	questionRepo *repository.QuestionRepo
}

func NewAssignmentHandler(repo *repository.AssignmentRepo, questionRepo *repository.QuestionRepo) *AssignmentHandler {
	return &AssignmentHandler{repo: repo, questionRepo: questionRepo}
}

func (h *AssignmentHandler) List(c *gin.Context) {
	teacherID := c.GetString("user_id")
	items, total, err := h.repo.ListByTeacher(teacherID, 20, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"获取作业列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":items,"total":total})
}

func (h *AssignmentHandler) Create(c *gin.Context) {
	var req struct {
		ClassID          string   `json:"class_id"`
		Subject          string   `json:"subject"`
		Title            string   `json:"title"`
		Type             string   `json:"type"`
		Questions        string   `json:"questions"`          // 兼容旧版 JSONB
		QuestionIDs      []string `json:"question_ids"`       // 新版：题目ID列表
		DifficultyLevel  string   `json:"difficulty_level"`
		KnowledgeNodeIDs string   `json:"knowledge_node_ids,omitempty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"参数错误"})
		return
	}
	teacherID, _ := uuid.Parse(c.GetString("user_id"))
	schoolID, _ := uuid.Parse(c.GetString("school_id"))
	classID, _ := uuid.Parse(req.ClassID)

	if req.DifficultyLevel == "" { req.DifficultyLevel = "L2" }

	knowledgeNodeIDs := req.KnowledgeNodeIDs
	if knowledgeNodeIDs == "" { knowledgeNodeIDs = "[]" }

	questionsJSON := req.Questions

	// 新版：从题目ID列表构建 questions JSONB 并做查重
	if len(req.QuestionIDs) > 0 && questionsJSON == "" {
		// 查重
		if h.questionRepo != nil {
			dupes, _ := h.questionRepo.CheckDuplicateByClass(req.ClassID, req.QuestionIDs)
			if len(dupes) > 0 {
				c.JSON(http.StatusConflict, gin.H{
					"code":       409,
					"message":    "部分题目已在该班级布置过",
					"duplicates": dupes,
				})
				return
			}
		}
		// 构建兼容的 questions JSONB
		questions := make([]map[string]interface{}, 0)
		for _, qid := range req.QuestionIDs {
			if h.questionRepo != nil {
				q, err := h.questionRepo.FindByID(qid)
				if err == nil {
					questions = append(questions, map[string]interface{}{
						"content":     q.Content,
						"type":        q.Type,
						"question_id": q.ID.String(),
						"difficulty":  q.Difficulty,
						"answer":      q.Answer,
						"options":     q.Options,
					})
				}
			}
		}
		b, _ := json.Marshal(questions)
		questionsJSON = string(b)
	}

	if questionsJSON == "" { questionsJSON = "[]" }

	assignment := &model.Assignment{
		TeacherID:        teacherID,
		ClassID:          classID,
		SchoolID:         schoolID,
		Subject:          req.Subject,
		Title:            req.Title,
		Type:             req.Type,
		Questions:        questionsJSON,
		DifficultyLevel:  req.DifficultyLevel,
		KnowledgeNodeIDs: knowledgeNodeIDs,
	}
	if err := h.repo.Create(assignment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"创建作业失败"})
		return
	}

	// 新版：创建作业-题目关联
	if len(req.QuestionIDs) > 0 && h.questionRepo != nil {
		if err := h.questionRepo.LinkAssignmentQuestions(assignment.ID.String(), req.QuestionIDs, nil); err != nil {
			// 非致命，记录日志
			fmt.Printf("[WARN] link assignment questions failed: %v\n", err)
		}
	}

	c.JSON(http.StatusCreated, gin.H{"message":"作业已发布","id":assignment.ID.String(),"question_count":len(req.QuestionIDs)})
}


// ── Submission Handler ──

type SubmissionHandler struct {
	repo *repository.SubmissionRepo
}

func NewSubmissionHandler(repo *repository.SubmissionRepo) *SubmissionHandler {
	return &SubmissionHandler{repo: repo}
}

func (h *SubmissionHandler) Submit(c *gin.Context) {
	var req struct {
		AssignmentID string `json:"assignment_id"`
		Answers      string `json:"answers"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"参数错误"})
		return
	}
	studentID, _ := uuid.Parse(c.GetString("user_id"))
	assignmentID, _ := uuid.Parse(req.AssignmentID)

	sub := &model.Submission{
		AssignmentID: assignmentID,
		StudentID:    studentID,
		Answers:      req.Answers,
	}
	if err := h.repo.Create(sub); err != nil {
		c.JSON(http.StatusConflict, gin.H{"code":409,"message":"已经提交过"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message":"提交成功","id":sub.ID.String()})
}


// ── Parent Sign Handler ──

type ParentSignHandler struct {
	repo *repository.ParentSignRepo
}

func NewParentSignHandler(repo *repository.ParentSignRepo) *ParentSignHandler {
	return &ParentSignHandler{repo: repo}
}

func (h *ParentSignHandler) List(c *gin.Context) {
	parentID := c.GetString("user_id")
	signatures, err := h.repo.ListByParent(parentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"获取签字列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":signatures})
}

// ── Grading Handler ──

type GradingHandler struct {
	repo *repository.GradingRepo
}

func NewGradingHandler(repo *repository.GradingRepo) *GradingHandler {
	return &GradingHandler{repo: repo}
}

func (h *GradingHandler) List(c *gin.Context) {
	teacherID := c.GetString("user_id")
	items, err := h.repo.ListByTeacher(teacherID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"获取批阅列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":items})
}

func (h *GradingHandler) Detail(c *gin.Context) {
	data, err := h.repo.GetDetail(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code":404,"message":"批阅记录不存在"})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *GradingHandler) Confirm(c *gin.Context) {
	if err := h.repo.Confirm(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"确认失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message":"批阅已确认"})
}

func (h *GradingHandler) AdjustScore(c *gin.Context) {
	var req struct {
		TeacherScore float64 `json:"teacher_score"`
		Comment      string  `json:"comment"`
	}
	c.ShouldBindJSON(&req)
	if err := h.repo.AdjustScore(c.Param("id"), req.TeacherScore, req.Comment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"调整分数失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message":"分数已调整"})
}

func (h *GradingHandler) BatchConfirm(c *gin.Context) {
	var req struct {
		AssignmentID string `json:"assignment_id"`
	}
	c.ShouldBindJSON(&req)
	teacherID := c.GetString("user_id")
	if err := h.repo.BatchConfirm(teacherID, req.AssignmentID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"批量确认失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message":"批量确认完成"})
}


// ── Composition Upload Handler ──

type CompositionHandler struct {
	repo *repository.SubmissionRepo
}

func NewCompositionHandler(repo *repository.SubmissionRepo) *CompositionHandler {
	return &CompositionHandler{repo: repo}
}

// ── Student Handler ──

type StudentHandler struct {
	repo *repository.StudentRepo
}

func NewStudentHandler(repo *repository.StudentRepo) *StudentHandler {
	return &StudentHandler{repo: repo}
}

func (h *StudentHandler) ListAssignments(c *gin.Context) {
	studentID := c.GetString("user_id")
	items, err := h.repo.ListAssignments(studentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"获取作业列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":items})
}

func (h *StudentHandler) GetGrading(c *gin.Context) {
	studentID := c.GetString("user_id")
	data, err := h.repo.GetGradingDetail(c.Param("id"), studentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code":404,"message":"批阅记录不存在"})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *StudentHandler) GetErrorBook(c *gin.Context) {
	studentID := c.GetString("user_id")
	items, err := h.repo.GetErrorBook(studentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"获取错题本失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":items})
}


// ── Parent Handler ──

type ParentHandler struct {
	repo *repository.ParentRepo
}

func NewParentHandler(repo *repository.ParentRepo) *ParentHandler {
	return &ParentHandler{repo: repo}
}

func (h *ParentHandler) ListAssignments(c *gin.Context) {
	parentID := c.GetString("user_id")
	items, err := h.repo.ListChildAssignments(parentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"获取作业列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":items})
}

func (h *ParentHandler) GetSignature(c *gin.Context) {
	data, err := h.repo.GetSignatureDetail(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code":404,"message":"签字记录不存在"})
		return
	}
	c.JSON(http.StatusOK, data)
}


func (h *CompositionHandler) Submit(c *gin.Context) {
	var req struct {
		AssignmentID string `json:"assignment_id"`
		Content      string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"参数错误"})
		return
	}
	studentID, _ := uuid.Parse(c.GetString("user_id"))
	assignmentID, _ := uuid.Parse(req.AssignmentID)

	answers, _ := json.Marshal([]map[string]interface{}{{"type":"composition","content":req.Content}})

	sub := &model.Submission{
		AssignmentID: assignmentID,
		StudentID:    studentID,
		Answers:      string(answers),
	}
	if err := h.repo.Create(sub); err != nil {
		c.JSON(http.StatusConflict, gin.H{"code":409,"message":"已提交过"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message":"作文已提交","id":sub.ID})
}

// ── License Handler ──

type LicenseHandler struct {
	repo *repository.LicenseRepo
}

func NewLicenseHandler(repo *repository.LicenseRepo) *LicenseHandler {
	return &LicenseHandler{repo: repo}
}

func (h *LicenseHandler) ListSchools(c *gin.Context) {
	items, err := h.repo.ListSchools()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"获取学校列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":items})
}

func (h *LicenseHandler) GetHeartbeats(c *gin.Context) {
	items, err := h.repo.GetHeartbeats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":items})
}

// ── Trial Handler ──

type TrialHandler struct {
	repo *repository.TrialRepo
}

func NewTrialHandler(repo *repository.TrialRepo) *TrialHandler {
	return &TrialHandler{repo: repo}
}

func (h *TrialHandler) GetConfig(c *gin.Context) {
	cfg, err := h.repo.GetConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"获取试用配置失败"})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *TrialHandler) UpdateConfig(c *gin.Context) {
	var req struct {
		Enabled    bool  `json:"enabled"`
		TrialDays  int   `json:"trial_days"`
		TokenQuota int64 `json:"token_quota"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"参数错误"})
		return
	}
	if err := h.repo.UpdateConfig(req.Enabled, req.TrialDays, req.TokenQuota); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"更新失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message":"试用配置已更新"})
}

func (h *TrialHandler) ListTeachers(c *gin.Context) {
	items, err := h.repo.ListTeachers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500})
		return
	}
	for i := range items { items[i].Name = html.EscapeString(items[i].Name) }
	c.JSON(http.StatusOK, gin.H{"items":items})
}

// ── Admin Handler ──

type AdminHandler struct {
	repo *repository.AdminRepo
}

func NewAdminHandler(repo *repository.AdminRepo) *AdminHandler {
	return &AdminHandler{repo: repo}
}

func (h *AdminHandler) ListUsers(c *gin.Context) {
	role := c.Query("role")
	items, total, err := h.repo.ListUsers(role, "", 50, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500})
		return
	}
	for i := range items { items[i].Name = html.EscapeString(items[i].Name) }
	c.JSON(http.StatusOK, gin.H{"items":items,"total":total})
}

func (h *AdminHandler) BlockUser(c *gin.Context) {
	if err := h.repo.BlockUser(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message":"用户已封禁"})
}

func (h *AdminHandler) UnblockUser(c *gin.Context) {
	var req struct{ Role string `json:"role"` }
	c.ShouldBindJSON(&req)
	if err := h.repo.UnblockUser(c.Param("id"), req.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message":"用户已解封"})
}

func (h *AdminHandler) GetHealth(c *gin.Context) {
	data, err := h.repo.GetHealth()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *AdminHandler) ListAnnouncements(c *gin.Context) {
	items, err := h.repo.ListAnnouncements()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":items})
}

func (h *AdminHandler) CreateAnnouncement(c *gin.Context) {
	var req struct{
		Title      string `json:"title"`
		Content    string `json:"content"`
		TargetRole string `json:"target_role"`
		Pinned     bool   `json:"pinned"`
	}
	c.ShouldBindJSON(&req)
	if err := h.repo.CreateAnnouncement(req.Title, req.Content, req.TargetRole, req.Pinned); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message":"公告已发布"})
}

// ── Token Handler ──

type TokenHandler struct {
	repo *repository.TokenRepo
}

func NewTokenHandler(repo *repository.TokenRepo) *TokenHandler {
	return &TokenHandler{repo: repo}
}

func (h *TokenHandler) GetSummary(c *gin.Context) {
	schoolID := c.Query("school_id")
	data, err := h.repo.GetSummary(schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *TokenHandler) GetTrend(c *gin.Context) {
	schoolID := c.Query("school_id")
	days := 30
	if d := c.Query("days"); d != "" { fmt.Sscanf(d, "%d", &days) }
	items, err := h.repo.GetTrend(days, schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":items})
}

func (h *TokenHandler) GetTenantRanking(c *gin.Context) {
	items, err := h.repo.GetTenantRanking()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":items})
}

// GetMyQuota 教师查看自己的配额消耗
func (h *TokenHandler) GetMyQuota(c *gin.Context) {
	teacherID := c.GetString("user_id")
	// 从 service 层获取配额详情
	var user model.User
	if err := h.repo.GetUserQuota(teacherID, &user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"获取配额失败"})
		return
	}

	// 计算有效配额
	quota := user.TokenQuotaMonthly
	if !user.TokenQuotaCustom && user.School != nil {
		quota = user.School.DefaultTokenQuota
	}

	type apiBreakdown struct {
		APIType string `json:"api_type"`
		Tokens  int64  `json:"tokens"`
	}
	var breakdown []apiBreakdown
	h.repo.GetQuotaBreakdown(teacherID, &breakdown)

	used := user.TokenUsedMonthly
	usagePct := 0.0
	if quota > 0 {
		usagePct = float64(used) / float64(quota) * 100
	}

	level := "normal"
	if quota > 0 {
		if used >= quota {
			level = "blocked"
		} else if usagePct >= 90 {
			level = "danger"
		} else if usagePct >= 80 {
			level = "warning"
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"data": gin.H{
			"quota_monthly": quota,
			"used_monthly":  used,
			"remaining":     quota - used,
			"usage_pct":     usagePct,
			"level":         level,
			"breakdown":     breakdown,
			"quota_custom":  user.TokenQuotaCustom,
		},
	})
}

// ListTeachers 获取学校教师列表（含配额信息，校管理端用）
func (h *TokenHandler) ListTeachers(c *gin.Context) {
	schoolID := c.GetString("school_id")
	// 复用 repository 的方法
	var users []model.User
	if err := h.repo.ListTeachersForQuota(schoolID, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"获取教师列表失败"})
		return
	}

	type teacherItem struct {
		ID                 string `json:"id"`
		Name               string `json:"name"`
		Phone              string `json:"phone"`
		Subject            string `json:"subject"`
		TokenQuotaMonthly  int64  `json:"token_quota_monthly"`
		TokenQuotaCustom   bool   `json:"token_quota_custom"`
		TokenUsedMonthly   int64  `json:"token_used_monthly"`
		DefaultQuota       int64  `json:"default_quota"`
	}

	var items []teacherItem
	for _, u := range users {
		items = append(items, teacherItem{
			ID:                u.ID.String(),
			Name:              u.Name,
			Phone:             u.Phone,
			Subject:           u.Subject,
			TokenQuotaMonthly: u.TokenQuotaMonthly,
			TokenQuotaCustom:  u.TokenQuotaCustom,
			TokenUsedMonthly:  u.TokenUsedMonthly,
		})
	}

	c.JSON(http.StatusOK, gin.H{"code":200,"data":items})
}

// BatchUpdateQuota 批量更新教师配额
func (h *TokenHandler) BatchUpdateQuota(c *gin.Context) {
	var req struct {
		TeacherIDs []string `json:"teacher_ids" validate:"required"`
		Quota      int64    `json:"quota" validate:"required,min=0"`
		Custom     bool     `json:"custom"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"参数错误"})
		return
	}
	if err := h.repo.BatchUpdateQuota(req.TeacherIDs, req.Quota, req.Custom); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"更新配额失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"message":fmt.Sprintf("已更新 %d 位教师配额", len(req.TeacherIDs))})
}

func (h *AdminHandler) ListAuditLogs(c *gin.Context) {
	items, err := h.repo.ListAuditLogs(100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items":items})
}

func (h *ParentSignHandler) Sign(c *gin.Context) {
	var req struct {
		SignatureImgURL string `json:"signature_img_url"`
	}
	c.ShouldBindJSON(&req)
	if err := h.repo.Sign(c.Param("id"), req.SignatureImgURL); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":"签字失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message":"签字成功"})
}

// ── 教师任教管理 (IT管理员 / 教务管理员) ──

type TeachingHandler struct {
	classRepo *repository.ClassRepo
	authRepo  *repository.AuthRepo
}

func NewTeachingHandler(classRepo *repository.ClassRepo, authRepo *repository.AuthRepo) *TeachingHandler {
	return &TeachingHandler{classRepo: classRepo, authRepo: authRepo}
}

// ListAssignments 查看全校教师任教关系
func (h *TeachingHandler) ListAssignments(c *gin.Context) {
	schoolID := c.GetString("school_id")
	assignments, err := h.classRepo.ListTeacherAssignments(schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"data":assignments})
}

// AssignTeacher 配置教师任教关系
func (h *TeachingHandler) AssignTeacher(c *gin.Context) {
	var req struct {
		TeacherPhone string `json:"teacher_phone"`
		ClassID      string `json:"class_id"`
		Subject      string `json:"subject"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"参数错误"})
		return
	}
	teacher, err := h.authRepo.FindByPhone(req.TeacherPhone)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code":404,"message":"教师不存在"})
		return
	}
	classID, _ := uuid.Parse(req.ClassID)
	schoolID := c.GetString("school_id")
	if err := h.classRepo.AssignTeacherInSchool(teacher.ID, classID, req.Subject, schoolID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message":"任教关系配置成功"})
}

// ── 校长仪表盘 (只读全校数据) ──

type PrincipalHandler struct {
	statsRepo *repository.StatsRepo
}

func NewPrincipalHandler(statsRepo *repository.StatsRepo) *PrincipalHandler {
	return &PrincipalHandler{statsRepo: statsRepo}
}

func (h *PrincipalHandler) Dashboard(c *gin.Context) {
	schoolID := c.GetString("school_id")
	data, err := h.statsRepo.GetPrincipalDashboard(schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"data":data})
}

// ── 分校管理 ──

type CampusHandler struct {
	campusRepo   *repository.CampusRepo
	classRepo    *repository.ClassRepo
}

func NewCampusHandler(campusRepo *repository.CampusRepo, classRepo *repository.ClassRepo) *CampusHandler {
	return &CampusHandler{campusRepo: campusRepo, classRepo: classRepo}
}

func (h *CampusHandler) List(c *gin.Context) {
	schoolID := c.GetString("school_id")
	items, err := h.campusRepo.ListBySchool(schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"data":items})
}

func (h *CampusHandler) Create(c *gin.Context) {
	var req struct {
		Name   string   `json:"name" validate:"required"`
		Grades []string `json:"grades"`
	}
	c.ShouldBindJSON(&req)
	gradesJSON, _ := json.Marshal(req.Grades)
	campus, err := h.campusRepo.Create(req.Name, c.GetString("school_id"), string(gradesJSON))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code":200,"data":campus})
}

// BatchImportTeachers 批量导入教师
func (h *CampusHandler) BatchImportTeachers(c *gin.Context) {
	var req struct {
		Teachers []struct {
			Name    string `json:"name"`
			Phone   string `json:"phone"`
			Subject string `json:"subject"`
			Grade   string `json:"grade"`
		} `json:"teachers"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"参数错误"})
		return
	}
	schoolID, _ := uuid.Parse(c.GetString("school_id"))
	var users []model.User
	for _, t := range req.Teachers {
		users = append(users, model.User{
			Phone: t.Phone, Name: t.Name, Role: "teacher",
			Subject: t.Subject, Grade: t.Grade,
			SchoolID:      &schoolID,
			AccountSource: "admin_created",
		})
	}
	if err := h.campusRepo.BatchCreateUsers(users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"message":fmt.Sprintf("成功导入%d位教师", len(users))})
}

// ── 教学检查 (教务专用) ──

type InspectionHandler struct {
	classRepo *repository.ClassRepo
}

func NewInspectionHandler(classRepo *repository.ClassRepo) *InspectionHandler {
	return &InspectionHandler{classRepo: classRepo}
}

func (h *InspectionHandler) Get(c *gin.Context) {
	schoolID := c.GetString("school_id")
	data, err := h.classRepo.GetTeachingInspection(schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"data":data})
}

// ── 教材版本配置 + 课标对标提示 ──

type TextbookHandler struct {
	repo *repository.TextbookRepo
}

func NewTextbookHandler(repo *repository.TextbookRepo) *TextbookHandler {
	return &TextbookHandler{repo: repo}
}

func (h *TextbookHandler) List(c *gin.Context) {
	schoolID := c.GetString("school_id")
	items, err := h.repo.ListBySchool(schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"data":items})
}

func (h *TextbookHandler) Upsert(c *gin.Context) {
	var req struct {
		Subject       string `json:"subject"`
		Grade         string `json:"grade"`
		Publisher     string `json:"publisher"`
		Version       string `json:"version"`
		CurriculumRef string `json:"curriculum_ref"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"参数错误"})
		return
	}
	schoolID, _ := uuid.Parse(c.GetString("school_id"))
	tv := &model.TextbookVersion{
		SchoolID: schoolID, Subject: req.Subject, Grade: req.Grade,
		Publisher: req.Publisher, Version: req.Version, CurriculumRef: req.CurriculumRef,
	}
	if err := h.repo.Upsert(tv); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"data":tv})
}

func (h *TextbookHandler) CurriculumHint(c *gin.Context) {
	subject := c.Query("subject")
	grade := c.Query("grade")
	publisher := c.Query("publisher")
	if subject == "" || grade == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"缺少学科或年级参数"})
		return
	}
	items, err := h.repo.LookupCurriculum(subject, grade, publisher)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	covered := make([]string, 0)
	truncate := func(s string, n int) string {
		r := []rune(s)
		if len(r) <= n { return s }
		return string(r[:n]) + "..."
	}
	for _, m := range items {
		covered = append(covered, fmt.Sprintf("[%s] %s", m.StandardCode, truncate(m.StandardContent, 60)))
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"data":gin.H{
		"subject":         subject,
		"grade":           grade,
		"total_standards": len(items),
		"covered_codes":   covered,
		"details":         items,
	}})
}

// ── 互审机制 ──

type ReviewHandler struct {
	repo *repository.ReviewRepo
}

func NewReviewHandler(repo *repository.ReviewRepo) *ReviewHandler {
	return &ReviewHandler{repo: repo}
}

func (h *ReviewHandler) Submit(c *gin.Context) {
	var req struct {
		PlanID         string `json:"plan_id"`
		Rating         string `json:"rating"`
		QuickFeedback  string `json:"quick_feedback"`
		DetailFeedback string `json:"detail_feedback"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"参数错误"})
		return
	}
	// 快捷评语映射
	quickOptions := map[string]string{
		"recommend":  "教学目标清晰，设计合理，推荐",
		"improvable": "建议补充教学活动的具体实施细节",
		"neutral":    "教案结构完整",
	}
	if req.QuickFeedback == "" {
		req.QuickFeedback = quickOptions[req.Rating]
	}

	planID, _ := uuid.Parse(req.PlanID)
	reviewerID, _ := uuid.Parse(c.GetString("user_id"))
	review := &model.LessonReview{
		PlanID: planID, ReviewerID: reviewerID,
		Rating: req.Rating, QuickFeedback: req.QuickFeedback, DetailFeedback: req.DetailFeedback,
	}
	if err := h.repo.Create(review); err != nil {
		c.JSON(http.StatusConflict, gin.H{"code":409,"message":"您已评审过该教案"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"message":"评审提交成功","quick_feedback":req.QuickFeedback})
}

func (h *ReviewHandler) ListByPlan(c *gin.Context) {
	items, err := h.repo.ListByPlan(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"data":items})
}

func (h *ReviewHandler) PendingForMe(c *gin.Context) {
	userID := c.GetString("user_id")
	schoolID := c.GetString("school_id")
	items, err := h.repo.ListPendingForTeacher(userID, schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"data":items})
}

func (h *ReviewHandler) Coverage(c *gin.Context) {
	schoolID := c.GetString("school_id")
	data, err := h.repo.GetCoverage(schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code":500,"message":err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code":200,"data":data})
}

// ── 内容安全审核 ──

type AuditHandler struct{}

func NewAuditHandler() *AuditHandler { return &AuditHandler{} }

// basicKeywords 基础敏感词库（MVP用，生产环境接云端API）
var blockedKeywords = []string{
	"色情", "赌博", "毒品", "暴力", "自杀", "枪支", "诈骗",
}

func containsAny(text string, keywords []string) (bool, []string) {
	low := strings.ToLower(text)
	var found []string
	for _, kw := range keywords {
		if strings.Contains(low, kw) {
			found = append(found, kw)
		}
	}
	return len(found) > 0, found
}

func clearString(s string) string {
	r := strings.NewReplacer("\n", "", "\r", "", "\t", " ")
	cleaned := r.Replace(s)
	cleaned = strings.Join(strings.Fields(cleaned), " ")
	if len([]rune(cleaned)) > 500 {
		cleaned = string([]rune(cleaned)[:500]) + "..."
	}
	return cleaned
}

func (h *AuditHandler) Check(c *gin.Context) {
	var req struct {
		Content string `json:"content"`
		Type    string `json:"type"` // text / image
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code":400,"message":"参数错误"})
		return
	}

	result := gin.H{"result": "pass", "risk_score": 0, "risk_labels": []string{}}

	if req.Type == "text" && req.Content != "" {
		blocked, labels := containsAny(req.Content, blockedKeywords)
		if blocked {
			result["result"] = "block"
			result["risk_score"] = 95
			result["risk_labels"] = labels
		}
	} else if req.Type == "text" && len(req.Content) == 0 {
		result["result"] = "block"
		result["risk_labels"] = []string{"empty_content"}
	}

	// 记录审计日志
	userID := c.GetString("user_id")
	log := fmt.Sprintf("[AUDIT] user=%s type=%s result=%s", userID, req.Type, result["result"])
	fmt.Println(log)

	c.JSON(http.StatusOK, gin.H{"code":200,"data":result})
}
