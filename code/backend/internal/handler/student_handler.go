package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type StudentHandler struct{}

func NewStudentHandler() *StudentHandler {
	return &StudentHandler{}
}

// ListAssignments 学生作业列表
// GET /api/student/assignments
func (h *StudentHandler) ListAssignments(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"items": []gin.H{
			{"id": "sa-1", "title": "第四单元测试", "subject": "语文", "due_hours": 12, "status": "pending"},
			{"id": "sa-2", "title": "分数加减法练习", "subject": "数学", "due_hours": 6, "status": "submitted"},
		},
	})
}

// GetErrorBook 错题本
// GET /api/student/error-book
func (h *StudentHandler) GetErrorBook(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"items": []gin.H{
			{"id": "eb-1", "question_stem": "下列词语中，读音完全正确的一组是...", "subject": "语文", "wrong_count": 2},
			{"id": "eb-2", "question_stem": "计算：3/4 + 1/2 = ?", "subject": "数学", "wrong_count": 1},
		},
	})
}
