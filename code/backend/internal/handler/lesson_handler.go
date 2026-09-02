package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/policy"
	"github.com/zhiwei/backend/internal/repository"
)

type LessonHandler struct {
	repo   *repository.LessonRepository
	db     *gorm.DB
	policy *policy.Client
}

func NewLessonHandler(repo *repository.LessonRepository, db *gorm.DB, pol *policy.Client) *LessonHandler {
	return &LessonHandler{repo: repo, db: db, policy: pol}
}

// CreateLessonRequest 创建教案请求
type CreateLessonRequest struct {
	Title        string `json:"title" binding:"required"`
	Subject      string `json:"subject" binding:"required"`
	Grade        string `json:"grade" binding:"required"`
	Unit         string `json:"unit"`
	Content      string `json:"content"` // 草稿允许空内容
	MaterialRefs string `json:"material_refs"`
}

// UpdateLessonRequest 更新教案请求
type UpdateLessonRequest struct {
	Title        string `json:"title" binding:"max=12"`
	Subject      string `json:"subject"`
	Grade        string `json:"grade"`
	Unit         string `json:"unit"`
	Content      string `json:"content"`
	MaterialRefs string `json:"material_refs"`
}

// ListLessonPlans 教案草稿箱列表
// GET /api/lessons
func (h *LessonHandler) ListLessonPlans(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)

	page := 1
	pageSize := 20

	plans, total, err := h.repo.ListByTeacher(teacherIDStr, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取教案列表失败"})
		return
	}

	if plans == nil {
		plans = []model.LessonPlan{}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":     plans,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// CreateLessonPlan 创建教案草稿
// POST /api/lessons
func (h *LessonHandler) CreateLessonPlan(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	var req CreateLessonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请填写完整信息：标题(≤12字)、学科、年级、内容"})
		return
	}

	plan := &model.LessonPlan{
		TeacherID:    teacherIDStr,
		SchoolID:     schoolIDStr,
		Title:        req.Title,
		Subject:      req.Subject,
		Grade:        req.Grade,
		Unit:         req.Unit,
		Content:      req.Content,
		MaterialRefs: req.MaterialRefs,
		Status:       "draft",
		TemplateType: "core_literacy",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := h.repo.Create(plan); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "CREATE_FAILED", "message": "创建教案失败"})
		return
	}

	c.JSON(http.StatusCreated, plan)
}

// GetLessonPlan 获取教案详情
// GET /api/lessons/:id
func (h *LessonHandler) GetLessonPlan(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	id := c.Param("id")

	plan, err := h.repo.FindByID(id, teacherIDStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "教案不存在"})
		return
	}

	c.JSON(http.StatusOK, plan)
}

// UpdateLessonPlan 更新教案
// PUT /api/lessons/:id
func (h *LessonHandler) UpdateLessonPlan(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	id := c.Param("id")

	plan, err := h.repo.FindByID(id, teacherIDStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "教案不存在"})
		return
	}

	var req UpdateLessonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请求参数有误"})
		return
	}

	if req.Title != "" {
		plan.Title = req.Title
	}
	if req.Subject != "" {
		plan.Subject = req.Subject
	}
	if req.Grade != "" {
		plan.Grade = req.Grade
	}
	if req.Unit != "" {
		plan.Unit = req.Unit
	}
	if req.Content != "" {
		plan.Content = req.Content
	}
	if req.MaterialRefs != "" {
		plan.MaterialRefs = req.MaterialRefs
	}
	plan.EditCount++
	plan.UpdatedAt = time.Now()

	if err := h.repo.Update(plan); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPDATE_FAILED", "message": "更新教案失败"})
		return
	}

	c.JSON(http.StatusOK, plan)
}

