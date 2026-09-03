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
import uvicorn
import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
logger = logging.getLogger("zhiwei-ai")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 百炼（阿里云 DashScope）凭证，由 docker-compose 注入 DASHSCOPE_API_KEY
# DASHSCOPE_BASE_URL 为兼容模式端点，dashscope 原生 SDK 走官方域名即可，这里仅读 key
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")
DEFAULT_MODEL = os.getenv("DASHSCOPE_MODEL", "qwen-turbo")

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
from kg_store import resolve_knowledge_scope, map_curriculum, list_bank_questions  # noqa: E402
# 课件红线策略（发布校验 / 课前问诊 / 发散预算）
from policy import policy_gate_publish, policy_consult, divergence_budget, ETHIC_PRINCIPLE, subject_orbit_hint  # noqa: E402

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


def _call_llm(messages, model=DEFAULT_MODEL, max_tokens=2000):
    """同步调用百炼文本生成（dashscope 原生 SDK）。"""
    resp = Generation.call(
        model=model,
        messages=messages,
        result_format="message",
        max_tokens=max_tokens,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"dashscope {resp.status_code}: {getattr(resp, 'message', 'unknown error')}")
    return resp.output.choices[0].message.content


async def call_llm(messages, model=DEFAULT_MODEL, max_tokens=2000):
    """在 FastAPI 异步端点中在线程池调用同步 SDK，避免阻塞事件循环。"""
    try:
        return await run_in_threadpool(_call_llm, messages, model, max_tokens)
    except Exception:
        # 统一记录 AI 调用失败根因（route 层仍按原样静默降级，保证有返回）
        logger.exception("call_llm failed model=%s", model)
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
        resp = _call_llm([{"role": "user", "content": prompt}], "qwen-turbo", 800)
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


def _resolve_scope(body: dict):
    """解析知识面：优先用前端直传的知识点名称，否则按 ID 从知识图谱取名称+前置。"""
    kp_names = body.get("knowledge_points") or []
    prereq_names = body.get("prerequisite_points") or []
    kp_ids = body.get("selected_knowledge_ids") or []
    if not kp_names and kp_ids:
        try:
            sc = resolve_knowledge_scope(kp_ids)
            kp_names = sc.get("selected") or []
            prereq_names = sc.get("prerequisites") or []
        except Exception:
            pass
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
        content = await call_llm([{"role": "user", "content": prompt}], "qwen-turbo", 5000)
    except Exception as e:
        return {"content": f"AI 生成失败：{e}", "curriculum_alignments": [], "material_refs": [], "recommended_materials": [], "knowledge_scope": kp_names, "model": "qwen-turbo", "generation_time_ms": 0}
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
        "model": "qwen-turbo",
        "generation_time_ms": int((time.time() - start) * 1000),
    }


_SKILLS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skills")

