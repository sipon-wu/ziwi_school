package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ----- 请求 / 响应类型 -----

type cloudLoginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type cloudLoginAPIResp struct {
	Data struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
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
func (h *AuthHandler) VerifyCloudToken(c *gin.Context) {
	products, _ := c.Get("cloud_products")
	c.JSON(http.StatusOK, gin.H{
		"verified":        true,
		"cloud_sub":       c.GetString("cloud_sub"),
		"cloud_email":     c.GetString("cloud_email"),
		"cloud_tenant_id": c.GetString("cloud_tenant_id"),
		"cloud_products":  products,
	})
}

// ----- P1：云登录 + 自动绑定 -----

// CloudLogin 统一登录 P1：用 cloud 邮箱+密码验证身份，按邮箱匹配 school 已有账号，自动绑定。
//
//	POST /api/auth/cloud/login
//	Body: {"email":"...", "password":"..."}
func (h *AuthHandler) CloudLogin(c *gin.Context) {
	if h.cloudJWKS == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"code":    "CLOUD_NOT_CONFIGURED",
			"message": "云端验签未配置",
		})
		return
	}

	var req cloudLoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "INVALID_REQUEST",
			"message": "请提供邮箱和密码",
		})
		return
	}

	// 1. 调 cloud.ziwi.cn 验证凭据 → 拿到 RS256 access_token
	cloudTok, err := callCloudLogin(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code":    "CLOUD_AUTH_FAILED",
			"message": "知微云账号验证失败，" + err.Error(),
		})
		return
	}

	// 2. school 独立验签 cloud token → 获取 claims
	claims, err := h.cloudJWKS.Verify(cloudTok)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code":    "CLOUD_VERIFY_FAILED",
			"message": "云端令牌验签失败",
		})
		return
	}
	cloudSub, _ := claims["sub"].(string)
	cloudEmail, _ := claims["email"].(string)

	// 3. 按邮箱匹配 school 用户
	user, findErr := h.userRepo.FindByEmail(cloudEmail)
	if findErr != nil {
		// 未匹配：提示先用手机号注册知微教学
		c.JSON(http.StatusNotFound, gin.H{
			"code":    "CLOUD_USER_NOT_MATCHED",
			"message": "未找到与知微云邮箱匹配的账号。请先在知微教学中用手机号注册，并填写相同邮箱，或联系管理员手动绑定。",
			"hint":    "register_first",
		})
		return
	}

	// 4. 邮箱匹配到用户：检查/写入 CloudUserID
	bound := false
	if user.CloudUserID == nil || *user.CloudUserID == "" {
		// 首次绑定：写 CloudUserID
		if err := h.userRepo.UpdateUser(user.ID, map[string]interface{}{"cloud_user_id": cloudSub}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "BIND_FAILED",
				"message": "绑定云端账号失败，请重试",
			})
			return
		}
		bound = true
	} else if *user.CloudUserID != cloudSub {
		c.JSON(http.StatusConflict, gin.H{
			"code":    "CLOUD_ID_MISMATCH",
			"message": "该邮箱已绑定到另一个知微云账号",
		})
		return
	}
	// 已绑定且 CloudUserID 匹配 → 直接签发 school token

	// 5. 签发 school HS256 token（复用现有 generateToken）
	schoolTok, err := h.generateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "TOKEN_GENERATION_FAILED",
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
func callCloudLogin(email, password string) (string, error) {
	body := cloudLoginReq{Email: email, Password: password}
	b, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	resp, err := http.Post(
		"https://cloud.ziwi.cn/api/v1/auth/login",
		"application/json",
		bytes.NewReader(b),
	)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		// 区分具体错误
		var apiErr struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(respBody, &apiErr) == nil && apiErr.Message != "" {
			return "", fmt.Errorf("cloud 返回错误(%d): %s", resp.StatusCode, apiErr.Message)
		}
		return "", fmt.Errorf("cloud 登录失败 (HTTP %d)", resp.StatusCode)
	}

	var cr cloudLoginAPIResp
	if err := json.Unmarshal(respBody, &cr); err != nil {
		return "", err
	}
	if cr.Data.AccessToken == "" {
		return "", fmt.Errorf("cloud 未返回有效 token")
	}
	return cr.Data.AccessToken, nil
}
