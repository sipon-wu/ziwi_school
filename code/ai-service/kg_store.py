"""知识图谱访问层（psycopg2，与 backend 同一 Postgres）。

ai-service 在生成教案 / 课件 / 习题 / 组卷时，需要：
  - 将前端传入的知识点 ID 解析为「名称 + 前置知识点名称」，
    保证生成内容严格落在所选知识点及其前置范围内（知识面约束）。
  - 将所选知识点映射到对应课标条目（tb_standard_clause，经 tb_version_standard_map），
    用于「课标备注」呈现（不污染正式产出正文）。
  - 组卷时按知识点/题型从题库（questions）抽取题目，并做班级级排重。

表结构由 backend 的 GORM AutoMigrate + 迁移脚本保证存在。
"""
import os
import json

import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL")


def get_conn():
    return psycopg2.connect(DATABASE_URL, connect_timeout=10)


def _fetchall(cur, sql, params):
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def resolve_knowledge_scope(node_ids):
    """将知识点 ID 列表解析为 {selected:[名称], prerequisites:[名称]}。

    - selected：所选知识点名称（ming_cheng）
    - prerequisites：所选知识点的前置知识点名称（qian_zhi 字段，已存为 JSON 数组；
      若为空则用 parent_id 向上追溯一级单元/父知识点作为兜底）
    返回的名称去重、保序，供生成提示词约束「知识面」。
    """
    if not node_ids:
        return {"selected": [], "prerequisites": []}
    try:
        conn = get_conn()
        try:
            cur = conn.cursor()
            # 解析所选节点
            placeholders = ",".join(["%s"] * len(node_ids))
            rows = _fetchall(
                cur,
                f"SELECT id, ming_cheng, qian_zhi, parent_id FROM tb_kg_node WHERE id IN ({placeholders})",
                tuple(str(i) for i in node_ids),
            )
            selected = []
            prereq_names = []
            parent_ids = []
            for r in rows:
                name = (r.get("ming_cheng") or "").strip()
                if name and name not in selected:
                    selected.append(name)
                qz = r.get("qian_zhi")
                if isinstance(qz, str) and qz:
                    try:
                        qz = json.loads(qz)
                    except Exception:
                        qz = []
                if isinstance(qz, list):
                    for x in qz:
                        x = str(x).strip()
                        if x and x not in prereq_names and x not in selected:
                            prereq_names.append(x)
                pid = r.get("parent_id")
                if pid and pid not in parent_ids:
                    parent_ids.append(pid)
            # 兜底：用 parent_id 追溯父节点名称作为前置
            if parent_ids:
                pplace = ",".join(["%s"] * len(parent_ids))
                prows = _fetchall(
                    cur,
                    f"SELECT ming_cheng FROM tb_kg_node WHERE id IN ({pplace})",
                    tuple(str(i) for i in parent_ids),
                )
                for pr in prows:
                    nm = (pr.get("ming_cheng") or "").strip()
                    if nm and nm not in prereq_names and nm not in selected:
                        prereq_names.append(nm)
            return {"selected": selected, "prerequisites": prereq_names}
        finally:
            conn.close()
    except Exception as e:
        import sys
        sys.stderr.write(f"[kg_store] resolve_knowledge_scope ERROR: {e}\n")
        sys.stderr.flush()
        return {"selected": [], "prerequisites": []}


def map_curriculum(codes, subject="", grade=""):
    """将所选知识点的课标编码映射为备注条目，返回 [{code, path, text}]（不污染正文）。

    优先用前端直传的 curriculum_code（来自知识图谱静态数据）；若有 DB 则补全条目路径与正文。
    仅作「建议关联」备注，避免虚假精确；前端以备注/角标呈现。
    """
    if not codes:
        return []
    out = []
    try:
        conn = get_conn()
        try:
            cur = conn.cursor()
            for c in codes:
                c = str(c or "").strip()
                if not c:
                    continue
                item = {"code": c, "path": "", "text": ""}
                try:
                    rows = _fetchall(
                        cur,
                        "SELECT tiao_mu_lu_jing, zheng_wen FROM tb_standard_clause WHERE ye_zi_bian_hao=%s OR ye_zi_bian_hao=%s LIMIT 1",
                        (c, c.upper()),
                    )
                    if rows:
                        item["path"] = rows[0].get("tiao_mu_lu_jing") or ""
                        item["text"] = (rows[0].get("zheng_wen") or "")[:120]
                except Exception:
                    pass
                out.append(item)
        finally:
            conn.close()
    except Exception as e:
        import sys
        sys.stderr.write(f"[kg_store] map_curriculum ERROR: {e}\n")
        sys.stderr.flush()
        # DB 不可用时仍返回编码作为备注
        out = [{"code": str(c), "path": "", "text": ""} for c in codes if c]
    return out


def list_bank_questions(subject, grade, knowledge_names, types=None, limit=60, exclude_ids=None):
    """从题库（questions）按 学科/年级/知识点名称/题型 抽取题目，供组卷优先使用。

    - knowledge_names：知识点名称列表（与 questions.knowledge_nodes 的 JSON 文本做 LIKE 匹配）
    - types：题型 id 过滤（可选）
    - exclude_ids：已选用题 ID（去重，避免与已选/同班已布置重复）
    返回 dict 列表（与生成题目结构对齐的字段子集）。
    """
    if not subject or not grade:
        return []
    try:
        conn = get_conn()
        try:
            cur = conn.cursor()
            sql = "SELECT id, stem, answer, analysis, question_type, score, knowledge_nodes, difficulty, source FROM questions WHERE subject=%s AND grade=%s AND status='active'"
            params = [subject, grade]
            if types:
                tplace = ",".join(["%s"] * len(types))
                sql += f" AND question_type IN ({tplace})"
                params.extend(types)
            if exclude_ids:
                eplace = ",".join(["%s"] * len(exclude_ids))
                sql += f" AND id NOT IN ({eplace})"
                params.extend([str(i) for i in exclude_ids])
            sql += " ORDER BY use_count ASC, created_at DESC LIMIT %s"
            params.append(int(limit))
            rows = _fetchall(cur, sql, tuple(params))
            result = []
            for r in rows:
                kn = r.get("knowledge_nodes")
                if isinstance(kn, str) and kn:
                    try:
                        kn = json.loads(kn)
                    except Exception:
                        kn = []
                # 知识点命中过滤（名称包含其一即可）
                hit = True
                if knowledge_names:
                    kn_names = [str(x) for x in (kn or [])]
                    hit = any(any(nm in (k or "") for k in kn_names) for nm in knowledge_names) or \
                          any(any(k in nm for k in kn_names) for nm in knowledge_names)
                if not hit:
                    continue
                result.append({
                    "id": str(r.get("id")),
                    "type": r.get("question_type"),
                    "stem": r.get("stem") or "",
                    "answer": r.get("answer") or "",
                    "analysis": r.get("analysis") or "",
                    "difficulty": r.get("difficulty") or "L2",
                    "knowledge_points": kn or [],
                    "score": float(r.get("score") or 0),
                    "source": r.get("source") or "bank",
                })
            return result
        finally:
            conn.close()
    except Exception as e:
        import sys
        sys.stderr.write(f"[kg_store] list_bank_questions ERROR: {e}\n")
        sys.stderr.flush()
        return []
