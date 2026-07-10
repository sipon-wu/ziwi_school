#!/usr/bin/env python3
"""备课包/教材底料 -> tb_lesson_source 向量入库（text-embedding-v3 / 1024 维）。

用法（在 ai-service 容器内，已具备 DASHSCOPE_API_KEY + DATABASE_URL）：
    python scripts/ingest_lesson_source.py --data-dir /data --no-truncate
    python scripts/ingest_lesson_source.py --data-dir /data --limit 200   # 试跑

默认先 TRUNCATE 再全量写入（幂等可重跑）；--no-truncate 用于增量追加。
--files 可指定只处理某些文件（默认 底料_课程包_全.jsonl + 底料_教材_全.jsonl）。
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from embeddings import embed_texts, EMBED_DIM  # noqa: E402
from vector_store import ensure_schema, truncate, insert_rows, COLUMNS  # noqa: E402

DEFAULT_FILES = ["底料_课程包_全.jsonl", "底料_教材_全.jsonl"]


def compose_text(row):
    """把元数据 + 正文字段拼成一段可嵌入的文本。

    正文是 JSON 字符串，展平其值为可读文本；元数据（学科/年级/册别/版本/单元/章节）
    前置，提升按教学维度检索的召回质量。
    """
    meta = " ".join(
        str(row.get(k, "") or "")
        for k in ("学段", "学科", "年级", "册别", "版本", "单元", "章节")
    )
    raw = row.get("正文", "") or ""
    try:
        obj = json.loads(raw)
        if isinstance(obj, dict):
            flat = " ".join(str(v) for v in obj.values() if v)
        else:
            flat = str(obj)
    except Exception:
        flat = raw
    return (meta + " " + flat).strip()


def row_to_record(row):
    """把 jsonl 一行映射为与 COLUMNS 对齐的 dict（embedding 留空，稍后批量填）。"""
    return {
        "chunk_id": row.get("chunk_id", ""),
        "stage": row.get("学段", "") or "",
        "subject": row.get("学科", "") or "",
        "grade": row.get("年级", "") or "",
        "volume": row.get("册别", "") or "",
        "version": row.get("版本", "") or "",
        "new_old": row.get("新旧教材", "") or "",
        "unit": row.get("单元", "") or "",
        "chapter": row.get("章节", "") or "",
        "source_type": row.get("来源类型", "") or "",
        "source_id": row.get("来源标识", "") or "",
        "content": row.get("正文", "") or "",
        "std_clauses": (
            json.dumps(row.get("关联课标条目", []), ensure_ascii=False)
            if isinstance(row.get("关联课标条目"), (list, dict))
            else str(row.get("关联课标条目", "") or "")
        ),
        "kg_unit": row.get("关联KG单元", "") or "",
        "copyright": row.get("版权标识", "") or "",
        "embedding": None,
    }


def iter_jsonl(path):
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", required=True, help="jsonl 所在目录")
    ap.add_argument("--files", nargs="*", default=DEFAULT_FILES)
    ap.add_argument("--limit", type=int, default=0, help="每个文件最多处理条数(0=全量)")
    ap.add_argument("--batch", type=int, default=200, help="每多少条提交一次 DB + 嵌入")
    ap.add_argument("--no-truncate", action="store_true", help="不先清空表(增量追加)")
    args = ap.parse_args()

    print(f"[ingest] 模型={embeddings_model()} 维度={EMBED_DIM}")
    ensure_schema(EMBED_DIM)
    if not args.no_truncate:
        print("[ingest] TRUNCATE tb_lesson_source ...")
        truncate()

    total = 0
    for fname in args.files:
        path = os.path.join(args.data_dir, fname)
        if not os.path.exists(path):
            print(f"[ingest] 跳过不存在的文件: {path}")
            continue
        print(f"[ingest] 处理 {fname} ...")
        buf = []
        n = 0
        for row in iter_jsonl(path):
            buf.append(row_to_record(row))
            n += 1
            if args.limit and n >= args.limit:
                break
            if len(buf) >= args.batch:
                _flush(buf)
                total += len(buf)
                buf = []
                print(f"  ... 已处理 {total} 条")
        if buf:
            _flush(buf)
            total += len(buf)
        print(f"[ingest] {fname} 完成，累计 {total} 条")

    print(f"[ingest] 全部完成，共写入 {total} 条。")


def _flush(records):
    texts = [compose_text(r) for r in records]
    embs = embed_texts(texts)
    for r, e in zip(records, embs):
        r["embedding"] = e
    insert_rows(records)


def embeddings_model():
    from embeddings import EMBED_MODEL

    return EMBED_MODEL


if __name__ == "__main__":
    main()
