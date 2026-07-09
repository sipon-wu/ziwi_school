package cloud

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func newTestJWKS(pub *rsa.PublicKey) *CloudJWKS {
	return &CloudJWKS{
		keys:   map[string]*rsa.PublicKey{"test": pub},
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func cloudWithURL(url string) *CloudJWKS {
	return &CloudJWKS{
		url:    url,
		keys:   make(map[string]*rsa.PublicKey),
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func signRS256(t *testing.T, key *rsa.PrivateKey, claims jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = "test"
	s, err := tok.SignedString(key)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return s
}

// pubKeyToJWK 把 RSA 公钥编成最小 JWK JSON（kty/n/e）
func pubKeyToJWK(t *testing.T, key *rsa.PublicKey) string {
	t.Helper()
	n := base64.RawURLEncoding.EncodeToString(key.N.Bytes())
	eBytes := make([]byte, 4)
	e := key.E
	for i := 0; i < 4; i++ {
		eBytes[3-i] = byte(e & 0xff)
		e >>= 8
	}
	eEnc := base64.RawURLEncoding.EncodeToString(eBytes)
	return fmt.Sprintf(`{"kty":"RSA","kid":"test","n":%q,"e":%q}`, n, eEnc)
}

func TestVerify_OK(t *testing.T) {
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	c := newTestJWKS(&priv.PublicKey)
	tok := signRS256(t, priv, jwt.MapClaims{
		"sub": "u-123", "email": "a@b.com", "tenant_id": "t-1", "products": []string{"school"},
		"iat": float64(time.Now().Unix()),
		"exp": float64(time.Now().Add(30 * time.Minute).Unix()),
	})
	claims, err := c.Verify(tok)
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}
	if claims["sub"] != "u-123" || claims["email"] != "a@b.com" {
		t.Fatalf("claims mismatch: %v", claims)
	}
}

func TestVerify_WrongKeyRejected(t *testing.T) {
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	otherPriv, _ := rsa.GenerateKey(rand.Reader, 2048)
	c := newTestJWKS(&priv.PublicKey) // 缓存里只有 priv 的公钥
	tok := signRS256(t, otherPriv, jwt.MapClaims{
		"sub": "x", "email": "a@b.com",
		"iat": float64(time.Now().Unix()),
		"exp": float64(time.Now().Add(30 * time.Minute).Unix()),
	})
	if _, err := c.Verify(tok); err == nil {
		t.Fatal("expected rejection for token signed by unknown key")
	}
}

func TestVerify_NonRS256Rejected(t *testing.T) {
	hsTok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": "x"})
	hsTok.Header["kid"] = "test"
	signed, _ := hsTok.SignedString([]byte("secret"))
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	c := newTestJWKS(&priv.PublicKey)
	if _, err := c.Verify(signed); err == nil {
		t.Fatal("expected rejection for non-RS256 token")
	}
}

func TestVerify_RefreshFromJWKSEndpoint(t *testing.T) {
	// 模拟 cloud.ziwi.cn 真实返回格式 {"data":{"keys":[JWK]}}
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"keys":[` + pubKeyToJWK(t, &priv.PublicKey) + `]}}`))
	}))
	defer srv.Close()

	c := cloudWithURL(srv.URL) // 空缓存，强制走 refresh
	tok := signRS256(t, priv, jwt.MapClaims{
		"sub": "u-9", "email": "v@w.com",
		"iat": float64(time.Now().Unix()),
		"exp": float64(time.Now().Add(30 * time.Minute).Unix()),
	})
	claims, err := c.Verify(tok)
	if err != nil {
		t.Fatalf("Verify after refresh failed: %v", err)
	}
	if claims["sub"] != "u-9" {
		t.Fatalf("claims mismatch: %v", claims)
	}
}

func TestVerify_MissingRequiredClaims(t *testing.T) {
	// 缺少 email 应被 validateRequiredClaims 拒绝（指南 §3.2）
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	c := newTestJWKS(&priv.PublicKey)
	tok := signRS256(t, priv, jwt.MapClaims{
		"sub": "u-1",
		"iat": float64(time.Now().Unix()),
		"exp": float64(time.Now().Add(30 * time.Minute).Unix()),
	})
	if _, err := c.Verify(tok); err == nil {
		t.Fatal("expected rejection for missing 'email' claim")
	}
}

func TestVerify_ExpiredTokenRejected(t *testing.T) {
	// 过期 token 应被 jwt 库校验拒绝
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	c := newTestJWKS(&priv.PublicKey)
	tok := signRS256(t, priv, jwt.MapClaims{
		"sub": "u-1", "email": "a@b.com",
		"iat": float64(time.Now().Add(-2 * time.Hour).Unix()),
		"exp": float64(time.Now().Add(-1 * time.Hour).Unix()), // 1 小时前过期
	})
	if _, err := c.Verify(tok); err == nil {
		t.Fatal("expected rejection for expired token")
	}
}
