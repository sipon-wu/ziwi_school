package repository

import (
	"encoding/json"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
)

// ── 导入行结构（由 handler 解析 CSV 后传入）──

type ClassImportRow struct {
	Campus    string
	Grade     string
	Name      string
	ClassType string
}

type TeacherImportRow struct {
	Name      string
	Phone     string
	Grade     string
	ClassName string
	Subject   string
	Role      string // teacher / head_teacher
	IsHead    bool   // 是否班主任
}

type StudentImportRow struct {
	Name          string
	StudentNumber string
	Campus        string
	Grade         string
	ClassName     string
	ParentPhone   string
}

type RelationImportRow struct {
	TeacherPhone string
	Grade        string
	ClassName    string
	Subject      string
}

// ── 校验/执行结果 ──

type RowResult struct {
	Line    int    `json:"line"`
	Status  string `json:"status"` // ok / warn / error
	Message string `json:"message"`
}

type ImportResult struct {
	Type     string      `json:"type"`
	Total    int         `json:"total"`
	Valid    int         `json:"valid"`
	Warnings int         `json:"warnings"`
	Invalid  int         `json:"invalid"`
	Rows     []RowResult `json:"rows"`
	BatchID  string      `json:"batch_id,omitempty"`
}

// ── 仓储 ──

type ImportRepository struct {
	db *gorm.DB
}

func NewImportRepository(db *gorm.DB) *ImportRepository {
	return &ImportRepository{db: db}
}

var phoneRe = regexp.MustCompile(`^1[3-9]\d{9}$`)

// ── 通用辅助 ──

// findClass 按 学校+年级+班级名 解析班级
func findClass(tx *gorm.DB, schoolID, grade, name string) (*model.Class, error) {
	var cls model.Class
	err := tx.Where("school_id = ? AND grade = ? AND name = ?", schoolID, grade, name).
		First(&cls).Error
	if err != nil {
		return nil, err
	}
	return &cls, nil
}

// findUserByPhone 按手机号查询（含非 active，避免重复创建）
func findUserByPhone(tx *gorm.DB, phone string) (*model.User, error) {
	var u model.User
	err := tx.Where("phone = ?", phone).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// findStudentByNumber 按 学校+学号 查询学生
func findStudentByNumber(tx *gorm.DB, schoolID, num string) (*model.User, error) {
	var u model.User
	err := tx.Where("school_id = ? AND student_number = ?", schoolID, num).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// ── 班级导入 ──

func (r *ImportRepository) ImportClasses(schoolID, createdBy string, rows []ClassImportRow, dryRun bool) (*ImportResult, error) {
	res := &ImportResult{Type: "classes", Total: len(rows)}
	var createdIDs []string

	tx := r.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() { _ = tx.Rollback() }()

	for i, row := range rows {
		line := i + 2
		grade := strings.TrimSpace(row.Grade)
		name := strings.TrimSpace(row.Name)
		if grade == "" || name == "" {
			res.Invalid++
			res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "年级与班级名称不能为空"})
			continue
		}
		classType := normalizeClassType(row.ClassType)
		campus := strPtr(strings.TrimSpace(row.Campus))

		var existing model.Class
		err := tx.Where("school_id = ? AND grade = ? AND name = ?", schoolID, grade, name).First(&existing).Error
		if err == nil {
			res.Warnings++
			res.Rows = append(res.Rows, RowResult{Line: line, Status: "warn", Message: "班级已存在，将更新类型/校区"})
			if !dryRun {
				upd := map[string]interface{}{"class_type": classType}
				if campus != nil {
					upd["campus_id"] = campus
				}
				tx.Table("classes").Where("id = ?", existing.ID).Updates(upd)
			}
			continue
		}

		res.Valid++
		res.Rows = append(res.Rows, RowResult{Line: line, Status: "ok", Message: "将创建班级"})
		if dryRun {
			continue
		}
		cls := model.Class{
			SchoolID:  schoolID,
			CampusID:  campus,
			Name:      name,
			Grade:     grade,
			ClassType: classType,
		}
		if err := tx.Create(&cls).Error; err != nil {
			return nil, err
		}
		createdIDs = append(createdIDs, cls.ID)
	}

	if dryRun {
		return res, nil
	}
	if err := r.saveBatch(tx, schoolID, createdBy, "classes", res, createdIDs, nil, nil, nil); err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}
	return res, nil
}

// ── 教师导入（含班主任任命 + 主科任课关系）──

