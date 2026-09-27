"""受控编排 S0–S5 + 逐次留痕（P1，2026-09-27）

依据《0911 Skill服务化与验收防伪方案》§四 P1 与 §七 的 P1 DoD
（"真实链路跑通，留痕含工具调用参数与质检分数；断点可回放"）：

  S0 澄清 → S1 解析 → S2 取风格/资产 → S3 生成 → S4 三关质检 → S5 交付

三条硬约束（本模块就是它们的落点）：
  1. **固定六步**：步骤与顺序写在 `STEPS` 里，是**流程**而不是提示词里的建议；
  2. **LLM 只在判断点**：S0/S1/S5 纯确定性；S2 由词表+DB 完成（无 LLM）；
     LLM 只出现在 S3 生成（含返修轮）与 S4 的内容评审/红线（独立模型）；
  3. **工具调用由流程确定**：S2 **必调** `template.query` + `asset.search`，不由 Agent 自由选择；
     两次调用的**入参与结果摘要**逐次写入留痕（`tool_calls`）。

留痕去向：`ai_generation_logs`（迁移 0012；jsonb 存步骤/工具/质检），
并保留进程内副本供 `GET /api/ai/courseware/trace/{job_id}` 即时回放。
⚠ 落库失败**必须打印日志**（历史教训：审计写入被吞掉后整条链静默失效，见报告第十四轮）。
"""

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

import style_tools  # 确定性工具层（同目录；单一事实源）

logger = logging.getLogger(__name__)

PIPELINE_VERSION = "s0-s5@2026-09-27"

# 六步定义：(id, 名称, 说明)。**顺序即流程**——守卫按此断言事件顺序。
STEPS = [
    ("s0", "澄清", "确认知识面/教材边界（锚点与前置）"),
    ("s1", "解析", "解析请求要素（学段/学科/格式/发散级别）"),
    ("s2", "取风格/资产", "确定性工具层：template.query + asset.search（无 LLM）"),
    ("s3", "生成", "LLM 生成（受控发散，含返修轮）"),
    ("s4", "质检", "三关：规则质检 / 内容评审 / 红线闸"),
    ("s5", "交付", "组装响应并落库留痕"),
]
STEP_IDS = [s[0] for s in STEPS]
STEP_NAMES = {s[0]: s[1] for s in STEPS}

# 进程内留痕副本（SSE 同款单进程前提，见 api_server 的 _GEN_PROGRESS 注释）
_MEM: Dict[str, Dict[str, Any]] = {}
_MEM_MAX = 50


# ── 学段派生（确定性；S2 的工具入参需要它）──
_STAGE_RULES = (
    (("高一", "高二", "高三", "高中"), "高中"),
    (("初一", "初二", "初三", "七", "八", "九", "初中"), "初中"),
)


def stage_of(grade: str) -> str:
    """年级 → 学段（小学/初中/高中）。无法判定时返回空串（工具层各自兜底，不猜）。"""
    g = (grade or "").strip()
    for keys, stage in _STAGE_RULES:
        if any(k in g for k in keys):
            return stage
    if any(k in g for k in ("一", "二", "三", "四", "五", "六", "小学")):
        return "小学"
    return ""


def skill_meta(frontmatter: str, fmt: str = "") -> Dict[str, str]:
    """从 SKILL.md frontmatter 取 `id`/`version` —— 留痕要能回答"这次用的是哪个版本的技能"。

    原则延续（2026-09-12）：**SKILL.md 是声明，代码只是执行**；版本号必须从声明读，不在代码里写死。
    """
    def _pick(key: str) -> str:
        for line in (frontmatter or "").splitlines():
            k, _, v = line.partition(":")
            if k.strip() == key:
                return v.strip()
        return ""

    return {"skill_id": _pick("id") or f"courseware.{fmt or 'ppt'}", "skill_version": _pick("version")}


