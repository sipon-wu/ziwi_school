package cloud

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"crypto/rsa"
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
type CloudJWKS struct {
	url    string
	mu     sync.RWMutex
	keys   map[string]*rsa.PublicKey
	client *http.Client
}

// NewCloudJWKS 构造 JWKS provider；url 为空时回退到 cloud.ziwi.cn 默认端点。
func NewCloudJWKS(url string) *CloudJWKS {
	if url == "" {
		url = "https://cloud.ziwi.cn/api/v1/auth/public-key"
	}
	return &CloudJWKS{
		url:    url,
		keys:   make(map[string]*rsa.PublicKey),
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// refresh 重新拉取 public-key 端点并重建 kid->pubkey 映射（幂等，可重复调用）。
func (c *CloudJWKS) refresh() error {
	resp, err := c.client.Get(c.url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	var jr jwksResp
	if err := json.Unmarshal(body, &jr); err != nil {
		return err
	}
	src := jr.Keys
	if len(src) == 0 {
		src = jr.Data.Keys
	}
	m := make(map[string]*rsa.PublicKey)
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
		return fmt.Errorf("no RSA keys in JWKS from %s", c.url)
	}
	c.mu.Lock()
	c.keys = m
	c.mu.Unlock()
	return nil
}

// Verify 验签 cloud 签发的 RS256 token，返回 claims。
// 若 token 头中的 kid 不在本地缓存，自动刷新 JWKS（天然支持 cloud 侧密钥轮换）。
func (c *CloudJWKS) Verify(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		kid, _ := t.Header["kid"].(string)
		c.mu.RLock()
		pub, ok := c.keys[kid]
		c.mu.RUnlock()
		if !ok {
			if err := c.refresh(); err != nil {
				return nil, err
			}
			c.mu.RLock()
			pub, ok = c.keys[kid]
			c.mu.RUnlock()
		}
		if !ok {
			return nil, fmt.Errorf("no public key for kid=%s", kid)
		}
		return pub, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}
	return claims, nil
}

// jwkToRSA 由 JWK 的 modulus(n)/exponent(e) 还原 *rsa.PublicKey（base64url 编码）。
func jwkToRSA(k jwk) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
	if err != nil {
		return nil, fmt.Errorf("decode n: %w", err)
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
	if err != nil {
		return nil, err
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