// DeleteLessonPlan 删除教案（归档）
// DELETE /api/lessons/:id
func (h *LessonHandler) DeleteLessonPlan(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	id := c.Param("id")

	if err := h.repo.Delete(id, teacherIDStr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DELETE_FAILED", "message": "删除教案失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已归档"})
}

// FinalizeLessonPlan 发布教案
// POST /api/lesson-plans/:id/finalize
// 互审开关关闭 → 直接发布(status=published, review_status=none)
// 互审开关开启 → 提交送审(status=published 占位草稿, review_status=pending，进入发布库"评审中")
func (h *LessonHandler) FinalizeLessonPlan(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	id := c.Param("id")

	plan, err := h.repo.FindByID(id, teacherIDStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "教案不存在"})
		return
	}
	if plan.Status == "published" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "ALREADY_PUBLISHED", "message": "该教案已发布"})
		return
	}

	var reviewEnabled bool
	if schoolIDStr != "" {
		var school model.School
		if err := h.db.Select("lesson_review_enabled").Where("id = ?", schoolIDStr).First(&school).Error; err == nil {
			reviewEnabled = school.LessonReviewEnabled
		}
	}

	// 内容安全审核（红线锁）：发布即过闸。
	// 教案的风险在"怎么教"（活动设计、举例、引导语），机检+AI评审覆盖表述类问题；
	// 命中红线一律拒绝发布；审核没跑成则转人工，绝不当作通过。
	var auditRes *policy.Result
	auditPassed := false
	if h.policy != nil && h.policy.Enabled() {
		res, err := h.policy.Check(c.Request.Context(), policy.CheckRequest{
			Text:    strings.TrimSpace(plan.Title + "\n" + plan.Content),
			Subject: plan.Subject,
			Grade:   plan.Grade,
		})
		if err != nil {
			log.Printf("[policy] 教案审核服务不可用，转待人工: %v", err)
		} else if blocking := res.Blocking(); len(blocking) > 0 {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    "CONTENT_BLOCKED",
				"message": "内容未通过安全审核，请修改后再发布",
				"issues":  blocking,
			})
			return
		} else {
			auditRes = res
			auditPassed = true
		}
	} else {
		log.Printf("[policy] 审核服务未配置，教案发布转待人工")
	}

	plan.Status = "active"
	switch {
	case reviewEnabled:
		plan.ReviewStatus = "pending" // 学校开启互审：待人工评审
	case auditPassed:
		plan.ReviewStatus = "approved" // 机检 + AI 评审通过，自动放行
	default:
		plan.ReviewStatus = "pending" // 审核没跑成：交人工兜底
	}
	now := time.Now()
	plan.PublishedAt = &now // 补齐从不写入的发布时间（留痕必需）
	plan.UpdatedAt = now

	if err := h.repo.Update(plan); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FINALIZE_FAILED", "message": "发布失败"})
		return
	}

	// 发布留痕：记录内容 + 审核结论 + AI 归属
	recordRelease(h.db, c, ReleaseMeta{
		ResourceType:   "lesson_plan",
		ResourceID:     plan.ID,
		Label:          plan.Title,
		Payload:        plan.Content,
		AIGenerated:    plan.AIGenerated,
		AIModelVersion: plan.AIModelVersion,
		HumanEdited:    plan.EditCount > 0,
	}, auditRes, plan.ReviewStatus)

	c.JSON(http.StatusOK, plan)
}

// GetSchoolReviewConfig 读取当前用户所属学校的教案互审开关
// GET /api/me/school-review-config
func (h *LessonHandler) GetSchoolReviewConfig(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	if schoolIDStr == "" {
		c.JSON(http.StatusOK, gin.H{"lesson_review_enabled": false})
		return
	}
	var school model.School
	if err := h.db.Select("lesson_review_enabled").Where("id = ?", schoolIDStr).First(&school).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"lesson_review_enabled": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"lesson_review_enabled": school.LessonReviewEnabled})
}

