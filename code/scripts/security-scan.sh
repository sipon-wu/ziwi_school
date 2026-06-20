#!/bin/bash
# 知微AI教学助手 — 安全扫描脚本
# 用法: bash scripts/security-scan.sh

set -e
echo "========================================="
echo "  知微AI教学助手 安全扫描 v1.0"
echo "========================================="
echo ""

# 1. .env 安全检查
echo "[1/6] .env 文件检查..."
if [ ! -f .env ]; then
    echo "  ⚠️  .env 文件不存在，请从 .env.example 复制"
else
    if grep -q "change-me\|changeme" .env 2>/dev/null; then
        echo "  🔴 JWT_PRIVATE_KEY 包含默认值，请修改！"
    fi
    if grep -q "zhiwei2026" .env 2>/dev/null; then
        echo "  🔴 DB_PASSWORD 包含默认密码，请修改！"
    fi
    if grep -q "^DASHSCOPE_API_KEY=$" .env 2>/dev/null; then
        echo "  🟡 DASHSCOPE_API_KEY 未配置"
    fi
    echo "  ✅ .env 文件存在"
fi

# 2. 依赖漏洞扫描
echo ""
echo "[2/6] 依赖漏洞扫描..."
if command -v npm &>/dev/null; then
    (cd frontend && npm audit --production --audit-level=high 2>/dev/null || true)
    echo "  ✅ 前端依赖扫描完成"
fi
if command -v pip &>/dev/null; then
    pip check 2>/dev/null && echo "  ✅ Python 依赖扫描完成" || echo "  ⚠️  pip 依赖检查跳过"
fi

# 3. 敏感文件检查
echo ""
echo "[3/6] 敏感文件暴露检查..."
for pattern in ".git" ".env" "*.pem" "*.key" "*.p12"; do
    found=$(find . -name "$pattern" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -5)
    if [ -n "$found" ]; then
        echo "  🟡 发现敏感文件: $found"
    fi
done
echo "  ✅ 敏感文件检查完成"

# 4. 危险函数检查
echo ""
echo "[4/6] 代码中危险函数检查..."
for pattern in 'exec\(' 'eval\(' 'os.system\(' 'shell_exec\('; do
    hits=$(grep -rn "$pattern" --include="*.go" --include="*.py" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | grep -v "\.git" | head -3)
    if [ -n "$hits" ]; then
        echo "  🟡 发现危险函数调用: $hits"
    fi
done
echo "  ✅ 危险函数检查完成"

# 5. 开放端口检查
echo ""
echo "[5/6] 开放端口检查..."
for port in 3000 5173 8080 5432 6379; do
    if lsof -i :$port &>/dev/null 2>&1; then
        echo "  🟡 端口 $port 正在监听（确保仅开发环境）"
    fi
done
echo "  ✅ 端口检查完成"

# 6. Docker 镜像检查
echo ""
echo "[6/6] Docker 镜像检查..."
if command -v docker &>/dev/null; then
    docker images --filter "dangling=true" -q 2>/dev/null | while read img; do
        echo "  🟡 发现悬空镜像: $img"
    done
    echo "  ✅ Docker 镜像检查完成"
else
    echo "  ⚠️  Docker 未安装，跳过"
fi

echo ""
echo "========================================="
echo "  安全扫描完成"
echo "========================================="
