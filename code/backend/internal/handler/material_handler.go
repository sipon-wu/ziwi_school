package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/policy"
	"github.com/zhiwei/backend/internal/repository"
)

type MaterialHandler struct {
	repo   *repository.MaterialRepository
	policy *policy.Client
	db     *gorm.DB // 写版本记录（审核留痕）
}

func NewMaterialHandler(repo *repository.MaterialRepository, pol *policy.Client, db *gorm.DB) *MaterialHandler {
	return &MaterialHandler{repo: repo, policy: pol, db: db}
}

// recordReleaseVersion 发布留痕：写入 versions（kind=release）。
//
// 设计原则：**版本即证据** —— 记录「内容 + 审核结论 + AI 归属 + 发布人」，只追加不修改。
// 写失败只记日志，不阻断发布：留痕是增强，不能因留痕失败而卡死业务。
//
// 参数 res 为 nil 表示审核没跑成（服务不可用），此时 review_status=pending，交人工兜底。
func (h *MaterialHandler) recordReleaseVersion(c *gin.Context, m *model.Material, res *policy.Result) {
	recordRelease(h.db, c, ReleaseMeta{
		ResourceType:   "courseware",
		ResourceID:     m.ID,
		Label:          m.Name,
		Payload:        m.Content,
		AIGenerated:    m.AIGenerated,
		AIModelVersion: m.AIModelVersion,
		HumanEdited:    m.HumanEdited,
	}, res, "")
}

func (h *MaterialHandler) ListMaterials(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	items, err := h.repo.List(schoolID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// 附加归属教师显示名（owner_name）：让列表页能回答"这批课件是谁的"
	attachOwnerNames(h.db, items)
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

// attachOwnerNames 为素材列表补充归属教师显示名（owner_name），不入库。
// 按 school 内出现的 user_id 一次性查询映射，避免 N+1；失败静默（owner_name 为空不影响列表可用）。
func attachOwnerNames(db *gorm.DB, items []model.Material) {
	ids := make(map[string]struct{}, len(items))
	for i := range items {
		if items[i].UserID != "" {
			ids[items[i].UserID] = struct{}{}
		}
	}
	if len(ids) == 0 {
		return
	}
	uidList := make([]string, 0, len(ids))
	for id := range ids {
		uidList = append(uidList, id)
	}
	var users []struct {
		ID   string
		Name string
	}
	if err := db.Table("users").Select("id, name").Where("id IN ?", uidList).Find(&users).Error; err != nil {
		return
	}
	nameOf := make(map[string]string, len(users))
	for _, u := range users {
		nameOf[u.ID] = u.Name
	}
	for i := range items {
		if items[i].UserID != "" {
			items[i].OwnerName = nameOf[items[i].UserID]
		}
	}
}

// GetMaterial 按 ID 获取单个素材（含 content，供 AI 课件生成读取参照课件正文）
func (h *MaterialHandler) GetMaterial(c *gin.Context) {
	id := c.Param("id")
	m, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "素材不存在"})
		return
	}
	c.JSON(http.StatusOK, m)
}

// ListDecor 装饰元件查询接口。
// scope=public 查平台公共装饰库（user_id 为空）；scope=mine 查当前账号装饰元件。
// 支持 facet 过滤: medium(ppt|h5|common) / motif(母题一级，逗号多值OR) /
// color(色系一级，逗号多值OR) / pageType(适用页型) / kind(decor_element|decor_component)。
func (h *MaterialHandler) ListDecor(c *gin.Context) {
	scope := c.DefaultQuery("scope", "public")
	medium := c.Query("medium")
	motif := c.Query("motif")
	color := c.Query("color")
	pageType := c.Query("page_type")
	kind := c.Query("kind")

	var items []model.Material
	var err error
	if scope == "public" {
		items, err = h.repo.ListPublicDecor(c, medium, motif, color, pageType)
	} else {
		uidVal, ok := c.Get("user_id")
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		var uid string
		switch v := uidVal.(type) {
		case string:
			uid = v
		case float64:
			uid = fmt.Sprintf("%.0f", v)
		default:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "用户标识类型异常"})
			return
		}
		if uid == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
			return
		}
		items, err = h.repo.ListDecorByFacets(c, uid, medium, motif, color, pageType, kind)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

