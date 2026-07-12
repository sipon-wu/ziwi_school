"""materials 素材库访问层（psycopg2，连接与 backend 相同的 Postgres）。

ai-service 在生成教案 / 课件时，需要检索素材库以：
  - 按相关度推荐适合挂载到本课件的素材（AI 决定挂载）
  - 找出与当前课最相近的已有素材，作为“生成新版本”的参照

表结构由 backend 的 GORM AutoMigrate 保证存在列：
  id, school_id, name, type, tag, url, content, subject, grade, created_at
（迁移脚本里的 title/material_type/file_url 为历史列，这里统一用模型列。）
"""
import os

import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL")
TABLE = "materials"


def get_conn():
    return psycopg2.connect(DATABASE_URL, connect_timeout=10)


def list_materials(school_id=None, limit=200):
    """列出素材库素材（可按学校过滤）。返回 dict 列表。"""
    import sys
    conn = get_conn()
    try:
        cur = conn.cursor()
        if school_id:
            cur.execute(
                f"SELECT id, school_id, name, type, tag, url, content "
                f"FROM {TABLE} WHERE school_id = %s ORDER BY created_at DESC LIMIT %s",
                (school_id, int(limit)),
            )
        else:
            cur.execute(
                f"SELECT id, school_id, name, type, tag, url, content "
                f"FROM {TABLE} ORDER BY created_at DESC LIMIT %s",
                (int(limit),),
            )
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        sys.stderr.write(f"[materials_store] list_materials school_id={school_id} -> {len(rows)} rows\n")
        sys.stderr.flush()
        return rows
    except Exception as e:
        sys.stderr.write(f"[materials_store] list_materials ERROR school_id={school_id}: {e}\n")
        sys.stderr.flush()
        return []
    finally:
        conn.close()


def rank_materials(materials, lesson_title, subject, grade, top_k=3):
    """按文本相关度对素材打分，返回 top_k 个 {id, name, type, score}。

    打分规则（轻量、可解释，不依赖向量）：
      - 学科/年级完全匹配：+5 / +3
      - 课题去修饰后整体出现在素材名中：+5
      - 素材名是课题的子串（素材名更短）：+3
      - 课题关键字（≥2字）命中素材名/标签：每个 +3 / +2
    """
    import re
    raw = (lesson_title or "").replace("《", "").replace("》", "")
    # 去掉括号及其中修饰（如“（AI挂载实测）”）得到核心课题名
    base = re.sub(r"[（(].*?[)）]", "", raw).strip() or raw.strip()
    title_keys = [k for k in re.split(r"[\s，,。、]+", base) if len(k) >= 2]
    scored = []
    for m in materials:
        score = 0
        mname = (m.get("name") or "").lower()
        mtag = (m.get("tag") or "").lower()
        msubj = (m.get("subject") or "")
        mgrade = (m.get("grade") or "")
        if subject and msubj == subject:
            score += 5
        if grade and mgrade == grade:
            score += 3
        # 核心课题名出现在素材名中
        if base and base.lower() in mname:
            score += 5
        # 素材名是课题（含修饰）的子串，反向包含
        if mname and mname in raw.lower():
            score += 3
        for k in title_keys:
            kl = k.lower()
            if kl and kl in mname:
                score += 3
            if kl and kl in mtag:
                score += 2
        if score > 0:
            scored.append({
                "id": m.get("id"),
                "name": m.get("name"),
                "type": m.get("type"),
                "url": m.get("url"),
                "score": score,
            })
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]
