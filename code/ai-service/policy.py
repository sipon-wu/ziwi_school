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
import os
from subjects import normalize_subject

# ── 负面清单（平台可维护；新增只需往这里加词）──
# 注意：本清单按「朴素子串匹配」执行，收词务必精确到具体符号/作品，
# 不要收录「卡通」这类既是通用美术风格、又是平台自有风格名的宽泛词。
# 历史缺陷（2026-09-03）：曾收录裸词「卡通」，而平台本身提供 sp-cartoon 卡通风主题，
# 导致教师选用卡通风生成的课件只要正文出现「卡通」二字就被自己的红线闸拦下
# （CODE=CONTENT_BLOCKED / negative_symbol），产品自相矛盾。
# 本意要拦的是「日本二次元/动漫」这一外来亚文化，已由下列 动漫/日本动漫/日本卡通/日漫/二次元 覆盖。
NEGATIVE_KEYWORDS = [
    # ① 商业亚文化符号
    "麦当劳", "肯德基", "汉堡王", "星巴克", "可口可乐", "百事可乐",
    # ② 外来亚文化（日本二次元/动漫等）
    "二次元", "动漫", "日本动漫", "日本卡通", "日漫", "cosplay", "COSPLAY",
    "奥特曼", "宝可梦", "皮卡丘", "漫威", "DC", "迪士尼公主",

]

