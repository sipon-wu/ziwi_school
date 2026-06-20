package config

import (
	"os"
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	os.Unsetenv("PORT")
	os.Unsetenv("DB_HOST")
	os.Unsetenv("JWT_PRIVATE_KEY")

	cfg := Load()

	if cfg.Port != "8080" {
		t.Errorf("默认端口应为 8080，实际 %s", cfg.Port)
	}
	if cfg.DBHost != "localhost" {
		t.Errorf("默认 DB_HOST 应为 localhost，实际 %s", cfg.DBHost)
	}
	if cfg.DBName != "zhiwei" {
		t.Errorf("默认 DB_NAME 应为 zhiwei，实际 %s", cfg.DBName)
	}
	if cfg.TokenExpiry.Hours() != 2 {
		t.Errorf("Token 有效期应为 2h，实际 %v", cfg.TokenExpiry)
	}
	if cfg.RefreshExpiry.Hours() != 168 {
		t.Errorf("Refresh Token 应为 7天 (168h)，实际 %v", cfg.RefreshExpiry.Hours())
	}
	t.Logf("✅ 默认配置加载 | Port=%s DB=%s Token=%v", cfg.Port, cfg.DBName, cfg.TokenExpiry)
}

func TestEnvOverride(t *testing.T) {
	os.Setenv("PORT", "9090")
	os.Setenv("DB_HOST", "test-db.example.com")
	os.Setenv("JWT_PRIVATE_KEY", "test-key-override")
	defer os.Unsetenv("PORT")
	defer os.Unsetenv("DB_HOST")
	defer os.Unsetenv("JWT_PRIVATE_KEY")

	cfg := Load()

	if cfg.Port != "9090" {
		t.Errorf("环境变量 PORT 未生效: %s", cfg.Port)
	}
	if cfg.DBHost != "test-db.example.com" {
		t.Errorf("环境变量 DB_HOST 未生效: %s", cfg.DBHost)
	}
	if cfg.JWTPrivateKey != "test-key-override" {
		t.Errorf("环境变量 JWT_PRIVATE_KEY 未生效: %s", cfg.JWTPrivateKey)
	}
	t.Log("✅ 环境变量覆盖通过")
}

func TestDSN(t *testing.T) {
	os.Setenv("DB_USER", "testuser")
	os.Setenv("DB_PASSWORD", "testpass")
	os.Setenv("DB_HOST", "10.0.0.1")
	os.Setenv("DB_PORT", "5433")
	os.Setenv("DB_NAME", "testdb")
	defer func() {
		os.Unsetenv("DB_USER")
		os.Unsetenv("DB_PASSWORD")
		os.Unsetenv("DB_HOST")
		os.Unsetenv("DB_PORT")
		os.Unsetenv("DB_NAME")
	}()

	cfg := Load()
	dsn := cfg.DSN()

	if !contains(dsn, "host=10.0.0.1") { t.Error("DSN 缺少 host") }
	if !contains(dsn, "port=5433") { t.Error("DSN 缺少 port") }
	if !contains(dsn, "user=testuser") { t.Error("DSN 缺少 user") }
	if !contains(dsn, "password=testpass") { t.Error("DSN 缺少 password") }
	if !contains(dsn, "dbname=testdb") { t.Error("DSN 缺少 dbname") }
	if !contains(dsn, "sslmode=disable") { t.Error("DSN 缺少 sslmode") }
	if !contains(dsn, "TimeZone=Asia/Shanghai") { t.Error("DSN 缺少时区") }
	t.Logf("✅ DSN 生成通过 | %s", dsn)
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && searchStr(s, sub)
}

func searchStr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
