import os
import time
import json
import dashscope
from dashscope import Generation
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
import uvicorn

# 百炼（阿里云 DashScope）凭证，由 docker-compose 注入 DASHSCOPE_API_KEY
# DASHSCOPE_BASE_URL 为兼容模式端点，dashscope 原生 SDK 走官方域名即可，这里仅读 key
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")
DEFAULT_MODEL = os.getenv("DASHSCOPE_MODEL", "qwen-turbo")

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
    """教案生成：返回 {content, curriculum_alignments, model, generation_time_ms}。"""
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
        return {"content": f"AI 生成失败：{e}", "curriculum_alignments": [], "model": "qwen-turbo", "generation_time_ms": 0}
    return {
        "content": content,
        "curriculum_alignments": [],
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


if __name__ == "__main__":
    port = int(os.getenv("AI_PORT", "8000"))
    uvicorn.run("api_server:app", host="0.0.0.0", port=port, reload=False)
