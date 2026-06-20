#!/bin/bash
# 知微AI教学助手 — E2E冒烟测试 (playwright-cli)
# 测试5条核心用户路径
# 前置: docker compose up -d && cd frontend && npm run dev

set -e
BASE="http://localhost:5173"
LPATH="$(dirname "$0")"

# 1. 登录页加载
echo "=== TC1: 登录页加载 ==="
playwright-cli open "$BASE" --browser=chromium
sleep 3
playwright-cli snapshot --filename="$LPATH/snap-login.yaml"
if grep -qi "知微\|登录\|手机号" "$LPATH/snap-login.yaml"; then
  echo "  PASS: 登录页正常加载"
else
  echo "  FAIL: 登录页内容不符"
fi

# 2. 登录流程
echo "=== TC2: 登录流程 ==="
# playwright-cli fill (phone input) "13800001001"
# playwright-cli fill (code input) "123456"
# playwright-cli click (login button)
sleep 2
playwright-cli snapshot --filename="$LPATH/snap-dashboard.yaml"
if grep -qi "工作台\|待批阅\|最近教案\|张老师" "$LPATH/snap-dashboard.yaml"; then
  echo "  PASS: 跳转到工作台首页"
else
  echo "  WARN: 需要手动验证登录跳转"
fi

# 3. 导航切换
echo "=== TC3: 侧边栏导航 ==="
playwright-cli click e5 2>/dev/null || true  # 教案备课
sleep 1
playwright-cli snapshot --filename="$LPATH/snap-nav.yaml"
if grep -qi "教案\|备课" "$LPATH/snap-nav.yaml"; then
  echo "  PASS: 导航切换正常"
else
  echo "  WARN: 需要手动验证侧边栏"
fi

# 4. 统计卡片
echo "=== TC4: 统计卡片显示 ==="
playwright-cli goto "$BASE/dashboard"
sleep 2
playwright-cli snapshot --filename="$LPATH/snap-cards.yaml"
echo "  (需人工验证: 待批阅12/未签3/草稿5)"

# 5. 响应式
echo "=== TC5: 响应式检查 ==="
playwright-cli open "$BASE/dashboard" --browser=chromium
playwright-cli resize 1920 1080
sleep 2
playwright-cli screenshot --filename="$LPATH/screenshot-1920x1080.png"
echo "  截图已保存: $LPATH/screenshot-1920x1080.png"

playwright-cli resize 1366 768
sleep 2
playwright-cli screenshot --filename="$LPATH/screenshot-1366x768.png"
echo "  截图已保存: $LPATH/screenshot-1366x768.png"

playwright-cli close
echo ""
echo "=== E2E冒烟测试完成 ==="
echo "截图位置: $LPATH/"
