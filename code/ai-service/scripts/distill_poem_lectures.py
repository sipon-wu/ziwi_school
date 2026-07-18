#!/usr/bin/env python3
"""诗教数据 → tb_lesson_lecture 蒸馏脚本。

读取 tb_lesson_source 中所有诗教行（source_type 含 '小度诗教'），
按 (grade, chapter) 分组为"课"，每课调用 LLM 生成标准讲义，
写入 tb_lesson_lecture，并更新 tb_lesson_source 的 lecture_id / 清空 content。

用法（ai-service 容器内，已配 DASHSCOPE_API_KEY + DATABASE_URL）：
    python scripts/distill_poem_lectures.py
    python scripts/distill_poem_lectures.py --limit 10   # 试跑
"""
import argparse
import json
import os
import re
import sys
import time
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import dashscope
from dashscope import Generation

dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")
MODEL = "qwen-turbo"

from vector_store import (  # noqa: E402
    get_conn,
    TABLE,
    ensure_lecture_schema,
    migrate_add_lecture_id,
    insert_lecture,
    update_source_lecture_id,
)

DISTILL_SYSTEM_PROMPT = """你是一位资深中小学语文教研员，正在为一线教师生成结构化教学讲义。
你的输出是「教学讲义」——供教师备课参考用的教学组织文档，不是课文原文复述。
要求：
1. 用自己的语言组织教学内容，不得直接复制原文长句或连续表述
2. 关注"怎么教"而不是"原文怎么写的"
3. 内容覆盖教学目标、重难点、教学过程、课堂提问、文化拓展
4. 语言简洁、具体、可操作，适合教师直接参考使用"""

DISTILL_USER_TEMPLATE = """以下是一篇课文《{title}》（{grade}）的教学素材，包含课文正文及其他辅助教学资料：

{source_texts}

请基于以上素材，生成一份结构化教学讲义，只输出 JSON 格式（不要任何解释）：

{{
  "teaching_objectives": ["教学目标1", "教学目标2", "..."],
  "key_difficult_points": {{
    "key": ["教学重点1", "教学重点2"],
    "difficult": ["教学难点1"]
  }},
  "teaching_process": [
    {{"stage": "导入（或课堂起始）", "content": "导入环节设计"}},
    {{"stage": "新授", "content": "新知识讲授环节设计"}},
    {{"stage": "巩固", "content": "课堂巩固练习设计"}},
    {{"stage": "小结", "content": "课堂总结设计"}}
  ],
  "classroom_questions": ["课堂提问1", "课堂提问2", "..."],
  "cultural_extension": "文化拓展或知识延伸"
}}"""


def log(msg):
    print(msg, flush=True)


def fetch_poem_rows():
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"""
            SELECT chunk_id, grade, unit, chapter, source_type, content, copyright
            FROM {TABLE}
            WHERE source_type LIKE '%%小度诗教%%'
            ORDER BY grade, chapter, source_type;
        """)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


def group_by_lesson(rows):
    groups = defaultdict(list)
    for r in rows:
        groups[(r["grade"], r["chapter"])].append(r)
    return groups


def make_distill_messages(grade, chapter, rows):
    title = chapter
    source_parts = []
    for r in rows:
        stype = r["source_type"]
        try:
            body = json.loads(r["content"])
        except (json.JSONDecodeError, TypeError):
            body = {"raw": str(r.get("content", ""))[:500]}

        if stype == "小度诗教-课文正文":
            txt = body.get("课文全文", "")
            if not txt:
                txt = json.dumps(body, ensure_ascii=False)[:600]
        elif stype == "小度诗教-背景资料":
            k = next((k for k in body if "背景" in k), None)
            txt = body.get(k, "") if k else json.dumps(body, ensure_ascii=False)[:400]
        else:
            txt = json.dumps(body, ensure_ascii=False)[:500]

        source_parts.append(f"[{stype}]\n{txt.strip()}")

    source_texts = "\n\n".join(source_parts)
    user_prompt = DISTILL_USER_TEMPLATE.format(
        title=title, grade=grade, source_texts=source_texts
    )
    return [
        {"role": "system", "content": DISTILL_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]


def call_llm(messages, max_tokens=3000):
    resp = Generation.call(
        model=MODEL,
        messages=messages,
        result_format="message",
        max_tokens=max_tokens,
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"dashscope {resp.status_code}: {getattr(resp, 'message', 'unknown error')}"
        )
    return resp.output.choices[0].message.content


def parse_llm_response(raw):
    """从 LLM 返回中提取 JSON 对象。找第一个 { 和最后一个 }，清理尾部逗号。"""
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"response 中未找到 JSON: {raw[:300]}")
    body = raw[start:end + 1]
    # 清理 JSON 中尾部逗号（如 "a",] -> "a"]）
    body = re.sub(r",\s*([}\]])", r"\1", body)
    return json.loads(body)


def lesson_key_of(grade, chapter):
    safe = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff_-]", "_", chapter.strip())
    return f"yw_{grade}_{safe}"


def main():
    parser = argparse.ArgumentParser(description="诗教数据→tb_lesson_lecture蒸馏")
    parser.add_argument("--limit", type=int, default=0, help="试跑课数")
    parser.add_argument("--no-update-source", action="store_true", help="仅生成讲义不更新源表")
    args = parser.parse_args()

    log("[distill] 确保讲义表 schema...")
    ensure_lecture_schema()
    migrate_add_lecture_id()

    log("[distill] 读取诗教数据...")
    rows = fetch_poem_rows()
    log(f"  → 共 {len(rows)} 行")

    groups = group_by_lesson(rows)
    log(f"  → 共 {len(groups)} 课")

    lessons = sorted(groups.items(), key=lambda x: x[0])
    if args.limit:
        lessons = lessons[: args.limit]

    ok = fail = 0
    total = len(lessons)
    for idx, ((grade, chapter), group_rows) in enumerate(lessons, 1):
        lkey = lesson_key_of(grade, chapter)
        try:
            log(f"[distill] [{idx}/{total}] {grade} {chapter} ({len(group_rows)}行)...")

            messages = make_distill_messages(grade, chapter, group_rows)
            raw = call_llm(messages)
            lecture_dict = parse_llm_response(raw)

            lecture_record = {
                "lesson_key": lkey,
                "subject": "语文",
                "grade": grade,
                "unit": group_rows[0].get("unit", ""),
                "chapter": chapter,
                "title": chapter,
                "lecture": lecture_dict,
                "source_type": "poem_teaching",
                "source_ids": [r["chunk_id"] for r in group_rows],
                "textbook_version_ids": [],
                "knowledge_node_ids": [],
                "standard_clause_ids": [],
                "original_text_status": "replaced_by_lecture",
            }
            lecture_id = insert_lecture(lecture_record)

            if not args.no_update_source:
                chunk_ids = [r["chunk_id"] for r in group_rows]
                update_source_lecture_id(chunk_ids, lecture_id)

            ok += 1
            log(f"  ✅ lecture_id={lecture_id[:8]}...")
            time.sleep(0.5)

        except Exception as e:
            fail += 1
            log(f"  ❌ {e}")

    log(f"\n[distill] 完成: 成功 {ok}, 失败 {fail}, 共 {total} 课")


if __name__ == "__main__":
    main()
