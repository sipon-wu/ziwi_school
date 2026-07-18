#!/usr/bin/env python3
"""回写 tb_lesson_source: 按匹配规则将 诗教 2559 行的 lecture_id 指向 tb_lesson_lecture。"""
import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from vector_store import get_conn, TABLE, LECTURE_TABLE

def lesson_key_of(grade, chapter):
    safe = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff_-]", "_", chapter.strip())
    return f"yw_{grade}_{safe}"

conn = get_conn()
cur = conn.cursor()

# 读所有诗教行
cur.execute(f"SELECT chunk_id, grade, chapter FROM {TABLE} WHERE source_type LIKE '%小度诗教%'")
rows = cur.fetchall()
print(f"诗教行: {len(rows)}")

# 读所有讲义 key→id 映射
cur.execute(f"SELECT lesson_key, id FROM {LECTURE_TABLE}")
lec_map = {r[0]: str(r[1]) for r in cur.fetchall()}
print(f"讲义: {len(lec_map)} 条")

ok = 0
skip = 0
for chunk_id, grade, chapter in rows:
    lk = lesson_key_of(grade, chapter)
    lid = lec_map.get(lk)
    if lid:
        cur.execute(f"UPDATE {TABLE} SET lecture_id = %s::uuid, content = '' WHERE chunk_id = %s", (lid, chunk_id))
        ok += 1
    else:
        skip += 1
        print(f"  SKIP: {grade} {chapter} -> {lk} (讲义不存在)")

conn.commit()
conn.close()
print(f"更新: {ok} 行, 跳过: {skip}")
