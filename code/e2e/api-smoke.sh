#!/bin/bash
# 知微AI教学助手 — API 冒烟测试
# 用法: bash e2e/api-smoke.sh [HOST]

HOST=${1:-http://localhost:8080}
PASS=0
FAIL=0
TOKEN=""

green() { echo -e "\033[32m✅ $1\033[0m"; ((PASS++)); }
red()   { echo -e "\033[31m❌ $1\033[0m"; ((FAIL++)); }
hdr()   { echo -e "\n\033[36m━━━ $1 ━━━\033[0m"; }

echo "========================================="
echo "  知微AI教学助手 API 冒烟测试"
echo "  目标: $HOST"
echo "========================================="

# 1. 健康检查
hdr "1. 健康检查"
curl -sf $HOST/api/v1/health >/dev/null && green "GET /health" || red "GET /health"
curl -sf http://localhost:8000/health 2>/dev/null >/dev/null && green "AI /health" || echo "  🟡 AI服务未启动（跳过）"

# 2. 认证
hdr "2. 认证"
RESP=$(curl -sf -X POST $HOST/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"13600000001","password":"test123","name":"测试教师","role":"teacher"}' 2>/dev/null) && green "POST /register" || red "POST /register"

LOGIN=$(curl -sf -X POST $HOST/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13600000001","password":"test123"}' 2>/dev/null) && green "POST /login" || red "POST /login"

TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
AUTH="-H Authorization: Bearer $TOKEN"

# 3. 学校
hdr "3. 学校管理"
curl -sf $HOST/api/v1/schools $AUTH >/dev/null 2>&1 && green "GET /schools" || red "GET /schools"

SCHOOL=$(curl -sf -X POST $HOST/api/v1/schools $AUTH \
  -H "Content-Type: application/json" \
  -d '{"name":"测试小学","region":"重庆市"}' 2>/dev/null) && green "POST /schools" || red "POST /schools"

# 4. 班级
hdr "4. 班级管理"
curl -sf $HOST/api/v1/classes $AUTH >/dev/null 2>&1 && green "GET /classes" || red "GET /classes"

curl -sf -X POST $HOST/api/v1/classes $AUTH \
  -H "Content-Type: application/json" \
  -d '{"name":"三年级2班","grade":"三年级"}' >/dev/null 2>&1 && green "POST /classes" || red "POST /classes"

# 5. 教案
hdr "5. 教案"
curl -sf $HOST/api/v1/lesson-plans $AUTH >/dev/null 2>&1 && green "GET /lesson-plans" || red "GET /lesson-plans"

PLAN=$(curl -sf -X POST $HOST/api/v1/lesson-plans $AUTH \
  -H "Content-Type: application/json" \
  -d '{"subject":"语文","grade":"四年级","lesson_title":"测试教案","period":1,"content":"{}","format_template":"core_literacy","curriculum_alignments":"[]"}' 2>/dev/null) && green "POST /lesson-plans" || red "POST /lesson-plans"

# 6. 工作台
hdr "6. 工作台"
curl -sf $HOST/api/v1/dashboard/home $AUTH >/dev/null 2>&1 && green "GET /dashboard/home" || red "GET /dashboard/home"

# 7. AI 服务
hdr "7. AI 服务"
curl -sf -X POST $HOST/api/v1/ai/lesson-plan/generate $AUTH \
  -H "Content-Type: application/json" \
  -d '{"subject":"语文","grade":"四年级","lesson_title":"《观潮》"}' >/dev/null 2>&1 && green "POST /ai/lesson-plan/generate" || red "POST /ai/lesson-plan/generate"

curl -sf -X POST $HOST/api/v1/ai/exam/generate $AUTH \
  -H "Content-Type: application/json" \
  -d '{"subject":"数学","knowledge_point":"分数加减法","grade":"四年级","difficulty":"L2","count":5}' >/dev/null 2>&1 && green "POST /ai/exam/generate" || red "POST /ai/exam/generate"

curl -sf -X POST $HOST/api/v1/ai/chat $AUTH \
  -H "Content-Type: application/json" \
  -d '{"message":"帮我写教案"}' >/dev/null 2>&1 && green "POST /ai/chat" || red "POST /ai/chat"

# 综合
echo ""
echo "========================================="
echo "  结果: $PASS 通过 / $FAIL 失败"
echo "========================================="

[ $FAIL -eq 0 ] && exit 0 || exit 1
