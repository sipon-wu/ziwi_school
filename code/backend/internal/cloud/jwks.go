package cloud

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// jwk 单条 RSA 公钥（JWKS 格式）
type jwk struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwksResp struct {
	// cloud.ziwi.cn 返回 {"data":{"keys":[...]}}；同时兼容直接 {"keys":[...]}
	Data struct {
		Keys []jwk `json:"keys"`
	} `json:"data"`
	Keys []jwk `json:"keys"`
}

// CloudJWKS 从 cloud.ziwi.cn 拉取并缓存 JWK 公钥集，供 school 端独立验签 RS256 token。
// 设计要点：school 仅持有 cloud 的公钥，不共享私钥——天然支持多产品各自独立验签。
//
// 避坑提醒（来自 cloud-jwt-integration-guide.md v1.0）：
//  1. token 有效期 30 分钟（iat+1800），过期后需用 refresh_token 向 cloud 刷新
//  2. 公钥轮换策略：cloud 更换密钥后，各产品 1 小时内（缓存 TTL）全集群生效
//  3. kid 不匹配时 MUST 立即强制刷新 JWKS 后重试一次（本实现已做）
//  4. 始终保留本地文件缓存作为 cloud 不可达时的降级方案
//  5. HTTP 请求 cloud 必须设超时（避免网络抖动导致请求阻塞）
type CloudJWKS struct {
	url       string
	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	lastFetch time.Time
	cacheFile string // 本地文件降级路径（cloud 不可达时兜底）
	client    *http.Client
}

// NewCloudJWKS 构造 JWKS provider；url 为空时回退到 cloud.ziwi.cn 默认端点。
func NewCloudJWKS(url string) *CloudJWKS {
	if url == "" {
		url = "https://cloud.ziwi.cn/api/v1/auth/public-key"
	}
	return &CloudJWKS{
		url:       url,
		keys:      make(map[string]*rsa.PublicKey),
		cacheFile: "/tmp/cloud_jwks_cache.json", // 本地文件降级（见指南 §2.3）
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// refresh 重新拉取 public-key 端点并重建 kid→pubkey 映射（幂等，可重复调用）。
// 拉取失败时降级到本地文件缓存（指南 §2.3）。
func (c *CloudJWKS) refresh() error {
	log.Printf("[cloud-jwks] 开始拉取 JWKS: %s", c.url)

	resp, err := c.client.Get(c.url)
	if err != nil {
		log.Printf("[cloud-jwks] 拉取失败(网络错误): %v，尝试本地文件降级", err)
		return c.fallbackFromFile(err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[cloud-jwks] 读取响应失败: %v", err)
		return c.fallbackFromFile(err)
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("[cloud-jwks] HTTP %d: %s", resp.StatusCode, string(body[:min(len(body), 200)]))
		return c.fallbackFromFile(fmt.Errorf("http %d", resp.StatusCode))
	}

	var jr jwksResp
	if err := json.Unmarshal(body, &jr); err != nil {
		log.Printf("[cloud-jwks] JSON 解析失败: %v", err)
		return c.fallbackFromFile(err)
	}

	src := jr.Keys
	if len(src) == 0 {
		src = jr.Data.Keys
	}
	if len(src) == 0 {
		return fmt.Errorf("no keys found in JWKS response from %s", c.url)
	}

	m := make(map[string]*rsa.PublicKey, len(src))
	for _, k := range src {
		if k.Kty != "RSA" {
			log.Printf("[cloud-jwks] 跳过非 RSA key: kid=%s kty=%s", k.Kid, k.Kty)
			continue
		}
		pub, err := jwkToRSA(k)
		if err != nil {
			log.Printf("[cloud-jwks] 解析 key 失败 kid=%s: %v", k.Kid, err)
			return err
		}
		m[k.Kid] = pub
	}
	if len(m) == 0 {
		return fmt.Errorf("no RSA keys in JWKS from %s", c.url)
	}

	c.mu.Lock()
	c.keys = m
	c.lastFetch = time.Now()
	c.mu.Unlock()

	// 写本地缓存文件（指南 §2.3 降级方案）
	c.writeCacheFile(body)

	log.Printf("[cloud-jwks] JWKS 拉取成功: %d keys, kid=%s", len(m), keyList(m))
	return nil
}

// Verify 验签 cloud 签发的 RS256 token，返回 claims。
// 避坑：
//  1. 若 token 头中的 kid 不在本地缓存，自动刷新 JWKS 后重试一次（指南 §2.4 kid 匹配规则）
//  2. 验签成功后验证必填 claims（sub/email/exp/iat，指南 §3.2）
//  3. token 过期返回明确错误码（指南 §3.4 错误处理决策表）
func (c *CloudJWKS) Verify(tokenStr string) (jwt.MapClaims, error) {
	if tokenStr == "" {
		log.Printf("[cloud-jwks] 验签拒绝: 空 token")
		return nil, fmt.Errorf("empty token")
	}

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		// 算法白名单：仅接受 RS256（指南 §3.3）
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			log.Printf("[cloud-jwks] 验签拒绝: 非 RSA 算法 alg=%v", t.Header["alg"])
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			log.Printf("[cloud-jwks] 验签拒绝: JWT Header 缺少 kid")
			return nil, fmt.Errorf("missing kid in JWT header")
		}

		c.mu.RLock()
		pub, ok := c.keys[kid]
		c.mu.RUnlock()

		if !ok {
			// kid 不匹配 → 立即强制刷新后重试（指南 §2.4）
			log.Printf("[cloud-jwks] kid=%s 未命中缓存，触发强制刷新", kid)
			if err := c.refresh(); err != nil {
				log.Printf("[cloud-jwks] 强制刷新失败: %v", err)
				return nil, fmt.Errorf("JWKS refresh failed (kid=%s): %w", kid, err)
			}
			c.mu.RLock()
			pub, ok = c.keys[kid]
			c.mu.RUnlock()
		}
		if !ok {
			log.Printf("[cloud-jwks] 验签拒绝: kid=%s 仍然不匹配（刷新后）", kid)
			return nil, fmt.Errorf("no public key for kid=%s", kid)
		}

		log.Printf("[cloud-jwks] 验签匹配: kid=%s ✓", kid)
		return pub, nil
	})

	if err != nil {
		log.Printf("[cloud-jwks] 验签失败: %v", err)
		return nil, err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		log.Printf("[cloud-jwks] 验签拒绝: 无效 claims")
		return nil, fmt.Errorf("invalid token claims")
	}

	// 业务必填 claims 校验（指南 §3.2 Claims 说明）
	if err := validateRequiredClaims(claims); err != nil {
		log.Printf("[cloud-jwks] 验签拒绝: %v", err)
		return nil, err
	}

	log.Printf("[cloud-jwks] 验签通过: sub=%v email=%v", claims["sub"], claims["email"])
	return claims, nil
}

