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

# ── 0/4 预检：服务器磁盘余量 ──
# 为什么必须有（2026-09-18 事故）：staging 磁盘写满（40G 用满）→ postgres 报
# "could not write lock file postmaster.pid: No space left on device" 起不来；
# 而本脚本 3.5 步会**先 `docker rm -f` 掉全部 staging 容器**再重建 —— 于是"磁盘满"直接表现为
# **整站不可用**（容器停在 Created 状态、nginx 吐 HTML 错误页）。教训：**在动任何容器之前先卡余量**。
# 清理手段（实测可释放）：docker builder prune -af（构建缓存 10.2G）+ docker image prune -af（未引用镜像 0.5G）。
MIN_FREE_GB=${MIN_FREE_GB:-5}
FREE_GB=$(ssh "$SERVER" "df -BG --output=avail / | tail -1 | tr -dc '0-9'")
if [ "${FREE_GB:-0}" -lt "$MIN_FREE_GB" ]; then
  echo "✗ [${ENV}] 服务器磁盘余量不足：${FREE_GB}G < ${MIN_FREE_GB}G —— 已中止，**未动任何容器**（服务保持现状）"
  echo "  请先清理：ssh $SERVER 'docker builder prune -af && docker image prune -af'"
  exit 1
fi
echo "==> [${ENV}] 0/4 预检通过（磁盘余量 ${FREE_GB}G ≥ ${MIN_FREE_GB}G）"

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

echo "==> [${ENV}] 2.6/4 同步 compose 与部署脚本到服务器"
# 修复历史坑：此前**只同步 backend/ 与 ai-service/**，不同步 deploy/，
# 于是"改了 compose（例如新增环境变量）"会**静默失效**——容器按旧配置起，无任何提示。
# 实测（2026-09-12）：给 ai-service 加了 CW_GEN_MODEL / LLM_* 环境变量，部署两次都不生效，
# 进容器 printenv 才发现远端 compose 是旧版。这类"改配置没生效"最耗时，故在此根除。
# 只同步 compose 与脚本：**排除 .env*（含密钥）与日志**，且不用 --delete（避免误删远端密钥文件）。
ssh "$SERVER" "mkdir -p $COMPOSE_DIR"
rsync -az --ignore-times --exclude='.env*' --exclude='*.log' \
  "$HERE/deploy/" "$SERVER:$COMPOSE_DIR/"

echo "==> [${ENV}] 3/4 上传前端到 ${DOCROOT}"
ssh "$SERVER" "mkdir -p $DOCROOT"
# 发布前快照（保留最近 3 份，供 rollback 使用）
SNAP_DIR=/var/www/.deploy_snapshots/${ENV}
TS=$(ssh "$SERVER" "date +%Y%m%d_%H%M%S")
ssh "$SERVER" "mkdir -p $SNAP_DIR && tar czf $SNAP_DIR/${ENV}_${TS}.tar.gz -C $DOCROOT . 2>/dev/null || true"
ssh "$SERVER" "ls -t $SNAP_DIR/${ENV}_*.tar.gz 2>/dev/null | tail -n +4 | xargs -r rm -f"
( cd "$FE_DIR" && tar czf - dist ) | ssh "$SERVER" "rm -rf $DOCROOT && mkdir -p $DOCROOT && tar xzf - -C $DOCROOT --strip-components=1"

echo "==> [${ENV}] 3.2/4 应用数据库迁移（幂等；必须在后端启动之前、且早于容器清理）"
# 为什么必须自动化（2026-09-13）：schema 变更此前**没有迁移步骤** —— 加列只能人工
# `ssh + psql`（本轮 0009 就是这么打的）。而"忘了迁移就部署新后端"会让 GORM 读取
# 不存在的列**直接报错**，报错点远离根因，极难排查。
# 位置很关键：必须在 **3.5 清理容器之前**（那一步会 `docker rm -f` 掉 postgres，
# 之后 docker exec 找不到容器 —— 第一版就踩了这个坑）。
# 做法：migrations/*.sql 按文件名顺序、逐个从**本地**管道执行（不依赖远端是否已同步）；
# 脚本均为 `IF NOT EXISTS` 风格、可重复执行；任一步失败即**中止部署**，
# 避免"schema 与代码不一致"的半成品上线。容器名：zhiwei-postgres-${ENV}（staging/prod 独立栈）。
# 自愈（2026-09-13 首次试运行踩到）：若 postgres 容器**不存在**（例如上一次部署在 3.5 清掉容器后中途失败），
# 先把它拉起来 —— 否则迁移无容器可执行，部署会卡死在这里，且**服务会一直处于停的状态**。
if ! ssh "$SERVER" "docker ps --format '{{.Names}}' | grep -q '^zhiwei-postgres-${ENV}\$'"; then
  echo "    ! postgres 容器不存在，先拉起（自愈）"
  ssh "$SERVER" "cd $COMPOSE_DIR && docker compose $PROJECT -f $COMPOSE --env-file $ENV_FILE up -d postgres-${ENV}" || true
  sleep 6
fi

# ⚠ 只跑「编号 3 位以上、且非 .down.sql」的迁移 ——
# 事故记录（2026-09-13，我犯的错）：第一版写成 `migrations/*.sql`，于是把**回滚脚本**
# `001_init_schema.down.sql`（内容是一串 `DROP TABLE ... CASCADE`）也当成迁移执行了，
# 直接删掉 23 张表（含 materials 素材库、users、schools、lesson_plans），
# 而随后的 `001_init_schema.up.sql` 又因外键类型不兼容报错停在半途 →
# **staging 数据被清空且 schema 不一致**。教训：
#   ① 迁移目录里的**回滚脚本**绝不能被"按序全跑"的逻辑扫到；
#   ② 基线脚本（001）是"从零建库"用的，也不该在增量部署里跑。
# 因此这里显式排除 down 与 001 基线，并只认 `NNN[0-9]_*.sql`。
for _f in "$BE_DIR"/migrations/[0-9][0-9][0-9][0-9]_*.sql "$BE_DIR"/migrations/[0-9][0-9][0-9][0-9][0-9]_*.sql; do
  case "$_f" in
    *.down.sql) continue ;;   # 双保险：回滚脚本永不自动执行
  esac
  [ -f "$_f" ] || continue
  echo "    - 应用 $(basename "$_f")"
  ssh "$SERVER" "set -a; . $ENV_FILE; set +a; docker exec -i zhiwei-postgres-${ENV} psql -U \"\$DB_USER\" -d \"\$DB_NAME\" -v ON_ERROR_STOP=1 -f -" \
    < "$_f" || { echo "    ✗ 迁移失败：$(basename "$_f")（已中止部署，避免 schema 与代码不一致）"; exit 1; }
done

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
