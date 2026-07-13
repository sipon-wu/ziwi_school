"""
课件红线策略模块（平台维护，随知识库更新）。

设计原则（来自产品决议 2026-07-13）：
1. 发散不等于失守：课件允许「锚点—轨道—边缘」三层，轨道区可跨界、可适度超纲，
   但受 ±1 年级档 + 课标对齐 ±1 约束；边缘区为价值观/行为/情感，靠互动承载而非说教。
2. 负面清单（不许出现）：商业亚文化符号（麦当劳/肯德基等）、外来亚文化
   （日本二次元/动漫卡通等）、国内民族差异化呈现。
3. 对齐原则：中华民族对外口径统一对齐《思想品德》要求；国内各民族不区分呈现。
4. 发布时才过闸：草稿永远可编辑；只有「发布进素材库」这一动作才跑 policy_gate_publish，
   不过就列出问题让教师修改（指出问题并提醒修改，而非锁死草稿）。
5. 若规则维护过于复杂则降级为纯关键词扫描（本模块默认即关键词 + 轻量 LLM 复核）。

对外接口：
- scan_negative(text)            关键词负面清单扫描
- divergence_budget(level)       发散预算（轨道/边缘条数 + 是否允许超±1档）
- policy_consult(ctx)            课前问诊：返回 2~3 个针对性问题
- policy_gate_publish(text, ctx) 发布校验：返回 {pass, issues}
"""

import re
import json

# ── 负面清单（平台可维护；新增只需往这里加词）──
NEGATIVE_KEYWORDS = [
    "麦当劳", "肯德基", "汉堡王", "星巴克", "可口可乐", "百事可乐",
    "二次元", "动漫", "卡通", "日本动漫", "日漫", "cosplay", "COSPLAY",
    "奥特曼", "宝可梦", "皮卡丘", "漫威", "DC", "迪士尼公主",
]

# 民族差异化：不应出现「某族人如何/某族 vs 某族」的对比式呈现。
# 正向口径提示（用于 LLM 复核与生成提示词），由平台统一维护。
ETHIC_PRINCIPLE = (
    "中华民族对外口径须统一对齐《思想品德》课程要求；"
    "国内各民族不区分、不对比呈现，统一表述为中华民族；"
    "价值观/行为/情感内容以互动体验方式承载，不得说教式灌入。"
)

# 发散预算：轨道=跨界桥接/适度超纲条数；edge=边缘知识条数；beyond=是否允许±1档外延伸（默认仅±1）
DIVERGENCE_BUDGET = {
    "conservative": {"orbit": 1, "edge": 1, "beyond_band": False, "label": "保守"},
    "standard":     {"orbit": 3, "edge": 2, "beyond_band": True,  "label": "标准"},
    "expansive":    {"orbit": 5, "edge": 3, "beyond_band": True,  "label": "发散"},
}


def divergence_budget(level: str) -> dict:
    return DIVERGENCE_BUDGET.get(level, DIVERGENCE_BUDGET["standard"])


# ── 学科原生拓展（轨道区按学科注入，低成本提示词精修，来自产品决议 2026-07-13 第 2 点）──
# 这些本来就是学科图谱的「相邻原生拓展」，不是独立价值观库，直接纳入轨道区抽取即可。
SUBJECT_ORBIT_HINTS = {
    "科学": "可融入「科学拓展」：关联前沿科技、自然现象、工程应用或课堂可演示的小实验，激发探究欲。",
    "物理": "可融入「科学拓展」：关联工程技术、航天/能源/材料前沿、生活中的物理现象，激发探究欲。",
    "化学": "可融入「科学拓展」：关联材料、环境、生活中的化学现象与趣味实验，激发探究欲。",
    "生物": "可融入「科学拓展」：关联生命现象、生态环保、健康与前沿生物科技，激发探究欲。",
    "语文": "可融入「课外阅读」：关联同主题名篇、整本书阅读延伸、作者背景或文化典故，开阔文学视野。",
    "历史": "可融入「课外阅读」：关联同期史料、人物故事、文化遗产，培养史料实证意识。",
    "数学": "可融入「同级奥数拓展」：关联思维体操、趣味数学、生活中的数学建模，锻炼灵活思维。",
    "英语": "可融入「更宽口径」：关联跨文化真实语境、原版阅读片段、生活交际，用中性生活案例开阔视野"
            "（避免商业/外来亚文化符号）。",
}


def subject_orbit_hint(subject: str) -> str:
    """按学科返回原生拓展提示（命中前缀/包含即匹配），未命中返回空。"""
    if not subject:
        return ""
    for key, hint in SUBJECT_ORBIT_HINTS.items():
        if subject.startswith(key) or key in subject:
            return hint
    return ""


def scan_negative(text: str) -> list:
    """关键词负面清单扫描，返回 issue 列表（block 级，必须修改）。"""
    if not text:
        return []
    issues = []
    for kw in NEGATIVE_KEYWORDS:
        # 允许作为「反面教材」被明确批评的情形极少见，这里一律标记待确认
        if kw in text:
            issues.append({
                "type": "negative_symbol",
                "level": "block",
                "keyword": kw,
                "message": f"出现商业/外来亚文化符号「{kw}」，请移除或改用学科/生活本真案例。",
                "suggestion": "替换为与知识点直接相关的学科情境或中性生活案例。",
            })
    return issues


