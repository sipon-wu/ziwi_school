#!/bin/bash
# 知微AI教学助手 — SaaS 数据库备份脚本
# 每日 03:00 由 backup 容器执行

BACKUP_DIR=/backups
DB=${PGDATABASE:-zhiwei_saas}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/zhiwei_$TIMESTAMP.dump.gz"

echo "[$(date)] 开始备份 $DB ..."

pg_dump -h postgres -U ${PGUSER} -Fc $DB | gzip > "$FILE"

# 保留最近 7 天
find "$BACKUP_DIR" -name "*.dump.gz" -mtime +7 -delete

SIZE=$(ls -lh "$FILE" | awk '{print $5}')
echo "[$(date)] ✅ 备份完成: $FILE ($SIZE)"
