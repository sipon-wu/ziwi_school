#!/usr/bin/env python3
"""
教材 / 诗教原文 V2 分级蒸馏脚本

读取 DB 中 source_type='教材-正文页' 和 '小度诗教-课文正文' 的行，
按 unique work（教材标题/课文 + 版本 + 年级）分组 → LLM 分类 A/B/C/D →
B/D 蒸馏为结构化 JSON → UPDATE content 保留 embedding 不变。

环境变量：
  DATABASE_URL        PostgreSQL 连接串（默认读 ai-service 容器内 DATABASE_URL）
  DATA_DIR            原料文件目录，默认 /data
  A_C_STORE_ORIGINAL  1=将 A/C 类原文写回 content；0=SaaS 合规，仅保留元数据+摘要（默认 0）
  CLASSIFY_ONLY       1=只分类统计，不更新 DB
  BATCH_SIZE          DB 更新批次大小（默认 500）
  SLEEP_CLASSIFY      分类 LLM 调用间隔秒（默认 0.5）
  SLEEP_DISTILL       蒸馏 LLM 调用间隔秒（默认 0.5）
  MAX_SAMPLE_LEN      每组送 LLM 的典型原文最大长度（默认 1200）
"""

import json
import os
import re
import sys
import time
import traceback
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------
DATA_DIR = os.environ.get("DATA_DIR", "/data")
DB_URL = os.environ.get("DATABASE_URL")
A_C_STORE_ORIGINAL = os.environ.get("A_C_STORE_ORIGINAL", "0") == "1"
CLASSIFY_ONLY = os.environ.get("CLASSIFY_ONLY", "0") == "1"
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "500"))
SLEEP_CLASSIFY = float(os.environ.get("SLEEP_CLASSIFY", "0.5"))
SLEEP_DISTILL = float(os.environ.get("SLEEP_DISTILL", "0.5"))
MAX_SAMPLE_LEN = int(os.environ.get("MAX_SAMPLE_LEN", "1200"))
MAX_GROUPS = os.environ.get("MAX_GROUPS")
MAX_GROUPS = int(MAX_GROUPS) if MAX_GROUPS else None

DEFAULT_MODEL = os.environ.get("LLM_MODEL", "qwen-turbo")
MAX_TOKENS_CLASSIFY = 800
MAX_TOKENS_DISTILL = 2000

SOURCE_TEXTBOOK = os.environ.get("SOURCE_TEXTBOOK", "教材-正文页")
SOURCE_POEM = os.environ.get("SOURCE_POEM", "小度诗教-课文正文")
TARGET_SOURCE_TYPES = (SOURCE_TEXTBOOK, SOURCE_POEM)

TEXTBOOK_FILE = os.environ.get("TEXTBOOK_FILE", os.path.join(DATA_DIR, "底料_教材正文.jsonl"))
POEM_FILE = os.environ.get("POEM_FILE", os.path.join(DATA_DIR, "底料_小度诗教.jsonl"))


# ---------------------------------------------------------------------------
# LLM 调用（自包含，避免 import FastAPI 启动副作用）
# ---------------------------------------------------------------------------
def _call_llm(messages: list, model: str = DEFAULT_MODEL, max_tokens: int = 2000, retries: int = 5) -> str:
    try:
        from dashscope import Generation
    except ImportError as e:
        raise RuntimeError("dashscope SDK 未安装") from e

    last_err = None
    for attempt in range(retries):
        try:
            resp = Generation.call(
                model=model,
                messages=messages,
                result_format="message",
                max_tokens=max_tokens,
            )
            if resp.status_code == 200:
                return resp.output.choices[0].message.content
            # 429 / 500 等可重试
            last_err = f"dashscope {resp.status_code}: {getattr(resp, 'message', 'unknown')}"
        except Exception as e:
            last_err = str(e)

        wait = min(2 ** attempt, 60)
        print(f"[LLM retry {attempt + 1}/{retries}] {last_err}, sleep {wait}s", file=sys.stderr)
        time.sleep(wait)

    raise RuntimeError(f"LLM 调用失败: {last_err}")


def _extract_json(text: str, context: str = "") -> dict:
    """从 LLM 返回中尝试提取 JSON 对象；失败时打印原始片段以便排查。"""
    original = text
    text = text.strip()
    # 去掉 markdown code block
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
        text = text.strip()

    # 先尝试整个文本
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 再尝试第一个 { ... } 块（非贪婪，避免跨多个对象）
    for m in re.finditer(r"\{[\s\S]*?\}", text):
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            continue

    # 兜底：把 "key": "value" 行包裹成对象再解析
    try:
        pairs = re.findall(r'"([^"]+)"\s*:\s*("[^"]*"|\[[^\]]*\]|true|false|null|\d+(?:\.\d+)?)', text)
        if pairs:
            obj = {}
            for k, v in pairs:
                try:
                    obj[k] = json.loads(v)
                except json.JSONDecodeError:
                    obj[k] = v.strip('"')
            if "class" in obj or "knowledge_points" in obj:
                return obj
    except Exception:
        pass

    snippet = original[:300].replace("\n", "\\n")
    ctx = f" [{context}]" if context else ""
    print(f"[WARN] JSON 提取失败{ctx}: {snippet}", file=sys.stderr)
    raise ValueError("无法从 LLM 返回中提取 JSON")


