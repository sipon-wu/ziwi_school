"""LLM 通道配置（运营可维护 · 热生效 · 2026-09-12）

## 为什么要有它

此前"换模型 / 换厂商" = 改代码或改 env + **重新部署**。实测代价：
改 compose 还因为 `deploy.sh` 不同步 `deploy/` 目录而**静默失效**（部署两次没生效，
进容器 printenv 才发现远端 compose 是旧版）。这类"改了没生效"最耗时。

现在把通道配置放进数据库，运行时读取（带 TTL 缓存）：
**改完即生效、不用部署**。控制权将来可挂到 cloud.ziwi.cn —— 那边只需调 API。

## 设计要点

1. **角色分治**：`gen`（生成器）/ `review`（质量评审）/ `safety`（红线复核）
   可各自指向**不同厂商**。红线与生成器**必须不同厂商**才有交叉验证意义
   （同模型会放过自己写下的擦边内容 —— 这是实测结论，不是推测）。
2. **env 兜底**：DB 没有该角色的行 → 回落到环境变量，**保持既有行为不变**。
3. **密钥安全**：
   - 存库（与本机 `.env` 同信任级），但**所有对外响应一律脱敏**（只给尾 4 位）；
   - 接口只接受写入、不回传明文；
   - TODO（生产强化）：用 KMS / env 主密钥对其加密存储。
     现在不做是因为"主密钥存哪"本身没有比 `.env` 更安全的位置，
     仅凭代码加密会变成**安全表演**（钥匙和锁放一起）。
4. **embedding 不在本表**：DeepSeek 没有 embedding API，RAG 向量检索继续用百炼
   （见 embeddings.py）。若将来换 embedding 模型，**向量维度/空间不同 → 整库向量必须重建**。
"""
import logging
import os

import psycopg2

logger = logging.getLogger("zhiwei-ai.llm_channel")

DATABASE_URL = os.getenv("DATABASE_URL")
TABLE = "ai_llm_channel"

# 允许的角色（与 api_server 的三处调用对应）
ROLES = ("gen", "review", "safety")
ROLE_DESC = {
    "gen": "生成器（写课件）—— 算力优先给它",
    "review": "质量评审（AI 打分，默认关闭）",
    "safety": "红线复核（合规/安全）—— 建议与 gen **不同厂商**",
}


def get_conn():
    return psycopg2.connect(DATABASE_URL, connect_timeout=10)


def ensure_schema():
    """建表（幂等）。沿用 vector_store.ensure_schema 的范式。"""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {TABLE} (
                role       TEXT PRIMARY KEY,
                base_url   TEXT NOT NULL,
                api_key    TEXT,
                model      TEXT NOT NULL,
                enabled    BOOLEAN NOT NULL DEFAULT TRUE,
                updated_by TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()


def mask(api_key: str) -> str:
    """脱敏：只保留尾 4 位。**任何对外响应都必须过这里**。"""
    if not api_key:
        return ""
    k = str(api_key)
    return ("*" * max(0, len(k) - 4)) + k[-4:] if len(k) > 4 else "*" * len(k)


def load_all() -> dict:
    """读取全部角色配置：{role: {base_url, model, api_key, enabled, updated_by, updated_at}}。"""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT role, base_url, api_key, model, enabled, updated_by, updated_at FROM {TABLE}")
        out = {}
        for role, base_url, api_key, model, enabled, by, at in cur.fetchall():
            out[role] = {
                "base_url": base_url, "api_key": api_key, "model": model,
                "enabled": bool(enabled), "updated_by": by,
                "updated_at": at.isoformat() if at else None,
            }
        cur.close()
        return out
    finally:
        conn.close()


def save(role: str, base_url: str = None, model: str = None,
         api_key: str = None, enabled: bool = True, updated_by: str = None) -> dict:
    """写入某角色的通道配置（upsert）。

    api_key 传 None / 空串 → **保留原值**（避免运营改模型名时把密钥清空）。
    传字符串 "CLEAR" → 显式清空密钥（回落到 env）。
    """
    if role not in ROLES:
        raise ValueError(f"未知角色 {role}（允许：{', '.join(ROLES)}）")
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT base_url, api_key, model FROM {TABLE} WHERE role = %s", (role,))
        row = cur.fetchone()
        cur_base, cur_key, cur_model = row if row else (None, None, None)

        new_base = (base_url or cur_base or "").strip()
        new_model = (model or cur_model or "").strip()
        if api_key is None or api_key == "":
            new_key = cur_key
        elif api_key == "CLEAR":
            new_key = None
        else:
            new_key = api_key.strip()
        if not new_base or not new_model:
            raise ValueError("base_url 与 model 不能为空（api_key 可留空以保留原值）")

        cur.execute(
            f"""
            INSERT INTO {TABLE} (role, base_url, api_key, model, enabled, updated_by, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (role) DO UPDATE SET
                base_url = EXCLUDED.base_url,
                api_key  = EXCLUDED.api_key,
                model    = EXCLUDED.model,
                enabled  = EXCLUDED.enabled,
                updated_by = EXCLUDED.updated_by,
                updated_at = now()
            """,
            (role, new_base, new_key, new_model, bool(enabled), updated_by),
        )
        conn.commit()
        cur.close()
        logger.info("通道配置已更新 role=%s base_url=%s model=%s by=%s",
                    role, new_base, new_model, updated_by)
        return {"role": role, "base_url": new_base, "model": new_model,
                "api_key": mask(new_key), "enabled": bool(enabled)}
    finally:
        conn.close()


def status(env_fallback: dict = None) -> list:
    """对外状态（**密钥脱敏**）。env_fallback: {role: {base_url, model, api_key_source}}"""
    env_fallback = env_fallback or {}
    try:
        db = load_all()
        err = None
    except Exception as e:                      # 读库失败不能影响服务
        logger.warning("读取通道配置失败：%s", e)
        db, err = {}, str(e)

    out = []
    for role in ROLES:
        row = db.get(role)
        fb = env_fallback.get(role) or {}
        if row:
            out.append({
                "role": role, "desc": ROLE_DESC.get(role, ""),
                "source": "db", "base_url": row["base_url"], "model": row["model"],
                "api_key_masked": mask(row["api_key"]),
                "has_api_key": bool(row["api_key"]),
                "enabled": row["enabled"],
                "updated_by": row["updated_by"], "updated_at": row["updated_at"],
            })
        else:
            out.append({
                "role": role, "desc": ROLE_DESC.get(role, ""),
                "source": "env（未在库中配置）",
                "base_url": fb.get("base_url"), "model": fb.get("model"),
                "api_key_masked": "", "has_api_key": bool(fb.get("has_api_key")),
                "enabled": True, "updated_by": None, "updated_at": None,
            })
    return {"channels": out, "error": err}
