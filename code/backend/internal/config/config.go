package config

import (
	"os"
)

type Config struct {
	Port         string
	DatabaseURL  string
	RedisURL     string
	JWTSecret    string
	CloudJWKSURL string // cloud IdP 的 JWKS 公钥端点，供 school 独立验签 RS256 token
	AIBaseURL    string
	// 心跳上报（P2 私有部署心跳对齐 heartbeat.ziwi.cn）
	HeartbeatEnabled bool
	HeartbeatURL     string
	HeartbeatAPIKey  string
	OSS              OSSConfig
	// AI 标签巡增调度器（2026-08-28 新增）：每月定期扫未打标装饰，调 AI 补 facet
	AITagSchedulerEnabled bool
}

type OSSConfig struct {
	Endpoint  string
	Bucket    string
	AccessKey string
	SecretKey string
}

func Load() (*Config, error) {
	return &Config{
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      getEnv("DATABASE_URL", buildDatabaseURL()),
		RedisURL:         getEnv("REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:        getEnv("JWT_SECRET", "zhiwei-dev-secret-change-in-production"),
		CloudJWKSURL:     getEnv("CLOUD_JWKS_URL", "https://cloud.ziwi.cn/api/v1/auth/public-key"),
		AIBaseURL:        getEnv("AI_BASE_URL", "http://localhost:8000"),
		HeartbeatEnabled: getEnv("HEARTBEAT_ENABLED", "") == "true",
		HeartbeatURL:     getEnv("HEARTBEAT_URL", "https://heartbeat.ziwi.cn/api/v1/heartbeat"),
		HeartbeatAPIKey:  getEnv("HEARTBEAT_API_KEY", ""),
		AITagSchedulerEnabled: getEnv("AI_TAG_SCHEDULER_ENABLED", "") == "true",
		OSS: OSSConfig{
			Endpoint:  getEnv("OSS_ENDPOINT", ""),
			Bucket:    getEnv("OSS_BUCKET", ""),
			AccessKey: getEnv("OSS_ACCESS_KEY", ""),
			SecretKey: getEnv("OSS_SECRET_KEY", ""),
		},
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func buildDatabaseURL() string {
	host := getEnv("DB_HOST", "127.0.0.1")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "zhiwei")
	password := getEnv("DB_PASSWORD", "zhiwei123")
	dbname := getEnv("DB_NAME", "zhiwei")
	return "postgresql://" + user + ":" + password + "@" + host + ":" + port + "/" + dbname + "?sslmode=disable"
}
