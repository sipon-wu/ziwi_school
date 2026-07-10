"""tb_lesson_source 向量表访问层（psycopg2，连接 school 同库 postgres）。

建表与检索都集中在这里，ai-service 既负责嵌入也负责入库与检索，
backend 只通过 /api/ai/rag/search 反向代理调用，无需直连此表。
"""
import os

import psycopg2
from psycopg2.extras import execute_values

DATABASE_URL = os.getenv("DATABASE_URL")
TABLE = "tb_lesson_source"

# 入库列与 jsonl 字段的对应（课程包/教材两表字段略有差异，缺失按空串处理）
COLUMNS = [
    "chunk_id",
    "stage",        # 学段
    "subject",      # 学科
    "grade",        # 年级
    "volume",       # 册别
    "version",      # 版本
    "new_old",      # 新旧教材
    "unit",         # 单元
    "chapter",      # 章节
    "source_type",  # 来源类型
    "source_id",    # 来源标识
    "content",      # 正文（JSON 字符串）
    "std_clauses",  # 关联课标条目
    "kg_unit",      # 关联 KG 单元
    "copyright",    # 版权标识
    "embedding",    # vector
]


def get_conn():
    return psycopg2.connect(DATABASE_URL, connect_timeout=10)


def ensure_schema(dim=1024):
    """建 vector 扩展 + tb_lesson_source 表 + HNSW 余弦索引。幂等。"""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {TABLE} (
                id BIGSERIAL PRIMARY KEY,
                chunk_id TEXT UNIQUE,
                stage TEXT,
                subject TEXT,
                grade TEXT,
                volume TEXT,
                version TEXT,
                new_old TEXT,
                unit TEXT,
                chapter TEXT,
                source_type TEXT,
                source_id TEXT,
                content TEXT,
                std_clauses TEXT,
                kg_unit TEXT,
                copyright TEXT,
                embedding vector({dim})
            );
            """
        )
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS ix_{TABLE}_embedding "
            f"ON {TABLE} USING hnsw (embedding vector_cosine_ops);"
        )
        conn.commit()
    finally:
        conn.close()


def truncate():
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"TRUNCATE TABLE {TABLE};")
        conn.commit()
    finally:
        conn.close()


def _embed_to_literal(emb):
    """list[float] -> '[...]' 字符串；已是字符串则原样返回。"""
    if emb is None:
        return None
    if isinstance(emb, str):
        return emb
    return "[" + ",".join(str(float(x)) for x in emb) + "]"


def insert_rows(rows):
    """rows: list[dict]，含 COLUMNS 全部键（embedding 为 list[float]）。

    主键冲突（重复 chunk_id）时更新，保证可重跑。
    embedding 转成 pgvector 接受的 '[...]' 字符串字面量（psycopg2 会把 list
    渲染成 PG 数组 {...}，pgvector 不认，故必须传字符串）。
    """
    conn = get_conn()
    try:
        cur = conn.cursor()
        cols = COLUMNS
        data = []
        for r in rows:
            data.append(
                tuple(
                    _embed_to_literal(r.get("embedding"))
                    if c == "embedding"
                    else (r.get(c, "") or "")
                    for c in cols
                )
            )
        # 用 format 把 embedding 列转成 vector 字面量
        col_sql = ", ".join(cols)
        placeholders = ", ".join(
            "%%s::vector" if c == "embedding" else "%%s" for c in cols
        )
        update_cols = ", ".join(
            f"{c}=EXCLUDED.{c}" for c in cols if c != "chunk_id"
        )
        sql = (
            f"INSERT INTO {TABLE} ({col_sql}) VALUES ({placeholders}) "
            f"ON CONFLICT (chunk_id) DO UPDATE SET {update_cols};"
        )
        execute_values(cur, sql, data, page_size=500)
        conn.commit()
    finally:
        conn.close()


def search(query_embedding, filters=None, top_k=5):
    """余弦检索 top-N。filters 仅用等值条件（学科/年级/册别/版本/来源类型）。"""
    filters = {k: v for k, v in (filters or {}).items() if v}
    conn = get_conn()
    try:
        cur = conn.cursor()
        conds = []
        params = []
        for col, val in filters.items():
            conds.append(f"{col} = %s")
            params.append(val)
        where = ("WHERE " + " AND ".join(conds)) if conds else ""
        vec = "[" + ",".join(str(float(x)) for x in query_embedding) + "]"
        params.append(vec)
        params.append(int(top_k))
        sql = (
            f"SELECT chunk_id, stage, subject, grade, volume, version, "
            f"source_type, source_id, unit, chapter, content, "
            f"1 - (embedding <=> %s::vector) AS similarity "
            f"FROM {TABLE} {where} ORDER BY embedding <=> %s::vector LIMIT %s;"
        )
        cur.execute(sql, params)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()
