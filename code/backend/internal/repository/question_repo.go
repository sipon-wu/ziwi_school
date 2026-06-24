package repository

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
)

// QuestionRepo 题库数据操作
type QuestionRepo struct {
	db *gorm.DB
}

func NewQuestionRepo(db *gorm.DB) *QuestionRepo {
	return &QuestionRepo{db: db}
}

// Create 创建单道题目
func (r *QuestionRepo) Create(q *model.Question) error {
	if q.KnowledgePoints == "" {
		q.KnowledgePoints = "[]"
	}
	if q.Options == "" {
		q.Options = "[]"
	}
	if q.AutoTags == "" {
		q.AutoTags = "[]"
	}
	return r.db.Create(q).Error
}

// BatchCreate 批量创建题目，返回创建的题目列表
func (r *QuestionRepo) BatchCreate(questions []model.Question) ([]model.Question, error) {
	if len(questions) == 0 {
		return nil, nil
	}
	for i := range questions {
		if questions[i].KnowledgePoints == "" {
			questions[i].KnowledgePoints = "[]"
		}
		if questions[i].Options == "" {
			questions[i].Options = "[]"
		}
	}
	err := r.db.CreateInBatches(&questions, 50).Error
	return questions, err
}

// FindByID 按ID查题目
func (r *QuestionRepo) FindByID(id string) (*model.Question, error) {
	var q model.Question
	err := r.db.Preload("Teacher").First(&q, "id = ?", id).Error
	return &q, err
}

// ListPersonal 个人题库（默认私有）
func (r *QuestionRepo) ListPersonal(teacherID, schoolID string, subject, grade, qtype, difficulty string, limit, offset int) ([]model.Question, int64, error) {
	var items []model.Question
	var total int64
	query := r.db.Model(&model.Question{}).Where("teacher_id = ? AND school_id = ?", teacherID, schoolID)
	if subject != "" {
		query = query.Where("subject = ?", subject)
	}
	if grade != "" {
		query = query.Where("grade = ?", grade)
	}
	if qtype != "" {
		query = query.Where("type = ?", qtype)
	}
	if difficulty != "" {
		query = query.Where("difficulty = ?", difficulty)
	}
	query.Count(&total)
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&items).Error
	return items, total, err
}

// ListSchool 校本题库（is_public=true AND audit_status='approved'）
func (r *QuestionRepo) ListSchool(schoolID, subject, grade, qtype, difficulty string, minRating float64, limit, offset int) ([]model.Question, int64, error) {
	var items []model.Question
	var total int64
	query := r.db.Model(&model.Question{}).
		Where("school_id = ? AND is_public = true AND audit_status = 'approved'", schoolID)
	if subject != "" {
		query = query.Where("subject = ?", subject)
	}
	if grade != "" {
		query = query.Where("grade = ?", grade)
	}
	if qtype != "" {
		query = query.Where("type = ?", qtype)
	}
	if difficulty != "" {
		query = query.Where("difficulty = ?", difficulty)
	}
	if minRating > 0 {
		query = query.Where("avg_rating >= ?", minRating)
	}
	query.Count(&total)
	err := query.Order("avg_rating DESC, usage_count DESC").Limit(limit).Offset(offset).Preload("Teacher").Find(&items).Error
	return items, total, err
}

// SearchQuestions 全文搜索（题目内容 + 知识点）
func (r *QuestionRepo) SearchQuestions(schoolID, teacherID, keyword string, personalOnly bool, limit, offset int) ([]model.Question, int64, error) {
	var items []model.Question
	var total int64
	query := r.db.Model(&model.Question{}).Where("school_id = ?", schoolID)
	if personalOnly {
		query = query.Where("teacher_id = ?", teacherID)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("content ILIKE ? OR knowledge_points::text ILIKE ?", like, like)
	}
	query.Count(&total)
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&items).Error
	return items, total, err
}

// Update 更新题目
func (r *QuestionRepo) Update(id string, updates map[string]interface{}) error {
	return r.db.Model(&model.Question{}).Where("id = ?", id).Updates(updates).Error
}

// Delete 删除题目（仅删除自己未贡献的个人题目）
func (r *QuestionRepo) Delete(id, teacherID string) error {
	return r.db.Where("id = ? AND teacher_id = ? AND is_public = false", id, teacherID).
		Delete(&model.Question{}).Error
}

// ContributeToSchool 贡献到校本题库
func (r *QuestionRepo) ContributeToSchool(id, teacherID string) error {
	now := time.Now()
	return r.db.Model(&model.Question{}).
		Where("id = ? AND teacher_id = ? AND is_public = false", id, teacherID).
		Updates(map[string]interface{}{
			"is_public":      true,
			"audit_status":   "pending",
			"contributed_at": now,
		}).Error
}

