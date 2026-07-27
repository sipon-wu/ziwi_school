package heartbeat

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/zhiwei/backend/internal/model"
	"gorm.io/gorm"
)

// Payload 上报给 heartbeat.ziwi.cn 的心跳体
type Payload struct {
	TenantID       string     `json:"tenant_id"`
	Product        string     `json:"product"`
	LicenseStatus  string     `json:"license_status"`
	LicenseExpires *time.Time `json:"license_expires_at,omitempty"`
	Timestamp      int64      `json:"timestamp"`
	SchoolName     string     `json:"school_name,omitempty"`
	Source         string     `json:"source"` // saas / onprem
}

// Client 心跳上报客户端
// 启动后每 24h 向 HeartbeatURL POST 一次，失败时累加 fail_count（≥3 触发失联告警）
type Client struct {
	db      *gorm.DB
	url     string
	apiKey  string
	enabled bool
	source  string // 部署形态标识：saas / onprem

	stopCh chan struct{}
	wg     sync.WaitGroup
}

// New 创建心跳客户端。enabled=false 时不启动定时器。
func New(db *gorm.DB, url, apiKey string, enabled bool, source string) *Client {
	return &Client{
		db:      db,
		url:     url,
		apiKey:  apiKey,
		enabled: enabled,
		source:  source,
		stopCh:  make(chan struct{}),
	}
}

// Start 启动定时心跳（每 24h 一次，首次延迟 30s）
func (c *Client) Start() {
	if !c.enabled {
		log.Println("[heartbeat] disabled, skip")
		return
	}
	log.Printf("[heartbeat] enabled, url=%s source=%s", c.url, c.source)
	c.wg.Add(1)
	go func() {
		defer c.wg.Done()
		// 启动后 30s 先报一次，方便验证
		time.Sleep(30 * time.Second)
		c.send()
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				c.send()
			case <-c.stopCh:
				return
			}
		}
	}()
}

// Stop 优雅关闭
func (c *Client) Stop() {
	if !c.enabled {
		return
	}
	close(c.stopCh)
	c.wg.Wait()
}

func (c *Client) send() {
	// 取第一条 school 记录作为租户标识
	var school model.School
	if err := c.db.First(&school).Error; err != nil {
		log.Printf("[heartbeat] no school record: %v", err)
		return
	}

	tenantID := school.ID
	if school.CloudTenantID != nil && *school.CloudTenantID != "" {
		tenantID = *school.CloudTenantID
	}

	payload := Payload{
		TenantID:       tenantID,
		Product:        "school",
		LicenseStatus:  school.LicenseStatus,
		LicenseExpires: school.LicenseExpiresAt,
		Timestamp:      time.Now().Unix(),
		SchoolName:     school.FullName,
		Source:         c.source,
	}

	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", c.url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil || (resp != nil && resp.StatusCode >= 500) {
		errMsg := "network error"
		if err != nil {
			errMsg = err.Error()
		} else if resp != nil {
			errMsg = resp.Status
		}
		log.Printf("[heartbeat] send FAIL: %s", errMsg)
		c.incFailCount(school.ID)
		return
	}
	if resp != nil {
		resp.Body.Close()
	}

	now := time.Now()
	c.db.Model(&model.School{}).Where("id = ?", school.ID).
		Updates(map[string]interface{}{
			"last_heartbeat_at":  &now,
			"heartbeat_fail_count": 0,
		})
	log.Printf("[heartbeat] sent OK at %s", now.Format(time.RFC3339))
}

// incFailCount 累加心跳失败次数。≥3 次时应触发运维告警（当前仅打日志）。
func (c *Client) incFailCount(schoolID interface{}) {
	c.db.Model(&model.School{}).Where("id = ?", schoolID).
		UpdateColumn("heartbeat_fail_count", gorm.Expr("heartbeat_fail_count + 1"))

	var failCount int
	c.db.Model(&model.School{}).Where("id = ?", schoolID).
		Select("heartbeat_fail_count").Scan(&failCount)
	if failCount >= 3 {
		log.Printf("[heartbeat] ALERT: %d consecutive failures — heartbeat may be disconnected", failCount)
	}
}