func (h *MaterialHandler) UploadMaterial(c *gin.Context) {
	userID, _ := c.Get("user_id")
	schoolID, _ := c.Get("school_id")

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请选择文件"})
		return
	}
	defer file.Close()

	if header.Size > 50*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件不能超过50MB"})
		return
	}

	uploadDir := "uploads"
	os.MkdirAll(uploadDir, 0755)
	ext := filepath.Ext(header.Filename)
	storedName := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	fullPath := filepath.Join(uploadDir, storedName)

	dst, err := os.Create(fullPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "文件保存失败"})
		return
	}
	defer dst.Close()
	io.Copy(dst, file)

	m := &model.Material{
		Name:      c.PostForm("name"),
		SchoolID:  schoolID.(string),
		UserID:    userID.(string),
		Type:      c.PostForm("type"),
		Format:    c.PostForm("format"),
		Size:      formatFileSize(header.Size),
		Tag:       c.PostForm("tag"),
		URL:       "/uploads/" + storedName,
		CreatedAt: time.Now(),
	}
	if m.Name == "" {
		m.Name = header.Filename
	}
	if m.Type == "" {
		m.Type = guessType(ext)
	}
	if m.Format == "" {
		m.Format = m.Type // 文件上传无显式 format 时，默认与 type 同（如 video）
	}

	if err := h.repo.Create(m); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, m)
}