def _llm_ethic_flags(text: str, call_llm) -> list:
    """轻量 LLM 复核：民族差异化 / 价值观偏差 / 疑似超界。失败返回空（不误伤）。

    关键分级（与产品决议 2026-07-13 对齐）：
    - block 仅用于真红线：国内民族差异化对比、商业/外来亚文化符号（关键词已单独扫描）。
    - warn 用于「提醒但不阻断」：轻微超 ±1 档、价值观略显说教——教师可保留，仅作提示。
    - 「中华民族 / 中国 / 中国人民 / 民族自豪感」均为合规对齐表述，严禁误判为问题。
    """
    if not text or not call_llm:
        return []
    prompt = (
        "你是中小学课件内容安全审核员。请审查下面这段课件是否含有以下问题，"
        "只返回 JSON 数组，每项 {\"type\":\"ethnic_diff|value_bias|beyond_band\","
        "\"level\":\"block|warn\",\"message\":简短说明,\"suggestion\":修改建议}；若都没有，返回 []。\n"
        "审查口径（务必遵守分级）：\n"
        "1) ethnic_diff（level=block）：出现「国内某民族 vs 另一民族」的对比/差异化/优劣呈现。"
        "注意：单独使用「中华民族 / 中国 / 中国人民 / 民族自豪感」是合规对齐表述，不要标记为问题。\n"
        "2) value_bias（level=warn）：价值观/行为表述明显说教式灌入、或偏离《思想品德》温和口径；"
        "仅当严重偏离才标 block，一般标 warn。\n"
        "3) beyond_band（level=warn）：内容疑似明显超出相邻一个年级档，或跨界桥接的课标对齐超出±1档。"
        "注意：课件允许受控跨界与适度超纲（如关联科学/历史/生活），这本身不是问题，"
        "只有明显严重超界才标 warn（不要标 block）。\n"
        f"课件内容：\n{text}\n"
    )
    try:
        raw = call_llm([{"role": "user", "content": prompt}], "qwen-turbo", 1200)
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        if not m:
            return []
        flags = json.loads(m.group(0))
        if isinstance(flags, list):
            return flags
    except Exception:
        pass
    return []


def policy_gate_publish(text: str, ctx: dict = None, call_llm=None) -> dict:
    """发布校验：综合关键词扫描 + 轻量 LLM 复核。

    返回 {pass: bool, issues: [ {type, level, message, suggestion, ...} ]}。
    level=block 必须修改后才能发布；level=warn 提醒但不阻断。
    """
    ctx = ctx or {}
    issues = scan_negative(text)
    # LLM 复核（民族差异化/价值观/超界），仅当提供了 call_llm 时才跑
    llm_flags = _llm_ethic_flags(text, call_llm)
    for f in llm_flags:
        f.setdefault("level", "warn")
        issues.append(f)
    # 任何 block 级问题 → 不通过
    passed = not any(i.get("level") == "block" for i in issues)
    return {"pass": passed, "issues": issues}


def policy_consult(ctx: dict = None, call_llm=None) -> list:
    """课前问诊：返回 2~3 个针对性问题（逐项要答案）。失败回退模板问题。"""
    ctx = ctx or {}
    subject = ctx.get("subject", "语文")
    grade = ctx.get("grade", "四年级")
    title = ctx.get("lesson_title", "")
    kp = ctx.get("knowledge_points") or []
    kp_hint = f"本课知识点：{', '.join(kp)}。" if kp else ""
    template = [
        {"id": "focus", "question": "这节课更想侧重「跨界启发/思维发散」还是「夯实核心基础」？",
         "options": ["跨界启发为主", "基础与启发兼顾", "夯实基础为主"]},
        {"id": "extension", "question": "是否加入学科原生拓展（如科学拓展/课外阅读/同级奥数/英语拓宽）？",
         "options": ["加入，适度即可", "不加，紧扣课本", "多加点，开阔视野"]},
        {"id": "values", "question": "价值观/行为/情感落点想放在哪（将作为互动环节轻推，不喧宾）？",
         "options": ["科学探究精神", "合作与倾听（行为准则）", "文化认同与家国情怀", "暂不特意设计"]},
    ]
    if not call_llm:
        return template
    prompt = (
        f"你是资深教研员，正在为{grade}{subject}《{title}》备课做课前问诊。"
        f"{kp_hint}请向教师提出 2~3 个最关键的针对性问题，帮助明确课件设计方向。"
        "只返回 JSON 数组，每项 {\"id\":短标识, \"question\":问题, \"options\":[2~3个可选答案]}；"
        "问题要具体、与教学相关、可直接用于约束 AI 生成。不要解释。"
    )
    try:
        raw = call_llm([{"role": "user", "content": prompt}], "qwen-turbo", 1000)
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        if not m:
            return template
        qs = json.loads(m.group(0))
        if isinstance(qs, list) and qs:
            return qs
    except Exception:
        pass
    return template
