package middleware

import (
	"strings"
	"testing"
)

// ── CSRF Token ──

func TestGenerateCSRFToken(t *testing.T) {
	token, cookie := GenerateCSRFToken()

	if len(token) < 32 {
		t.Errorf("CSRF Token 太短: %d 字符", len(token))
	}
	if !strings.Contains(cookie, "csrf_token=") {
		t.Error("Cookie 缺少 csrf_token 键")
	}
	if !strings.Contains(cookie, "SameSite=Strict") {
		t.Error("Cookie 缺少 SameSite=Strict")
	}
	if !strings.Contains(cookie, "HttpOnly") {
		t.Error("Cookie 缺少 HttpOnly")
	}
	if !strings.Contains(cookie, "Max-Age=86400") {
		t.Error("Cookie 缺少 Max-Age")
	}

	// 两次生成应不相同（随机性）
	token2, _ := GenerateCSRFToken()
	if token == token2 {
		t.Error("两次生成的 CSRF Token 相同，随机性不足")
	}
	t.Logf("✅ CSRF Token 生成通过 | 长度: %d", len(token))
}

// ── 输入清洗 ──

func TestSanitizeInput(t *testing.T) {
	tests := []struct {
		input  string
		expect string
		desc   string
	}{
		{"正常文本", "正常文本", "普通中文"},
		{"hello\x00world", "helloworld", "移除 null 字节"},
		{"<script>alert('xss')</script>", "<script>alert('xss')</script>", "XSS 由前端/Nginx处理"},
		{"select * from users", "select * from users", "SQL 由参数化查询处理"},
		{strings.Repeat("a", 20000), strings.Repeat("a", 10000), "超长输入截断"},
		{"", "", "空字符串"},
		{"  前后空格  ", "  前后空格  ", "保留空格"},
	}

	for _, tt := range tests {
		result := SanitizeInput(tt.input)
		if result != tt.expect {
			t.Errorf("%s: 预期 %q 实际 %q", tt.desc, tt.expect, result)
		}
	}
	t.Log("✅ 输入清洗通过")
}

// ── Token 哈希 ──

func TestHashToken(t *testing.T) {
	token := "test-refresh-token-abc123"
	hash := HashToken(token)

	if len(hash) != 64 { // SHA256 hex = 64 chars
		t.Errorf("SHA256 哈希长度应为 64，实际 %d", len(hash))
	}

	// 相同输入产生相同哈希
	hash2 := HashToken(token)
	if hash != hash2 {
		t.Error("相同输入哈希不一致")
	}

	// 不同输入产生不同哈希
	hash3 := HashToken("different-token")
	if hash == hash3 {
		t.Error("不同输入哈希不应相同")
	}
	t.Log("✅ Token 哈希通过")
}

// ── Security Headers ──

func TestSecurityHeadersExist(t *testing.T) {
	// 验证中间件注册不 panic
	handler := SecurityHeaders()
	if handler == nil {
		t.Error("SecurityHeaders 中间件为 nil")
	}
	t.Log("✅ SecurityHeaders 中间件创建通过")
}

func TestCSRFMiddleware(t *testing.T) {
	handler := CSRFProtection()
	if handler == nil {
		t.Error("CSRF 中间件为 nil")
	}
	t.Log("✅ CSRF 中间件创建通过")
}

// ── RateLimit 中间件 ──

func TestRateLimitMiddleware(t *testing.T) {
	handler := RateLimit(10, 60_000_000_000) // 10 req/min in ns
	if handler == nil {
		t.Error("RateLimit 中间件为 nil")
	}
	t.Log("✅ RateLimit 中间件创建通过")
}
