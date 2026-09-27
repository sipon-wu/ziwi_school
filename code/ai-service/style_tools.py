"""确定性工具层（P0-b · 2026-09-27）

依据《0911 Skill服务化与验收防伪方案》§三 / §七 P0-b：
  · `template.query`：`{style_tag, stage, subject, scene?, kind}` → `{templateId, themeId, styleDNA, skeletonClass}`
  · `asset.search`  ：`{styleId, stage, subject, need, scene?}` → `[{assetId, url, params}]`
  · **纯确定性**：词表映射 / 匹配度排序，**不调 LLM**（LLM 只出现在 S0/S2兜底/S3/S4）。
  · 契约（§3.2）：① 渲染只读快照（不读 template_id）② `skeletonClass` 必须真实驱动版式几何
    ③ **资产只存形状**：`asset.search` 返回的 params 不含色值，颜色由 styleDNA 在渲染时填入。

⚠ 单一事实源边界（重要，勿踩"两处存两处漂移"的老坑）：
  · **风格/结构语汇**的权威源是前端 `code/frontend/src/lib/styleRegistry.ts`（STYLES + STYLE_STRUCTURE）。
    本文件是它的**镜像**（Python 要服务端可用）—— 漂移由守卫 `qa/verify_style_tools.cjs` 逐字段对账，
    任何一边改了另一边没跟上 → 守卫**变红**。
  · **主题配色**不在此复制：`theme_id` 只是引用，色值仍由前端 `pptThemes.ts` 的 CwTheme 解析（与 0008 迁移注释同口径）。
  · **模板库**权威源是 DB 表 `courseware_templates`（迁移 0008）；当前该表**尚无数据**（"模板外移"未完成），
    故 `template.query` 返回 `templateSource='style-default'` 并**如实**说明"未命中模板库"，**不伪造 templateId**。
  · **素材库**权威源是 DB 表 `materials`（公共装饰元件：`user_id=''` + category ∈ decor_element/decor_component）。

路由（由 api_server.py 注册）：
  POST /api/ai/courseware/tools/template.query
  POST /api/ai/courseware/tools/asset.search
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

# ────────────────────────────────────────────────
# 镜像：风格表（对齐 styleRegistry.ts 的 STYLES）
# font 用**语义 token**（kai/song/hei/yahei）而非 CSS 字体栈：栈是渲染端的事，
# 服务端只需要"用哪种字体"这个决定（守卫按 TS 常量名 F_KAI→kai 对账）。
# ────────────────────────────────────────────────
STYLE_SPECS: Dict[str, Dict[str, Any]] = {
    "china":    {"label": "国风", "prefixes": ["zgf-"],          "h5Layout": "china",    "morph": {"density": "tight",  "motion": "calm",     "motif": "classroom"}, "decor": "china",    "font": "kai",   "themeId": "zgf-ink-wash"},
    "minimal":  {"label": "素净", "prefixes": ["min-"],          "h5Layout": "minimal",  "morph": {"density": "normal", "motion": "calm",     "motif": "classroom"}, "decor": "minimal",  "font": "yahei", "themeId": "min-classic-blue"},
    "tech":     {"label": "科技", "prefixes": ["te-"],           "h5Layout": "tech",     "morph": {"density": "tight",  "motion": "energetic", "motif": "urban"},     "decor": "tech",     "font": "hei",   "themeId": "te-quantum-blue"},
    "fresh":    {"label": "清新", "prefixes": ["fr-"],           "h5Layout": "fresh",    "morph": {"density": "loose",  "motion": "lively",   "motif": "nature"},    "decor": "fresh",    "font": "yahei", "themeId": "fr-mint"},
    "academic": {"label": "严谨", "prefixes": ["aca-"],          "h5Layout": "academic", "morph": {"density": "normal", "motion": "lively",   "motif": "classroom"}, "decor": "academic", "font": "song",  "themeId": "aca-edu-blue"},
    "cartoon":  {"label": "卡通", "prefixes": ["sp-cartoon", "sp-"], "h5Layout": "cartoon", "morph": {"density": "loose", "motion": "energetic", "motif": "playful"},  "decor": "special",  "font": "yahei", "themeId": "sp-cartoon"},
    "flat":     {"label": "扁平", "prefixes": [],                "h5Layout": "basic",    "morph": {"density": "normal", "motion": "lively",   "motif": "playful"},   "decor": "gradient", "font": "yahei", "themeId": "min-geo"},
    "business": {"label": "商务", "prefixes": [],                "h5Layout": "basic",    "morph": {"density": "normal", "motion": "calm",     "motif": "classroom"}, "decor": "warm",     "font": "kai",   "themeId": "min-navy-intellectual"},
    "basic":    {"label": "通用", "prefixes": ["basic"],         "h5Layout": "basic",    "morph": {"density": "normal", "motion": "lively",   "motif": "playful"},   "decor": "minimal",  "font": "yahei", "themeId": "min-classic-blue"},
}

# 镜像：结构语汇（对齐 styleRegistry.ts 的 STYLE_STRUCTURE）——"风格管形"的形就落在这里
STYLE_STRUCTURE: Dict[str, Dict[str, Any]] = {
    "china":    {"gutter": 0.18, "rail": "scroll", "texture": "none", "corner": "seal",     "titleStyle": "centerRule", "radius": 4,  "border": "hairline", "mark": "dash"},
    "tech":     {"gutter": 0.05, "rail": "index",  "texture": "grid", "corner": "triangle", "titleStyle": "block",      "radius": 2,  "border": "thickLeft", "mark": "square"},
    "minimal":  {"gutter": 0.26, "rail": "none",   "texture": "none", "corner": "none",     "titleStyle": "underline",  "radius": 0,  "border": "hairline", "mark": "none"},
    "academic": {"gutter": 0.08, "rail": "rule",   "texture": "none", "corner": "none",     "titleStyle": "underline",  "radius": 2,  "border": "hairline", "mark": "square"},
    "fresh":    {"gutter": 0.12, "rail": "none",   "texture": "dots", "corner": "none",     "titleStyle": "plain",      "radius": 16, "border": "none",     "mark": "dot"},
    "cartoon":  {"gutter": 0.10, "rail": "none",   "texture": "dots", "corner": "none",     "titleStyle": "block",      "radius": 24, "border": "none",     "mark": "dot"},
    "flat":     {"gutter": 0.10, "rail": "none",   "texture": "none", "corner": "none",     "titleStyle": "plain",      "radius": 6,  "border": "none",     "mark": "dot"},
    "business": {"gutter": 0.08, "rail": "rule",   "texture": "none", "corner": "none",     "titleStyle": "underline",  "radius": 3,  "border": "hairline", "mark": "square"},
    "basic":    {"gutter": 0.06, "rail": "none",   "texture": "none", "corner": "none",     "titleStyle": "plain",      "radius": 8,  "border": "hairline", "mark": "dot"},
}

STYLE_ORDER = ["china", "minimal", "tech", "fresh", "academic", "cartoon", "flat", "business", "basic"]

# 学段兜底（style_tag 缺省/未知时用）：低段偏卡通/清新，中段偏清新/严谨，高段偏严谨/素净
STAGE_FALLBACK = {
    "primary": ["cartoon", "fresh", "china"],
    "junior": ["fresh", "academic", "china"],
    "senior": ["academic", "minimal", "business"],
    "college": ["business", "minimal", "academic"],
}

# 学科兜底：语文/历史偏国风，理科偏科技/严谨
SUBJECT_FALLBACK = {
    "语文": ["china", "fresh"], "历史": ["china", "academic"], "美术": ["cartoon", "china"],
    "数学": ["tech", "minimal"], "物理": ["tech", "academic"], "化学": ["tech", "academic"],
    "生物": ["fresh", "tech"], "英语": ["fresh", "cartoon"], "道法": ["academic", "minimal"],
}

_GRADE_RE = None


def resolve_style(style_tag: str, stage: str = "", subject: str = "") -> Dict[str, Any]:
    """style_tag → 风格 key；缺省/未知时按 学段 → 学科 兜底（确定性，无 LLM）。

    返回 `{styleKey, fallback, reason}` —— **兜底必须显式标记**，不许静默给个风格了事。
    """
    st = (style_tag or "").strip()
    if st in STYLE_SPECS:
        return {"styleKey": st, "fallback": False, "reason": "style_tag 命中风格表"}
    # 允许用"主题前缀"表达风格（如 zgf-ink-wash → china）
    for key in STYLE_ORDER:
        for p in STYLE_SPECS[key]["prefixes"]:
            if p and st.startswith(p):
                return {"styleKey": key, "fallback": False, "reason": f"style_tag 按主题前缀 {p} 归入 {key}"}
    for key in STYLE_ORDER:
        if key == st:
            return {"styleKey": key, "fallback": False, "reason": "style_tag 命中风格表"}
    if stage and stage in STAGE_FALLBACK:
        return {"styleKey": STAGE_FALLBACK[stage][0], "fallback": True, "reason": f"style_tag 缺省/未知，按学段 {stage} 兜底"}
    if subject and subject in SUBJECT_FALLBACK:
        return {"styleKey": SUBJECT_FALLBACK[subject][0], "fallback": True, "reason": f"style_tag 缺省/未知，按学科 {subject} 兜底"}
    return {"styleKey": "basic", "fallback": True, "reason": "style_tag 缺省/未知且无学段/学科线索，回落 basic"}


def skeleton_class(style_key: str) -> str:
    """骨架类：与 H5 渲染器 body 上的类**同形**（`morph-<density> mv-<motion> layout-<layout>`）。

    这样"工具说用什么骨架"与"渲染出来是什么骨架"可逐字对照（契约②：骨架必须真实驱动版式几何）。
    """
    sp = STYLE_SPECS[style_key]
    return f"morph-{sp['morph']['density']} mv-{sp['morph']['motion']} layout-{sp['h5Layout']}"


def style_dna(style_key: str) -> Dict[str, Any]:
    """风格 DNA 快照（渲染只读它，不读 template_id）。

    注意 `colors` 字段：**故意不在服务端给色值** —— 配色权威源是前端 pptThemes.ts 的 CwTheme
    （0008 迁移注释同口径："theme_id 仅存引用字符串，配色解析仍由前端负责"）。
    这里给 `colorSource='theme_id'` + `decorVocab`，由渲染端按 themeId 解析具体色值。
    """
    sp = STYLE_SPECS[style_key]
    return {
        "font": sp["font"],
        "density": sp["morph"]["density"],
        "motion": sp["morph"]["motion"],
        "motif": sp["morph"]["motif"],
        "decorVocab": sp["decor"],
        "colorSource": "theme_id",   # 色值由渲染端 CwTheme 解析（单一事实源）
        "structure": STYLE_STRUCTURE[style_key],
    }


def template_query(req: Dict[str, Any]) -> Dict[str, Any]:
    """`template.query`：风格/模板的**确定性**解析（无 LLM）。

    模板库（DB `courseware_templates`）**当前无数据**（"模板外移"未完成）→ 如实返回
    `templateSource='style-default'` 与 `templateId=None`，并附 `note` 说明，**不伪造 id**。
    """
    style_tag = str(req.get("style_tag") or "")
    stage = str(req.get("stage") or "")
    subject = str(req.get("subject") or "")
    kind = str(req.get("kind") or "ppt")
    scene = str(req.get("scene") or "")
    r = resolve_style(style_tag, stage, subject)
    key = r["styleKey"]
    sp = STYLE_SPECS[key]
    tpl_id, tpl_note = _lookup_template(kind, key, stage, subject, scene)
    return {
        "styleKey": key,
        "themeId": sp["themeId"],
        "templateId": tpl_id,
        "templateSource": "courseware_templates" if tpl_id else "style-default",
        "skeletonClass": skeleton_class(key),
        "styleDNA": style_dna(key),
        "resolvedFrom": {"styleTag": style_tag, "fallback": r["fallback"], "reason": r["reason"]},
        "note": tpl_note,
    }


def _lookup_template(kind: str, style: str, stage: str, subject: str, scene: str):
    """查 DB 模板库（表存在但可能为空 → 如实返回 None）。失败不阻断，只记 note。"""
    try:
        import psycopg2  # 与 kg_store.py 同源
    except Exception:
        return None, "psycopg2 不可用，跳过模板库查询（返回 style-default）"
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        return None, "未配置 DATABASE_URL，跳过模板库查询（返回 style-default）"
    try:
        conn = psycopg2.connect(dsn, connect_timeout=5)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id FROM courseware_templates
                       WHERE kind = %s AND style = %s
                         AND (%s = '' OR grades @> %s::jsonb)
                         AND (%s = '' OR subjects @> %s::jsonb)
                       ORDER BY is_builtin DESC, id LIMIT 1""",
                    (kind, style, stage, f'["{stage}"]' if stage else "[]", subject, f'["{subject}"]' if subject else "[]"),
                )
                row = cur.fetchone()
                if row:
                    return row[0], "命中模板库 courseware_templates"
                return None, "模板库暂无匹配（表当前为空：『模板外移』未完成）"
        finally:
            conn.close()
    except Exception as e:  # 表不存在/连接失败：不阻断工具层
        return None, f"模板库查询失败（{type(e).__name__}），返回 style-default"


