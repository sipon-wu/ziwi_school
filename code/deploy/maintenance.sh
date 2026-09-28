#!/usr/bin/env bash
# 服务器定期维护（2026-09-28 立 · 用户选 3bA「每周自动清一次」）
#
# 为什么需要：staging 机器只有 40G，`docker compose --build` 每次都会堆构建缓存；
#   2026-09-18 曾因磁盘写满导致 postgres 起不来 → 而 deploy.sh 会**先删容器再重建**，
#   于是"没空间"被放大成**整站不可用**（那次是人工清缓存救回来的）。
#   `deploy.sh` 已有"余量 <5G 就中止"的预检（保证不会把站点打挂），但它**不主动清理** ——
#   本脚本补上主动清理这一环。
#
# 清理范围（**只清可再生的构建垃圾，绝不碰卷/数据/容器**）：
#   ① `docker builder prune -af`  构建缓存（实测可释放 10G+）
#   ② `docker image prune -af`    未被任何容器引用的镜像
#   ③ 截断 >50M 的容器日志（只截断，不删文件）
# 装法（幂等）：crontab 每周一 04:00 跑一次；手动跑：`bash /opt/zhiwei/code/deploy/maintenance.sh`
set -uo pipefail

log() { echo "[$(date '+%F %T')] $*"; }

before=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
log "开始维护：当前可用 ${before}G"

docker builder prune -af >/dev/null 2>&1 || log "builder prune 失败（继续；不影响数据）"
docker image prune -af >/dev/null 2>&1 || log "image prune 失败（继续）"
find /var/lib/docker/containers -name '*-json.log' -size +50M -exec truncate -s 0 {} \; 2>/dev/null || true

after=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
log "维护完成：可用 ${after}G（本次释放 $((after - before))G）"

# 余量仍然紧张 → 提前告警（部署预检是最后一道闸，这里提前可见）
if [ "${after:-0}" -lt 5 ]; then
  log "⚠ 余量仍 <5G：下次部署会被预检拦下，请人工排查大文件（du -sh /var/lib/docker/*）"
fi
