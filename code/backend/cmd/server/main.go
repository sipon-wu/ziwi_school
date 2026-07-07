package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/config"
	"github.com/zhiwei/backend/internal/handler"
	"github.com/zhiwei/backend/internal/middleware"
	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"
)

func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 连接数据库
	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	sqlDB, _ := db.DB()
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// 自动迁移（开发阶段）
	if err := db.AutoMigrate(&model.School{}, &model.User{}); err != nil {
		log.Printf("Warning: AutoMigrate failed: %v", err)
	}

	// 初始化仓库
	userRepo := repository.NewUserRepository(db)
	dashboardRepo := repository.NewDashboardRepository(db)
	lessonRepo := repository.NewLessonRepository(db)
	exerciseRepo := repository.NewExerciseRepository(db)
	assignmentRepo := repository.NewAssignmentRepository(db)
	deanRepo := repository.NewDeanRepository(db)
	itRepo := repository.NewITRepository(db)
	opsRepo := repository.NewOpsRepository(db)
	researchRepo := repository.NewResearchRepository(db)
	materialRepo := repository.NewMaterialRepository(db)
	examRepo := repository.NewExamRepository(db)

	// 初始化 handler
	authHandler := handler.NewAuthHandler(userRepo, cfg.JWTSecret)
	analyticsHandler := handler.NewAnalyticsHandler(dashboardRepo)
	lessonHandler := handler.NewLessonHandler(lessonRepo)
	exerciseHandler := handler.NewExerciseHandler(exerciseRepo)
	assignmentHandler := handler.NewAssignmentHandler(assignmentRepo)
	materialHandler := handler.NewMaterialHandler(materialRepo)
	examHandler := handler.NewExamHandler(examRepo)
	deanHandler := handler.NewDeanHandler(deanRepo)
	itHandler := handler.NewITHandler(itRepo)
	opsHandler := handler.NewOpsHandler(opsRepo)
	researchHandler := handler.NewResearchHandler(researchRepo)
	devopsHandler := handler.NewDevOpsHandler()
	studentHandler := handler.NewStudentHandler()
	principalHandler := handler.NewPrincipalHandler(db)
	scHandler := handler.NewSchoolClassHandler(db)

	// 创建路由
	r := gin.Default()

	// 全局中间件
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())

	// 健康检查
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "version": "1.0.0"})
	})

	// 认证路由（无需 JWT）
	auth := r.Group("/api/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.RefreshToken)
	}

	// 需要 JWT 认证的路由
	api := r.Group("/api")
	api.Use(middleware.JWTAuth(cfg.JWTSecret))

	// ── 8 角色路由分组 ──

	// 教师端（teacher + head_teacher）
	teacher := api.Group("")
	teacher.Use(middleware.RequireRole("teacher", "head_teacher"))
	{
		// 教案
		teacher.GET("/lesson-plans", lessonHandler.ListLessonPlans)
		teacher.POST("/lesson-plans", lessonHandler.CreateLessonPlan)
		teacher.GET("/lesson-plans/:id", lessonHandler.GetLessonPlan)
		teacher.PUT("/lesson-plans/:id", lessonHandler.UpdateLessonPlan)
		teacher.DELETE("/lesson-plans/:id", lessonHandler.DeleteLessonPlan)
		// 出题
		teacher.GET("/exercises", exerciseHandler.ListQuestions)
		teacher.POST("/exercises", exerciseHandler.CreateQuestion)
		teacher.PUT("/exercises/:id", exerciseHandler.UpdateQuestion)
		// 组卷
		teacher.GET("/exams", examHandler.ListExams)
		teacher.POST("/exams", examHandler.CreateExam)
		teacher.GET("/exams/:id", examHandler.GetExam)
		teacher.PUT("/exams/:id", examHandler.UpdateExam)
		teacher.DELETE("/exams/:id", examHandler.DeleteExam)
		// 作业
		teacher.GET("/assignments", assignmentHandler.ListAssignments)
		teacher.POST("/assignments", assignmentHandler.CreateAssignment)
		// 批阅
		teacher.GET("/grading", placeholder("list grading"))
		teacher.POST("/grading/:id", placeholder("submit grade"))
		// 学情
		teacher.GET("/analytics/teacher-dashboard", analyticsHandler.GetTeacherDashboard)
		teacher.GET("/analytics", analyticsHandler.GetAnalytics)
		// 家校
		teacher.GET("/parent/signatures", placeholder("list signatures"))
		// 素材
		teacher.GET("/materials", materialHandler.ListMaterials)
		teacher.POST("/materials", materialHandler.UploadMaterial)
		// 学校/班级归档
		teacher.PUT("/schools/:id/archive", scHandler.ArchiveSchool)
		teacher.PUT("/schools/:id/restore", scHandler.RestoreSchool)
		teacher.PUT("/classes/:id/archive", scHandler.ArchiveClass)
		teacher.PUT("/classes/:id/restore", scHandler.RestoreClass)
		teacher.GET("/schools/lookup", scHandler.LookupSchool)
		teacher.PUT("/user/profile", authHandler.UpdateProfile)
	}

	// 教研组长端
	research := api.Group("")
	research.Use(middleware.RequireRole("research_lead"))
	{
		research.GET("/research/reviews", researchHandler.ListReviews)
		research.GET("/research/dashboard", researchHandler.GetDashboard)
		research.GET("/research/methodology", researchHandler.ListMethodologies)
	}

	// 教务员端
	registrar := api.Group("")
	registrar.Use(middleware.RequireRole("registrar"))
	{
		registrar.GET("/dean/classes", deanHandler.ListClasses)
		registrar.GET("/dean/schedule", deanHandler.ListCourseSchedules)
		registrar.POST("/dean/schedule", deanHandler.CreateCourseSchedule)
		registrar.GET("/dean/teachers", deanHandler.ListTeachers)
		registrar.GET("/dean/semesters", deanHandler.ListSemesters)
		registrar.POST("/dean/semesters", deanHandler.CreateSemester)
	}

	// 校长端
	principal := api.Group("")
	principal.Use(middleware.RequireRole("principal"))
	{
		principal.GET("/principal/dashboard", principalHandler.Dashboard)
		principal.GET("/principal/analytics", principalHandler.Analytics)
	}

	// IT 管理员端
	itAdmin := api.Group("")
	itAdmin.Use(middleware.RequireRole("it_admin"))
	{
		itAdmin.GET("/admin/users", itHandler.ListUsers)
		itAdmin.GET("/admin/contacts", itHandler.ListContacts)
		itAdmin.GET("/admin/textbooks", itHandler.ListTextbookVersions)
	}

	// 平台运营端
	platformOps := api.Group("")
	platformOps.Use(middleware.RequireRole("platform_ops"))
	{
		platformOps.GET("/platform/tokens", opsHandler.ListTokenUsage)
		platformOps.GET("/platform/licenses", opsHandler.ListLicenses)
		platformOps.GET("/platform/announcements", opsHandler.ListAnnouncements)
		platformOps.POST("/platform/announcements", opsHandler.CreateAnnouncement)
		platformOps.GET("/platform/audit", opsHandler.ListContentAudit)
		platformOps.GET("/platform/finance", opsHandler.GetFinanceSummary)
		platformOps.GET("/platform/invoices", opsHandler.ListInvoices)
		platformOps.GET("/platform/support", opsHandler.ListSupportTickets)
	}

	// 平台运维端
	platformDevOps := api.Group("")
	platformDevOps.Use(middleware.RequireRole("platform_devops"))
	{
		platformDevOps.GET("/devops/monitor", devopsHandler.GetMonitor)
	}

	// 学生端（需JWT认证）
	student := api.Group("")
	student.Use(middleware.RequireRole("student"))
	{
		student.GET("/student/assignments", studentHandler.ListAssignments)
		student.GET("/student/error-book", studentHandler.GetErrorBook)
	}

	// 启动服务器
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// placeholder 返回一个占位 handler
func placeholder(msg string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": msg, "status": "not_implemented"})
	}
}
