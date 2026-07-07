package model

import (
	"crypto/rand"
	"encoding/hex"
)

// GenUserID 生成用户ID：js_ + 12位hex
func GenUserID() string {
	b := make([]byte, 6) // 6 bytes = 12 hex chars
	rand.Read(b)
	return "js_" + hex.EncodeToString(b)
}

// GenAppID 生成应用/学校ID：zw + 16位hex
func GenAppID() string {
	b := make([]byte, 8) // 8 bytes = 16 hex chars
	rand.Read(b)
	return "zw" + hex.EncodeToString(b)
}
