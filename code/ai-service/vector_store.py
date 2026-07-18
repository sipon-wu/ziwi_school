"""tb_lesson_source 向量表访问层（psycopg2，连接 school 同库 postgres）。

建表与检索都集中在这里，ai-service 既负责嵌入也负责入库与检索，
backend 只通过 /api/ai/rag/search 反向代理调用，无需直连此表。

预分片改造（2026-07）：
- 表按 (grade, subject, version) 计算 shard_key 做 HASH 分区，每片独立 HNSW 索引；
  检索时先按 shard_key 裁剪分片，再在分片内按 unit(±1) 过滤，最后语义排序取 top-N。
- 唯一约束含分区键 (chunk_id, shard_key)，保证幂等 upsert。
- 退化方案：pgvector < 0.5 不支持分区 HNSW 时退回单表 + btree(grade,subject,version,unit)
  + 向量顺序扫描（单分片/单年级学科版本数据量小，性能可接受）。
"""
import os
import re

import psycopg2
from psycopg2.extras import execute_values

DATABASE_URL = os.getenv("DATABASE_URL")
TABLE = "tb_lesson_source"
LECTURE_TABLE = "tb_lesson_lecture"
PARTITION_COUNT = 32  # 固定 32 个 HASH 分片，免维护、无需为每个组合预建分区

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

# insert 时在 COLUMNS 之后追加的分片/排序辅助列
AUX_COLUMNS = ["shard_key", "unit_seq"]


def get_conn():
    return psycopg2.connect(DATABASE_URL, connect_timeout=10)


def shard_key_of(grade, subject, version):
    """分片键表达式，写入与检索必须完全一致。"""
    return f"{grade}|{subject}|{version}"


def _unit_seq(unit: str):
    """从单元字段提取可比序号（如 '第一单元'/'Unit 1'/'第3单元' -> 1/1/3）。

    提取失败返回 None，检索时退化为 unit 等值匹配。
    """
    if not unit:
        return None
    m = re.search(r"(\d+)", unit)
    return int(m.group(1)) if m else None


def _pgvector_version(cur):
    try:
        cur.execute("SELECT extversion FROM pg_extension WHERE extname='vector';")
        row = cur.fetchone()
        return row[0] if row else "0.0.0"
    except Exception:
        return "0.0.0"


def _version_ge(ver, min_ver):
    def parse(v):
        nums = re.findall(r"\d+", v)[:3]
        return [int(x) for x in nums] if nums else [0]

    try:
        a, b = parse(ver), parse(min_ver)
        return a >= b
    except Exception:
        return False


def _table_columns_sql(dim):
    return f"""
        id BIGSERIAL,
        chunk_id TEXT,
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
        lecture_id UUID,
        shard_key TEXT,
        unit_seq INT,
        embedding vector({dim})
    """


def ensure_schema(dim=1024):
    """建 vector 扩展 + tb_lesson_source 表（分区或单表回退）+ 索引。幂等。

    幂等迁移策略：若已是分区父表，直接返回（保留已灌数据）；
    否则（旧单表或不存在）DROP 重建为分区表。重建会清空旧数据，
    全量入库步骤（ingest 默认 TRUNCATE 后全灌）会紧接其后，故安全。
    """
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cur.execute(
            "SELECT EXISTS ("
            "SELECT 1 FROM pg_partitioned_table p "
            "JOIN pg_class c ON c.oid = p.partrelid WHERE c.relname = %s);",
            (TABLE,),
        )
        if cur.fetchone()[0]:
            conn.commit()
            # 已有分区表：仅做 lecture 相关迁移
            migrate_add_lecture_id()
            ensure_lecture_schema()
            return  # 保留数据

        ver = _pgvector_version(cur)
        if _version_ge(ver, "0.5.0"):
            _create_partitioned(cur, dim)
        else:
            _create_single(cur, dim)
        conn.commit()
        ensure_lecture_schema()
    finally:
        conn.close()


