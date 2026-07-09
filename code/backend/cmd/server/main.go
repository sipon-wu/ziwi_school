package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/config"
	"github.com/zhiwei/backend/internal/handler"
	"github.com/zhiwei/backend/internal/middleware"
	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"

	"github.com/zhiwei/backend/internal/cloud"
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

	// 自动迁移（开发阶段）→ 现作为发布管线的一部分：每次部署后端重启即同步全表结构与运行时代码 model 一致
	if err := db.AutoMigrate(
		&model.School{}, &model.User{}, &model.Class{},
		&model.TeacherClass{}, &model.StudentClass{}, &model.LessonPlan{},
		&model.Exam{}, &model.Material{}, &model.ImportBatch{},
		&repository.Question{}, &repository.Assignment{},
		&model.TextbookVersion{}, &model.StandardClause{},
		&model.VersionStandardMap{}, &model.KGNode{}, &model.KGEdge{},
		&model.SchoolTextbookOverride{},
	); err != nil {
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
	importRepo := repository.NewImportRepository(db)
	opsRepo := repository.NewOpsRepository(db)
	researchRepo := repository.NewResearchRepository(db)
	materialRepo := repository.NewMaterialRepository(db)
	examRepo := repository.NewExamRepository(db)

	// 其余 GORM 托管的业务表随 model 演进自动同步（发布管线的一部分，幂等）
	for _, m := range []func() error{researchRepo.AutoMigrate, deanRepo.AutoMigrate, opsRepo.AutoMigrate} {
		if err := m(); err != nil {
			log.Printf("Warning: AutoMigrate failed: %v", err)
		}
	}
	// 无 GORM model 但运行必需的表（幂等建表，对齐 seed/full）
	db.Exec(`CREATE TABLE IF NOT EXISTS growth_care_records (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		student_id VARCHAR(30) REFERENCES users(id),
		teacher_id VARCHAR(30) REFERENCES users(id),
		school_id VARCHAR(30) REFERENCES schools(id),
		current_status TEXT,
		data_basis JSONB,
		ai_assessment TEXT,
		teacher_observation TEXT,
		weekly_plan JSONB,
		plan_status VARCHAR(20) DEFAULT 'draft',
		kindness_reviewed BOOLEAN DEFAULT FALSE,
		parent_notified BOOLEAN DEFAULT FALSE,
		parent_confirmed BOOLEAN DEFAULT FALSE,
		teacher_group VARCHAR(50),
		created_at TIMESTAMPTZ DEFAULT NOW(),
		updated_at TIMESTAMPTZ DEFAULT NOW()
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS parent_signatures (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		parent_id VARCHAR(30) REFERENCES users(id),
		student_id VARCHAR(30) REFERENCES users(id),
		assignment_id VARCHAR(50) REFERENCES assignments(id),
		signed_at TIMESTAMPTZ DEFAULT NOW(),
		reminded_at TIMESTAMPTZ
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS submissions (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		assignment_id VARCHAR(50) REFERENCES assignments(id),
		student_id VARCHAR(30) REFERENCES users(id),
		answers JSONB,
		submitted_at TIMESTAMPTZ DEFAULT NOW()
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS grading_results (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		submission_id UUID REFERENCES submissions(id),
		question_id VARCHAR(50),
		ai_score DECIMAL(5,2),
		ai_confidence DECIMAL(4,3),
		status VARCHAR(20) DEFAULT 'pending',
		graded_at TIMESTAMPTZ
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS student_observations (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		student_id VARCHAR(30) REFERENCES users(id),
		teacher_id VARCHAR(30) REFERENCES users(id),
		school_id VARCHAR(30) REFERENCES schools(id),
		description TEXT,
		observed_at TIMESTAMPTZ DEFAULT NOW()
	)`)

	// 初始化 handler
	authHandler := handler.NewAuthHandler(userRepo, cfg.JWTSecret)
	analyticsHandler := handler.NewAnalyticsHandler(dashboardRepo)
	lessonHandler := handler.NewLessonHandler(lessonRepo)
	exerciseHandler := handler.NewExerciseHandler(exerciseRepo)
	assignmentHandler := handler.NewAssignmentHandler(assignmentRepo)
	materialHandler := handler.NewMaterialHandler(materialRepo)
	examHandler := handler.NewExamHandler(examRepo)
	deanHandler := handler.NewDeanHandler(deanRepo)
	itHandler := handler.NewITHandler(itRepo, deanRepo)
	importHandler := handler.NewImportHandler(importRepo)
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

	// AI 服务反向代理：/api/ai/* -> ai-service（AIBaseURL）
	if cfg.AIBaseURL != "" {
		if aiTarget, aerr := url.Parse(cfg.AIBaseURL); aerr == nil {
			aiProxy := httputil.NewSingleHostReverseProxy(aiTarget)
			aiProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, e error) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadGateway)
				w.Write([]byte(`{"message":"ai_service_unavailable","error":"` + e.Error() + `"}`))
			}
			r.Any("/api/ai/*path", func(c *gin.Context) {
				aiProxy.ServeHTTP(c.Writer, c.Request)
			})
		}
	}

	// 认证路由（无需 JWT）
	auth := r.Group("/api/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.RefreshToken)
	}

	// 统一登录 P0+P1：cloud.ziwi.cn 作为 IdP
	cloudJWKS := cloud.NewCloudJWKS(cfg.CloudJWKSURL)
	authHandler.SetCloudJWKS(cloudJWKS)

	// P0：纯验证端点（挂 CloudTokenAuth，接收 Bearer cloud_token）
	cloudAuth := r.Group("/api/auth/cloud")
	cloudAuth.Use(middleware.CloudTokenAuth(cloudJWKS))
	{
		cloudAuth.POST("/verify", authHandler.VerifyCloudToken)
	}

	// P1：云登录绑定端点（不挂中间件，接收 email+password，自调 cloud 验证）
	r.POST("/api/auth/cloud/login", authHandler.CloudLogin)

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
		teacher.GET("/exercises/:id", exerciseHandler.GetQuestion)
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
		// 角色分配（G2）
		itAdmin.PUT("/admin/users/:id/role", itHandler.UpdateUserRole)
		// 教材版本（读公共库 tb_textbook_version，平台统一维护；PUT 为学校级覆盖已下线）
		itAdmin.PUT("/admin/textbooks", itHandler.UpsertTextbook)
		// 学期配置（G7，复用教务仓储）
		itAdmin.GET("/admin/semesters", itHandler.ListSemesters)
		itAdmin.POST("/admin/semesters", itHandler.CreateSemester)
		// 数据初始化批量导入
		itAdmin.POST("/admin/import/:type", importHandler.Import)
		itAdmin.GET("/admin/import/history", importHandler.History)
		// 注意：与上方 :type 同前缀，rollback 必须用静态段避免通配符冲突
		itAdmin.POST("/admin/import/rollback/:batchId", importHandler.Rollback)
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
