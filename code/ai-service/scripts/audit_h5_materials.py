#!/usr/bin/env python3
"""存量 H5 课件展示升级 —— 只读盘点（2026-09-03）。

回答升级决策要的三个问题：
  1. rerenderable：content 是否为「场景 markdown」（可被 courseware-h5 渲染器重渲染）？
     · 是 → 走「重渲染脚本」(qa/rebuild-h5.mjs) 即可升级快照
     · 否（JSON/空白）→ 只能人工/AI 重生成内容
  2. h5_html 快照引擎新旧：快照含 'morph-' 标记 = 新引擎（无需重渲染）；含旧特征 = 旧快照
  3. color_root 是否已含 morph；theme_id 分布

用法（ai-service 环境，DATABASE_URL 指向目标库）：
    DATABASE_URL=postgresql://... .venv/bin/python scripts/audit_h5_materials.py
    DATABASE_URL=... .venv/bin/python scripts/audit_h5_materials.py --csv audit.csv --sample 5
只读，不修改任何数据。
"""
import argparse
import csv
import json
import os
import sys

try:
    import psycopg2
except ImportError:
    print("需要 psycopg2：.venv/bin/pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)


def looks_like_scene_md(content) -> bool:
    """近似判定是否为 H5 场景 markdown（# 标题 + ## 场景）。旧 slides JSON 以 [ 或 { 开头 → 否。"""
    if not content:
        return False
    s = str(content).strip()
    if not s or s[0] in "[{":
        return False
    # 场景式标记特征：## 分节 + 至少一个（互动/版式/气泡/角色/旁白）标记
    if "\n## " not in s and not s.startswith("# "):
        return False
    return True


def has_morph(color_root) -> bool:
    if not color_root:
        return False
    try:
        obj = json.loads(color_root) if str(color_root).strip().startswith(("{", "[")) else {}
    except Exception:
        return False
    if not isinstance(obj, dict):
        return False
    m = obj.get("morph") or (obj.get("styleDNA") or {}).get("morph")
    return bool(m and isinstance(m, dict))


def main():
    ap = argparse.ArgumentParser(description="只读盘点存量 H5 课件的展示升级面")
    ap.add_argument("--csv", default="", help="可选：明细 CSV 输出路径")
    ap.add_argument("--sample", type=int, default=6, help="控制台展示条数（0=不展示）")
    args = ap.parse_args()

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL 未设置", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(dsn, connect_timeout=10)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, name, school_id, status, theme_id, color_root, content, h5_html, created_at"
        " FROM materials"
        " WHERE format='h5' AND (type='courseware' OR type IS NULL OR type='')"
        " ORDER BY created_at ASC"
    )
    rows = cur.fetchall()
    conn.close()

    stat = {"total": len(rows), "rerenderable": 0, "not_rerenderable": 0,
            "old_snapshot": 0, "new_engine": 0, "empty_h5": 0,
            "morph_yes": 0, "morph_no": 0, "no_color_root": 0}
    theme_counter: dict = {}
    detail = []

    for mid, name, sid, status, theme_id, color_root, content, h5_html, created in rows:
        rerenderable = looks_like_scene_md(content)
        hlen = len(h5_html or "") if h5_html else 0
        engine_new = bool(h5_html) and "morph-" in (h5_html or "")
        h5_old = bool(h5_html) and not engine_new
        m = has_morph(color_root)
        stat["rerenderable" if rerenderable else "not_rerenderable"] += 1
        if not h5_html:
            stat["empty_h5"] += 1
        elif engine_new:
            stat["new_engine"] += 1
        else:
            stat["old_snapshot"] += 1
        if color_root:
            stat["morph_yes" if m else "morph_no"] += 1
        else:
            stat["no_color_root"] += 1
        theme_counter[theme_id or "(空)"] = theme_counter.get(theme_id or "(空)", 0) + 1
        detail.append({
            "id": mid, "name": (name or "")[:40], "school_id": sid, "status": status,
            "theme_id": theme_id or "", "rerenderable": rerenderable,
            "snapshot": "new" if engine_new else ("old" if h5_old else "empty"),
            "morph": "yes" if m else "no",
            "content_len": len(content or ""), "h5_len": hlen,
            "created": str(created)[:10],
        })

    print(f"存量 H5 课件：{stat['total']} 份")
    print(f"  内容可重渲染(scene md) : {stat['rerenderable']}   不可(JSON/空): {stat['not_rerenderable']}")
    print(f"  快照: 新引擎 {stat['new_engine']} / 旧快照 {stat['old_snapshot']} / 空 {stat['empty_h5']}")
    print(f"  color_root: 含morph {stat['morph_yes']} / 无morph {stat['morph_no']} / 空 {stat['no_color_root']}")
    print("  theme_id 分布:", dict(sorted(theme_counter.items(), key=lambda x: -x[1])))

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(detail[0].keys()))
            w.writeheader()
            for d in detail:
                w.writerow(d)
        print(f"明细已写：{args.csv}")

    for d in detail[: max(0, args.sample)]:
        print(f"  - [{d['status']}] {d['name']}  theme={d['theme_id']} 可重渲染={d['rerenderable']} "
              f"快照={d['snapshot']} morph={d['morph']} content={d['content_len']}B")


if __name__ == "__main__":
    main()
