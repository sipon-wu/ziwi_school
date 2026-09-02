#!/usr/bin/env python3
"""体检脚本：统计各课件使用的可视化组件种类与分布。

用于验证「组件多样性」是否达标（同一课件应 ≥3 种不同组件），
以及新增组件（diagram/icon-card/structure/flow/annotate）是否真的被 AI 采用。

用法（容器内，需 DATABASE_URL）：
    python scripts/check_visuals.py
"""
import base64
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2  # noqa: E402

NEW_TYPES = {"diagram", "icon-card", "structure", "flow", "annotate"}


def main():
    conn = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=10)
    cur = conn.cursor()
    cur.execute("SELECT name, content FROM materials WHERE type='courseware' ORDER BY name")
    rows = cur.fetchall()
    conn.close()

    print(f"{'课件':<26}{'种类':<6}{'组件分布'}")
    print("-" * 96)
    all_types = Counter()
    weak = []
    for name, content in rows:
        types = []
        for enc in re.findall(r"VISUAL:([A-Za-z0-9+/=]+)", content or ""):
            try:
                d = json.loads(base64.b64decode(enc).decode("utf-8"))
                if isinstance(d, dict) and d.get("type"):
                    types.append(d["type"])
            except Exception:
                pass
        c = Counter(types)
        all_types.update(c)
        mark = "" if len(c) >= 3 else "  ⚠ 不足3种"
        if len(c) < 3:
            weak.append((name, len(c)))
        print(f"{name:<26}{len(c):<6}{dict(c)}{mark}")
    print("-" * 96)
    used_new = {t: n for t, n in all_types.items() if t in NEW_TYPES}
    print(f"全库组件分布: {dict(all_types)}")
    print(f"新增组件采用: {used_new if used_new else '（无）'}")
    print(f"未达标课件: {weak if weak else '无'}")
    print(f"组件种类总计: {len(all_types)} 种")


if __name__ == "__main__":
    main()