func (r *ImportRepository) ImportTeachers(schoolID, createdBy string, rows []TeacherImportRow, dryRun bool) (*ImportResult, error) {
	res := &ImportResult{Type: "teachers", Total: len(rows)}
	var createdUserIDs, createdTeacherClassIDs []string
	headAssigned := map[string]bool{} // 本批次内已分配班主任的手机号，防一人多班（A4）

	tx := r.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() { _ = tx.Rollback() }()

	for i, row := range rows {
		line := i + 2
		name := strings.TrimSpace(row.Name)
		phone := strings.TrimSpace(row.Phone)
		if name == "" {
			res.Invalid++
			res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "姓名不能为空"})
			continue
		}
		if !phoneRe.MatchString(phone) {
			res.Invalid++
			res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "手机号格式不正确"})
			continue
		}

		role := strings.TrimSpace(row.Role)
		if row.IsHead {
			role = "head_teacher"
		}
		if role == "" {
			role = "teacher"
		}
		if role != "teacher" && role != "head_teacher" {
			res.Invalid++
			res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "角色只能是 teacher 或 head_teacher"})
			continue
		}

		// 解析/预留用户 ID（用于班主任唯一性校验）
		uid := model.GenUserID()
		if ex, _ := findUserByPhone(tx, phone); ex != nil {
			uid = ex.ID
		}

		// 班主任任命校验（A4：一人只能任一班班主任）
		var headClassID *string
		if role == "head_teacher" {
			grade := strings.TrimSpace(row.Grade)
			clsName := strings.TrimSpace(row.ClassName)
			if grade == "" || clsName == "" {
				res.Invalid++
				res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "标记为班主任时必须填写任教年级与班级"})
				continue
			}
			cls, err := findClass(tx, schoolID, grade, clsName)
			if err != nil {
				res.Invalid++
				res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "对应班级不存在（需先导入班级）"})
				continue
			}
			headClassID = &cls.ID
			var cnt int64
			tx.Model(&model.Class{}).Where("head_teacher_id IS NOT NULL AND id = ?", cls.ID).Count(&cnt)
			if cnt > 0 {
				res.Invalid++
				res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "该班级已有班主任"})
				continue
			}
			var cnt2 int64
			tx.Model(&model.Class{}).Where("head_teacher_id = ? AND id <> ?", uid, cls.ID).Count(&cnt2)
			if cnt2 > 0 {
				res.Invalid++
				res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "该教师已是其他班班主任，违反一人一班限制"})
				continue
			}
			if headAssigned[phone] {
				res.Invalid++
				res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "该教师在本批次已被分配为其他班班主任"})
				continue
			}
		}

		res.Valid++
		res.Rows = append(res.Rows, RowResult{Line: line, Status: "ok", Message: "将创建/更新教师"})
		if dryRun {
			continue
		}
		if headClassID != nil {
			headAssigned[phone] = true
		}

		// upsert 用户（按手机号）
		hashed, _ := bcrypt.GenerateFromPassword([]byte(phone[len(phone)-6:]), bcrypt.DefaultCost)
		var user model.User
		ex, _ := findUserByPhone(tx, phone)
		if ex != nil {
			tx.Table("users").Where("id = ?", ex.ID).Updates(map[string]interface{}{"name": name, "role": role})
			if role == "head_teacher" && headClassID != nil {
				tx.Table("classes").Where("id = ?", *headClassID).Update("head_teacher_id", ex.ID)
			}
			user = *ex
		} else {
			user = model.User{
				ID:           uid,
				SchoolID:     strPtr(schoolID),
				Phone:        phone,
				PasswordHash: string(hashed),
				Role:         role,
				Name:         name,
				ForceReset:   true,
			}
			if err := tx.Create(&user).Error; err != nil {
				return nil, err
			}
			createdUserIDs = append(createdUserIDs, user.ID)
			if role == "head_teacher" && headClassID != nil {
				tx.Table("classes").Where("id = ?", *headClassID).Update("head_teacher_id", user.ID)
			}
		}

		// 主科任课关系（任教年级+班级+学科）
		if strings.TrimSpace(row.Grade) != "" && strings.TrimSpace(row.ClassName) != "" && strings.TrimSpace(row.Subject) != "" {
			cls, err := findClass(tx, schoolID, strings.TrimSpace(row.Grade), strings.TrimSpace(row.ClassName))
			if err == nil {
				subject := strings.TrimSpace(row.Subject)
				var tc model.TeacherClass
				e := tx.Where("teacher_id = ? AND class_id = ? AND subject = ?", user.ID, cls.ID, subject).First(&tc).Error
				if e != nil {
					tc = model.TeacherClass{TeacherID: user.ID, ClassID: cls.ID, Subject: subject, IsPrimary: true}
					if err2 := tx.Create(&tc).Error; err2 != nil {
						return nil, err2
					}
					createdTeacherClassIDs = append(createdTeacherClassIDs, tc.ID)
				}
			}
		}
	}

	if dryRun {
		return res, nil
	}
	if err := r.saveBatch(tx, schoolID, createdBy, "teachers", res, createdUserIDs, nil, nil, createdTeacherClassIDs); err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}
	return res, nil
}

