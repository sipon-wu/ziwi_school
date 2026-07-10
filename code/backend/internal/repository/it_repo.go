package repository

import (
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
)

// ITUser IT管理员用户视图
type ITUser struct {
	ID        string    `gorm:"type:varchar(50)" json:"id"`
	SchoolID  *string   `gorm:"type:varchar(50)" json:"school_id"`
	Phone     string    `gorm:"type:varchar(20)" json:"phone"`
	Name      string    `gorm:"type:varchar(100)" json:"name"`
	Role      string    `gorm:"type:varchar(30)" json:"role"`
	Status    string    `gorm:"type:varchar(20)" json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// Contact 校园通讯录
type Contact struct {
	ID    string `gorm:"type:varchar(50)" json:"id"`
	Name  string `gorm:"type:varchar(100)" json:"name"`
	Phone string `gorm:"type:varchar(20)" json:"phone"`
	Role  string `gorm:"type:varchar(30)" json:"role"`
	Dept  string `json:"dept"`
}

// TextbookVersionView 教材版本视图
type TextbookVersionView struct {
	ID          string `gorm:"type:varchar(50)" json:"id"`
	Subject     string `gorm:"type:varchar(20)" json:"subject"`
	Grade       string `gorm:"type:varchar(20)" json:"grade"`
	Publisher   string `gorm:"type:varchar(100)" json:"publisher"`
	VersionName string `gorm:"type:varchar(200)" json:"version_name"`
	Scope       string `gorm:"type:varchar(20)" json:"scope"`
	Status      string `gorm:"type:varchar(20)" json:"status"`
}

type ITRepository struct {
	db *gorm.DB
}

func NewITRepository(db *gorm.DB) *ITRepository {
	return &ITRepository{db: db}
}

// ListAllUsers 所有用户列表（IT管理员视角）
func (r *ITRepository) ListAllUsers(schoolID string) ([]ITUser, error) {
	var users []ITUser
	err := r.db.Table("users").
		Select("id, school_id, phone, name, role, status, created_at").
		Where("school_id = ?", schoolID).
		Order("created_at DESC").
		Find(&users).Error
	return users, err
}

// ListContacts 通讯录（按角色分组）
func (r *ITRepository) ListContacts(schoolID string) ([]Contact, error) {
	var contacts []Contact
	err := r.db.Raw(`
		SELECT u.id, u.name, u.phone, u.role,
			CASE u.role
				WHEN 'teacher' THEN '语文教研组'
				WHEN 'head_teacher' THEN '年级组'
				WHEN 'research_lead' THEN '教研组'
				WHEN 'registrar' THEN '教务处'
				WHEN 'principal' THEN '校长室'
				ELSE '其他'
			END as dept
		FROM users u
		WHERE u.school_id = ? AND u.status = 'active'
		ORDER BY u.role, u.name
	`, schoolID).Scan(&contacts).Error
	return contacts, err
}

// ListTextbookVersions 教材版本列表：公共库 tb_textbook_version 全量 + 本校覆盖层合并。
// 被学校覆盖过的行，publisher/version_name 用学校值，scope 标记为 'school'（前端优先采用）；
// 未覆盖的行维持平台值，scope='platform'。覆盖层仅本校可见，多校互不影响。
func (r *ITRepository) ListTextbookVersions(schoolID string) ([]TextbookVersionView, error) {
	var platform []TextbookVersionView
	err := r.db.Table("tb_textbook_version").
		Select(`CAST(id AS VARCHAR) as id, xue_ke as subject, nian_ji as grade,
			chu_ban_she as publisher, ban_ben_biao_shi as version_name,
			'platform' as scope, 'active' as status`).
		Order("xue_ke, nian_ji").
		Find(&platform).Error
	if err != nil {
		return nil, err
	}

	// 取本校覆盖层，建 key=(subject\x00grade) -> (publisher, version_name) 映射
	type ov struct{ publisher, versionName string }
	ovMap := make(map[string]ov)
	var overrides []model.SchoolTextbookOverride
	if err := r.db.Where("school_id = ?", schoolID).Find(&overrides).Error; err != nil {
		return nil, err
	}
	for _, o := range overrides {
		ovMap[o.Subject+"\x00"+o.Grade] = ov{o.Publisher, o.VersionName}
	}

	// 合并：命中覆盖层则替换 publisher/version_name 并标记 scope='school'
	out := make([]TextbookVersionView, 0, len(platform))
	for _, p := range platform {
		v := p
		if o, ok := ovMap[p.Subject+"\x00"+(p.Grade)]; ok {
			v.Publisher = o.publisher
			v.VersionName = o.versionName
			v.Scope = "school"
		}
		out = append(out, v)
	}
	return out, nil
}

// ── 角色分配（G2）──

// validSchoolRoles 学校 IT 后台可分配的校内角色（不含平台角色/学生）
var validSchoolRoles = map[string]bool{
	"teacher":      true,
	"head_teacher": true,
	"research_lead": true,
	"registrar":    true,
	"principal":    true,
	"it_admin":     true,
}

// UpdateUserRole 单用户改角色（角色分配/一键初始化的原子操作）
func (r *ITRepository) UpdateUserRole(schoolID, userID, role string) error {
	if !validSchoolRoles[role] {
		return fmt.Errorf("invalid role: %s", role)
	}
	res := r.db.Table("users").
		Where("id = ? AND school_id = ?", userID, schoolID).
		Update("role", role)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

// ── 教材版本学校自用覆盖层 ──

// UpsertSchoolTextbook 按 (学校, 学科, 年级) upsert 一条 scope='school' 覆盖行，仅本校生效。
// 写学校本地副本表 school_textbook_override，不影响公共库 tb_textbook_version，多校互不影响。
func (r *ITRepository) UpsertSchoolTextbook(schoolID, subject, grade, publisher, versionName string) error {
	return r.db.Exec(`
		INSERT INTO school_textbook_override (id, school_id, subject, grade, publisher, version_name, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now(), now())
		ON CONFLICT (school_id, subject, grade)
		DO UPDATE SET publisher = EXCLUDED.publisher, version_name = EXCLUDED.version_name, updated_at = now()
	`, schoolID, subject, grade, publisher, versionName).Error
}

