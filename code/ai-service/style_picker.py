#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""风格选择：按 学段 × 学科 从风格提示词库选出适用风格。

风格提示词库是单一事实源（skills/shared/styles/*.md），适用边界写在各文件的 fit 字段：

    fit:
      gradeFit:        [小学低段, 小学高段]
      subjectFit:      [语文, 英语]
      excludeGrade:    [初中, 高中]
      excludeSubject:  [数学]

**「这个风格适合哪些学段/学科」是硬边界，由人定义，不交给数据学。**
数据只负责学「在该风格下素材给多少、给几片」。

教训：曾把「森林童趣」用于初中数学《函数》，花草瓢虫的母题与数理内容严重违和——
根因就是风格没有适用边界，调用方传什么用什么。

用法：
    python style_picker.py --grade 初中 --subject 数学
    python style_picker.py --grade 初中 --subject 数学 --prefer forest
    python style_picker.py --list
"""
import argparse
import os
import re
import sys

import yaml

BASE = os.path.dirname(os.path.abspath(__file__))
STYLES_DIR = os.path.join(BASE, "skills", "shared", "styles")
YAML_BLOCK = re.compile(r"```yaml\s*\n(.*?)\n```", re.S)

# 年级归一化：库里的年级是「高一/初二/四年级」，而风格的 fit 用学段名
# 「小学低段/小学高段/初中/高中/学前」。不做映射会导致全部风格被判为不适用。
GRADE_ALIAS = {
    "幼儿园": "学前", "学前班": "学前",
    "一年级": "小学低段", "二年级": "小学低段", "三年级": "小学低段",
    "四年级": "小学高段", "五年级": "小学高段", "六年级": "小学高段",
    "小学": "小学高段",
    "初一": "初中", "七年级": "初中",
    "初二": "初中", "八年级": "初中",
    "初三": "初中", "九年级": "初中",
    "高一": "高中", "高二": "高中", "高三": "高中",
}
# 学段排序（用于兜底：若 gradeFit 声明了更宽范围，按此判断归属）
GRADE_ORDER = ["学前", "小学低段", "小学高段", "初中", "高中"]


def normalize_grade(grade):
    """「高一」→「高中」，已是学段名则原样返回"""
    if not grade:
        return ""
    return GRADE_ALIAS.get(grade.strip(), grade.strip())


def _load_styles():
    """解析各风格 md 中的 yaml 块（单一事实源，不另建索引）"""
    styles = []
    if not os.path.isdir(STYLES_DIR):
        return styles
    for fn in sorted(os.listdir(STYLES_DIR)):
        if not fn.endswith(".md") or fn == "README.md":
            continue
        txt = open(os.path.join(STYLES_DIR, fn), encoding="utf-8").read()
        m = YAML_BLOCK.search(txt)
        if not m:
            continue
        try:
            d = yaml.safe_load(m.group(1)) or {}
        except Exception as e:
            print(f"[warn] 解析 {fn} 失败：{e}", file=sys.stderr)
            continue
        if d.get("id"):
            d["_file"] = fn
            styles.append(d)
    return styles


def _fits(style, grade, subject):
    g = normalize_grade(grade)
    fit = style.get("fit") or {}
    grade_fit = fit.get("gradeFit") or []
    subj_fit = fit.get("subjectFit") or []
    ex_grade = fit.get("excludeGrade") or []
    ex_subj = fit.get("excludeSubject") or []
    if g and g in ex_grade:
        return False
    if subject and subject in ex_subj:
        return False
    if grade_fit and g and g not in grade_fit:
        return False
    if subj_fit and subject and subject not in subj_fit:
        return False
    return True


def _reject_reason(style, grade, subject):
    g = normalize_grade(grade)
    label = f"{grade}（归一为 {g}）" if g != grade else grade
    fit = style.get("fit") or {}
    reasons = []
    if g and g in (fit.get("excludeGrade") or []):
        reasons.append(f"{label} 属于 excludeGrade")
    if subject and subject in (fit.get("excludeSubject") or []):
        reasons.append(f"{subject} 属于 excludeSubject")
    gf = fit.get("gradeFit") or []
    if gf and g and g not in gf:
        reasons.append(f"gradeFit={gf} 不含 {label}")
    sf = fit.get("subjectFit") or []
    if sf and subject and subject not in sf:
        reasons.append(f"subjectFit={sf} 不含 {subject}")
    return "；".join(reasons) or "未声明 fit"


def pick_style(grade, subject=None, prefer=None):
    """按学段+学科选风格。返回 (style_id, 说明)。

    prefer 若不适用，不做静默降级——明确告知原因并改用合规风格，
    避免"传了就用"导致学段与风格违和。
    """
    styles = _load_styles()
    ok = [s for s in styles if _fits(s, grade, subject)]
    if not ok:
        return ("basic", f"无风格匹配 {grade}/{subject or '未指定学科'}，回退 basic")

    if prefer:
        hit = next((s for s in ok if s["id"] == prefer), None)
        if hit:
            return (hit["id"], f"指定风格「{prefer}」适用")
        bad = next((s for s in styles if s["id"] == prefer), None)
        if bad:
            return (ok[0]["id"],
                    f"风格「{prefer}」不适用（{_reject_reason(bad, grade, subject)}）"
                    f"，已改用「{ok[0].get('name', ok[0]['id'])}」")
        return (ok[0]["id"], f"未知风格「{prefer}」，改用「{ok[0].get('name', ok[0]['id'])}」")

    name = ok[0].get("name", ok[0]["id"])
    return (ok[0]["id"], f"按 {grade}/{subject or '未指定学科'} 自动选定「{name}」")


def main():
    ap = argparse.ArgumentParser(description="按学段×学科选风格")
    ap.add_argument("--grade", default="")
    ap.add_argument("--subject", default="")
    ap.add_argument("--prefer", default="")
    ap.add_argument("--list", action="store_true", help="列出所有风格及其适用性")
    a = ap.parse_args()

    if a.list:
        for s in _load_styles():
            mark = "✓" if _fits(s, a.grade, a.subject) else "✗"
            fit = s.get("fit") or {}
            print(f"  {mark} {s['id']:12s} {s.get('name',''):8s} "
                  f"gradeFit={fit.get('gradeFit')} subjectFit={fit.get('subjectFit')}")
        return

    sid, msg = pick_style(a.grade, a.subject, a.prefer or None)
    print(f"{sid}\t{msg}")


if __name__ == "__main__":
    main()
