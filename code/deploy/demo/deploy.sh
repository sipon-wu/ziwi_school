#!/bin/bash
# 知微AI教学助手 — 演示环境部署脚本 (4GB 低内存版)
# 目标: 腾讯轻量云 193.112.163.147 (4C/4G/40G)
# 用法: bash deploy/demo/deploy.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "  知微AI教学助手 — 演示环境部署"
echo "  服务器: $(hostname)"
echo "  时间:    $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="
echo ""

# ═══════════════════════════════════════════
# 1. 预检
# ═══════════════════════════════════════════
echo "🔍 [1/8] 环境预检..."

# Docker
if ! command -v docker &>/dev/null; then
    echo -e "${RED}❌ Docker 未安装，请先执行: curl -fsSL https://get.docker.com | bash${NC}"
    exit 1
fi
echo -e "   ${GREEN}✅${NC} Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# Node.js (前端构建需要)
if ! command -v node &>/dev/null; then
    echo -e "${YELLOW}⚠️  Node.js 未安装，将使用 Docker 构建前端${NC}"
    USE_DOCKER_BUILD=true
else
    echo -e "   ${GREEN}✅${NC} Node $(node --version)"
    USE_DOCKER_BUILD=false
fi

# 内存检查
TOTAL_MEM=$(free -m | awk '/Mem:/ {print $2}')
if [ "$TOTAL_MEM" -lt 3500 ]; then
    echo -e "${RED}❌ 内存不足: ${TOTAL_MEM}MB < 3.5GB, 无法部署${NC}"
    exit 1
fi
echo -e "   ${GREEN}✅${NC} 内存: ${TOTAL_MEM}MB"

# 磁盘检查
AVAIL_DISK=$(df -m / | awk 'NR==2 {print $4}')
if [ "$AVAIL_DISK" -lt 10240 ]; then
    echo -e "${RED}❌ 磁盘不足: ${AVAIL_DISK}MB < 10GB${NC}"
    exit 1
fi
echo -e "   ${GREEN}✅${NC} 可用磁盘: ${AVAIL_DISK}MB"

echo ""

# ═══════════════════════════════════════════
# 2. Swap 设置
# ═══════════════════════════════════════════
echo "🔧 [2/8] 设置 Swap..."
SWAP_SIZE=4096

if swapon --show | grep -q 'swapfile'; then
    CURRENT_SWAP=$(free -m | awk '/Swap:/ {print $2}')
    echo -e "   ${GREEN}✅${NC} Swap 已存在: ${CURRENT_SWAP}MB"
else
    echo "   创建 ${SWAP_SIZE}MB swap 文件..."
    fallocate -l ${SWAP_SIZE}M /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=${SWAP_SIZE} status=progress
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    echo -e "   ${GREEN}✅${NC} Swap 已启用: ${SWAP_SIZE}MB"
fi

# 调整 swappiness（减少不必要的 swap 使用）
sysctl vm.swappiness=10
if ! grep -q 'vm.swappiness' /etc/sysctl.conf; then
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi
echo -e "   ${GREEN}✅${NC} swappiness = 10"
echo ""

# ═══════════════════════════════════════════
# 3. Docker 日志轮转配置
# ═══════════════════════════════════════════
echo "🔧 [3/8] 配置 Docker 日志轮转..."
DAEMON_CONFIG="/etc/docker/daemon.json"
DAEMON_TMP=$(mktemp)

if [ -f "$DAEMON_CONFIG" ]; then
    # 合并现有配置
    jq '. + {"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' "$DAEMON_CONFIG" > "$DAEMON_TMP" 2>/dev/null || true
else
    echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' > "$DAEMON_TMP"
fi

if [ -s "$DAEMON_TMP" ]; then
    cp "$DAEMON_TMP" "$DAEMON_CONFIG"
    rm "$DAEMON_TMP"
    # 重载 Docker 配置（如果 Docker 已在运行）
    if systemctl is-active --quiet docker 2>/dev/null; then
        systemctl reload docker 2>/dev/null || true
    fi
    echo -e "   ${GREEN}✅${NC} 日志轮转已配置 (max-size=10m, max-file=3)"
else
    rm "$DAEMON_TMP"
fi
echo ""

# ═══════════════════════════════════════════
# 4. 环境变量
# ═══════════════════════════════════════════
echo "🔧 [4/8] 检查环境变量..."
ENV_FILE="$SCRIPT_DIR/.env.demo"
if [ ! -f "$ENV_FILE" ]; then
    echo "   创建 .env.demo..."
    cat > "$ENV_FILE" << 'ENVEOF'