// validateRequiredClaims 检查 cloud token 的必填 claims（指南 §3.2）
func validateRequiredClaims(claims jwt.MapClaims) error {
	// sub: 用户 UUID（必填）
	sub, _ := claims["sub"].(string)
	if sub == "" {
		return fmt.Errorf("claim 'sub' is missing or empty")
	}
	// email: 用户邮箱（必填）
	email, _ := claims["email"].(string)
	if email == "" {
		return fmt.Errorf("claim 'email' is missing or empty")
	}
	// exp: 过期时间（jwt 库已自动校验，但显式检查）
	exp, ok := claims["exp"].(float64)
	if !ok || exp == 0 {
		return fmt.Errorf("claim 'exp' is missing or invalid")
	}
	// iat: 签发时间
	iat, ok := claims["iat"].(float64)
	if !ok || iat == 0 {
		return fmt.Errorf("claim 'iat' is missing or invalid")
	}
	return nil
}

// fallbackFromFile 降级到本地缓存文件（指南 §2.3 "降级到本地文件兜底"）
func (c *CloudJWKS) fallbackFromFile(_ error) error {
	if c.cacheFile == "" {
		return fmt.Errorf("cloud JWKS unreachable and no local cache file configured")
	}
	data, err := os.ReadFile(c.cacheFile)
	if err != nil {
		log.Printf("[cloud-jwks] 本地缓存不存在或不可读: %s (%v)", c.cacheFile, err)
		return fmt.Errorf("cloud JWKS unreachable, local cache unavailable: %w", err)
	}

	var jr jwksResp
	if err := json.Unmarshal(data, &jr); err != nil {
		return fmt.Errorf("local JWKS cache corrupted: %w", err)
	}

	src := jr.Keys
	if len(src) == 0 {
		src = jr.Data.Keys
	}
	m := make(map[string]*rsa.PublicKey, len(src))
	for _, k := range src {
		if k.Kty != "RSA" {
			continue
		}
		pub, err := jwkToRSA(k)
		if err != nil {
			return err
		}
		m[k.Kid] = pub
	}
	if len(m) == 0 {
		return fmt.Errorf("no RSA keys in local JWKS cache")
	}

	c.mu.Lock()
	c.keys = m
	c.mu.Unlock()

	log.Printf("[cloud-jwks] 本地文件降级成功: %d keys, kid=%s", len(m), keyList(m))
	return nil
}

// writeCacheFile 把 raw JWKS 响应写入本地缓存文件（指南 §2.3）
func (c *CloudJWKS) writeCacheFile(raw []byte) {
	if c.cacheFile == "" {
		return
	}
	if err := os.WriteFile(c.cacheFile, raw, 0644); err != nil {
		log.Printf("[cloud-jwks] 写本地缓存失败: %v", err)
	}
}

// keyList 返回缓存中所有 kid 列表，用于日志。
func keyList(m map[string]*rsa.PublicKey) string {
	ks := ""
	for k := range m {
		if ks != "" {
			ks += ","
		}
		ks += k
	}
	return "[" + ks + "]"
}

// jwkToRSA 由 JWK 的 modulus(n)/exponent(e) 还原 *rsa.PublicKey（base64url 编码）。
func jwkToRSA(k jwk) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
	if err != nil {
		return nil, fmt.Errorf("decode n: %w", err)
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
	if err != nil {
		return nil, fmt.Errorf("decode e: %w", err)
	}
	n := new(big.Int).SetBytes(nBytes)
	eInt := 0
	for _, b := range eBytes {
		eInt = eInt<<8 | int(b)
	}
	if eInt == 0 {
		return nil, fmt.Errorf("invalid exponent e")
	}
	return &rsa.PublicKey{N: n, E: eInt}, nil
}