// CreateMaterialJSON 以 JSON 方式创建素材（用于程序化写入 AI 生成的课件）
// POST /api/materials/json
func (h *MaterialHandler) CreateMaterialJSON(c *gin.Context) {
	userID, _ := c.Get("user_id")
	schoolID, _ := c.Get("school_id")
	var body struct {
		Name    string  `json:"name"`
		Type    string  `json:"type"`
		Format  string  `json:"format"`
		Tag     string  `json:"tag"`
		URL     string  `json:"url"`
		Content string  `json:"content"`
		H5HTML  string  `json:"h5_html"`
		Status  string  `json:"status"`
		Grade   string  `json:"grade"`
		Subject string  `json:"subject"`
		ThemeID string  `json:"theme_id"`
		// ── 生成配方 / 溯源（2026-09-13）──
		// 只收"需要可查询"的标量；知识点/课标等明细在 GenParams（快照）里，**不另存一份**，
		// 避免同一份数据两处存、两处漂移（本项目历史教训）。
		TextbookVersionID string `json:"textbook_version_id"`
		Unit              string `json:"unit"`
		LessonPlanID      string `json:"lesson_plan_id"`
		Period            int    `json:"period"`
		GenParams         string `json:"gen_params"` // 生成配方完整快照（JSON 字符串）
		InteractiveSlots *string `json:"interactive_slots"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数有误"})
		return
	}
	if body.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写素材名称"})
		return
	}
	m := &model.Material{
		Name:      body.Name,
		SchoolID:  schoolID.(string),
		UserID:    userID.(string),
		Type:      body.Type,
		Format:    body.Format,
		Tag:       body.Tag,
		URL:       body.URL,
		Content:   body.Content,
		H5HTML:    body.H5HTML,
		Status:    body.Status,
		Grade:     body.Grade,
		Subject:   body.Subject,
		ThemeID:   body.ThemeID,
		// 生成配方 / 溯源（2026-09-13）：**必须在此显式赋值** ——
		// 只加 DTO/model 而漏了这几行，请求里带了也会被静默丢弃（落库为空、前端读不到）。
		TextbookVersionID: body.TextbookVersionID,
		Unit:              body.Unit,
		LessonPlanID:      body.LessonPlanID,
		Period:            body.Period,
		GenParams:         body.GenParams,
		CreatedAt: time.Now(),
	}
	if body.InteractiveSlots != nil {
		m.InteractiveSlots = *body.InteractiveSlots
	}
	if m.Type == "" {
		m.Type = "courseware"
	}
	if m.Status == "" {
		m.Status = "active"
	}

	// 内容安全审核（红线锁）：草稿永远可编辑、不审查；
	// 只有「发布进素材库」（status=active）这一动作才过闸。
	var auditRes *policy.Result
	if m.Status == "active" && h.policy != nil && h.policy.Enabled() {
		res, err := h.policy.Check(c.Request.Context(), policy.CheckRequest{
			Text:    strings.TrimSpace(m.Name + "\n" + m.Content),
			Subject: m.Subject,
			Grade:   m.Grade,
		})
		if err != nil {
			// 审核没能跑成 ≠ 内容没问题：降级为草稿，避免内容"裸奔"到可用状态
			log.Printf("[policy] 课件审核服务不可用，课件降级为草稿: %v", err)
			m.Status = "draft"
		} else if blocking := res.Blocking(); len(blocking) > 0 {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    "CONTENT_BLOCKED",
				"message": "内容未通过安全审核，请修改后再发布",
				"issues":  blocking,
			})
			return
		} else {
			auditRes = res
		}
	}

	if err := h.repo.Create(m); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if m.Status == "active" {
		h.recordReleaseVersion(c, m, auditRes)
	}
	c.JSON(http.StatusCreated, m)
}

// UpdateMaterial 更新素材（课件草稿/发布落库复用）
// PUT /api/materials/:id
func (h *MaterialHandler) UpdateMaterial(c *gin.Context) {
	id := c.Param("id")
	existing, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "素材不存在"})
		return
	}
	// 归属校验（2026-09-18 补，此前**完全没有**）：GetByID 不带任何范围过滤，于是任何登录用户
	// 只要知道 id 就能改**任意**素材（含跨校、含平台公共装饰元件库）——写入面比读取面宽是安全漏洞。
	//
	// 判据两条（缺一不可）：
	//   ① **同校**：口径取"同校"而非"仅本人"——素材库本身是校内共享的（repository.List 按 school_id
	//      返回全校素材，同事的课件在库里可见），收紧成仅本人可改会打断"同事共享课件被复用后保存"的正常流。
	//   ② **非平台公共资产**：`user_id` 为空的行（如装饰元件库）由平台运维维护/打标，教师端不得改写。
	//      注意：实测这些行的 `school_id` 是**真实学校**（如 sch-0001），所以只查 school_id 拦不住它们。
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	if schoolIDStr == "" || existing.SchoolID != schoolIDStr || existing.UserID == "" {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "无权修改该素材（仅限本校、非平台公共资产）"})
		return
	}
	originalContent := existing.Content // 用于判断是否真发生内容变更（决定是否记新版本）

	var body struct {
		Name    string  `json:"name"`
		Type    string  `json:"type"`
		Format  string  `json:"format"`
		Tag     string  `json:"tag"`
		URL     string  `json:"url"`
		Content string  `json:"content"`
		H5HTML  string  `json:"h5_html"`
		Status  string  `json:"status"`
		Grade   string  `json:"grade"`
		Subject string  `json:"subject"`
		ThemeID string  `json:"theme_id"`
		// ── 生成配方 / 溯源（2026-09-13）──
		// 只收"需要可查询"的标量；知识点/课标等明细在 GenParams（快照）里，**不另存一份**，
		// 避免同一份数据两处存、两处漂移（本项目历史教训）。
		TextbookVersionID string `json:"textbook_version_id"`
		Unit              string `json:"unit"`
		LessonPlanID      string `json:"lesson_plan_id"`
		Period            int    `json:"period"`
		GenParams         string `json:"gen_params"` // 生成配方完整快照（JSON 字符串）
		InteractiveSlots *string `json:"interactive_slots"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数有误"})
		return
	}
	existing.Name = body.Name
	existing.Type = body.Type
	if body.Format != "" {
		existing.Format = body.Format
	}
	existing.Tag = body.Tag
	existing.URL = body.URL
	existing.Content = body.Content
	existing.H5HTML = body.H5HTML
	wasActive := existing.Status == "active"
	if body.Status != "" {
		existing.Status = body.Status
	}
	existing.Grade = body.Grade
	existing.Subject = body.Subject
	existing.ThemeID = body.ThemeID
	// 生成配方 / 溯源（2026-09-13）：**仅在传入时覆盖**，不要无条件赋值 ——
	// 普通"保存草稿"不会带这些字段，无条件赋值会导致**每次保存都把原配方清空**。
	// （同 InteractiveSlots 的既有约定：未传 = 不动）
	if body.TextbookVersionID != "" {
		existing.TextbookVersionID = body.TextbookVersionID
	}
	if body.Unit != "" {
		existing.Unit = body.Unit
	}
	if body.LessonPlanID != "" {
		existing.LessonPlanID = body.LessonPlanID
	}
	if body.Period > 0 {
		existing.Period = body.Period
	}
	if body.GenParams != "" {
		existing.GenParams = body.GenParams
	}
	// 指针区分：nil=未传不动；传空串=真清空（解决"删光互动无法清快照"）
	if body.InteractiveSlots != nil {
		existing.InteractiveSlots = *body.InteractiveSlots
	}

	// 内容安全审核（红线锁）：草稿永远可编辑、不审查；
	// 只要最终状态为 active（含已发布内容的再次编辑），内容就必须过闸。
	var auditRes *policy.Result
	if existing.Status == "active" && h.policy != nil && h.policy.Enabled() {
		res, err := h.policy.Check(c.Request.Context(), policy.CheckRequest{
			Text:    strings.TrimSpace(existing.Name + "\n" + existing.Content),
			Subject: existing.Subject,
			Grade:   existing.Grade,
		})
		if err != nil {
			log.Printf("[policy] 课件审核服务不可用: %v", err)
			if !wasActive {
				// 尚未发布：不给可用状态，降级为草稿
				existing.Status = "draft"
			}
			// 已发布内容的再次编辑：审核不可用时保持放行，避免锁定正在使用的内容
		} else if blocking := res.Blocking(); len(blocking) > 0 {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    "CONTENT_BLOCKED",
				"message": "内容未通过安全审核，请修改后再发布",
				"issues":  blocking,
			})
			return
		} else {
			auditRes = res
		}
	}

	if err := h.repo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// 发布留痕：仅当内容真发生变化且最终为已发布状态才记新版本（避免改个标签也产生版本）
	if existing.Status == "active" && existing.Content != originalContent {
		h.recordReleaseVersion(c, existing, auditRes)
	}
	c.JSON(http.StatusOK, existing)
}