# ────────────────────────────────────────────────
# asset.search：公共装饰元件（DB materials），**只返回形状/语义槽，不含色值**
# ────────────────────────────────────────────────
DEFAULT_FACTOR = 3  # 数量 = need × factor（可入参覆盖）


def asset_search(req: Dict[str, Any]) -> Dict[str, Any]:
    """`asset.search`：按风格/学段/学科/场景检索可引用装饰元件（确定性排序，无 LLM）。

    - 入参：`styleId|style_tag`、`stage`、`subject`、`need`、`scene`、可选 `medium|motif|color|pageType|factor`
    - 出参：`{items:[{assetId,url,params}], total, paramsRule}`
    - 契约③：`params` **不含色值**（`color_root` 只用于**筛选**，不回传），颜色由 styleDNA 渲染时填入。
    """
    style_tag = str(req.get("styleId") or req.get("style_tag") or "")
    stage = str(req.get("stage") or "")
    subject = str(req.get("subject") or "")
    scene = str(req.get("scene") or "")
    need = int(req.get("need") or 0)
    factor = int(req.get("factor") or DEFAULT_FACTOR)
    medium = str(req.get("medium") or ("h5" if str(req.get("kind") or "") == "h5" else "ppt"))
    motif = str(req.get("motif") or "")
    color = str(req.get("color") or "")
    page_type = str(req.get("pageType") or scene or "")
    r = resolve_style(style_tag, stage, subject)
    want = max(1, need * max(1, factor)) if need > 0 else max(1, factor)

    rows, db_note = _query_decor(medium, motif, color, page_type)
    key = r["styleKey"]
    ranked = sorted(rows, key=lambda x: (-_score(x, key, medium, page_type), str(x.get("id"))))
    items = []
    for row in ranked[:want]:
        items.append({
            "assetId": row["id"],
            "url": row.get("url") or "",
            # ⚠ 只给形状/语义槽：**不含 color_root / 任何色值**（契约③）
            "params": {
                # shape = 资产**文件形态**（由 url 后缀推得）；注意 `format` 列在装饰元件上是
                # facet 值（实测多为 'common'），不是文件格式，别拿它当 shape。
                "shape": _ext(row.get("url") or ""),
                "role": "component" if row.get("category") == "decor_component" else "element",
                "medium": row.get("applicable") or "common",
                "motif": row.get("motif_root") or "",
                "pageType": row.get("page_type") or "",
                "name": row.get("name") or "",
            },
        })
    return {
        "items": items,
        "total": len(items),
        "need": need, "factor": factor,
        "resolve": {"styleKey": key, "fallback": r["fallback"], "reason": r["reason"]},
        "paramsRule": "params 只含形状/语义槽，不含色值（颜色由 styleDNA 在渲染时填入）",
        "dbNote": db_note,
    }


