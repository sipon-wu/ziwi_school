"""残表修复验收（2026-09-15）：用**线上真实课件**的 P7 数据，跑同一个检查器 + 同一个兜底函数。

判据（自证）：
  ① 先确认目标页确实含 compare-table 且 cells≠cols（否则这个用例没意义，直接报"用例失效"）
  ② 兜底后：检查器不再报「compare-table 残表」，且 cols 与 cells 对齐
  ③ 正文（除该视觉组件外）不得变化 —— 只修列定义，不改内容
用法：cd code/ai-service && PYTHONPATH=. python3 ../../qa/verify_table_repair.py
"""
import base64
import json
import re
import sys
import urllib.request

sys.path.insert(0, ".")
from scripts.check_courseware_quality import check_markdown, parse          # noqa: E402
from scripts.generate_seed_coursewares import repair_violations             # noqa: E402

B = "http://school1.ziwi.cn"
MID = "d36d20bd-7b53-4da4-893f-56c215a329ba"          # PPT·科技（观潮 科技 09-15）


def _post(path, body, token=""):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          **({"Authorization": "Bearer " + token} if token else {})})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


def _get(path, token):
    req = urllib.request.Request(B + path, headers={"Authorization": "Bearer " + token})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


def tables_in_page(pg: str):
    out = []
    for b64 in re.findall(r"<!--\s*(?:VISUAL|CW-EL):([A-Za-z0-9+/=]+)\s*-->", pg):
        try:
            obj = json.loads(base64.b64decode(b64).decode())
        except Exception:
            continue
        cands = []
        if isinstance(obj, dict) and obj.get("type") == "compare-table":
            cands.append(obj)
        if isinstance(obj, list):
            cands += [e["visual"] for e in obj
                      if isinstance(e, dict) and isinstance(e.get("visual"), dict)
                      and e["visual"].get("type") == "compare-table"]
        out += cands
    return out


def main():
    token = _post("/api/auth/login", {"phone": "13800000002", "password": "teacher123"})["token"]
    md = _get(f"/api/materials/{MID}", token).get("content") or ""

    pages = re.split(r"(?m)^(?=## )", md)
    target = None
    for pg in pages[1:]:
        if tables_in_page(pg):
            target = pg
            break
    if target is None:
        print("用例失效：该课件没有任何 compare-table 页 —— 本验收无意义")
        return 2

    title = target.split("\n")[0][:24]
    tb = tables_in_page(target)[0]
    cols, rows = tb.get("cols") or [], tb.get("rows") or []
    cell_counts = [len(r.get("cells") or []) for r in rows if isinstance(r, dict)]
    print(f"① 目标页：{title}")
    print(f"   修复前 cols={len(cols)} {cols} · 各行 cells={cell_counts}")
    if all(c == len(cols) for c in cell_counts):
        print("   用例失效：该页 cols/cells 本就对齐（不需要修）")
        return 2

    before = [i for i in check_markdown(md, "t", "语文")["issues"] if "残表" in str(i)]
    print(f"   检查器（修复前）：残表 {len(before)} 处 {before[:1]}")

    md2, notes = repair_violations(md, "ppt")
    page2 = None
    for pg in re.split(r"(?m)^(?=## )", md2)[1:]:
        if pg.split("\n")[0][:24] == title:
            page2 = pg
            break
    tb2 = tables_in_page(page2 or "")[0]
    cols2 = tb2.get("cols") or []
    cells2 = [len(r.get("cells") or []) for r in tb2.get("rows") or [] if isinstance(r, dict)]
    after = [i for i in check_markdown(md2, "t", "语文")["issues"] if "残表" in str(i)]
    print(f"② 修复后 cols={len(cols2)} {cols2} · 各行 cells={cells2}")
    print(f"   检查器（修复后）：残表 {len(after)} 处")
    print(f"   兜底 notes：{[n for n in notes if '残表' in n][:2]}")

    # ③ 正文比对：**只看目标页**（整篇比会被其它页的合法降级带偏）
    strip = lambda s: re.sub(r"<!--[^>]*-->", "", s)
    same = strip(target) == strip(page2 or "")
    print(f"③ 目标页正文变化 = {'无' if same else '有（✘ 不该发生）'}")

    ok = (not after) and len(cols2) == max(cells2) and same
    print("结论：" + ("通过 ✔" if ok else "不通过 ✘"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
