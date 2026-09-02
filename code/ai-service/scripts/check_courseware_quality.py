#!/usr/bin/env python3
"""课件质量校验 —— Skill SOP 的 S4 关卡1（自动规则校验）。

本文件是**只读质检**，不改产出。
发现违规也不自动修复，而是输出报告，用来回答两个问题：

  · 哪些是「提示词没说清」→ 补提示词，让 Skill 自己改
  · 哪些是「Skill 能力边界」→ 需要平台兜底，或提前写进约定

判据**全部**来自 skills/ 的两份领域知识（单一事实源），本文件不另立标准：
  · shared/质量宪法.md                        篇幅 / 视角 / 互动 / 占位符
  · courseware-ppt/references/版式与组件选型.md  版式×字长、组件×形态、字段字数契约

用法：
    python scripts/check_courseware_quality.py output/seed/*.md
    python scripts/check_courseware_quality.py output/seed/*.md --json
"""
import argparse
import base64
import json
import re
import sys
from collections import Counter

# ── 受控集合（与版式与组件选型.md 一致）──
VALID_LAYOUTS = {
    "edu-cover", "edu-goal", "edu-summary", "edu-homework", "edu-example",
    "edu-explain", "content-2col", "content-grid", "image-text", "title-body",
    "scene",   # H5 专用；PPT 与 H5 的版式集合互斥，不可混用
}
# H5 里出现这些标题 = 把 PPT 结构套到了 H5 上
FORBIDDEN_IN_H5 = re.compile(r"学习目标|课堂小结|分层作业|板书设计|课后作业|教学重点")
# 气泡：`水滴: 我藏在江河里`（排除 `**角色**：A，B` 这种声明行）
BUBBLE_RE = re.compile(r"^(?!\*)([^\s:#\-\*>]{1,8}):\s*(\S.*)$", re.MULTILINE)
VALID_VISUAL_TYPES = {
    "sequence", "compare-table", "timeline", "char-card", "compare-card", "quote",
    "diagram", "icon-card", "structure", "flow", "annotate",
}
# 内容页：必须有核心 visual
CONTENT_LAYOUTS = {"content-2col", "content-grid", "image-text", "title-body"}
# 教学页：以 bullets 为主，若加 visual 只能是文本型
EDU_TEXT_LAYOUTS = {"edu-goal", "edu-summary", "edu-homework"}
TEXT_ONLY_VISUALS = {"quote", "annotate"}
# 互动标记白名单（与生成脚本一致）
INTERACTION_RE = re.compile(r"<!--\s*(read|readalong|quiz|reveal|draw)\s*:")
# quiz：问句 | 选项... | 正确答案索引（0 起）
QUIZ_RE = re.compile(r"<!--\s*quiz:\s*(.*?)\s*-->", re.DOTALL)

# 注：不要写裸的「略」——"可省略""略读"都是正常用词，会误判。
PLACEHOLDER_RE = re.compile(r"待补充|占位|XXX|xxx|TODO|待定|（略）|\(略\)")


def is_en(s) -> bool:
    """判为英文内容：几乎不含中文。

    字数标准是按中文设计的（annotate 30~180 字 = 一段话），
    套到英文课件上就成了 30~180 词（一大段），必须按单词数换算，
    否则与 shared/字数分拆.md 里给的英文标准自相矛盾。
    """
    return len(re.findall(r"[\u4e00-\u9fff]", str(s))) < 3


def text_len(s) -> int:
    """混合计数：中文按字、英文按单词。

    直接用 len() 会把 "Let's Meet the Weather" 算成 23 字，
    但英文课件的一"字"是一个词——否则英文课件永远超标题字数。
    """
    s = str(s)
    cn = len(re.findall(r"[\u4e00-\u9fff]", s))
    en = len(re.findall(r"[A-Za-z]+", s))
    if cn + en:
        return cn + en
    # 纯符号（如 emoji「⛅」）至少算 1 字，否则会被判成空内容
    return 1 if re.search(r"[^\s]", s) else 0
