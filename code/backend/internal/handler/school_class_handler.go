package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/repository"
)

type SchoolClassHandler struct{ db *gorm.DB }

func NewSchoolClassHandler(db *gorm.DB) *SchoolClassHandler { return &SchoolClassHandler{db} }

func (h *SchoolClassHandler) ArchiveSchool(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	id := c.Param("id")
	if schoolID.(string) != id {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "只能操作自己的学校"})
		return
	}
	h.db.Exec("UPDATE schools SET status='archived' WHERE id=?", id)
	h.db.Exec("UPDATE classes SET status='archived' WHERE school_id=?", id)
	c.JSON(http.StatusOK, gin.H{"message": "archived"})
}

func (h *SchoolClassHandler) RestoreSchool(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	id := c.Param("id")
	if schoolID.(string) != id {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "只能操作自己的学校"})
		return
	}
	h.db.Exec("UPDATE schools SET status='active' WHERE id=?", id)
	c.JSON(http.StatusOK, gin.H{"message": "restored"})
}

func (h *SchoolClassHandler) ArchiveClass(c *gin.Context) {
	id := c.Param("id")
	h.db.Exec("UPDATE classes SET status='archived' WHERE id=?", id)
	c.JSON(http.StatusOK, gin.H{"message": "archived"})
}

func (h *SchoolClassHandler) RestoreClass(c *gin.Context) {
	id := c.Param("id")
	h.db.Exec("UPDATE classes SET status='active' WHERE id=?", id)
	c.JSON(http.StatusOK, gin.H{"message": "restored"})
}

// ListClasses 教师端班级列表（出题页班级下拉使用）
// GET /api/classes
func (h *SchoolClassHandler) ListClasses(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	var classes []repository.DeanClass
	h.db.Raw(`
		SELECT c.id, c.school_id, c.name, c.grade, c.status AS class_type,
			NULL::uuid AS head_teacher_id, '' AS head_teacher_name,
			0 AS student_count, c.created_at
		FROM classes c
		WHERE c.school_id = ? AND c.status = 'active'
		ORDER BY c.grade, c.name
	`, schoolIDStr).Scan(&classes)
	if classes == nil {
		classes = []repository.DeanClass{}
	}
	c.JSON(http.StatusOK, gin.H{"items": classes})
}

// MyClasses 当前教师任教的「班级-学科」列表（支持一课多班、一班多学科）
// GET /api/my-classes
func (h *SchoolClassHandler) MyClasses(c *gin.Context) {
	uid, _ := c.Get("user_id")
	uidStr, _ := uid.(string)
	var items []struct {
		ClassID   string `json:"class_id"`
		ClassName string `json:"class_name"`
		Grade     string `json:"grade"`
		Subject   string `json:"subject"`
		IsPrimary bool   `json:"is_primary"`
	}
	h.db.Raw(`
		SELECT tc.class_id, c.name AS class_name, c.grade, tc.subject, tc.is_primary
		FROM teacher_classes tc
		JOIN classes c ON c.id = tc.class_id
		WHERE tc.teacher_id = ?
		ORDER BY tc.is_primary DESC, c.grade, c.name, tc.subject
	`, uidStr).Scan(&items)
	if items == nil {
		items = []struct {
			ClassID   string `json:"class_id"`
			ClassName string `json:"class_name"`
			Grade     string `json:"grade"`
			Subject   string `json:"subject"`
			IsPrimary bool   `json:"is_primary"`
		}{}
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *SchoolClassHandler) LookupSchool(c *gin.Context) {
	name := c.Query("name")
	if name == "" {
		c.JSON(http.StatusOK, gin.H{"found": false, "message": "name required"})
		return
	}
	var existing struct {
		ID        string `json:"id"`
		FullName  string `json:"full_name"`
		ShortName string `json:"short_name"`
	}
	err := h.db.Table("schools").Select("id, name as full_name, name as short_name").
		Where("(name ILIKE ? OR name ILIKE ?)", "%"+name+"%", "%"+name+"%").
		Where("status = 'active'").First(&existing).Error
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"found": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"found": true, "school": existing})
}