// DeleteMaterial 删除素材/课件（硬删，无回收站）。
// DELETE /api/materials/:id
//
// 语义与边界（2026-09-18 新增）：
//   - **只允许删自己名下的**（`user_id = 本人`）；公共素材（user_id 为空，如装饰元件库）与同事的素材不删。
//     （注：UpdateMaterial 目前未做属主校验，这是历史遗留；删除是破坏性操作，故此处**从严**，不跟它对齐。）
//   - 不存在 / 非本人 → 统一 404「素材不存在或无权删除」（不泄露存在性）。
//   - 级联清理其批注与版本（见 repository.Delete），避免留下孤儿行。
func (h *MaterialHandler) DeleteMaterial(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr, _ := userID.(string)
	id := c.Param("id")
	n, err := h.repo.Delete(id, userIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DELETE_FAILED", "message": "删除失败：" + err.Error()})
		return
	}
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "素材不存在或无权删除"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": n})
}

// ── 家校/学校宣发 H5（notice，2026-09-03）──────────────────────────────────
// notice 与课件共用 materials 表：type=notice / category=notice / format=h5。
// Content=宣发 markdown；H5HTML=滚动图文 H5（前端渲染，扫码经 GET /api/materials/:id/h5 公开访问）。
// school 级全校共用（school_id 内所有角色可见）；创建/编辑受路由角色限制（班主任/教务·校务/校长）。
// 发布（status=active）走 notice 专用红线：安全类主题必须对齐官方口径，不允许自行演绎安全条款。

// recordReleaseNotice 宣发发布留痕（ResourceType=notice）。
func (h *MaterialHandler) recordReleaseNotice(c *gin.Context, m *model.Material, res *policy.Result) {
	recordRelease(h.db, c, ReleaseMeta{
		ResourceType: "notice",
		ResourceID:   m.ID,
		Label:        m.Name,
		Payload:      m.Content,
	}, res, "")
}

