package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SchoolClassHandler struct{ db *gorm.DB }

func NewSchoolClassHandler(db *gorm.DB) *SchoolClassHandler { return &SchoolClassHandler{db} }

// ArchiveSchool PUT /api/schools/:id/archive
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

// RestoreSchool PUT /api/schools/:id/restore
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

// ArchiveClass PUT /api/classes/:id/archive
func (h *SchoolClassHandler) ArchiveClass(c *gin.Context) {
	id := c.Param("id")
	h.db.Exec("UPDATE classes SET status='archived' WHERE id=?", id)
	c.JSON(http.StatusOK, gin.H{"message": "archived"})
}

// RestoreClass PUT /api/classes/:id/restore
func (h *SchoolClassHandler) RestoreClass(c *gin.Context) {
	id := c.Param("id")
	h.db.Exec("UPDATE classes SET status='active' WHERE id=?", id)
	c.JSON(http.StatusOK, gin.H{"message": "restored"})
}
