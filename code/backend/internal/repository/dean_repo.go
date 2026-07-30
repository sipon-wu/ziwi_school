package repository

import (
	"time"

	"gorm.io/gorm"
)

// DeanClass 教务班级视图
type DeanClass struct {
	ID              string    `gorm:"type:varchar(50)" json:"id"`
	SchoolID        string    `gorm:"type:varchar(50)" json:"school_id"`
	Name            string    `gorm:"type:varchar(100)" json:"name"`
	Grade           string    `gorm:"type:varchar(20)" json:"grade"`
	ClassType       string    `gorm:"type:varchar(20)" json:"class_type"`
	HeadTeacherID   *string   `gorm:"type:varchar(50)" json:"head_teacher_id"`
	HeadTeacherName string    `gorm:"->" json:"head_teacher_name"`
	StudentCount    int64     `gorm:"->" json:"student_count"`
	CreatedAt       time.Time `json:"created_at"`
}

// DeanTeacher 教务教师视图
type DeanTeacher struct {
	ID        string `gorm:"type:varchar(50)" json:"id"`
	Name      string `gorm:"type:varchar(100)" json:"name"`
	Phone     string `gorm:"type:varchar(20)" json:"phone"`
	Role      string `gorm:"type:varchar(30)" json:"role"`
	Subject   string `json:"subject"`
	ClassName string `json:"class_name"`
}

// Semester 学期
type Semester struct {
	ID        string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID  string    `gorm:"type:varchar(50);not null;index" json:"school_id"`
	Name      string    `gorm:"type:varchar(100);not null" json:"name"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
	IsCurrent bool      `gorm:"default:false" json:"is_current"`
	CreatedAt time.Time `json:"created_at"`
}

func (Semester) TableName() string {
	return "semesters"
}

// CourseSchedule 课程安排
type CourseSchedule struct {
	ID          string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID    string    `gorm:"type:varchar(50);not null;index" json:"school_id"`
	ClassID     string    `gorm:"type:varchar(50);not null;index" json:"class_id"`
	ClassName   string    `gorm:"->" json:"class_name"`
	Subject     string    `gorm:"type:varchar(20);not null" json:"subject"`
	TeacherID   string    `gorm:"type:varchar(50)" json:"teacher_id"`
	TeacherName string    `gorm:"->" json:"teacher_name"`
	DayOfWeek   int       `json:"day_of_week"` // 1-5 周一至周五
	Period      int       `json:"period"`      // 1-8 节次
	CreatedAt   time.Time `json:"created_at"`
}

func (CourseSchedule) TableName() string {
	return "course_schedules"
}

type DeanRepository struct {
	db *gorm.DB
}

func NewDeanRepository(db *gorm.DB) *DeanRepository {
	return &DeanRepository{db: db}
}

func (r *DeanRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&Semester{}, &CourseSchedule{})
}

// ListClasses 班级列表
func (r *DeanRepository) ListClasses(schoolID string) ([]DeanClass, error) {
	var classes []DeanClass
	err := r.db.Raw(`
		SELECT c.id, c.school_id, c.name, c.grade, c.class_type,
			c.head_teacher_id, '' AS head_teacher_name,
			0 AS student_count, c.created_at
		FROM classes c
		WHERE c.school_id = ?
		ORDER BY c.grade, c.name
	`, schoolID).Scan(&classes).Error
	return classes, err
}

// ListTeachers 教师列表
func (r *DeanRepository) ListTeachers(schoolID string) ([]DeanTeacher, error) {
	var teachers []DeanTeacher
	err := r.db.Raw(`
		SELECT u.id, u.name, u.phone, u.role, '' as subject, '' as class_name
		FROM users u
		WHERE u.school_id = ? AND u.role IN ('teacher','head_teacher','research_lead','registrar')
		ORDER BY u.name
	`, schoolID).Scan(&teachers).Error
	return teachers, err
}

// ListSemesters 学期列表
func (r *DeanRepository) ListSemesters(schoolID string) ([]Semester, error) {
	var semesters []Semester
	err := r.db.Where("school_id = ?", schoolID).Order("start_date DESC").Find(&semesters).Error
	return semesters, err
}

// CreateSemester 创建学期
func (r *DeanRepository) CreateSemester(s *Semester) error {
	return r.db.Create(s).Error
}

// ListCourseSchedules 课程安排列表
func (r *DeanRepository) ListCourseSchedules(schoolID string) ([]CourseSchedule, error) {
	var schedules []CourseSchedule
	err := r.db.Raw(`
		SELECT cs.id, cs.school_id, cs.class_id, c.name as class_name,
			cs.subject, cs.teacher_id, u.name as teacher_name,
			cs.day_of_week, cs.period, cs.created_at
		FROM course_schedules cs
		LEFT JOIN classes c ON c.id = cs.class_id
		LEFT JOIN users u ON u.id = cs.teacher_id
		WHERE cs.school_id = ?
		ORDER BY cs.day_of_week, cs.period
	`, schoolID).Scan(&schedules).Error
	return schedules, err
}

// CreateCourseSchedule 创建课程安排
func (r *DeanRepository) CreateCourseSchedule(s *CourseSchedule) error {
	return r.db.Create(s).Error
}
