package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		host := getEnv("DB_HOST", "postgres")
		port := getEnv("DB_PORT", "5432")
		user := getEnv("DB_USER", "zhiwei")
		pass := getEnv("DB_PASSWORD", "zhiwei2026")
		dbname := getEnv("DB_NAME", "zhiwei")
		dsn = "postgresql://" + user + ":" + pass + "@" + host + ":" + port + "/" + dbname + "?sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// 自动迁移全部模型
	if err := db.AutoMigrate(
		&model.School{}, &model.User{},
		&model.Class{}, &model.TeacherClass{}, &model.StudentClass{},
	); err != nil {
		log.Fatalf("Failed to migrate: %v", err)
	}

	// ── 1. 创建演示学校 ──
	school := model.School{
		FullName:   "知微实验小学",
		ShortName:  "知微实验",
		SystemType: "六三制",
		Region:     "四川省成都市",
		Status:     "active",
	}
	db.Where("full_name = ?", "知微实验小学").FirstOrCreate(&school)
	fmt.Printf("School: %s (%s)\n", school.FullName, school.ID)

	// ── 2. 创建演示用户 ──
	users := []struct {
		Phone    string
		Name     string
		Role     string
		Password string
	}{
		{"13800000001", "管理员", "it_admin", "admin123"},
		{"13800000002", "张老师", "teacher", "teacher123"},
		{"13800000003", "李教研", "research_lead", "teacher123"},
		{"13800000004", "王教务", "registrar", "teacher123"},
		{"13800000005", "陈校长", "principal", "teacher123"},
		{"13800000006", "赵运营", "platform_ops", "admin123"},
		{"13800000007", "孙运维", "platform_devops", "admin123"},
		{"13800000008", "周主任", "head_teacher", "teacher123"},
		// 学生
		{"13800000011", "小明", "student", "student123"},
		{"13800000012", "小红", "student", "student123"},
		{"13800000013", "小刚", "student", "student123"},
		// 家长
		{"13800000021", "明爸", "parent", "parent123"},
		{"13800000022", "红妈", "parent", "parent123"},
	}

	createdUsers := make(map[string]model.User)
	for _, u := range users {
		hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Failed to hash password for %s: %v", u.Phone, err)
			continue
		}

		user := model.User{
			Phone:        u.Phone,
			PasswordHash: string(hash),
			Role:         u.Role,
			Name:         u.Name,
			SchoolID:     &school.ID,
			Status:       "active",
		}

		result := db.Where("phone = ?", u.Phone).FirstOrCreate(&user)
		if result.RowsAffected > 0 {
			fmt.Printf("  Created: %s (%s) - %s\n", u.Name, u.Role, u.Phone)
		} else {
			db.Model(&user).Updates(map[string]interface{}{
				"password_hash": string(hash),
				"name":          u.Name,
				"role":          u.Role,
			})
			fmt.Printf("  Updated: %s (%s) - %s\n", u.Name, u.Role, u.Phone)
		}
		createdUsers[u.Phone] = user
	}

	// ── 3. 创建班级 ──
	classes := []struct {
		Name             string
		Grade            string
		HeadTeacherPhone string
	}{
		{"四(1)班", "四年级", "13800000008"},
		{"四(2)班", "四年级", ""},
		{"三(1)班", "三年级", ""},
	}

	createdClasses := make(map[string]model.Class)
	for _, c := range classes {
		class := model.Class{
			SchoolID:  school.ID,
			Name:      c.Name,
			Grade:     c.Grade,
			ClassType: "normal",
		}
		if c.HeadTeacherPhone != "" {
			if u, ok := createdUsers[c.HeadTeacherPhone]; ok {
				class.HeadTeacherID = &u.ID
			}
		}
		db.Where("school_id = ? AND name = ?", school.ID, c.Name).FirstOrCreate(&class)
		createdClasses[c.Name] = class
		fmt.Printf("  Class: %s (%s)\n", class.Name, class.Grade)
	}

	// ── 4. 教师-班级关联 ──
	teacherPhone := "13800000002" // 张老师
	if teacher, ok := createdUsers[teacherPhone]; ok {
		for _, class := range createdClasses {
			tc := model.TeacherClass{
				TeacherID: teacher.ID,
				ClassID:   class.ID,
				Subject:   "语文",
				IsPrimary: true,
			}
			db.Where("teacher_id = ? AND class_id = ? AND subject = ?", teacher.ID, class.ID, "语文").
				FirstOrCreate(&tc)
		}
		fmt.Println("  Teacher-Class associations created")
	}

	// ── 5. 学生-班级关联 ──
	studentPhones := []string{"13800000011", "13800000012", "13800000013"}
	for _, sp := range studentPhones {
		if student, ok := createdUsers[sp]; ok {
			for _, class := range createdClasses {
				sc := model.StudentClass{
					StudentID:  student.ID,
					ClassID:    class.ID,
					EnrolledAt: time.Now(),
				}
				db.Where("student_id = ? AND class_id = ?", student.ID, class.ID).
					FirstOrCreate(&sc)
			}
		}
	}
	fmt.Println("  Student-Class associations created")

	fmt.Println("\n=== 演示账号 ===")
	fmt.Println("13800000001 / admin123    - 管理员 (it_admin)")
	fmt.Println("13800000002 / teacher123  - 张老师 (teacher)")
	fmt.Println("13800000003 / teacher123  - 李教研 (research_lead)")
	fmt.Println("13800000004 / teacher123  - 王教务 (registrar)")
	fmt.Println("13800000005 / teacher123  - 陈校长 (principal)")
	fmt.Println("13800000006 / admin123    - 赵运营 (platform_ops)")
	fmt.Println("13800000007 / admin123    - 孙运维 (platform_devops)")
	fmt.Println("13800000008 / teacher123  - 周主任 (head_teacher)")
	fmt.Println("13800000011 / student123  - 小明 (student)")
	fmt.Println("13800000012 / student123  - 小红 (student)")
	fmt.Println("13800000013 / student123  - 小刚 (student)")
	fmt.Println("13800000021 / parent123   - 明爸 (parent)")
	fmt.Println("13800000022 / parent123   - 红妈 (parent)")
	fmt.Println("\nSeed completed!")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
