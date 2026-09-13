import os
import time
import json
import re
import colorsys
import zlib
import dashscope
from dashscope import Generation
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse   # SSE 进度反馈（长任务不被网关掐断）
import uvicorn
import asyncio
import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
logger = logging.getLogger("zhiwei-ai")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 百炼（阿里云 DashScope）凭证，由 docker-compose 注入 DASHSCOPE_API_KEY
# DASHSCOPE_BASE_URL 为兼容模式端点，dashscope 原生 SDK 走官方域名即可，这里仅读 key
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")
# ── LLM 通道（2026-09-12 改为 **OpenAI 兼容协议**，以便按厂商切换）──
# 为什么改：此前直连 dashscope 原生 SDK → "换模型=改代码"。现在统一走 OpenAI 兼容端点，
# 百炼 / DeepSeek / 其他厂商都支持，**换厂商只需改环境变量**：
#   LLM_BASE_URL  如 https://api.deepseek.com/v1
#                 或 https://dashscope.aliyuncs.com/compatible-mode/v1（默认）
#   LLM_API_KEY   该厂商的 key（缺省回落 DASHSCOPE_API_KEY）
#   LLM_MODEL     默认模型名（缺省 qwen-turbo；换 DeepSeek 则填 deepseek-chat）
#
# ⚠️ **embedding 不走本通道**：DeepSeek 目前没有 embedding API，RAG 向量检索继续用
#    百炼 text-embedding-v3（见 embeddings.py）。将来若要换 embedding 模型，注意
#    **向量维度/空间不同 → 现有向量库必须整体重建**，不能新旧混用。
LLM_BASE_URL = os.getenv("LLM_BASE_URL") or "https://dashscope.aliyuncs.com/compatible-mode/v1"
LLM_API_KEY = os.getenv("LLM_API_KEY") or os.getenv("DASHSCOPE_API_KEY", "")
DEFAULT_MODEL = os.getenv("LLM_MODEL") or os.getenv("DASHSCOPE_MODEL", "qwen-turbo")

from openai import OpenAI  # noqa: E402

# base_url 决定厂商；缺 key 时给占位符，让错误在**调用时**以清晰信息抛出（而不是 import 时崩）
_llm_client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY or "MISSING_KEY", timeout=600.0)

# ── 通道热生效（2026-09-12）──
# 上层是 env 兜底；**库里有配置就以库为准**（运营可在界面改，不用部署）。
# 详见 llm_channel.py 的设计说明。
from llm_channel import ensure_schema as _llm_channel_ensure, load_all as _llm_channel_load, mask as _mask_key, status as _llm_channel_status, save as _llm_channel_save  # noqa: E402

_LLM_CFG_TTL = float(os.getenv("LLM_CFG_TTL", "30"))
_llm_cfg = {"ts": 0.0, "loaded": False, "channels": {}}
_llm_clients = {}


def _client(base_url: str, api_key: str):
    """按 (base_url, api_key) 缓存客户端 —— 配置变了自然换新客户端。"""
    key = (base_url, api_key)
    c = _llm_clients.get(key)
    if c is None:
        c = OpenAI(base_url=base_url, api_key=api_key or "MISSING_KEY", timeout=600.0)
        _llm_clients[key] = c
    return c


def refresh_channels(force: bool = False) -> None:
    """从库刷新通道配置（TTL 缓存）。**这是"改完即生效"的关键**。"""
    now = time.monotonic()
    if not force and _llm_cfg["loaded"] and now - _llm_cfg["ts"] < _LLM_CFG_TTL:
        return
    _llm_cfg["ts"] = now
    try:
        _llm_cfg["channels"] = _llm_channel_load()
        _llm_cfg["loaded"] = True
    except Exception as e:
        logger.warning("通道配置读取失败（沿用 env / 上次配置）：%s", e)
        if not _llm_cfg["loaded"]:          # 避免每请求都打库重试
            _llm_cfg["loaded"] = True
            _llm_cfg["channels"] = {}


def channel_for(role: str = "gen") -> dict:
    """某角色生效的通道：**库优先（且 enabled），env 兜底**。"""
    refresh_channels()
    row = _llm_cfg["channels"].get(role)
    if row and row.get("enabled"):
        return {"base_url": row["base_url"], "api_key": row["api_key"] or LLM_API_KEY,
                "model": row["model"], "source": "db"}
    return {"base_url": LLM_BASE_URL, "api_key": LLM_API_KEY,
            "model": {"gen": GEN_MODEL, "review": REVIEW_MODEL, "safety": SAFETY_MODEL}
                     .get(role, DEFAULT_MODEL),
            "source": "env"}


def _effective_model(role: str = "gen") -> str:
    """当前**实际生效**的模型名（响应里回报它，避免"跑着 plus 却报 turbo"的误导）。"""
    return channel_for(role)["model"]
# 生成器与评审员**分开配置**（2026-09-12）：
#   产品原则——**算力优先给生成器**（首轮质量决定成本与体验）。
#   此前 7 处硬编码 "qwen-turbo"，DEFAULT_MODEL 形同虚设：想换更强模型必须改代码。
#   现在：生成器可用 CW_GEN_MODEL 单独升级；评审可用 CW_REVIEW_MODEL 单独降本/换模型。
# ⚠ 对外回报模型名**一律用 `_effective_model(role)`**（库优先、env 兜底），不要用下面的静态常量。
#   静态常量只在 channel_for 的"env 兜底"分支里参与解析；直接拿去回报会出现
#   "跑着 plus 却报 turbo"（2026-09-13 已统一收口 —— 生成/教案/视频分镜 3 处）。
#   同理：**调用时也不要把它当实参传**（会绕过通道配置，导致主流程与分支各用一个模型）。
GEN_MODEL = os.getenv("CW_GEN_MODEL", DEFAULT_MODEL)
REVIEW_MODEL = os.getenv("CW_REVIEW_MODEL", DEFAULT_MODEL)
# S4 关卡2（AI 内容评审）默认**关闭**：同模型自评可靠度有限（共同盲区 + 自偏好），
# 而这些算力投给生成器收益更高。需要时按请求开启（body.content_review=true）或设
# 环境变量 CW_ENABLE_REVIEW=1 全局开启——代码保留，不默认烧算力。
REVIEW_ENABLED_DEFAULT = os.getenv("CW_ENABLE_REVIEW") == "1"
# 红线（合规/安全）复核专用模型：**必须与生成器不同**才能交叉验证。
# 理由：质量评审同模型只是"看不准"；**红线同模型是危险**——生成时写下的擦边内容，
# 自己复核会放过（共享同一套价值判断与盲区）。生产请把 CW_SAFETY_MODEL 指向另一模型/厂商。
SAFETY_MODEL = os.getenv("CW_SAFETY_MODEL", DEFAULT_MODEL)


def _call_llm_safety(messages, _model=None, max_tokens=2000):
    """红线复核通道（同步，供 policy.py 调用）：**忽略调用方模型名，固定走 SAFETY_MODEL**。

    用同步版是因为 `policy._llm_ethic_flags` 是同步调用（历史实现）；
    在异步端点中须用 run_in_threadpool 包装，避免阻塞事件循环。
    """
    return _call_llm(messages, None, max_tokens, role="safety")

# 向量检索（备课包/教材底料 RAG）
from embeddings import embed_texts, EMBED_MODEL, EMBED_DIM  # noqa: E402
from vector_store import (
    ensure_schema,
    search as vs_search,
    retrieve_boundary,
    retrieve_lecture,
    retrieve_by_kg_unit,
)  # noqa: E402
# 素材库检索（AI 决定挂载 / 找相近生成新版本）
from materials_store import list_materials, rank_materials  # noqa: E402
# 知识图谱 / 课标 / 题库检索（知识面约束、课标备注、组卷抽题）
from kg_store import (  # noqa: E402
    resolve_knowledge_scope, map_curriculum, list_bank_questions,
    list_kg_nodes, list_kg_units,   # 统一数据源：前端选择器改为读 DB（2026-09-13）
)
# 课件红线策略（发布校验 / 课前问诊 / 发散预算）
from policy import policy_gate_publish, policy_gate_notice, policy_consult, divergence_budget, ETHIC_PRINCIPLE, subject_orbit_hint  # noqa: E402
# Skill 输出的**确定性后处理**（两段式剥离 + 注释白名单兜底）：
# 复用本地预生成脚本的同一份实现，避免"两套链路各写一套"（历史教训：STYLEDNA 曾因
# 前端不识别而直接显示在页面上）。2026-09-12：服务端此前**完全没有**这两步，
# 而 skills/shared/输出契约.md 已要求 `<<<COURSEWARE>>>/<<<META>>>` 两段式，
# 不剥离就会把标记文字显示给教师。
from scripts.generate_seed_coursewares import (  # noqa: E402
    encode_visuals, page_structure, retry_prompt, split_output, strip_unknown_comments,
)
from scripts.check_courseware_quality import check_markdown  # noqa: E402