# 演示环境变量 (4GB 低内存版)
DB_HOST=postgres
DB_PORT=5432
DB_USER=zhiwei
DB_PASSWORD=zhiwei2026
DB_NAME=zhiwei
REDIS_URL=redis:6379
AI_SERVICE_URL=http://ai-service:8000
JWT_PRIVATE_KEY=zhiwei-demo-jwt-secret-2026
DEMO_MODE=true
DEMO_PORT=80
DASHSCOPE_API_KEY=
ENVEOF
    echo -e "   ${YELLOW}⚠️  请编辑 deploy/demo/.env.demo 填入 DASHSCOPE_API_KEY${NC}"
fi
echo -e "   ${GREEN}✅${NC} .env.demo 就绪"
echo ""

# ═══════════════════════════════════════════
# 5. 构建前端
# ═══════════════════════════════════════════
echo "📦 [5/8] 构建前端..."
if [ -d "$PROJECT_DIR/frontend/dist" ]; then
    echo -e "   ${GREEN}✅${NC} 前端已预构建，跳过"
else
    cd "$PROJECT_DIR/frontend"
    if [ "$USE_DOCKER_BUILD" = true ]; then
        echo "   使用 Docker 构建..."
        docker run --rm -v "$(pwd):/app" -w /app node:20-alpine sh -c "npm install && npm run build"
    else
        npm install --silent 2>/dev/null || npm install
        npm run build
    fi
    if [ ! -d "dist" ]; then
        echo -e "${RED}❌ 前端构建失败: dist/ 目录不存在${NC}"
        exit 1
    fi
    echo -e "   ${GREEN}✅${NC} 前端构建完成 ($(du -sh dist | cut -f1))"
    cd "$PROJECT_DIR"
fi
echo ""

# ═══════════════════════════════════════════
# 6. 停止旧容器
# ═══════════════════════════════════════════
echo "🧹 [6/8] 停止旧服务..."
docker compose -f "$SCRIPT_DIR/docker-compose.demo.yml" --env-file "$ENV_FILE" down --remove-orphans 2>/dev/null || true
echo -e "   ${GREEN}✅${NC} 旧服务已停止"
echo ""

# ═══════════════════════════════════════════
# 7. 启动服务
# ═══════════════════════════════════════════
echo "🚀 [7/8] 启动服务..."
docker compose -f "$SCRIPT_DIR/docker-compose.demo.yml" --env-file "$ENV_FILE" up -d --build

# 等待健康检查
echo "   等待 PostgreSQL 就绪..."
for i in $(seq 1 30); do
    if docker exec zhiwei-demo-db pg_isready -U zhiwei &>/dev/null 2>&1; then
        break
    fi
    sleep 2
done

echo "   等待所有容器健康..."
sleep 5
echo ""

# ═══════════════════════════════════════════
# 8. 部署验证
# ═══════════════════════════════════════════
echo "✅ [8/8] 验证部署..."

# 容器状态
echo ""
echo "   ┌─ 容器状态 ─────────────────────────────┐"
docker compose -f "$SCRIPT_DIR/docker-compose.demo.yml" ps --format "   │ {{.Name}}: {{.Status}}" 2>/dev/null
echo "   └────────────────────────────────────────┘"

# 资源占用
echo ""
echo "   ┌─ 内存占用 ─────────────────────────────┐"
docker stats --no-stream --format "   │ {{.Name}}: {{.MemUsage}} ({{.MemPerc}})" 2>/dev/null
echo "   └────────────────────────────────────────┘"

# API 健康检查
echo ""
echo "   API 健康检查..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "   ${GREEN}✅${NC} API 响应正常 (HTTP $HTTP_CODE)"
else
    echo -e "   ${YELLOW}⚠️  API 返回 HTTP $HTTP_CODE (可能需要等待几秒)${NC}"
fi

echo ""
echo "========================================="
echo "  ✅ 部署完成"
echo ""
echo "  访问地址:  http://193.112.163.147"
echo "  管理入口:  http://193.112.163.147/admin"
echo ""
echo "  查看日志:  docker compose -f deploy/demo/docker-compose.demo.yml logs -f"
echo "  重启服务:  docker compose -f deploy/demo/docker-compose.demo.yml restart"
echo "  停止服务:  docker compose -f deploy/demo/docker-compose.demo.yml down"
echo "========================================="
