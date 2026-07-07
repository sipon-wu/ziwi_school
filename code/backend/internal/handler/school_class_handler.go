package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SchoolClassHandler struct{ db *gorm.DB }

func NewSchoolClassHandler(db *gorm.DB) *SchoolClassHandler { return &SchoolClassHandler{db} }

func (h *SchoolClassHandler) ArchiveSchool(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	id := c.Param("id")
	if schoolID.(string) != id {
		c.JSON(http.StatusForbidden, gin.H{"error": "只能操作自己的学校"})
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
		c.JSON(http.StatusForbidden, gin.H{"error": "只能操作自己的学校"})
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
