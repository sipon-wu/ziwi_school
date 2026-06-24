package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"
)

// ── Question Handler ──

type QuestionHandler struct {
	repo *repository.QuestionRepo
}

func NewQuestionHandler(repo *repository.QuestionRepo) *QuestionHandler {
	return &QuestionHandler{repo: repo}
}

// saveQuestion 保存题目到个人题库（内部复用）
type SaveQuestionInput struct {
	Questions []struct {
		Type            string   `json:"type"`
		Content         string   `json:"content"`
		Difficulty      string   `json:"difficulty"`
		Options         string   `json:"options,omitempty"`
		Answer          string   `json:"answer,omitempty"`
		AnswerDetail    string   `json:"answer_detail,omitempty"`
		KnowledgePoints []string `json:"knowledge_points,omitempty"`
	} `json:"questions"`
	Subject         string `json:"subject"`
	Grade           string `json:"grade"`
	Semester        string `json:"semester"`
	TextbookVersion string `json:"textbook_version"`
	ChapterUnit     string `json:"chapter_unit"`
	Source          string `json:"source"`
	SourcePrompt    string `json:"source_prompt"`
}

func (h *QuestionHandler) Save(c *gin.Context) {
	var req SaveQuestionInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	teacherID, _ := uuid.Parse(c.GetString("user_id"))
	schoolID, _ := uuid.Parse(c.GetString("school_id"))

	if len(req.Questions) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "至少需要一道题目"})
		return
	}

	models := make([]model.Question, len(req.Questions))
	for i, q := range req.Questions {
		kpsJSON, _ := json.Marshal(q.KnowledgePoints)
		if len(q.KnowledgePoints) == 0 {
			kpsJSON = []byte("[]")
		}
		source := req.Source
		if source == "" {
			source = "ai_generated"
		}
		models[i] = model.Question{
			TeacherID:       teacherID,
			SchoolID:        schoolID,
			Subject:         req.Subject,
			Grade:           req.Grade,
			Semester:        req.Semester,
			TextbookVersion: req.TextbookVersion,
			ChapterUnit:     req.ChapterUnit,
			KnowledgePoints: string(kpsJSON),
			Type:            q.Type,
			Difficulty:      q.Difficulty,
			Content:         q.Content,
			Options:         q.Options,
			Answer:          q.Answer,
			AnswerDetail:    q.AnswerDetail,
			Source:          source,
			SourcePrompt:    req.SourcePrompt,
		}
	}

	saved, err := h.repo.BatchCreate(models)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "保存题目失败", "detail": err.Error()})
		return
	}

	ids := make([]string, len(saved))
	for i, q := range saved {
		ids[i] = q.ID.String()
	}
	c.JSON(http.StatusCreated, gin.H{"message": "题目已保存", "question_ids": ids, "count": len(ids)})
}

// ListPersonal 个人题库
func (h *QuestionHandler) ListPersonal(c *gin.Context) {
	teacherID := c.GetString("user_id")
	schoolID := c.GetString("school_id")
	subject := c.Query("subject")
	grade := c.Query("grade")
	qtype := c.Query("type")
	difficulty := c.Query("difficulty")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	items, total, err := h.repo.ListPersonal(teacherID, schoolID, subject, grade, qtype, difficulty, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取个人题库失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total})
}

// ListSchool 校本题库
func (h *QuestionHandler) ListSchool(c *gin.Context) {
	schoolID := c.GetString("school_id")
	subject := c.Query("subject")
	grade := c.Query("grade")
	qtype := c.Query("type")
	difficulty := c.Query("difficulty")
	minRating, _ := strconv.ParseFloat(c.DefaultQuery("min_rating", "0"), 64)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	items, total, err := h.repo.ListSchool(schoolID, subject, grade, qtype, difficulty, minRating, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取校本题库失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total})
}

// Search 搜索题库
func (h *QuestionHandler) Search(c *gin.Context) {
	schoolID := c.GetString("school_id")
	teacherID := c.GetString("user_id")
	keyword := c.Query("keyword")
	personalOnly := c.DefaultQuery("scope", "all") == "personal"
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	items, total, err := h.repo.SearchQuestions(schoolID, teacherID, keyword, personalOnly, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "搜索失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total})
}

// Get 获取题目详情
func (h *QuestionHandler) Get(c *gin.Context) {
	q, err := h.repo.FindByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "题目不存在"})
		return
	}
	c.JSON(http.StatusOK, q)
}

// Update 更新题目
func (h *QuestionHandler) Update(c *gin.Context) {
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}
	delete(updates, "id")
	delete(updates, "teacher_id")
	delete(updates, "school_id")
	delete(updates, "created_at")
	delete(updates, "is_public")
	delete(updates, "audit_status")

	if err := h.repo.Update(c.Param("id"), updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "更新失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "题目已更新"})
}