# ── 留痕对象 ──
class GenTrace:
    """一次生成的逐次留痕（步骤 / 工具调用 / 轮次 / 质检分数）。"""

    def __init__(self, job_id: str, meta: Optional[Dict[str, Any]] = None):
        self._t0 = time.time()
        self.d: Dict[str, Any] = {
            "job_id": job_id or "",
            "pipeline_version": PIPELINE_VERSION,
            "skill_id": "",
            "skill_version": "",
            "status": "running",
            "steps": [],
            "tool_calls": [],
            "rounds": [],
            "quality": {},
            "meta": {k: v for k, v in (meta or {}).items() if v not in (None, "", [], {})},
            "started_at": self._t0,
        }

    def step(self, sid: str, message: str, data: Optional[Dict[str, Any]] = None) -> str:
        if sid not in STEP_IDS:      # 步骤 id 由 STEPS 定义，写错即报（不静默收下）
            raise ValueError(f"未知流水线步骤：{sid}（合法值：{STEP_IDS}）")
        ev = {"id": sid, "name": STEP_NAMES[sid], "message": message,
              "elapsed": round(time.time() - self._t0, 1)}
        if data:
            ev["data"] = data
        self.d["steps"].append(ev)
        return message

    def round(self, attempt: int, role: str, model: str, ms: int, chars: int) -> None:
        """S3 的**每一轮**（含返修轮）都记一条 —— "逐次留痕"的最低要求。"""
        self.d["rounds"].append({"attempt": attempt, "role": role, "model": model,
                                 "ms": ms, "chars": chars})

    def tool(self, name: str, params: Dict[str, Any], result: Any, ms: int) -> None:
        self.d["tool_calls"].append({"name": name, "params": params,
                                     "result": _summarize(name, result), "ms": ms})

    def quality(self, gate: str, payload: Any) -> None:
        self.d["quality"][gate] = payload

    def finish(self, status: str = "ok") -> Dict[str, Any]:
        self.d["status"] = status
        self.d["duration_ms"] = int((time.time() - self._t0) * 1000)
        return self.d


def _summarize(name: str, result: Any) -> Dict[str, Any]:
    """工具结果摘要：**够回放、不过度膨胀**（全量结果留在响应里，留痕留关键字段+条数）。"""
    if not isinstance(result, dict):
        return {"type": type(result).__name__}
    if name == "template.query":
        return {k: result.get(k) for k in
                ("styleKey", "themeId", "templateId", "templateSource", "skeletonClass", "note")}
    if name == "asset.search":
        items = result.get("items") or []
        return {"total": result.get("total", len(items)),
                "assetIds": [i.get("assetId") for i in items[:8]],
                "dbNote": result.get("dbNote")}
    return {"keys": sorted(result.keys())[:10]}


# ── S2：取风格/资产（确定性工具层，无 LLM）──
def s2_tools(style_tag: str, subject: str, stage: str, kind: str,
             need: int = 6, scene: str = "") -> Dict[str, Any]:
    """S2 步骤：调用 `template.query` + `asset.search`，返回结果与**留痕用的入参**。

    为什么固定调这两个：风格"由模型自由发挥"会导致同风格产出漂移、也无法对账
    （见 0910 诊断"同一风格产出不一样"）。改为**平台先定骨架/资产，模型只在既定框架内组织内容**。
    """
    t_params = {"style_tag": style_tag, "stage": stage, "subject": subject, "kind": kind, "scene": scene}
    t0 = time.time()
    template = style_tools.template_query(t_params)
    t_ms = int((time.time() - t0) * 1000)

    a_params = {"styleId": template.get("styleKey") or style_tag, "stage": stage,
                "subject": subject, "need": need, "scene": scene, "kind": kind}
    t1 = time.time()
    assets = style_tools.asset_search(a_params)
    a_ms = int((time.time() - t1) * 1000)

    items = assets.get("items") or []
    return {
        "template_params": t_params, "template": template, "template_ms": t_ms,
        "asset_params": a_params, "assets": assets, "asset_ms": a_ms,
        "styleKey": template.get("styleKey") or "",
        "themeId": template.get("themeId") or "",
        "skeletonClass": template.get("skeletonClass") or "",
        "templateId": template.get("templateId"),
        "templateSource": template.get("templateSource") or "",
        "assetCount": len(items),
        "assetIds": [i.get("assetId") for i in items],
    }


