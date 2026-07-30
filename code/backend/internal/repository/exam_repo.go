package repository

import (
	"time"

	"github.com/zhiwei/backend/internal/model"
	"gorm.io/gorm"
)

type ExamRepository struct {
	db *gorm.DB
}

func NewExamRepository(db *gorm.DB) *ExamRepository {
	return &ExamRepository{db: db}
}

// List 返回某教师在本校的试卷（按 teacher_id 隔离，避免跨教师数据越权/错乱）。
func (r *ExamRepository) List(schoolID, teacherID string) ([]model.Exam, error) {
	var exams []model.Exam
	err := r.db.Where("school_id = ? AND teacher_id = ?", schoolID, teacherID).Order("created_at DESC").Find(&exams).Error
	return exams, err
}

func (r *ExamRepository) GetByID(id string) (*model.Exam, error) {
	var exam model.Exam
	err := r.db.Where("id = ?", id).First(&exam).Error
	if err != nil {
		return nil, err
	}
	return &exam, nil
}

func (r *ExamRepository) Create(exam *model.Exam) error {
	return r.db.Create(exam).Error
}

func (r *ExamRepository) Update(exam *model.Exam) error {
	return r.db.Save(exam).Error
}

func (r *ExamRepository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&model.Exam{}).Error
}

// Seed inserts demo exam data
func (r *ExamRepository) Seed(schoolID, teacherID string) error {
	exams := []model.Exam{
		{
			ID: "e0000001-0000-0000-0000-000000000001", SchoolID: schoolID, TeacherID: teacherID,
			Title: "期末模拟试卷1（黄冈中学）", Subject: "语文", Grade: "四年级",
			Questions:  `[{"qid":"a0000001-0000-0000-0000-000000000001","sort":1,"score":10},{"qid":"a0000001-0000-0000-0000-000000000002","sort":2,"score":10},{"qid":"a0000001-0000-0000-0000-000000000003","sort":3,"score":10},{"qid":"a0000001-0000-0000-0000-000000000009","sort":4,"score":10},{"qid":"a0000001-0000-0000-0000-000000000005","sort":5,"score":15},{"qid":"a0000001-0000-0000-0000-000000000010","sort":6,"score":45}]`,
			TotalScore: 100, DurationMinutes: 60, Difficulty: "L2", Status: "draft",
			CreatedAt: time.Now().Add(-6 * 24 * time.Hour), UpdatedAt: time.Now().Add(-6 * 24 * time.Hour),
		},
		{
			ID: "e0000001-0000-0000-0000-000000000002", SchoolID: schoolID, TeacherID: teacherID,
			Title: "期末模拟试卷2（人大附中）", Subject: "语文", Grade: "四年级",
			Questions:  `[{"qid":"a0000001-0000-0000-0000-000000000007","sort":1,"score":10},{"qid":"a0000001-0000-0000-0000-000000000008","sort":2,"score":10},{"qid":"a0000001-0000-0000-0000-000000000004","sort":3,"score":10},{"qid":"a0000001-0000-0000-0000-000000000003","sort":4,"score":15},{"qid":"a0000001-0000-0000-0000-000000000001","sort":5,"score":55}]`,
			TotalScore: 100, DurationMinutes: 60, Difficulty: "L2", Status: "published",
			CreatedAt: time.Now().Add(-10 * 24 * time.Hour), UpdatedAt: time.Now().Add(-8 * 24 * time.Hour),
		},
		{
			ID: "e0000001-0000-0000-0000-000000000003", SchoolID: schoolID, TeacherID: teacherID,
			Title: "《观潮》单元测试", Subject: "语文", Grade: "四年级",
			Questions:  `[{"qid":"a0000001-0000-0000-0000-000000000009","sort":1,"score":10},{"qid":"a0000001-0000-0000-0000-000000000002","sort":2,"score":10},{"qid":"a0000001-0000-0000-0000-000000000005","sort":3,"score":15},{"qid":"a0000001-0000-0000-0000-000000000006","sort":4,"score":15},{"qid":"a0000001-0000-0000-0000-000000000010","sort":5,"score":50}]`,
			TotalScore: 100, DurationMinutes: 45, Difficulty: "L1", Status: "draft",
			CreatedAt: time.Now().Add(-3 * 24 * time.Hour), UpdatedAt: time.Now().Add(-3 * 24 * time.Hour),
		},
	}
	for _, e := range exams {
		if err := r.db.Where("id = ?", e.ID).FirstOrCreate(&e).Error; err != nil {
			return err
		}
	}
	return nil
}