// BatchContribute 批量贡献到校本
func (r *QuestionRepo) BatchContribute(ids []string, teacherID string) (int, error) {
	now := time.Now()
	result := r.db.Model(&model.Question{}).
		Where("id IN ? AND teacher_id = ? AND is_public = false", ids, teacherID).
		Updates(map[string]interface{}{
			"is_public":      true,
			"audit_status":   "pending",
			"contributed_at": now,
		})
	return int(result.RowsAffected), result.Error
}

// AuditContribution 审核校本贡献（教研组长）
func (r *QuestionRepo) AuditContribution(id string, approved bool, auditorID string) error {
	status := "rejected"
	if approved {
		status = "approved"
	}
	auditorUUID, _ := uuid.Parse(auditorID)
	return r.db.Model(&model.Question{}).
		Where("id = ? AND audit_status = 'pending'", id).
		Updates(map[string]interface{}{
			"audit_status": status,
			"auditor_id":   auditorUUID,
		}).Error
}

// ListPendingAudits 列出待审核的校本贡献
func (r *QuestionRepo) ListPendingAudits(schoolID string) ([]model.Question, error) {
	var items []model.Question
	err := r.db.Where("school_id = ? AND audit_status = 'pending'", schoolID).
		Order("contributed_at ASC").Preload("Teacher").Find(&items).Error
	return items, err
}

// CreateRating 评分（同一题目+教师+作业唯一）
func (r *QuestionRepo) CreateRating(rating *model.QuestionRating) error {
	// 尝试插入，冲突则报错
	err := r.db.Create(rating).Error
	if err != nil {
		return err
	}
	// 更新题目平均分
	return r.recalcAvgRating(rating.QuestionID.String())
}

// recalcAvgRating 重新计算题目平均分
func (r *QuestionRepo) recalcAvgRating(questionID string) error {
	var avg float64
	var count int64
	r.db.Model(&model.QuestionRating{}).
		Where("question_id = ?", questionID).
		Select("COALESCE(AVG(score),0)").
		Scan(&avg)
	r.db.Model(&model.QuestionRating{}).
		Where("question_id = ?", questionID).
		Count(&count)

	return r.db.Model(&model.Question{}).Where("id = ?", questionID).
		Updates(map[string]interface{}{
			"avg_rating":   avg,
			"rating_count": count,
		}).Error
}

// ListRatings 题目评分列表
func (r *QuestionRepo) ListRatings(questionID string) ([]model.QuestionRating, error) {
	var items []model.QuestionRating
	err := r.db.Where("question_id = ?", questionID).Order("created_at DESC").Find(&items).Error
	return items, err
}

// IncrementUsage 增加使用次数
func (r *QuestionRepo) IncrementUsage(questionIDs []string) error {
	return r.db.Model(&model.Question{}).
		Where("id IN ?", questionIDs).
		Update("usage_count", gorm.Expr("usage_count + 1")).Error
}

// CheckDuplicateByClass 查重：同一班级是否已布置过相同题目
type DuplicateInfo struct {
	QuestionID    string `json:"question_id"     gorm:"column:question_id"`
	AssignmentID  string `json:"assignment_id"   gorm:"column:assignment_id"`
	AssignmentTitle string `json:"assignment_title" gorm:"column:assignment_title"`
	CreatedAt     string `json:"created_at"      gorm:"column:created_at"`
}

func (r *QuestionRepo) CheckDuplicateByClass(classID string, questionIDs []string) ([]DuplicateInfo, error) {
	var dupes []DuplicateInfo
	err := r.db.Raw(`
		SELECT q.id::text AS question_id, a.id::text AS assignment_id,
		       a.title AS assignment_title, a.created_at::text
		FROM assignment_questions aq
		JOIN assignments a ON a.id = aq.assignment_id
		JOIN questions q ON q.id = aq.question_id
		WHERE a.class_id = ? AND aq.question_id IN ?
	`, classID, questionIDs).Scan(&dupes).Error
	return dupes, err
}

// LinkAssignmentQuestions 绑定作业-题目关联
func (r *QuestionRepo) LinkAssignmentQuestions(assignmentID string, questionIDs []string, sortOrders []int) error {
	for i, qid := range questionIDs {
		aq := &model.AssignmentQuestion{
			AssignmentID: uuid.MustParse(assignmentID),
			QuestionID:   uuid.MustParse(qid),
		}
		if i < len(sortOrders) {
			aq.SortOrder = sortOrders[i]
		} else {
			aq.SortOrder = i
		}
		if err := r.db.Create(aq).Error; err != nil {
			// 忽略重复
			continue
		}
	}
	return r.IncrementUsage(questionIDs)
}

