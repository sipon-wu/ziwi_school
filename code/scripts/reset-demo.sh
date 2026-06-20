#!/bin/bash
# 知微AI教学助手 — 演示环境每日重置脚本
# 用法: 每天凌晨 2:00 执行 (crontab: 0 2 * * * /opt/zhiwei/scripts/reset-demo.sh)

set -e
LOG_FILE="/var/log/zhiwei-demo-reset.log"
echo "$(date '+%Y-%m-%d %H:%M:%S') [RESET] 开始重置演示环境..." | tee -a $LOG_FILE

# 1. 维护模式提示（可选：在 Nginx 返回维护页面）
echo "$(date '+%Y-%m-%d %H:%M:%S') [RESET] 进入维护模式..." | tee -a $LOG_FILE
# 实际部署时取消注释：
# docker compose exec -T nginx mv /usr/share/nginx/html/index.html /usr/share/nginx/html/index.html.bak
# echo "<h1>演示环境正在刷新，预计 10 分钟后恢复</h1>" > /tmp/maintenance.html
# docker cp /tmp/maintenance.html zhiwei-nginx:/usr/share/nginx/html/index.html

sleep 3

# 2. 恢复演示数据库
echo "$(date '+%Y-%m-%d %H:%M:%S') [RESET] 恢复演示数据库..." | tee -a $LOG_FILE
docker compose exec -T postgres psql -U zhiwei -d zhiwei <<EOF
  -- 清空所有业务数据（保留用户 schema）
  DELETE FROM audit_logs;
  DELETE FROM parent_signatures;
  DELETE FROM grading_results;
  DELETE FROM submissions;
  DELETE FROM assignments;
  DELETE FROM lesson_plans;
  DELETE FROM teacher_classes;
  DELETE FROM student_classes;
  DELETE FROM classes;
  DELETE FROM users WHERE phone NOT LIKE 'admin%';

  -- 重新导入演示数据
  \i /docker-entrypoint-initdb.d/init_demo.sql
EOF

# 3. 清除 Redis 缓存
echo "$(date '+%Y-%m-%d %H:%M:%S') [RESET] 清除 Redis 缓存..." | tee -a $LOG_FILE
docker compose exec -T redis redis-cli FLUSHALL

# 4. 恢复 Nginx
# docker compose exec -T nginx mv /usr/share/nginx/html/index.html.bak /usr/share/nginx/html/index.html

# 5. 重启服务
echo "$(date '+%Y-%m-%d %H:%M:%S') [RESET] 重启服务..." | tee -a $LOG_FILE
docker compose restart business-api ai-service

echo "$(date '+%Y-%m-%d %H:%M:%S') [RESET] ✅ 演示环境重置完成" | tee -a $LOG_FILE