# ---------------------------------------------------------------------------
# 分类
# ---------------------------------------------------------------------------
CLASSIFY_PROMPT = """你是一名精通中小学教材版权与内容分类的专家。

请将以下教材/课文片段按下列规则归类为 A/B/C/D 四类之一：
- A：原始古典作品（古诗文、文言文、古典名著原文等，已进入公有领域）
- B：教材改编作品（出版社为适应课标/年级对原作进行的改写、节选、注释、现代汉语翻译或课文改写）
- C：公有领域现代文（1911 年前或作者去世超过 50 年的现代汉语作品原文）
- D：保护期内现代文（近现代作者原创、仍在著作权保护期内的作品原文）

判断依据：文本内容、语言风格、是否像课文/教材改写、是否含出版社注释/课后题/识字要求等。

必须只返回一个 JSON 对象，不要任何解释、不要 markdown 代码块、不要多余文字。严格使用如下格式（包含大括号）：
{{"class": "A/B/C/D", "confidence": "高/中/低", "reason": "一句话理由", "original_work_title": "作品名", "original_work_author": "作者", "adaptation_note": "B类填教材版本年级，其他留空"}}

待分类文本（节选自《{work_title}》，{subject}{grade}{version}）：
---
{sample}
---
"""


def classify_work(work_title: str, sample: str, subject: str, grade: str, version: str) -> dict:
    prompt = CLASSIFY_PROMPT.format(
        work_title=work_title,
        subject=subject or "",
        grade=grade or "",
        version=version or "",
        sample=sample[:MAX_SAMPLE_LEN],
    )
    raw = _call_llm([{"role": "user", "content": prompt}], DEFAULT_MODEL, MAX_TOKENS_CLASSIFY)
    result = _extract_json(raw, context=f"classify {work_title}")
    # 标准化字段
    result.setdefault("class", "B")
    result.setdefault("original_work_title", work_title)
    result.setdefault("original_work_author", "")
    result.setdefault("adaptation_note", "")
    return result


# ---------------------------------------------------------------------------
# 蒸馏
# ---------------------------------------------------------------------------
DISTILL_PROMPT = """你是一名资深教研员，请将以下教材/课文内容蒸馏为结构化教学知识摘要，用于教师备课和 AI 生成题目/课件/教案。

要求：
1. 不保留原文连续词句；
2. 提取出知识点、生字（语文低年级）、教学要求、能力目标、简短摘要；
3. 摘要需通顺、信息完整，可直接被教师阅读。

必须只返回一个 JSON 对象，不要任何解释、不要 markdown 代码块、不要多余文字。格式如下（包含大括号）：
{{"knowledge_points": ["知识点1", "知识点2"], "new_chars": ["生字第1", "生字第2"], "teaching_requirements": "朗读识字、理解内容、能够复述...", "abilities": ["观察力", "语言表达"], "summary": "本课/本篇为...，知识点包括...，教学要求为..."}}

待蒸馏内容（节选自《{work_title}》，{subject}{grade}{version}；分类为 {class_label} 类）：
---
{sample}
---
"""


def distill_work(work_title: str, sample: str, subject: str, grade: str, version: str, class_label: str) -> dict:
    prompt = DISTILL_PROMPT.format(
        work_title=work_title,
        subject=subject or "",
        grade=grade or "",
        version=version or "",
        class_label=class_label,
        sample=sample[:MAX_SAMPLE_LEN],
    )
    raw = _call_llm([{"role": "user", "content": prompt}], DEFAULT_MODEL, MAX_TOKENS_DISTILL)
    result = _extract_json(raw, context=f"distill {work_title}")
    # 标准化字段
    result.setdefault("knowledge_points", [])
    result.setdefault("new_chars", [])
    result.setdefault("teaching_requirements", "")
    result.setdefault("abilities", [])
    result.setdefault("summary", "")
    return result


