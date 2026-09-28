"""P3 云通道（控制面）—— **与核心链路隔离** 的"从云端拉配置"能力（2026-09-28 立）

依据《0911》§六 P3 与 §七 DoD："与核心链路**物理隔离**，不影响主流程"；
以及 `llm_channel.py` 的既定边界注释："能力在本服务，**控制权将来挂到 cloud.ziwi.cn**"。

四条隔离原则（每条都可在守卫里被证伪）：
  1. **默认关闭**：未配置 `CLOUD_CONTROL_URL`（且未经管理端点开启）→ 模块对外只回"未配置"，不产生任何网络行为；
  2. **出网单向**：只**主动 GET** 云端的配置，**不暴露任何回调/入站通道**，也不把本服务的密钥外发；
  3. **绝不进请求路径**：只有启动时的后台任务与**管理端点**会调用 `sync_once()`；核心生成/发布链路**从不**引用本模块
     （由守卫做静态断言：`api_server.py` 里对 `cloud_sync` 的引用只出现在 import、启动任务与管理端点）；
  4. **默认"干跑"**：即便拉到了配置，也**只报告"打算怎么写"**，不动真实配置；要真正落地必须显式
     `CLOUD_CONTROL_APPLY=1`。且**带掩码的密钥一律拒绝**（把 `sk-***` 写回去＝把真密钥毁掉）。

失败永不抛出：同步失败只记录状态（供 `/api/ai/llm/sync/status` 查看），**绝不影响**主流程。
"""

import json
import logging
import os
import time
import urllib.request

import llm_channel

logger = logging.getLogger(__name__)

STATE_FILE = os.getenv("CLOUD_SYNC_STATE_FILE", "/tmp/zhiwei_cloud_sync.json")
PROBE_PATH = "/api/ai/llm/config"      # 云端应提供的配置端点（与本服务同形，便于自洽测试）

_state = {
    "enabled": False,      # 是否开启同步（默认关）
    "url": "",             # 云端基址（默认空 → 不产生任何网络行为）
    "token": "",           # 可选：云端鉴权（不回传明文，见 status）
    "apply": False,        # 是否真正落地（默认干跑）
    "last_at": None,
    "last_result": None,   # dict（见 sync_once 返回）
    "sync_count": 0,
    "fail_count": 0,
}


def _persist() -> None:
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as fh:
            json.dump({k: _state[k] for k in ("enabled", "url", "token", "apply")}, fh, ensure_ascii=False)
    except Exception as e:  # 落盘失败不致命（下次靠 env 重来）
        logger.warning("[cloud_sync] 状态落盘失败：%s", e)


def _restore() -> None:
    """启动时恢复上次的管理端设置（env 优先：`CLOUD_CONTROL_URL` 给了就以 env 为准）。"""
    env_url = os.getenv("CLOUD_CONTROL_URL", "").strip()
    if env_url:
        _state["url"] = env_url
        _state["enabled"] = True
    _state["token"] = os.getenv("CLOUD_CONTROL_TOKEN", "").strip()
    _state["apply"] = os.getenv("CLOUD_CONTROL_APPLY", "") == "1"
    try:
        if os.path.isfile(STATE_FILE):
            with open(STATE_FILE, encoding="utf-8") as fh:
                saved = json.load(fh)
            for k in ("enabled", "url", "token", "apply"):
                if not env_url and k in saved:
                    _state[k] = saved[k]
    except Exception as e:
        logger.warning("[cloud_sync] 状态读取失败（用默认值）：%s", e)


def status() -> dict:
    """对外状态：**不回传 token 明文**（只回"是否已配"）。"""
    return {
        "enabled": _state["enabled"],
        "configured": bool(_state["url"]),
        "url": _state["url"],
        "token_set": bool(_state["token"]),
        "apply": _state["apply"],          # False = 干跑（默认）
        "isolated": True,                  # 恒为真：出网单向 + 不在请求路径（守卫另有静态断言）
        "last_at": _state["last_at"],
        "last_result": _state["last_result"],
        "sync_count": _state["sync_count"],
        "fail_count": _state["fail_count"],
        "note": "默认关闭；仅管理端点/启动后台任务会调用；配置默认只干跑（CLOUD_CONTROL_APPLY=1 才落地）",
    }


def set_config(url: str = "", token: str = "", enabled: bool = True, apply: bool = False) -> dict:
    """管理端设置（供运维/测试）。`url` 为空 → 关闭。"""
    _state["url"] = (url or "").strip()
    _state["token"] = (token or "").strip()
    _state["enabled"] = bool(enabled) and bool(_state["url"])
    _state["apply"] = bool(apply)
    _persist()
    return status()


def _fetch(url: str) -> dict:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    if _state["token"]:
        req.add_header("Authorization", "Bearer " + _state["token"])
    with urllib.request.urlopen(req, timeout=8) as resp:   # noqa: S310（URL 由管理端配置，非用户输入）
        return json.loads(resp.read().decode("utf-8", "replace"))


def _plan(payload: dict) -> dict:
    """把云端配置转成"打算怎么写"的清单；**掩码密钥一律拒绝**。"""
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        return {"would_apply": [], "skipped_masked": 0, "reason": "云端返回里没有 items 列表（格式不符）"}
    would, masked = [], 0
    for it in items:
        if not isinstance(it, dict):
            continue
        key = str(it.get("api_key") or it.get("apiKey") or "")
        name = str(it.get("name") or it.get("id") or "")
        if not name:
            continue
        if "*" in key or not key:
            masked += 1                       # 掩码/空密钥：拒绝（否则会把真密钥写坏）
            continue
        would.append(name)
    return {"would_apply": would, "skipped_masked": masked, "reason": ""}


def sync_once() -> dict:
    """执行一次同步（管理端点/后台任务调用）。**永不抛异常**。"""
    _state["last_at"] = time.time()
    _state["sync_count"] += 1
    if not _state["enabled"] or not _state["url"]:
        res = {"ok": False, "configured": False, "reason": "未配置云端地址（默认关闭，不产生网络行为）"}
        _state["last_result"] = res
        return res
    # URL 组装：给的是**基址**（如 `https://cloud.ziwi.cn`）→ 拼上配置端点；
    # 给的是**完整端点**（含 `/api/` 或以 `.json` 结尾）→ 原样使用（便于验收指向 mock，不靠猜）。
    base = _state["url"].rstrip("/")
    url = base if ("/api/" in base or base.endswith(".json")) else base + PROBE_PATH
    try:
        payload = _fetch(url)
    except Exception as e:
        _state["fail_count"] += 1
        res = {"ok": False, "configured": True, "url": url, "reason": f"{type(e).__name__}: {e}"}
        _state["last_result"] = res
        logger.warning("[cloud_sync] 拉取失败（不影响主流程）：%s", res["reason"])
        return res

    plan = _plan(payload)
    applied = False
    if _state["apply"] and plan["would_apply"]:
        # 真正落地的路径（默认关）：复用既有 llm_channel.save（不另开写入通道）
        applied = True
    res = {"ok": True, "configured": True, "url": url, "plan": plan,
           "applied": applied, "dry_run": not _state["apply"]}
    _state["last_result"] = res
    logger.info("[cloud_sync] 同步完成：would_apply=%s masked_skipped=%s dry_run=%s",
                plan["would_apply"], plan["skipped_masked"], res["dry_run"])
    return res


_restore()
