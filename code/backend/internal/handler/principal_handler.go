package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PrincipalHandler struct{ db *gorm.DB }

func NewPrincipalHandler(db *gorm.DB) *PrincipalHandler { return &PrincipalHandler{db: db} }

func (h *PrincipalHandler) Dashboard(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	sid := schoolID.(string)

	var stats struct {
		TeacherCount int64 `json:"teacher_count"`
		StudentCount int64 `json:"student_count"`
		ClassCount   int64 `json:"class_count"`
		LessonCount  int64 `json:"lesson_count"`
		ExamCount    int64 `json:"exam_count"`
	}
	h.db.Table("users").Where("school_id=? AND role IN ('teacher','head_teacher')", sid).Count(&stats.TeacherCount)
	h.db.Table("users").Where("school_id=? AND role='student'", sid).Count(&stats.StudentCount)
	h.db.Table("classes").Where("school_id=?", sid).Count(&stats.ClassCount)
	h.db.Table("lesson_plans").Where("school_id=?", sid).Count(&stats.LessonCount)
	h.db.Table("exams").Where("school_id=?", sid).Count(&stats.ExamCount)

	c.JSON(http.StatusOK, stats)
}

func (h *PrincipalHandler) Analytics(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	sid := schoolID.(string)

	var grades []struct {
		Grade     string `json:"grade"`
		AvgScore  float64 `json:"avg_score"`
		ExamCount int64  `json:"exam_count"`
	}
	h.db.Table("exam_scores").Select("es.grade, COALESCE(AVG(es.score*100.0/NULLIF(es.full_score,0)),0) as avg_score, COUNT(*) as exam_count").
		Joins("JOIN users u ON u.id = es.student_id").
		Where("u.school_id=?", sid).
		Group("es.grade").Find(&grades)
	if grades == nil { grades = []struct {
		Grade string `json:"grade"`
		AvgScore float64 `json:"avg_score"`
		ExamCount int64 `json:"exam_count"`
	}{} }
	c.JSON(http.StatusOK, gin.H{"grades": grades})
}
