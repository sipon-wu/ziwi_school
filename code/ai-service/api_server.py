"""知微AI教学助手 - AI服务主入口 v2
集成课标RAG + 通义千问 + SSE流式
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List
import time, json, logging, asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zhiwei-ai")

from rag.curriculum_rag import curriculum_rag

# 通义千问客户端
try:
    from models.qwen_client import QwenClient
    qwen = QwenClient()
    HAS_QWEN = qwen.ready
except Exception:
    HAS_QWEN = False
    logger.warning("通义千问客户端初始化失败")

app = FastAPI(title="知微AI服务", version="0.2.0-sprint3")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── 模型 ──

class LessonPlanRequest(BaseModel):
    subject: str = Field(..., pattern="^(语文|数学|英语)$")
    grade: str = Field(...)
    lesson_title: str = Field(..., min_length=1, max_length=300)
    textbook_unit: Optional[str] = Field(None, max_length=200)
    period: int = Field(default=1, ge=1, le=10)
    format_template: str = Field(default="core_literacy")
    model: Optional[str] = Field(None, pattern="^(qwen-plus|qwen-max|qwen-turbo)$")

class ExamGenerateRequest(BaseModel):
    subject: str; knowledge_point: str; grade: str
    difficulty: str = Field(default="L2", pattern="^(L1|L2|L3)$")
    count: int = Field(default=10, ge=5, le=20)
    model: Optional[str] = Field(None, pattern="^(qwen-plus|qwen-max|qwen-turbo|qwen-math-plus|qwen-math-turbo)$")

class GradingRequest(BaseModel):
    answers: List[dict]; assignment_id: str; student_id: str
    model: Optional[str] = Field(None)

class CompositionGradingRequest(BaseModel):
    image_url: str; student_id: str
    model: Optional[str] = Field(None, pattern="^(qwen-vl-plus|qwen-vl-max)$")

# ── 健康检查 ──

@app.get("/health")
async def health():
    return {"status":"ok","service":"ai-service","version":"0.2.0-sprint3","rag":len(curriculum_rag.search("语文","四年级","测试")) > 0}

@app.get("/ping")
async def ping():
    return {"pong":True}


# ── 教案生成（核心）──

@app.post("/api/lesson-plan/generate")
async def generate_lesson_plan(req: LessonPlanRequest):
    """AI 教案生成 + 课标 RAG 对齐"""
    t0 = time.time()

    # 1. RAG 检索课标
    standards = curriculum_rag.search(req.subject, req.grade, req.lesson_title, top_k=5)
    logger.info(f"课标检索: {len(standards)} 条匹配")

    # 2. 构建课标文本
    std_text = ""
    for _, s in enumerate(standards, 1):
        std_text += f"  - [{s['code']}] ({s['domain']}) {s['content']}\n"

    # 3. 格式指导
    format_guide = {
        "core_literacy": "请使用核心素养导向的教案模板，包含：教学目标（知识与技能/过程与方法/情感态度与价值观）、教学重点、教学难点、教学过程、板书设计、课后反思、课标对齐说明。",
        "3d_objective": "请使用三维目标教案模板，包含：知识与技能目标、过程与方法目标、情感态度与价值观目标、教学重难点、教学过程、课后反思。",
        "unit_teaching": "请使用单元教学设计模板，包含：单元教学目标、课时安排、本课时教学设计、单元评价方案。",
    }.get(req.format_template, "")

    # 4. 加载 Prompt 模板
    try:
        with open("prompts/lesson_plan.txt", "r", encoding="utf-8") as f:
            prompt_template = f.read()
    except:
        prompt_template = "请为{subject}{grade}《{lesson_title}》撰写{period}课时教案。课标参考：{curriculum_standards}"

    prompt = prompt_template.replace("{subject}", req.subject)\
        .replace("{grade}", req.grade)\
        .replace("{lesson_title}", req.lesson_title)\
        .replace("{textbook_unit}", req.textbook_unit or "")\
        .replace("{period}", str(req.period))\
        .replace("{curriculum_standards}", std_text)\
        .replace("{format_instruction}", format_guide)\
        .replace("{format_template}", req.format_template)

    # 5. 调用 AI 生成
    model_name = req.model or "qwen-plus"
    if HAS_QWEN:
        messages = [
            {"role": "system", "content": "你是一位资深教研员，请严格按照要求生成教案，不要添加额外说明。"},
            {"role": "user", "content": prompt},
        ]
        try:
            content = qwen.chat(messages, model=model_name, temperature=0.7)
        except Exception as e:
            logger.error(f"QWEN API 错误: {e}")
            content = _mock_lesson_plan(req)
    else:
        content = _mock_lesson_plan(req)

    # 6. 课标对齐校验
    alignments = curriculum_rag.validate_alignment(content, req.subject, req.grade)

    elapsed = int((time.time() - t0) * 1000)
    logger.info(f"教案生成完成: {elapsed}ms, 课标对齐 {sum(1 for a in alignments if a['aligned'])}/{len(alignments)}")

    return {
        "success": True,
        "content": content,
        "curriculum_alignments": alignments,
        "model": model_name if HAS_QWEN else "mock",
        "generation_time_ms": elapsed,
        "format_template": req.format_template
    }


# ── 出题引擎 ──

@app.post("/api/exam/generate")
async def generate_exam(req: ExamGenerateRequest):
    """AI 智能出题"""
    t0 = time.time()
    types_str = "选择题、填空题、计算题"

    # 加载 Prompt
    try:
        with open("prompts/exam_generate.txt","r",encoding="utf-8") as f:
            pt = f.read()
    except:
        pt = "请为{subject}{grade}生成{count}道关于{knowledge_point}的{difficulty}难度练习题。"

    prompt = pt.replace("{subject}",req.subject).replace("{grade}",req.grade)\
        .replace("{knowledge_point}",req.knowledge_point).replace("{difficulty}",req.difficulty)\
        .replace("{count}",str(req.count)).replace("{question_types}",types_str)

    if HAS_QWEN:
        try:
            model_name = req.model or "qwen-plus"
            messages = [{"role":"system","content":"你是一名出题专家，请直接输出 JSON 数组，不要额外说明。"},{"role":"user","content":prompt}]
            raw = qwen.chat(messages, model=model_name, temperature=0.5)
            # 尝试解析 JSON
            import re
            match = re.search(r'\[.*\]', raw, re.DOTALL)
            if match:
                questions = json.loads(match.group())
            else:
                questions = _mock_exam(req)
        except Exception as e:
            logger.error(f"出题 API 错误: {e}")
            questions = _mock_exam(req)
    else:
        questions = _mock_exam(req)

    elapsed = int((time.time()-t0)*1000)
    return {"success":True,"knowledge_point":req.knowledge_point,"difficulty":req.difficulty,"total_questions":len(questions),"questions":questions,"generation_time_ms":elapsed}


def _mock_exam(req) -> list:
    qs = []
    for i in range(req.count):
        t = ["choice","fill","calculation"][i%3]
        qs.append({"id":f"Q{i+1}","type":t,"content":f"{i+1}. 关于{req.knowledge_point}的练习题","options":["A","B","C","D"] if t=="choice" else [],"answer":"参考答案","difficulty":req.difficulty,"point":req.knowledge_point})
    return qs


# ── 批阅 ──

@app.post("/api/grading/auto")
async def auto_grading(req: GradingRequest):
    results = []
    for i, a in enumerate(req.answers):
        correct = a.get("expected") == a.get("student_answer")
        results.append({
            "question_id": a.get("id",f"Q{i}"),
            "ai_score": 10 if correct else 0,
            "ai_confidence": 0.92,
            "ai_feedback": "正确" if correct else "请检查",
            "status": "ai_graded"
        })
    return {"success":True, "total_score": sum(r["ai_score"] for r in results), "results":results}


# ── 作文批阅 ──

@app.post("/api/composition/grade")
async def grade_composition(req: CompositionGradingRequest):
    return {"success":True, "scores":{"content":22,"structure":18,"language":20,"handwriting":15,"total":75},
            "feedback":"内容充实，结构完整。建议加强结尾表达。", "confidence":0.86}


# ── 小微对话 ──

@app.post("/api/chat")
async def chat(payload: dict):
    """小微AI助手对话，支持意图识别+快捷指令（v0.4 扩容版）"""
    msg = payload.get("message", "")
    ctx = payload.get("context", {})
    teacher_name = ctx.get("teacher_name", "老师")
    subject = ctx.get("subject", "语文")
    grade = ctx.get("grade", "四年级")

    # 意图识别（关键词匹配，后期升级为 Qwen 意图分类）
    intent = _detect_intent(msg)
    suggestions = ["帮我写一份教案", "出10道计算题", "看看班级学习情况", "批改今天提交的作业"]

    if intent == "lesson_plan":
        reply = f"好的{teacher_name}，我马上帮您准备教案。请在教案备课页面输入课题名称，我就能自动生成啦！"
        suggestions = ["写《观潮》教案","写分数加减法教案","写My Day教案"]

    elif intent == "teaching_design":
        reply = f"{teacher_name}，教学设计我来帮您构思！请告诉我课题名称、年级和学科，我可以帮您梳理教学目标、重难点和教学流程。"
        suggestions = ["四年级语文《观潮》教学设计","三年级数学《认识分数》教学设计","五年级英语 Unit3 教学设计"]

    elif intent == "exam":
        reply = f"收到{teacher_name}！请告诉我想出什么知识点的题目，以及难度和题量，我帮您组卷。"
        suggestions = ["10道分数题L2难度","5道语文选择题","20道英语词汇题"]

    elif intent == "analytics":
        reply = f"{teacher_name}，当前班级平均分85分，作业完成率92%，家长签字率88%。需要重点关注：分数应用题（掌握度58%）、单位换算（65%）。要我针对薄弱点出题吗？"
        suggestions = ["针对薄弱点出题","查看详细学情","对比其他班级"]

    elif intent == "grading":
        reply = f"{teacher_name}，目前有12份作业待批阅，其中3份是作文需要您复核。还有3位家长尚未签字，其中2位已逾期。"
        suggestions = ["进入批阅工作台","查看低置信度列表","提醒家长签字"]

    elif intent == "composition_grading":
        reply = f"好的{teacher_name}！作文批阅是我的强项。请将学生作文提交到习作批阅模块，我可以从内容、结构、语言、书写四个维度给出点评。"
        suggestions = ["批改一篇记叙文","查看作文批阅标准","批量批阅作文"]

    elif intent == "class_activity":
        reply = f"{teacher_name}，课堂活动创意来啦！根据{grade}{subject}的特点，我建议可以尝试：小组竞赛、角色扮演、思维导图共创、闯关游戏等形式。您想要哪种类型的活动方案？"
        suggestions = ["小组竞赛活动方案","角色扮演教学设计","课堂闯关游戏设计"]

    elif intent == "parent_communication":
        reply = f"{teacher_name}，家长沟通我来帮您措辞。请告诉我是关于学生学习情况、行为表现还是活动通知？我会帮您生成得体的话术。"
        suggestions = ["学生学习情况沟通","行为表现反馈话术","家长会发言提纲"]

    elif intent == "class_meeting":
        reply = f"{teacher_name}，班会方案我来策划！请告诉我班会主题（如安全教育、心理健康、学习方法等）和年级，我帮您设计完整的班会流程。"
        suggestions = ["安全教育主题班会","学习方法分享班会","心理健康主题班会"]

    elif intent == "teaching_reflection":
        reply = f"{teacher_name}，教学反思是专业成长的重要环节。请告诉我您刚上完的课题和感受，我可以帮您从教学目标达成、课堂互动、改进方向等方面梳理反思总结。"
        suggestions = ["帮我梳理教学反思","分析本节课优缺点","生成改进计划"]

    else:
        # 通用对话（调用 Qwen）
        if HAS_QWEN:
            try:
                with open("prompts/xiaowei_chat.txt","r",encoding="utf-8") as f:
                    pt = f.read().replace("{teacher_name}",teacher_name).replace("{subject}",subject).replace("{grade}",grade)
                messages = [{"role":"system","content":pt},{"role":"user","content":msg}]
                chat_model = payload.get("model", "qwen-turbo")
                reply = qwen.chat(messages, model=chat_model, temperature=0.8)
            except:
                reply = f"老师您好！我是小微。您可以试试问我：'帮我写教案'、'出10道题'、'设计课堂活动'、'写家长沟通话术'、'班会方案'、'教学反思'哦～"
        else:
            reply = f"老师您好！我是小微👋 您可以试试问我：'帮我写教案'、'出10道题'、'设计课堂活动'、'家长沟通'、'班会方案'、'教学反思'～"

    return {"reply": reply, "suggestions": suggestions, "intent": intent}


def _detect_intent(msg: str) -> str:
    """意图检测（按优先级：教学设计 > 课堂活动 > 班会 > 作文批改 > 教案 > 出题 > 批阅 > 学情 > 家长沟通 > 教学反思）"""
    msg = msg.lower()

    # 教学设计（区别于普通教案的关键词："教学设计"）
    if any(kw in msg for kw in ["教学设计","教学方案"]): return "teaching_design"

    # 课堂活动
    if any(kw in msg for kw in ["课堂活动","活动方案","互动","游戏","竞赛","闯关","角色扮演"]): return "class_activity"

    # 班会方案
    if any(kw in msg for kw in ["班会","主题班会","班会课"]): return "class_meeting"

    # 作文批改（先于普通批阅检测，避免"作文"落入 grading）
    if any(kw in msg for kw in ["作文批改","批改作文","作文点评","批阅作文"]): return "composition_grading"
    # 同时包含"批改/批阅"+"作文"的组合也归为作文批改
    if (any(kw in msg for kw in ["批改","批阅"]) and "作文" in msg): return "composition_grading"

    # 教案/备课
    if any(kw in msg for kw in ["教案","备课","写教案","生成教案"]): return "lesson_plan"

    # 出题
    if any(kw in msg for kw in ["出题","组卷","题目","试卷","测验","考试","练习题","计算题"]): return "exam"

    # 家长沟通
    if any(kw in msg for kw in ["家长沟通","家长话术","家长会发言","跟家长","通知家长","家长"]): return "parent_communication"

    # 教学反思
    if any(kw in msg for kw in ["教学反思","反思总结","课后反思","改进计划","本节课反思"]): return "teaching_reflection"

    # 批阅/批改
    if any(kw in msg for kw in ["批改","批阅","签字","作文"]): return "grading"

    # 学情
    if any(kw in msg for kw in ["学情","班级","成绩","分析","数据","情况"]): return "analytics"

    # 剩余"作业"归给grading
    if "作业" in msg: return "grading"

    return "general"


# ── 模拟（开发用）──

def _mock_lesson_plan(req) -> str:
    """生成分学科的模拟教案模板"""
    subject = req.subject
    title = req.lesson_title
    subject_samples: dict = {
        "语文": f"""# {title}\n\n## 一、教学目标\n### 知识与技能\n- 认识本课8个生字，会写12个生字，理解重点词语\n- 能正确、流利、有感情地朗读课文\n\n### 过程与方法\n- 通过自主阅读和小组合作探究，把握文章主要内容\n- 学习作者运用修辞手法（比喻/拟人/排比）表达情感的方法\n\n### 情感态度与价值观\n- 感受语言文字之美，激发对祖国语言文字的热爱\n- 体会课文表达的思想感情，获得审美体验\n\n## 二、教学重点\n- 品读重点段落，体会作者的语言表达特点\n- 理解文章主要内容，把握文章结构\n\n## 三、教学难点\n- 体会文章深层含义和思想感情\n- 学习并尝试运用课文中的写作方法\n\n## 四、教学过程\n### 1. 导入环节（约3分钟）\n播放与课文主题相关的图片/视频，创设情境，引出课题。\n### 2. 初读感知（约8分钟）\n自由朗读课文，圈画生字词，交流预习收获。\n### 3. 品读感悟（约15分钟）\n聚焦重点段落，通过朗读、讨论、想象画面等方式品味语言。\n### 4. 拓展延伸（约10分钟）\n仿写练笔或口语表达，学以致用。\n### 5. 课堂小结（约4分钟）\n师生共同总结本课学习内容和收获。\n\n## 五、板书设计\n{title}\n├── 生字词: ...\n├── 文章结构: ...\n└── 写作特色: ...\n\n## 六、课标对齐\n| 目标 | 课标 |\n|------|------|\n| 把握主要内容 | 第二学段·阅读3.2 |\n| 体会思想感情 | 第二学段·阅读3.4 |""",
        "数学": f"""# {title}\n\n## 一、教学目标\n### 知识与技能\n- 理解{title}的算理/概念\n- 掌握{title}的基本计算方法/解题步骤\n- 能运用所学知识解决简单实际问题\n\n### 过程与方法\n- 经历探究过程，发展数学思维（数感/推理/建模）\n- 通过动手操作和小组讨论培养合作学习能力\n\n### 情感态度与价值观\n- 感受数学与生活的密切联系\n- 培养严谨认真的学习态度\n\n## 二、教学重点\n- 理解算理/概念的本质含义\n- 掌握正确的计算方法和解题策略\n\n## 三、教学难点\n- 理解抽象概念的形成过程\n- 灵活运用所学知识解决变式问题\n\n## 四、教学过程\n### 1. 情境导入（约5分钟）\n创设生活情境，引出数学问题，激发探究欲望。\n### 2. 探究新知（约12分钟）\n借助教具/课件演示，引导学生独立思考+小组讨论，发现规律。\n### 3. 巩固练习（约12分钟）\n分层练习：基础题（全体）+ 提高题（选做）+ 挑战题。\n### 4. 拓展应用（约8分钟）\n解决实际生活问题，培养应用意识。\n### 5. 课堂小结（约3分钟）\n回顾本节课知识要点，布置课后作业。\n\n## 五、板书设计\n{title}\n├── 情境导入: ...\n├── 新授环节: ...\n└── 练习: 课本题 + 补充题\n\n## 六、课标对齐\n| 目标 | 课标 |\n|------|------|\n| 理解算理 | 第二学段·数与代数 4.1 |\n| 解决问题 | 第二学段·综合实践 4.4 |""",
        "英语": f"""# {title}\n\n## 一、Teaching Objectives\n### Knowledge & Skills\n- Students will be able to recognize, read and spell the target vocabulary\n- Students will be able to use the key sentence pattern in communication\n\n### Process & Methods\n- Through games, songs and role-play activities\n- Task-based language teaching approach\n\n### Emotion & Values\n- Develop interest in English learning\n- Understand cultural differences\n\n## 二、Key Points\n- Master the target vocabulary and sentence pattern\n- Use language in real communication contexts\n\n## 三、Difficult Points\n- Correct pronunciation of challenging sounds\n- Confident oral output in full sentences\n\n## 四、Teaching Procedure\n### 1. Warm-up (5 min)\nSing an English song / Play a quick word game\n### 2. Presentation (12 min)\nIntroduce new words with flashcards/PPT, model pronunciation\n### 3. Practice (15 min)\nPair work, group activities, role-play dialogues\n### 4. Production (8 min)\nStudents create their own dialogues/sentences using target language\n\n## 五、Board Design\n{title}\n├── New words: ...\n├── Key sentence: ...\n└── Game/Activity: ...""",
    }
    return subject_samples.get(subject, subject_samples.get("语文", ""))