// UpdateSchoolReviewConfig 设置当前用户所属学校的教案互审开关（教师/IT 可配，默认关闭）
// PUT /api/me/school-review-config
func (h *LessonHandler) UpdateSchoolReviewConfig(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	if schoolIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "NO_SCHOOL", "message": "未关联学校"})
		return
	}
	var req struct {
		LessonReviewEnabled bool `json:"lesson_review_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "参数有误"})
		return
	}
	if err := h.db.Model(&model.School{}).Where("id = ?", schoolIDStr).
		Update("lesson_review_enabled", req.LessonReviewEnabled).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPDATE_FAILED", "message": "保存失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"lesson_review_enabled": req.LessonReviewEnabled})
}

// GetLessonPlanForReview 评审详情：本校任意教师/组长可查看（不限作者）
// GET /api/lesson-plans/:id/review
func (h *LessonHandler) GetLessonPlanForReview(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr, _ := userID.(string)
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	if userIDStr == "" || schoolIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "未登录或缺失学校信息"})
		return
	}
	id := c.Param("id")
	var plan model.LessonPlan
	if err := h.db.Where("id = ? AND school_id = ?", id, schoolIDStr).First(&plan).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "教案不存在或无权查看"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "查询失败"})
		return
	}
	c.JSON(http.StatusOK, plan)
}

// ListPendingReviews 本校待审(pending)教案列表（供评审人拉取互审池）
// GET /api/review/pending
func (h *LessonHandler) ListPendingReviews(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr, _ := userID.(string)
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	if userIDStr == "" || schoolIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "未登录或缺失学校信息"})
		return
	}
	var plans []model.LessonPlan
	// 互审池=审别人提交的教案，排除自己送审的（自己送审的在"教案发布库"看评审状态）
	if err := h.db.Where("school_id = ? AND review_status = ? AND teacher_id != ?", schoolIDStr, "pending", userIDStr).
		Order("updated_at DESC").Find(&plans).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "查询失败"})
		return
	}
	if plans == nil {
		plans = []model.LessonPlan{}
	}
	c.JSON(http.StatusOK, gin.H{"items": plans, "total": len(plans)})
}

// ReviewDecision 提交评审结论：approve→approved / reject→returned（可选整体批注）
// POST /api/lesson-plans/:id/review-decision
func (h *LessonHandler) ReviewDecision(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr, _ := userID.(string)
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	if userIDStr == "" || schoolIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "未登录或缺失学校信息"})
		return
	}
	id := c.Param("id")
	var req struct {
		Decision string `json:"decision" binding:"required"` // approve | reject
		Comment  string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请指定 decision(approve/reject)"})
		return
	}
	var decisionStatus string
	switch req.Decision {
	case "approve":
		decisionStatus = "approved"
	case "reject":
		decisionStatus = "returned"
	default:
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_DECISION", "message": "decision 仅支持 approve/reject"})
		return
	}
	var plan model.LessonPlan
	if err := h.db.Where("id = ? AND school_id = ?", id, schoolIDStr).First(&plan).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "教案不存在或无权操作"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "查询失败"})
		return
	}
	now := time.Now()
	updates := map[string]interface{}{
		"review_status": decisionStatus,
		"reviewer_id":   userIDStr, // 操作即评审人
		"reviewed_at":   now,
	}
	if req.Comment != "" {
		updates["review_comment"] = req.Comment
	}
	if err := h.db.Model(&plan).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPDATE_FAILED", "message": "更新评审状态失败"})
		return
	}
	// 若填写了整体批注，落一条 resource_type=lesson_plan 的整体批注（anchor_type=text, block_index=-1）
	if req.Comment != "" {
		anchor, _ := json.Marshal(gin.H{"block_index": -1, "preview": "整体评审意见"})
		ann := model.Annotation{
			SchoolID:     schoolIDStr,
			ResourceType: "lesson_plan",
			ResourceID:   id,
			UserID:       userIDStr,
			AnchorType:   "text",
			Anchor:       string(anchor),
			Comment:      req.Comment,
			CreatedAt:    time.Now(),
		}
		h.db.Create(&ann)
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "review_status": decisionStatus})
}
