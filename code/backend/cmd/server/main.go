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
	"github.com/zhiwei/backend/internal/heartbeat"
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
		&model.School{}, &model.Campus{}, &model.User{}, &model.Class{},
		&model.TeacherClass{}, &model.StudentClass{}, &model.LessonPlan{},
		&model.Exam{}, &model.Material{}, &model.ImportBatch{},
		&repository.Question{}, &repository.Assignment{}, &repository.AssignmentQuestionLog{},
		&model.TextbookVersion{}, &model.StandardClause{},
		&model.VersionStandardMap{}, &model.KGNode{}, &model.KGEdge{},
		&model.SchoolTextbookOverride{},
		&model.TextbookConfig{},
		&model.TeacherTextbookPref{},
		&model.UserSubmittedTextbookVersion{},
		&model.Sheet{},
		&model.Annotation{}, &model.Version{},
	); err != nil {
		log.Printf("Warning: AutoMigrate failed: %v", err)
	}

	// questions 软删列：模型 Status 是 gorm:"-" 展示态(由 audit_status 派生)，AutoMigrate 不会建列；
	// DELETE /exercises/:id 软删依赖真实 status 列，此处幂等补列（001_init_schema.up.sql 有定义但历史库未跑）。
	db.Exec(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'`)

	// 教材版本个人偏好支持 年级/班级 维度（V2.6）：新增列 + 复合唯一索引 (teacher_id, grade, class_id, subject)。
	// AutoMigrate 已加列（default ''），此处补齐唯一索引并下线旧索引，幂等。
	db.Exec(`ALTER TABLE teacher_textbook_pref ADD COLUMN IF NOT EXISTS grade VARCHAR(20) NOT NULL DEFAULT ''`)
	db.Exec(`ALTER TABLE teacher_textbook_pref ADD COLUMN IF NOT EXISTS class_id VARCHAR(50) NOT NULL DEFAULT ''`)
	db.Exec(`DROP INDEX IF EXISTS uk_teacher_subject`)
	db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS uk_teacher_gcs ON teacher_textbook_pref (teacher_id, grade, class_id, subject)`)

	// 题单（练习题集 sheets）：补齐 publish_mode（发布去向）/ assigned_classes（题目粒度已布置班级日志）。
	// GORM AutoMigrate 已建 sheet 表并加列，此处对历史库幂等补列。
	db.Exec(`ALTER TABLE sheets ADD COLUMN IF NOT EXISTS publish_mode VARCHAR(20) NOT NULL DEFAULT ''`)
	db.Exec(`ALTER TABLE sheets ADD COLUMN IF NOT EXISTS assigned_classes JSONB NOT NULL DEFAULT '[]'::jsonb`)
	// 作业表（assignments）：补齐 sheet_id（题单→作业追溯）。
	db.Exec(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS sheet_id VARCHAR(50) NOT NULL DEFAULT ''`)
	// 题目粒度布置日志表（避免同师同年级同学科各班重复布置同一题目）。
	db.Exec(`CREATE TABLE IF NOT EXISTS assignment_question_logs (
		id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid(),
		teacher_id VARCHAR(50) NOT NULL,
		school_id VARCHAR(50) NOT NULL,
		class_id VARCHAR(50) NOT NULL,
		subject VARCHAR(20) NOT NULL,
		question_id VARCHAR(50) NOT NULL,
		sheet_id VARCHAR(50),
		assignment_id VARCHAR(50),
		assigned_at TIMESTAMPTZ DEFAULT now()
	)`)
	// 重建正确的四列复合唯一索引（GORM 默认会建错误的单字段索引，先 DROP 再建复合索引）。
	db.Exec(`DROP INDEX IF EXISTS uk_aql_t_s_c_q`)
	db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS uk_aql_t_s_c_q ON assignment_question_logs (teacher_id, school_id, class_id, question_id)`)

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
	exerciseSheetRepo := repository.NewExerciseSheetRepository(db)
	sheetRepo := repository.NewSheetRepo(db)
	careRepo := repository.NewCareRepository(db)
	attemptRepo := repository.NewAttemptEventRepository(db)

	// 其余 GORM 托管的业务表随 model 演进自动同步（发布管线的一部分，幂等）
	for _, m := range []func() error{researchRepo.AutoMigrate, deanRepo.AutoMigrate, opsRepo.AutoMigrate, careRepo.AutoMigrate, attemptRepo.AutoMigrate} {
		if err := m(); err != nil {
			log.Printf("Warning: AutoMigrate failed: %v", err)
		}
	}
	// growth_care_records 现已由 CareRepository.AutoMigrate() 管理（GORM 幂等迁移），
	// 原有裸 CREATE TABLE 已移除。若升级前表不存在，迁移会自动建表。
	// 家长-学生关联（没有学生端，由家长端代理；家长账号经此表绑定花名册学生）
	db.Exec(`CREATE TABLE IF NOT EXISTS parent_students (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		parent_id VARCHAR(30) REFERENCES users(id) NOT NULL,
		student_id VARCHAR(30) REFERENCES users(id) NOT NULL,
		relationship VARCHAR(20) DEFAULT 'parent',
		is_primary BOOLEAN DEFAULT TRUE,
		UNIQUE (parent_id, student_id)
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
	assignmentHandler := handler.NewAssignmentHandler(assignmentRepo, sheetRepo, exerciseSheetRepo)
	materialHandler := handler.NewMaterialHandler(materialRepo)
	examHandler := handler.NewExamHandler(examRepo)
	annotationHandler := handler.NewAnnotationHandler(db)
	exerciseSheetHandler := handler.NewExerciseSheetHandler(exerciseSheetRepo)
	sheetHandler := handler.NewSheetHandler(sheetRepo, assignmentRepo)
	deanHandler := handler.NewDeanHandler(deanRepo)
	auditRepo := repository.NewAuditRepository(db)
	itHandler := handler.NewITHandler(itRepo, deanRepo, auditRepo)
	importHandler := handler.NewImportHandler(importRepo)
	opsHandler := handler.NewOpsHandler(opsRepo)
	researchHandler := handler.NewResearchHandler(researchRepo)
	devopsHandler := handler.NewDevOpsHandler()
	principalHandler := handler.NewPrincipalHandler(db)
	scHandler := handler.NewSchoolClassHandler(db)
	careHandler := handler.NewCareHandler(careRepo)
	gradingHandler := handler.NewGradingHandler(attemptRepo)

	// P2 心跳上报：每天一次向 heartbeat.ziwi.cn 上报 License 状态 + 活跃席位
	heartbeatClient := heartbeat.New(db, cfg.HeartbeatURL, cfg.HeartbeatAPIKey, cfg.HeartbeatEnabled, "saas")
	heartbeatClient.Start()

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
				w.Write([]byte(`{"code":"AI_SERVICE_UNAVAILABLE","message":"AI 服务暂不可用"}`))
			}
			r.Any("/api/ai/*path", func(c *gin.Context) {
				aiProxy.ServeHTTP(c.Writer, c.Request)
			})
		}
	}

	// 认证路由（无需 JWT）：限制登录/刷新频率，防凭据爆破
	auth := r.Group("/api/auth")
	auth.Use(middleware.AuthRateLimiter(20, time.Minute))
	{
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.RefreshToken)
	}

	// 统一登录 P0+P1：cloud.ziwi.cn 作为 IdP
	cloudJWKS := cloud.NewCloudJWKS(cfg.CloudJWKSURL)
	authHandler.SetCloudJWKS(cloudJWKS)

	// P0：纯验证端点（挂 CloudTokenAuth，接收 Bearer cloud_token）
	cloudAuth := r.Group("/api/auth/cloud")
	cloudAuth.Use(middleware.AuthRateLimiter(30, time.Minute))
	cloudAuth.Use(middleware.CloudTokenAuth(cloudJWKS))
	{
		cloudAuth.POST("/verify", authHandler.VerifyCloudToken)
	}

	// P1：云登录绑定端点（不挂 CloudTokenAuth，接收 email+password，自调 cloud 验证）
	r.POST("/api/auth/cloud/login", middleware.AuthRateLimiter(20, time.Minute), authHandler.CloudLogin)

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
		teacher.DELETE("/exercises/:id", exerciseHandler.DeleteQuestion)
		teacher.POST("/exercises/infer-coordinate", exerciseHandler.InferTrainingCoordinate)
		// 组卷
		teacher.GET("/exams", examHandler.ListExams)
		teacher.POST("/exams", examHandler.CreateExam)
		teacher.GET("/exams/:id", examHandler.GetExam)
		teacher.PUT("/exams/:id", examHandler.UpdateExam)
		teacher.DELETE("/exams/:id", examHandler.DeleteExam)
		// 题单（练习题集，紧凑 A4 排版，不留答题区）
		teacher.GET("/sheets", sheetHandler.List)
		teacher.POST("/sheets", sheetHandler.Create)
		teacher.GET("/sheets/:id", sheetHandler.Get)
		teacher.PUT("/sheets/:id", sheetHandler.Update)
		teacher.GET("/sheets/:id/assignments", sheetHandler.GetAssignments)
		// 习题库（工作单 / 简单卷面）：与试卷库同构，单题用快照
		teacher.GET("/worksheets", exerciseSheetHandler.ListSheets)
		teacher.POST("/worksheets", exerciseSheetHandler.CreateSheet)
		teacher.GET("/worksheets/:id", exerciseSheetHandler.GetSheet)
		teacher.PUT("/worksheets/:id", exerciseSheetHandler.UpdateSheet)
		teacher.DELETE("/worksheets/:id", exerciseSheetHandler.DeleteSheet)
		// 作业
		teacher.GET("/assignments", assignmentHandler.ListAssignments)
		teacher.POST("/assignments", assignmentHandler.CreateAssignment)
		teacher.PUT("/assignments/:id", assignmentHandler.UpdateAssignment)
		teacher.DELETE("/assignments/:id", assignmentHandler.DeleteAssignment)
		// 批阅 & 答题事件（Phase 0）
		teacher.POST("/grading/batch", gradingHandler.SubmitGrade)
		teacher.GET("/grading", placeholder("list grading"))
		// 学情
		teacher.GET("/analytics/teacher-dashboard", analyticsHandler.GetTeacherDashboard)
		teacher.GET("/analytics", analyticsHandler.GetAnalytics)
		teacher.GET("/analytics/coverage", analyticsHandler.GetCoverage)
		// 家校
		teacher.GET("/parent/signatures", placeholder("list signatures"))
		// V2.6 成长关爱（有据引擎承载）
		teacher.GET("/care/students", careHandler.ListCareStudents)
		teacher.POST("/care/students", careHandler.AddCareStudent)
		teacher.GET("/care/students/:id", careHandler.GetCareStudent)
		teacher.PUT("/care/students/:id", careHandler.UpdateCareStudent)
		teacher.PUT("/care/students/:id/plan", careHandler.UpdateCarePlan)
		teacher.DELETE("/care/students/:id", careHandler.RemoveCareStudent)
		// 素材
		teacher.GET("/materials", materialHandler.ListMaterials)
		teacher.GET("/materials/:id", materialHandler.GetMaterial)
		teacher.POST("/materials", materialHandler.UploadMaterial)
		teacher.POST("/materials/json", materialHandler.CreateMaterialJSON)
		teacher.PUT("/materials/:id", materialHandler.UpdateMaterial)
		// 通用批注 + 版本快照（挂任意作品；版本仅草稿期可存/回退，发布后只读）
		teacher.GET("/annotations", annotationHandler.ListAnnotations)
		teacher.POST("/annotations", annotationHandler.CreateAnnotation)
		teacher.DELETE("/annotations/:id", annotationHandler.DeleteAnnotation)
		teacher.GET("/versions", annotationHandler.ListVersions)
		teacher.POST("/versions", annotationHandler.CreateVersion)
		teacher.POST("/versions/:id/restore", annotationHandler.RestoreVersion)
		// 学校/班级归档
		teacher.PUT("/schools/:id/archive", scHandler.ArchiveSchool)
		teacher.PUT("/schools/:id/restore", scHandler.RestoreSchool)
		teacher.PUT("/classes/:id/archive", scHandler.ArchiveClass)
		teacher.PUT("/classes/:id/restore", scHandler.RestoreClass)
		teacher.GET("/classes", scHandler.ListClasses)
		teacher.GET("/my-classes", scHandler.MyClasses)
		teacher.GET("/schools/lookup", scHandler.LookupSchool)
		teacher.PUT("/user/profile", authHandler.UpdateProfile)
		// V2.5 个人试用教材偏好（per-user，跨设备同步，规格书 §5.1）
		teacher.GET("/me/textbook-prefs", itHandler.ListTeacherTextbookPrefs)
		teacher.POST("/me/textbook-prefs", itHandler.UpsertTeacherTextbookPref)
		teacher.DELETE("/me/textbook-prefs", itHandler.DeleteTeacherTextbookPref)
		// V2.6 用户提交教材版本贡献
		teacher.POST("/me/submit-textbook-version", itHandler.SubmitTextbookVersion)
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
		// 角色分配（G2）
		itAdmin.PUT("/admin/users/:id/role", itHandler.UpdateUserRole)
		// 数据初始化批量导入
		itAdmin.POST("/admin/import/:type", importHandler.Import)
		itAdmin.GET("/admin/import/history", importHandler.History)
		// 注意：与上方 :type 同前缀，rollback 必须用静态段避免通配符冲突
		itAdmin.POST("/admin/import/rollback/:batchId", importHandler.Rollback)
		// ── V2.6 全学科教材版本库维护（数据团队提供数据，IT 管理员导入/维护）──
		itAdmin.GET("/admin/textbook-versions", itHandler.ListTextbookVersionLibrary)
		itAdmin.POST("/admin/textbook-versions", itHandler.CreateTextbookVersion)
		itAdmin.PUT("/admin/textbook-versions/:id", itHandler.UpdateTextbookVersion)
		itAdmin.DELETE("/admin/textbook-versions/:id", itHandler.DeleteTextbookVersion)
		itAdmin.POST("/admin/textbook-versions/import", itHandler.ImportTextbookVersions)
		// V2.6 用户贡献版本审核
		itAdmin.GET("/admin/textbook-versions/pending", itHandler.ListPendingSubmittedVersions)
		itAdmin.PUT("/admin/textbook-versions/pending/:id/approve", itHandler.ApproveSubmittedVersion)
		itAdmin.PUT("/admin/textbook-versions/pending/:id/reject", itHandler.RejectSubmittedVersion)
		// IT 操作历史（供小微上下文注入，仅 it_admin 可见本租户记录）
		itAdmin.GET("/ops/it-history", itHandler.ITHistory)
	}

	// 校区管理：IT 管理员专属维护（学校级配置，A1 一校多区），与规划角色边界一致，不向 principal 放权
	campusGrp := api.Group("")
	campusGrp.Use(middleware.RequireRole("it_admin"))
	{
		campusGrp.GET("/admin/campuses", itHandler.ListCampuses)
		campusGrp.POST("/admin/campuses", itHandler.CreateCampus)
		campusGrp.PUT("/admin/campuses/:id", itHandler.UpdateCampus)
		campusGrp.DELETE("/admin/campuses/:id", itHandler.DeleteCampus)
	}

	// 教材版本：教师/班主任/IT 管理员均可读写本校覆盖层（学校级配置，任课教师是直接使用人）
	textbookGrp := api.Group("")
	textbookGrp.Use(middleware.RequireRole("teacher", "head_teacher", "it_admin"))
	textbookGrp.GET("/admin/textbooks", itHandler.ListTextbookVersions)
	textbookGrp.PUT("/admin/textbooks", itHandler.UpsertTextbook)
	// V2.5 教材版本三级配置（学校级/年级学科级/班级级 + 优先级解析）
	textbookGrp.GET("/admin/textbook-configs", itHandler.ListTextbookConfigs)
	textbookGrp.POST("/admin/textbook-configs", itHandler.UpsertTextbookConfig)
	textbookGrp.DELETE("/admin/textbook-configs/:id", itHandler.DeleteTextbookConfig)
	textbookGrp.GET("/admin/textbook-configs/resolve", itHandler.ResolveTextbookConfig)
	// V2.6 教师有效教材版本解析：个人偏好 > 学校配置 > 平台库默认（按 学科/年级/班级 联动）
	textbookGrp.GET("/me/textbook-effective", itHandler.ResolveEffectiveTextbook)

	// 学期配置：教师/班主任/IT 管理员均可管理（学校级配置，云上无独立 IT 角色时由任课教师在个人中心维护）
	semesterGrp := api.Group("")
	semesterGrp.Use(middleware.RequireRole("teacher", "head_teacher", "it_admin"))
	semesterGrp.GET("/admin/semesters", itHandler.ListSemesters)
	semesterGrp.POST("/admin/semesters", itHandler.CreateSemester)

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

	// 没有学生端，由家长端代理。
	// 学生在系统中仅以「花名册记录」存在（role='student'，无登录凭据），
	// 其作业/错题/签字等能力全部通过家长端（role='parent'）代理访问。
	// 此处原有的 /student/* 登录路由组已于 2026-07-30 移除，严禁再次误建学生登录端点。

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
