# 知微教学平台

AI 驱动的智能教学助手平台。

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端 | React + TypeScript + Vite + Tailwind CSS | 19 / 5.x / 6 / 4 |
| 后端 | Go + Gin + GORM | 1.23 / 1.10 / v2 |
| AI | Python + FastAPI + LangChain | 3.12 / 0.115 / 0.3 |
| 数据库 | PostgreSQL + pgvector | 16 / 0.7 |
| 缓存 | Redis | 7 |
| 部署 | Docker Compose | v3 |

## 项目结构

```
code/
├── frontend/          # React SPA 前端
│   ├── src/
│   │   ├── app/       # 入口 + 路由 + Provider
│   │   ├── components/# 通用 UI 组件
│   │   ├── features/  # 按功能模块划分
│   │   ├── hooks/     # 自定义 Hooks
│   │   ├── layouts/   # 布局组件
│   │   ├── lib/       # API 客户端 / 工具
│   │   ├── stores/    # Zustand 状态管理
│   │   ├── styles/    # 全局样式
│   │   └── types/     # TypeScript 类型
│   └── ...
├── backend/           # Go Gin 后端
│   ├── cmd/server/    # 入口
│   ├── internal/
│   │   ├── config/    # 配置
│   │   ├── middleware/ # JWT/RBAC/RLS/限流
│   │   ├── handler/   # HTTP 处理器
│   │   ├── service/   # 业务逻辑
│   │   ├── repository/# 数据访问
│   │   └── model/     # GORM 模型
│   └── migrations/    # SQL 迁移
├── ai-service/        # Python AI 服务
│   ├── agents/        # AI Agent
│   ├── rag/           # RAG 检索
│   └── prompts/       # Prompt 模板
├── deploy/            # Docker Compose + Nginx
├── shared/            # 共享类型定义
└── docs/              # 技术文档
```

## 快速启动

### 前置要求

- Node.js 20+
- Go 1.23+
- Python 3.12+
- Docker & Docker Compose

### 本地开发

```bash
# 1. 复制环境变量
cp .env.example .env

# 2. 启动基础设施（PostgreSQL + Redis）
docker-compose -f deploy/docker-compose.yml up -d postgres redis

# 3. 启动 AI 服务
cd ai-service
pip install -r requirements.txt
python api_server.py

# 4. 启动后端
cd backend
go mod download
go run cmd/server/main.go

# 5. 启动前端
cd frontend
npm install
npm run dev
```

### Docker 一键启动

```bash
cp .env.example .env
docker-compose -f deploy/docker-compose.yml up -d
```

## 8 角色权限矩阵

| 角色 | 说明 | 主要功能 |
|------|------|----------|
| teacher | 教师 | 教案/出题/组卷/作业/批阅/学情 |
| head_teacher | 班主任 | 教师权限 + 班级管理/家校沟通 |
| research_lead | 教研组长 | 互审池/教研数据/方法论管理 |
| registrar | 教务员 | 班级调度/课程安排/学期管理 |
| principal | 校长 | 学校数据总览/趋势分析 |
| it_admin | IT管理员 | 用户管理/权限配置/通讯录/教材版本 |
| platform_ops | 平台运营 | Token/ License/公告/审核/财务 |
| platform_devops | 平台运维 | 系统监控/日志/备份/安全 |

## 开发团队

- 阿全：全栈开发
- 技哥：架构设计 + 脚手架
- 小艺：UI/UX 设计
- 品姐：产品需求
- 小Q：QA 测试
