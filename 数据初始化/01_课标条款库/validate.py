# -*- coding: utf-8 -*-
import json, glob, re
from collections import Counter

recs = json.load(open("课标条款库_全20份.json", encoding="utf-8"))
print("===== 全量质量门 =====")
print("总条数:", len(recs))
print("空模块:", sum(1 for r in recs if not r["一级模块"].strip()))
print("空原文:", sum(1 for r in recs if not r["原文"].strip()))
print("版本缺失:", [(r["学段"], r["学科"]) for r in recs if not r["版本"]][:5] or "无")
print("二级主题含异常字符:",
      sum(1 for r in recs
          if "（" in (r["二级主题"] or "")
          or any(c.isdigit() for c in (r["二级主题"] or ""))))

pat = re.compile(r"(?:义务教育|普通高中|课程方案).{0,12}?课程标准\s*[（(]\s*\d{4}\s*年")
print("含「年版」页脚碎片:", sum(1 for r in recs if pat.search(r["原文"])))

print("\n===== 逐科汇总 =====")
for f in sorted(glob.glob("课标条款_*_*.json")):
    rr = json.load(open(f, encoding="utf-8"))
    if not rr:
        continue
    ver = rr[0]["版本"]
    mods = len(set(r["一级模块"] for r in rr))
    name = f.replace("课标条款_", "").replace(".json", "")
    print(f"{name:26s} v{ver}  条数={len(rr):4d}  模块数={mods}")

print("\n===== 类型分布（全库）=====")
print(dict(Counter(r["类型"] for r in recs)))
