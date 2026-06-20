# 知微AI教学助手

> 见微知著，知微教学。

AI 驱动的小学+初中教学助手平台，覆盖**教案备课、出题组卷、习作批阅、家长签字**四大核心场景。

---

## 🏗 技术架构

```
┌──────────────────────────────────────────┐
│  Nginx (反向代理 + WAF + 安全头)          │
├──────────────────────────────────────────┤
│  Frontend (React 18 + Vite 5 + Tailwind)  │  ← PC教师端 + WAP学生/家长端
│  Go API (Gin + GORM + PostgreSQL)         │  ← 业务API (35+端点)
│  AI Service (FastAPI + LangChain + pgvector)│ ← 教案生成/出题/批阅
├──────────────────────────────────────────┤
│  PostgreSQL 16 + pgvector                 │  ← 业务数据 + 向量检索
│  Redis                                    │  ← 缓存/会话/队列
└──────────────────────────────────────────┘
```

## 📁 目录结构

```
code/
├── frontend/          ← React 前端 (13个路由页面)
│   ├── src/pages/     ← PC教师端 (10页) + WAP (6页)
│   ├── src/components/← 布局 + 小微聊天组件
│   └── src/lib/       ← API 客户端
├── backend/           ← Go Gin 后端
│   ├── cmd/server/    ← 入口 + 路由注册
│   └── internal/      ← handler/service/repository/model/middleware
├── ai-service/        ← Python AI 服务
│   ├── api_server.py  ← FastAPI 入口 (教案/出题/批阅/对话)
│   ├── rag/           ← 课标 RAG 检索
│   ├── models/        ← 通义千问客户端
│   ├── prompts/       ← Prompt 模板
│   └── scripts/       ← 数据导入脚本
├── nginx/             ← Nginx 配置 (限流/WAF/安全头)
├── curriculum-data/   ← 2022版义教课标数据
├── e2e/               ← E2E 测试脚本
├── scripts/           ← 安全扫描脚本
├── docker-compose.yml ← 容器编排
└── start.sh           ← 一键启动
```

## 🚀 快速启动

### 前置要求
- Docker + Docker Compose
- Node.js 18+
- Python 3.12+ (AI服务)
- Go 1.22+ (后端编译，可选)

### 开发模式启动

```bash
# 1. 配置环境变量
cp .env.example .env

# 2. 一键启动
bash start.sh dev

# 3. 访问
# 前端: http://localhost:5173
# API:  http://localhost:8080/api/v1/health
```

### 导入课标数据

```bash
cd ai-service
pip install -r requirements.txt
python scripts/import_curriculum.py
```

### 启动 Docker 后端服务

```bash
docker compose up -d
docker compose ps  # 检查服务状态
```

## 📊 API 全景 (35+ 端点)

| 模块 | 端点 |
|------|------|
| 认证 | POST register/login/send-code/code-login GET auth/me |
| 学校 | GET/POST /schools GET /schools/:id |
| 班级 | GET/POST /classes |
| 教案 | GET/POST /lesson-plans GET/PUT/DELETE /:id POST /:id/finalize |
| 作业 | GET/POST /assignments |
| 提交 | POST /submissions /submissions/composition |
| 批阅 | GET /grading GET /:id POST confirm/adjust/batch-confirm |
| 学生 | GET /student/assignments GET /student/grading/:id GET /student/error-book |
| 家长 | GET /parent/assignments GET /parent/signatures/:id GET/POST /parent-signatures |
| AI | POST /ai/lesson-plan/generate /ai/exam/generate /ai/grading/auto /ai/chat |

## 🔒 安全

- **传输层**: CSP / HSTS / X-Frame-DENY / WAF (SQL注入/XSS拦截)
- **应用层**: JWT + CSRF Double Submit + bcrypt12 + 输入清洗
- **数据层**: PostgreSQL RLS + 审计日志 + AES-256 备份加密
- **扫描**: `bash scripts/security-scan.sh`

## 📝 许可证

Copyright © 2026 知微（重庆）信息技术有限公司
