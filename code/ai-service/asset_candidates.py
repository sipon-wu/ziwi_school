#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""候选集计算：从素材库按上下文与匹配度取出「需要量 × 3」的候选，并生成可注入 prompt 的选项块。

设计原则（详见 code/backend/docs/素材资产规划.md 第七节）：

  · 给 Skill 的是「选项」，不是「素材库」
  · 候选集大小 = 实际需要量 × 3
      给等于需要量 → Skill 没得选，退化成填空题
      给全库      → prompt 爆炸，且等于没筛选
      ×3          → 够选、可控、token 可承受
  · 注入 prompt 必须写清三件事：可选项清单 / 需要量 / 禁止自造

排序即推荐：匹配度高的排前面，Skill 大概率选前面的；
它若总选靠后的，说明前面的不合适——这个偏离就是匹配度进化的信号。

用法（命令行）:
    python asset_candidates.py --style forest --scene 新授课 --grade 小学低段 \
        --need-decor 2 --need-icon 3
"""
import argparse
import json
import os
from functools import lru_cache

BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE, "assets")
INDEX_PATH = os.path.join(ASSETS_DIR, "index.json")
TAGS_PATH = os.path.join(ASSETS_DIR, "tags.json")

CATEGORY_CN = {"decor": "装饰元素", "subject": "学科组件", "icon": "通用图标"}
REDUNDANCY = 3  # 候选集大小 = 需要量 × 3
MAX_PER_STEM = 2  # 同一语义词根最多保留几个，防止 alert-circle/square/triangle 刷屏

# 风格语义关键词：为匹配度提供区分度。
# 只靠 styleFit 布尔命中会让所有命中项同分，只能按 id 排序 → 推 alien 给森林风。
STYLE_KEYWORDS = {
    "forest": ["leaf", "plant", "tree", "flower", "seedling", "forest", "wood",
               "grass", "clover", "acorn", "twig", "mushroom", "butterfly",
               "nature", "sprout", "branch", "vine", "pine"],
    "nature": ["leaf", "plant", "tree", "mountain", "river", "nature", "earth",
               "water", "sun", "cloud", "wave", "sea"],
    "minimal": ["minus", "circle", "square", "line", "dot", "grid", "dash",
                "plus", "slash", "corner"],
    "cartoon": ["smile", "star", "balloon", "rainbow", "heart", "face", "mood",
                "cat", "dog", "fish", "paw", "toy", "game", "candy", "gift"],
    "tech": ["cpu", "chip", "circuit", "network", "server", "code", "data",
             "wifi", "bluetooth", "robot", "rocket", "database", "binary"],
    "fresh": ["drop", "water", "sun", "cloud", "leaf", "bubble", "rain",
              "snow", "wind", "sparkle"],
    "academic": ["book", "graduation", "school", "award", "trophy", "certificate",
                 "library", "study", "education", "pencil", "ruler", "microscope",
                 "atom", "flask", "test"],
    "china": ["cloud", "dragon", "lantern", "bamboo", "ink", "stamp", "fan",
              "moon", "mountain", "tea", "fan"],
    "flat": ["square", "circle", "triangle", "shape", "grid", "block", "layer"],
    "business": ["chart", "graph", "briefcase", "document", "report", "meeting",
                 "office", "coin", "money", "calculator"],
    "basic": [],
}

# 形状/状态后缀：用于语义去重（alert-circle 与 alert-square 同词根）
STEM_SUFFIXES = ["-circle", "-square", "-triangle", "-rounded", "-hexagon",
                 "-octagon", "-rhombus", "-diamond", "-off", "-filled",
                 "-outline", "-minus", "-plus", "-bar", "-dot", "-x",
                 "-2", "-3", "-4", "-5"]

# 常用图标：通用图标对风格没有语义差异（check 与 alert-hexagon 对"森林风"一样无关），
# 若不引入常用度，排序就退化成按 id 字母序 → alert-* 永远排最前。
COMMON_ICONS = {
    "check", "circle-check", "x", "arrow-right", "arrow-left", "arrow-up",
    "arrow-down", "chevron-right", "chevron-left", "star", "heart", "eye",
    "search", "clock", "calendar", "user", "home", "bell", "flag", "tag",
    "bookmark", "plus", "minus", "info-circle", "help", "question-mark",
    "settings", "trash", "edit", "pencil", "copy", "link", "download",
    "upload", "filter", "menu", "bulb", "target", "trophy", "award",
    "thumb-up", "smile", "sun", "moon", "world", "lock", "key", "mail",
    "phone", "message-circle", "message", "share", "refresh", "zoom-in",
    "list", "grid", "table", "folder", "file", "book", "bookmark",
}


def stem_of(iid: str) -> str:
    """提取语义词根：alert-circle → alert"""
    s = iid
    changed = True
    while changed:
        changed = False
        for suf in STEM_SUFFIXES:
            if s.endswith(suf) and len(s) > len(suf):
                s = s[: -len(suf)]
                changed = True
    return s


@lru_cache(maxsize=1)
def _load():
    with open(INDEX_PATH, encoding="utf-8") as f:
        idx = json.load(f)
    tags = {}
    if os.path.exists(TAGS_PATH):
        with open(TAGS_PATH, encoding="utf-8") as f:
            tags = json.load(f)
    return idx, tags


def _decode(asset, idx):
    """把索引化的资产解码为可读结构（按需，避免全量展开）"""
    e = idx["enums"]
    return {
        "id": asset["id"],
        "name": asset["name"],
        "category": e["categories"][asset["c"]],
        "styleFit": [e["styles"][i] for i in asset["st"]],
        "scene": [e["scenes"][i] for i in asset["sc"]],
        "grade": [e["grades"][i] for i in asset["g"]],
        "subject": [e["subjects"][i] for i in asset["su"]],
        "source": e["sources"][asset["src"]],
        "variants": {k: v for k, v in asset["v"].items()},  # l=line, f=fill
    }


def match_score(a, style, scene, grade, subject, prefer_variant, hint="", category=""):
    """匹配度初值（无使用数据时按先验；有数据后由反馈修正，见《风格提示词库方案》3.4）

    区分度的两个来源，缺一不可：
      · 装饰/学科组件 → 风格语义契合（STYLE_KEYWORDS）
      · 通用图标      → 常用度（COMMON_ICONS），因为图标对风格本就无差异
    只靠布尔命中会让所有命中项同分，退化为按 id 字母序排序。
    """
    s = 0.0
    if style and style in a["styleFit"]:
        s += 0.30
    if scene and scene in a["scene"]:
        s += 0.15
    if grade and grade in a["grade"]:
        s += 0.15
    if subject and subject in a["subject"]:
        s += 0.20
    elif subject and not a["subject"]:
        s += 0.03          # 通用素材给微弱加分，但不等于命中
    if category == "icon" and a["id"] in COMMON_ICONS:
        s += 0.25          # 常用度：让 check 排在 alert-hexagon 前面
    kws = STYLE_KEYWORDS.get(style) or []
    if kws:
        text = (a["id"] + " " + hint).lower()
        hits = sum(1 for k in kws if k in text)
        s += min(hits, 4) * 0.06         # 最多 +0.24
    if prefer_variant:
        key = "l" if prefer_variant == "line" else "f"
        if key in a["variants"]:
            s += 0.10
    return round(s, 3)


def pick(need: int, category: str, style, scene, grade, subject,
         prefer_variant="auto", top=None):
    """取出该类目下 需要量×3 的候选（按匹配度降序，同词根去重）"""
    if need <= 0:
        return []
    idx, tags = _load()
    cands = []
    for raw in idx["assets"]:
        if raw["c"] != idx["enums"]["categories"].index(category):
            continue
        a = _decode(raw, idx)
        # 装饰类排除 -off 状态变体：它是"关闭/否定"态，不是独立装饰元素
        if category == "decor" and a["id"].endswith("-off"):
            continue
        # tags 原始数据中混有数字与 None，需过滤后再用
        raw_tags = tags.get(a["id"]) or []
        a["hint"] = "、".join(str(t) for t in raw_tags[:3] if t is not None)
        sc = match_score(a, style, scene, grade, subject, prefer_variant,
                         a["hint"], category)
        if sc <= 0:
            continue                      # 完全不匹配的不进候选
        a["score"] = sc
        cands.append(a)
    cands.sort(key=lambda x: (-x["score"], x["id"]))

    # 语义去重：alert-circle / alert-square / alert-triangle 属同一词根，
    # 不去重会让候选集被单一语义的变体占满
    seen, dedup = {}, []
    for a in cands:
        st = stem_of(a["id"])
        if seen.get(st, 0) >= MAX_PER_STEM:
            continue
        seen[st] = seen.get(st, 0) + 1
        dedup.append(a)

    n = top or need * REDUNDANCY
    return dedup[:n]


def build(need: dict, style, scene, grade, subject=None, prefer_variant="auto"):
    """按类目分别构建候选集"""
    out = {}
    for cat in ("decor", "icon", "subject"):
        out[cat] = pick(int(need.get(cat, 0) or 0), cat,
                        style, scene, grade, subject, prefer_variant)
    return out


def to_prompt_block(cands: dict, need: dict) -> str:
    """生成可注入 prompt 的选项块（三条边界：清单 / 需要量 / 禁止自造）"""
    lines = []
    for cat in ("decor", "icon", "subject"):
        items = cands.get(cat) or []
        n = int(need.get(cat, 0) or 0)
        if not items or n <= 0:
            continue
        cn = CATEGORY_CN[cat]
        lines.append(f"【{cn}】本页需要 {n} 个，可选用以下 {len(items)} 个（按匹配度排序）：")
        for a in items:
            v = "面性" if "f" in a["variants"] else ("描边" if "l" in a["variants"] else "")
            hint = f"（{a['hint']}）" if a.get("hint") else ""
            vs = f"[{v}]" if v else ""
            lines.append(f"  · {a['id']}  {a['name']}{vs}{hint}")
        lines.append(f"  要求：从中选用 {n} 个并给出参数（count / scale / opacity）；"
                     f"不得选用上述列表以外的素材；不得自行生成新素材。")
        lines.append("")
    return "\n".join(lines).strip()


def main():
    ap = argparse.ArgumentParser(description="候选集计算：需要量 × 3")
    ap.add_argument("--style", default="forest")
    ap.add_argument("--scene", default="新授课")
    ap.add_argument("--grade", default="小学低段")
    ap.add_argument("--subject", default="")
    ap.add_argument("--need-decor", type=int, default=2)
    ap.add_argument("--need-icon", type=int, default=3)
    ap.add_argument("--need-subject", type=int, default=0)
    ap.add_argument("--prefer", default="auto", choices=["auto", "line", "fill"])
    ap.add_argument("--json", action="store_true", help="输出 JSON 而非 prompt 块")
    a = ap.parse_args()

    need = {"decor": a.need_decor, "icon": a.need_icon, "subject": a.need_subject}
    cands = build(need, a.style, a.scene, a.grade, a.subject or None, a.prefer)

    if a.json:
        print(json.dumps(cands, ensure_ascii=False, indent=2))
    else:
        print(f"# 上下文：{a.style} / {a.scene} / {a.grade}"
              + (f" / {a.subject}" if a.subject else ""))
        print(f"# 候选集大小 = 需要量 × {REDUNDANCY}")
        print()
        print(to_prompt_block(cands, need))


if __name__ == "__main__":
    main()
