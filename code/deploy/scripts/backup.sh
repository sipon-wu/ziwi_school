#!/bin/bash
# 知微教学平台 · 数据库备份脚本
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/zhiwei"
BACKUP_FILE="$BACKUP_DIR/zhiwei_backup_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "=== 数据库备份 ==="
echo "备份文件: $BACKUP_FILE"

# 从 Docker 容器导出
docker exec zhiwei-postgres pg_dump -U zhiwei zhiwei_school | gzip > "$BACKUP_FILE"

echo "备份完成: $(du -h "$BACKUP_FILE" | cut -f1)"

# 保留最近 7 天
find "$BACKUP_DIR" -name "zhiwei_backup_*.sql.gz" -mtime +7 -delete
echo "已清理 7 天前的备份"