TEACHER_VOICE_RE = re.compile(r"教师(引导|点拨|组织|提问|总结|讲解)|让学生(思考|讨论)")
VAGUE_GOAL_RE = re.compile(r"会认会写\s*\d*\s*个生字|掌握重点词语|理解课文内容")


# ─────────────────────────── 解析 ───────────────────────────

def decode_visual(b64: str):
    try:
        return json.loads(base64.b64decode(b64).decode("utf-8"))
    except Exception:
        return None


def parse(md: str) -> list:
    """按 `## ` 分页。返回每页的结构化信息。"""
    pages = []
    chunks = re.split(r"^## ", md, flags=re.MULTILINE)[1:]
    for ch in chunks:
        lines = ch.split("\n")
        title = lines[0].strip()
        layouts = re.findall(r"<!--\s*layout:\s*([\w-]+)\s*-->", ch)
        bullets = [l[2:].strip() for l in lines if l.startswith("- ")]
        visuals = []
        for b64 in re.findall(r"<!--\s*VISUAL:([A-Za-z0-9+/=]+)\s*-->", ch):
            v = decode_visual(b64)
            if v is not None:
                visuals.append(v)
            else:
                visuals.append({"__decode_error": True})
        interactions = INTERACTION_RE.findall(ch)
        bubbles = [m[1] for m in BUBBLE_RE.finditer(ch)]
        quizzes = [m[1] for m in QUIZ_RE.finditer(ch)]
        pages.append({
            "bubbles": bubbles,
            "quizzes": quizzes,
            "title": title,
            "layouts": layouts,
            "layout": layouts[0] if layouts else None,
            "bullets": bullets,
            "visuals": visuals,
            "interactions": interactions,
            "body_len": text_len(title) + sum(text_len(b) for b in bullets),
        })
    return pages


# ─────────────────────────── 校验项 ───────────────────────────

def check_courseware(pages, fmt="ppt") -> list:
    """课件级检查。返回 [(级别, 项, 说明)]，级别 ∈ {ERR, WARN}"""
    issues = []
    n = len(pages)

    # 篇幅
    lo, hi = (12, 15) if fmt != "h5" else (8, 16)
    if not (lo <= n <= hi):
        issues.append(("ERR", "页数", f"{n} 页，要求 {lo}~{hi} 页"))

    # 组件多样性（PPT 专属：H5 靠对话与互动推进，不用 VISUAL 组件）
    if fmt != "h5":
        types = {v.get("type") for p in pages for v in p["visuals"]
                 if isinstance(v, dict) and v.get("type")}
        if len(types) < 3:
            issues.append(("ERR", "组件多样性", f"仅 {len(types)} 种（{sorted(types)}），要求 ≥3"))
    else:
        # H5 专属：版式必须 scene、禁止 PPT 结构页、不应有 VISUAL
        for i, p in enumerate(pages, 1):
            if p["layout"] and p["layout"] != "scene":
                issues.append(("ERR", "H5 版式必须是 scene",
                               f"第 {i} 页用了 {p['layout']}"))
            if FORBIDDEN_IN_H5.search(p["title"]):
                issues.append(("ERR", "H5 禁止 PPT 结构页",
                               f"第 {i} 页《{p['title'][:14]}》"))
            if p["visuals"]:
                issues.append(("ERR", "H5 不应有 VISUAL 组件",
                               f"第 {i} 页有 {len(p['visuals'])} 个（那是 PPT 的）"))

    # 互动
    inter = sum(len(p["interactions"]) for p in pages)
    if inter < 2:
        issues.append(("ERR", "互动", f"{inter} 处，要求 ≥2"))

    # quiz 正确答案的位置分布：全挤在同一项，学生不用思考就能猜规律
    positions = []
    for p in pages:
        for q in p["quizzes"]:
            parts = [x.strip() for x in q.split("|")]
            if len(parts) >= 4:
                try:
                    positions.append(int(parts[-1]))
                except ValueError:
                    pass
    if len(positions) >= 3 and len(set(positions)) == 1:
        issues.append(("WARN", "quiz 答案位置单一",
                       f"{len(positions)} 道题正确答案都在第 {positions[0] + 1} 项，"
                       f"学生可猜规律，应打散"))

    # 占位符 / 教师视角 / 空话
    for i, p in enumerate(pages, 1):
        text = " ".join([p["title"]] + p["bullets"])
        if PLACEHOLDER_RE.search(text):
            issues.append(("ERR", "占位符", f"第 {i} 页：{text[:40]}"))
        if TEACHER_VOICE_RE.search(text):
            issues.append(("WARN", "教师视角", f"第 {i} 页：{text[:40]}"))
        if VAGUE_GOAL_RE.search(text):
            issues.append(("WARN", "目标空话", f"第 {i} 页：{text[:40]}"))

    return issues


