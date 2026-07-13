package repository

import (
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

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

// ── V2.6 全学科教材版本库（tb_textbook_version）运行期维护 ──

// ListRawTextbookVersions 原始版本库列表（含 id / version_key，供维护 UI 使用）
func (r *ITRepository) ListRawTextbookVersions() ([]model.TextbookVersion, error) {
	var vs []model.TextbookVersion
	if err := r.db.Order("xue_ke, nian_ji, ban_ben_biao_shi").Find(&vs).Error; err != nil {
		return nil, err
	}
	if vs == nil {
		vs = []model.TextbookVersion{}
	}
	return vs, nil
}

// UpsertTextbookVersion 按 version_key 写入/更新一条版本库记录
func (r *ITRepository) UpsertTextbookVersion(v *model.TextbookVersion) error {
	return r.db.Exec(`
		INSERT INTO tb_textbook_version (version_key, xue_duan, nian_ji, xue_ke, jiao_cai_ming, chu_ban_she, ban_ben_biao_shi, ce_bie, mu_lu_url, inferred, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), now())
		ON CONFLICT (version_key) DO UPDATE SET
			xue_duan=EXCLUDED.xue_duan, nian_ji=EXCLUDED.nian_ji, xue_ke=EXCLUDED.xue_ke,
			jiao_cai_ming=EXCLUDED.jiao_cai_ming, chu_ban_she=EXCLUDED.chu_ban_she,
			ban_ben_biao_shi=EXCLUDED.ban_ben_biao_shi, ce_bie=EXCLUDED.ce_bie,
			mu_lu_url=EXCLUDED.mu_lu_url, inferred=EXCLUDED.inferred, updated_at=now()`,
		v.VersionKey, v.XueDuan, v.NianJi, v.XueKe, v.JiaoCaiMing, v.ChuBanShe, v.BanBenBiaoShi, v.CeBie, v.MuLuURL, v.Inferred,
	).Error
}

// UpdateTextbookVersion 按 id 更新一条版本库记录
func (r *ITRepository) UpdateTextbookVersion(id int64, v *model.TextbookVersion) error {
	res := r.db.Model(&model.TextbookVersion{}).Where("id = ?", id).Updates(map[string]interface{}{
		"xue_duan": v.XueDuan, "nian_ji": v.NianJi, "xue_ke": v.XueKe, "jiao_cai_ming": v.JiaoCaiMing,
		"chu_ban_she": v.ChuBanShe, "ban_ben_biao_shi": v.BanBenBiaoShi, "ce_bie": v.CeBie,
		"mu_lu_url": v.MuLuURL, "inferred": v.Inferred,
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("version not found")
	}
	return nil
}

// DeleteTextbookVersion 按 id 删除一条版本库记录
func (r *ITRepository) DeleteTextbookVersion(id int64) error {
	res := r.db.Where("id = ?", id).Delete(&model.TextbookVersion{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("version not found")
	}
	return nil
}

// ImportTextbookVersions 批量导入版本库（数据团队交付），按 version_key upsert，事务内执行
func (r *ITRepository) ImportTextbookVersions(rows []model.TextbookVersion) (int, error) {
	if len(rows) == 0 {
		return 0, nil
	}
	err := r.db.Transaction(func(tx *gorm.DB) error {
		for i := range rows {
			v := rows[i]
			if err := tx.Exec(`
				INSERT INTO tb_textbook_version (version_key, xue_duan, nian_ji, xue_ke, jiao_cai_ming, chu_ban_she, ban_ben_biao_shi, ce_bie, mu_lu_url, inferred, created_at, updated_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), now())
				ON CONFLICT (version_key) DO UPDATE SET
					xue_duan=EXCLUDED.xue_duan, nian_ji=EXCLUDED.nian_ji, xue_ke=EXCLUDED.xue_ke,
					jiao_cai_ming=EXCLUDED.jiao_cai_ming, chu_ban_she=EXCLUDED.chu_ban_she,
					ban_ben_biao_shi=EXCLUDED.ban_ben_biao_shi, ce_bie=EXCLUDED.ce_bie,
					mu_lu_url=EXCLUDED.mu_lu_url, inferred=EXCLUDED.inferred, updated_at=now()`,
				v.VersionKey, v.XueDuan, v.NianJi, v.XueKe, v.JiaoCaiMing, v.ChuBanShe, v.BanBenBiaoShi, v.CeBie, v.MuLuURL, v.Inferred,
			).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return len(rows), nil
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

// ── V2.5 教材版本三级配置 ──

// ListTextbookConfigs 列出本校所有三级教材配置（学校级/年级学科级/班级级）
func (r *ITRepository) ListTextbookConfigs(schoolID string) ([]model.TextbookConfig, error) {
	var cfgs []model.TextbookConfig
	if err := r.db.Where("school_id = ?", schoolID).
		Order("config_type, subject, grade, class_id").
		Find(&cfgs).Error; err != nil {
		return nil, err
	}
	if cfgs == nil {
		cfgs = []model.TextbookConfig{}
	}
	return cfgs, nil
}

// UpsertTextbookConfig 按唯一键 (school_id, config_type, subject, grade, class_id) upsert 一条配置。
// 学校级 grade=空、class_id=nil；年级学科级 grade=年级、class_id=nil；班级级 class_id=班级、grade=年级。
// 注：GORM Exec 的 prepared statement 不支持单字符串多语句，故 DELETE 与 INSERT 分两次执行。
func (r *ITRepository) UpsertTextbookConfig(cfg *model.TextbookConfig) error {
	if err := r.db.Exec(
		`DELETE FROM textbook_config WHERE school_id = $1 AND config_type = $2 AND subject = $3 AND grade IS NOT DISTINCT FROM $4 AND class_id IS NOT DISTINCT FROM $5`,
		cfg.SchoolID, string(cfg.ConfigType), cfg.Subject, cfg.Grade, cfg.ClassID,
	).Error; err != nil {
		return err
	}
	return r.db.Exec(
		`INSERT INTO textbook_config (id, school_id, config_type, subject, grade, class_id, publisher, version_name, created_at, updated_at)
		 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, now(), now())`,
		cfg.SchoolID, string(cfg.ConfigType), cfg.Subject, cfg.Grade, cfg.ClassID, cfg.Publisher, cfg.VersionName,
	).Error
}

// DeleteTextbookConfig 删除一条本校配置
func (r *ITRepository) DeleteTextbookConfig(schoolID, id string) error {
	res := r.db.Exec(`DELETE FROM textbook_config WHERE school_id = $1 AND id = $2`, schoolID, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("config not found")
	}
	return nil
}

// ResolveTextbookConfig 按优先级解析某学科在某班级的实际教材版本。
// 优先级：班级级(class_subject) > 年级学科级(grade_subject) > 学校级(school)
func (r *ITRepository) ResolveTextbookConfig(schoolID, subject, grade string, classID *string) (*model.ResolvedTextbook, error) {
	var cfg model.TextbookConfig
	// 1) 班级级
	if classID != nil {
		if err := r.db.Where("school_id = ? AND config_type = ? AND subject = ? AND class_id IS NOT DISTINCT FROM ?",
			schoolID, string(model.ConfigTypeClassSubject), subject, classID).
			First(&cfg).Error; err == nil {
			return &model.ResolvedTextbook{Subject: subject, Publisher: cfg.Publisher, VersionName: cfg.VersionName, SourceLevel: "class_subject"}, nil
		}
	}
	// 2) 年级学科级
	if grade != "" {
		if err := r.db.Where("school_id = ? AND config_type = ? AND subject = ? AND grade IS NOT DISTINCT FROM ?",
			schoolID, string(model.ConfigTypeGradeSubject), subject, grade).
			First(&cfg).Error; err == nil {
			return &model.ResolvedTextbook{Subject: subject, Publisher: cfg.Publisher, VersionName: cfg.VersionName, SourceLevel: "grade_subject"}, nil
		}
	}
	// 3) 学校级
	if err := r.db.Where("school_id = ? AND config_type = ? AND subject = ?",
		schoolID, string(model.ConfigTypeSchool), subject).
		First(&cfg).Error; err == nil {
		return &model.ResolvedTextbook{Subject: subject, Publisher: cfg.Publisher, VersionName: cfg.VersionName, SourceLevel: "school"}, nil
	}
	return nil, nil
}

// ── V2.5/2.6 教师个人教材偏好（per-user，跨设备同步，规格书 §5.1）──
// 维度：年级 + 班级 + 学科。唯一键 (teacher_id, grade, class_id, subject)。
// 教师可在个人设置里为「每年级每班每学科」指定版本，优先级高于学校级配置，仅影响个人产出。

// UpsertTeacherTextbookPref 按唯一键 (teacher_id, grade, class_id, subject) upsert 一条个人教材偏好。
func (r *ITRepository) UpsertTeacherTextbookPref(teacherID, schoolID, grade, classID, subject, publisher, versionName string) error {
	if err := r.db.Exec(
		`DELETE FROM teacher_textbook_pref WHERE teacher_id = $1 AND grade IS NOT DISTINCT FROM $2 AND class_id IS NOT DISTINCT FROM $3 AND subject = $4`,
		teacherID, grade, classID, subject,
	).Error; err != nil {
		return err
	}
	return r.db.Exec(
		`INSERT INTO teacher_textbook_pref (id, teacher_id, school_id, grade, class_id, subject, publisher, version_name, created_at, updated_at)
		 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, now(), now())`,
		teacherID, schoolID, grade, classID, subject, publisher, versionName,
	).Error
}

// ListTeacherTextbookPrefs 列出某教师全部个人教材偏好
func (r *ITRepository) ListTeacherTextbookPrefs(teacherID string) ([]model.TeacherTextbookPref, error) {
	var prefs []model.TeacherTextbookPref
	if err := r.db.Where("teacher_id = ?", teacherID).Order("subject, grade, class_id").Find(&prefs).Error; err != nil {
		return nil, err
	}
	if prefs == nil {
		prefs = []model.TeacherTextbookPref{}
	}
	return prefs, nil
}

// DeleteTeacherTextbookPref 删除某教师某 (年级, 班级, 学科) 的个人教材偏好
func (r *ITRepository) DeleteTeacherTextbookPref(teacherID, grade, classID, subject string) error {
	res := r.db.Exec(`DELETE FROM teacher_textbook_pref WHERE teacher_id = $1 AND grade IS NOT DISTINCT FROM $2 AND class_id IS NOT DISTINCT FROM $3 AND subject = $4`, teacherID, grade, classID, subject)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("pref not found")
	}
	return nil
}

// ResolveEffectiveTextbook 解析某教师在某 (学科, 年级, 班级) 下的有效教材版本。
// 优先级：个人偏好(班级级>年级级>学科级) > 学校配置(class_subject>grade_subject>school) > 平台库默认。
// 返回解析结果与来源标记（personal:class / personal:grade / personal:subject / school:* / library / none）。
func (r *ITRepository) ResolveEffectiveTextbook(teacherID, schoolID, subject, grade string, classID *string) (*model.ResolvedTextbook, string, error) {
	cid := ""
	if classID != nil {
		cid = *classID
	}
	// 1) 个人偏好
	var prefs []model.TeacherTextbookPref
	if err := r.db.Where("teacher_id = ? AND subject = ?", teacherID, subject).Find(&prefs).Error; err != nil {
		return nil, "", err
	}
	var exact, gradeOnly, subjOnly *model.TeacherTextbookPref
	for i := range prefs {
		p := &prefs[i]
		switch {
		case p.Grade == grade && p.ClassID == cid:
			exact = p
		case p.Grade == grade && p.ClassID == "":
			gradeOnly = p
		case p.Grade == "" && p.ClassID == "":
			subjOnly = p
		}
	}
	if exact != nil {
		return &model.ResolvedTextbook{Subject: subject, Publisher: exact.Publisher, VersionName: exact.VersionName}, "personal:class", nil
	}
	if gradeOnly != nil {
		return &model.ResolvedTextbook{Subject: subject, Publisher: gradeOnly.Publisher, VersionName: gradeOnly.VersionName}, "personal:grade", nil
	}
	if subjOnly != nil {
		return &model.ResolvedTextbook{Subject: subject, Publisher: subjOnly.Publisher, VersionName: subjOnly.VersionName}, "personal:subject", nil
	}
	// 2) 学校配置
	cfg, err := r.ResolveTextbookConfig(schoolID, subject, grade, classID)
	if err != nil {
		return nil, "", err
	}
	if cfg != nil {
		return cfg, "school:" + cfg.SourceLevel, nil
	}
	// 3) 平台库默认（优先匹配年级，否则取该学科任意一条）
	//    组内二级排序：优先版本标识非空（ban_ben_biao_shi 有值）的行，避免把空版本当默认
	var lib model.TextbookVersion
	if err := r.db.Where("xue_ke = ? AND (nian_ji = ? OR nian_ji = '' OR nian_ji IS NULL)", subject, grade).
		Order(clause.Expr{SQL: "CASE WHEN nian_ji = ? THEN 0 ELSE 1 END", Vars: []interface{}{grade}}).
		Order("CASE WHEN ban_ben_biao_shi = '' OR ban_ben_biao_shi IS NULL THEN 1 ELSE 0 END").
		Order("id").
		First(&lib).Error; err == nil && lib.ID != 0 {
		return &model.ResolvedTextbook{Subject: subject, Publisher: lib.ChuBanShe, VersionName: lib.BanBenBiaoShi}, "library", nil
	}
	var any model.TextbookVersion
	if err := r.db.Where("xue_ke = ?", subject).
		Order("CASE WHEN ban_ben_biao_shi = '' OR ban_ben_biao_shi IS NULL THEN 1 ELSE 0 END, id").
		First(&any).Error; err == nil {
		return &model.ResolvedTextbook{Subject: subject, Publisher: any.ChuBanShe, VersionName: any.BanBenBiaoShi}, "library", nil
	}
	return nil, "none", nil
}

// ── V2.6 用户贡献教材版本 ──

// FindTextbookVersionBySubjectAndName 按学科+教材名+版本名查重
func (r *ITRepository) FindTextbookVersionBySubjectAndName(xueKe, jiaoCaiMing, banBen string) (*model.TextbookVersion, error) {
	var v model.TextbookVersion
	err := r.db.Where("xue_ke = ? AND (jiao_cai_ming = ? OR jiao_cai_ming ILIKE ?)", xueKe, jiaoCaiMing, "%"+jiaoCaiMing+"%").
		Order("id").
		First(&v).Error
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// SubmitTextbookVersion 用户提交新教材版本（待审核）
func (r *ITRepository) SubmitTextbookVersion(v *model.UserSubmittedTextbookVersion) error {
	return r.db.Create(v).Error
}

// ListPendingSubmittedVersions IT 管理员查看待审核列表
func (r *ITRepository) ListPendingSubmittedVersions() ([]model.UserSubmittedTextbookVersion, error) {
	var vs []model.UserSubmittedTextbookVersion
	if err := r.db.Where("status = ?", model.SubmitStatusPending).
		Order("submitted_at DESC").
		Find(&vs).Error; err != nil {
		return nil, err
	}
	if vs == nil {
		vs = []model.UserSubmittedTextbookVersion{}
	}
	return vs, nil
}

// ApproveSubmittedVersion 审核通过：将用户贡献版本写入 tb_textbook_version 正式库
// 同时将状态更新为 approved。返回新创建的 tb_textbook_version id。
func (r *ITRepository) ApproveSubmittedVersion(id int64, adminID string) (int64, error) {
	var sub model.UserSubmittedTextbookVersion
	if err := r.db.First(&sub, id).Error; err != nil {
		return 0, err
	}
	if sub.Status != model.SubmitStatusPending {
		return 0, fmt.Errorf("版本状态不是待审核（当前: %s）", sub.Status)
	}

	// 构造正式教材版本（version_key 复用用户提交的，若冲突则 ON CONFLICT UPDATE）
	tv := model.TextbookVersion{
		VersionKey:    sub.VersionKey,
		XueDuan:       sub.XueDuan,
		NianJi:        sub.NianJi,
		XueKe:         sub.XueKe,
		JiaoCaiMing:   sub.JiaoCaiMing,
		ChuBanShe:     sub.ChuBanShe,
		BanBenBiaoShi: sub.BanBenBiaoShi,
		CeBie:         sub.CeBie,
		Inferred:      false,
	}

	// 通过 upsert 写入正式库
	if err := r.UpsertTextbookVersion(&tv); err != nil {
		return 0, fmt.Errorf("入库失败: %w", err)
	}

	// 查询回填正式 id（UpsertTextbookVersion 用 Exec 不自动回填 ID）
	var inserted model.TextbookVersion
	r.db.Where("version_key = ?", sub.VersionKey).First(&inserted)

	// 更新提交记录状态
	now := time.Now()
	r.db.Model(&sub).Updates(map[string]interface{}{
		"status":      model.SubmitStatusApproved,
		"reviewed_by": adminID,
		"reviewed_at": now,
	})

	return inserted.ID, nil
}

// RejectSubmittedVersion 驳回用户提交
func (r *ITRepository) RejectSubmittedVersion(id int64, adminID string, note string) error {
	var sub model.UserSubmittedTextbookVersion
	if err := r.db.First(&sub, id).Error; err != nil {
		return err
	}
	if sub.Status != model.SubmitStatusPending {
		return fmt.Errorf("版本状态不是待审核（当前: %s）", sub.Status)
	}
	now := time.Now()
	return r.db.Model(&sub).Updates(map[string]interface{}{
		"status":      model.SubmitStatusRejected,
		"reviewed_by": adminID,
		"reviewed_at": now,
		"review_note": note,
	}).Error
}

