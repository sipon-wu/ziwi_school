package handler

import (
	"encoding/json"
	"log"
	"strings"
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
	// check_result 是 jsonb：空串/非法 JSON 会被 PG 拒绝（见 model.Version.CheckResult 的注释）→
	// 只有确实是合法 JSON 才写入，否则留 NULL（"未审"）
	var checkPtr *string
	if strings.TrimSpace(checkJSON) != "" && json.Valid([]byte(checkJSON)) {
		checkPtr = &checkJSON
	}
	// ⚠ payload 也是 **jsonb**（不是 text），此处曾**静默失效**（2026-09-18 实测定位）：
	// meta.Payload 对课件是 markdown、对教案是 HTML —— 都不是合法 JSON，直接写入会被 PG 拒绝
	// （SQLSTATE 22P02 invalid input syntax for type json），而错误被下方 log.Printf 吞掉，
	// 又因为"写失败不影响发布"的设计，表现为**发布留痕一条都没有**（实测 staging：versions 里
	// kind='release' 恒为 0，且无人察觉）。约定与前端一致（annotation_handler.CreateVersion：
	// 非 JSON 正文包成 JSON 字符串；既有 snapshot 行里 `"<p>旧版内容</p>"` 就是这个形态）；
	// 课件提纲这类本身是合法 JSON 的保持原样（两种形态在库里并存）。
	payload := meta.Payload
	if !json.Valid([]byte(payload)) {
		if b, err := json.Marshal(payload); err == nil {
			payload = string(b)
		}
	}
	v := &model.Version{
		SchoolID:       schoolID,
		UserID:         userID,
		ResourceType:   meta.ResourceType,
		ResourceID:     meta.ResourceID,
		Kind:           "release",
		VersionNo:      int(existCount) + 1,
		Label:          meta.Label,
		Payload:        payload,
		ReviewStatus:   reviewStatus,
		CheckResult:    checkPtr,
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