// Delete 删除题目
func (h *QuestionHandler) Delete(c *gin.Context) {
	teacherID := c.GetString("user_id")
	if err := h.repo.Delete(c.Param("id"), teacherID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "删除失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "题目已删除"})
}

// Contribute 贡献到校本题库
func (h *QuestionHandler) Contribute(c *gin.Context) {
	var req struct {
		QuestionIDs []string `json:"question_ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}
	teacherID := c.GetString("user_id")
	if len(req.QuestionIDs) == 0 {
		// 单题贡献
		count, err := h.repo.BatchContribute([]string{c.Param("id")}, teacherID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "贡献失败"})
			return
		}
		if count == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "题目不存在或已贡献"})
			return
		}
	} else {
		count, err := h.repo.BatchContribute(req.QuestionIDs, teacherID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "批量贡献失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "已贡献 " + strconv.Itoa(count) + " 道题目，等待教研组长审核"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已提交贡献，等待教研组长审核"})
}

// Rate 评分
func (h *QuestionHandler) Rate(c *gin.Context) {
	var req struct {
		Score        int      `json:"score" validate:"required,min=1,max=5"`
		Tags         []string `json:"tags"`
		Comment      string   `json:"comment"`
		AssignmentID string   `json:"assignment_id" validate:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}
	teacherID, _ := uuid.Parse(c.GetString("user_id"))
	questionID, _ := uuid.Parse(c.Param("id"))
	assignmentID, _ := uuid.Parse(req.AssignmentID)

	tagsJSON, _ := json.Marshal(req.Tags)
	if len(req.Tags) == 0 {
		tagsJSON = []byte("[]")
	}

	rating := &model.QuestionRating{
		QuestionID:   questionID,
		TeacherID:    teacherID,
		AssignmentID: assignmentID,
		Score:        req.Score,
		Tags:         string(tagsJSON),
		Comment:      req.Comment,
	}
	if err := h.repo.CreateRating(rating); err != nil {
		c.JSON(http.StatusConflict, gin.H{"code": 409, "message": "该题目在此作业中已评分"})
		return
	}

	// 更新自动标签
	h.repo.UpdateAutoTags(c.Param("id"))

	c.JSON(http.StatusCreated, gin.H{"message": "评分成功"})
}

// ListRatings 题目评分列表
func (h *QuestionHandler) ListRatings(c *gin.Context) {
	items, err := h.repo.ListRatings(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取评分列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// CheckDuplicate 检查题目与班级的重复
func (h *QuestionHandler) CheckDuplicate(c *gin.Context) {
	classID := c.Query("class_id")
	if classID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "缺少班级ID"})
		return
	}
	var req struct {
		QuestionIDs []string `json:"question_ids"`
	}
	c.ShouldBindJSON(&req)

	dupes, err := h.repo.CheckDuplicateByClass(classID, req.QuestionIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查重失败"})
		return
	}

	dupeMap := make(map[string][]repository.DuplicateInfo)
	for _, d := range dupes {
		dupeMap[d.QuestionID] = append(dupeMap[d.QuestionID], d)
	}
	c.JSON(http.StatusOK, gin.H{"duplicates": dupeMap, "has_duplicate": len(dupes) > 0})
}

// Stats 题库统计
func (h *QuestionHandler) Stats(c *gin.Context) {
	schoolID := c.GetString("school_id")
	teacherID := c.GetString("user_id")
	stats, err := h.repo.GetQuestionStats(schoolID, teacherID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": stats})
}

// ── 查重（供作业创建前调用） ──

// CheckDupForClass 检查题目是否已在该班布置过
func (h *QuestionHandler) CheckDupForClass(c *gin.Context) {
	classID := c.Query("class_id")
	if classID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "缺少班级ID"})
		return
	}
	var req struct {
		QuestionIDs []string `json:"question_ids"`
	}
	c.ShouldBindJSON(&req)

	dupes, err := h.repo.CheckDuplicateByClass(classID, req.QuestionIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "查重失败"})
		return
	}

	dupeMap := make(map[string][]repository.DuplicateInfo)
	for _, d := range dupes {
		dupeMap[d.QuestionID] = append(dupeMap[d.QuestionID], d)
	}
	c.JSON(http.StatusOK, gin.H{"duplicates": dupeMap, "has_duplicate": len(dupes) > 0})
}

// BuildAssignmentJSON 从题目ID列表构建兼容的 questions JSONB
func (h *QuestionHandler) BuildAssignmentJSON(c *gin.Context) {
	var req struct {
		QuestionIDs []string `json:"question_ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	questions := make([]map[string]interface{}, 0)
	for _, qid := range req.QuestionIDs {
		q, err := h.repo.FindByID(qid)
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
	c.JSON(http.StatusOK, gin.H{"questions": questions, "count": len(questions)})
}

// PendingAudits 待审核列表（教研组长用）
func (h *QuestionHandler) PendingAudits(c *gin.Context) {
	schoolID := c.GetString("school_id")
	items, err := h.repo.ListPendingAudits(schoolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取待审核列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

// Audit 审核校本贡献
func (h *QuestionHandler) Audit(c *gin.Context) {
	var req struct {
		Approved bool `json:"approved"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}
	auditorID := c.GetString("user_id")
	if err := h.repo.AuditContribution(c.Param("id"), req.Approved, auditorID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "审核操作失败"})
		return
	}
	status := "已拒绝"
	if req.Approved {
		status = "已通过"
	}
	c.JSON(http.StatusOK, gin.H{"message": "审核" + status})
}
