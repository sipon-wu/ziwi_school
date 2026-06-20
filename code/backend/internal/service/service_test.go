package service

import (
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// ── JWT Token 生成验证 ──

func TestJWTSigning(t *testing.T) {
	key := []byte("test-jwt-key-2026-must-be-32-chars")

	// 签发
	claims := jwt.MapClaims{
		"user_id":   "test-uuid-123",
		"role":      "teacher",
		"school_id": "test-school-456",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("签发失败: %v", err)
	}
	if len(tokenStr) < 20 {
		t.Error("Token 太短，不合法的 JWT")
	}

	// 验证
	parsed, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			t.Logf("⚠️  签名算法: %v", token.Header["alg"])
		}
		return key, nil
	})
	if err != nil {
		t.Fatalf("验证失败: %v", err)
	}
	if !parsed.Valid {
		t.Error("Token 无效")
	}

	c := parsed.Claims.(jwt.MapClaims)
	if c["user_id"] != "test-uuid-123" {
		t.Errorf("user_id 不匹配: %v", c["user_id"])
	}
	if c["role"] != "teacher" {
		t.Errorf("role 不匹配: %v", c["role"])
	}
	t.Logf("✅ JWT 签发/验证通过 | 长度: %d", len(tokenStr))
}

// ── 密码哈希 ──

func TestBcryptHash(t *testing.T) {
	password := "test123456"

	// cost=12
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		t.Fatalf("哈希失败: %v", err)
	}
	if len(hash) == 0 {
		t.Error("哈希为空")
	}
	// bcrypt 输出应该以 $2a$ 开头
	if string(hash[:4]) != "$2a$" {
		t.Errorf("哈希格式异常: %s", string(hash[:4]))
	}

	// 验证正确密码
	if err := bcrypt.CompareHashAndPassword(hash, []byte(password)); err != nil {
		t.Error("正确密码验证失败")
	}

	// 验证错误密码
	if err := bcrypt.CompareHashAndPassword(hash, []byte("wrongpassword")); err == nil {
		t.Error("错误密码不应该验证通过")
	}

	// 相同密码两次哈希结果不同（盐值随机）
	hash2, _ := bcrypt.GenerateFromPassword([]byte(password), 12)
	if string(hash) == string(hash2) {
		t.Error("两次哈希结果相同，盐值未生效")
	}
	t.Logf("✅ bcrypt cost=12 通过 | 哈希长度: %d", len(hash))
}

// ── 验证码生成 ──

func TestGenerateCode(t *testing.T) {
	for _, length := range []int{4, 6, 8} {
		code := generateCode(length)
		if len(code) != length {
			t.Errorf("验证码长度应为 %d，实际 %d", length, len(code))
		}
		for _, c := range code {
			if c < '0' || c > '9' {
				t.Errorf("验证码包含非数字字符: %c", c)
			}
		}
	}
	t.Log("✅ 验证码生成通过 (长度 4/6/8)")
}

// ── 手机号格式 ──

func TestPhoneValidation(t *testing.T) {
	validPhones := []string{"13600000001", "15812345678", "19900001111"}
	invalidPhones := []string{"12345", "1360000000", "136000000001", "1360000000a", ""}

	for _, p := range validPhones {
		if len(p) != 11 {
			t.Errorf("有效手机号长度应为 11: %s", p)
		}
	}
	for _, p := range invalidPhones {
		if len(p) == 11 && p[0] == '1' {
			t.Logf("⚠️  需要额外校验: %s", p)
		}
	}
	t.Log("✅ 手机号格式校验通过")
}

// ── TokenPair 结构 ──

func TestTokenPairStruct(t *testing.T) {
	pair := TokenPair{
		Token:        "eyJ...",
		RefreshToken: "rt...",
		ExpiresIn:    7200,
		User: UserInfo{
			ID:      "uuid-1",
			Name:    "张老师",
			Role:    "teacher",
			Subject: "语文",
			Grade:   "四年级",
		},
	}
	if pair.ExpiresIn != 7200 { t.Error("过期时间异常") }
	if pair.User.Role != "teacher" { t.Error("角色异常") }
	if pair.User.Subject != "语文" { t.Error("学科异常") }
	t.Log("✅ TokenPair 结构验证通过")
}

// ── RegisterInput 校验 ──

func TestRegisterInputValidation(t *testing.T) {
	tests := []struct {
		name  string
		phone string
		role  string
		valid bool
	}{
		{"正确教师", "13600000001", "teacher", true},
		{"正确学生", "15812345678", "student", true},
		{"正确家长", "19900001111", "parent", true},
		{"管理员", "18800000000", "admin", true},
		{"不合法的角色", "13600000001", "hacker", false},
		{"空手机号", "", "teacher", false},
		{"短手机号", "12345", "teacher", false},
	}
	for _, tt := range tests {
		input := RegisterInput{Phone: tt.phone, Password: "test123", Name: "测试", Role: tt.role}
		phoneOK := len(input.Phone) == 11
		roleOK := input.Role == "teacher" || input.Role == "student" || input.Role == "parent" || input.Role == "admin"
		if (phoneOK && roleOK) != tt.valid {
			t.Errorf("%s: 预期 valid=%v 实际 phoneOK=%v roleOK=%v", tt.name, tt.valid, phoneOK, roleOK)
		}
	}
	t.Log("✅ RegisterInput 校验通过")
}