// ListNotices 全校共用宣发列表（校内所有角色只读）。
func (h *MaterialHandler) ListNotices(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	items, err := h.repo.ListByType(schoolID.(string), "notice")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	attachOwnerNames(h.db, items)
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

// CreateNotice 创建家校宣发 H5（班主任/教务·校务/校长；草稿可随时保存）。
func (h *MaterialHandler) CreateNotice(c *gin.Context) {
	userID, _ := c.Get("user_id")
	schoolID, _ := c.Get("school_id")
	var body struct {
		Name    string `json:"name"`
		Tag     string `json:"tag"` // 宣发场景码（drowning/back_to_school/parent_meeting/...）
		Content string `json:"content"`
		H5HTML  string `json:"h5_html"`
		Status  string `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数有误"})
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写宣发标题"})
		return
	}
	m := &model.Material{
		Name:      strings.TrimSpace(body.Name),
		SchoolID:  schoolID.(string),
		UserID:    extractUserID(userID),
		Type:      "notice",
		Category:  "notice",
		Format:    "h5",
		Tag:       body.Tag,
		Content:   body.Content,
		H5HTML:    body.H5HTML,
		Status:    body.Status,
		CreatedAt: time.Now(),
	}
	if m.Status == "" {
		m.Status = "draft"
	}
	var auditRes *policy.Result
	if m.Status == "active" && h.policy != nil && h.policy.Enabled() {
		res, err := h.policy.Check(c.Request.Context(), policy.CheckRequest{
			Text: strings.TrimSpace(m.Name + "\n" + m.Content),
			Kind: "notice",
		})
		if err != nil {
			log.Printf("[policy] notice 审核服务不可用，宣发降级为草稿: %v", err)
			m.Status = "draft"
		} else if blocking := res.Blocking(); len(blocking) > 0 {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    "CONTENT_BLOCKED",
				"message": "宣发内容未通过安全审核（安全类内容须对齐官方口径，不能自行演绎安全条款），请修改后再发布",
				"issues":  blocking,
			})
			return
		} else {
			auditRes = res
		}
	}
	if err := h.repo.Create(m); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if m.Status == "active" {
		h.recordReleaseNotice(c, m, auditRes)
	}
	c.JSON(http.StatusCreated, m)
}

// UpdateNotice 更新家校宣发 H5（仅 notice 资产可走此端点；已发布再次编辑仍过闸）。
func (h *MaterialHandler) UpdateNotice(c *gin.Context) {
	id := c.Param("id")
	existing, err := h.repo.GetByID(id)
	if err != nil || existing.Type != "notice" {
		c.JSON(http.StatusNotFound, gin.H{"error": "宣发不存在"})
		return
	}
	originalContent := existing.Content
	var body struct {
		Name    string `json:"name"`
		Tag     string `json:"tag"`
		Content string `json:"content"`
		H5HTML  string `json:"h5_html"`
		Status  string `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数有误"})
		return
	}
	existing.Name = body.Name
	existing.Tag = body.Tag
	existing.Content = body.Content
	existing.H5HTML = body.H5HTML
	wasActive := existing.Status == "active"
	if body.Status != "" {
		existing.Status = body.Status
	}
	var auditRes *policy.Result
	if existing.Status == "active" && h.policy != nil && h.policy.Enabled() {
		res, err := h.policy.Check(c.Request.Context(), policy.CheckRequest{
			Text: strings.TrimSpace(existing.Name + "\n" + existing.Content),
			Kind: "notice",
		})
		if err != nil {
			log.Printf("[policy] notice 审核服务不可用: %v", err)
			if !wasActive {
				existing.Status = "draft"
			}
		} else if blocking := res.Blocking(); len(blocking) > 0 {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    "CONTENT_BLOCKED",
				"message": "宣发内容未通过安全审核（安全类内容须对齐官方口径，不能自行演绎安全条款），请修改后再发布",
				"issues":  blocking,
			})
			return
		} else {
			auditRes = res
		}
	}
	if err := h.repo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if existing.Status == "active" && existing.Content != originalContent {
		h.recordReleaseNotice(c, existing, auditRes)
	}
	c.JSON(http.StatusOK, existing)
}

// GetMaterialH5 公开端点：按素材 ID 返回投屏互动 H5 课件 HTML（供手机扫码访问，无需登录）
// GET /api/materials/:id/h5
func (h *MaterialHandler) GetMaterialH5(c *gin.Context) {
	id := c.Param("id")
	m, err := h.repo.GetByID(id)
	if err != nil {
		c.Data(http.StatusNotFound, "text/html;charset=utf-8", []byte("<h1>课件不存在</h1>"))
		return
	}
	// 优先返回前端自动生成的完整互动 HTML；若无则按 content 兜底渲染纯展示页
	if strings.TrimSpace(m.H5HTML) != "" {
		c.Data(http.StatusOK, "text/html;charset=utf-8", []byte(m.H5HTML))
		return
	}
	if strings.TrimSpace(m.Content) != "" {
		c.Data(http.StatusOK, "text/html;charset=utf-8", []byte(renderH5Fallback(m.Content, m.Name)))
		return
	}
	c.Data(http.StatusOK, "text/html;charset=utf-8", []byte("<h1>"+escapeHtml(m.Name)+"</h1><p>该课件暂无可展示内容</p>"))
}