# ---------------------------------------------------------------------------
# 数据加载
# ---------------------------------------------------------------------------
def load_sources() -> dict[str, dict]:
    """加载原料文件，返回 chunk_id -> {source_type, subject, grade, version, unit, chapter, work_title, text}。"""
    sources: dict[str, dict] = {}

    def _parse_textbook_body(body: dict) -> str:
        # 识别文本可能是字符串或嵌套 JSON 字符串
        raw_text = body.get("识别文本", "")
        if isinstance(raw_text, str):
            try:
                parsed = json.loads(raw_text)
                if isinstance(parsed, str):
                    return parsed
                return str(parsed)
            except json.JSONDecodeError:
                return raw_text
        return str(raw_text)

    def _parse_poem_body(body: dict) -> str:
        return body.get("课文全文", "")

    files = [
        (TEXTBOOK_FILE, SOURCE_TEXTBOOK, _parse_textbook_body, "教材标题"),
        (POEM_FILE, SOURCE_POEM, _parse_poem_body, None),
    ]

    for path, stype, body_parser, title_key in files:
        if not os.path.exists(path):
            print(f"[WARN] 原料文件不存在: {path}", file=sys.stderr)
            continue
        print(f"[LOAD] {path} ...")
        count = 0
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                chunk_id = row.get("chunk_id")
                if not chunk_id:
                    continue

                body_raw = row.get("正文", "{}")
                if isinstance(body_raw, str):
                    try:
                        body = json.loads(body_raw)
                    except json.JSONDecodeError:
                        body = {}
                else:
                    body = body_raw or {}

                text = body_parser(body)
                # work_title 优先从正文里取教材标题；否则取章节
                if title_key:
                    work_title = body.get(title_key) or row.get("章节") or "未命名"
                else:
                    work_title = row.get("章节") or "未命名"

                sources[chunk_id] = {
                    "chunk_id": chunk_id,
                    "source_type": stype,
                    "stage": row.get("学段"),
                    "subject": row.get("学科"),
                    "grade": row.get("年级"),
                    "volume": row.get("册别"),
                    "version": row.get("版本"),
                    "unit": row.get("单元"),
                    "chapter": row.get("章节"),
                    "work_title": work_title,
                    "text": text,
                }
                count += 1
        print(f"[LOAD] {path} 读取 {count} 条")

    return sources


# ---------------------------------------------------------------------------
# DB 操作
# ---------------------------------------------------------------------------
def get_db_conn():
    url = DB_URL
    if not url:
        raise RuntimeError("DATABASE_URL 未设置")
    return psycopg2.connect(url)


