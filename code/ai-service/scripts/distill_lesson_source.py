#!/usr/bin/env python3
"""教材原文 → 蒸馏结果包（本地蒸馏工具，不外传原文）。

设计定位（见「知微教材原文入库分水岭」）：
  SaaS 多租户公有云 → 原文永不上服务器，业务库只收「蒸馏结果」。
  本工具在【本地开发机】运行，输入本地原文库（底料_教材正文.jsonl 等），
  输出 distilled_knowledge.jsonl（知识点/提纲/结构化摘要 + embedding + 元数据），
  【不含任何原文正文】。结果包经 sync_distilled.py 同步到服务器后入库。

  「原文库不删除」= 本地源文件保留，作为后续【追加蒸馏】的唯一输入；
  随时 re-run 本工具即可对原文库做新一轮蒸馏，append 新知识进结果包。

用法（本地，已配 DASHSCOPE_API_KEY）：
  python scripts/distill_lesson_source.py --data-dir /path/to/底料
  python scripts/distill_lesson_source.py --data-dir . --limit 20   # 试跑
  python scripts/distill_lesson_source.py --data-dir . --min-confidence 0.5

输出：<data-dir>/distilled_knowledge.jsonl（每行一条蒸馏结果，无原文）
"""
import argparse
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import dashscope
from dashscope import Generation

dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")
MODEL = "qwen-turbo"

from embeddings import embed_texts, EMBED_DIM, EMBED_MODEL  # noqa: E402

DEFAULT_FILES = ["底料_教材正文.jsonl"]

DISTILL_SYSTEM_PROMPT = """你是一位资深中小学教研员，正在把教材正文转化为供一线教师备课参考的「结构化教学知识」。
你的输出是【教学知识提炼】，不是课文原文复述。
要求：
1. 用自己的语言组织，不得直接复制原文长句或连续表述
2. 关注"教什么知识点、怎么教"，而不是"原文怎么写的"
3. 提炼核心知识点、可操作的教学提示、以及内容提纲
4. 语言简洁、具体、可操作，适合教师直接参考使用"""

DISTILL_USER_TEMPLATE = """以下是{subject}{grade}{volume}《{chapter}》的教材正文素材（来源：{source_id}）：

{source_text}

请基于以上素材，提炼结构化教学知识，只输出 JSON（不要任何解释）：
{{
  "summary": "一段话知识点摘要（教师备课参考，非原文复述）",
  "knowledge_topics": ["核心知识点1", "核心知识点2", "..."],
  "teaching_hints": ["可操作的教学提示1", "教学提示2", "..."],
  "outline": [
    {{"title": "小节标题1", "points": ["要点1", "要点2"]}},
    {{"title": "小节标题2", "points": ["要点1"]}}
  ]
}}"""


def log(msg):
    print(msg, flush=True)


def _extract_recognized_text(row):
    """从 正文 JSON 中取识别文本；兼容旧字段名。返回 (text, confidence)。"""
    raw = row.get("正文", "") or ""
    try:
        obj = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return (raw, None)
    if not isinstance(obj, dict):
        return (str(obj), None)
    text = (
        obj.get("识别文本")
        or obj.get("OCR文本")
        or obj.get("课文全文")
        or obj.get("正文文本")
        or ""
    )
    conf = obj.get("识别平均置信度", obj.get("OCR平均置信度"))
    try:
        conf = float(conf) if conf not in (None, "") else None
    except Exception:
        conf = None
    return (text, conf)


def make_distill_messages(row, text):
    subject = row.get("学科", "")
    grade = row.get("年级", "")
    volume = row.get("册别", "")
    chapter = row.get("章节", "") or row.get("单元", "")
    source_id = row.get("来源标识", "")
    user_prompt = DISTILL_USER_TEMPLATE.format(
        subject=subject, grade=grade, volume=volume,
        chapter=chapter, source_id=source_id, source_text=text.strip(),
    )
    return [
        {"role": "system", "content": DISTILL_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]


def call_llm(messages, max_tokens=2000):
    resp = Generation.call(
        model=MODEL, messages=messages,
        result_format="message", max_tokens=max_tokens,
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"dashscope {resp.status_code}: {getattr(resp, 'message', 'unknown error')}"
        )
    return resp.output.choices[0].message.content


def parse_llm_response(raw):
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"response 中未找到 JSON: {raw[:300]}")
    body = raw[start:end + 1]
    body = re.sub(r",\s*([}\]])", r"\1", body)
    return json.loads(body)