# ── S0/S1：纯确定性步骤的数据（供留痕与 SSE 中间态）──
def s0_scope(scope_meta: Dict[str, Any], kp_names: List[str], prereq_names: List[str],
             unit: str, textbook_version: str, consult_answers: str) -> Dict[str, Any]:
    anchors = scope_meta.get("anchors") or [{"id": "", "name": n} for n in kp_names]
    return {
        "anchors": [{"id": a.get("id", ""), "name": a.get("name", "")} for a in anchors],
        "prerequisite": prereq_names,
        "unit": unit or "",
        "textbook_version": textbook_version or "",
        "consult_answered": bool((consult_answers or "").strip()),
    }


def s1_parse(subject: str, grade: str, title: str, fmt: str, divergence_level: str,
             edge_enabled: bool, extra: str) -> Dict[str, Any]:
    return {
        "subject": subject, "grade": grade, "title": title, "format": fmt,
        "stage": stage_of(grade), "divergence_level": divergence_level,
        "edge_enabled": bool(edge_enabled), "extra_requirements": extra or "",
    }


# ── 落库与读取（断点可回放）──
def persist(trace: Dict[str, Any]) -> bool:
    """写 `ai_generation_logs`（DB）并留进程内副本。失败返回 False 且**打印日志**（不静默）。"""
    job = trace.get("job_id") or ""
    if job:
        if len(_MEM) >= _MEM_MAX:
            for k in sorted(_MEM, key=lambda x: _MEM[x].get("started_at") or 0)[:10]:
                _MEM.pop(k, None)
        _MEM[job] = trace

    try:
        import psycopg2  # 与 style_tools/kg_store 同源
    except Exception as e:
        logger.warning("[trace] psycopg2 不可用，留痕仅存内存（job=%s）：%s", job, e)
        return False
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        logger.warning("[trace] 未配置 DATABASE_URL，留痕仅存内存（job=%s）", job)
        return False
    try:
        conn = psycopg2.connect(dsn, connect_timeout=5)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO ai_generation_logs
                         (job_id, school_id, user_id, skill_id, skill_version, pipeline_version,
                          steps, tool_calls, rounds, quality, status, duration_ms)
                       VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb,%s::jsonb,%s,%s)""",
                    (
                        job,
                        (trace.get("meta") or {}).get("school_id"),
                        (trace.get("meta") or {}).get("user_id"),
                        trace.get("skill_id") or "",
                        trace.get("skill_version") or "",
                        trace.get("pipeline_version") or "",
                        json.dumps(trace.get("steps") or [], ensure_ascii=False),
                        json.dumps(trace.get("tool_calls") or [], ensure_ascii=False),
                        json.dumps(trace.get("rounds") or [], ensure_ascii=False),
                        json.dumps(trace.get("quality") or {}, ensure_ascii=False),
                        trace.get("status") or "",
                        int(trace.get("duration_ms") or 0),
                    ),
                )
            conn.commit()
            return True
        finally:
            conn.close()
    except Exception as e:
        logger.warning("[trace] 留痕落库失败（job=%s）：%s", job, e)
        return False


def fetch_trace(job_id: str) -> Optional[Dict[str, Any]]:
    """按 job_id 取留痕：DB 优先（可长期回放），失败回落进程内副本。"""
    if not job_id:
        return None
    dsn = os.getenv("DATABASE_URL")
    if dsn:
        try:
            import psycopg2
            conn = psycopg2.connect(dsn, connect_timeout=5)
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT job_id, school_id, user_id, skill_id, skill_version, pipeline_version,
                                  steps, tool_calls, rounds, quality, status, duration_ms, created_at
                             FROM ai_generation_logs WHERE job_id = %s
                            ORDER BY created_at DESC LIMIT 1""",
                        (job_id,),
                    )
                    row = cur.fetchone()
                if row:
                    return {
                        "job_id": row[0], "school_id": row[1], "user_id": row[2],
                        "skill_id": row[3], "skill_version": row[4], "pipeline_version": row[5],
                        "steps": row[6] or [], "tool_calls": row[7] or [], "rounds": row[8] or [],
                        "quality": row[9] or {}, "status": row[10],
                        "duration_ms": row[11], "created_at": row[12].isoformat() if row[12] else "",
                        "source": "db",
                    }
            finally:
                conn.close()
        except Exception as e:
            logger.warning("[trace] 留痕读取失败（回落内存，job=%s）：%s", job_id, e)
    mem = _MEM.get(job_id)
    if mem:
        return {**mem, "source": "memory"}
    return None
