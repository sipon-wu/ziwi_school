package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"

	"github.com/zhiwei/backend/internal/repository"
)

type ExerciseHandler struct {
	repo *repository.ExerciseRepository
}

func NewExerciseHandler(repo *repository.ExerciseRepository) *ExerciseHandler {
	return &ExerciseHandler{repo: repo}
}

// CreateQuestionRequest 创建题目请求
type CreateQuestionRequest struct {
	Stem         string  `json:"stem" binding:"required"`
	Answer       string  `json:"answer"`
	Analysis     string  `json:"analysis"`
	QuestionType string  `json:"question_type" binding:"required"`
	Subject      string  `json:"subject" binding:"required"`
	Grade        string  `json:"grade" binding:"required"`
	Score        float64 `json:"score"`
	Difficulty   string  `json:"difficulty"`
	Source       string  `json:"source"`
}

// ListQuestions 题库列表
// GET /api/questions
func (h *ExerciseHandler) ListQuestions(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)

	page := 1
	pageSize := 20
	// 允许前端按 ?page_size= 拉取全部（题库为客户端过滤+分页，需一次性取全量）
	if ps := c.Query("page_size"); ps != "" {
		if n, err := strconv.Atoi(ps); err == nil && n > 0 && n <= 2000 {
			pageSize = n
		}
	}

	questions, total, err := h.repo.ListByTeacher(teacherIDStr, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取题库失败"})
		return
	}

	if questions == nil {
		questions = []repository.Question{}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":     questions,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetQuestion 获取题目详情
// GET /api/questions/:id
func (h *ExerciseHandler) GetQuestion(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	id := c.Param("id")

	q, err := h.repo.FindByID(id, teacherIDStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "题目不存在或已删除"})
		return
	}
	c.JSON(http.StatusOK, q)
}

// CreateQuestion 创建题目
// POST /api/questions
func (h *ExerciseHandler) CreateQuestion(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	var req CreateQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请填写完整信息：题干、答案、题型、学科、年级"})
		return
	}

	if req.Difficulty == "" {
		req.Difficulty = "L2"
	}
	if req.Source == "" {
		req.Source = "original"
	}

	q := &repository.Question{
		TeacherID:    teacherIDStr,
		SchoolID:     schoolIDStr,
		Content:      req.Stem,
		Answer:       req.Answer,
		AnswerDetail: req.Analysis,
		Type:         req.QuestionType,
		Subject:      req.Subject,
		Grade:        req.Grade,
		Difficulty:   req.Difficulty,
		Source:       req.Source,
		AuditStatus:  "approved",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// jsonb 字段空值归一到合法 JSON，避免空字符串触发 Postgres jsonb 报错（BUG-002）
	if q.Options == nil {
		q.Options = datatypes.JSON("[]")
	}
	if q.KnowledgePoints == nil {
		q.KnowledgePoints = datatypes.JSON("[]")
	}
	if q.AutoTags == nil {
		q.AutoTags = datatypes.JSON("[]")
	}

	if err := h.repo.Create(q); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "CREATE_FAILED", "message": "创建题目失败"})
		return
	}

	c.JSON(http.StatusCreated, q)
}

// UpdateQuestion 更新题目
// PUT /api/questions/:id
func (h *ExerciseHandler) UpdateQuestion(c *gin.Context) {
	teacherID, _ := c.Get("user_id")
	teacherIDStr, _ := teacherID.(string)
	id := c.Param("id")

	q, err := h.repo.FindByID(id, teacherIDStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "题目不存在"})
		return
	}

	var req CreateQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请求参数有误"})
		return
	}

	if req.Stem != "" {
		q.Content = req.Stem
	}
	if req.Answer != "" {
		q.Answer = req.Answer
	}
	if req.Analysis != "" {
		q.AnswerDetail = req.Analysis
	}
	if req.QuestionType != "" {
		q.Type = req.QuestionType
	}
	if req.Subject != "" {
		q.Subject = req.Subject
	}
	if req.Grade != "" {
		q.Grade = req.Grade
	}
	if req.Difficulty != "" {
		q.Difficulty = req.Difficulty
	}
		q.UpdatedAt = time.Now()

	if err := h.repo.Update(q); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "UPDATE_FAILED", "message": "更新题目失败"})
		return
	}

	c.JSON(http.StatusOK, q)
}

// ── 训练坐标推断 ──

// InferTrainingCoordinateRequest 训练坐标推断请求
type InferTrainingCoordinateRequest struct {
	Type            string   `json:"type" binding:"required"`       // T: 题型
	Difficulty      string   `json:"difficulty"`                    // D: 难度
	Subject         string   `json:"subject" binding:"required"`
	Content         string   `json:"content"`
	KnowledgePoints []string `json:"knowledge_points"`
}

// InferTrainingCoordinate 训练坐标推断（Phase 0 启发式，后续移至 AI Service 做精确推断）
// POST /api/exercises/infer-coordinate
func (h *ExerciseHandler) InferTrainingCoordinate(c *gin.Context) {
	var req InferTrainingCoordinateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_REQUEST", "message": "请提供题目信息"})
		return
	}

	// ── V (scenario_variant) 按题型启发式推断 ──
	vMap := map[string]string{
		"single_choice":   "recognition",
		"multiple_choice": "discrimination",
		"fill_blank":      "recall",
		"completion":      "recall",
		"short_answer":    "application",
		"essay":           "application",
		"calculation":     "calculation",
		"true_false":      "judgment",
		"matching":        "matching",
		"oral":            "production",
	}
	v := vMap[req.Type]
	if v == "" {
		v = "comprehension" // 兜底
	}

	// ── R (training_role) 按学科+题型+难度组合推断 ──
	r := "practice"
	difficulty := req.Difficulty
	if difficulty == "" {
		difficulty = "L2"
	}
	if len(difficulty) > 1 {
		switch difficulty[1:] {
		case "3", "4":
			r = "challenge"
		}
	}
	switch {
	case req.Type == "calculation" && (req.Subject == "数学" || req.Subject == "math"):
		r = "automation"
	case (req.Type == "single_choice" || req.Type == "true_false") && (difficulty == "L1" || difficulty == "L2"):
		r = "warmup"
	case req.Type == "essay" || req.Type == "short_answer":
		r = "expression"
	case req.Type == "fill_blank" || req.Type == "completion":
		r = "recall"
	}

	c.JSON(http.StatusOK, gin.H{
		"scenario_variant": v,
		"training_role":    r,
		"inference_mode":   "heuristic", // Phase 0 启发式，后续由 AI Service 精确推断
	})
}