def check_page(p, idx: int, fmt: str = "ppt") -> list:
    """页级检查。"""
    issues = []
    tag = f"第 {idx} 页《{p['title'][:14]}》"

    # 版式：有且仅有一个、合法
    if len(p["layouts"]) == 0:
        issues.append(("ERR", "缺版式", tag))
        return issues
    if len(p["layouts"]) > 1:
        issues.append(("ERR", "多版式", f"{tag} 有 {len(p['layouts'])} 个"))
    if p["layout"] not in VALID_LAYOUTS:
        issues.append(("ERR", "非法版式", f"{tag}：{p['layout']}"))

    # 中文按字、英文按词（标准见 shared/字数分拆.md 的英文换算表）
    en = is_en(p["title"] + "".join(p["bullets"]))
    tl = text_len(p["title"])
    tlo, thi = (2, 8) if en else (4, 16)
    if not (tlo <= tl <= thi):
        issues.append(("WARN", "标题字数", f"{tag} {tl} 字，要求 {tlo}~{thi}"))

    # 要点条数与正文长度
    if len(p["bullets"]) > 5:
        issues.append(("ERR", "要点过多", f"{tag} {len(p['bullets'])} 条，要求 ≤5"))
    # 上限按格式与语种：H5 是手机气泡，英文是单词占位宽，都比中文投屏卡片窄
    limit = 60 if (fmt == "h5" or en) else 120
    if p["body_len"] > limit:
        issues.append(("ERR", "正文超长", f"{tag} {p['body_len']} 字，要求 ≤{limit}"))

    # H5：气泡条数与每条字数
    if fmt == "h5":
        if len(p["bubbles"]) > 4:
            issues.append(("ERR", "气泡过多", f"{tag} {len(p['bubbles'])} 条，要求 2~4"))
        for b in p["bubbles"]:
            bl = text_len(b)
            if bl > 20:
                issues.append(("ERR", "气泡超长", f"{tag}「{b[:16]}」{bl} 字，要求 ≤20"))

    # quiz：选项长度（窄屏更紧）与答案索引合法性（索引越界是真会出错的）
    qcap = 12 if fmt == "h5" else 28
    for q in p["quizzes"]:
        parts = [x.strip() for x in q.split("|")]
        if len(parts) < 4:
            issues.append(("ERR", "quiz 格式",
                           f"{tag} 应为「问句|选项A|选项B|…|索引」，实际 {len(parts)} 段"))
            continue
        try:
            idx = int(parts[-1])
        except ValueError:
            issues.append(("ERR", "quiz 答案索引",
                           f"{tag} 末段应为数字索引，实际「{parts[-1]}」"))
            continue
        opts = parts[1:-1]
        if not (0 <= idx < len(opts)):
            issues.append(("ERR", "quiz 答案越界",
                           f"{tag} 索引 {idx} 超出选项数 {len(opts)}"))
        for o in opts:
            ol = text_len(o)
            if ol > qcap:
                issues.append(("ERR", "quiz 选项超长", f"{tag}「{o[:16]}」{ol} 字，要求 ≤{qcap}"))

    # 版式 × 单条字长
    longest = max((text_len(b) for b in p["bullets"]), default=0)
    gmax, cmax = (6, 15) if en else (12, 30)
    if p["layout"] == "content-grid" and longest > gmax:
        issues.append(("ERR", "grid 字长", f"{tag} 最长 {longest} 字 >{gmax}，禁 content-grid"))
    if p["layout"] in ("content-2col",) and longest > cmax:
        issues.append(("ERR", "2col 字长", f"{tag} 最长 {longest} 字 >{cmax}，禁 content-2col"))
    if p["layout"] in EDU_TEXT_LAYOUTS and longest > cmax:
        issues.append(("ERR", "教学页字长", f"{tag} 最长 {longest} 字 >{cmax}"))
    if p["layout"] == "edu-explain" and len(p["bullets"]) > 2:
        issues.append(("ERR", "explain 槽位", f"{tag} {len(p['bullets'])} 条，只有 2 个槽位"))

    # 可视化：内容页必须有；教学页只能文本型
    # 有互动的页面豁免 visual：互动本身就是这页的"可视化"，
    # 再要求挂组件会让互动页被迫塞一个不相干的图。
    if p["layout"] in CONTENT_LAYOUTS and not p["visuals"] and not p["interactions"]:
        issues.append(("ERR", "内容页缺 visual", tag))
    if p["layout"] in EDU_TEXT_LAYOUTS:
        for v in p["visuals"]:
            if isinstance(v, dict) and v.get("type") and v["type"] not in TEXT_ONLY_VISUALS:
                issues.append(("ERR", "教学页禁卡片组件",
                               f"{tag} 用了 {v['type']}，只能用 quote/annotate"))

    for v in p["visuals"]:
        issues.extend(check_visual(v, tag))

    return issues