# ── 敏感主题词（2026-09-12 补：黄赌毒 / 暴力恐怖 / 自残 / 迷信邪教）──
#
# 为什么**不**放进 NEGATIVE_KEYWORDS（即不直接 block）：
#   这些词**有合法语境**——禁毒课、普法课、心理课、安全教育课都会大量出现
#   （"吸毒会严重损害健康，必须远离"是**合规且必要**的教学内容）。
#   若靠词表直接判 block，会重演上面「卡通」那条教训的翻版：
#   **禁毒教育课被自己的红线闸拦下，还会被自动"修正"逻辑删掉禁毒内容。**
#
# 所以分两级：
#   · NEGATIVE_KEYWORDS  （level=block）：**无合法语境**的商业/外来亚文化符号 → 直接拦
#   · SENSITIVE_KEYWORDS （level=warn） ：主题词/行为词 → 是否升级为 block，
#     由 `_llm_ethic_flags` 按**立场**判定（批判/警示/科普 → 放行；美化/教唆/给方法 → block）
#
# 分级的好处：**可以收得更全**（不怕误伤），同时**不漏**（出现即被看见）。
SENSITIVE_KEYWORDS = [
    # 黄
    "色情", "淫秽", "嫖娼", "卖淫", "情色", "成人视频", "黄色网站", "裸聊",
    # 赌
    "赌博", "赌场", "赌球", "六合彩", "老虎机", "博彩", "网络赌博", "赌资",
    # 毒
    "毒品", "吸毒", "贩毒", "制毒", "冰毒", "海洛因", "大麻", "摇头丸",
    "罂粟", "甲基苯丙胺", "毒枭",
    # 暴力 / 恐怖 / 自残
    "恐怖袭击", "恐怖主义", "血腥", "虐杀", "凶杀", "分尸", "自残", "割腕", "自杀",
    # 迷信 / 邪教
    "邪教", "跳大神", "驱鬼", "符水", "算命", "招魂",
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
# key 统一为标准 9 学科（与 subjects.py 同源）。
SUBJECT_ORBIT_HINTS = {
    "物理": "可融入「科学拓展」：关联工程技术、航天/能源/材料前沿、生活中的物理现象，激发探究欲。",
    "化学": "可融入「科学拓展」：关联材料、环境、生活中的化学现象与趣味实验，激发探究欲。",
    "生物": "可融入「科学拓展」：关联生命现象、生态环保、健康与前沿生物科技，激发探究欲。",
    "语文": "可融入「课外阅读」：关联同主题名篇、整本书阅读延伸、作者背景或文化典故，开阔文学视野。",
    "历史": "可融入「课外阅读」：关联同期史料、人物故事、文化遗产，培养史料实证意识。",
    "地理": "可融入「地理视野」：关联自然地理现象、区域发展、生活中的地理，开阔空间认知。",
    "政治": "可融入「社会视野」：关联法治生活、社会热点、家国情怀与责任担当，培养公民意识。",
    "数学": "可融入「同级奥数拓展」：关联思维体操、趣味数学、生活中的数学建模，锻炼灵活思维。",
    "英语": "可融入「更宽口径」：关联跨文化真实语境、原版阅读片段、生活交际，用中性生活案例开阔视野"
            "（避免商业/外来亚文化符号）。",
}


def subject_orbit_hint(subject: str) -> str:
    """按学科返回原生拓展提示（以归一到标准 9 学科后的精确 key 匹配），未命中返回空。"""
    if not subject:
        return ""
    norm = normalize_subject(subject)
    if not norm:
        return ""
    return SUBJECT_ORBIT_HINTS.get(norm, "")


def scan_negative(text: str) -> list:
    """敏感内容扫描（**两级**），返回 issue 列表。

    · NEGATIVE_KEYWORDS  → level=block：无合法语境的商业/外来亚文化符号，直接拦。
    · SENSITIVE_KEYWORDS → level=warn ：黄赌毒/暴力恐怖/自残/迷信邪教等**有合法语境**的主题词，
      只提醒 + 交语义复核，是否升级 block 由 `_llm_ethic_flags` 按立场判定。
    """
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
    for kw in SENSITIVE_KEYWORDS:
        if kw in text:
            issues.append({
                "type": "sensitive_topic",
                "level": "warn",
                "keyword": kw,
                "message": f"出现敏感主题词「{kw}」：请确认它是**合规教学内容**"
                           f"（禁毒/普法/心理/安全教育中被明确批判或警示），还是美化/教唆。",
                "suggestion": "若为批判/科普表述则保留（由语义复核确认）；"
                              "若为美化、教唆或含可操作细节，必须改写。",
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
        "只返回 JSON 数组，每项 {\"type\":\"ethnic_diff|value_bias|beyond_band|harmful_content\","
        "\"level\":\"block|warn\",\"message\":简短说明,\"suggestion\":修改建议}；若都没有，返回 []。\n"
        "审查口径（务必遵守分级）：\n"
        "1) ethnic_diff（level=block）： ONLY 当出现「国内某民族 vs 另一民族」的对比/差异化/优劣呈现时才标。"
        "注意：单独使用「中华民族 / 中国 / 中国人民 / 民族自豪感」是合规对齐表述，不要标记为问题。\n"
        "   严禁误报（以下都不是民族差异，必须放行）：动物之间、植物之间、事物/概念之间、"
        "人物角色之间的任何对比，例如「牛 vs 鹅」「猫 vs 狗」「优点 vs 缺点」「古代 vs 现代」。"
        "不要把「X vs Y」句式本身当成民族对比——只有主语确实是民族/族群时才成立。\n"
        "2) value_bias（level=warn）：价值观/行为表述明显说教式灌入、或偏离《思想品德》温和口径；"
        "仅当严重偏离才标 block，一般标 warn。\n"
        "3) beyond_band（level=warn）：内容疑似明显超出相邻一个年级档，或跨界桥接的课标对齐超出±1档。"
        "注意：课件允许受控跨界与适度超纲（如关联科学/历史/生活），这本身不是问题，"
        "只有明显严重超界才标 warn（不要标 block）。\n"
        "4) harmful_content（level=block）：**只有出现美化、教唆、或可操作细节**时才标 block："
        "色情露骨描写、赌博技巧与赌具、吸毒制毒方法或获取渠道、血腥暴力细节、恐怖主义宣传、"
        "自残/自杀方法、封建迷信的具体操作（跳大神/驱鬼/符水等）。\n"
        "   判据是**立场**，不是词面：批判/警示 → 放行；美化/教唆/给方法 → block。\n"
        "   严禁误报（以下必须放行）：禁毒、防赌、普法、安全教育、健康与心理课中"
        "**作为反面教材被明确批判或警示**的内容（如「吸毒会严重损害健康，必须远离」）。\n"
        f"课件内容：\n{text}\n"
    )
    try:
        # 不写死模型：由调用方决定（红线复核必须能用**独立模型**，见 api_server 的 SAFETY_MODEL）
        raw = call_llm([{"role": "user", "content": prompt}], max_tokens=1200)
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

    ⚠️ **LLM 复核不授予 block 权**（2026-09-12 实测修正）。
    理由：实测三条用例误报率 100%——连"钱塘江大潮自古以来被称为天下奇观"这种
    完全正常的内容都被判成 ethnic_diff + harmful_content；禁毒教育也被判 harmful_content。
    在"不可靠的判官不能有判决权"这条原则上，LLM 复核只能**提示**：
      · block 的确定性来源 = 词表（NEGATIVE_KEYWORDS，无合法语境）
      · LLM 判定的 block 一律降级为 warn，原文案保留在 message 里，并附 ai_level 供观察
    待准确率被标注样例证明后，可用 `CW_SAFETY_LLM_BLOCK=1` 恢复其 block 权。
    """
    ctx = ctx or {}
    issues = scan_negative(text)
    # LLM 复核（民族差异化/价值观/超界/有害内容），仅当提供了 call_llm 时才跑
    llm_flags = _llm_ethic_flags(text, call_llm)
    llm_block_allowed = os.getenv("CW_SAFETY_LLM_BLOCK") == "1"
    for f in llm_flags:
        f.setdefault("level", "warn")
        if f.get("level") == "block" and not llm_block_allowed:
            f["ai_level"] = "block"
            f["level"] = "warn"
            f["message"] = "【AI 复核建议·需人工确认】" + str(f.get("message", ""))
        issues.append(f)
    # 任何 block 级问题 → 不通过
    passed = not any(i.get("level") == "block" for i in issues)
    return {"pass": passed, "issues": issues}


# ── 家校宣发（notice）专用红线（2026-09-03）────────────────────────────────
# 产品原则：安全类宣发（防溺水/交通/消防等）涉及生命安全的条款必须对齐官方口径，
# 不允许 AI 或教师自行演绎安全条款（编造"六不"变体、自创自救步骤等）。
# 校验策略（朴素子串匹配；官方短语集随政策由平台维护）：
#   · 命中「强触发词」→ 正文必须含至少一条官方关键短语，否则 block；
#   · 仅命中「弱触发词」→ warn 提醒补官方口径/求助渠道，不阻断；
#   · 通用负面清单（policy_gate_publish 的扫描）对 notice 同样生效。
NOTICE_SAFETY_GUARD = [
    {
        "topic": "防溺水",
        "strong": ["溺水", "下水游泳", "私自下水", "防溺水"],
        "weak": ["游泳", "水边", "河湖", "水域"],
        "official": ["不私自下水游泳", "不擅自与他人结伴游泳", "不在无家长或教师带领的情况下游泳",
                     "不到无安全设施、无救援人员的水域游泳", "不到不熟悉的水域游泳",
                     "不熟悉水性的学生不擅自下水施救", "六不"],
        "official_text": "教育部防溺水『六不一会』：不私自下水游泳；不擅自与他人结伴游泳；"
                         "不在无家长或教师带领的情况下游泳；不到无安全设施、无救援人员的水域游泳；"
                         "不到不熟悉的水域游泳；不熟悉水性的学生不擅自下水施救。",
    },
    {
        "topic": "交通安全",
        "strong": ["一盔一带", "头盔", "安全带", "骑电动车", "骑自行车"],
        "weak": ["交通安全", "闯红灯", "过马路"],
        "official": ["一盔一带", "不闯红灯", "未满12周岁不得骑自行车", "未满16周岁不得骑电动自行车",
                     "走人行横道", "斑马线"],
        "official_text": "交通安全官方口径：『一盔一带』；不闯红灯；过马路走人行横道（斑马线）；"
                         "未满12周岁不得骑自行车上路；未满16周岁不得骑电动自行车上路。",
    },
    {
        "topic": "消防安全",
        "strong": ["火灾", "用火", "玩火", "消防"],
        "weak": ["灭火器", "逃生"],
        "official": ["不玩火", "119", "湿毛巾", "弯腰", "逃生"],
        "official_text": "消防安全提示（官方口径）：不玩火；发现火情拨打 119；"
                         "浓烟中用湿毛巾捂住口鼻、弯腰低姿逃生。",
    },
    {
        "topic": "心理健康",
        "strong": [],
        "weak": ["心理健康", "情绪", "抑郁", "焦虑"],
        "official": ["12356", "学校心理", "心理老师", "寻求帮助", "求助"],
        "official_text": "心理健康口径：请让孩子知道——遇到困扰可第一时间告诉家长或老师，"
                         "也可拨打全国心理援助热线 12356（24 小时）。",
    },
]


def scan_notice_guard(text: str) -> list:
    """notice 安全口径专用校验：强命中主题却缺官方句 → block；弱命中 → warn。"""
    if not text:
        return []
    issues = []
    for rule in NOTICE_SAFETY_GUARD:
        strong_hit = any(k in text for k in rule["strong"])
        weak_hit = any(k in text for k in rule["weak"])
        if not (strong_hit or weak_hit):
            continue
        has_official = any(o in text for o in rule["official"])
        if strong_hit and not has_official:
            issues.append({
                "type": "notice_official_wording",
                "level": "block",
                "keyword": rule["topic"],
                "message": f"「{rule['topic']}」属安全宣发，安全条款必须采用官方口径；"
                           f"当前正文缺少官方关键表述，请勿自行演绎安全条款。",
                "suggestion": rule["official_text"],
            })
        elif not has_official:
            issues.append({
                "type": "notice_official_wording",
                "level": "warn",
                "keyword": rule["topic"],
                "message": f"「{rule['topic']}」宣发建议补充官方口径/求助渠道，用家长和孩子都看得懂的话写清楚。",
                "suggestion": rule["official_text"],
            })
    return issues


def policy_gate_notice(text: str, ctx: dict = None, call_llm=None) -> dict:
    """家校宣发发布校验 = 通用负面清单 + 安全口径专用校验 + 轻量复核。

    与 policy_gate_publish 的区别：notice 额外执行 NOTICE_SAFETY_GUARD 的口径对照，
    拦截「自行演绎安全条款」的宣发内容。
    """
    ctx = ctx or {}
    issues = scan_negative(text) + scan_notice_guard(text)
    llm_flags = _llm_ethic_flags(text, call_llm)
    for f in llm_flags:
        f.setdefault("level", "warn")
        issues.append(f)
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
