package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/config"
	"github.com/zhiwei/backend/internal/handler"
	"github.com/zhiwei/backend/internal/middleware"
	"github.com/zhiwei/backend/internal/repository"
	"github.com/zhiwei/backend/internal/service"
)

func main() {
	cfg := config.Load()

	// 数据库连接
	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{
		SkipDefaultTransaction: true,
	})
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(50)
	defer sqlDB.Close()

	// Redis 连接
	rdb := redis.NewClient(&redis.Options{
		Addr: cfg.RedisURL,
	})
	defer rdb.Close()

	// 依赖注入 - Repository 层
	authRepo := repository.NewAuthRepo(db, rdb)
	schoolRepo := repository.NewSchoolRepo(db)
	classRepo := repository.NewClassRepo(db)
	lessonPlanRepo := repository.NewLessonPlanRepo(db)
	statsRepo := repository.NewStatsRepo(db)
	assignmentRepo := repository.NewAssignmentRepo(db)
	submissionRepo := repository.NewSubmissionRepo(db)
	parentSignRepo := repository.NewParentSignRepo(db)
	gradingRepo := repository.NewGradingRepo(db)
	studentRepo := repository.NewStudentRepo(db)
	parentRepo := repository.NewParentRepo(db)
	licenseRepo := repository.NewLicenseRepo(db)
	trialRepo := repository.NewTrialRepo(db)
	adminRepo := repository.NewAdminRepo(db)
	tokenRepo := repository.NewTokenRepo(db)
	modelRateRepo := repository.NewModelRateRepo(db)

	// 依赖注入 - Service 层
	authSvc := service.NewAuthService(cfg, authRepo)
	schoolSvc := service.NewSchoolService(schoolRepo)
	classSvc := service.NewClassService(classRepo)
	dashSvc := service.NewDashboardService(statsRepo, lessonPlanRepo)

	jwtSecret := []byte(cfg.JWTPrivateKey)

	// 依赖注入 - Handler 层
	authH := handler.NewAuthHandler(authSvc, jwtSecret)
	schoolH := handler.NewSchoolHandler(schoolSvc)
	classH := handler.NewClassHandler(classSvc)
	dashH := handler.NewDashboardHandler(dashSvc)
	planH := handler.NewLessonPlanHandler(lessonPlanRepo)
	assignmentH := handler.NewAssignmentHandler(assignmentRepo)
	submissionH := handler.NewSubmissionHandler(submissionRepo)
	parentSignH := handler.NewParentSignHandler(parentSignRepo)
	gradingH := handler.NewGradingHandler(gradingRepo)
	compositionH := handler.NewCompositionHandler(submissionRepo)
	studentH := handler.NewStudentHandler(studentRepo)
	parentH := handler.NewParentHandler(parentRepo)
	licenseH := handler.NewLicenseHandler(licenseRepo)
	trialH := handler.NewTrialHandler(trialRepo)
	adminH := handler.NewAdminHandler(adminRepo)
	tokenH := handler.NewTokenHandler(tokenRepo)
	teachingH := handler.NewTeachingHandler(classRepo, authRepo)
	principalH := handler.NewPrincipalHandler(statsRepo)
	campusRepo := repository.NewCampusRepo(db)
	campusH := handler.NewCampusHandler(campusRepo, classRepo)
	inspectionH := handler.NewInspectionHandler(classRepo)
	textbookRepo := repository.NewTextbookRepo(db)
	textbookH := handler.NewTextbookHandler(textbookRepo)
	reviewRepo := repository.NewReviewRepo(db)
	reviewH := handler.NewReviewHandler(reviewRepo)
	auditH := handler.NewAuditHandler()

	// 路由
	r := gin.New()
	r.Use(middleware.Recovery())
	r.Use(gin.Logger())
	r.Use(middleware.CORS())
	r.Use(middleware.SecurityHeaders())
	r.MaxMultipartMemory = 20 << 20 // 20MB

	// 健康检查
	r.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "business-api"})
	})

	// 认证（无需鉴权）
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/register", authH.Register)
		auth.POST("/login", authH.Login)
		// SaaS 模式专属：验证码登录
		if cfg.DeployMode != "private" {
			auth.POST("/send-code", authH.SendCode)
			auth.POST("/code-login", authH.CodeLogin)
		}
	}

	// 需要鉴权的接口
	protected := r.Group("/api/v1")
	protected.Use(middleware.JWTAuth(jwtSecret, db))
	protected.Use(middleware.TenantScope())
	protected.Use(middleware.AuditLogger(db))
	{
		// 个人信息
		protected.GET("/auth/me", authH.Me)
		protected.POST("/auth/refresh", authH.Refresh)

		// 学校管理
		protected.GET("/schools", schoolH.List)
		protected.POST("/schools", middleware.RequireRole("admin"), schoolH.Create)
		protected.GET("/schools/:id", schoolH.Get)
		protected.GET("/school/settings", schoolH.GetSettings)
		protected.PUT("/schools/:id/settings", schoolH.UpdateSettings)
		// 功能申请（教师端）
		protected.POST("/schools/feature-request", schoolH.FeatureRequest)

		// 模型费率（前端展示用）
		protected.GET("/model-rates", func(c *gin.Context) {
			rates, err := modelRateRepo.GetAll()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"code": 200, "data": rates})
		})

		// 班级管理
		protected.GET("/classes", classH.List)
		protected.POST("/classes", classH.Create)

		// 教师任教管理 (IT管理员/教务管理员)
		protected.GET("/teaching/assignments", teachingH.ListAssignments)
		protected.POST("/teaching/assign", teachingH.AssignTeacher)

		// 校长仪表盘
		protected.GET("/principal/dashboard", principalH.Dashboard)

		// 学校管理后台：分校
		protected.GET("/campuses", campusH.List)
		protected.POST("/campuses", campusH.Create)
		// 批量导入教师
		protected.POST("/teachers/batch-import", campusH.BatchImportTeachers)
		// 教学检查
		protected.GET("/inspection", inspectionH.Get)

		// 教材版本
		protected.GET("/textbooks", textbookH.List)
		protected.POST("/textbooks", textbookH.Upsert)
		protected.GET("/textbooks/curriculum-hint", textbookH.CurriculumHint)

		// 互审机制
		protected.POST("/reviews", reviewH.Submit)
		protected.GET("/lesson-plans/:id/reviews", reviewH.ListByPlan)
		protected.GET("/reviews/pending", reviewH.PendingForMe)
		protected.GET("/reviews/coverage", reviewH.Coverage)

		// 内容安全审核
		protected.POST("/audit/check", auditH.Check)

		// 工作台
		protected.GET("/dashboard/home", dashH.Home)

		// 教案
		protected.GET("/lesson-plans", planH.List)
		protected.POST("/lesson-plans", planH.Create)
		protected.GET("/lesson-plans/:id", planH.Get)
		protected.PUT("/lesson-plans/:id", planH.Update)
		protected.POST("/lesson-plans/:id/finalize", planH.Finalize)
		protected.DELETE("/lesson-plans/:id", planH.Delete)

		// 作业
		protected.GET("/assignments", assignmentH.List)
		protected.POST("/assignments", assignmentH.Create)

		// 学生端
		protected.GET("/student/assignments", studentH.ListAssignments)
		protected.GET("/student/grading/:id", studentH.GetGrading)
		protected.GET("/student/error-book", studentH.GetErrorBook)

		// 学生提交
		protected.POST("/submissions", submissionH.Submit)
		protected.POST("/submissions/composition", compositionH.Submit)

		// 家长端
		protected.GET("/parent/assignments", parentH.ListAssignments)
		protected.GET("/parent/signatures/:id", parentH.GetSignature)

		// 家长签字
		protected.GET("/parent-signatures", parentSignH.List)
		protected.POST("/parent-signatures/:id/sign", parentSignH.Sign)

		// License 管理 (admin only)
		protected.GET("/license/schools", middleware.RequireRole("admin"), licenseH.ListSchools)
		protected.GET("/license/heartbeats", middleware.RequireRole("admin"), licenseH.GetHeartbeats)

		// 试用管理 (admin only)
		protected.GET("/trial/config", middleware.RequireRole("admin"), trialH.GetConfig)
		protected.PUT("/trial/config", middleware.RequireRole("admin"), trialH.UpdateConfig)
		protected.GET("/trial/teachers", middleware.RequireRole("admin"), trialH.ListTeachers)

		// Token 统计 (admin + IT)
		protected.GET("/token/summary", tokenH.GetSummary)
		protected.GET("/token/trend", tokenH.GetTrend)
		protected.GET("/token/tenants", tokenH.GetTenantRanking)
		// Token 配额管理（教师个人 + 校管理端）
		protected.GET("/token/my-quota", tokenH.GetMyQuota)
		protected.GET("/admin/teachers", middleware.RequireRole("admin", "it_admin"), tokenH.ListTeachers)
		protected.PUT("/admin/teachers/quota", middleware.RequireRole("admin", "it_admin"), tokenH.BatchUpdateQuota)

		// 平台管理 (admin only)
		protected.GET("/admin/users", middleware.RequireRole("admin"), adminH.ListUsers)
		protected.POST("/admin/users/:id/block", middleware.RequireRole("admin"), adminH.BlockUser)
		protected.POST("/admin/users/:id/unblock", middleware.RequireRole("admin"), adminH.UnblockUser)
		protected.GET("/admin/health", middleware.RequireRole("admin"), adminH.GetHealth)
		protected.GET("/admin/announcements", middleware.RequireRole("admin"), adminH.ListAnnouncements)
		protected.POST("/admin/announcements", middleware.RequireRole("admin"), adminH.CreateAnnouncement)
		protected.GET("/admin/audit-logs", middleware.RequireRole("admin"), adminH.ListAuditLogs)

		// 批阅结果
		protected.GET("/grading", gradingH.List)
		protected.GET("/grading/:id", gradingH.Detail)
		protected.POST("/grading/:id/confirm", gradingH.Confirm)
		protected.POST("/grading/:id/adjust", gradingH.AdjustScore)
		protected.POST("/grading/batch-confirm", gradingH.BatchConfirm)

		// AI 生成接口（TokenQuotaGuard 校验配额）
		protected.POST("/ai/lesson-plan/generate", middleware.TokenQuotaGuard(db), proxyAIWithModel(cfg, schoolRepo))
		protected.POST("/ai/exam/generate", middleware.TokenQuotaGuard(db), proxyAIWithModel(cfg, schoolRepo))
		protected.POST("/ai/grading/auto", middleware.TokenQuotaGuard(db), proxyAIWithModel(cfg, schoolRepo))
		protected.POST("/ai/chat", middleware.TokenQuotaGuard(db), proxyAIWithModel(cfg, schoolRepo))
	}

	port := cfg.Port
	fmt.Printf("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
	fmt.Printf("  知微AI教学助手 (business-api)\n")
	fmt.Printf("  版本: v0.1.0-dev\n")
	fmt.Printf("  已注册路由:\n")
	for _, route := range r.Routes() {
		if route.Method != "OPTIONS" {
			fmt.Printf("    %s %s\n", route.Method, route.Path)
		}
	}
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")

	if err := r.Run(":" + port); err != nil {
		log.Fatalf("启动失败: %v", err)
	}
}

// proxyAIWithModel 代理 AI 请求并注入学校模型偏好
func proxyAIWithModel(cfg *config.Config, schoolRepo *repository.SchoolRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 读原始请求体
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "读取请求体失败"})
			return
		}

		// 2. 注入模型偏好（运营控制优先）
		var payload map[string]interface{}
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			payload = make(map[string]interface{})
		}

		// 如果前端没传 model，从学校设置中注入
		if _, hasModel := payload["model"]; !hasModel {
			schoolID, _ := c.Get("school_id")
			if sid, ok := schoolID.(string); ok && sid != "" {
				school, err := schoolRepo.FindByID(sid)
				if err == nil && school.AIModelTier != "" {
					payload["model"] = school.AIModelTier
				}
			}
		}

		// 3. 重新序列化并转发给 AI 服务
		modifiedBody, _ := json.Marshal(payload)
		targetPath := strings.Replace(c.Request.URL.Path, "/api/v1/ai/", "/api/", 1) + "/"
	targetURL := cfg.AIServiceURL + targetPath

		resp, err := http.Post(targetURL, "application/json", bytes.NewReader(modifiedBody))
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"code": 502, "message": "AI服务暂不可用"})
			return
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, "application/json", respBody)
	}
}