app = FastAPI(
    title="知微 AI 服务",
    description="AI Agent 服务（小微/知了/批阅），对接阿里云百炼 qwen 系列模型",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _call_llm(messages, model=None, max_tokens=2000, role="gen"):
    """同步调用（OpenAI 兼容协议）。

    通道（base_url / api_key）与模型名由 `channel_for(role)` 解析：
    **库优先、env 兜底、改完即生效（不用部署）**。
    model 传 None 时用该角色配置的模型名；显式传值则覆盖。
    """
    ch = channel_for(role)
    use_model = model or ch["model"]
    if not ch["api_key"]:
        raise RuntimeError(f"通道 {role} 未配置 api_key（库与 env 都没有）")
    resp = _client(ch["base_url"], ch["api_key"]).chat.completions.create(
        model=use_model,
        messages=messages,
        max_tokens=max_tokens,
    )
    msg = resp.choices[0].message
    text = (msg.content or "").strip()
    if not text:
        # 推理型模型（如 deepseek-reasoner）会把内容放在 reasoning_content。
        # 本系统只要**最终答案**，故显式报错，而不是把思考过程当正文返回。
        raise RuntimeError(f"模型 {model} 返回空内容（若用推理模型，请改用 deepseek-chat）")
    return text


async def call_llm(messages, model=None, max_tokens=2000, role="gen"):
    """在 FastAPI 异步端点中在线程池调用同步 SDK，避免阻塞事件循环。"""
    try:
        return await run_in_threadpool(_call_llm, messages, model, max_tokens, role)
    except Exception:
        # 统一记录 AI 调用失败根因（route 层仍按原样静默降级，保证有返回）
        logger.exception("call_llm failed role=%s model=%s", role, model)
        raise


def _recommend_materials(lesson_title, subject, grade, school_id, top_k=3):
    """AI 决定挂载：检索素材库 → 启发式初筛 → LLM 挑选最适宜的 1~top_k 个。

    返回 (ids, names)。任何环节失败都回退到启发式 top_k，保证有结果。
    """
    try:
        mats = list_materials(school_id)
    except Exception:
        return [], []
    if not mats:
        return [], []
    ranked = rank_materials(mats, lesson_title, subject, grade, top_k=6)
    if not ranked:
        return [], []
    candidates = "\n".join(
        f"{i+1}. [id={m['id']}] {m['name']}（类型：{m['type']}）" for i, m in enumerate(ranked)
    )
    prompt = (
        f"我正在为{grade}{subject}《{lesson_title}》备课。以下是素材库里可能相关的课件/素材：\n"
        f"{candidates}\n\n"
        f"请挑选最适合挂载到本课作为辅助课件的 1~{min(top_k, len(ranked))} 个，"
        f"只返回 JSON 数组，形如 [\"id1\",\"id2\"]，不要任何解释。"
    )
    try:
        import json
        import re
        resp = _call_llm([{"role": "user", "content": prompt}], None, 800)
        m = re.search(r"\[.*\]", resp, re.DOTALL)
        if not m:
            raise ValueError("no json array")
        ids = json.loads(m.group(0))
        if not isinstance(ids, list):
            raise ValueError("not list")
        chosen = [r for r in ranked if r["id"] in ids]
        if not chosen:
            chosen = ranked[:top_k]  # LLM 返回的 id 与候选不匹配时回退启发式
        return [c["id"] for c in chosen], [c["name"] for c in chosen]
    except Exception:
        return [r["id"] for r in ranked[:top_k]], [r["name"] for r in ranked[:top_k]]


async def _boundary_block(subject, grade, version, unit, query_text, top_k=5):
    """按教材知识边界检索，返回注入 prompt 的文本块；失败/无结果返回空串。

    三级递进策略（原文清除后的降级保障）：
      Level 1 — 有 lecture_id → 返回讲义摘要
      Level 2 — content 为 A/C 类清洗文本 → 返回清洗片段
      Level 3 — content 为 B/D 类蒸馏数据 → 返回知识点+教学要点
      Level 4 — content 为空 → 2-pass kg_unit 跳转同单元其他行
    """
    try:
        q_emb = embed_texts([query_text])[0]
        rows = await run_in_threadpool(
            retrieve_boundary, q_emb, subject, grade, version, unit, True, top_k
        )
        if not rows:
            return ""
        items = []
        for r in rows:
            u = r.get("unit", "") or ""
            ch = r.get("chapter", "") or ""
            content = r.get("content", "") or ""
            lecture_id = r.get("lecture_id")
            kg_unit = r.get("kg_unit", "") or ""

            # Level 1：有讲义
            if lecture_id:
                lecture = await run_in_threadpool(retrieve_lecture, str(lecture_id))
                if lecture and lecture.get("lecture"):
                    lec = lecture["lecture"]
                    if isinstance(lec, str):
                        try:
                            lec = json.loads(lec)
                        except json.JSONDecodeError:
                            lec = {}
                    parts = []
                    objs = lec.get("teaching_objectives") or []
                    if objs:
                        parts.append("教学目标：" + "；".join(o[:60] for o in objs[:2]))
                    kd = lec.get("key_difficult_points") or {}
                    keys = kd.get("key") or []
                    if keys:
                        parts.append("重点：" + "；".join(k[:60] for k in keys[:2]))
                    ext = lec.get("cultural_extension") or ""
                    if ext:
                        parts.append("拓展：" + ext[:100])
                    c = " | ".join(parts) if parts else f"[讲义 {str(lecture_id)[:8]}]"
                    items.append(f"- 【{u}/{ch}】{c}")
                    continue

            # 尝试解析 content JSON
            content_dict = {}
            if content.startswith("{") and content != "{}":
                try:
                    content_dict = json.loads(content)
                except json.JSONDecodeError:
                    content_dict = {}

            # Level 2：A/C 类清洗文本
            cleaned = content_dict.get("cleaned_text", "")
            if cleaned:
                c = cleaned[:400]
                items.append(f"- 【{u}/{ch}】{c}")
                continue

            # Level 3：蒸馏数据（V2 新格式 + 旧格式兼容）
            if content_dict.get("distilled"):
                parts = []
                summary = content_dict.get("summary", "")
                kpoints = content_dict.get("knowledge_points", [])
                treq = content_dict.get("teaching_requirements", "")
                # 旧格式兼容
                ktopics = content_dict.get("knowledge_topics", [])
                hints = content_dict.get("teaching_hints", "")

                if summary:
                    parts.append(summary[:280])
                elif kpoints:
                    parts.append("知识点：" + "、".join(kpoints[:4]))
                elif ktopics:
                    parts.append("知识点：" + "、".join(ktopics[:4]))
                if treq:
                    parts.append("教学要求：" + treq[:120])
                elif hints:
                    parts.append("教学要点：" + hints[:150])
                if not parts and content_dict.get("original_work_title"):
                    parts.append(f"《{content_dict['original_work_title']}》{content_dict.get('original_work_author', '')}")
                c = " | ".join(parts) if parts else "（已蒸馏）"
                # B 类标注改编来源
                if content_dict.get("class") == "B" and content_dict.get("adaptation_note"):
                    c += f"（来源：{content_dict['adaptation_note'][:80]}）"
                items.append(f"- 【{u}/{ch}】{c}")
                continue

            # Level 4：静默行 → 2-pass kg_unit 跳转
            if kg_unit:
                nearby = await run_in_threadpool(
                    retrieve_by_kg_unit, kg_unit, subject, grade,
                    r.get("chunk_id"), top_k=2,
                )
                bounce_texts = []
                for nb in nearby:
                    nb_content = nb.get("content", "") or ""
                    nb_lecture_id = nb.get("lecture_id")
                    if nb_lecture_id:
                        bounce_texts.append("[同单元讲义]")
                    elif nb_content.startswith("{"):
                        try:
                            nb_dict = json.loads(nb_content)
                            bt = nb_dict.get("cleaned_text", "") or (
                                "知识点：" + "、".join(nb_dict.get("knowledge_topics", [])[:3])
                            )
                            if bt:
                                bounce_texts.append(bt[:100])
                        except json.JSONDecodeError:
                            pass
                if bounce_texts:
                    c = "同单元参考：" + " | ".join(bounce_texts)
                else:
                    c = "（该单元知识点，见教学大纲）"
            else:
                c = "（该行已蒸馏，知识点见教学大纲）"

            items.append(f"- 【{u}/{ch}】{c}")

        return (
            "教材知识边界（以下为对应年级/学科/版本/单元的教材实际内容，"
            "设计须贴合这些底料，可适度参考但不偏离其范围）：\n"
            + "\n".join(items)
        )
    except Exception:
        return ""


def build_system_prompt(ctx: dict) -> str:
    role = ctx.get("role", "teacher")
    name = ctx.get("teacher_name", "老师")
    subject = ctx.get("subject", "语文")
    grade = ctx.get("grade", "四年级")
    role_label = {"principal": "校长", "director": "教务主任", "it_admin": "IT管理员"}.get(role, "教师")

    # ── IT 管理员专属引导：不套教师模板，聚焦平台运维与配置 ──
    if role == "it_admin":
        parts = [
            "你是知微教学平台的 AI 助教「小微」，正在协助学校的 IT 管理员进行平台运维与配置。",
            f"IT 管理员称呼：{name}。",
        ]
        if ctx.get("school_name"):
            parts.append(f"所在学校：{ctx.get('school_name')}。")
        parts.append(
            "你的职责聚焦平台运维与配置支持，主要包括：\n"
            "1) 教材版本库维护：在「设置-版本库维护」配置公共版本库（IT 管理员专属），"
            "教师可在个人配置中设置班级/年级/学科版本偏好；\n"
            "2) 账号与权限：重置教师/学生密码、调整角色、批量导入账号；\n"
            "3) 系统配置：维护学校信息、校区、班级、查看 License 状态；\n"
            "4) 数据初始化与同步：导入/校验课标、知识图谱、教材版本库等基础数据；\n"
            "5) 故障排查：登录异常、AI 服务不可用、接口超时等常见问题的定位与处理。\n"
            "请用专业、简洁、可操作的中文回答，给出具体菜单路径或操作建议，不要编造不存在的接口或菜单。\n"
            "涉及敏感操作（清除数据、改库、证书/域名）时，先提醒用户确认并走审批流程。"
        )
        # ── 系统知识块（基于本平台已实现功能，供知识性回答）──
        parts.append(
            "\n【本平台 IT 运维知识要点】\n"
            "• 教材版本库：每条版本用 version_key 作唯一标识（建议形如 学科_年级_出版社_年份，例 math_g7_renjiao_2024），"
            "字段含学科/年级/出版社/版本标识/ISBN；平台库为公共权威源，学校可在「学校自用覆盖」层改本校生效的版本，"
            "不影响公共库；教师有效版本按「个人偏好(班级>年级>学科) > 学校配置 > 平台默认」解析。\n"
            "• 账号批量导入：在「数据初始化-批量导入」选择 teachers / students，按 CSV（含 phone,name,role,grade,subject,class_id 等）上传，"
            "支持 upsert；导入有误可用批次回滚。\n"
            "• License：在「系统配置-学校信息」查看状态（active / expired）；License 决定可用席位与功能，过期需联系平台续期。\n"
            "• 故障排查：①登录失败——核对手机号/密码、确认账号未被禁用、License 是否有效；"
            "②AI 服务不可用——检查 /api/ai 连通性、确认模型服务配额与限流、超时可适当重试；"
            "③接口 429——触发限流，降低调用频率即可恢复。\n"
            "• 重置密码：在「用户管理-重置密码」为教师/学生生成临时密码并通知；若当前版本未开放该入口，引导联系平台运维。"
        )
        it_history = ctx.get("it_history")
        if it_history:
            parts.append(
                "\n【该管理员在本租户近期操作记录（仅作上下文参考，不要逐条复述，仅在被问及历史时引用）】\n"
                f"{it_history}"
            )
        if ctx.get("system_prompt"):
            parts.append(ctx.get("system_prompt"))
        return "\n".join(parts)

    parts = [
        f"你是知微教学平台的 AI 助教「小微」，正在协助一位{role_label}（{name}），"
        f"任教学科 {subject}，年级 {grade}。",
    ]
    if ctx.get("school_name"):
        parts.append(f"所在学校：{ctx.get('school_name')}。")
    if ctx.get("textbook_version"):
        parts.append(f"教材版本：{ctx.get('textbook_version')}。")
    if ctx.get("teacher_style"):
        parts.append(f"老师的教学风格偏好：{ctx.get('teacher_style')}。")
    if ctx.get("knowledge_boundary"):
        parts.append(f"知识边界：{ctx.get('knowledge_boundary')}。")
    parts.append("请用专业、亲切、简洁的中文回答，聚焦教学场景，给出可操作的建议。不要编造不存在的数据。")
    if ctx.get("system_prompt"):
        parts.append(ctx.get("system_prompt"))
    return "\n".join(parts)


def gen_suggestions(_message: str) -> list:
    return ["能帮我细化这个方案吗？", "给个具体的课堂实例", "如何评估学生掌握情况？"]


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service", "version": "1.1.0"}


@app.get("/api/ai/health")
async def api_health():
    return {"status": "ok", "service": "ai-service", "version": "1.1.0"}


@app.post("/api/ai/chat")
async def xiaowei_chat(req: Request):
    """小微对话：前端传 {message, context} -> {reply, suggestions}。"""
    try:
        body = await req.json()
    except Exception:
        body = {}
    message = (body.get("message") or "").strip()
    ctx = body.get("context") or {}
    if not message:
        return {"reply": "老师，您想聊点什么呢？", "suggestions": []}
    # 教材知识边界锚定：尽量按前端上下文的 学科/年级/版本 检索对应教材底料
    if ctx.get("subject") and ctx.get("grade"):
        b = await _boundary_block(
            ctx["subject"], ctx.get("grade"), ctx.get("textbook_version", ""),
            "", message,
        )
        if b:
            ctx["knowledge_boundary"] = (ctx.get("knowledge_boundary", "") + "\n" + b).strip()
    messages = [
        {"role": "system", "content": build_system_prompt(ctx)},
        {"role": "user", "content": message},
    ]
    start = time.time()
    try:
        reply = await call_llm(messages, DEFAULT_MODEL, 1500)
    except Exception as e:
        return {"reply": f"抱歉老师，AI 暂时无法回复：{e}", "suggestions": []}
    return {
        "reply": reply,
        "suggestions": gen_suggestions(message),
        "model": DEFAULT_MODEL,
        "generation_time_ms": int((time.time() - start) * 1000),
    }


def _resolve_scope_meta(body: dict):
    """解析知识面，并**返回溯源信息**（2026-09-13）。

    为什么需要 meta：此前只返回两个名称列表，**丢掉了"这次知识面是怎么来的"** —— 于是事后
    无法回答「这份课件是**教师锚定**的，还是系统按**知识图谱边界**兜底的」，这正是"编辑页左栏
    与画布脱节"的根因之一（生成配方没有被记录、回传）。
    返回 (kp_names, prereq_names, meta)；meta 只增信息，不改变生成行为。
    """
    kp_names = body.get("knowledge_points") or []
    prereq_names = body.get("prerequisite_points") or []
    kp_ids = [str(i) for i in (body.get("selected_knowledge_ids") or [])]
    # 口径：前端直传名称 = 教师选定；无名称但有 ID = 交给知识图谱按边界解析（系统预置）
    source = "teacher" if kp_names else ("kg" if kp_ids else "none")
    prereq_source = "frontend" if prereq_names else "none"
    resolved_ids = []
    parent_ids = []
    # 只要给了 ID 就查图谱（与"是否已传名称"无关）——
    # 修复（2026-09-13，链路验收实测发现）：此前条件是 `not kp_names and kp_ids`，
    # 而前端 `buildKnowledgeScope` **同时**传名称与 ID → 条件恒为假 →
    # **selected_knowledge_ids 被整体忽略、前置知识点从未进入提示词**（"知识面约束"静默失效，
    # 表现为配方里 prereq_source=none）。前置该由图谱给，与"谁选了名称"无关。
    if kp_ids:
        try:
            sc = resolve_knowledge_scope(kp_ids)
            if not kp_names:
                kp_names = sc.get("selected") or []
            if not prereq_names:
                prereq_names = sc.get("prerequisites") or []
                prereq_source = sc.get("prereq_source") or "none"
            resolved_ids = sc.get("selected_ids") or []
            parent_ids = sc.get("parent_ids") or []
        except Exception:
            pass
    # 锚点对（ID ↔ 权威名称）：
    # **ID 是身份，名称是匹配依据** —— 修复（2026-09-13）：anchor_coverage 此前只用
    # "前端传进来的名称"做字符串匹配，一旦知识点在图谱里改名就**静默失配**，
    # 而且命中/缺失无法追溯到具体实体。现在带上 ID，且名称取图谱解析出的**权威名**。
    anchor_pairs = []
    if kp_names:
        if resolved_ids and len(resolved_ids) == len(kp_names):
            anchor_pairs = [{"id": i, "name": n} for i, n in zip(resolved_ids, kp_names)]
        else:
            anchor_pairs = [{"id": "", "name": n} for n in kp_names]

    meta = {
        "source": source,               # teacher=教师锚定 / kg=图谱边界解析 / none=未指定
        "node_ids": kp_ids,             # 教师选的实体 ID（tb_kg_node）
        "resolved_ids": resolved_ids,   # 图谱实际返回的节点 ID
        "knowledge_points": kp_names,
        "prerequisites": prereq_names,
        "prereq_source": prereq_source,  # qian_zhi=前置链 / parent_id=父节点兜底 / frontend / none
        "parent_ids": parent_ids,
        "anchors": anchor_pairs,        # [{id, name}]：ID 为身份，name 为匹配依据（权威名）
    }
    return kp_names, prereq_names, meta


def _resolve_scope(body: dict):
    """解析知识面：优先用前端直传的知识点名称，否则按 ID 从知识图谱取名称+前置。"""
    kp_names, prereq_names, _ = _resolve_scope_meta(body)
    return kp_names, prereq_names


@app.post("/api/ai/lesson-plan/generate")
async def gen_lesson_plan(req: Request):
    """教案生成：返回 {content, curriculum_alignments, material_refs, recommended_materials, knowledge_scope, model, generation_time_ms}。

    - 知识面约束：严格落在所选知识点 + 其前置知识点范围内。
    - 课标备注：map_curriculum 返回建议关联课标条目（仅作备注，不写入正文）。
    - 结构产出：含教学目标/重难点/准备/过程(含每环节时长)/板书/分层作业。
    """
    try:
        body = await req.json()
    except Exception:
        body = {}
    subject = body.get("subject", "语文")
    grade = body.get("grade", "四年级")
    title = body.get("lesson_title", "")
    unit = body.get("textbook_unit", "")
    period = body.get("period", 1) or 1
    template = body.get("format_template", "")
    school_id = body.get("school_id")
    textbook_version = body.get("textbook_version", "")
    extra = (body.get("extra_requirements") or "").strip()
    chat_ctx = (body.get("chat_context") or "").strip()

    kp_names, prereq_names = _resolve_scope(body)
    try:
        curriculum = map_curriculum(body.get("curriculum_codes") or [], subject, grade)
    except Exception:
        curriculum = []

    scope_hint = ""
    if kp_names:
        scope_hint += f"\n本课必须覆盖的知识点（严格在此范围内设计，不超纲）：{', '.join(kp_names)}。"
    if prereq_names:
        scope_hint += f"\n需要用到但未单独列出的前置知识点：{', '.join(prereq_names)}。"
    if not kp_names and not prereq_names:
        scope_hint += "\n未指定知识点，请按教材常规进度设计。"
    if textbook_version:
        scope_hint += f"\n教材版本：{textbook_version}（例题、术语、章节顺序须贴合该版本）。"
    if unit:
        scope_hint += f"\n所属单元：{unit}。"
    scope_hint += f"\n课时：{period} 课时。"
    if template:
        scope_hint += f"\n参考模板要求：{template}。"
    if extra:
        scope_hint += f"\n用户的附加要求/关键词（必须落实）：{extra}。"
    if chat_ctx:
        scope_hint += f"\n用户此前与小微助教沟通中提出的诉求（应融入本课设计）：{chat_ctx}。"

    # 教材知识边界锚定：按 年级/学科/版本/单元 裁剪分片后语义检索 top-N
    boundary_q = (f"{title} {' '.join(kp_names)}").strip() or title
    boundary = await _boundary_block(subject, grade, textbook_version, unit, boundary_q)
    if boundary:
        scope_hint += "\n" + boundary

    prompt = (
        f"你是资深中小学教研员，请为{grade}{subject}《{title}》设计一份可直接用于课堂的正式教案。"
        f"{scope_hint}\n"
        "输出要求（使用 Markdown）：\n"
        "1. 先以「## 一、教学目标」开头，按三维目标写：知识与技能（3~4 条，可观测可检测）、过程与方法、情感态度与价值观。\n"
        "2. 「## 二、教学重难点」：重点 2~3 条、难点 1~2 条，并简述突破方法。\n"
        "3. 「## 三、教学准备」：教具、学具、多媒体资源。\n"
        "4. 「## 四、教学过程」：按课时拆分为若干环节（如 情境导入→新知探究→巩固练习→小结作业），"
        "每个环节用「### 环节名（约 X 分钟）」标注，并写明 教师活动 / 学生活动 / 设计意图。每环节时长之和约为 40~45 分钟×课时数。\n"
        "5. 「## 五、板书设计」：呈现本课知识框架（可用层级或图示文字）。\n"
        "6. 「## 六、作业布置」：分层（基础题 + 提升题），注明时长。\n"
        "7. 内容须严格围绕指定知识点，专业、具体、可操作；避免空话。理科须含典型例题与步骤，文科须含朗读/文本分析/背诵要求。\n"
    )
    start = time.time()
    try:
        content = await call_llm([{"role": "user", "content": prompt}], None, 5000)
    except Exception as e:
        return {"content": f"AI 生成失败：{e}", "curriculum_alignments": [], "material_refs": [], "recommended_materials": [], "knowledge_scope": kp_names, "model": _effective_model(), "generation_time_ms": 0}
    # AI 决定挂载：检索素材库并挑选适宜课件
    material_refs, recommended = [], []
    try:
        material_refs, recommended = await run_in_threadpool(
            _recommend_materials, title, subject, grade, school_id, 3
        )
    except Exception:
        pass
    return {
        "content": content,
        "curriculum_alignments": curriculum,
        "material_refs": material_refs,
        "recommended_materials": recommended,
        "knowledge_scope": kp_names,
        "model": _effective_model(),
        "generation_time_ms": int((time.time() - start) * 1000),
    }


_SKILLS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skills")

# PPT 与 H5 各用专用 Skill 的领域知识（约定 0：课件只能由 Skill 生成，两条链路共用一套）
#
# 2026-09-12 修复：此处与 scripts/generate_seed_coursewares.py 的 skill_rules() 曾是**两套清单**
# （本文件漏了「输出契约 / 字数分拆」）——直接违反下面 _skill_rules() 自己写下的
# 「不得各写一套 prompt」。现对齐为「通用三份 + 专属两份」，两处引用同一套路径。
_SKILL_COMMON = (
    "shared/质量宪法.md",
    "shared/输出契约.md",
    "shared/字数分拆.md",
)
_SKILL_REFS = {
    "ppt": _SKILL_COMMON + (
        "courseware-ppt/references/版式与组件选型.md",
        "courseware-ppt/references/媒介纪律-PPT.md",
    ),
    "h5": _SKILL_COMMON + (
        "courseware-h5/references/场景与互动规范.md",
        "courseware-h5/references/媒介纪律-H5.md",
    ),
}


def _skill_rules(fmt: str) -> str:
    """加载对应 Skill 的领域知识。

    服务器为用户提供生成服务，必须与本地预生成脚本走**同一套 Skill**，
    不得各写一套 prompt——历史上正是因此出现两套相互矛盾的规则。
    规则只在 skills/ 维护（单一事实源），此处不内置副本。
    """
    refs = _SKILL_REFS.get(fmt) or _SKILL_REFS["ppt"]
    chunks = []
    for rel in refs:
        path = os.path.join(_SKILLS_DIR, rel)
        if not os.path.exists(path):
            logging.warning("Skill 领域知识缺失：%s", path)
            continue
        try:
            with open(path, encoding="utf-8") as fh:
                chunks.append(fh.read().strip())
        except Exception as e:
            logging.warning("Skill 领域知识读取失败 %s：%s", path, e)
    # 页面结构模板（**决定产物形态**的那一段）：与本地预生成脚本同源。
    # 2026-09-12 修复：服务端此前漏了它，模型不知道 `VISUAL_JSON` 的结构长什么样 →
    # 线上实测"组件多样性 0 种""把组件类型 quote 当版式"，且**两轮回灌重试毫无改善**
    # （因为缺的是"结构示例"，而重试只能回灌"违规描述"——实测文档早有结论：
    #  "字段说明 ≠ 字段结构，模型需要看到嵌套长什么样"）。
    chunks.append(page_structure(fmt))
    return "\n\n---\n\n".join(chunks)


# Skill 自己的 SKILL.md（声明层）——循环参数等从**声明**读，不在代码里写死。
_SKILL_MD = {"ppt": "courseware-ppt/SKILL.md", "h5": "courseware-h5/SKILL.md"}


def _skill_frontmatter(fmt: str) -> str:
    """读取 SKILL.md 头部 frontmatter。

    原则（2026-09-12 确立）：**SKILL.md 是声明，代码只是执行**。
    凡是"可被声明"的参数（重试上限、门禁开关…）都必须从声明读，
    否则代码里就会长出第二份会漂移的副本——本项目已多次因此踩坑。
    """
    rel = _SKILL_MD.get(fmt)
    if not rel:
        return ""
    try:
        with open(os.path.join(_SKILLS_DIR, rel), encoding="utf-8") as fh:
            txt = fh.read()
    except Exception as e:
        logger.warning("SKILL.md 读取失败 %s：%s", rel, e)
        return ""
    m = re.match(r"^---\n(.*?)\n---", txt, re.DOTALL)
    return m.group(1) if m else ""


def _skill_max_retry(fmt: str) -> int:
    """S4 关卡1 的重试上限（默认 2；实测 2 轮足够收敛到首轮违规 ~3/套）。"""
    m = re.search(r"max_retry\s*:\s*(\d+)", _skill_frontmatter(fmt))
    if not m:
        return 2
    try:
        return max(0, min(5, int(m.group(1))))
    except Exception:
        return 2


# S4 关卡2：AI 内容评审的五层（判据同 skills/shared/质量宪法.md 的「五层质量模型」）
_REVIEW_LAYERS = [
    ("alignment", "对齐", "教的是对的、完整的吗？目标覆盖 / 知识点覆盖 / 课标对齐 / 环节完整 / 教学评一致"),
    ("depth", "深度", "教到足够深了吗？Webb DOK：≥30% 的任务应在 L3-4（分析/推理/迁移），不是照抄记忆"),
    ("load", "负荷", "学生消化得了吗？认知负荷：外部减负、内部分块、相关增强（不堆砌无关信息）"),
    ("media", "呈现", "看得清、学得进吗？Mayer CTML：多媒体、空间邻近、冗余、一致性、信号化"),
    ("correctness", "科学", "内容有错吗？事实 / 术语 / 公式 / 史实 / 数据 / 表述准确性"),
]


async def _content_review(md: str, subject: str, grade: str, title: str) -> dict:
    """S4 关卡2：AI 内容评审（五层质量模型，各项 ≥4 分才算过）。

    为什么单独给评审员一份 rubric：评审是**独立判官**，不能假设它读过生成用的领域知识；
    且判据必须与 `skills/shared/质量宪法.md` 的「五层质量模型」一致（单一事实源）。
    失败不阻断——返回 available=False，由调用方决定是否展示给教师。
    """
    if not md.strip():
        return {"available": False, "reason": "空课件"}
    rubric = "\n".join(f"- `{key}`（{name}）：{desc}" for key, name, desc in _REVIEW_LAYERS)
    review_prompt = (
        f"你是中小学课件质量评审员。请按五层质量模型评审下面这份{grade}{subject}《{title}》课件。\n\n"
        f"评分维度（每项 1~5 分，**4 分及以上 = 合格**）：\n{rubric}\n\n"
        "输出要求：**只输出一个 JSON 对象**，不要解释、不要代码块。结构：\n"
        '{"scores":{"alignment":4,"depth":3,"load":4,"media":4,"correctness":5},'
        '"issues":[{"layer":"depth","severity":"major","detail":"第 5 页只有记忆性问题，建议增加追问"}],"verdict":"pass|fail"}\n\n'
        "判定规则：五项**全部 ≥4** → verdict=pass，否则 fail。\n"
        "issues 只写真实存在的问题（不要凑数），按严重度排序，最多 8 条；"
        "每条必须落到**具体页码 + 问题 + 怎么改**。若确实没问题就给空数组。\n"
        f"\n课件正文：\n{md}\n"
    )
    try:
        raw = await call_llm([{"role": "user", "content": review_prompt}], None, 2000, role="review")
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            return {"available": False, "reason": "评审输出不可解析"}
        data = json.loads(m.group(0))
        scores = {k: v for k, v in (data.get("scores") or {}).items()
                  if isinstance(v, (int, float))}
        got_all = all(key in scores for key, _, _ in _REVIEW_LAYERS)
        passed = bool(got_all and all(scores[key] >= 4 for key, _, _ in _REVIEW_LAYERS)
                      and data.get("verdict") == "pass")
        return {
            "available": True,
            "scores": scores,
            "issues": data.get("issues") or [],
            "passed": passed,
            "pass_criteria": "五项全部 ≥4 分",
            "layers": {name: desc for _, name, desc in _REVIEW_LAYERS},
        }
    except Exception as e:
        logger.warning("关卡2（AI 内容评审）失败：%s", e)
        return {"available": False, "reason": str(e)}


@app.get("/api/ai/knowledge/nodes")
async def knowledge_nodes(version_id: int = 0, dan_yuan: str = "", q: str = "",
                          level: int = -1, limit: int = 300):
    """知识点节点列表 —— 前端**选择器的统一数据源**（2026-09-13）。

    为什么要加它（链路验收查实）：前端选择器此前读**前端静态 JSON**
    （`public/knowledge-graph.json`：168 节点、字符串 ID 如 `m-1-1-1`），
    而后端生成查**本库 tb_kg_node**（5552 节点、int64 ID）→ **ID 体系不同**，
    于是"前端选中的 ID"在后端永远查不到，**前置链/知识面约束在真实操作下从未生效**。
    统一后：选择器给出的 ID 与后端同源 → 前置链、课标、单元归属、溯源配方全部成立。
    另外返回值自带 `version_id` / `unit` —— 即"教材版本 + 单元"两层实体引用，直接可入配方。
    """
    try:
        nodes = await run_in_threadpool(
            list_kg_nodes, version_id or None, dan_yuan or None,
            q or None, (level if level >= 0 else None), limit)
    except Exception as e:
        logger.warning("knowledge/nodes 失败：%s", e)
        return {"nodes": [], "count": 0, "error": str(e)}
    return {"nodes": nodes, "count": len(nodes)}


@app.get("/api/ai/knowledge/units")
async def knowledge_units(version_id: int = 0, limit: int = 200):
    """单元列表（前端单元下拉用；数据源与 knowledge/nodes 同源）。"""
    try:
        units = await run_in_threadpool(list_kg_units, version_id or None, limit)
    except Exception as e:
        logger.warning("knowledge/units 失败：%s", e)
        return {"units": [], "error": str(e)}
    return {"units": units, "count": len(units)}


# ── 生成进度事件表（SSE 进度反馈，2026-09-12）──
# 为什么需要：qwen-plus 的验收质量显著更好（关卡1 ERR 均值 1.67 vs turbo 5.6、页数全达标），
# 但一次生成含重试需 150~200s，而 prod 网关只有 60s → 必被 504 掐断，**连最好的一版都丢**。
# **流式反馈同时解决两件事**：① 教师看到"第 2 次修订中"而不是干等；② 数据持续流动，
# nginx 的 `proxy_read_timeout` 不再触发（这才是"能安全用强模型"的真正前提）。
# 单进程安全性：本服务 `CMD uvicorn api_server:app`（**无 --workers**），故进程内字典足够。
# ⚠ 若将来加多 worker，必须换成 Redis 等共享存储——否则 SSE 与生成落在不同进程，读到空。
_GEN_PROGRESS: "dict[str, dict]" = {}
_GEN_PROGRESS_MAX = 50          # 最多保留 50 个任务，防内存增长


def _note_progress(job_id, stage: str, message: str) -> None:
    """记录一个进度事件（job_id 为空则什么都不做 → 不影响既有调用方）。"""
    if not job_id:
        return
    job = _GEN_PROGRESS.get(job_id)
    if job is None:
        if len(_GEN_PROGRESS) >= _GEN_PROGRESS_MAX:
            for k in sorted(_GEN_PROGRESS, key=lambda x: _GEN_PROGRESS[x]["at"])[:10]:
                _GEN_PROGRESS.pop(k, None)
        job = _GEN_PROGRESS[job_id] = {"events": [], "done": False, "at": time.time()}
    job["events"].append({"stage": stage, "message": message, "elapsed": round(time.time() - job["at"], 1)})
    job["at"] = time.time()


def _finish_progress(job_id) -> None:
    _note_progress(job_id, "done", "生成完成")
    if job_id and job_id in _GEN_PROGRESS:
        _GEN_PROGRESS[job_id]["done"] = True


@app.get("/api/ai/courseware/generate/stream")
async def gen_courseware_stream(job_id: str = ""):
    """SSE 进度反馈。用法：先带 `job_id` 调 POST /api/ai/courseware/generate，
    再开本端点接收各阶段事件（start / retry / gate1 / budget / safety / done）。

    `X-Accel-Buffering: no` 是关键：不加的话 nginx 会缓冲 SSE，前端依然看不到实时事件。
    """
    async def ev():
        sent = 0
        deadline = time.time() + 900     # 15 分钟上限，防连接悬挂
        while time.time() < deadline:
            job = _GEN_PROGRESS.get(job_id)
            if job:
                while sent < len(job["events"]):
                    yield "data: " + json.dumps(job["events"][sent], ensure_ascii=False) + "\n\n"
                    sent += 1
                if job["done"]:
                    yield "event: done\ndata: {}\n\n"
                    return
            else:
                yield ": waiting\n\n"    # SSE 注释行：仅保活，不产生事件
            await asyncio.sleep(0.8)
        yield "event: timeout\ndata: {}\n\n"

    return StreamingResponse(
        ev(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive",
                 "X-Accel-Buffering": "no"},
    )


@app.post("/api/ai/courseware/generate")
async def gen_courseware(req: Request):
    """课件生成（锚点—轨道—边缘 三层模型，允许受控发散）。

    返回 {courseware_markdown, divergence_map, similar_material, recommended_refs, model, generation_time_ms}。
    - 锚点：所选知识点 + 前置（必覆盖，硬约束）。
    - 轨道：可跨界、可适度超纲（±1 年级档、课标对齐±1，受发散预算约束）。
    - 边缘（可选）：价值观/行为/情感，靠互动承载，不污染正文。
    """
    try:
        body = await req.json()
    except Exception:
        body = {}
    subject = body.get("subject", "语文")
    grade = body.get("grade", "四年级")
    title = body.get("lesson_title", "")
    content = body.get("content", "")  # 教案正文 markdown
    job_id = body.get("job_id") or None   # 可选：带上则可用 SSE 接收进度（不带则行为完全不变）
    school_id = body.get("school_id")
    textbook_version = body.get("textbook_version", "")
    extra = (body.get("extra_requirements") or "").strip()
    chat_ctx = (body.get("chat_context") or "").strip()
    divergence_level = body.get("divergence_level", "standard")
    consult_answers = (body.get("consult_answers") or "").strip()
    edge_enabled = bool(body.get("edge_enabled", False))
    edge_categories = body.get("edge_categories") or []
    unit = body.get("textbook_unit", "")
    # 输出格式：ppt 走传统教案式幻灯片；h5 走绘本情景互动页
    fmt = (body.get("format") or "ppt").lower().strip()
    # ── 风格模板（P1）：AI 定风格语义，系统映射到 CwTheme 配色盘 ──
    style_tag = (body.get("style_tag") or "").strip()
    style_profile = (body.get("style_profile") or "").strip()
    style_mode = (body.get("style_mode") or "auto").strip()  # auto | preset | free
    # 个人风格倾向（调节层，2026-09-03 接入）
    # 产品原则：UI 风格服务于「内容 + 风格提示词 + 个人风格倾向」。
    # 优先级：内容（版式/组件的硬约束） > 风格提示词（视觉语言） > 个人风格倾向（默认偏好）。
    # 故 teacher_style 只作倾向提示：未指定风格时充默认，已指定风格时不覆盖。
    teacher_style = (body.get("teacher_style") or "").strip()

    kp_names, prereq_names, scope_meta = _resolve_scope_meta(body)
    budget = divergence_budget(divergence_level)

    # ── 生成配方（溯源，2026-09-13）──
    # 这些值**后端本来就算过**（_resolve_scope_meta 的知识面 + DIVERGENCE_BUDGET 的 ±1 档边界），
    # 此前只喂进提示词、**不回传也不落库** → 编辑页无法回答"这份课件是按什么生成的"，
    # 表现为"左栏与画布脱节"。此处随响应回传，前端落库后即可在编辑页回填「来源」。
    scope_resolved = {
        **scope_meta,
        # 往后边界：orbit/edge 条数 + beyond_band（是否允许 ±1 档外延伸，默认仅 ±1）
        "divergence": {**budget, "level": divergence_level},
        "textbook_version": textbook_version or "",
        # 教材版本**实体引用**（2026-09-13）：前端由知识图谱节点自带 version_id 传入（与后端同源），
        # 可直接作为真实引用落库；此前只有版本名称（字符串），回答不了"按哪个版本解析的"。
        "textbook_version_id": body.get("textbook_version_id") or "",
        "unit": unit or "",
        "model": _effective_model(),   # 复用既有实现（勿另写一份）：库优先、env 兜底
    }

    # 1) 找相近素材（AI 生成新版本的参照）
    similar = None
    recommended_refs = []
    try:
        mats = list_materials(school_id)
        ranked = rank_materials(mats, title, subject, grade, top_k=5)
        if ranked:
            similar = {"id": ranked[0]["id"], "name": ranked[0]["name"], "type": ranked[0]["type"]}
            recommended_refs = [r["id"] for r in ranked[:3]]
    except Exception:
        pass

    # 2) 渲染 + AI 润色：生成针对本课的课件
    similar_hint = ""
    if similar:
        similar_hint = (
            f"\n可参考素材库中已有的相近课件《{similar['name']}》，"
            f"在其结构基础上生成适配本课的“新版”，保持风格一致、内容针对本课。"
        )
    content_block = ""
    if content and content.strip():
        content_block = (
            f"\n可参考的素材（仅供结构与风格借鉴，内容须针对本课重新组织，不要照抄）：\n{content}\n"
        )

    # ── 锚点（硬约束，必覆盖）──
    scope_hint = ""
    if kp_names:
        scope_hint += f"\n【锚点·必须覆盖】以下核心知识点本课课件必须覆盖：{', '.join(kp_names)}。"
    if prereq_names:
        scope_hint += f"\n涉及的前置知识点（可自然带出）：{', '.join(prereq_names)}。"
    # ── 轨道（受控发散：±1 档、可跨界、受预算约束）──
    beyond_txt = "允许在相邻一个年级档内做适度超纲延伸" if budget["beyond_band"] else "不超出本课年级"
    scope_hint += (
        f"\n【轨道·受控发散】在紧扣锚点的前提下，可设计最多 {budget['orbit']} 处「跨界桥接或适度超纲」环节"
        f"以启发思维（如关联相邻学科、真实世界延伸、同级奥数/科学拓展/课外阅读等），"
        f"{beyond_txt}，且跨界桥接的概念其课标对齐也须落在±1档内。"
        f"每一处发散都要能回溯到某个锚点知识点并说明教学理由，禁止无关联的孤儿事实。"
    )
    # 学科原生拓展（B 组）：按学科注入，让轨道区发散更贴学科本真
    orbit_hint = subject_orbit_hint(subject)
    if orbit_hint:
        scope_hint += f"\n学科原生拓展方向：{orbit_hint}"
    if textbook_version:
        scope_hint += f"\n教材版本：{textbook_version}（例题、术语、章节顺序须贴合该版本，边界可适度模糊）。"
    if consult_answers:
        scope_hint += f"\n课前问诊中教师确认的方向（应落实）：{consult_answers}。"
    if extra:
        scope_hint += f"\n用户的附加要求/关键词（必须落实）：{extra}。"
        # ── 场景化课件增强：识别英语对话 / 绘图 / 讲课时长 关键词，注入结构化约束 ──
        extra_lower = extra.lower()
        has_dialogue = any(k in extra_lower for k in ['场景对话', '对话', 'dialogue', 'role-play', 'roleplay', '口语', '情景'])
        has_drawing = any(k in extra_lower for k in ['绘图', '画', 'drawing', '黑板', '白板', '手绘', '示意图'])
        has_duration = any(k in extra_lower for k in ['10分钟', '十分钟', '讲课时长', '时长', 'minute', '分钟'])
        if has_dialogue and ('英语' in extra or 'english' in extra_lower or subject == '英语'):
            scope_hint += (
                "\n【英语场景对话·强制结构】本课件须以「情景对话（role-play）」为主线组织，"
                "至少包含 2~3 个完整对话场景（如购物/问路/就餐/校园生活），每个场景给出："
                "①场景名 + 角色（A/B）；②对话原文（英文+中文释义行）；"
                "③关键句型框（标红重点表达）；④跟读/点读提示句。对话须覆盖课标该年级核心交际功能。"
            )
        if has_drawing:
            scope_hint += (
                "\n【绘图/板书·强制标注】课件中凡需教师现场示范、构图、流程推导的页面，"
                "须在正文后追加一行版式注释 `<!-- draw: 绘图说明 -->`，说明该页建议在投屏白板上"
                "现场绘制什么（如：对话气泡图、句型结构树、场景简笔画），便于教师边讲边画。"
            )
        if has_duration:
            scope_hint += (
                "\n【讲课时长·强制】本课件须满足不少于 10 分钟有效讲课时长："
                "页数不少于 12 页，且须含「热身导入→对话示范→句型操练→小组活动→巩固练习→小结作业」完整节奏，"
                "每页配置可支撑 40 秒以上讲解的具体内容，避免空洞。"
            )
    if chat_ctx:
        scope_hint += f"\n用户此前与小微助教沟通中提出的诉求（应融入课件）：{chat_ctx}。"
    # 教材知识边界锚定：按 年级/学科/版本/单元 裁剪分片后语义检索 top-N
    boundary_q = (f"{title} {' '.join(kp_names)}").strip() or title
    boundary = await _boundary_block(subject, grade, textbook_version, unit, boundary_q)
    if boundary:
        scope_hint += "\n" + boundary
    # ── 边缘（可选：价值观/行为/情感，靠互动承载）──
    if edge_enabled:
        cats = "、".join(edge_categories) if edge_categories else "价值观/行为准则/文化认同"
        scope_hint += (
            f"\n【边缘·轻推】可融入最多 {budget['edge']} 处「{cats}」内容，"
            f"必须以互动/情境体验方式承载（如决策选择、反思提问、角色扮演动画），"
            f"不得说教式灌入正文。{ETHIC_PRINCIPLE}"
        )

    # ── 风格模板（P1）：AI 定风格语义，系统映射到 CwTheme 配色盘 ──
    # 定义受控风格词表，AI 只能从中选，杜绝未知配色/外部风格
    STYLE_TAGS = "、".join([
        "basic(通用结构)", "china(中国风)", "minimal(极简)", "tech(科技)",
        "fresh(清新)", "academic(严谨学术)", "cartoon(卡通)", "flat(扁平)", "business(商务)",
    ])
    if style_tag:
        # 关键修复（2026-09-03）：风格卡 skills/shared/styles/{tag}.md 此前从未进入生成提示词，
        # 模型只拿到一句泛泛引导 → 风格只能换色、骨架不变。此处真正读取风格卡的「骨架形态语言」
        # 并注入，让风格驱动分栏/留白/卡片形态/图形语言（风格的一维），而非仅换色。
        layout_lang = _load_style_layout_language(style_tag)
        scope_hint += (
            f"\n【风格·指定大类】本课件视觉风格须为【{style_tag}】，属于受控风格词表之一：{STYLE_TAGS}。"
            f"请在版式节奏与内容组织上体现该风格（科技风多用双栏/大图/模块化、国风多用留白与韵味、"
            f"极简风要点更精简、卡通风更活泼）。版式标注（<!-- layout -->）仍须从现有版式集合中取，不得自创版式。"
        )
        if layout_lang:
            scope_hint += (
                f"\n【风格·骨架形态语言】这是【{style_tag}】风格在「骨架」维度的硬性约定，"
                f"必须据此选择分栏/留白/卡片形态/图形语言，而不只是换配色：\n{layout_lang}"
            )
        struct_order = _load_style_structure_order(style_tag)
        if struct_order:
            scope_hint += (
                f"\n【风格·结构序】这是【{style_tag}】风格在「内容结构」维度的硬性约定，"
                f"必须据此决定先讲什么、后讲什么与页面顺序，而非只改版式：\n{struct_order}"
            )
        asset_scope_text = _load_style_asset_scope(style_tag)
        if asset_scope_text:
            scope_hint += (
                f"\n【风格·素材范围】这是【{style_tag}】风格允许/禁用的装饰素材（硬约束，禁用项不得出现）：\n{asset_scope_text}"
            )
    if style_profile:
        scope_hint += (
            f"\n【风格·自由描述】用户期望风格：{style_profile}。"
            f"请在受控风格词表（{STYLE_TAGS}）内自行匹配最贴切的风格大类，"
            f"并在课件结构与版式节奏上体现该风格。版式标注仍须从现有版式集合中取。"
        )

    # ── 个人风格倾向（调节层）──
    # 定位：不覆盖上面已确定的风格，只在空白处补默认、或在已定风格内做措辞/节奏微调。
    # 若教师一贯偏好与内容学段冲突（如偏好"卡通"而内容是高中议论文），以内容学段为准。
    if teacher_style:
        if style_tag or style_profile:
            scope_hint += (
                f"\n【个人风格倾向】该教师的一贯偏好：{teacher_style}。"
                f"在不与上述指定风格冲突的前提下自然体现（如措辞习惯、节奏疏密）；"
                f"若与内容学段或指定风格冲突，以学段与指定风格为准，不要生搬。"
            )
        else:
            scope_hint += (
                f"\n【风格·个人倾向】用户本次未指定风格，请参照该教师的一贯偏好：{teacher_style}。"
                f"据此选择最贴切的呈现气质；如该偏好与本科目学段明显不符，以学段为准。"
            )

    # 按输出格式决定内容结构：PPT 用教案式章节；H5 用绘本情景场景
    if fmt == "h5":
        structure_hint = (
            # 口径收口（2026-09-12）：**结构与格式全部由 Skill 领域知识给出**
            # （page_structure / 场景与互动规范 / 输出契约 / 质量宪法 / 媒介纪律）。
            # 本分支只保留"本次特有约束"。历史教训：此处曾写"建议 6~10 页"，而校验器要求
            # 8~16 —— 同一件事两处定义，副本自己腐化后**直接制造违规**。
            "输出要求（本次特有约束）：\n"
            "1. 安全口径（硬约束）：严禁出现商业或外来亚文化符号；严禁对国内各民族做差异化对比呈现。\n"
            "（其余全部——场景数 8~16、页内字数、角色与气泡语法、画面描述、互动标记、"
            "受控版式 8 类与选型节奏、故事线组织——以上文【Skill 领域知识】为准。"
            "本段不重复定义数字与集合，避免两处口径不一致。）\n"
        )
    else:
        structure_hint = (
            # 口径收口（2026-09-12）：页数/章节顺序/内容原则/版式集合/版式×字长/组件字段契约与
            # 完整示例/互动标记/骨架节奏/占位符禁忌，**全部只在 Skill 文档里定义一份**。
            # 本分支只留"本次特有约束"——历史教训：两处并存时模型会抄到本段那个"缺组件的示例"，
            # 于是整节课 0 个组件，并把组件类型名（quote/sequence）当 layout 写。
            "输出要求（本次特有约束）：\n"
            "1. 时长匹配：按课时总时长反推页数与密度，每页都要有足以支撑 2~4 分钟讲解/活动的具体内容，避免整页空泛。\n"
            "2. 发散内容（跨界/超纲/边缘）须自然融入，不喧宾夺主。\n"
            "3. 安全口径（硬约束）：严禁出现商业或外来亚文化符号；严禁对国内各民族做差异化对比呈现。\n"
            "（其余全部——页数与章节顺序、内容原则、版式集合与版式×字长、组件字段契约与完整示例、"
            "互动标记、骨架节奏、占位符禁忌、字号与层次——以上文【Skill 领域知识】为准。"
            "本段不重复定义，避免两处口径不一致。）\n"
        )

    # Skill 领域知识：PPT / H5 各自加载专用 Skill 的规则（约定 0：唯一生成路径）
    skill_rules = _skill_rules(fmt)

    prompt = (
        f"你是资深中小学课件设计专家，善于把一节课设计得“充实但不冗长、恰到好处”，"
        f"并能在守住院点的前提下适度发散以启发学生思维。"
        f"请为{grade}{subject}《{title}》设计一份可直接用于课堂投屏的课件。"
        f"{similar_hint}{content_block}{scope_hint}\n\n"
        f"【课件生成 Skill · 领域知识（必须遵守）】\n{skill_rules}\n\n"
        f"{structure_hint}"
    )
    start = time.time()
    base_prompt = prompt
    max_retry = _skill_max_retry(fmt)   # 声明化：来自 SKILL.md frontmatter
    best = None                         # (违规数, md, meta, report, dropped)
    quality_notes = []

    # 进度事件：既进 quality_notes（随响应返回，便于事后追溯），也进 SSE 表（教师实时可见）
    def prog(stage: str, message: str) -> None:
        quality_notes.append(message)
        _note_progress(job_id, stage, message)

    prog("start", f"提示词已组装（{len(prompt)} 字，其中 Skill 领域知识 {len(skill_rules)} 字），开始生成")

    # ── 时间预算守卫（2026-09-12）──
    # 背景（实测，2026-09-12 修正）：qwen-turbo 单次尝试 ~12s、qwen-plus ~50s；
    # 此前把"整请求含 3 次重试的 175s"误记为单次耗时，特此更正。而"1~3 次重试"叠加后，
    # 强模型必然逼近/超过网关超时（nginx proxy_read_timeout）。**被网关掐断的代价是
    # 连最好的一版都拿不到**——教师白等几分钟、一个字都看不到。
    # 故主动设预算：若"再来一轮"会越过预算，就停手，把当前最好版交出去。
    # 预算须 **小于** 网关超时（staging 已达 300s；prod 仍 60s → 用强模型前必须一并调整）。
    budget_s = float(os.getenv("CW_GEN_BUDGET_S", "240"))
    for attempt in range(max_retry + 1):
        attempt_started = time.time()
        try:
            raw = await call_llm([{"role": "user", "content": prompt}], None, 6000)
        except Exception as e:
            if best is None:
                md, meta = split_output(f"# {title}\n\n（AI 课件生成失败：{e}）\n\n{content}")
                best = (0, md, meta, {"issues": [], "pages": 0}, [])
            quality_notes.append(f"生成失败：{e}")
            _note_progress(job_id, "error", f"生成失败：{e}")
            break

        # a. 两段式剥离（输出契约要求 `<<<COURSEWARE>>>` / `<<<META>>>`，不剥离会显示给学生）
        md, meta = split_output(raw)

        # b. VISUAL base64 编码：**平台必须兜底的一步**（模型写不了 base64，而前端
        #    `markdownToOutline` 只认 `<!-- VISUAL:base64 -->`，不认 VISUAL_JSON）。
        #    此前服务端从未做这一步 → 线上 PPT 的可视化组件前端解析不到、退化成正文。
        #    H5 按契约不应有 VISUAL，故不编码（保持 VISUAL_JSON 交 mdToStory 处理）。
        bad_visuals = []
        if fmt != "h5":
            md, bad_visuals = encode_visuals(md)

        # c. 注释白名单兜底：白名单外的注释会原样显示给学生
        md, dropped = strip_unknown_comments(md)

        # d. S4 关卡1（自动规则）：判据来自质量宪法与版式选型，与本地脚本同一份实现
        report = check_markdown(md, f"{title}__{fmt}", subject)
        errs = [i for i in report["issues"] if i[0] == "ERR"]
        # 保留违规最少的一版：重生成是全新产出，可能比上一版更差（实测 10→5→9 反弹）
        if best is None or len(errs) < best[0]:
            best = (len(errs), md, meta, report, dropped)
        if not errs:
            prog("gate1", f"关卡1 通过（{report.get('pages', 0)} 页，0 处违规）")
            break
        if attempt < max_retry:
            elapsed = time.time() - start
            cost = time.time() - attempt_started
            if elapsed + cost > budget_s:
                prog("budget",
                     f"时间预算不足（已用 {elapsed:.0f}s + 本轮 {cost:.0f}s > 预算 {budget_s:.0f}s）："
                     f"停止重试，返回最好一版（{best[0]} 处违规）")
                break
            prog("retry", f"第 {attempt + 1} 次关卡1 未过（{len(errs)} 处），已回灌重生成")
            prompt = retry_prompt(base_prompt, report, bad_visuals, md)
        else:
            prog("gate1", f"已达重试上限，仍有 {len(errs)} 处违规（保留最好一版：{best[0]} 处）")

    _, courseware, meta, report, dropped_comments = best
    if dropped_comments:
        logger.warning("已剥离白名单外注释（会显示成乱码）：%s", dropped_comments)

    # 3) 红线闸（**生成时就跑**，不等发布）+ 命中 block 即自动修正一次
    #    · 为什么提前：此前只在 /validate（发布）跑，教师改完才知道违规；红线应当越早发现越好。
    #    · 为什么独立模型：同模型会放过自己写下的擦边内容（共享同一套价值判断）——
    #      这是红线与"质量评审"最大的不同，红线**绝不能自评**。
    #    · 不改产品决议："发布才强制拦截"仍然成立，草稿永远可编辑；此处只是生成时自纠。
    safety_ctx = {"subject": subject, "grade": grade}
    safety = await run_in_threadpool(policy_gate_publish, courseware, safety_ctx, _call_llm_safety)
    _blocks = [i for i in safety.get("issues", []) if i.get("level") == "block"]
    # 自动修正要再花一次生成（plus 下 ~175s）→ 同样受时间预算约束，避免把请求拖过网关超时
    if _blocks and (time.time() - start) > budget_s * 0.6:
        quality_notes.append(
            f"红线命中 {len(_blocks)} 处，但剩余时间不足（已用 {time.time() - start:.0f}s / 预算 "
            f"{budget_s:.0f}s），**未自动修正**，请人工确认后再发布")
        _blocks = []
    if _blocks and courseware.strip().startswith("#"):
        safety_fix = (
            "\n\n[红线闸未通过：必须修改以下内容后，**完整重新输出**]\n"
            + "\n".join(f"  - {b.get('keyword') or b.get('type')}：{b.get('message', '')}"
                        for b in _blocks[:10])
            + "\n要求：移除或改写上述内容，改用与知识点直接相关的中性案例；"
              "**不要**因为回避而删掉该页的教学内容本身。"
              "修订后完整输出 COURSEWARE 与 META 两段，不要解释。\n"
        )
        try:
            # 修复（2026-09-13）：此处显式传 GEN_MODEL（静态）会**绕过通道配置** ——
            # 结果是"主生成走 plus、红线修正走 turbo"两套模型。改传 None，与主生成同源。
            raw_fix = await call_llm([{"role": "user", "content": base_prompt + safety_fix}],
                                     None, 6000)
            md_fix, meta_fix = split_output(raw_fix)
            if fmt != "h5":
                md_fix, _ = encode_visuals(md_fix)
            md_fix, _ = strip_unknown_comments(md_fix)
            if md_fix.strip():
                recheck = await run_in_threadpool(
                    policy_gate_publish, md_fix, safety_ctx, _call_llm_safety)
                if recheck.get("pass"):
                    courseware, meta = md_fix, meta_fix
                    report = check_markdown(md_fix, f"{title}__{fmt}", subject)
                    safety = recheck
                    quality_notes.append(f"红线闸命中 {len(_blocks)} 处，已自动修正并通过")
                else:
                    quality_notes.append(
                        f"红线闸命中 {len(_blocks)} 处，自动修正后仍未全过（保留原版，需人工确认）")
        except Exception as e:
            logger.warning("红线自动修正失败：%s", e)
            quality_notes.append(f"红线自动修正失败：{e}")

    # 4) 提取发散地图（divergence_map）：用**剥离后**的正文，避免 META 的 JSON 污染提取
    divergence_map = await _extract_divergence(courseware)

    # 5) 零算力质量信号：**锚点覆盖率**（用代码替代模型评"对齐"）
    #    匹配依据只能是**名称**（成品是自然语言，按文字命中），但**身份用 ID 标注**：
    #    修复（2026-09-13）——名称取图谱解析出的**权威名**（不再用前端传的字符串），
    #    且命中/缺失都附 ID，于是"哪个知识点实体没被覆盖"可追溯；
    #    此前只用前端名称做匹配 → 图谱改名即静默失配，且看不出命中的是哪个实体。
    #    不需要模型算力，可复现、可审计（对照质量宪法 A2：覆盖 ≥90%）。
    anchors = scope_meta.get("anchors") or [{"id": "", "name": n} for n in kp_names]
    anchor_coverage = None
    if anchors:
        def _hit(a):
            n = (a.get("name") or "").strip()
            return bool(n) and n in courseware
        hit_n = sum(1 for a in anchors if _hit(a))
        tot = len(anchors)
        anchor_coverage = {
            "covered": hit_n,
            "total": tot,
            "ratio": round(hit_n / max(1, tot), 3),
            "missing": [a["name"] for a in anchors if not _hit(a)][:10],      # 兼容原字段
            "missing_ids": [a["id"] for a in anchors if not _hit(a)][:10],    # 新增：可追溯实体
            "anchors": [{"id": a["id"], "name": a["name"], "hit": _hit(a)} for a in anchors],
            "passed": hit_n / max(1, tot) >= 0.9,
        }

    # 6) S4 关卡2：AI 内容评审（**默认关闭**，按需开启）
    #    产品原则（2026-09-12）：**算力优先给生成器**。同模型自评有共同盲区 + 自偏好，
    #    且它拿不到外部标尺（课标/教案），"对齐"分数其实没有依据。代码保留供抽检/调参，
    #    但默认不烧算力：body.content_review=true 或环境变量 CW_ENABLE_REVIEW=1 才跑。
    want_review = bool(body.get("content_review")) or REVIEW_ENABLED_DEFAULT
    if want_review:
        content_review = await _content_review(courseware, subject, grade, title)
    else:
        content_review = {
            "available": False,
            "reason": "按配置关闭（算力优先给生成器；如需开启：body.content_review=true）",
        }

    _errs = [i for i in report.get("issues", []) if i[0] == "ERR"]
    _warns = [i for i in report.get("issues", []) if i[0] == "WARN"]

    # 7) 进度收尾：SSE 侧据此结束等待（无 job_id 时为空操作）
    _finish_progress(job_id)
    quality_notes.append(f"生成完成：{len(_errs)} 处违规，耗时 {time.time() - start:.0f}s")

    return {
        "courseware_markdown": courseware,
        "style_dna": meta.get("style_dna") if isinstance(meta, dict) else None,
        "decor_refs": meta.get("decor_refs") if isinstance(meta, dict) else None,
        # 生成配方（溯源，2026-09-13）：本次知识面（source=teacher/kg + 前置来源）+ 发散边界
        # （orbit/edge/beyond_band，即"往后不超过 ±1 档"）+ 教材版本/单元/模型。
        # 前端**须随产物一起落库**；否则编辑页仍无法回答"这份课件按什么生成的"（即"脱节"根因）。
        "scope_resolved": scope_resolved,
        # S4 关卡1 结果：草稿永远可编辑（约定：只有发布才强制拦截），此处**只报告不阻断**，
        # 让教师看到"哪里不合规"，也让前端能把 issues 展示成可点改的清单。
        "quality_report": {
            "passed": not _errs,
            "pages": report.get("pages", 0),
            "error_count": len(_errs),
            "warning_count": len(_warns),
            "errors": [{"item": a, "detail": c} for _, a, c in _errs[:30]],
            "warnings": [{"item": a, "detail": c} for _, a, c in _warns[:20]],
            "notes": quality_notes,
            "max_retry": max_retry,
            # 零算力信号：锚点覆盖率（替代模型评"对齐"）
            "anchor_coverage": anchor_coverage,
            # 红线闸（合规/安全）：**生成时**就给出，不等发布——教师当场能看到。
            # block 级会阻止"发布进素材库"（/validate 同口径），warn 仅提醒。
            "safety": {
                "passed": bool(safety.get("pass")),
                "block_count": sum(1 for i in safety.get("issues", []) if i.get("level") == "block"),
                "warn_count": sum(1 for i in safety.get("issues", []) if i.get("level") == "warn"),
                "issues": safety.get("issues", [])[:20],
            },
        },
        "divergence_map": divergence_map,
        # S4 关卡2 结果（默认关闭）。开启时同样只报告不阻断。
        "content_review": content_review,
        "similar_material": similar,
        "recommended_refs": recommended_refs,
        "style_tag": style_tag,
        "style_profile": style_profile,
        "color_palette": _courseware_palette(subject, grade, style_tag),
        "model": _effective_model(),
        "generation_time_ms": int((time.time() - start) * 1000),
    }


async def _extract_divergence(courseware: str) -> list:
    """从课件 Markdown 提取发散地图（轨道/边缘），供教师审阅。失败返回空。"""
    if not courseware:
        return []
    try:
        dm_prompt = (
            "以下是刚生成的课件 Markdown。请提取其中所有「发散内容」"
            "（即超出核心知识点、属于跨界桥接/适度超纲/价值观行为情感拓展的部分），"
            "返回 JSON 数组，每项 {\"zone\":\"orbit\"|\"edge\", \"content\":简短摘述, "
            "\"anchor\":对应的核心知识点, \"rationale\":设计理由, \"warn\":是否疑似超出±1年级档或课标对齐范围(bool)}；"
            "若没有发散内容返回 []。只输出 JSON 数组。"
            f"\n课件：\n{courseware}\n"
        )
        dm_raw = await call_llm([{"role": "user", "content": dm_prompt}], None, 1500)
        m = re.search(r"\[.*\]", dm_raw, re.DOTALL)
        if m:
            divergence_map = json.loads(m.group(0))
            if isinstance(divergence_map, list):
                return divergence_map
    except Exception:
        pass
    return []


def _fallback_ppt(markdown: str, title: str) -> list:
    """render-ppt 的兜底：按 ## 章节拆为幻灯片（无 AI 时仍可用）。"""
    slides = [{"kind": "cover", "title": title, "bullets": [], "notes": ""}]
    cur_title = ""
    buf: list[str] = []
    for line in markdown.split("\n"):
        if line.startswith("## "):
            if cur_title or buf:
                slides.append({"kind": "content", "title": cur_title or "课件",
                               "bullets": [b.strip("-* ").strip() for b in buf if b.strip()],
                               "notes": ""})
            cur_title = line[3:].strip()
            buf = []
        elif line.strip():
            buf.append(line.strip())
    if cur_title or buf:
        slides.append({"kind": "content", "title": cur_title or "课件",
                       "bullets": [b.strip("-* ").strip() for b in buf if b.strip()],
                       "notes": ""})
    return slides


# ── 实时生成配色快照（styleDNA）──
# 历史问题：gen_courseware / render-ppt 从不产出配色，导致新生成课件 color_root 为空，
# 前端 resolveTheme 退化为固定 DEFAULT_THEME（经典深蓝），所有新 PPT 色彩单一。
# 这里依据 学科/年级/风格 确定性派生一套配色，由前端存为 color_root（styleDNA 优先于 theme_id）。
# 纯本地计算、零额外 AI 开销；同科目多课件按 (学科+年级+风格) 做微抖动避免雷同。
_SUBJECT_HUE = {
    "语文": 350, "数学": 215, "英语": 165, "物理": 230, "化学": 25,
    "生物": 120, "历史": 32, "地理": 190, "政治": 0, "美术": 290,
    "音乐": 275, "体育": 12, "信息技术": 205, "科学": 140,
}
_STYLE_TONE = {
    "china": (0, 0.10, -0.05), "tech": (0, 0.15, 0.02), "fresh": (0, -0.05, 0.10),
    "minimal": (0, -0.20, -0.02), "academic": (0, -0.15, -0.03), "cartoon": (0, 0.20, 0.05),
    "flat": (0, -0.05, 0.0), "business": (0, -0.18, -0.04),
}
# ── 风格色相表（2026-09-03 修复）────────────────────────────────────────
# 历史缺陷：上表每个风格的色相增量 dh 全为 0，导致「风格对色相零影响」——
# 色相只由学科决定，同一篇课件用 tech/cartoon/china 生成会落在同一个色系，
# 实测 primary 分别为 #E03467 / #E82A69 / #CF3A78，全是粉紫。
# 这与产品原则「UI 风格服务于内容 + 风格提示词 + 个人风格倾向」直接冲突：
# 用户选了风格，视觉却毫无变化。
#
# 取值依据：对齐 skills/shared/styles/*.md 风格卡描述的色彩倾向与禁忌，
# 并刻意拉开彼此角距离，保证 8 种风格肉眼可分：
#   cartoon 活泼→品红 / china 国风→朱红赭石 / fresh 清新→青绿 / flat 扁平→青
#   tech 科技→青蓝 / minimal 极简→灰蓝(低饱和) / academic 严谨→深蓝 / business 商务→蓝紫
_STYLE_HUE = {
    "china": 10, "fresh": 140, "flat": 170, "tech": 195,
    "minimal": 220, "academic": 245, "business": 270, "cartoon": 330,
}
# 说明：色相由「风格」独占决定，学科不再拉扯色相。
# 形态字典 morph（2026-09-03）：风格不只换色，还给出疏密/动效/装饰母题，
# 随 styleDNA 一并落库；与前端 STYLE_PREFIX_MORPH / courseware-h5 的 StyleMorph 同构。
_STYLE_MORPH = {
    "china":     {"density": "tight",  "motion": "calm",      "motif": "classroom"},
    "tech":      {"density": "tight",  "motion": "energetic", "motif": "urban"},
    "fresh":     {"density": "loose",  "motion": "lively",    "motif": "nature"},
    "minimal":   {"density": "normal", "motion": "calm",      "motif": "classroom"},
    "academic":  {"density": "normal", "motion": "lively",    "motif": "classroom"},
    "cartoon":   {"density": "loose",  "motion": "energetic", "motif": "playful"},
    "flat":      {"density": "normal", "motion": "lively",    "motif": "playful"},
    # 2026-09-12 对齐前端 styleRegistry（单一事实源）：此前 business 写 tight/urban，
    # 与前端 normal/classroom 不一致 → 同一风格两端拿到不同形态（漂移实例）。
    "business":  {"density": "normal", "motion": "calm",      "motif": "classroom"},
    "":          {"density": "normal", "motion": "lively",    "motif": "playful"},
}


def _warn_unknown_style(style: str) -> dict:
    """风格认不出时的**显式**兜底（禁止静默回落 · 2026-09-12）。

    回落到默认值本身没错——错在"悄悄回落"：所有异常都收敛成同一个样子，
    从产出上看就是"所有课件长得一样"，且无法定位是哪一环漏了。
    故此处必须留痕（日志），让"风格没生效"可被观测、可被追责。
    """
    logger.warning("未知风格 %r：已回落默认 morph（请检查风格词表是否漏登记）", style)
    return _STYLE_MORPH[""]
# 风格卡目录（skills/shared/styles/*.md）：含 semantic 语义层与「骨架形态语言」段
_STYLES_DIR = os.path.join(os.path.dirname(__file__), "skills", "shared", "styles")


def _load_style_layout_language(style_tag: str) -> str:
    """读取风格卡的『骨架形态语言』段并注入生成 prompt。

    历史缺陷（2026-09-03）：风格卡语义层从未进入生成提示词，模型只拿到 style_tag 名字 +
    一句泛泛引导 + color_seed 决定的配色 → 风格只能换色、骨架不变。
    此函数让风格真正驱动分栏/留白/卡片形态/图形语言（风格的一维），而非仅换色。
    """
    if not style_tag:
        return ""
    path = os.path.join(_STYLES_DIR, f"{style_tag}.md")
    if not os.path.isfile(path):
        return ""
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except Exception:
        return ""
    m = re.search(r"##\s*骨架形态语言[\s\S]*?(?=\n##\s|\Z)", text)
    return m.group(0).strip() if m else ""


def _load_style_structure_order(style_tag: str) -> str:
    """读取风格卡的『结构序』段并注入生成 prompt。

    动机（2026-09-11）：风格不止"长什么样"（骨架形态语言），还有"先讲什么、后讲什么"——
    内容的结构序（起承转合 / 问题→证据→结论 / 定义→例题→归纳…）本身就是风格的一维。
    此前生成端只注入版式骨架、不改内容顺序 → 所有风格产出同一套结构序（"一个头面"的更深根因）。
    """
    if not style_tag:
        return ""
    path = os.path.join(_STYLES_DIR, f"{style_tag}.md")
    if not os.path.isfile(path):
        return ""
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except Exception:
        return ""
    m = re.search(r"##\s*结构序[\s\S]*?(?=\n##\s|\Z)", text)
    return m.group(0).strip() if m else ""


# 风格结构化片段（asset_scope + 母题禁忌）：与前端 visualAsset 共用同一份，放此处保证容器内可达
_STYLE_RULES_JSON = os.path.join(_STYLES_DIR, "asset_scope.json")


def _load_style_asset_scope(style_tag: str) -> str:
    """读取风格卡结构化片段（asset_scope.json）并格式化为 prompt 可用的素材范围说明。

    为什么：asset_scope 此前只存在于各风格 .md 的 YAML 里、**从未进入生成提示词**，
    模型选素材时没有"该风格常用/可用/禁用"的约束（交通灯被塞进《观潮》即此类问题）。
    本函数让服务端与前端（visualAsset/motifPools）消费**同一份结构化规则**。
    """
    if not style_tag:
        return ""
    try:
        with open(_STYLE_RULES_JSON, encoding="utf-8") as fh:
            rules = json.load(fh)
    except Exception:
        return ""
    s = (rules.get("styles") or {}).get(style_tag)
    if not s:
        return ""
    scope = s.get("assetScope") or {}
    motif = s.get("motif") or {}
    lines = []
    if scope.get("常用"):
        lines.append("常用素材：" + "、".join(map(str, scope["常用"])))
    if scope.get("可用"):
        lines.append("可用素材：" + "、".join(map(str, scope["可用"])))
    if scope.get("禁用"):
        lines.append("禁用素材：" + "、".join(map(str, scope["禁用"])))
    for k, v in (scope.get("学科收敛") or {}).items():
        lines.append(f"  学科收敛·{k}：{v}")
    if motif.get("vetoGlyphs"):
        lines.append("禁用母题元素：" + "".join(map(str, motif["vetoGlyphs"])))
    if motif.get("reasons"):
        lines.append("理由：" + str(motif["reasons"]))
    return "\n".join(lines)
# 依据产品原则（2026-09-03）：UI 风格服务于「内容 + 风格提示词 + 个人风格倾向」
# ——内容决定用哪种版式/组件（结构层），风格决定长什么样（视觉层）。
# 若让学科色相也参与色相计算，会把 tech/minimal/academic/business 这些
# 本就邻近的「专业向」风格全部拉向学科色相而挤成一团（实测 academic 与 business
# 仅差 1°，肉眼完全无法区分）。故学科只在「未指定风格」时决定色相，
# 指定风格时学科仅参与饱和/明度的确定性抖动，保证同风格视觉一致、不同风格可分辨。
# 8 种风格角距均 ≥25°：330/10/140/170/195/220/245/270。


def _hsv_to_hex(h: float, s: float, v: float) -> str:
    h = h % 360
    r, g, b = colorsys.hsv_to_rgb(h / 360.0, max(0.0, min(1.0, s)), max(0.0, min(1.0, v)))
    return "#%02X%02X%02X" % (round(r * 255), round(g * 255), round(b * 255))


def _courseware_palette(subject: str, grade: str, style_tag: str) -> dict:
    """依据学科/年级/风格确定性派生 styleDNA 配色（前端存 materials.color_root）。

    色相规则（2026-09-03 修复，对应产品原则「UI 风格服务于内容+风格提示词+个人倾向」）：
      - 指定了风格 → 以该风格色相为主导，向学科色相方向让渡 (1 - WEIGHT) 的角差
      - 未指定风格 → 直接用学科色相（保持原有行为）
    """
    subj = (subject or "").strip()
    style = (style_tag or "").strip()
    base_hue = _SUBJECT_HUE.get(subj, 210)
    dh, ds, dv = _STYLE_TONE.get(style, (0, 0, 0))
    # 确定性微抖动（zlib.crc32 跨进程稳定，避免 PYTHONHASHSEED 导致每次重启漂移）
    jitter = (zlib.crc32(f"{subj}|{grade}|{style}".encode()) % 31) - 15  # -15..+15
    style_hue = _STYLE_HUE.get(style)
    if style_hue is None:
        # 未指定风格：沿用学科色相 + 抖动（保持历史行为不变）
        hue = base_hue + dh + jitter
        sat = 0.62 + ds
        val = 0.86 + dv
    else:
        # 指定风格：色相由风格独占决定，不再受学科拉扯、也不受抖动扰动——
        # 这样同风格课件视觉一致，不同风格角距稳定 ≥25°，肉眼可分。
        # 学科差异改由饱和/明度的确定性抖动承载，兼顾"同学科同风格"的细微区分。
        hue = style_hue
        sat = max(0.15, min(0.95, 0.62 + ds + jitter / 200.0))
        val = max(0.50, min(0.98, 0.86 + dv + jitter / 300.0))
    primary = _hsv_to_hex(hue, sat, val)
    accent = _hsv_to_hex(hue + 28, min(0.85, sat + 0.08), min(0.92, val + 0.02))
    cover = _hsv_to_hex(hue, min(0.8, sat + 0.05), val)
    light = _hsv_to_hex(hue + 10, max(0.15, sat - 0.35), 0.95)
    footer = _hsv_to_hex(hue, sat, min(0.8, val - 0.04))
    bullet = _hsv_to_hex(hue + 28, min(0.85, sat + 0.08), min(0.9, val))
    return {
        "colors": {
            "primary": primary,
            "accent": accent,
            "body": "#333333",
            "subtle": "#777777",
            "coverBg": cover,
            "lightText": light,
            "footer": footer,
            "bullet": bullet,
        },
        # 禁止静默回落（2026-09-12）：风格认不出时必须报出来，否则所有异常都伪装成
        # "同一个默认样子"——这正是历史上"清一色/一个头面"的生成机制。
        "morph": dict(_STYLE_MORPH.get(style) or _warn_unknown_style(style)),
    }


@app.post("/api/ai/courseware/consult")
async def courseware_consult(req: Request):
    """课前问诊：返回 2~3 个针对性问题，教师逐项作答后作为约束传入生成。"""
    try:
        body = await req.json()
    except Exception:
        body = {}
    questions = policy_consult({
        "subject": body.get("subject", "语文"),
        "grade": body.get("grade", "四年级"),
        "lesson_title": body.get("lesson_title", ""),
        "knowledge_points": body.get("knowledge_points") or [],
    }, _call_llm)
    return {"questions": questions}


@app.post("/api/ai/courseware/validate")
async def courseware_validate(req: Request):
    """发布校验（平台红线锁）：对课件 Markdown 做负面清单 + 轻量复核，指出问题并提醒修改。

    草稿永远可编辑；只有「发布进素材库」才调用本端点。不过则列出问题，教师修改后重发。
    kind=courseware（默认）走课件红线；kind=notice（家校宣发）额外执行官方安全口径校验。
    """
    try:
        body = await req.json()
    except Exception:
        body = {}
    text = body.get("markdown", "")
    kind = (body.get("kind") or "courseware").strip().lower()
    if kind == "notice":
        result = policy_gate_notice(
            text,
            {"subject": body.get("subject", ""), "grade": body.get("grade", "")},
            _call_llm,
        )
    else:
        result = policy_gate_publish(
            text,
            {"subject": body.get("subject", ""), "grade": body.get("grade", "")},
            _call_llm,
        )
    return result


# ── LLM 通道管理（运营可维护 · 热生效 · 2026-09-12）──────────────────
# 设计：**能力在本服务，控制权将来挂到 cloud.ziwi.cn**（那边只需调下面这些接口）。
# 安全：api_key **只接受写入、永不回传明文**（一律脱敏）。
@app.get("/api/ai/llm/config")
async def llm_config_status():
    """查看各角色当前生效的通道（含来源 db / env）。密钥已脱敏。"""
    roles = ("gen", "review", "safety")
    eff = {}
    for r in roles:
        ch = channel_for(r)
        eff[r] = {"base_url": ch["base_url"], "model": ch["model"],
                  "source": ch["source"], "has_api_key": bool(ch["api_key"])}
    st = _llm_channel_status(env_fallback=eff)
    st["effective"] = eff
    st["models"] = {r: eff[r]["model"] for r in roles}
    return st


@app.post("/api/ai/llm/config")
async def llm_config_save(req: Request):
    """写入某角色通道配置（upsert）。

    api_key 留空 = 保留原值（避免改模型名时把密钥清空）；传 "CLEAR" = 清空并回落 env。
    """
    try:
        body = await req.json()
    except Exception:
        body = {}
    role = (body.get("role") or "").strip()
    try:
        saved = _llm_channel_save(
            role,
            base_url=body.get("base_url"),
            model=body.get("model"),
            api_key=body.get("api_key"),
            enabled=bool(body.get("enabled", True)),
            updated_by=body.get("updated_by"),
        )
    except Exception as e:
        return {"ok": False, "error": str(e)}
    refresh_channels(force=True)          # 立即生效，不等 TTL
    return {"ok": True, "saved": saved, "effective_model": channel_for(role)["model"]}


@app.post("/api/ai/llm/test")
async def llm_config_test(req: Request):
    """连通性测试：对指定角色发一句最短请求，返回耗时与错误。"""
    try:
        body = await req.json()
    except Exception:
        body = {}
    role = (body.get("role") or "gen").strip()
    ch = channel_for(role)
    t0 = time.time()
    base = {"role": role, "source": ch["source"], "model": ch["model"], "base_url": ch["base_url"]}
    try:
        out = await call_llm([{"role": "user", "content": "ping"}], None, 16, role=role)
        return {**base, "ok": True, "latency_ms": int((time.time() - t0) * 1000),
                "reply": (out or "").strip()[:40]}
    except Exception as e:
        return {**base, "ok": False, "latency_ms": int((time.time() - t0) * 1000),
                "error": str(e)}


@app.post("/api/ai/llm/reload")
async def llm_config_reload():
    """强制刷新配置缓存（多实例时让其他实例立即生效）。"""
    refresh_channels(force=True)
    return {"ok": True, "models": {r: channel_for(r)["model"] for r in ("gen", "review", "safety")}}


@app.on_event("startup")
async def _startup_llm_channel():
    """启动时建表并预热通道配置（失败不阻断服务：沿用 env）。"""
    try:
        _llm_channel_ensure()
        refresh_channels(force=True)
        logger.info("LLM 通道就绪：%s",
                    {r: f"{channel_for(r)['model']}@{channel_for(r)['source']}"
                     for r in ("gen", "review", "safety")})
    except Exception as e:
        logger.warning("LLM 通道初始化失败（沿用 env）：%s", e)


_NOTICE_SKILL_REFS = ("courseware-notice/SKILL.md",
                      "courseware-notice/references/家校宣发规范.md")


def _notice_skill_rules() -> str:
    """加载 courseware.notice Skill 领域知识（与本地文件单一事实源）。"""
    chunks = []
    for rel in _NOTICE_SKILL_REFS:
        path = os.path.join(_SKILLS_DIR, rel)
        if not os.path.exists(path):
            logging.warning("notice Skill 领域知识缺失：%s", path)
            continue
        try:
            with open(path, encoding="utf-8") as fh:
                chunks.append(fh.read().strip())
        except Exception as e:
            logging.warning("notice Skill 领域知识读取失败 %s：%s", path, e)
    return "\n\n---\n\n".join(chunks)


@app.post("/api/ai/notice/generate")
async def notice_generate(req: Request):
    """家校宣发 H5 草稿生成（courseware.notice Skill，2026-09-03）。

    输入：{title, topic(场景码), school_name, department, teacher_name, extra}
    输出：{markdown, topic, issues, pass}。生成后即跑 notice 红线预检，
    提示口径问题（不阻断；发布时后端会强制再过闸）。
    """
    try:
        body = await req.json()
    except Exception:
        body = {}
    title = (body.get("title") or "").strip()
    topic = (body.get("topic") or "notice").strip()
    school = (body.get("school_name") or "本校").strip()
    dept = (body.get("department") or "德育处").strip()
    teacher = (body.get("teacher_name") or "").strip()
    extra = (body.get("extra") or "").strip()
    if not title:
        return {"markdown": "", "topic": topic, "issues": [], "pass": True,
                "error": "请填写宣发标题（主题）"}
    skills = _notice_skill_rules()
    date_hint = time.strftime("%Y年%m月%d日")
    user_brief = (
        f"请为《{title}》起草一份家校宣发 H5 的 Markdown 稿。\n"
        f"发布主体：{school} {dept}（{date_hint}）"
        + (f"；起草教师：{teacher}" if teacher else "")
        + (f"\n补充要求：{extra}" if extra else "")
        + f"\n场景类型（topic）：{topic}，请按该类型的结构建议与官方口径起草，"
          "安全类条款必须一字不改引用官方口径。"
          "\n输出仅 Markdown 正文，不要解释、不要加代码围栏或前后缀。"
    )
    try:
        md = await call_llm(
            [{"role": "system", "content": skills}, {"role": "user", "content": user_brief}],
            "qwen-plus", 3000,
        )
    except Exception as e:
        return {"markdown": "", "topic": topic, "issues": [], "pass": True,
                "error": f"生成失败：{e}"}
    md = (md or "").strip()
    if not md:
        return {"markdown": "", "topic": topic, "issues": [], "pass": True,
                "error": "生成内容为空，请重试"}
    # 生成即预检（不阻断；发布时后端强制再检，防止模型自嗨后靠人工把关）
    gate = policy_gate_notice(md, {}, None)
    return {"markdown": md, "topic": topic, "issues": gate["issues"], "pass": gate["pass"]}


@app.post("/api/ai/courseware/trim")
async def courseware_trim(req: Request):
    """剔除指定的发散内容并刷新发散地图（D 组：教师逐项勾选删除）。

    仅删除待剔除列表对应的页面/段落，保留其余所有内容（核心知识点、例题、练习等），
    保持 Markdown 结构与分页不变。返回 {trimmed_markdown, divergence_map}。
    """
    try:
        body = await req.json()
    except Exception:
        body = {}
    markdown = body.get("markdown", "")
    remove_items = body.get("remove_items") or []
    if not markdown or not remove_items:
        return {"trimmed_markdown": markdown, "divergence_map": []}
    items_txt = "\n".join(
        f"- {it.get('content', '')}（锚点：{it.get('anchor', '')}，类型：{it.get('zone', '')}）"
        for it in remove_items
    )
    prompt = (
        "以下是课件 Markdown。请移除「待剔除列表」中列举的发散内容"
        "（跨界桥接/适度超纲/价值观行为情感拓展），只删除与这些条目直接对应的页面或段落，"
        "保留其余所有内容（含核心知识点、例题、练习、板书、作业等），"
        "保持 Markdown 结构与分页（## 分节）不变，不要改写未提及的内容，不要新增内容。\n"
        f"待剔除列表：\n{items_txt}\n\n课件原文：\n{markdown}\n"
    )
    try:
        trimmed = await call_llm([{"role": "user", "content": prompt}], None, 6000)
    except Exception:
        trimmed = markdown
    dm = await _extract_divergence(trimmed)
    return {"trimmed_markdown": trimmed, "divergence_map": dm}


@app.post("/api/ai/courseware/render-ppt")
async def courseware_render_ppt(req: Request):
    """PPT 课件渲染（AI 渲染 + 预置模板）：把课件 Markdown 渲染为结构化幻灯片。

    返回 {ppt_slides: [{title, bullets:[...], notes?, kind?}]}。
    每页 = 精炼要点（bullet）+ 教师备注/讲稿（notes）；封面自动生成。
    与「发布校验后」的最终课件同步：教师剔除发散 / 修改后，重新渲染即可得到一致 PPT。
    """
    try:
        body = await req.json()
    except Exception:
        body = {}
    markdown = body.get("markdown", "")
    title = body.get("title", "课件")
    subject = body.get("subject", "")
    grade = body.get("grade", "")
    style_tag = (body.get("style_tag") or "").strip()
    theme_id = (body.get("theme_id") or "").strip()
    if not markdown:
        return {"ppt_slides": [{"kind": "cover", "title": title,
                                 "bullets": [], "notes": ""}],
                "style_tag": style_tag, "theme_id": theme_id,
                "color_palette": _courseware_palette(subject, grade, style_tag)}
    prompt = (
        "你是一名资深教研员兼课件设计师。下面是一份已定稿的中小学课件（Markdown），"
        "请将其「渲染」为适合课堂投屏的 PPT 幻灯片结构，做到：每页要点精炼、不堆砌原文、逻辑清晰、便于讲解。\n"
        "要求：\n"
        "1. 输出 JSON 数组，每项为一张幻灯片，结构：\n"
        "   {\"kind\":\"cover\"|\"content\", \"title\":字符串, \"bullets\":[字符串...], \"notes\":字符串}\n"
        "2. 第一张必须是 kind=\"cover\"，title 用课件总标题，bullets 留空或放副标题信息（学科/年级/教师）。\n"
        "3. 其余为 kind=\"content\"：title 是本节标题（简洁），bullets 是 3~6 条精炼要点（去掉 Markdown 符号，口语化但专业），"
        "notes 是该页的「教师讲稿/备注」（给老师的口头讲解提示，1~3 句，不面向学生）。\n"
        "4. 保持原课件各节顺序与知识覆盖，不要丢知识点；总页数 12~16 页。\n"
        "5. 只输出 JSON 数组，不要任何解释。\n"
        f"课件总标题：{title}（{subject}{grade}）\n\n课件原文：\n{markdown}\n"
    )
    try:
        raw = await call_llm([{"role": "user", "content": prompt}], None, 4000)
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        if m:
            slides = json.loads(m.group(0))
            if isinstance(slides, list) and slides:
                return {"ppt_slides": slides, "style_tag": style_tag, "theme_id": theme_id}
    except Exception:
        pass
    # 兜底：直接按章节拆分（保证至少有可用 PPT）
    return {"ppt_slides": _fallback_ppt(markdown, title), "style_tag": style_tag, "theme_id": theme_id,
            "color_palette": _courseware_palette(subject, grade, style_tag)}


def _parse_duration(val):
    """兼容 duration_s 为整数/字符串/或 time:'0:00-0:10' 字符串，统一转秒数。"""
    if val is None:
        return 3
    if isinstance(val, (int, float)):
        return int(val)
    s = str(val).strip()
    if ":" in s:  # 形如 "0:00 - 0:10" 取结束时刻
        try:
            end = s.split("-")[-1].strip()
            parts = [int(p) for p in end.replace(".", ":").split(":") if p.strip().isdigit()]
            if len(parts) >= 2:
                return parts[0] * 60 + parts[1]
            if parts:
                return parts[0]
        except Exception:
            pass
    try:
        return int(float(s))
    except Exception:
        return 3


def _parse_video_shots(raw: str):
    """从 LLM 原始返回中鲁棒提取视频分镜列表，兼容两种字段命名（标准/简写）。"""
    if not raw:
        return []
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    data = None
    # 1) 直接解析整个去围栏内容
    try:
        data = json.loads(cleaned)
    except Exception:
        data = None
    # 2) 贪婪匹配数组再解析
    if data is None:
        m = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if m:
            try:
                data = json.loads(m.group(0))
            except Exception:
                data = None
    # 3) 退化：逐对象提取（防止前后杂文干扰）
    if data is None:
        objs = re.findall(r"\{[^{}]*\}", cleaned, re.DOTALL)
        if objs:
            items = []
            for o in objs:
                try:
                    items.append(json.loads(o))
                except Exception:
                    pass
            if items:
                data = items
    if not isinstance(data, list) or not data:
        return []
    out = []
    for i, s in enumerate(data):
        if not isinstance(s, dict):
            continue
        # 兼容字段命名：title/text、narration/voiceover、visual/scene、duration_s/time
        title = s.get("title") or s.get("text") or f"镜头{i + 1}"
        narration = s.get("narration") or s.get("voiceover") or ""
        visual = s.get("visual") or s.get("scene") or ""
        dur = _parse_duration(s.get("duration_s", s.get("time")))
        idx = s.get("index", i)
        try:
            idx = int(idx)
        except Exception:
            idx = i
        out.append({
            "index": idx,
            "title": str(title),
            "narration": str(narration),
            "visual": str(visual),
            "duration_s": dur,
        })
    return out


@app.post("/api/ai/courseware/generate-video-script")
async def courseware_generate_video_script(req: Request):
    """视频课件分镜脚本生成（路径α）：基于已定稿课件/课文，生成可用于程序化画面合成的视频分镜。

    返回 {video_script: [{index, title, narration, visual, duration_s}], total_duration_s, model}。
    - narration：该镜头的配音文案（口语化、面向学生，1~2 句）。
    - visual：程序化画面描述（简笔画/卡通场景/关键词板书的提示，给前端/合成器用，非真实图像）。
    - duration_s：单镜头时长（秒），总时长建议 15~60 秒。
    真实视频生成（数字人/AI 绘景）待 token 平权后接百炼视频模型；本端点只产出语义文本分镜。
    """
    try:
        body = await req.json()
    except Exception:
        body = {}
    title = body.get("title", "视频课件")
    subject = body.get("subject", "")
    grade = body.get("grade", "")
    markdown = body.get("markdown", "")
    duration = int(body.get("duration_s", 15))
    if duration <= 0 or duration > 120:
        duration = 15
    if not markdown:
        return {"video_script": [{"index": 0, "title": title,
                                  "narration": f"欢迎观看{subject}{grade}《{title}》讲解视频。",
                                  "visual": "封面：标题 + 学科年级",
                                  "duration_s": duration}],
                "total_duration_s": duration, "model": "fallback"}
    prompt = (
        "你是一名资深教研员兼微课编导。下面是一份已定稿的中小学课件（Markdown），"
        "请将其改编为一段短视频的「分镜脚本」，用于程序化画面合成（卡通简笔/关键词板书 + 配音）。\n"
        "要求：\n"
        "1. 输出 JSON 数组，每项为一段镜头，结构：\n"
        "   {\"index\":整数(从0起), \"title\":字符串(镜头名), "
        "\"narration\":字符串(该镜头配音文案,口语化面向学生,1~2句), "
        "\"visual\":字符串(程序化画面提示:如'卡通场景:静夜月光下床前',或'板书:关键词XXX'), "
        "\"duration_s\":整数(该镜头秒数)}\n"
        "2. 第一镜为封面（title 用课件总标题，narration 为开场白，visual 为标题画面）。\n"
        "3. 镜头数 4~8 个，各镜 duration_s 之和为总时长，需尽量接近 "
        f"{duration} 秒（允许 ±3 秒）；每个镜头 2~6 秒。\n"
        "4. 按课件知识顺序展开，关键知识点/诗意/公式须有对应镜头；结尾一镜做小结或留思考。\n"
        "5. 严格使用以下字段名，不要使用 time/scene/text/voiceover 等其它命名：\n"
        "   index(整数), title(字符串), narration(字符串), visual(字符串), duration_s(整数秒)\n"
        "6. 只输出 JSON 数组，不要任何解释、不要 markdown 代码块围栏。\n"
        f"课件总标题：{title}（{subject}{grade}）\n\n课件原文：\n{markdown}\n"
    )
    try:
        raw = await call_llm([{"role": "user", "content": prompt}], None, 2000)
        shots = _parse_video_shots(raw)
        if shots:
            total = sum(x["duration_s"] for x in shots)
            return {"video_script": shots, "total_duration_s": total, "model": _effective_model()}
    except Exception:
        logger.exception("generate-video-script failed")
    # 兜底：封面 + 一段概述
    return {"video_script": [
        {"index": 0, "title": title,
         "narration": f"接下来我们用 {duration} 秒，一起走进{subject}{grade}《{title}》。",
         "visual": "封面：标题 + 学科年级", "duration_s": duration}
    ], "total_duration_s": duration, "model": "fallback"}


# 各题型默认分值（当未指定总分时用于习题；组卷按总分归一化覆盖）
_DEFAULT_SCORE = {
    "choice": 3, "fill": 3, "judge": 2, "truefalse": 2, "short_answer": 5,
    "match": 2, "cloze": 3, "reading": 6, "writing": 10, "calculation": 6,
    "application": 6, "operation": 5, "listening": 2, "vocab": 2,
}
# 组卷分值权重（用于在总分内按比例分配）
_WEIGHT = {
    "choice": 2, "fill": 2, "judge": 2, "truefalse": 2, "short_answer": 4,
    "match": 2, "cloze": 3, "reading": 4, "writing": 8, "calculation": 5,
    "application": 5, "operation": 4, "listening": 2, "vocab": 2,
}


def _parse_questions_json(text):
    """从模型输出中稳健解析 JSON 题目数组。"""
    import re
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    s = t.find("[");
    e = t.rfind("]")
    if s >= 0 and e > s:
        t = t[s:e + 1]
    return json.loads(t)


def _assign_scores(questions, total_score=None):
    """为题目分配分值。有 total_score 则归一化到该总分；否则用题型默认分。"""
    if not questions:
        return questions
    if total_score and total_score > 0:
        raw = [_WEIGHT.get(q.get("type"), 3) for q in questions]
        s = sum(raw) or 1
        scaled = [total_score * w / s for w in raw]
        # 四舍五入到 0.5，末题补差使总和精确等于 total_score
        rounded = [round(x * 2) / 2 for x in scaled]
        diff = round((total_score - sum(rounded)) * 2)
        if questions:
            rounded[-1] = round((rounded[-1] + diff / 2) * 2) / 2
        for q, sc in zip(questions, rounded):
            q["score"] = max(0.5, sc)
    else:
        for q in questions:
            q["score"] = _DEFAULT_SCORE.get(q.get("type"), 3)
    return questions


def _build_question_prompt(subject, grade, kp_names, prereq_names, textbook_version,
                           difficulty, ai_spec, purpose, extra, chat_ctx, boundary=""):
    spec_txt = "；".join(f"{t} {c} 道" for t, c in ai_spec.items() if c > 0)
    scope = "、".join(kp_names) if kp_names else "（按教材常规进度）"
    pre = f"；可能用到的前置知识点：{', '.join(prereq_names)}。" if prereq_names else ""
    tv = f"\n教材版本：{textbook_version}（例题、术语、表述须贴合该版本）。" if textbook_version else ""
    pur = f"\n命题用途：{purpose}（题量、难度、情境须符合该用途）。" if purpose else ""
    ex = f"\n用户的附加要求/关键词（必须落实）：{extra}。" if extra else ""
    ch = f"\n用户此前与小微助教沟通中提出的诉求（应融入题目）：{chat_ctx}。" if chat_ctx else ""
    return (
        f"你是资深命题专家。请为{grade}{subject}按以下要求生成题目，并严格只考查指定知识点范围，"
        f"返回 JSON 数组。\n"
        f"知识面（必须在此范围内命题，不得超纲）：{scope}。{pre}{tv}{pur}{ex}{ch}\n"
        f"整体难度约 {difficulty}（L1 基础 / L2 中等 / L3 进阶 / L4 挑战，可含少量上下浮动）。\n"
        f"题型与数量：{spec_txt}。\n"
        "每道题 JSON 结构：\n"
        '{"type": 题型id(须为上述之一), "stem": 题干, "options": [选项](选择题/完形填空/匹配题填 A-D 等选项，其它题型填 []), '
        '"answer": 答案, "analysis": 解析, "difficulty": "L1"~"L4", "knowledge_points": [1~2个知识点名称]}\n'
        "规则：选择题须有 A-D 四项 options 且 answer 为选项字母；答案与解析须正确；"
        "每题 knowledge_points 必须从给定知识点中选取；不要输出任何解释性文字，只输出 JSON 数组。"
        + (("\n" + boundary) if boundary else "")
    )


@app.post("/api/ai/exam/generate")
async def gen_exam(req: Request):
    """出题 / 智能组卷（共用）：返回 {questions, total_questions, curriculum_alignments, knowledge_scope, model, generation_time_ms}。

    知识点约束：所选 + 前置（backend 解析），不超纲。
    结构化输出：严格 JSON，含题干/选项/答案/解析/难度/知识点/分值。
    组卷（source='bank'）：优先从题库抽题并按班级排重，缺口由 AI 补足，再按 total_score 自动分配分值。
    """
    try:
        body = await req.json()
    except Exception:
        body = {}
    subject = body.get("subject", "语文")
    grade = body.get("grade", "四年级")
    difficulty = body.get("difficulty", "L2")
    purpose = body.get("purpose", "")
    textbook_version = body.get("textbook_version", "")
    extra = (body.get("extra_requirements") or "").strip()
    chat_ctx = (body.get("chat_context") or "").strip()
    source = body.get("source", "ai")  # 组卷传 'bank' 优先抽题库
    total_score = body.get("total_score") or None
    exclude_ids = body.get("exclude_question_ids") or []
    kp_ids = body.get("selected_knowledge_ids") or []
    unit = body.get("textbook_unit", "")

    kp_names, prereq_names = _resolve_scope(body)
    try:
        curriculum = map_curriculum(body.get("curriculum_codes") or [], subject, grade) if (kp_ids or body.get("curriculum_codes")) else []
    except Exception:
        curriculum = []

    # 题型配比：组卷用 type_ratio；习题把 count 均摊到所选题型
    type_ratio = {k: int(v) for k, v in (body.get("type_ratio") or {}).items() if int(v) > 0}
    if not type_ratio:
        qtypes = body.get("question_types") or []
        count = max(1, int(body.get("count", 5) or 5))
        if qtypes:
            per = max(1, count // len(qtypes))
            type_ratio = {t: per for t in qtypes}
            rem = count - per * len(qtypes)
            if rem > 0:
                type_ratio[qtypes[0]] = type_ratio.get(qtypes[0], 0) + rem
        else:
            type_ratio = {"choice": count}

    start = time.time()
    questions = []

    # ── 组卷：优先从题库抽题 + 班级排重 ──
    if source == "bank" and kp_names:
        try:
            bank = list_bank_questions(
                subject, grade, kp_names,
                types=list(type_ratio.keys()), limit=200, exclude_ids=exclude_ids,
            )
            # 按题型从题库取满足配比的题
            for t, need in type_ratio.items():
                got = [q for q in bank if q["type"] == t][:need]
                questions.extend(got)
        except Exception:
            pass

    # ── 计算 AI 需补足的缺口（按题型分批生成，避免单次超长导致 JSON 截断）──
    have = {}
    for q in questions:
        have[q["type"]] = have.get(q["type"], 0) + 1
    ai_spec = {t: max(0, c - have.get(t, 0)) for t, c in type_ratio.items()}
    ai_spec = {t: c for t, c in ai_spec.items() if c > 0}
    boundary = await _boundary_block(
        subject, grade, textbook_version, unit,
        (' '.join(kp_names) or f"{grade}{subject}"),
    )
    for t, c in ai_spec.items():
        prompt = _build_question_prompt(
            subject, grade, kp_names, prereq_names, textbook_version,
            difficulty, {t: c}, purpose, extra, chat_ctx, boundary,
        )
        max_tokens = min(6000, max(1500, c * 220))
        for attempt in range(2):  # 解析失败重试一次
            try:
                raw = await call_llm([{"role": "user", "content": prompt}], None, max_tokens)
                ai_qs = _parse_questions_json(raw)
                if isinstance(ai_qs, list) and ai_qs:
                    for q in ai_qs:
                        if isinstance(q, dict) and q.get("stem"):
                            q["type"] = t  # 强制题型一致
                            q.setdefault("options", [])
                            q.setdefault("analysis", "")
                            q.setdefault("difficulty", difficulty)
                            q.setdefault("knowledge_points", kp_names[:1])
                            q.setdefault("score", 0)
                            q.setdefault("source", "ai")
                            questions.append(q)
                    break
            except Exception:
                if attempt == 1:
                    questions.append({"type": t, "stem": "AI 生成失败，请重试该题型的生成", "options": [],
                                      "answer": "", "analysis": "", "difficulty": difficulty,
                                      "knowledge_points": kp_names[:1], "score": 0, "source": "ai"})

    _assign_scores(questions, total_score)
    return {
        "questions": questions,
        "total_questions": len(questions),
        "curriculum_alignments": curriculum,
        "knowledge_scope": kp_names,
        "model": _effective_model(),
        "generation_time_ms": int((time.time() - start) * 1000),
    }


@app.post("/api/ai/grading/auto")
async def auto_grading(req: Request):
    """自动批阅：返回 {result, model, generation_time_ms}。"""
    try:
        body = await req.json()
    except Exception:
        body = {}
    answers = body.get("answers", [])
    prompt = "以下是学生作答内容，请逐题批阅，给出得分点、评语与改进建议：\n" + json.dumps(answers, ensure_ascii=False)
    start = time.time()
    try:
        content = await call_llm([{"role": "user", "content": prompt}], None, 3000)
    except Exception as e:
        content = f"AI 批阅失败：{e}"
    return {"result": content, "model": _effective_model(), "generation_time_ms": int((time.time() - start) * 1000)}


@app.post("/api/ai/embed")
async def embed(req: Request):
    """批量文本向量化：{texts:[...]} -> {embeddings:[[...]], model, dim}。"""
    try:
        body = await req.json()
    except Exception:
        body = {}
    texts = body.get("texts") or []
    if not texts:
        return {"embeddings": [], "model": EMBED_MODEL, "dim": EMBED_DIM}
    embs = await run_in_threadpool(embed_texts, texts)
    return {"embeddings": embs, "model": EMBED_MODEL, "dim": EMBED_DIM}


@app.post("/api/ai/rag/init")
async def rag_init():
    """建表 + vector 扩展 + HNSW 索引（幂等）。部署/首次入库前调用。"""
    try:
        await run_in_threadpool(ensure_schema, EMBED_DIM)
        return {"status": "ok", "table": "tb_lesson_source", "dim": EMBED_DIM}
    except Exception as e:  # noqa: BLE001
        return {"status": "error", "error": str(e)}


@app.post("/api/ai/rag/search")
async def rag_search(req: Request):
    """向量检索备课包/教材底料：{query, subject?, grade?, volume?, version?, source_type?, top_k?}
    -> {results:[{chunk_id, subject, grade, unit, chapter, content, similarity, ...}]}
    """
    try:
        body = await req.json()
    except Exception:
        body = {}
    query = (body.get("query") or "").strip()
    if not query:
        return {"results": [], "query": query}
    filters = {
        "subject": body.get("subject"),
        "grade": body.get("grade"),
        "volume": body.get("volume"),
        "version": body.get("version"),
        "source_type": body.get("source_type"),
        "unit": body.get("unit"),
        "chapter": body.get("chapter"),
    }

    def _do():
        q_emb = embed_texts([query])[0]
        return vs_search(q_emb, filters, int(body.get("top_k", 5)))

    try:
        results = await run_in_threadpool(_do)
    except Exception as e:  # noqa: BLE001
        return {"results": [], "query": query, "error": str(e)}
    return {"results": results, "query": query}


if __name__ == "__main__":
    port = int(os.getenv("AI_PORT", "8000"))
    uvicorn.run("api_server:app", host="0.0.0.0", port=port, reload=False)