def _create_partitioned(cur, dim):
    cur.execute(f"DROP TABLE IF EXISTS {TABLE} CASCADE;")
    cur.execute(
        f"""
        CREATE TABLE {TABLE} (
            {_table_columns_sql(dim)},
            PRIMARY KEY (id, shard_key),
            UNIQUE (chunk_id, shard_key)
        ) PARTITION BY HASH (shard_key);
        """
    )
    for r in range(PARTITION_COUNT):
        pname = f"{TABLE}_p{r:02d}"
        cur.execute(
            f"CREATE TABLE {pname} PARTITION OF {TABLE} "
            f"FOR VALUES WITH (MODULUS {PARTITION_COUNT}, REMAINDER {r});"
        )
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS ix_{pname}_embedding "
            f"ON {pname} USING hnsw (embedding vector_cosine_ops);"
        )


def _create_single(cur, dim):
    """pgvector < 0.5 回退：单表 + btree(grade,subject,version,unit) + 向量顺序扫描。"""
    cur.execute(f"DROP TABLE IF EXISTS {TABLE} CASCADE;")
    cur.execute(
        f"""
        CREATE TABLE {TABLE} (
            {_table_columns_sql(dim)},
            PRIMARY KEY (id),
            UNIQUE (chunk_id, shard_key)
        );
        """
    )
    cur.execute(
        f"CREATE INDEX IF NOT EXISTS ix_{TABLE}_shard "
        f"ON {TABLE} (grade, subject, version, unit);"
    )


# ── tb_lesson_lecture（讲义表） ────────────────────────────────────────


