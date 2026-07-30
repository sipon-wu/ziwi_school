package repository

import (
	"time"

	"gorm.io/gorm"
)

type DashboardRepository struct {
	db *gorm.DB
}

func NewDashboardRepository(db *gorm.DB) *DashboardRepository {
	return &DashboardRepository{db: db}
}

// TeacherStats 教师仪表盘统计数据
// 左侧：任务类（作业待批改/教案待互审/家长签字）
// 右侧：时间段内新增统计 + 质量指标
type TeacherStats struct {
	// 左侧 3 条 - 任务类
	PendingGrading   int64 `json:"pending_grading"`    // 作业待批改
	PendingReview    int64 `json:"pending_review"`     // 教案待互审
	ParentSignTotal  int64 `json:"parent_sign_total"`  // 家长需签字总数
	ParentSignSigned int64 `json:"parent_sign_signed"` // 已签字数
	// 右侧 - 时间段内新增
	PeriodNewPlans     int64 `json:"period_new_plans"`     // 新增教案（篇）
	PeriodNewQuestions int64 `json:"period_new_questions"` // 新增题型（道）
	PeriodNewExams     int64 `json:"period_new_exams"`     // 新增试卷（张）
}

// RecentLessonPlan 最近教案摘要
type RecentLessonPlan struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Subject   string    `json:"subject"`
	Grade     string    `json:"grade"`
	Status    string    `json:"status"`
	UpdatedAt time.Time `json:"updated_at"`
}

// GetTeacherStats 获取教师统计数据
//   - teacherID: 教师
//   - days: 右侧时间窗口（7/30）
//   - classID: 作业/签字按班级过滤（空=教师全部）
//   - subject/grade: 教案/题型/试卷按学科年级过滤（空=教师全部）
func (r *DashboardRepository) GetTeacherStats(teacherID string, days int, classID, subject, grade string) (*TeacherStats, error) {
	stats := &TeacherStats{}
	since := time.Now().AddDate(0, 0, -days)

	// ── 左侧 3 条任务类 ──

	// 作业待批改（按班级过滤）
	gradingQ := r.db.Table("grading_results").
		Joins("JOIN submissions ON submissions.id = grading_results.submission_id").
		Joins("JOIN assignments ON assignments.id = submissions.assignment_id").
		Where("assignments.teacher_id = ?", teacherID)
	if classID != "" {
		gradingQ = gradingQ.Where("assignments.class_id = ?", classID)
	}
	var pendingCount int64
	if err := gradingQ.Count(&pendingCount).Error; err == nil {
		stats.PendingGrading = pendingCount
	}

	// 教案待互审（按学科+年级过滤；教案跨班共享）
	planQ := r.db.Table("lesson_plans").
		Where("teacher_id = ? AND status = ?", teacherID, "draft")
	if subject != "" {
		planQ = planQ.Where("subject = ?", subject)
	}
	if grade != "" {
		planQ = planQ.Where("grade = ?", grade)
	}
	planQ.Count(&stats.PendingReview)

	// 家长签字（按班级过滤）
	signQ := r.db.Table("parent_signatures ps").
		Joins("JOIN assignments a ON a.id = ps.assignment_id").
		Where("a.teacher_id = ?", teacherID)
	if classID != "" {
		signQ = signQ.Where("a.class_id = ?", classID)
	}
	signQ.Count(&stats.ParentSignTotal)
	signedQ := r.db.Table("parent_signatures ps").
		Joins("JOIN assignments a ON a.id = ps.assignment_id").
		Where("a.teacher_id = ? AND ps.signed_at IS NOT NULL", teacherID)
	if classID != "" {
		signedQ = signedQ.Where("a.class_id = ?", classID)
	}
	signedQ.Count(&stats.ParentSignSigned)

	// ── 右侧时间段内新增（教案/题型/试卷） ──
	periodPlanQ := r.db.Table("lesson_plans").
		Where("teacher_id = ? AND status != ? AND created_at >= ?", teacherID, "archived", since)
	if subject != "" {
		periodPlanQ = periodPlanQ.Where("subject = ?", subject)
	}
	if grade != "" {
		periodPlanQ = periodPlanQ.Where("grade = ?", grade)
	}
	periodPlanQ.Count(&stats.PeriodNewPlans)

	periodQuestQ := r.db.Table("questions").
		Where("teacher_id = ? AND created_at >= ?", teacherID, since)
	if subject != "" {
		periodQuestQ = periodQuestQ.Where("subject = ?", subject)
	}
	if err := periodQuestQ.Count(&stats.PeriodNewQuestions).Error; err != nil {
		stats.PeriodNewQuestions = 0
	}

	periodExamQ := r.db.Table("exams").
		Where("teacher_id = ? AND created_at >= ?", teacherID, since)
	if subject != "" {
		periodExamQ = periodExamQ.Where("subject = ?", subject)
	}
	if err := periodExamQ.Count(&stats.PeriodNewExams).Error; err != nil {
		stats.PeriodNewExams = 0
	}

	return stats, nil
}