// ── 学生导入 ──

func (r *ImportRepository) ImportStudents(schoolID, createdBy string, rows []StudentImportRow, dryRun bool) (*ImportResult, error) {
	res := &ImportResult{Type: "students", Total: len(rows)}
	var createdUserIDs, createdStudentClassIDs []string

	tx := r.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() { _ = tx.Rollback() }()

	for i, row := range rows {
		line := i + 2
		name := strings.TrimSpace(row.Name)
		num := strings.TrimSpace(row.StudentNumber)
		grade := strings.TrimSpace(row.Grade)
		clsName := strings.TrimSpace(row.ClassName)
		if name == "" || num == "" || grade == "" || clsName == "" {
			res.Invalid++
			res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "姓名/学号/年级/班级 均不能为空"})
			continue
		}
		if !phoneRe.MatchString(strings.TrimSpace(row.ParentPhone)) {
			res.Warnings++
			res.Rows = append(res.Rows, RowResult{Line: line, Status: "warn", Message: "家长手机号格式异常（仅警告）"})
		}
		cls, err := findClass(tx, schoolID, grade, clsName)
		if err != nil {
			res.Invalid++
			res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "对应班级不存在（需先导入班级）"})
			continue
		}

		res.Valid++
		res.Rows = append(res.Rows, RowResult{Line: line, Status: "ok", Message: "将创建/更新学生"})
		if dryRun {
			continue
		}

		sentinel := "stu_" + schoolID + "_" + num // 占位手机号，保证唯一且不被密码登录命中
		var user model.User
		ex, _ := findStudentByNumber(tx, schoolID, num)
		if ex != nil {
			tx.Table("users").Where("id = ?", ex.ID).Updates(map[string]interface{}{"name": name, "school_id": schoolID})
			user = *ex
		} else {
			user = model.User{
				SchoolID:      strPtr(schoolID),
				Phone:         sentinel,
				PasswordHash:  "",
				Role:          "student",
				Name:          name,
				StudentNumber: strPtr(num),
				CampusID:      strPtr(strings.TrimSpace(row.Campus)),
			}
			if err := tx.Create(&user).Error; err != nil {
				return nil, err
			}
			createdUserIDs = append(createdUserIDs, user.ID)
		}

		// StudentClass 关联（upsert）
		var sc model.StudentClass
		e := tx.Where("student_id = ? AND class_id = ?", user.ID, cls.ID).First(&sc).Error
		if e != nil {
			sc = model.StudentClass{StudentID: user.ID, ClassID: cls.ID, EnrolledAt: time.Now()}
			if err2 := tx.Create(&sc).Error; err2 != nil {
				return nil, err2
			}
			createdStudentClassIDs = append(createdStudentClassIDs, sc.ID)
		}
	}

	if dryRun {
		return res, nil
	}
	if err := r.saveBatch(tx, schoolID, createdBy, "students", res, createdUserIDs, nil, createdStudentClassIDs, nil); err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}
	return res, nil
}

// ── 任课关系导入 ──