def ensure_lecture_schema():
    """建 tb_lesson_lecture 表（幂等）。"""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS {LECTURE_TABLE} (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                lesson_key VARCHAR(255) NOT NULL,
                subject VARCHAR(100) NOT NULL,
                grade VARCHAR(50) NOT NULL,
                unit VARCHAR(255),
                chapter VARCHAR(255),
                title VARCHAR(255) NOT NULL,
                lecture JSONB NOT NULL,
                source_type VARCHAR(50) NOT NULL,
                source_ids TEXT[],
                textbook_version_ids UUID[],
                knowledge_node_ids UUID[],
                standard_clause_ids UUID[],
                original_text_status VARCHAR(20) DEFAULT 'replaced_by_lecture',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        cur.execute(f"""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_lecture_lesson_key
            ON {LECTURE_TABLE} (lesson_key);
        """)
        conn.commit()
    finally:
        conn.close()


def migrate_add_lecture_id():
    """为 tb_lesson_source 加 lecture_id 列（幂等）。"""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{TABLE}' AND column_name = 'lecture_id'
                ) THEN
                    ALTER TABLE {TABLE} ADD COLUMN lecture_id UUID REFERENCES {LECTURE_TABLE}(id);
                END IF;
            END $$;
        """)
        conn.commit()
    finally:
        conn.close()


def insert_lecture(lecture_data: dict) -> str:
    """插入一条讲义记录，返回 id（UUID 字符串）。"""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cols = [
            "lesson_key", "subject", "grade", "unit", "chapter", "title",
            "lecture", "source_type", "source_ids",
            "textbook_version_ids", "knowledge_node_ids", "standard_clause_ids",
            "original_text_status",
        ]
        placeholders = ", ".join("%s" for _ in cols)
        col_list = ", ".join(cols)
        # ON CONFLICT 只更新 lecture 和 source_ids
        sql = f"""
            INSERT INTO {LECTURE_TABLE} ({col_list})
            VALUES ({placeholders})
            ON CONFLICT (lesson_key) DO UPDATE SET
                lecture = EXCLUDED.lecture,
                source_ids = EXCLUDED.source_ids,
                updated_at = NOW()
            RETURNING id;
        """
        # lecture 是 dict，用 psycopg2 自动转 JSONB
        from psycopg2.extras import Json
        vals = [
            lecture_data.get("lesson_key", ""),
            lecture_data.get("subject", ""),
            lecture_data.get("grade", ""),
            lecture_data.get("unit", ""),
            lecture_data.get("chapter", ""),
            lecture_data.get("title", ""),
            Json(lecture_data.get("lecture", {})),
            lecture_data.get("source_type", ""),
            lecture_data.get("source_ids", []),
            lecture_data.get("textbook_version_ids", []),
            lecture_data.get("knowledge_node_ids", []),
            lecture_data.get("standard_clause_ids", []),
            lecture_data.get("original_text_status", "replaced_by_lecture"),
        ]
        cur.execute(sql, vals)
        rid = cur.fetchone()[0]
        conn.commit()
        return str(rid)
    finally:
        conn.close()


def update_source_lecture_id(chunk_ids: list, lecture_id: str):
    """将一批 tb_lesson_source 行的 lecture_id 设为指定值，清空 content。"""
    if not chunk_ids:
        return
    conn = get_conn()
    try:
        cur = conn.cursor()
        for cid in chunk_ids:
            cur.execute(
                f"UPDATE {TABLE} SET lecture_id = %s::uuid, content = '' WHERE chunk_id = %s;",
                (lecture_id, cid),
            )
        conn.commit()
    finally:
        conn.close()


def retrieve_lecture(lecture_id: str) -> dict | None:
    """按 lecture_id 获取讲义。"""
    if not lecture_id:
        return None
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT * FROM {LECTURE_TABLE} WHERE id = %s::uuid;",
            (lecture_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        cols = [d[0] for d in cur.description]
        return dict(zip(cols, row))
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

    自动补 shard_key(由 grade/subject/version 推导) 与 unit_seq(由 unit 推导)，
    主键冲突（重复 chunk_id + 分片键）时更新，保证可重跑。
    embedding 转成 pgvector 接受的 '[...]' 字符串字面量（psycopg2 会把 list
    渲染成 PG 数组 {...}，pgvector 不认，故必须传字符串）。
    """
    conn = get_conn()
    try:
        cur = conn.cursor()
        cols = list(COLUMNS) + list(AUX_COLUMNS)
        data = []
        for r in rows:
            shard_key = r.get("shard_key") or shard_key_of(
                r.get("grade", "") or "",
                r.get("subject", "") or "",
                r.get("version", "") or "",
            )
            unit_seq = r.get("unit_seq")
            if unit_seq is None:
                unit_seq = _unit_seq(r.get("unit", "") or "")
            values = []
            for c in COLUMNS:
                if c == "embedding":
                    values.append(_embed_to_literal(r.get("embedding")))
                else:
                    values.append(r.get(c, "") or "")
            values.append(shard_key)
            values.append(unit_seq)
            data.append(tuple(values))
        col_sql = ", ".join(cols)
        # execute_values 只接受单一 %s 占位符（负责把整行 tuple 展开），
        # 每列的占位/类型转换用 template 定义（embedding 列需 ::vector）。
        template = "(" + ", ".join(
            "%s::vector" if c == "embedding" else "%s" for c in cols
        ) + ")"
        # 按 (chunk_id, shard_key) 去重（保留末次），避免同批重复键；
        # 分区表 + HNSW 索引下 ON CONFLICT DO UPDATE 会触发
        # "cannot affect row a second time"，故改用 DO NOTHING（全量重灌
        # 是 TRUNCATE 后重插，DO NOTHING 与 upsert 等价且幂等安全）。
        seen = {}
        for t in data:
            key = (t[0], t[len(COLUMNS)])  # chunk_id 索引0, shard_key 索引=len(COLUMNS)
            seen[key] = t
        data = list(seen.values())
        sql = (
            f"INSERT INTO {TABLE} ({col_sql}) VALUES %s "
            f"ON CONFLICT (chunk_id, shard_key) DO NOTHING;"
        )
        execute_values(cur, sql, data, template=template, page_size=500)
        conn.commit()
    finally:
        conn.close()