def check_visual(v, tag: str) -> list:
    """组件级检查：类型合法 + 字段字数契约 + 丰满度。"""
    issues = []
    if not isinstance(v, dict):
        return issues
    if v.get("__decode_error"):
        issues.append(("ERR", "VISUAL 解码失败", tag))
        return issues

    t = v.get("type")
    if t not in VALID_VISUAL_TYPES:
        issues.append(("ERR", "非法组件", f"{tag}：{t}"))
        return issues

    def bad(field, val, lo, hi):
        issues.append(("ERR", f"{t}.{field}", f"{tag} 「{val}」{text_len(val)} 字，要求 {lo}~{hi}"))

    if t == "sequence":
        items = v.get("items") or []
        if not (3 <= len(items) <= 6):
            issues.append(("ERR", "sequence.items", f"{tag} {len(items)} 个，要求 3~6"))
        for it in items:
            if isinstance(it, dict):
                lab = it.get("label", "")
                if not (2 <= len(lab) <= 16):
                    bad("label", lab, 2, 16)
                if len(it.get("hint", "") or "") > 20:
                    bad("hint", it.get("hint"), 0, 20)
            elif isinstance(it, str) and not (2 <= len(it) <= 16):
                bad("item", it, 2, 16)

    elif t == "compare-table":
        cols = v.get("cols") or []
        rows = v.get("rows") or []
        if not (2 <= len(cols) <= 4):
            issues.append(("ERR", "compare-table.cols", f"{tag} {len(cols)} 列，要求 2~4"))
        if not (2 <= len(rows) <= 5):
            issues.append(("ERR", "compare-table.rows", f"{tag} {len(rows)} 行，要求 2~5"))
        for c in cols:
            if text_len(c) > 12:
                bad("col", c, 0, 12)
        for r in rows:
            cells = r.get("cells") if isinstance(r, dict) else None
            if cells is None:
                continue
            if len(cells) != len(cols):
                issues.append(("ERR", "compare-table 残表",
                               f"{tag} cells {len(cells)} ≠ cols {len(cols)}"))
            for i, c in enumerate(cells):
                if not str(c).strip() or str(c).strip() in ("—", "-", "同上"):
                    issues.append(("ERR", "compare-table 空格", f"{tag} 第 {i + 1} 格为空"))
                elif text_len(c) > 28:
                    bad("cell", c, 0, 28)
            if isinstance(r, dict) and text_len(r.get("label", "")) > 12:
                bad("row.label", r.get("label"), 0, 12)

    elif t == "timeline":
        nodes = v.get("nodes") or []
        if not (3 <= len(nodes) <= 6):
            issues.append(("ERR", "timeline.nodes", f"{tag} {len(nodes)} 个，要求 3~6"))
        for nd in nodes:
            if isinstance(nd, dict):
                if not (2 <= text_len(nd.get("label", "")) <= 12):
                    bad("label", nd.get("label"), 2, 12)
                if text_len(nd.get("desc", "") or "") > 30:
                    bad("desc", nd.get("desc"), 0, 30)

    elif t == "char-card":
        chars = v.get("chars") or []
        if not (4 <= len(chars) <= 12):
            issues.append(("ERR", "char-card.chars", f"{tag} {len(chars)} 个，要求 4~12"))
        for c in chars:
            if isinstance(c, dict) and not c.get("pinyin"):
                issues.append(("ERR", "char-card 缺拼音", f"{tag} {c.get('char')}"))

    elif t == "compare-card":
        pairs = v.get("pairs") or []
        if not (2 <= len(pairs) <= 4):
            issues.append(("ERR", "compare-card.pairs", f"{tag} {len(pairs)} 组，要求 2~4"))
        for pr in pairs:
            if isinstance(pr, dict):
                if not (1 <= text_len(pr.get("label", "")) <= 6):
                    bad("label", pr.get("label"), 1, 6)
                for side in ("left", "right"):
                    val = str(pr.get(side, "") or "")
                    if not (2 <= len(val) <= 28):
                        bad(side, val, 2, 28)

    elif t == "quote":
        txt = str(v.get("text", "") or "")
        if not (8 <= len(txt) <= 100):
            bad("text", txt[:30], 8, 100)
        if text_len(v.get("from", "") or "") > 20:
            bad("from", v.get("from"), 0, 20)

    elif t == "diagram":
        c = str(v.get("center", "") or "")
        dlo, dhi = (1, 7) if is_en(c) else (2, 14)
        if not (dlo <= text_len(c) <= dhi):
            bad("center", c, dlo, dhi)
        brs = v.get("branches") or []
        if not (3 <= len(brs) <= 6):
            issues.append(("ERR", "diagram.branches", f"{tag} {len(brs)} 个，要求 3~6"))
        for b in brs:
            if isinstance(b, dict):
                if text_len(b.get("label", "")) > 16:
                    bad("branch.label", b.get("label"), 0, 16)
                if text_len(b.get("desc", "") or "") > 26:
                    bad("branch.desc", b.get("desc"), 0, 26)

    elif t == "icon-card":
        items = v.get("items") or []
        if not (3 <= len(items) <= 6):
            issues.append(("ERR", "icon-card.items", f"{tag} {len(items)} 个，要求 3~6"))
        for it in items:
            if isinstance(it, dict):
                if text_len(it.get("label", "")) > 10:
                    bad("label", it.get("label"), 0, 10)
                if text_len(it.get("desc", "") or "") > 12:
                    bad("desc", it.get("desc"), 0, 12)

    elif t == "structure":
        levels = v.get("levels") or []
        if not (2 <= len(levels) <= 4):
            issues.append(("ERR", "structure.levels", f"{tag} {len(levels)} 层，要求 2~4"))
        for lv in levels:
            if isinstance(lv, dict):
                if text_len(lv.get("label", "")) > 12:
                    bad("level.label", lv.get("label"), 0, 12)
                ch = lv.get("children") or []
                if not (2 <= len(ch) <= 6):
                    issues.append(("ERR", "structure.children",
                                   f"{tag} {len(ch)} 项，要求 2~6"))
                for c in ch:
                    # children 项可以是字符串，也可以是 {label, desc}
                    val = c.get("label", "") if isinstance(c, dict) else c
                    if text_len(val) > 14:
                        bad("child", val, 0, 14)

    elif t == "flow":
        steps = v.get("steps") or []
        if not (3 <= len(steps) <= 8):
            issues.append(("ERR", "flow.steps", f"{tag} {len(steps)} 步，要求 3~8"))
        for st in steps:
            if isinstance(st, dict):
                if text_len(st.get("label", "")) > 16:
                    bad("label", st.get("label"), 0, 16)
                if text_len(st.get("desc", "") or "") > 24:
                    bad("desc", st.get("desc"), 0, 24)

    elif t == "annotate":
        txt = str(v.get("text", "") or "")
        alo, ahi = (15, 90) if is_en(txt) else (30, 180)
        if not (alo <= text_len(txt) <= ahi):
            bad("text", txt[:30], alo, ahi)
        marks = v.get("marks") or []
        if not (2 <= len(marks) <= 5):
            issues.append(("ERR", "annotate.marks", f"{tag} {len(marks)} 个，要求 2~5"))
        for mk in marks:
            # marks 可以是字符串，也可以是 {start, end, text}（带位置索引，更精确）
            m = str(mk.get("text", "")) if isinstance(mk, dict) else str(mk)
            if text_len(m) > 10:
                bad("mark", m, 0, 10)
            elif m and m not in txt:
                issues.append(("ERR", "annotate 关键词不存在", f"{tag}「{m}」不在 text 中"))

    return issues


