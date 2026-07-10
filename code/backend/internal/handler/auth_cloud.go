package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ----- 请求 / 响应类型 -----

type cloudLoginReq struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type cloudLoginAPIResp struct {
	Data struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int    `json:"expires_in"` // 指南：1800（30分钟）
	} `json:"data"`
}

type cloudLoginSchoolResp struct {
	Token string      `json:"token"`
	User  UserProfile `json:"user"`
	Bound bool        `json:"bound"` // 本次是否新绑定了 cloud_user_id
}

// ----- P0：纯验证（保留） -----

// VerifyCloudToken 统一登录 P0 验证端点：仅回显 cloud IdP 验签后的云端身份，
// 不做本地绑定、不写库（绑定流程属 P1）。供前端/联调验证 token 合法性。
//
//	POST /api/auth/cloud/verify
//	Header: Authorization: Bearer <cloud_access_token>
//
// 避坑：此端点验证的是 cloud 签发的 token（不是 school 自己的 HS256 token）。
func (h *AuthHandler) VerifyCloudToken(c *gin.Context) {
	products, _ := c.Get("cloud_products")
	sub := c.GetString("cloud_sub")
	email := c.GetString("cloud_email")
	log.Printf("[cloud-verify] P0 验证回显: sub=%s email=%s", sub, email)
	c.JSON(http.StatusOK, gin.H{
		"verified":        true,
		"cloud_sub":       sub,
		"cloud_email":     email,
		"cloud_tenant_id": c.GetString("cloud_tenant_id"),
		"cloud_products":  products,
	})
}

// ----- P1：云登录 + 自动绑定 -----

// CloudLogin 统一登录 P1：用 cloud 邮箱+密码验证身份，按邮箱匹配 school 已有账号，自动绑定。
//
//	POST /api/auth/cloud/login
//	Body: {"email":"...", "password":"..."}
//
// 避坑（来自 cloud-jwt-integration-guide.md）：
//  1. school 调 cloud API 验证凭据（callCloudLogin），得到 RS256 token
//  2. school 再用自己的 CloudJWKS 独立验签该 token（不依赖 cloud 是否在线）
//  3. 按 email 匹配 school 本地用户，首次自动绑定 CloudUserID
//  4. token 有效期 30 分钟（expires_in: 1800），过期后需用 refresh_token 向 cloud 刷新
//  5. ⚠️ 此端点不挂 CloudTokenAuth 中间件（因为接收的是 email+password，不是 Bearer token）
func (h *AuthHandler) CloudLogin(c *gin.Context) {
	if h.cloudJWKS == nil {
		log.Printf("[cloud-login] 拒绝: CloudJWKS 未配置")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "CLOUD_NOT_CONFIGURED",
			"message": "云端验签未配置",
		})
		return
	}

	var req cloudLoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "INVALID_REQUEST",
			"message": "请提供邮箱和密码",
		})
		return
	}

	// 1. 调 cloud.ziwi.cn 验证凭据 → 拿到 RS256 access_token
	log.Printf("[cloud-login] 步骤1: 调 cloud API 验证邮箱=%s", maskEmail(req.Email))
	cloudTok, err := callCloudLogin(req.Email, req.Password)
	if err != nil {
		log.Printf("[cloud-login] 失败(cloud auth): email=%s err=%v", maskEmail(req.Email), err)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "CLOUD_AUTH_FAILED",
			"message": "知微云账号验证失败，" + err.Error(),
		})
		return
	}
	log.Printf("[cloud-login] 步骤1 ✓ cloud token 长度=%d", len(cloudTok))

	// 2. school 独立验签 cloud token → 获取 claims
	claims, err := h.cloudJWKS.Verify(cloudTok)
	if err != nil {
		log.Printf("[cloud-login] 失败(验签): %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "CLOUD_VERIFY_FAILED",
			"message": "云端令牌验签失败",
		})
		return
	}
	cloudSub, _ := claims["sub"].(string)
	cloudEmail, _ := claims["email"].(string)
	log.Printf("[cloud-login] 步骤2 ✓ 验签通过: sub=%s email=%s", cloudSub, cloudEmail)

	// 2.5 产品级鉴权：检查用户是否订阅了 school（指南 §4.1 require_product）
	if !hasProduct(claims["products"], "school") {
		log.Printf("[cloud-login] 拒绝: 未订阅 school 产品 products=%v", claims["products"])
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "PRODUCT_NOT_SUBSCRIBED",
			"message": "当前知微云账号未订阅「知微教学」产品，请联系管理员开通订阅。",
		})
		return
	}
	log.Printf("[cloud-login] 步骤2.5 ✓ 产品鉴权通过")

	// 3. 按邮箱匹配 school 用户
	user, findErr := h.userRepo.FindByEmail(cloudEmail)
	if findErr != nil {
		log.Printf("[cloud-login] 未匹配: cloud_email=%s 在 school 中无对应账号", cloudEmail)
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "CLOUD_USER_NOT_MATCHED",
			"message": "未找到与知微云邮箱匹配的账号。请先在知微教学中用手机号注册，并填写相同邮箱，或联系管理员手动绑定。",
			"hint":    "register_first",
		})
		return
	}
	log.Printf("[cloud-login] 步骤3 ✓ 匹配到 school 用户: id=%s role=%s", user.ID, user.Role)

	// 4. 邮箱匹配到用户：检查/写入 CloudUserID
	bound := false
	if user.CloudUserID == nil || *user.CloudUserID == "" {
		// 首次绑定：写 CloudUserID
		if err := h.userRepo.UpdateUser(user.ID, map[string]interface{}{"cloud_user_id": cloudSub}); err != nil {
			log.Printf("[cloud-login] 绑定失败(write): user_id=%s cloud_sub=%s err=%v", user.ID, cloudSub, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "BIND_FAILED",
				"message": "绑定云端账号失败，请重试",
			})
			return
		}
		bound = true
		log.Printf("[cloud-login] 步骤4 ✓ 首次绑定: user_id=%s → cloud_sub=%s", user.ID, cloudSub)
	} else if *user.CloudUserID != cloudSub {
		log.Printf("[cloud-login] 冲突: email=%s 已绑定 cloud_sub=%s 但本次请求是 %s", cloudEmail, *user.CloudUserID, cloudSub)
		c.JSON(http.StatusConflict, gin.H{
			"error":   "CLOUD_ID_MISMATCH",
			"message": "该邮箱已绑定到另一个知微云账号",
		})
		return
	} else {
		log.Printf("[cloud-login] 步骤4 → 已绑定无需重写: cloud_user_id=%s", *user.CloudUserID)
	}

	// 5. 签发 school HS256 token（复用现有 generateToken）
	schoolTok, err := h.generateToken(user)
	if err != nil {
		log.Printf("[cloud-login] 签发 school token 失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "TOKEN_GENERATION_FAILED",
			"message": "登录失败，请重试",
		})
		return
	}

	// 获取学校名称
	schoolName := ""
	schoolID := ""
	if user.SchoolID != nil {
		school, err := h.userRepo.GetSchool(*user.SchoolID)
		if err == nil {
			schoolName = school.FullName
			schoolID = school.ID
		}
	}

	log.Printf("[cloud-login] ✓ 登录成功: user=%s role=%s school=%s bound=%v",
		user.ID, user.Role, schoolID, bound)

	c.JSON(http.StatusOK, cloudLoginSchoolResp{
		Token: schoolTok,
		User: UserProfile{
			ID:         user.ID,
			Name:       user.Name,
			Role:       user.Role,
			SchoolID:   schoolID,
			SchoolName: schoolName,
			AvatarURL:  user.AvatarURL,
		},
		Bound: bound,
	})
}