def search(query_embedding, filters=None, top_k=5):
    """余弦检索 top-N。filters 仅用等值条件（学科/年级/册别/版本/来源类型/单元/章节）。"""
    filters = {k: v for k, v in (filters or {}).items() if v}
    conn = get_conn()
    try:
        cur = conn.cursor()
        conds = []
        where_params = []
        for col, val in filters.items():
            conds.append(f"{col} = %s")
            where_params.append(val)
        where = ("WHERE " + " AND ".join(conds)) if conds else ""
        vec = "[" + ",".join(str(float(x)) for x in query_embedding) + "]"
        # params 顺序须与 sql 中 %s 出现顺序一致：similarity -> where -> orderby -> limit
        params = [vec] + where_params + [vec, int(top_k)]
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


def retrieve_boundary(query_embedding, subject, grade, version, unit="", extend=True, top_k=5):
    """按教材知识边界检索：先按 (grade,subject,version) 裁剪分片，再在分片内
    按 unit(±1) 过滤，最后按 query 余弦排序取 top-N。

    - query_embedding: 已向量化的查询（课时标题 + 知识点），由调用方 embed。
    - extend=True 允许拓展到上一/下一单元（契合「锚点-轨道」受控发散）；
      若 unit 无法提取可比序号，则退化为仅当前 unit 等值。
    返回 [{chunk_id, subject, grade, unit, chapter, content, similarity, ...}]。
    """
    conn = get_conn()
    try:
        cur = conn.cursor()
        shard_key = shard_key_of(grade, subject, version)
        conds = ["shard_key = %s"]
        where_params = [shard_key]
        if unit:
            seq = _unit_seq(unit)
            if seq is not None:
                if extend:
                    conds.append("unit_seq BETWEEN %s AND %s")
                    where_params += [seq - 1, seq + 1]
                else:
                    conds.append("unit_seq = %s")
                    where_params.append(seq)
            else:
                conds.append("unit = %s")
                where_params.append(unit)
        where = "WHERE " + " AND ".join(conds)
        vec = "[" + ",".join(str(float(x)) for x in query_embedding) + "]"
        # params 顺序须与 sql 中 %s 出现顺序一致：similarity -> where -> orderby -> limit
        params = [vec] + where_params + [vec, int(top_k)]
        sql = (
            f"SELECT chunk_id, stage, subject, grade, volume, version, "
            f"source_type, source_id, unit, chapter, content, std_clauses, "
            f"kg_unit, copyright, lecture_id, "
            f"1 - (embedding <=> %s::vector) AS similarity "
            f"FROM {TABLE} {where} ORDER BY embedding <=> %s::vector LIMIT %s;"
        )
        cur.execute(sql, params)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


def retrieve_by_kg_unit(kg_unit, subject, grade, exclude_chunk_id=None, top_k=3):
    """按 kg_unit 查找同单元下有 lecture_id 或非空 content 的邻近行。

    用于 _boundary_block 2-pass：被命中的行原文已清除时，跳转同单元下
    其他有内容的行来提供上下文。
    """
    if not kg_unit:
        return []
    conn = get_conn()
    try:
        cur = conn.cursor()
        shard_key = shard_key_of(grade, subject, "")
        params = [shard_key, kg_unit]
        excl = ""
        if exclude_chunk_id:
            excl = "AND chunk_id != %s"
            params.append(exclude_chunk_id)
        sql = f"""
            SELECT chunk_id, stage, subject, grade, volume, version,
                   source_type, source_id, unit, chapter, content, std_clauses,
                   kg_unit, copyright, lecture_id
            FROM {TABLE}
            WHERE shard_key = %s
              AND kg_unit = %s
              {excl}
              AND (lecture_id IS NOT NULL OR (content IS NOT NULL AND content != ''))
            ORDER BY lecture_id NULLS LAST
            LIMIT %s;
        """
        params.append(int(top_k))
        cur.execute(sql, params)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()