// renderH5Fallback 将素材 content（OutlineSlide[] JSON）兜底渲染为纯展示 H5 页
func renderH5Fallback(content, name string) string {
	type slide struct {
		Title   string   `json:"title"`
		Heading string   `json:"heading"`
		Points  []string `json:"points"`
		Body    string   `json:"body"`
	}
	var slides []slide
	json.Unmarshal([]byte(content), &slides)
	if len(slides) == 0 {
		return "<h1>" + escapeHtml(name) + "</h1>"
	}
	var sb strings.Builder
	sb.WriteString(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>` + escapeHtml(name) + `</title><style>body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;background:#0f1226;margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh}.card{background:#fff;color:#222;border-radius:20px;padding:40px 56px;max-width:860px;box-shadow:0 20px 60px rgba(0,0,0,.4)}h1{color:#1A3A6B;margin:0 0 18px}h2{color:#1A3A6B;margin:18px 0 10px}ul{line-height:1.9;font-size:18px}.brand{position:fixed;top:16px;right:24px;color:rgba(255,255,255,.4);font-size:12px}</style></head><body><div class="brand">知微 · 互动课件</div><div class="card">`)
	sb.WriteString("<h1>" + escapeHtml(name) + "</h1>")
	for _, s := range slides {
		t := s.Title
		if t == "" {
			t = s.Heading
		}
		if t != "" {
			sb.WriteString("<h2>" + escapeHtml(t) + "</h2>")
		}
		if len(s.Points) > 0 {
			sb.WriteString("<ul>")
			for _, p := range s.Points {
				sb.WriteString("<li>" + escapeHtml(p) + "</li>")
			}
			sb.WriteString("</ul>")
		}
		if s.Body != "" {
			sb.WriteString("<p>" + escapeHtml(s.Body) + "</p>")
		}
	}
	sb.WriteString("</div></body></html>")
	return sb.String()
}

func escapeHtml(s string) string {
	r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\"", "&quot;")
	return r.Replace(s)
}

func formatFileSize(sz int64) string {
	switch {
	case sz >= 1024*1024*1024:
		return fmt.Sprintf("%.1fGB", float64(sz)/(1024*1024*1024))
	case sz >= 1024*1024:
		return fmt.Sprintf("%.1fMB", float64(sz)/(1024*1024))
	case sz >= 1024:
		return fmt.Sprintf("%.1fKB", float64(sz)/1024)
	default:
		return fmt.Sprintf("%dB", sz)
	}
}

func guessType(ext string) string {
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg":
		return "image"
	case ".mp3", ".wav", ".flac", ".m4a", ".aac":
		return "audio"
	case ".mp4", ".avi", ".mov", ".mkv", ".webm":
		return "video"
	case ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt":
		return "doc"
	default:
		return "other"
	}
}

// extractUserID 从 gin context 的 user_id 值中解析出字符串（与 ListDecor 一致）。
func extractUserID(v interface{}) string {
	switch x := v.(type) {
	case string:
		return x
	case float64:
		return fmt.Sprintf("%.0f", x)
	default:
		return ""
	}
}

// ── facet 受控词表（运营维护母题/媒介等词库）──

// ListFacets 按 type 返回受控词（motif/medium...）。
func (h *MaterialHandler) ListFacets(c *gin.Context) {
	typ := c.Query("type")
	if typ == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少 type 参数"})
		return
	}
	list, err := h.repo.ListFacets(c, typ)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list, "total": len(list)})
}

// UpsertFacet 新增/更新受控词（运营后台）。
func (h *MaterialHandler) UpsertFacet(c *gin.Context) {
	var f model.FacetVocab
	if err := c.ShouldBindJSON(&f); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数解析失败: " + err.Error()})
		return
	}
	if f.Type == "" || f.Value == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type 与 value 必填"})
		return
	}
	if f.Label == "" {
		f.Label = f.Value
	}
	if err := h.repo.UpsertFacet(c, &f); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, f)
}

// DeleteFacet 删除受控词（运营后台）。
func (h *MaterialHandler) DeleteFacet(c *gin.Context) {
	id := c.Param("id")
	if err := h.repo.DeleteFacet(c, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
