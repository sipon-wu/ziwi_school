// Package policy 教学内容安全审核：后端侧强制校验客户端。
//
// 为什么必须在后端做（而不是前端直连 ai-service）：
//  1. 前端校验可被绕过，等于审核形同虚设；
//  2. 合规要求"发布时过闸"，且审核结论须落库留痕（versions.check_result），
//     只有后端落库才可靠、才可追溯。
//
// 因此：校验由后端在「创建/发布」流程中强制调用，前端仅做提示性预检。
package policy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// validatePath ai-service 的发布校验端点（反向代理路径与直连路径一致）。
const validatePath = "/api/ai/courseware/validate"

// Issue 单条审核问题，与 ai-service/policy.py 返回结构对齐。
type Issue struct {
	Type       string `json:"type"`
	Level      string `json:"level"` // block 必须修改（拦截）| warn 提醒（不阻断）
	Keyword    string `json:"keyword,omitempty"`
	Message    string `json:"message"`
	Suggestion string `json:"suggestion,omitempty"`
}

// Result 审核结论。
type Result struct {
	Pass   bool    `json:"pass"`
	Issues []Issue `json:"issues"`
}

// Blocking 返回所有必须修改的 block 级问题。
func (r *Result) Blocking() []Issue {
	out := make([]Issue, 0, len(r.Issues))
	for _, i := range r.Issues {
		if i.Level == "block" {
			out = append(out, i)
		}
	}
	return out
}

// Warnings 返回提醒级问题（不阻断发布，但须展示给教师）。
func (r *Result) Warnings() []Issue {
	out := make([]Issue, 0, len(r.Issues))
	for _, i := range r.Issues {
		if i.Level != "block" {
			out = append(out, i)
		}
	}
	return out
}

// Client 审核客户端。baseURL 为空表示未配置 AI 服务，Check 会返回错误。
type Client struct {
	baseURL string
	http    *http.Client
}

// New 创建审核客户端。baseURL 传 cfg.AIBaseURL。
func New(baseURL string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

// Enabled 审核服务是否可用（未配置 AIBaseURL 时无法审核）。
func (c *Client) Enabled() bool { return c != nil && c.baseURL != "" }

// CheckRequest 审核请求。
type CheckRequest struct {
	Text    string // 待审文本：习题=题干+选项+答案；教案/课件=正文
	Subject string
	Grade   string
}

// Check 调用审核服务。
//
// ⚠️ 关键契约：返回 err != nil 表示**审核没能跑成**（服务未配置/不可用/超时/解析失败），
// 而**不是**"内容有问题"。调用方必须据此把内容标记为**待人工（pending）**，
// 严禁把 err != nil 当作"审核通过"放行——否则审核服务一挂，红线就彻底失效。
func (c *Client) Check(ctx context.Context, req CheckRequest) (*Result, error) {
	if !c.Enabled() {
		return nil, fmt.Errorf("policy: AIBaseURL 未配置，审核服务不可用")
	}
	body, err := json.Marshal(map[string]string{
		"markdown": req.Text,
		"subject":  req.Subject,
		"grade":    req.Grade,
	})
	if err != nil {
		return nil, fmt.Errorf("policy: 构造请求失败: %w", err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+validatePath, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("policy: 创建请求失败: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("policy: 调用审核服务失败: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("policy: 读取响应失败: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("policy: 审核服务返回异常状态 %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	var res Result
	if err := json.Unmarshal(raw, &res); err != nil {
		return nil, fmt.Errorf("policy: 解析响应失败: %w", err)
	}
	return &res, nil
}
