#!/bin/bash
# 知微AI教学助手 — 本地后端启动脚本
# 用法: ./start.sh

set -e
cd "$(dirname "$0")/backend"

# 1. 建立SSH隧道（连接云端PostgreSQL）
echo "🔗 建立SSH隧道..."
pkill -f "ssh.*-L 5432:172.18.0.3:5432" 2>/dev/null || true
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -f -N -L 5432:172.18.0.3:5432 root@193.112.163.147 2>&1
sleep 2
if nc -z 127.0.0.1 5432; then
  echo "✅ SSH隧道已建立 (5432)"
else
  echo "❌ SSH隧道失败"
  exit 1
fi

# 2. 编译并启动后端
echo "🔨 编译后端..."
export GOPROXY=https://goproxy.cn,direct
go build -o server ./cmd/server/

echo "🚀 启动后端..."
pkill -f "./server" 2>/dev/null || true
export DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=zhiwei DB_PASSWORD=zhiwei2025 DB_NAME=zhiwei PORT=8080 JWT_SECRET=zhiwei-dev REDIS_URL=redis://127.0.0.1:6379/0
nohup ./server > /tmp/zhiwei-server.log 2>&1 &
sleep 3
if curl -s http://127.0.0.1:8080/api/health | grep -q '"ok"'; then
  echo "✅ 后端运行在 http://127.0.0.1:8080"
else
  echo "❌ 后端启动失败，查看日志: tail -f /tmp/zhiwei-server.log"
  exit 1
fi

echo "📋 演示账号: 13800000002 / teacher123"
echo "📋 前端地址: http://localhost:5173"