# ─────────────────────────── 主流程 ───────────────────────────

def check_markdown(md: str, name: str = "") -> dict:
    """从字符串校验（供生成脚本做 S4 重试闭环时调用）。"""
    fmt = "h5" if "h5" in (name or "").lower() else "ppt"
    pages = parse(md)
    issues = check_courseware(pages, fmt)
    for i, p in enumerate(pages, 1):
        issues.extend(check_page(p, i, fmt))
    return {"file": name or "", "pages": len(pages), "issues": issues}


def check_file(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return check_markdown(fh.read(), path)


def main():
    ap = argparse.ArgumentParser(description="课件质量校验（S4 关卡1，只读）")
    ap.add_argument("files", nargs="+", help="待校验的 markdown")
    ap.add_argument("--json", action="store_true", help="输出 JSON")
    args = ap.parse_args()

    results = [check_file(f) for f in args.files]

    if args.json:
        print(json.dumps([{"file": r["file"], "pages": r["pages"],
                           "issues": [{"level": a, "item": b, "detail": c}
                                      for a, b, c in r["issues"]]}
                          for r in results], ensure_ascii=False, indent=2))
        return

    total_err = 0
    for r in results:
        name = r["file"].split("/")[-1]
        errs = [i for i in r["issues"] if i[0] == "ERR"]
        warns = [i for i in r["issues"] if i[0] == "WARN"]
        total_err += len(errs)
        flag = "OK  " if not errs else "FAIL"
        print(f"[{flag}] {name}  {r['pages']} 页  违规 {len(errs)} / 提醒 {len(warns)}")
        for lv, item, detail in errs:
            print(f"         ERR  {item}: {detail}")
        for lv, item, detail in warns:
            print(f"         warn {item}: {detail}")

    print()
    if total_err == 0:
        print("关卡1 全过")
    else:
        # 按项聚合：看出哪类约束最容易被违反 → 就是最该写进提示词的
        agg = Counter(item for r in results for lv, item, _ in r["issues"] if lv == "ERR")
        print(f"关卡1 未过：共 {total_err} 处。高频违规项：")
        for item, n in agg.most_common(10):
            print(f"    {n:>3}  {item}")
    sys.exit(1 if total_err else 0)


if __name__ == "__main__":
    main()
