package handler

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/policy"
)

// ReleaseMeta 发布留痕所需的元信息，由各内容类型（课件/教案/习题/试卷）自行填充。
type ReleaseMeta struct {
	ResourceType   string // courseware | lesson_plan | exercise | exam
	ResourceID     string
	Label          string
	Payload        string // 内容快照（课件=OutlineSlide JSON，教案=HTML，习题=题干+答案）
	AIGenerated    bool
	AIModelVersion string
	HumanEdited    bool
}

// recordRelease 发布留痕：写入 versions（kind=release）。
//
// 设计原则：**版本即证据** —— 记录「内容 + 审核结论 + AI 归属 + 发布人」，只追加不修改。
// 这是「没有外部审定期关口，学校自主把关」能够成立的凭据。
//
// 写失败只记日志，不阻断发布：留痕是增强，不能因留痕失败而卡死业务。
//
// 参数说明：
//   - res 为 nil 表示**审核没跑成**（服务不可用），此时 review_status=pending 交人工兜底，
//     严禁当作"审核通过"。
//   - reviewStatus 为空则自动推导（审核通过=auto_pass，审核没跑成=pending）；
//     调用方需覆盖时传入（如教案走学校互审时传 pending）。
func recordRelease(db *gorm.DB, c *gin.Context, meta ReleaseMeta, res *policy.Result, reviewStatus string) {
	if db == nil {
		return
	}
	uid, _ := c.Get("user_id")
	sid, _ := c.Get("school_id")
	userID, _ := uid.(string)
	schoolID, _ := sid.(string)

	checkJSON := ""
	if res != nil {
		if b, err := json.Marshal(res.Issues); err == nil {
			checkJSON = string(b)
		}
	}
	if reviewStatus == "" {
		reviewStatus = "auto_pass"
		if res == nil {
			reviewStatus = "pending"
		}
	}

	var existCount int64
	db.Model(&model.Version{}).
		Where("resource_type = ? AND resource_id = ? AND kind = ?", meta.ResourceType, meta.ResourceID, "release").
		Count(&existCount)

	now := time.Now()
	v := &model.Version{
		SchoolID:       schoolID,
		UserID:         userID,
		ResourceType:   meta.ResourceType,
		ResourceID:     meta.ResourceID,
		Kind:           "release",
		VersionNo:      int(existCount) + 1,
		Label:          meta.Label,
		Payload:        meta.Payload,
		ReviewStatus:   reviewStatus,
		CheckResult:    checkJSON,
		AIGenerated:    meta.AIGenerated,
		AIModelVersion: meta.AIModelVersion,
		HumanEdited:    meta.HumanEdited,
		PublishedAt:    &now,
		PublishedBy:    userID,
	}
	if err := db.Create(v).Error; err != nil {
		log.Printf("[policy] 版本记录写入失败（不影响发布）: %v", err)
	}
}
