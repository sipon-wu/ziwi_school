package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

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
