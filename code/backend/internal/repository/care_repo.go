package repository

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// GrowthCareRecord 成长关爱记录（有据引擎承载体）
// 表名 growth_care_records，与现有 shell 表对齐
type GrowthCareRecord struct {
	ID                 string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	StudentID          string         `gorm:"column:student_id;type:varchar(30);not null;index:idx_care_student" json:"student_id"`
	TeacherID          string         `gorm:"column:teacher_id;type:varchar(30);not null;index:idx_care_teacher" json:"teacher_id"`
	SchoolID           string         `gorm:"column:school_id;type:varchar(30);not null;index" json:"school_id"`
	CurrentStatus      string         `gorm:"column:current_status;type:text" json:"current_status"`
	DataBasis          datatypes.JSON `gorm:"column:data_basis;type:jsonb" json:"data_basis,omitempty"`
	AiAssessment       string         `gorm:"column:ai_assessment;type:text" json:"ai_assessment"`
	TeacherObservation string         `gorm:"column:teacher_observation;type:text" json:"teacher_observation"`
	WeeklyPlan         datatypes.JSON `gorm:"column:weekly_plan;type:jsonb" json:"weekly_plan,omitempty"`
	PlanStatus         string         `gorm:"column:plan_status;type:varchar(20);default:'draft'" json:"plan_status"`
	KindnessReviewed   bool           `gorm:"column:kindness_reviewed;default:false" json:"kindness_reviewed"`
	ParentNotified     bool           `gorm:"column:parent_notified;default:false" json:"parent_notified"`
	ParentConfirmed    bool           `gorm:"column:parent_confirmed;default:false" json:"parent_confirmed"`
	TeacherGroup       string         `gorm:"column:teacher_group;type:varchar(50)" json:"teacher_group"`
	FocusArea          string         `gorm:"column:focus_area;type:text" json:"focus_area"`
	RemovedDate        *time.Time     `gorm:"column:removed_date" json:"removed_date,omitempty"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
}

func (GrowthCareRecord) TableName() string {
	return "growth_care_records"
}

// CareStudentView 成长关爱学生视图（含用户基本信息 join）
type CareStudentView struct {
	ID                 string  `json:"id"`
	StudentID          string  `json:"student_id"`
	StudentName        string  `json:"student_name"`
	StudentNo          string  `json:"student_no" gorm:"column:student_number"`
	Gender             string  `json:"gender"`
	Grade              int     `json:"grade"`
	ClassName          string  `json:"class_name"`
	CurrentStatus      string  `json:"current_status"`
	FocusArea          string  `json:"focus_area"`
	PlanStatus         string  `json:"plan_status"`
	PlanProgress       int     `json:"plan_progress"`
	Accuracy           float64 `json:"accuracy"`
	AccuracyTrend      string  `json:"accuracy_trend"`
	AccuracyChange     float64 `json:"accuracy_change"`
	TeacherObservation string  `json:"teacher_observation"`
	EnrolledDate       string  `json:"enrolled_date"`
	RemovedDate        *string `json:"removed_date,omitempty"`
	Status             string  `json:"status"` // activated | pending | removed
}

// CareRepository 成长关爱数据访问
type CareRepository struct {
	db *gorm.DB
}

func NewCareRepository(db *gorm.DB) *CareRepository {
	return &CareRepository{db: db}
}

func (r *CareRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&GrowthCareRecord{})
}

func (r *CareRepository) Create(record *GrowthCareRecord) error {
	return r.db.Create(record).Error
}

func (r *CareRepository) FindByID(id string) (*GrowthCareRecord, error) {
	var record GrowthCareRecord
	err := r.db.Where("id = ?", id).First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *CareRepository) FindByStudentAndTeacher(studentID, teacherID string) (*GrowthCareRecord, error) {
	var record GrowthCareRecord
	err := r.db.Where("student_id = ? AND teacher_id = ?", studentID, teacherID).First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

// ListByTeacher 列出教师所有关怀学生（含用户信息 join）
func (r *CareRepository) ListByTeacher(teacherID, schoolID string) ([]CareStudentView, error) {
	var results []CareStudentView
	err := r.db.Table("growth_care_records gcr").
		Select(`
			gcr.id, gcr.student_id,
			u.name AS student_name, u.student_number AS student_no, '' AS gender,
			CASE
				WHEN c.grade LIKE '%一%' THEN 1 WHEN c.grade LIKE '%二%' THEN 2
				WHEN c.grade LIKE '%三%' THEN 3 WHEN c.grade LIKE '%四%' THEN 4
				WHEN c.grade LIKE '%五%' THEN 5 WHEN c.grade LIKE '%六%' THEN 6
				WHEN c.grade LIKE '%七%' THEN 7 WHEN c.grade LIKE '%八%' THEN 8
				WHEN c.grade LIKE '%九%' THEN 9 ELSE 0
			END AS grade,
			COALESCE(c.name, '') AS class_name,
			gcr.current_status, gcr.focus_area,
			gcr.plan_status,
			gcr.teacher_observation,
			COALESCE((gcr.data_basis->>'plan_progress')::int, 0) AS plan_progress,
			COALESCE((gcr.data_basis->>'accuracy')::numeric, 0) AS accuracy,
			COALESCE(gcr.data_basis->>'accuracy_trend', 'flat') AS accuracy_trend,
			COALESCE((gcr.data_basis->>'accuracy_change')::numeric, 0) AS accuracy_change,
			gcr.created_at::text AS enrolled_date,
			gcr.removed_date::text AS removed_date,
			CASE WHEN gcr.removed_date IS NOT NULL THEN 'removed'
			     WHEN gcr.plan_status = 'draft' THEN 'pending'
			     ELSE 'activated' END AS status
		`).
		Joins("LEFT JOIN users u ON gcr.student_id = u.id").
		Joins("LEFT JOIN student_classes sc ON sc.student_id = gcr.student_id").
		Joins("LEFT JOIN classes c ON sc.class_id = c.id").
		Where("gcr.teacher_id = ? AND gcr.school_id = ?", teacherID, schoolID).
		Order("gcr.created_at DESC").
		Scan(&results).Error
	if results == nil {
		results = []CareStudentView{}
	}
	return results, err
}

func (r *CareRepository) Update(record *GrowthCareRecord) error {
	record.UpdatedAt = time.Now()
	return r.db.Save(record).Error
}

func (r *CareRepository) PatchFocusArea(id, teacherID, focusArea string) error {
	return r.db.Model(&GrowthCareRecord{}).
		Where("id = ? AND teacher_id = ?", id, teacherID).
		Updates(map[string]interface{}{
			"focus_area": focusArea,
			"updated_at": time.Now(),
		}).Error
}

// SoftRemove 软移除（设置 removed_date + plan_status='removed'）
func (r *CareRepository) SoftRemove(id, teacherID string) error {
	now := time.Now()
	return r.db.Model(&GrowthCareRecord{}).
		Where("id = ? AND teacher_id = ?", id, teacherID).
		Updates(map[string]interface{}{
			"removed_date": &now,
			"plan_status":  "removed",
			"updated_at":   now,
		}).Error
}

func (r *CareRepository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&GrowthCareRecord{}).Error
}
