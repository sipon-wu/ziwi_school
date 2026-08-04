package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/repository"
)

type AssignmentHandler struct {
	repo           *repository.AssignmentRepository
	sheetRepo      *repository.SheetRepo
	exerciseSheetRepo *repository.ExerciseSheetRepository
}

func NewAssignmentHandler(repo *repository.AssignmentRepository, sheetRepo *repository.SheetRepo, exerciseSheetRepo *repository.ExerciseSheetRepository) *AssignmentHandler {
	return &AssignmentHandler{repo: repo, sheetRepo: sheetRepo, exerciseSheetRepo: exerciseSheetRepo}
}

// CreateAssignmentRequest 创建作业请求
type CreateAssignmentRequest struct {
	Title          string         `json:"title" binding:"required"`
	Subject        string         `json:"subject" binding:"required"`
	ClassID        string         `json:"class_id" binding:"required"`
	AssignmentType string         `json:"assignment_type"`
	Questions      []QuestionItem `json:"questions"`
	TotalScore     float64        `json:"total_score"`
	DueHours       int            `json:"due_hours"`
	// SheetID 题单→作业追溯（从题单布置时由前端传回）
	SheetID        string `json:"sheet_id"`
	// SheetType 题单类型：sheet（练习题集）/ worksheet（习题库）
	SheetType      string `json:"sheet_type"`
}

// QuestionItem 作业中的题目项
type QuestionItem struct {
	QuestionID string  `json:"question_id"`
	Score      float64 `json:"score"`
}

// ListAssignments 作业列表
// GET /api/assignments
func (h *AssignmentHandler) ListAssignments(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)

	page := 1
	pageSize := 20

	assignments, total, err := h.repo.ListByTeacher(teacherIDStr, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取作业列表失败"})
		return
	}

	if assignments == nil {
		assignments = []repository.Assignment{}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":     assignments,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// CreateAssignment 布置作业
// POST /api/assignments
func (h *AssignmentHandler) CreateAssignment(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	var req CreateAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请填写完整信息：标题、学科、班级"})
		return
	}

	if req.AssignmentType == "" {
		req.AssignmentType = "regular"
	}

	// 序列化题目列表为 JSON
	questionsJSON, _ := json.Marshal(req.Questions)

	now := time.Now()
	a := &repository.Assignment{
		TeacherID:      teacherIDStr,
		SchoolID:       schoolIDStr,
		ClassID:        req.ClassID,
		Subject:        req.Subject,
		Title:          req.Title,
		AssignmentType: req.AssignmentType,
		Questions:      string(questionsJSON),
		TotalScore:     req.TotalScore,
		DueType:        "relative",
		DueHours:       req.DueHours,
		PublishedAt:    &now,
		GradingStatus:  "pending",
		SheetID:        req.SheetID,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := h.repo.Create(a); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "CREATE_FAILED", "message": "布置作业失败"})
		return
	}

	// 题目粒度布置日志：避免同师同年级同学科各班重复布置同一题目
	if len(req.Questions) > 0 {
		logs := make([]repository.AssignmentQuestionLog, 0, len(req.Questions))
		sheetID := req.SheetID
		for _, q := range req.Questions {
			if q.QuestionID == "" {
				continue
			}
			logs = append(logs, repository.AssignmentQuestionLog{
				TeacherID:  teacherIDStr,
				SchoolID:   schoolIDStr,
				ClassID:    req.ClassID,
				Subject:    req.Subject,
				QuestionID: q.QuestionID,
				SheetID:    sheetID,
				AssignmentID: a.ID,
			})
		}
		if err := h.repo.LogQuestions(logs); err != nil {
			// 日志写入失败不阻断主流程，仅记录
			c.Error(err)
		}
	}

	// 回写题单已布置班级（题单粒度去重累计）
	if req.SheetID != "" {
		go h.appendAssignedClass(req.SheetID, req.SheetType, req.ClassID)
	}

	c.JSON(http.StatusCreated, a)
}

// appendAssignedClass 将班级追加到题单的 assigned_classes 列表（幂等去重）
func (h *AssignmentHandler) appendAssignedClass(sheetID, sheetType, classID string) {
	if sheetID == "" || classID == "" || h.sheetRepo == nil {
		return
	}
	// 仅处理练习题集（sheet）；习题库（worksheet）暂未实现布置回写
	if sheetType == "worksheet" {
		return
	}
	s, err := h.sheetRepo.GetByIDAnySchool(sheetID)
	if err != nil || s == nil {
		return
	}
	var classes []string
	if s.AssignedClasses != "" {
		if err := json.Unmarshal([]byte(s.AssignedClasses), &classes); err != nil {
			classes = []string{}
		}
	}
	for _, c := range classes {
		if c == classID {
			return // 已存在，去重
		}
	}
	classes = append(classes, classID)
	if err := h.sheetRepo.SetPublishMode(sheetID, "assignment", classes); err != nil {
		return
	}
}

// DeleteAssignment 删除作业
// DELETE /api/assignments/:id
func (h *AssignmentHandler) DeleteAssignment(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	id := c.Param("id")

	if err := h.repo.Delete(id, teacherIDStr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DELETE_FAILED", "message": "删除失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": "OK", "message": "已删除"})
}

// UpdateAssignment 更新作业
// PUT /api/assignments/:id
func (h *AssignmentHandler) UpdateAssignment(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	id := c.Param("id")

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "无效的请求参数"})
		return
	}

	if err := h.repo.Update(id, teacherIDStr, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPDATE_FAILED", "message": "更新失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": "OK", "message": "已更新"})
}