# PPT 与 H5 各用专用 Skill 的领域知识（约定 0：课件只能由 Skill 生成，两条链路共用一套）
_SKILL_REFS = {
    "ppt": ("shared/质量宪法.md", "courseware-ppt/references/版式与组件选型.md"),
    "h5": ("shared/质量宪法.md", "courseware-h5/references/场景与互动规范.md"),
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
    return "\n\n---\n\n".join(chunks)


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

    kp_names, prereq_names = _resolve_scope(body)
    budget = divergence_budget(divergence_level)

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
        scope_hint += (
            f"\n【风格·指定大类】本课件视觉风格须为【{style_tag}】，属于受控风格词表之一：{STYLE_TAGS}。"
            f"请在版式节奏与内容组织上体现该风格（如科技风多用双栏/大图/模块化、国风多用留白与韵味、"
            f"极简风要点更精简、卡通风更活泼）。版式标注（<!-- layout -->）仍须从现有版式集合中取，不得自创版式。"
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
            "输出要求：\n"
            "1. 本课件为 H5 绘本情景互动课件，用于课堂大屏/平板/手机投屏，不是 PPT 教案。\n"
            "2. 整体结构必须是连续生活情境/故事线：封面 → 场景一 → 场景二 → … → 结尾。"
            "禁止输出“学习目标、教学重难点、课堂小结、板书设计、分层作业”等教案章节。\n"
            "3. 用 Markdown 输出，每页一个 `## 场景标题`（封面可用 `## 封面：xxx`），每页 1 个情境，建议 6~10 页。\n"
            "4. 每页 `## 标题` 下一行必须紧跟版式标注 `<!-- layout: scene-<类型> -->`，类型只能取自受控集合 7 类：\n"
            "   - scene-dialog：角色对话推进情节（默认；凡有 ≥2 条对话气泡即属此类）\n"
            "   - scene-read：词汇点读/跟读（必须同时带 read 或 readalong 标记）\n"
            "   - scene-quiz：随堂选择（必须同时带 quiz 标记）\n"
            "   - scene-reveal：悬念/答案揭晓（必须同时带 reveal 标记）\n"
            "   - scene-draw：现场绘图/涂鸦（必须同时带 draw 标记）\n"
            "   - scene-focus：单条重点收束（只强调 1 条，勿堆叠）\n"
            "   - scene-transition：封面/转场/结尾——纯旁白、无对话无互动、低信息密度\n"
            "   选型按本页主要教学动作，不要跟风上一页；渲染端对每类有独立视觉骨架。\n"
            "5. 角色与对话：在相关场景用 `**角色**：A（顾客），B（店员）` 声明角色，"
            "随后用 `A: Hello!` / `B: Yes!` 输出对话；或用绘本原生格式 `[妈妈] 我们买苹果吧。`。"
            "对话要自然、简短、口语化，符合{grade}学生认知。\n"
            "6. 互动标注：每页至少包含 1 处互动，从以下标记中选择至少一种插入到场景内：\n"
            "   - `<!-- read: 苹果 apple / 香蕉 banana -->`：点读词汇（适合英语/识字）\n"
            "   - `<!-- readalong: Hello! -->`：跟读句\n"
            "   - `<!-- quiz: 问句 | 选项A | 选项B | 选项C | 正确答案索引（0起） -->`：随堂选择\n"
            "   - `<!-- reveal: 提示语 => 要揭示的内容 -->`：点击揭示\n"
            "   - `<!-- draw: 绘图说明 -->`：建议教师现场绘图/学生涂鸦\n"
            "7. 视觉描述：每个场景用 1~2 句话描述画面（角色、环境、情绪），便于渲染为儿童绘本风格。\n"
            "8. 语言精炼、画面感强，避免大段说教文字。\n"
        )
    else:
        structure_hint = (
            "输出要求：\n"
            "1. 用 Markdown 输出，以 `##` 分节，每节 = 一页幻灯片；建议 12~15 页，不要超过 16 页，能覆盖完整一节课（约 40~45 分钟），每页内容精简。\n"
            "\n"
            "【内容原则·必须遵守】（课件服务学生，不是复述教案）\n"
            "- 学生视角：每条要点写“学生将看到/学会什么”，禁止写成“教师引导学生…”“教师点拨…”这类教师备课提示。\n"
            "- 目标具体化：禁止只写抽象目标（如“会认会写 N 个生字词”“掌握重点词语”），必须落出具体内容"
            "（是哪 N 个字、哪些词语、哪句原文、哪道例题）。\n"
            "- 引用真实内容：文科须出现课文/原文金句、生字表、词句赏析；理科须出现具体公式、例题数据与解答步骤。\n"
            "- 趣味性按学段设计：小学低段用游戏/竞赛/角色扮演，小学中高段用情境/探究任务，初高中用问题链/辩论/实验。\n"
            "  每节课至少含 2 处互动或趣味环节，用【互动】【游戏】【挑战】【角色扮演】等标记显式标注。\n"
            "- 时长匹配：按课时总时长反推页数与密度，每页都要有足以支撑 2~4 分钟讲解/活动的具体内容，避免整页空泛。\n"
            "- 零占位符：禁止输出“思维导图占位”“图片占位”“待补充”“XXX”等未填充占位内容。\n"
            "\n"
            "2. 章节顺序（按真实课堂节奏组织；其中“教学重难点”“板书设计”不单独成页，"
            "须融入对应内容页或用一两句话带过，因为它们属于教师备课信息、不是投屏给学生看的内容）：\n"
            "   - 学习目标（3~4 条，用学生能懂的语言写“这节课我要学会…”）\n"
            "   - 情境导入（用生活现象 / 实验 / 问题情境引出本课，1~2 段，标注【导入】）\n"
            "   - 新知探究（2~3 节，每节聚焦一个核心概念：讲清定义、原理、关键特征，并给出“易错提醒”）\n"
            "   - 典例精讲（1~2 道典型例题，含“读题→思路→解答”的完整过程）\n"
            "   - 活动探究（标注【互动】，设计一个可当堂操作的探究 / 讨论 / 小实验；若启用边缘知识，可在此融入价值观/行为情境）\n"
            "   - 课堂练习（2~3 道，附答案要点）\n"
            "   - 课堂小结（知识框架 + 方法提炼）\n"
            "   - 分层作业（基础题 + 提升题）\n"
            "3. “合适”原则：每页都要有足以支撑讲解的具体知识点、例题或活动，能真正撑满这节课；"
            "但不要堆砌冗余大段文字——投屏以要点、关键词、必要例题为主，便于学生速记。\n"
            f"4. 语言精炼、专业，符合{grade}学生的认知水平；在互动环节用“【互动】”提示。\n"
            "5. 发散内容（跨界/超纲/边缘）须自然融入，不喧宾夺主；严禁出现商业或外来亚文化符号、"
            "严禁对国内各民族做差异化对比呈现。\n"
            "6. 版式标注（重要）：每一页 `## 标题` 的下一行必须紧跟一行版式注释，格式为 "
            "`<!-- layout: 版式名 -->`。按内容形态选版式，不要全部用 edu-*：\n"
            "   - `edu-cover`：封面（仅课件总标题那一页用，标题即课件名）\n"
            "   - `edu-goal`：学习目标页\n"
            "   - `edu-summary`：课堂小结页\n"
            "   - `edu-homework`：分层作业页\n"
            "   - `edu-explain`：仅用于“1 段定义/概念 + 1 组要点”两段式讲解页（槽位只有 2 个，"
            "要点多于 3 条时不要用，否则会挤在一起）\n"
            "   - `edu-example`：典例精讲 / 课堂练习页\n"
            "   - `content-2col`：2~4 条并列要点（每条 ≤30 字）/ 对比类内容（如步骤、异同对比）\n"
            "   - `content-grid`：5~6 条并列短要点，且**每条必须 ≤12 字**（如生字表、词语积累、知识点清单）\n"
            "   - `image-text`：需要配图/配示意图的重点段落（如精读原文 + 赏析）\n"
            "   - `title-body`：上述之外的普通内容页\n"
            "   示例：\n"
            "   ## 一、学习目标\n"
            "   <!-- layout: edu-goal -->\n"
            "   - 会认会写：盐、屹、昂、鼎（具体列出，不写“N 个生字”）\n"
            "   必须每页都标注，且注释独占一行、紧接标题行之后。\n"
            "7. **版式与要点字数必须匹配（硬约束）**：content-grid / content-2col / edu-goal / edu-summary "
            "等版式会把每条要点渲染成并列卡片，卡片横向列宽有限，单条越长、列数越多，字被压得越小。\n"
            "   - 单条 ≤12 字 → 才可用 content-grid\n"
            "   - 单条 13~30 字 → **严禁 content-grid**，只能 content-2col（≤3 条）或 title-body\n"
            "   - 单条 >30 字 → **严禁任何多列版式**，走 title-body 竖排，或先拆成多条短句\n"
            "   写完一页要点后逐条数字数，任一条超标就换版式或拆句——"
            "切勿先定版式再把长句硬塞进卡片。\n"
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
    try:
        courseware = await call_llm([{"role": "user", "content": prompt}], "qwen-turbo", 6000)
    except Exception as e:
        courseware = f"# {title}\n\n（AI 课件生成失败：{e}）\n\n{content}"

    # 3) 提取发散地图（divergence_map）：供教师审阅每条发散的锚点与理由
    divergence_map = await _extract_divergence(courseware)

    return {
        "courseware_markdown": courseware,
        "divergence_map": divergence_map,
        "similar_material": similar,
        "recommended_refs": recommended_refs,
        "style_tag": style_tag,
        "style_profile": style_profile,
        "color_palette": _courseware_palette(subject, grade, style_tag),
        "model": "qwen-turbo",
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
        dm_raw = await call_llm([{"role": "user", "content": dm_prompt}], "qwen-turbo", 1500)
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
        }
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
    """
    try:
        body = await req.json()
    except Exception:
        body = {}
    text = body.get("markdown", "")
    result = policy_gate_publish(
        text,
        {"subject": body.get("subject", ""), "grade": body.get("grade", "")},
        _call_llm,
    )
    return result


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
        trimmed = await call_llm([{"role": "user", "content": prompt}], "qwen-turbo", 6000)
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
        raw = await call_llm([{"role": "user", "content": prompt}], "qwen-turbo", 4000)
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
        raw = await call_llm([{"role": "user", "content": prompt}], "qwen-turbo", 2000)
        shots = _parse_video_shots(raw)
        if shots:
            total = sum(x["duration_s"] for x in shots)
            return {"video_script": shots, "total_duration_s": total, "model": "qwen-turbo"}
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
                raw = await call_llm([{"role": "user", "content": prompt}], "qwen-turbo", max_tokens)
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
        "model": "qwen-turbo",
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
        content = await call_llm([{"role": "user", "content": prompt}], "qwen-turbo", 3000)
    except Exception as e:
        content = f"AI 批阅失败：{e}"
    return {"result": content, "model": "qwen-turbo", "generation_time_ms": int((time.time() - start) * 1000)}


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
