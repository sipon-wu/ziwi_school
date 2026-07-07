# care_records 表字段级加密方案

## 背景

`care_records` 表存储学生成长关爱记录，包含学生姓名、问题描述、干预措施等敏感信息。为满足《个人信息保护法》要求，需要对敏感字段实施字段级加密。

## 加密方案

### 方案选型：AES-256-GCM（带认证的加密）

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| AES-256-CBC | 成熟稳定 | 无完整性校验 | 否 |
| AES-256-GCM | 加密+认证一体化，抗篡改 | Go 1.18+ 原生支持 | **推荐** |
| pgcrypto | 数据库层面，无需改代码 | 密钥存DB不安全 | 否 |
| 应用层信封加密 | 密钥管理最安全 | 实现复杂度高 | 二期考虑 |

### 加密字段

| 字段 | 类型 | 加密原因 | 加密方式 |
|------|------|----------|----------|
| student_name | VARCHAR(100) | 未成年人姓名 | AES-256-GCM |
| problem | VARCHAR(500) | 可能包含敏感行为描述 | AES-256-GCM |
| measure | VARCHAR(500) | 可能包含干预措施细节 | AES-256-GCM |

### 密钥管理

```
方案1（MVP推荐）：环境变量注入
  - ENCRYPTION_KEY 通过 K8s Secret / Docker Secret 注入
  - 密钥长度：32字节（AES-256）
  - 密钥轮换：手动重启服务

方案2（生产推荐）：云KMS + 信封加密
  - 主密钥存储在腾讯云 KMS
  - 数据密钥（DEK）由主密钥加密后存储
  - 支持密钥自动轮换
```

### 实现伪代码

```go
package crypto

import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "encoding/base64"
    "errors"
    "io"
)

var encryptionKey []byte // 32 bytes, 从环境变量加载

// EncryptField 加密单个字段
func EncryptField(plaintext string) (string, error) {
    block, err := aes.NewCipher(encryptionKey)
    if err != nil {
        return "", err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }
    
    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }
    
    // nonce + ciphertext + tag 合并后 base64 编码
    ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptField 解密单个字段
func DecryptField(encoded string) (string, error) {
    ciphertext, err := base64.StdEncoding.DecodeString(encoded)
    if err != nil {
        return "", err
    }
    
    block, err := aes.NewCipher(encryptionKey)
    if err != nil {
        return "", err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }
    
    nonceSize := gcm.NonceSize()
    if len(ciphertext) < nonceSize {
        return "", errors.New("ciphertext too short")
    }
    
    nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return "", err
    }
    
    return string(plaintext), nil
}
```

### 数据库变更

```sql
-- 加密后字段长度需扩展（base64编码后约增加33%）
ALTER TABLE care_records 
    ALTER COLUMN student_name TYPE VARCHAR(200),
    ALTER COLUMN problem TYPE VARCHAR(800),
    ALTER COLUMN measure TYPE VARCHAR(800);
```

### 实施步骤

1. **Phase 1（当前 Sprint）**：文档就位，暂不实际实现加密
2. **Phase 2（Sprint 2）**：
   - 实现 crypto 包
   - 添加双写模式（同时存明文和密文，逐步切换）
   - 单元测试覆盖加解密正确性
3. **Phase 3（Sprint 3）**：
   - 移除明文存储
   - 数据迁移：批量加密历史数据
   - 性能测试（加解密开销 < 5ms/字段）

### 注意事项

- **搜索限制**：加密后无法对加密字段做 LIKE/全文搜索，需在应用层处理或使用盲索引
- **排序限制**：加密字段无法在数据库层排序
- **密钥安全**：密钥绝不硬编码，必须通过环境变量/Secret管理
- **备份安全**：数据库备份也包含加密数据，备份文件需同样保护
