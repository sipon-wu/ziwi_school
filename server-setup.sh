#!/bin/bash
set -e
echo "======================================="
echo " 知微AI教学助手 — 服务器部署"
echo "======================================="
echo ""

# 1. 克隆代码
echo "📦 [1/5] 克隆代码..."
cd /opt
rm -rf zhiwei 2>/dev/null
git clone https://github.com/sipon-wu/ziwi_school.git zhiwei
echo "   ✅ 代码已克隆"

# 2. 写入环境变量
echo "🔑 [2/5] 写入 API Key..."
cd /opt/zhiwei
cat > deploy/demo/.env.demo << 'EOF'
DB_HOST=postgres
DB_PORT=5432
DB_USER=zhiwei
DB_PASSWORD=zhiwei2026
DB_NAME=zhiwei
REDIS_URL=redis:6379
AI_SERVICE_URL=http://ai-service:8000
JWT_PRIVATE_KEY=zhiwei-demo-jwt-secret-2026-a1b2c3
DEMO_MODE=true
DEMO_PORT=80
DASHSCOPE_API_KEY=sk-ws-H.RPLRHHI.WYLY.MEUCIQCSChIFhj-Gl_N3C8wtRwgle1wtxSYPTNIHtdGSUe7dzQIgAISDlMB5Hh5AWQx7mkAeaHv_TYXMCIrMqwPtfpGBJJY
DASHSCOPE_BASE_URL=https://ws-brgw6hkhvu204ezg.cn-beijing.maas.aliyuncs.com
EOF
echo "   ✅ .env.demo 已写入"

# 3. Docker 日志轮转
echo "🔧 [3/5] 配置 Docker..."
mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
    echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' > /etc/docker/daemon.json
fi

# 4. 部署
echo "🚀 [4/5] 启动服务..."
bash deploy/demo/deploy.sh

# 5. 验证
echo ""
echo "✅ [5/5] 验证..."
sleep 3
docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null
echo ""
curl -s http://localhost/api/v1/health 2>/dev/null || echo "⚠️  API 可能还在启动..."
echo ""
echo "访问: http://193.112.163.147"
