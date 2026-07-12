import os
import time
import json
import dashscope
from dashscope import Generation
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
import uvicorn
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 百炼（阿里云 DashScope）凭证，由 docker-compose 注入 DASHSCOPE_API_KEY
# DASHSCOPE_BASE_URL 为兼容模式端点，dashscope 原生 SDK 走官方域名即可，这里仅读 key
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")
DEFAULT_MODEL = os.getenv("DASHSCOPE_MODEL", "qwen-turbo")

# 向量检索（备课包/教材底料 RAG）
from embeddings import embed_texts, EMBED_MODEL, EMBED_DIM  # noqa: E402
from vector_store import ensure_schema, search as vs_search  # noqa: E402
# 素材库检索（AI 决定挂载 / 找相近生成新版本）
from materials_store import list_materials, rank_materials  # noqa: E402

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
    return await run_in_threadpool(_call_llm, messages, model, max_tokens)


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


def build_system_prompt(ctx: dict) -> str:
    role = ctx.get("role", "teacher")
    name = ctx.get("teacher_name", "老师")
    subject = ctx.get("subject", "语文")
    grade = ctx.get("grade", "四年级")
    role_label = {"principal": "校长", "director": "教务主任", "it_admin": "IT管理员"}.get(role, "教师")
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


@app.post("/api/ai/lesson-plan/generate")
async def gen_lesson_plan(req: Request):
    """教案生成：返回 {content, curriculum_alignments, material_refs, recommended_materials, model, generation_time_ms}。"""
    try:
        body = await req.json()
    except Exception:
        body = {}
    subject = body.get("subject", "语文")
    grade = body.get("grade", "四年级")
    title = body.get("lesson_title", "")
    unit = body.get("textbook_unit", "")
    period = body.get("period", 1)
    template = body.get("format_template", "")
    kp_ids = body.get("selected_knowledge_ids", [])
    school_id = body.get("school_id")
    prompt = (
        f"请为{grade}{subject}《{title}》设计一份完整教案。"
        + (f"所属单元：{unit}。" if unit else "")
        + (f"课时：{period}。" if period else "")
        + (f"参考模板：{template}。" if template else "")
        + (f"需覆盖的知识点：{', '.join(kp_ids)}。" if kp_ids else "")
        + "教案请包含：教学目标、教学重难点、教学准备、教学过程（含导入/新授/活动/小结）、"
        "作业布置、板书设计。使用 Markdown 格式输出。"
    )
    start = time.time()
    try:
        content = await call_llm([{"role": "user", "content": prompt}], "qwen-turbo", 4000)
    except Exception as e:
        return {"content": f"AI 生成失败：{e}", "curriculum_alignments": [], "material_refs": [], "recommended_materials": [], "model": "qwen-turbo", "generation_time_ms": 0}
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
        "curriculum_alignments": [],
        "material_refs": material_refs,
        "recommended_materials": recommended,
        "model": "qwen-turbo",
        "generation_time_ms": int((time.time() - start) * 1000),
    }


@app.post("/api/ai/courseware/generate")
async def gen_courseware(req: Request):
    """课件生成（先渲染教案为骨架，再由 AI 润色；AI 从素材库找相近的来生成适宜新版本）。

    返回 {courseware_markdown, similar_material, recommended_refs, model, generation_time_ms}。
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
    prompt = (
        f"你是课件设计专家。请基于以下{grade}{subject}《{title}》的教案，生成一份可直接用于课堂投屏的课件。"
        f"{similar_hint}\n"
        "要求：\n"
        "1. 用 Markdown 输出，以 `##` 分节；\n"
        "2. 章节建议：封面与学习目标、教学重难点、教学过程（导入/新授/活动探究/小结）、课堂互动题、板书设计、分层作业；\n"
        "3. 在“课堂互动题”中给出 2~3 道可当堂作答的题目；\n"
        "4. 语言精炼、适合投屏，避免大段文字；可在适当位置加“【互动】”提示。\n\n"
        f"教案正文：\n{content}"
    )
    start = time.time()
    try:
        courseware = await call_llm([{"role": "user", "content": prompt}], "qwen-turbo", 4000)
    except Exception as e:
        courseware = f"# {title}\n\n（AI 课件生成失败：{e}）\n\n{content}"
    return {
        "courseware_markdown": courseware,
        "similar_material": similar,
        "recommended_refs": recommended_refs,
        "model": "qwen-turbo",
        "generation_time_ms": int((time.time() - start) * 1000),
    }


@app.post("/api/ai/exam/generate")
async def gen_exam(req: Request):
    """出题：返回 {content, model, generation_time_ms}。"""
    try:
        body = await req.json()
    except Exception:
        body = {}
    subject = body.get("subject", "语文")
    grade = body.get("grade", "四年级")
    count = body.get("count", 5)
    prompt = (
        f"请为{grade}{subject}出 {count} 道练习题，涵盖不同题型（选择/填空/简答），"
        "并附答案与解析。用 Markdown 列表格式输出。"
    )
    start = time.time()
    try:
        content = await call_llm([{"role": "user", "content": prompt}], "qwen-turbo", 3000)
    except Exception as e:
        content = f"AI 生成失败：{e}"
    return {"content": content, "model": "qwen-turbo", "generation_time_ms": int((time.time() - start) * 1000)}


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