// GetQuestionsByAssignment 获取作业的题目列表
func (r *QuestionRepo) GetQuestionsByAssignment(assignmentID string) ([]model.Question, error) {
	var questions []model.Question
	err := r.db.Raw(`
		SELECT q.* FROM questions q
		JOIN assignment_questions aq ON aq.question_id = q.id
		WHERE aq.assignment_id = ?
		ORDER BY aq.sort_order
	`, assignmentID).Scan(&questions).Error
	return questions, err
}

// BuildQuestionsJSON 构建旧的 questions JSONB 兼容格式（向后兼容）
func (r *QuestionRepo) BuildQuestionsJSON(assignmentID string) (string, error) {
	questions, err := r.GetQuestionsByAssignment(assignmentID)
	if err != nil {
		return "[]", err
	}
	type qItem struct {
		Content  string `json:"content"`
		Type     string `json:"type"`
		ID       string `json:"question_id,omitempty"`
		Answer   string `json:"answer,omitempty"`
		Options  string `json:"options,omitempty"`
	}
	items := make([]qItem, len(questions))
	for i, q := range questions {
		items[i] = qItem{
			Content: q.Content,
			Type:    q.Type,
			ID:      q.ID.String(),
			Answer:  q.Answer,
			Options: q.Options,
		}
	}
	b, _ := json.Marshal(items)
	return string(b), nil
}

// UpdateAutoTags 更新系统自动标签
func (r *QuestionRepo) UpdateAutoTags(questionID string) error {
	var q model.Question
	if err := r.db.First(&q, "id = ?", questionID).Error; err != nil {
		return err
	}

	autoTags := []string{}

	// 经典题：≥3位不同教师引用
	var teacherCount int64
	r.db.Raw(`SELECT COUNT(DISTINCT a.teacher_id) FROM assignment_questions aq
		JOIN assignments a ON a.id = aq.assignment_id
		WHERE aq.question_id = ?`, questionID).Scan(&teacherCount)
	if teacherCount >= 3 {
		autoTags = append(autoTags, "经典题")
	}

	// 易错题：正确率 < 40%
	if q.CorrectRate != nil && *q.CorrectRate < 40 {
		autoTags = append(autoTags, "易错题")
	}

	// 高频题：≥5个班级使用
	var classCount int64
	r.db.Raw(`SELECT COUNT(DISTINCT a.class_id) FROM assignment_questions aq
		JOIN assignments a ON a.id = aq.assignment_id
		WHERE aq.question_id = ?`, questionID).Scan(&classCount)
	if classCount >= 5 {
		autoTags = append(autoTags, "高频题")
	}

	// 区分度高：高分生正确率 - 低分生正确率 > 50%（暂用学生正确率模拟）
	if q.CorrectRate != nil && *q.CorrectRate >= 70 && q.Difficulty == "L3" {
		autoTags = append(autoTags, "拔高题")
	}

	tagsJSON, _ := json.Marshal(autoTags)
	return r.db.Model(&model.Question{}).Where("id = ?", questionID).
		Update("auto_tags", string(tagsJSON)).Error
}

// GetQuestionStats 题目使用统计
type QuestionStats struct {
	TotalPersonal int64 `json:"total_personal"`
	TotalSchool   int64 `json:"total_school"`
	TotalRated    int64 `json:"total_rated"`
	AvgRating     float64 `json:"avg_rating"`
}

func (r *QuestionRepo) GetQuestionStats(schoolID, teacherID string) (*QuestionStats, error) {
	s := &QuestionStats{}
	r.db.Model(&model.Question{}).Where("school_id = ? AND teacher_id = ?", schoolID, teacherID).Count(&s.TotalPersonal)
	r.db.Model(&model.Question{}).Where("school_id = ? AND is_public = true AND audit_status = 'approved'", schoolID).Count(&s.TotalSchool)
	r.db.Raw(`SELECT COUNT(*) FROM question_ratings qr
		JOIN questions q ON q.id = qr.question_id
		WHERE q.school_id = ? AND q.teacher_id = ?`, schoolID, teacherID).Scan(&s.TotalRated)
	r.db.Raw(`SELECT COALESCE(AVG(q.avg_rating),0) FROM questions q
		WHERE q.school_id = ? AND q.teacher_id = ? AND q.rating_count > 0`, schoolID, teacherID).Scan(&s.AvgRating)
	return s, nil
}
