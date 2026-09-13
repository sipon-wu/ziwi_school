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
        return {"selected": [], "selected_ids": [], "prerequisites": [],
                "prerequisite_ids": [], "prereq_source": "none"}
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
            selected_ids = []
            prereq_names = []
            prereq_ids = []
            parent_ids = []
            for r in rows:
                name = (r.get("ming_cheng") or "").strip()
                if name and name not in selected:
                    selected.append(name)
                if r.get("id") is not None:
                    selected_ids.append(str(r.get("id")))
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
                            # qian_zhi 现为名称数组；若某元素是纯数字则兼容视为实体 ID
                            if x.isdigit():
                                prereq_ids.append(x)
                pid = r.get("parent_id")
                if pid and pid not in parent_ids:
                    parent_ids.append(pid)
            # 溯源：前置到底来自「前置链」还是「父节点兜底」——决定这份课件可不可复现
            qian_zhi_count = len(prereq_names)
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
            prereq_source = ("qian_zhi" if qian_zhi_count
                             else ("parent_id" if prereq_names else "none"))
            return {
                "selected": selected,
                # ↓ 溯源新增（2026-09-13）：向后兼容，老调用方仍只读 selected/prerequisites
                "selected_ids": selected_ids,
                "prerequisites": prereq_names,
                "prerequisite_ids": prereq_ids,
                "prereq_source": prereq_source,
                "parent_ids": [str(p) for p in parent_ids],
            }
        finally:
            conn.close()
    except Exception as e:
        import sys
        sys.stderr.write(f"[kg_store] resolve_knowledge_scope ERROR: {e}\n")
        sys.stderr.flush()
        return {"selected": [], "selected_ids": [], "prerequisites": [],
                "prerequisite_ids": [], "prereq_source": "error"}


def list_kg_nodes(version_id=None, dan_yuan=None, q=None, level=None, limit=300):
    """按「教材版本 / 单元 / 关键词 / 层级」列出知识点节点（供前端选择器**直接读 DB**）。

    为什么必须加这个接口（2026-09-13，链路验收查实）：
      前端选择器此前读的是**前端静态 JSON**（`public/knowledge-graph.json`：168 个节点、
      字符串 ID 形如 `m-1-1-1`、只覆盖数学/语文/物理），而后端生成时查的是**本库 tb_kg_node**
      （5552 个节点、int64 ID、含单元层级）——**两个数据源 ID 体系完全不同**，
      于是「前端选中的 ID」在后端**永远查不到** → 前置链/知识面约束在真实操作下**从未生效**
      （用手工查库的 int64 ID 测试才会"看起来通"）。本接口把选择器的数据源统一到本库。
      **ID 一致之后，前置链、课标映射、单元归属、生成配方溯源才全部成立。**

    额外收获：tb_kg_node 自带 `version_id`（教材版本实体）与 `dan_yuan`（单元），
    因此一次查询即得「教材版本 + 单元 + 知识点」三层**实体引用**，可直接作为生成配方的溯源字段。

    返回每项：{id(字符串), name, unit, version_id, level, parent_id, parent_name, prerequisites[]}
    —— prerequisites = qian_zhi ∪ {父节点名}（与 resolve_knowledge_scope 的口径一致）。
    """
    sql_where = []
    params = []
    if version_id:
        sql_where.append("n.version_id = %s")
        params.append(version_id)
    if dan_yuan:
        sql_where.append("n.dan_yuan = %s")
        params.append(dan_yuan)
    if q:
        sql_where.append("n.ming_cheng ILIKE %s")
        params.append(f"%{q}%")
    if level is not None:
        sql_where.append("n.level = %s")
        params.append(level)
    where = ("WHERE " + " AND ".join(sql_where)) if sql_where else ""
    sql = (
        "SELECT n.id, n.ming_cheng, n.dan_yuan, n.version_id, n.level, n.qian_zhi, n.parent_id, "
        "       p.ming_cheng AS parent_name "
        "FROM tb_kg_node n LEFT JOIN tb_kg_node p ON p.id = n.parent_id "
        f"{where} ORDER BY n.dan_yuan NULLS FIRST, n.id LIMIT %s"
    )
    params.append(max(1, min(2000, int(limit or 300))))
    out = []
    try:
        conn = get_conn()
        try:
            cur = conn.cursor()
            for r in _fetchall(cur, sql, tuple(params)):
                qz = r.get("qian_zhi")
                if isinstance(qz, str) and qz:
                    try:
                        qz = json.loads(qz)
                    except Exception:
                        qz = []
                prereq = []
                if isinstance(qz, list):
                    for x in qz:
                        x = str(x).strip()
                        if x and x not in prereq:
                            prereq.append(x)
                pname = (r.get("parent_name") or "").strip()
                if pname and pname not in prereq:
                    prereq.append(pname)
                name = (r.get("ming_cheng") or "").strip()
                prereq = [x for x in prereq if x != name]
                out.append({
                    "id": str(r.get("id")),
                    "name": name,
                    "unit": r.get("dan_yuan") or "",
                    "version_id": str(r.get("version_id")) if r.get("version_id") is not None else "",
                    "level": r.get("level"),
                    "parent_id": str(r.get("parent_id")) if r.get("parent_id") is not None else "",
                    "parent_name": pname,
                    "prerequisites": prereq,
                })
        finally:
            conn.close()
    except Exception as e:
        import sys
        sys.stderr.write(f"[kg_store] list_kg_nodes ERROR: {e}\n")
        sys.stderr.flush()
    return out


def list_kg_units(version_id=None, limit=200):
    """列出单元（dan_yuan）及其节点数，供前端单元下拉。返回 [{unit, count}]。"""
    params = []
    where = ""
    if version_id:
        where = "WHERE version_id = %s"
        params.append(version_id)
    sql = (
        "SELECT dan_yuan AS unit, count(*) AS cnt FROM tb_kg_node "
        f"{where} GROUP BY dan_yuan HAVING dan_yuan IS NOT NULL AND dan_yuan <> '' "
        "ORDER BY dan_yuan LIMIT %s"
    )
    params.append(max(1, min(500, int(limit or 200))))
    out = []
    try:
        conn = get_conn()
        try:
            cur = conn.cursor()
            for r in _fetchall(cur, sql, tuple(params)):
                out.append({"unit": r.get("unit") or "", "count": int(r.get("cnt") or 0)})
        finally:
            conn.close()
    except Exception as e:
        import sys
        sys.stderr.write(f"[kg_store] list_kg_units ERROR: {e}\n")
        sys.stderr.flush()
    return out


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