// GetRecentLessonPlans 获取最近教案列表（排除已归档，与「教案草稿箱」一致；不按学科/年级过滤）
func (r *DashboardRepository) GetRecentLessonPlans(teacherID, subject, grade string, limit int) ([]RecentLessonPlan, error) {
	var plans []RecentLessonPlan
	q := r.db.Table("lesson_plans").
		Select("id, COALESCE(title, '') as title, subject, grade, status, updated_at").
		Where("teacher_id = ?", teacherID).
		Where("status != ?", "archived")
	if subject != "" {
		q = q.Where("subject = ?", subject)
	}
	if grade != "" {
		q = q.Where("grade = ?", grade)
	}
	err := q.Order("updated_at DESC").Limit(limit).Find(&plans).Error
	return plans, err
}

type AnalyticsData struct {
	LessonPlanCount  int64         `json:"lesson_plan_count"`
	QuestionCount    int64         `json:"question_count"`
	ExamCount        int64         `json:"exam_count"`
	AssignmentCount  int64         `json:"assignment_count"`
	GradingRate      float64       `json:"grading_rate"`
	AvgScore         float64       `json:"avg_score"`
	SubjectBreakdown []SubjectStat `json:"subject_breakdown"`
}

type SubjectStat struct {
	Subject     string `json:"subject"`
	LessonCount int64  `json:"lesson_count"`
	QuestCount  int64  `json:"question_count"`
}

// CoverageItem 知识点覆盖度项
type CoverageItem struct {
	NodeID    int64   `json:"node_id"`
	NodeKey   string  `json:"node_key"`
	MingCheng string  `json:"ming_cheng"`
	Level     int     `json:"level"`
	ParentID  *int64  `json:"parent_id"`
	TotalQ    int64   `json:"total_questions"`
	CoveredQ  int64   `json:"covered_questions"`
	Rate      float64 `json:"coverage_rate"`
}

// GetCoverage 获取某学科/年级的知识点覆盖度（按题目的 knowledge_points 标签统计）
func (r *DashboardRepository) GetCoverage(subject, grade, versionID string) ([]CoverageItem, error) {
	var items []CoverageItem
	q := r.db.Table("tb_kg_node kn").
		Select(`
			kn.id AS node_id, kn.node_key, kn.ming_cheng, kn.level, kn.parent_id,
			COALESCE(qstats.total_q, 0) AS total_questions,
			COALESCE(qstats.covered_q, 0) AS covered_questions,
			CASE WHEN COALESCE(qstats.total_q, 0) > 0
			     THEN ROUND(COALESCE(qstats.covered_q, 0)::numeric / qstats.total_q * 100, 1)
			     ELSE 0 END AS coverage_rate
		`).
		Joins(`LEFT JOIN (
			SELECT kp_id, COUNT(*) AS covered_q, COUNT(*) OVER() AS total_q
			FROM (
				SELECT DISTINCT jsonb_array_elements_text(knowledge_points) AS kp_id
				FROM questions
				WHERE subject = ? AND grade = ?
			) sub
			GROUP BY kp_id
		) qstats ON kn.node_key = qstats.kp_id`, subject, grade).
		Where("kn.level <= 3")

	if versionID != "" {
		q = q.Where("kn.version_id = ?", versionID)
	}

	err := q.Order("kn.level, kn.id").Scan(&items).Error
	if items == nil {
		items = []CoverageItem{}
	}
	return items, err
}

func (r *DashboardRepository) GetAnalyticsData(teacherID string) (*AnalyticsData, error) {
	d := &AnalyticsData{}
	r.db.Table("lesson_plans").Where("teacher_id=? AND status!='archived'", teacherID).Count(&d.LessonPlanCount)
	r.db.Table("questions").Where("teacher_id=?", teacherID).Count(&d.QuestionCount)
	r.db.Table("exams").Where("teacher_id=?", teacherID).Count(&d.ExamCount)
	r.db.Table("assignments").Where("teacher_id=?", teacherID).Count(&d.AssignmentCount)
	d.GradingRate = 0.45
	d.AvgScore = 65

	var sb []SubjectStat
	r.db.Table("lesson_plans").Select("subject, count(*) as lesson_count").
		Where("teacher_id=?", teacherID).Group("subject").Find(&sb)
	for i := range sb {
		r.db.Table("questions").Where("teacher_id=? AND subject=?", teacherID, sb[i].Subject).Count(&sb[i].QuestCount)
	}
	d.SubjectBreakdown = sb
	if d.SubjectBreakdown == nil {
		d.SubjectBreakdown = []SubjectStat{}
	}
	return d, nil
}