def fetch_target_rows(conn) -> list[dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, chunk_id, shard_key, source_type, subject, grade, version, unit, chapter, content
            FROM tb_lesson_source
            WHERE source_type IN %s
            ORDER BY source_type, chunk_id
            """,
            (TARGET_SOURCE_TYPES,),
        )
        rows = cur.fetchall()
    return [dict(r) for r in rows]


def group_rows_by_work(source_map: dict[str, dict], db_rows: list[dict]) -> dict[tuple, dict]:
    """按 unique work 分组：source_type + subject + grade + version + work_title。"""
    works: dict[tuple, dict] = defaultdict(
        lambda: {"chunks": [], "samples": [], "meta": {}}
    )

    for r in db_rows:
        chunk_id = r.get("chunk_id")
        src = source_map.get(chunk_id)
        if not src:
            continue

        work_title = src["work_title"]
        key = (r["source_type"], r.get("subject") or "", r.get("grade") or "", r.get("version") or "", work_title)

        w = works[key]
        w["chunks"].append(r)
        if src.get("text"):
            w["samples"].append(src["text"])
        if not w["meta"]:
            w["meta"] = {
                "source_type": r["source_type"],
                "subject": r.get("subject") or "",
                "grade": r.get("grade") or "",
                "version": r.get("version") or "",
                "work_title": work_title,
                "unit": r.get("unit") or "",
                "chapter": r.get("chapter") or "",
            }

    return dict(works)


def build_content_payload(class_info: dict, distill_info: dict | None, sample_text: str) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    payload: dict[str, Any] = {
        "class": class_info.get("class", "B"),
        "distilled": distill_info is not None,
        "distilled_at": now,
        "original_work_title": class_info.get("original_work_title", ""),
        "original_work_author": class_info.get("original_work_author", ""),
        "adaptation_note": class_info.get("adaptation_note", ""),
    }

    if distill_info:
        payload.update({
            "knowledge_points": distill_info.get("knowledge_points", []),
            "new_chars": distill_info.get("new_chars", []),
            "teaching_requirements": distill_info.get("teaching_requirements", ""),
            "abilities": distill_info.get("abilities", []),
            "summary": distill_info.get("summary", ""),
        })
    else:
        # A/C 类：SaaS 模式下不写原文，仅保留摘要/元数据
        if A_C_STORE_ORIGINAL:
            payload["original_text"] = sample_text[:1200]
        else:
            payload["summary"] = f"《{class_info.get('original_work_title', '')}》{class_info.get('original_work_author', '')}（{class_info.get('class', '')}类作品，原文未入 SaaS 库）"

    return payload


def update_content_batch(conn, updates: list[tuple[int, str, str, dict]]):
    """批量更新 content（保留 embedding）。updates: (id, shard_key, chunk_id, payload)。"""
    if not updates:
        return 0
    with conn.cursor() as cur:
        args = []
        for id_, shard_key, _chunk_id, payload in updates:
            args.append((json.dumps(payload, ensure_ascii=False), id_, shard_key))
        cur.executemany(
            "UPDATE tb_lesson_source SET content = %s WHERE id = %s AND shard_key = %s",
            args,
        )
    conn.commit()
    return len(updates)


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main():
    if not DB_URL:
        print("[ERROR] DATABASE_URL 环境变量未设置", file=sys.stderr)
        sys.exit(1)

    print(f"[START] {datetime.now().isoformat()}")
    print(f"[CONFIG] A_C_STORE_ORIGINAL={A_C_STORE_ORIGINAL}, CLASSIFY_ONLY={CLASSIFY_ONLY}, BATCH_SIZE={BATCH_SIZE}")

    source_map = load_sources()
    print(f"[INFO] 原料文件共 {len(source_map)} 条")

    conn = get_db_conn()
    try:
        db_rows = fetch_target_rows(conn)
        print(f"[INFO] DB 目标行共 {len(db_rows)} 条")

        works = group_rows_by_work(source_map, db_rows)
        print(f"[INFO] 去重后 unique works 共 {len(works)} 组")

        stats = {"A": 0, "B": 0, "C": 0, "D": 0, "errors": 0, "distilled": 0, "updated": 0}
        updates: list[tuple[int, str, str, dict]] = []

        for idx, (key, w) in enumerate(works.items(), 1):
            if MAX_GROUPS and idx > MAX_GROUPS:
                print(f"[TEST] 达到 MAX_GROUPS={MAX_GROUPS}，提前结束")
                break
            meta = w["meta"]
            chunks = w["chunks"]
            samples = w["samples"]
            sample_text = "\n\n".join(samples[:3])[:MAX_SAMPLE_LEN * 2]
            if not sample_text:
                sample_text = "（无可用原文片段）"

            work_title = meta["work_title"]
            print(f"[{idx}/{len(works)}] {work_title} ({len(chunks)} chunks)")

            try:
                class_info = classify_work(
                    work_title,
                    sample_text,
                    meta["subject"],
                    meta["grade"],
                    meta["version"],
                )
            except Exception as e:
                print(f"  [ERROR] 分类失败: {e}", file=sys.stderr)
                traceback.print_exc()
                stats["errors"] += 1
                continue

            cls = class_info.get("class", "B")
            if cls not in stats:
                cls = "B"
            stats[cls] += 1
            print(f"  class={cls}, confidence={class_info.get('confidence', '?')}, reason={class_info.get('reason', '')}")

            if CLASSIFY_ONLY:
                time.sleep(SLEEP_CLASSIFY)
                continue

            distill_info = None
            if cls in ("B", "D"):
                try:
                    distill_info = distill_work(
                        work_title,
                        sample_text,
                        meta["subject"],
                        meta["grade"],
                        meta["version"],
                        cls,
                    )
                    stats["distilled"] += 1
                except Exception as e:
                    print(f"  [ERROR] 蒸馏失败: {e}", file=sys.stderr)
                    stats["errors"] += 1
                    continue

            payload = build_content_payload(class_info, distill_info, sample_text)
            for ch in chunks:
                # 幂等：若已有 distilled=true 则跳过（第一次跑不存在，后续重跑安全）
                existing = ch.get("content") or ""
                if existing.startswith("{"):
                    try:
                        existing_dict = json.loads(existing)
                        if existing_dict.get("distilled") and existing_dict.get("class"):
                            continue
                    except json.JSONDecodeError:
                        pass
                updates.append((ch["id"], ch["shard_key"], ch["chunk_id"], payload))

            # 每批提交
            if len(updates) >= BATCH_SIZE:
                n = update_content_batch(conn, updates)
                stats["updated"] += n
                print(f"  [BATCH] 提交 {n} 条，累计 {stats['updated']}")
                updates = []

            time.sleep(SLEEP_CLASSIFY)

        # 尾部提交
        if updates:
            n = update_content_batch(conn, updates)
            stats["updated"] += n
            print(f"  [BATCH] 提交 {n} 条，累计 {stats['updated']}")

        print("\n[REPORT]")
        print(f"  分类分布: A={stats['A']} B={stats['B']} C={stats['C']} D={stats['D']}")
        print(f"  蒸馏组数: {stats['distilled']}")
        print(f"  更新行数: {stats['updated']}")
        print(f"  错误数: {stats['errors']}")
        print(f"[END] {datetime.now().isoformat()}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