def _ext(url: str) -> str:
    """资产**文件形态**（svg/png/jpg…）：由 url 后缀推得，用于 `params.shape`（契约③：只给形状/语义槽）。"""
    tail = str(url).split("?")[0].rsplit(".", 1)
    return tail[1].lower() if len(tail) == 2 and 1 <= len(tail[1]) <= 5 else "unknown"


def _score(row: Dict[str, Any], style_key: str, medium: str, page_type: str) -> int:
    """确定性匹配度：风格装饰词命中 + 媒介精确（优于 common）+ 页型命中。"""
    s = 0
    if row.get("applicable") == medium:
        s += 3
    elif row.get("applicable") == "common":
        s += 1
    if page_type and row.get("page_type") == page_type:
        s += 2
    if row.get("motif_root") == STYLE_SPECS[style_key]["morph"]["motif"]:
        s += 2
    if row.get("format") == "svg":
        s += 1  # SVG 可着色，优先（与 styleDNA 填色契约一致）
    return s


def _query_decor(medium: str, motif: str, color: str, page_type: str):
    """查公共装饰元件：与 Go 侧 ListPublicDecor 同口径（category + user_id='' + facets）。"""
    try:
        import psycopg2
    except Exception:
        return [], "psycopg2 不可用，无法查询素材库"
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        return [], "未配置 DATABASE_URL，无法查询素材库"
    sql = ("SELECT id, name, url, category, COALESCE(format,'') AS format, "
           "COALESCE(applicable,'') AS applicable, COALESCE(motif_root,'') AS motif_root, "
           "COALESCE(color_root,'') AS color_root, COALESCE(page_type,'') AS page_type "
           "FROM materials WHERE category IN ('decor_element','decor_component') AND user_id = ''")
    args: List[Any] = []
    if medium:
        sql += " AND (applicable = %s OR applicable = 'common')"
        args.append(medium)
    if motif:
        vals = [x for x in motif.split(',') if x]
        sql += " AND motif_root = ANY(%s)"
        args.append(vals)
    if color:
        vals = [x for x in color.split(',') if x]
        sql += " AND color_root = ANY(%s)"
        args.append(vals)
    if page_type:
        sql += " AND page_type = %s"
        args.append(page_type)
    try:
        conn = psycopg2.connect(dsn, connect_timeout=5)
        try:
            with conn.cursor() as cur:
                cur.execute(sql, args)
                cols = [d[0] for d in cur.description]
                return [dict(zip(cols, r)) for r in cur.fetchall()], ""
        finally:
            conn.close()
    except Exception as e:
        return [], f"素材库查询失败（{type(e).__name__}）"
