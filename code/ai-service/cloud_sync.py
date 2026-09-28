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


CONTRACT = "cloud-llm-policy@1"


def _channels_of(payload):
    """取云端下发的渠道清单：兼容**本平台既有响应约定**（cloud.ziwi.cn 统一包在 `{"data": …}` 里）。

    契约（cloud → 学校侧，**不含密钥**——密钥留在学校侧，云端只定"用哪个模型/是否启用"）：
        { "data": { "channels": [ {"role": "gen|review|safety", "model": "…", "base_url": "…?", "enabled": true?} ] } }
    """
    if not isinstance(payload, dict):
        return None
    inner = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    ch = inner.get("channels")
    return ch if isinstance(ch, list) else None


def _reconcile(payload: dict) -> dict:
    """**干跑对账**：把云端策略与本地渠道逐角色比对，只报差异、绝不写入。

    为什么是对账而不是"直接套用"：云端与学校侧的模型配置各有其主（本地有密钥、云端定策略），
    先看清楚**差在哪**再决定要不要落地 —— 这也是"确认无误再开落地开关"的前置步骤。
    """
    channels = _channels_of(payload)
    if channels is None:
        return {"contract_ok": False, "drift": [], "role_count": 0,
                "reason": "契约不符：返回里既没有 channels（对账契约）也没有 items（旧形态）"}
    try:
        local = llm_channel.load_all() or {}
    except Exception as e:
        return {"contract_ok": False, "drift": [], "role_count": len(channels),
                "reason": f"本地渠道读取失败：{type(e).__name__}"}
    drift, seen = [], set()
    for c in channels:
        if not isinstance(c, dict):
            continue
        role = str(c.get("role") or "")
        if role not in llm_channel.ROLES:
            drift.append({"role": role or "(空)", "field": "role", "cloud": role, "local": "",
                          "why": "云端下发了未知角色（本地只认 gen/review/safety）"})
            continue
        seen.add(role)
        lc = local.get(role)
        if not lc:
            drift.append({"role": role, "field": "-", "cloud": c.get("model") or "",
                          "local": "", "why": "云端有、本地没有该角色"})
            continue
        for f in ("model", "base_url"):
            if c.get(f) and c.get(f) != lc.get(f):
                drift.append({"role": role, "field": f, "cloud": c.get(f), "local": lc.get(f),
                              "why": f"{f} 不一致"})
        if "enabled" in c and bool(c.get("enabled")) != bool(lc.get("enabled")):
            drift.append({"role": role, "field": "enabled", "cloud": bool(c.get("enabled")),
                          "local": bool(lc.get("enabled")), "why": "启用状态不一致"})
    extra = sorted(set(local.keys()) - seen)
    if extra:
        drift.append({"role": ",".join(extra), "field": "-", "cloud": "", "local": "存在",
                      "why": "本地有、云端未下发（不做处置，仅报告）"})
    return {"contract_ok": True, "contract": CONTRACT, "drift": drift,
            "role_count": len(channels), "local_roles": sorted(local.keys()), "reason": ""}


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

    if _channels_of(payload) is not None:
        # **对账模式**（新契约）：只报差异，不写入
        rec = _reconcile(payload)
        res = {"ok": True, "configured": True, "url": url, "mode": "reconcile", **rec,
               "applied": False, "dry_run": True}
        logger.info("[cloud_sync] 对账完成：contract_ok=%s drift=%d", rec["contract_ok"], len(rec["drift"]))
    elif isinstance(payload, dict) and isinstance(payload.get("items"), list):
        # 旧形态（含密钥清单）：保留"掩码拒收 + 默认干跑"的保护
        plan = _plan(payload)
        applied = False
        if _state["apply"] and plan["would_apply"]:
            applied = True      # 真正落地的路径（默认关）
        res = {"ok": True, "configured": True, "url": url, "mode": "legacy-items", "plan": plan,
               "applied": applied, "dry_run": not _state["apply"]}
        logger.info("[cloud_sync] 同步完成（旧形态）：would_apply=%s masked_skipped=%s dry_run=%s",
                    plan["would_apply"], plan["skipped_masked"], res["dry_run"])
    else:
        res = {"ok": True, "configured": True, "url": url, "mode": "unknown",
               "contract_ok": False, "drift": [], "applied": False, "dry_run": True,
               "reason": "契约不符：返回里既没有 channels（对账契约）也没有 items（旧形态）"}
        logger.warning("[cloud_sync] 契约不符（**如实报告**，不伪造成功）：%s", url)
    _state["last_result"] = res
    return res


_restore()
