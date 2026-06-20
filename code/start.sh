#!/bin/bash
# 知微AI教学助手 — 一键启动脚本
# 用法: bash start.sh [dev|prod]

set -e
MODE=${1:-dev}

echo "========================================="
echo "  知微AI教学助手 v0.2.0"
echo "  启动模式: $MODE"
echo "========================================="
echo ""

# 检查依赖
check_command() {
    if ! command -v $1 &>/dev/null; then
        echo "❌ 缺少依赖: $1，请先安装"
        exit 1
    fi
}

check_command docker
check_command node
check_command npm

# 初始化 .env
if [ ! -f .env ]; then
    echo "📋 创建 .env 文件..."
    cp .env.example .env
    echo "   ⚠️  请编辑 .env 填入真实密钥"
fi

# 安装前端依赖
echo "📦 安装前端依赖..."
(cd frontend && npm install --silent 2>/dev/null || npm install)
echo "   ✅ 前端依赖就绪"

# 安装 Python 依赖（可选）
if [ -f ai-service/requirements.txt ]; then
    echo "📦 安装 AI 服务依赖..."
    (cd ai-service && pip install -r requirements.txt --quiet 2>/dev/null || echo "   ⚠️  Python 依赖安装跳过（请手动执行）")
fi

# 启动服务
echo ""
echo "🚀 启动服务..."
if [ "$MODE" = "dev" ]; then
    echo "   启动前端开发服务器 + Docker 后端..."
    (cd frontend && npm run dev -- --host 0.0.0.0 &)
    sleep 2
    docker compose up -d postgres redis
    echo ""
    echo "========================================="
    echo "  ✅ 知微教学助手已启动"
    echo ""
    echo "  前端:  http://localhost:5173"
    echo "  API:   http://localhost:8080/api/v1/health"
    echo "  AI:    http://localhost:8000/health"
    echo "  数据库: localhost:5432 (zhiwei/zhiwei2026)"
    echo ""
    echo "  停止: docker compose down"
    echo "========================================="
else
    docker compose up -d
    echo ""
    echo "========================================="
    echo "  ✅ 知微教学助手已启动 (生产模式)"
    echo ""
    echo "  访问:  http://localhost"
    echo "  API:   http://localhost:8080/api/v1/health"
    echo ""
    echo "  停止: docker compose down"
    echo "========================================="
fi
