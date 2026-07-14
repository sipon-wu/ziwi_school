#!/usr/bin/env bash
# 知微双环境部署脚本（本地运行，同源代码推到 prod/staging）
# 用法: ./deploy.sh <prod|staging>
set -euo pipefail

ENV=${1:?"用法: ./deploy.sh <prod|staging>"}

# ---- 服务器与目标路径 ----
SERVER=${SERVER:-root@193.112.163.147}
REMOTE_CODE=${REMOTE_CODE:-/opt/zhiwei/code}
COMPOSE_DIR=$REMOTE_CODE/deploy

case "$ENV" in
  prod)
    COMPOSE=docker-compose.prod.yml
    DOCROOT=/var/www/school.ziwi.cn
    ENV_FILE=$COMPOSE_DIR/.env
    PROJECT=""          # prod 沿用默认项目名 deploy，不动现有容器
    BUILD_SVC="backend" # prod 只重建后端，避免重启 ai/redis
    ;;
  staging)
    COMPOSE=docker-compose.staging.yml
    DOCROOT=/var/www/school1.ziwi.cn
    ENV_FILE=$COMPOSE_DIR/.env.staging
    PROJECT="-p zhiwei-staging"  # 隔离项目名，避免覆盖 prod 镜像
    BUILD_SVC=""                 # staging 首次拉起全部服务
    ;;
  *) echo "未知环境: $ENV"; exit 1 ;;
esac

# ── 回滚子命令：恢复最近一次前端快照 ──
if [ "${2:-}" = "rollback" ]; then
  SNAP=$(ssh "$SERVER" "ls -t /var/www/.deploy_snapshots/${ENV}/${ENV}_*.tar.gz 2>/dev/null | head -1")
  if [ -z "$SNAP" ]; then echo "无可用快照，无法回滚"; exit 1; fi
  echo "==> [${ENV}] 回滚前端到快照: $SNAP"
  ssh "$SERVER" "rm -rf $DOCROOT && mkdir -p $DOCROOT && tar xzf $SNAP -C $DOCROOT"
  echo "==> [${ENV}] 回滚完成（后端未变动；如需回退后端请 git revert 后重新 deploy）"
  exit 0
fi

HERE="$(cd "$(dirname "$0")/.." && pwd)"
FE_DIR="$HERE/frontend"
BE_DIR="$HERE/backend"

echo "==> [${ENV}] 1/4 本地构建前端"
( cd "$FE_DIR" && ./node_modules/.bin/vite build )

echo "==> [${ENV}] 2/4 同步后端源码到服务器"
# 修复历史坑：后端容器在服务器本地用 /opt/zhiwei/code/backend 现编译，
# 若不同步源码，docker compose --build 跑的是旧后端（曾导致 P0 迁移改动不生效）。
# 排除 .env（含密钥）、bin/、编译产物 server（仅根目录二进制，勿排除 cmd/server 源码目录！）。
# --ignore-times：服务器时钟可能领先本地，否则 rsync 会误判"服务器更新"而跳过已改文件。
# 注意：exclude 用前导 '/' 锚定传输根，避免误伤 cmd/server 等含 'server' 的源码目录。
ssh "$SERVER" "mkdir -p $REMOTE_CODE/backend"
rsync -az --delete --ignore-times --exclude='.env' --exclude='bin/' --exclude='/server' \
  "$BE_DIR/" "$SERVER:$REMOTE_CODE/backend/"

echo "==> [${ENV}] 2.5/4 同步 ai-service 源码到服务器"
# ai-service 同样在服务器本地构建（compose context: ../ai-service），
# 不同步则 docker compose --build 跑的是旧 ai-service（课件生成/AI 挂载改动不生效）。
ssh "$SERVER" "mkdir -p $REMOTE_CODE/ai-service"
rsync -az --delete --ignore-times --exclude='.env' --exclude='__pycache__/' --exclude='*.pyc' \
  "$HERE/ai-service/" "$SERVER:$REMOTE_CODE/ai-service/"

echo "==> [${ENV}] 3/4 上传前端到 ${DOCROOT}"
ssh "$SERVER" "mkdir -p $DOCROOT"
# 发布前快照（保留最近 3 份，供 rollback 使用）
SNAP_DIR=/var/www/.deploy_snapshots/${ENV}
TS=$(ssh "$SERVER" "date +%Y%m%d_%H%M%S")
ssh "$SERVER" "mkdir -p $SNAP_DIR && tar czf $SNAP_DIR/${ENV}_${TS}.tar.gz -C $DOCROOT . 2>/dev/null || true"
ssh "$SERVER" "ls -t $SNAP_DIR/${ENV}_*.tar.gz 2>/dev/null | tail -n +4 | xargs -r rm -f"
( cd "$FE_DIR" && tar czf - dist ) | ssh "$SERVER" "rm -rf $DOCROOT && mkdir -p $DOCROOT && tar xzf - -C $DOCROOT --strip-components=1"

echo "==> [${ENV}] 3.5/4 清理可能遗留的非 compose 托管孤儿容器（历史手搓部署遗留），确保可干净重建"
if [ "$ENV" = "staging" ]; then
  ssh "$SERVER" "docker rm -f zhiwei-backend-staging zhiwei-ai-staging zhiwei-postgres-staging zhiwei-redis-staging 2>/dev/null || true"
fi

echo "==> [${ENV}] 4/4 重建后端容器"
if [ -z "$BUILD_SVC" ]; then
  ssh "$SERVER" "cd $COMPOSE_DIR && docker compose $PROJECT -f $COMPOSE --env-file $ENV_FILE up -d --build"
else
  ssh "$SERVER" "cd $COMPOSE_DIR && docker compose $PROJECT -f $COMPOSE --env-file $ENV_FILE up -d --build $BUILD_SVC"
fi

echo "==> [${ENV}] 完成"
