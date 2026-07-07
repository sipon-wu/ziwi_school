#!/bin/bash
# 知微教学平台 · 部署脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

echo "=== 知微教学平台 · 部署 ==="
echo ""

# 检查 .env
if [ ! -f "$PROJECT_DIR/../.env" ]; then
  if [ -f "$PROJECT_DIR/../.env.example" ]; then
    echo "[WARN] .env 文件不存在，从 .env.example 复制"
    cp "$PROJECT_DIR/../.env.example" "$PROJECT_DIR/../.env"
  fi
fi

# 拉取镜像
echo "[1/3] 构建 Docker 镜像..."
docker-compose -f "$COMPOSE_FILE" build

# 启动
echo "[2/3] 启动服务..."
docker-compose -f "$COMPOSE_FILE" up -d

# 等待健康检查
echo "[3/3] 等待服务就绪..."
sleep 5

# 状态检查
echo ""
echo "=== 服务状态 ==="
docker-compose -f "$COMPOSE_FILE" ps

echo ""
echo "=== 部署完成 ==="
echo "前端: http://localhost:5173"
echo "后端: http://localhost:8080/api/health"
echo "AI:   http://localhost:8000/health"
