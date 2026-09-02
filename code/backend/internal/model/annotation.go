package model

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// Annotation 批注（通用，挂任意作品：课件/教案/试卷/习题/题单/单题）。
// 批注是作品的标注/评审资产，发布前后均可增删（不冻结）。
type Annotation struct {
	ID           string    `gorm:"column:id;type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID     string    `gorm:"column:school_id;type:varchar(50);not null;index" json:"school_id"`
	UserID       string    `gorm:"column:user_id;type:varchar(50);not null;index" json:"user_id"`
	ResourceType string    `gorm:"column:resource_type;type:varchar(20);not null;index:idx_ann_resource,priority:1" json:"resource_type"`
	ResourceID   string    `gorm:"column:resource_id;type:varchar(50);not null;index:idx_ann_resource,priority:2" json:"resource_id"`
	AnchorType   string    `gorm:"column:anchor_type;type:varchar(10);not null" json:"anchor_type"` // page(课件按页) | text(TipTap选中文字)
	Anchor       string    `gorm:"column:anchor;type:jsonb;default:'{}'" json:"anchor"`             // page→{"page":3}; text→{"text":"...","from":n,"to":n}
	Comment      string    `gorm:"column:comment;type:text;not null" json:"comment"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (Annotation) TableName() string { return "annotations" }

// Version 版本记录（通用，承载留痕合规职责）。
//
// 双重职责（用 Kind 区分，向后兼容）：
//  1. kind=snapshot 草稿期手动快照：可存可回退，沿用原有行为。
//  2. kind=release  正式版本：内容 + 审核留痕，**只追加、不可改、不可删**——
//     是内容安全责任可追溯的载体。
//
// payload 为多态 JSONB：课件=OutlineSlide[]、教案/试卷/习题=HTML字符串、组卷=questions数组。
//
// 设计原则：**版本即证据**。每个 release 版本必须能回答六个问题：
//   改了什么（payload / parent_id）· 谁改的（user_id）· 审没审（review_status / check_result）
//   · 谁审的（reviewer_id）· AI 参与多少（ai_*）· 投放到哪（published_*）
type Version struct {
	ID           string    `gorm:"column:id;type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolID     string    `gorm:"column:school_id;type:varchar(50);not null;index" json:"school_id"`
	UserID       string    `gorm:"column:user_id;type:varchar(50);not null;index" json:"user_id"`
	ResourceType string    `gorm:"column:resource_type;type:varchar(20);not null;index:idx_ver_resource,priority:1" json:"resource_type"`
	ResourceID   string    `gorm:"column:resource_id;type:varchar(50);not null;index:idx_ver_resource,priority:2" json:"resource_id"`
	Label        string    `gorm:"column:label;type:varchar(200)" json:"label"`
	Payload      string    `gorm:"column:payload;type:jsonb;not null" json:"payload"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`

	// ── 版本链：让"第几版"可引用、可比对 ──
	Kind       string `gorm:"column:kind;type:varchar(20);not null;default:'snapshot'" json:"kind"` // snapshot | release
	VersionNo  int    `gorm:"column:version_no;type:int;not null;default:0" json:"version_no"`      // 同资源内递增，release 专用
	ParentID   string `gorm:"column:parent_id;type:varchar(50)" json:"parent_id"`                   // 上一版本 ID，形成链（支持 diff）
	ChangeNote string `gorm:"column:change_note;type:text" json:"change_note"`                      // 变更说明

	// ── 审核留痕：证明"审过、结论是什么" ──
	ReviewStatus string `gorm:"column:review_status;type:varchar(20);not null;default:'none';index" json:"review_status"`
	// none 未提交审查 | pending 待人工 | auto_pass 机检+AI评审通过自动放行
	// | approved 人工审核通过 | rejected 驳回（须修改）
	CheckResult   string     `gorm:"column:check_result;type:jsonb" json:"check_result"` // 机检+AI评审完整结论 issues[]，事后可复现当时判定
	ReviewerID    string     `gorm:"column:reviewer_id;type:varchar(50);index" json:"reviewer_id"`
	ReviewComment string     `gorm:"column:review_comment;type:text" json:"review_comment"`
	ReviewedAt    *time.Time `gorm:"column:reviewed_at" json:"reviewed_at"`

	// ── AI 归属：落实《生成式人工智能服务管理暂行办法》的标识要求 ──
	// 注意：教师改过的版本，AIGenerated 仍为 true（底稿由 AI 生成），同时 HumanEdited=true，
	// 以此如实反映"AI 参与程度"，而非简单地因为被人碰过就摘掉 AI 标识。
	AIGenerated    bool   `gorm:"column:ai_generated;not null;default:false" json:"ai_generated"`
	AIModelVersion string `gorm:"column:ai_model_version;type:varchar(50)" json:"ai_model_version"`
	HumanEdited    bool   `gorm:"column:human_edited;not null;default:false" json:"human_edited"`

	// ── 投放追溯：锁定"当时实际用的是哪一版" ──
	PublishedAt *time.Time `gorm:"column:published_at" json:"published_at"`
	PublishedBy string     `gorm:"column:published_by;type:varchar(50)" json:"published_by"`
}

func (Version) TableName() string { return "versions" }

// BeforeUpdate 拦截对 release 版本的修改。
// 留痕的前提是记录不可篡改：release 版本一经写入，只允许追加，不允许改。
// snapshot（草稿期手动快照）不受此限，仍可正常更新。
func (v *Version) BeforeUpdate(tx *gorm.DB) error {
	if v.Kind == "release" {
		return fmt.Errorf("release 版本记录不可修改（留痕只可追加，不可篡改）")
	}
	return nil
}

// BeforeDelete 拦截删除 release 版本，保证事后仍可追溯"当时发布的是什么"。
func (v *Version) BeforeDelete(tx *gorm.DB) error {
	if v.Kind == "release" {
		return fmt.Errorf("release 版本记录不可删除（留痕须保留以备追溯）")
	}
	return nil
}
