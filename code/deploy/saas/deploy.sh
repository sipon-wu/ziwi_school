#!/bin/bash
# 知微AI教学助手 — SaaS 试用环境部署脚本
# 用法: bash deploy/saas/deploy.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../.."

echo "========================================="
echo "  知微AI教学助手 — SaaS 试用环境部署"
echo "  目标: 腾讯云 CVM"
echo "========================================="
echo ""

# 0. 环境检查
if ! command -v docker &>/dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi

if [ ! -f deploy/saas/.env.saas ]; then
    echo "❌ .env.saas 不存在，请从 .env.example 复制并填入真实密钥"
    exit 1
fi

# 1. 密钥安全警告
if grep -q "CHANGE_ME" deploy/saas/.env.saas; then
    echo "⚠️  .env.saas 包含默认密码，请修改后重试"
    echo "   JWT_PRIVATE_KEY: 运行 openssl rand -base64 32 生成"
    echo "   DB_PASSWORD: 设置强密码"
    exit 1
fi

# 2. SSL 证书检查
if [ ! -f /etc/letsencrypt/live/school.ziwi.cn/fullchain.pem ]; then
    echo "⚠️  SSL 证书未找到，将使用 HTTP 模式"
    echo "   建议运行: certbot certonly --nginx -d school.ziwi.cn"
fi

# 3. 构建前端
echo "📦 构建前端..."
cd frontend
npm run build
cd ..

# 4. 数据库备份目录
mkdir -p /data/zhiwei-saas/backups
chmod 700 /data/zhiwei-saas/backups

# 5. 启动服务
echo "🚀 启动 SaaS 服务..."
docker compose -f deploy/saas/docker-compose.saas.yml --env-file deploy/saas/.env.saas up -d --build

# 6. 等待健康检查
echo "⏳ 等待服务就绪..."
sleep 8
docker compose -f deploy/saas/docker-compose.saas.yml ps

echo ""
echo "========================================="
echo "  ✅ SaaS 试用环境部署完成"
echo ""
echo "  访问地址: https://school.ziwi.cn"
echo "  试用期限: 14 天 / 10万 token"
echo ""
echo "  备份目录: /data/zhiwei-saas/backups"
echo "  查看日志: docker compose -f deploy/saas/docker-compose.saas.yml logs -f"
echo "========================================="
