#!/usr/bin/env bash
# ── DB 资产快照（2026-09-14）──────────────────────────────────────────────
# 为什么需要：项目的「资产类数据」此前**只存在于数据库**、没有任何备份。
#   2026-09-13 一次误执行的迁移（把回滚脚本 001_init_schema.down.sql 当成迁移跑）
#   执行了 DROP TABLE ... CASCADE，把 staging 的 146 条课件素材**永久清空** ——
#   因为没有备份，无法恢复。本脚本把资产表导出为压缩 CSV，落到 backups/<env>/<date>/，
#   便于提交到 git 形成异地备份（"随时在 git 上更新和备份"）。
#
# 只导**资产**表，不导行为/日志类数据（提交/答题/批注/审计等），以控制体积。
#
# 用法：
#   bash code/deploy/scripts/backup_assets.sh staging     # 默认 staging
#   bash code/deploy/scripts/backup_assets.sh prod
set -uo pipefail

ENV=${1:-staging}
SERVER=${SERVER:-root@193.112.163.147}
REMOTE_CODE=${REMOTE_CODE:-/opt/zhiwei/code}
COMPOSE_DIR=$REMOTE_CODE/deploy

case "$ENV" in
  prod)    ENV_FILE=$COMPOSE_DIR/.env ;;
  staging) ENV_FILE=$COMPOSE_DIR/.env.staging ;;
  *) echo "未知环境：$ENV（只支持 prod / staging）"; exit 1 ;;
esac
CONTAINER="zhiwei-postgres-${ENV}"

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"          # 仓库根
OUT_DIR="$ROOT/backups/$ENV/$(date +%Y%m%d)"
mkdir -p "$OUT_DIR"

# 资产表清单：课件素材 / 课件模板 / facet 词表 / 教案 / 知识图谱 / 课标 / 教材版本
# （缺少的表会自动跳过，不视为失败——不同环境建表进度可能不同）
ASSET_TABLES="materials courseware_templates facet_vocab lesson_plans tb_kg_node tb_standard_clause textbook_versions"

echo "==> 导出 $ENV 资产快照到 $OUT_DIR"
for t in $ASSET_TABLES; do
  printf "    - %-22s" "$t"
  # COPY ... TO STDOUT：逐表流式导出，gzip 压缩后落盘（体量可控、便于 git diff）
  if ssh "$SERVER" "set -a; . $ENV_FILE; set +a; docker exec -i $CONTAINER psql -U \"\$DB_USER\" -d \"\$DB_NAME\" -c \"COPY (SELECT * FROM $t) TO STDOUT WITH CSV HEADER\"" 2>/dev/null | gzip > "$OUT_DIR/$t.csv.gz" \
     && [ -s "$OUT_DIR/$t.csv.gz" ]; then
    printf " %s\n" "$(du -h "$OUT_DIR/$t.csv.gz" | cut -f1)"
  else
    rm -f "$OUT_DIR/$t.csv.gz"
    printf " (跳过：表不存在或导出失败)\n"
  fi
done

echo "==> 完成，总体积：$(du -sh "$OUT_DIR" | cut -f1)"
echo "    目录：$OUT_DIR"
echo "    提交：git add backups/ && git commit -m \"chore(backup): $ENV 资产快照 $(date +%Y-%m-%d)\""
