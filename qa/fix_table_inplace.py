"""存量课件「残表」就地修（2026-09-15）。

为什么单做这一步：新建流水线已含该兜底（`fix_compare_table`），但**今天生成的这批课件**是在修复前
落库的 —— 教师打开 P7 看到的仍是错位表格。这里只对 compare-table 这一项做机械修复，
**不动其它页面、其它组件、一个字的内容**。

用法：cd code/ai-service && PYTHONPATH=. python3 ../../qa/fix_table_inplace.py <material_id> [--dry]
"""
import base64
import json
import re
import sys
import urllib.request

sys.path.insert(0, ".")
from scripts.generate_seed_coursewares import fix_compare_tables_in   # noqa: E402

B = "http://school1.ziwi.cn"
RE_ANY = re.compile(r"<!--\s*(VISUAL|CW-EL):([A-Za-z0-9+/=]+)\s*-->")


def call(path, token, method="GET", body=None):
    req = urllib.request.Request(
        B + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + token})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())


def main():
    mid = sys.argv[1]
    dry = "--dry" in sys.argv
    token = call("/api/auth/login", "", "POST",
                 {"phone": "13800000002", "password": "teacher123"})["token"]
    mat = call(f"/api/materials/{mid}", token)
    md = str(mat.get("content") or "")
    print(f"素材：{mat.get('name')}（{mat.get('format')}）正文 {len(md)} 字")

    hits = []

    def sub(m):
        try:
            obj = json.loads(base64.b64decode(m.group(2)).decode())
        except Exception:
            return m.group(0)
        fixed = fix_compare_tables_in(obj)
        if not fixed:
            return m.group(0)
        hits.extend(fixed)
        b64 = base64.b64encode(json.dumps(obj, ensure_ascii=False).encode()).decode()
        return f"<!-- {m.group(1)}:{b64} -->"

    md2 = RE_ANY.sub(sub, md)
    if not hits:
        print("无需修复（没有残表）")
        return 0
    for h in hits:
        print("  修复：" + h)
    # 自证：除被修的注释外，正文逐字相同
    strip = lambda s: re.sub(r"<!--[^>]*-->", "", s)
    same = strip(md) == strip(md2)
    print(f"  正文（去注释后）未变 = {same}")
    if not same:
        print("  ✘ 正文被改动，中止")
        return 1
    if dry:
        print("（--dry，未落库）")
        return 0

    body = {k: v for k, v in mat.items() if k in (
        "name", "type", "format", "tag", "url", "content", "h5_html", "status", "grade",
        "subject", "theme_id", "color_root", "textbook_version_id", "unit", "lesson_plan_id",
        "period", "gen_params", "interactive_slots")}
    body["content"] = md2
    call(f"/api/materials/{mid}", token, "PUT", body)
    back = call(f"/api/materials/{mid}", token)
    print(f"  已落库：回读正文 {len(str(back.get('content') or ''))} 字")
    left = fix_compare_tables_in(json.loads(base64.b64decode(
        RE_ANY.findall(str(back.get("content")))[0][1]))) if RE_ANY.findall(str(back.get("content"))) else []
    print(f"  回读复核：仍待修 {len(left)} 处（应为 0）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