func (r *ImportRepository) ImportRelations(schoolID, createdBy string, rows []RelationImportRow, dryRun bool) (*ImportResult, error) {
	res := &ImportResult{Type: "relations", Total: len(rows)}
	var createdTeacherClassIDs []string

	tx := r.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() { _ = tx.Rollback() }()

	for i, row := range rows {
		line := i + 2
		phone := strings.TrimSpace(row.TeacherPhone)
		grade := strings.TrimSpace(row.Grade)
		clsName := strings.TrimSpace(row.ClassName)
		subject := strings.TrimSpace(row.Subject)
		if !phoneRe.MatchString(phone) {
			res.Invalid++
			res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "教师手机号格式不正确"})
			continue
		}
		if grade == "" || clsName == "" || subject == "" {
			res.Invalid++
			res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "年级/班级/学科 均不能为空"})
			continue
		}
		teacher, err := findUserByPhone(tx, phone)
		if err != nil {
			res.Invalid++
			res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "教师不存在（需先导入教师）"})
			continue
		}
		cls, err := findClass(tx, schoolID, grade, clsName)
		if err != nil {
			res.Invalid++
			res.Rows = append(res.Rows, RowResult{Line: line, Status: "error", Message: "对应班级不存在（需先导入班级）"})
			continue
		}

		res.Valid++
		res.Rows = append(res.Rows, RowResult{Line: line, Status: "ok", Message: "将创建/更新任课关系"})
		if dryRun {
			continue
		}
		var tc model.TeacherClass
		e := tx.Where("teacher_id = ? AND class_id = ? AND subject = ?", teacher.ID, cls.ID, subject).First(&tc).Error
		if e != nil {
			tc = model.TeacherClass{TeacherID: teacher.ID, ClassID: cls.ID, Subject: subject, IsPrimary: false}
			if err2 := tx.Create(&tc).Error; err2 != nil {
				return nil, err2
			}
			createdTeacherClassIDs = append(createdTeacherClassIDs, tc.ID)
		}
	}

	if dryRun {
		return res, nil
	}
	if err := r.saveBatch(tx, schoolID, createdBy, "relations", res, nil, nil, nil, createdTeacherClassIDs); err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}
	return res, nil
}

// ── 批次记录与回滚 ──

func (r *ImportRepository) saveBatch(tx *gorm.DB, schoolID, createdBy, typ string, res *ImportResult, userIDs, classIDs, studentClassIDs, teacherClassIDs []string) error {
	sum := model.ImportBatchSummary{
		CreatedUserIDs:         userIDs,
		CreatedClassIDs:        classIDs,
		CreatedStudentClassIDs: studentClassIDs,
		CreatedTeacherClassIDs: teacherClassIDs,
	}
	raw, _ := json.Marshal(sum)
	batch := model.ImportBatch{
		SchoolID:     schoolID,
		Type:         typ,
		CreatedBy:    createdBy,
		Status:       "committed",
		TotalRows:    res.Total,
		CreatedRows:  res.Valid,
		SkippedRows:  res.Warnings + res.Invalid,
		Summary:      string(raw),
	}
	if err := tx.Create(&batch).Error; err != nil {
		return err
	}
	res.BatchID = batch.ID
	return nil
}

// ListBatches 导入历史
func (r *ImportRepository) ListBatches(schoolID string) ([]model.ImportBatch, error) {
	var batches []model.ImportBatch
	err := r.db.Where("school_id = ?", schoolID).Order("created_at DESC").Find(&batches).Error
	return batches, err
}

// GetBatch 按 ID 获取批次（校验归属学校）
func (r *ImportRepository) GetBatch(id, schoolID string) (*model.ImportBatch, error) {
	var b model.ImportBatch
	err := r.db.Where("id = ? AND school_id = ?", id, schoolID).First(&b).Error
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// Rollback 按 batch_id 全回滚（逆序删除子表→班级→用户）
func (r *ImportRepository) Rollback(batch *model.ImportBatch) error {
	var sum model.ImportBatchSummary
	if batch.Summary != "" {
		if err := json.Unmarshal([]byte(batch.Summary), &sum); err != nil {
			return err
		}
	}
	return r.db.Transaction(func(tx *gorm.DB) error {
		if len(sum.CreatedTeacherClassIDs) > 0 {
			if err := tx.Where("id IN ?", sum.CreatedTeacherClassIDs).Delete(&model.TeacherClass{}).Error; err != nil {
				return err
			}
		}
		if len(sum.CreatedStudentClassIDs) > 0 {
			if err := tx.Where("id IN ?", sum.CreatedStudentClassIDs).Delete(&model.StudentClass{}).Error; err != nil {
				return err
			}
		}
		if len(sum.CreatedClassIDs) > 0 {
			if err := tx.Where("id IN ?", sum.CreatedClassIDs).Delete(&model.Class{}).Error; err != nil {
				return err
			}
		}
		if len(sum.CreatedUserIDs) > 0 {
			if err := tx.Where("id IN ?", sum.CreatedUserIDs).Delete(&model.User{}).Error; err != nil {
				return err
			}
		}
		return tx.Table("import_batches").Where("id = ?", batch.ID).Update("status", "rolled_back").Error
	})
}

func normalizeClassType(t string) string {
	switch strings.TrimSpace(t) {
	case "实验", "experimental":
		return "experimental"
	case "普通", "normal", "":
		return "normal"
	default:
		return "normal"
	}
}
