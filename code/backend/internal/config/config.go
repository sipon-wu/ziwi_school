package config

import (
	"os"
	"time"
)

type Config struct {
	Port           string
	DBHost         string
	DBPort         string
	DBUser         string
	DBPassword     string
	DBName         string
	RedisURL       string
	AIServiceURL   string
	JWTPrivateKey  string
	JWTPublicKey   string
	TokenExpiry    time.Duration
	RefreshExpiry  time.Duration
}

func Load() *Config {
	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		DBHost:         getEnv("DB_HOST", "localhost"),
		DBPort:         getEnv("DB_PORT", "5432"),
		DBUser:         getEnv("DB_USER", "zhiwei"),
		DBPassword:     getEnv("DB_PASSWORD", "zhiwei2026"),
		DBName:         getEnv("DB_NAME", "zhiwei"),
		RedisURL:       getEnv("REDIS_URL", "localhost:6379"),
		AIServiceURL:   getEnv("AI_SERVICE_URL", "http://localhost:8000"),
		JWTPrivateKey:  getEnv("JWT_PRIVATE_KEY", "zhiwei-dev-key-2026"),
		TokenExpiry:    2 * time.Hour,
		RefreshExpiry:  7 * 24 * time.Hour,
	}
	return cfg
}

func (c *Config) DSN() string {
	return "host=" + c.DBHost +
		" port=" + c.DBPort +
		" user=" + c.DBUser +
		" password=" + c.DBPassword +
		" dbname=" + c.DBName +
		" sslmode=disable" +
		" TimeZone=Asia/Shanghai"
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