// callCloudLogin 调 cloud.ziwi.cn /api/v1/auth/login 验证凭据，返回 access_token。
//
// 避坑：
//  1. 必须设置 HTTP 超时（指南推荐 5s），避免 cloud 服务抖动导致 school 请求阻塞
//  2. cloud API 返回 {"data":{"access_token":"...", "refresh_token":"...", "expires_in":1800}}
//  3. 注意：access_token 有效期仅 30 分钟，前端应用 refresh_token 刷新（详见指南 §4.3）
func callCloudLogin(email, password string) (string, error) {
	body := cloudLoginReq{Email: email, Password: password}
	b, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	// 指南推荐 5s 超时（§2.3 缓存策略）；这里用 8s 留点余量
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Post(
		"https://cloud.ziwi.cn/api/v1/auth/login",
		"application/json",
		bytes.NewReader(b),
	)
	if err != nil {
		log.Printf("[cloud-login] callCloudLogin 网络错误: %v", err)
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[cloud-login] callCloudLogin 读取响应失败: %v", err)
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		var apiErr struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(respBody, &apiErr) == nil && apiErr.Message != "" {
			log.Printf("[cloud-login] callCloudLogin 失败 HTTP=%d msg=%s", resp.StatusCode, apiErr.Message)
			return "", fmt.Errorf("cloud 返回错误(%d): %s", resp.StatusCode, apiErr.Message)
		}
		log.Printf("[cloud-login] callCloudLogin 失败 HTTP=%d body=%s", resp.StatusCode, string(respBody[:min(len(respBody), 100)]))
		return "", fmt.Errorf("cloud 登录失败 (HTTP %d)", resp.StatusCode)
	}

	var cr cloudLoginAPIResp
	if err := json.Unmarshal(respBody, &cr); err != nil {
		log.Printf("[cloud-login] callCloudLogin JSON解析失败: %v", err)
		return "", err
	}
	if cr.Data.AccessToken == "" {
		log.Printf("[cloud-login] callCloudLogin 响应中无 access_token")
		return "", fmt.Errorf("cloud 未返回有效 token")
	}

	log.Printf("[cloud-login] callCloudLogin ✓ access_token长度=%d expires_in=%ds", len(cr.Data.AccessToken), cr.Data.ExpiresIn)
	return cr.Data.AccessToken, nil
}

// maskEmail 脱敏邮箱用于日志
func maskEmail(email string) string {
	if at := bytes.IndexByte([]byte(email), '@'); at > 2 {
		return email[:2] + "***" + email[at:]
	}
	return email
}

// hasProduct 检查 cloud token 的 products[] claims 中是否包含指定产品（指南 §4.1）
func hasProduct(productsClaim interface{}, target string) bool {
	products, ok := productsClaim.([]interface{})
	if !ok {
		return false
	}
	for _, p := range products {
		if s, ok := p.(string); ok && s == target {
			return true
		}
	}
	return false
}
