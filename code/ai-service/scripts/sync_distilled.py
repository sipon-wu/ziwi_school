#!/usr/bin/env python3
"""蒸馏结果包 -> 服务器同步（按分水岭两 mode）。

分水岭（见「知微教材原文入库分水岭」）：
  SaaS 多租户公有云 -> 只传【蒸馏结果包】，原文永不上服务器
  单租户私有化部署 -> 传【蒸馏结果包 + 该租户授权版本的原文】（进其自有库，合规）

本脚本默认 --dry-run（只打印将执行的操作，不 rsync、不 ssh）。
需真正同步时显式加 --apply。

用法：
  # 预发布 SaaS：只传蒸馏结果包
  python scripts/sync_distilled.py --mode saas --target staging --package distilled_knowledge.jsonl
  # 单租户私有化：传结果包 + 原文
  python scripts/sync_distilled.py --mode private --target tenantA \
      --package distilled_knowledge.jsonl --origin 底料_教材正文.jsonl

注意：--apply 会写入服务器数据库。SaaS 写入前需先完成 ingest 改造
（tb_lesson_source.storage_mode='distilled_only' + ingest 只收蒸馏结果），即方案③已落地。
"""
import argparse
import os
import subprocess
import sys

SERVER = "root@193.112.163.147"
DATA_DIR = "/opt/zhiwei/data"          # 服务器上 ai-service 容器挂载为 /data
COMPOSE = {
    "staging": ("docker compose -p zhiwei-staging -f docker-compose.staging.yml --env-file .env.staging", "ai-service-staging"),
    "prod": ("docker compose -f docker-compose.prod.yml --env-file .env", "ai-service"),
}
# tenant 私有化：target 为租户标识，走其独立部署路径（接口预留，本轮不实现私有化代码）
TENANT_TARGETS = {}  # e.g. {"tenantA": {"host": "...", "data_dir": "...", "compose": "..."}}


def run(cmd, dry_run, capture=False):
    if dry_run:
        print(f"  [dry-run] $ {cmd}")
        return "" if capture else None
    if capture:
        return subprocess.check_output(cmd, shell=True, text=True)
    subprocess.check_call(cmd, shell=True)


def main():
    ap = argparse.ArgumentParser(description="蒸馏结果包同步到服务器")
    ap.add_argument("--mode", required=True, choices=["saas", "private"])
    ap.add_argument("--target", required=True, help="staging | prod | <tenant 标识>")
    ap.add_argument("--package", required=True, help="本地蒸馏结果包路径")
    ap.add_argument("--origin", default=None, help="private 模式: 需一并上传的原文 jsonl")
    ap.add_argument("--apply", action="store_true", help="默认 dry-run；加此才真执行")
    args = ap.parse_args()

    dry_run = not args.apply
    if dry_run:
        print("[sync] DRY-RUN 模式（不 rsync / 不 ssh）。加 --apply 才真正同步。")

    # 解析目标
    if args.target in COMPOSE:
        remote = SERVER
        remote_data = DATA_DIR
        compose_prefix, svc = COMPOSE[args.target]
    elif args.target in TENANT_TARGETS:
        t = TENANT_TARGETS[args.target]
        remote = t["host"]
        remote_data = t["data_dir"]
        compose_prefix, svc = t["compose"], "ai-service"
    else:
        print(f"[sync] 未知 target: {args.target}", file=sys.stderr)
        sys.exit(2)

    if not os.path.exists(args.package):
        print(f"[sync] 本地结果包不存在: {args.package}", file=sys.stderr)
        sys.exit(2)

    # 1) rsync 结果包
    run(f"rsync -az '{args.package}' {remote}:{remote_data}/", dry_run)

    # 2) private 模式额外 rsync 原文
    if args.mode == "private":
        if not args.origin:
            print("[sync] private 模式需 --origin 指定原文文件", file=sys.stderr)
            sys.exit(2)
        if not os.path.exists(args.origin):
            print(f"[sync] 本地原文不存在: {args.origin}", file=sys.stderr)
            sys.exit(2)
        run(f"rsync -az '{args.origin}' {remote}:{remote_data}/", dry_run)

    # 3) 在服务器容器内执行 ingest（SaaS 只收蒸馏结果 / private 含原文）
    #    注：--distilled / --private-original 标志依赖方案③ ingest 改造已落地
    flags = "--distilled" if args.mode == "saas" else "--private-original"
    files = "distilled_knowledge.jsonl" + (f" {os.path.basename(args.origin)}" if args.mode == "private" else "")
    ingest_cmd = (
        f"cd /opt/zhiwei/code/deploy && {compose_prefix} exec {svc} "
        f"python scripts/ingest_lesson_source.py --data-dir /data --files {files} {flags}"
    )
    run(ingest_cmd, dry_run)

    print(f"[sync] {'DRY-RUN 完成（未执行）' if dry_run else '同步完成'} -> {args.mode}:{args.target}")


if __name__ == "__main__":
    main()