def compose_distilled_text(meta, distilled):
    """蒸馏结果的嵌入文本：元数据 + 摘要 + 知识点 + 提示（不含原文）。"""
    parts = [meta]
    parts.append(distilled.get("summary", ""))
    parts.extend(distilled.get("knowledge_topics", []))
    parts.extend(distilled.get("teaching_hints", []))
    for sec in distilled.get("outline", []):
        parts.append(sec.get("title", ""))
        parts.extend(sec.get("points", []))
    return " ".join(p for p in parts if p).strip()


def iter_jsonl(path):
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def main():
    ap = argparse.ArgumentParser(description="教材原文→蒸馏结果包（本地）")
    ap.add_argument("--data-dir", required=True, help="原文库 jsonl 所在目录（本地）")
    ap.add_argument("--files", nargs="*", default=DEFAULT_FILES)
    ap.add_argument("--out", default=None, help="输出结果包路径(默认 <data-dir>/distilled_knowledge.jsonl)")
    ap.add_argument("--limit", type=int, default=0, help="最多蒸馏条数(0=全量)")
    ap.add_argument("--min-confidence", type=float, default=0.5,
                    help="低于该识别置信度的页跳过(默认0.5，噪声封面/插图不入包)")
    ap.add_argument("--batch", type=int, default=20, help="每多少条提交一次 embedding")
    args = ap.parse_args()

    out_path = args.out or os.path.join(args.data_dir, "distilled_knowledge.jsonl")
    log(f"[distill] 模型={EMBED_MODEL} 维度={EMBED_DIM} 输出={out_path}")

    buf = []
    meta_buf = []
    total = 0
    skipped = 0
    for fname in args.files:
        path = os.path.join(args.data_dir, fname)
        if not os.path.exists(path):
            log(f"[distill] 跳过不存在的文件: {path}")
            continue
        log(f"[distill] 处理 {fname} ...")
        with open(out_path, "a" if total else "w", encoding="utf-8") as out:
            for row in iter_jsonl(path):
                text, conf = _extract_recognized_text(row)
                if not text or not text.strip():
                    skipped += 1
                    continue
                if conf is not None and conf < args.min_confidence:
                    skipped += 1
                    continue
                try:
                    messages = make_distill_messages(row, text)
                    raw = call_llm(messages)
                    distilled = parse_llm_response(raw)
                except Exception as e:
                    skipped += 1
                    log(f"  ⚠ 蒸馏失败跳过: {e}")
                    continue

                meta = " ".join(
                    str(row.get(k, "") or "")
                    for k in ("学段", "学科", "年级", "册别", "版本", "单元", "章节")
                )
                record = {
                    "chunk_id": row.get("chunk_id", ""),
                    "stage": row.get("学段", "") or "",
                    "subject": row.get("学科", "") or "",
                    "grade": row.get("年级", "") or "",
                    "volume": row.get("册别", "") or "",
                    "version": row.get("版本", "") or "",
                    "new_old": row.get("新旧教材", "") or "",
                    "unit": row.get("单元", "") or "",
                    "chapter": row.get("章节", "") or "",
                    "source_type": (row.get("来源类型", "") or "").replace("(OCR)", "").replace("OCR", "").strip(),
                    "source_id": row.get("来源标识", "") or "",
                    "distilled": distilled,
                    "embedding": None,  # 稍后批量填
                    "std_clauses": (
                        json.dumps(row.get("关联课标条目", []), ensure_ascii=False)
                        if isinstance(row.get("关联课标条目"), (list, dict))
                        else str(row.get("关联课标条目", "") or "")
                    ),
                    "kg_unit": row.get("关联KG单元", "") or "",
                    "copyright": row.get("版权标识", "") or "",
                }
                buf.append(record)
                meta_buf.append(compose_distilled_text(meta, distilled))
                total += 1

                if args.limit and total >= args.limit:
                    break
                if len(buf) >= args.batch:
                    _flush_embed(buf, meta_buf, out)
                    buf, meta_buf = [], []
                    log(f"  ... 已蒸馏 {total} 条")
            if buf:
                _flush_embed(buf, meta_buf, out)
                buf, meta_buf = [], []
        if args.limit and total >= args.limit:
            break

    log(f"[distill] 完成: 蒸馏 {total} 条, 跳过 {skipped} 条 → {out_path}")


def _flush_embed(records, meta_texts, out):
    embs = embed_texts(meta_texts)
    for r, e in zip(records, embs):
        r["embedding"] = e
        out.write(json.dumps(r, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
