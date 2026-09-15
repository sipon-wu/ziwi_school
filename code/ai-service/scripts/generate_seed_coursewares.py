#!/usr/bin/env python3
"""AI 批量生成种子课件 -- 按 skills/ 的 Skill 规则生成,脚本零内容决策.

与 api_server.py 走同一套 Skill(约定 0:课件只能由 Skill 生成):

  . 领域知识**全部从 skills/ 加载**,本文件不内置任何规则副本
    (历史教训:曾各写一套 prompt,导致两套相互矛盾的规则)
  . 模型直接产出**最终 Markdown**--版式,可视化,互动,配色全由模型写
  . 脚本只做三件事:拆分两段输出,VISUAL 的 base64 编码,落库

唯一的后处理是 VISUAL 编码:模型写不了 base64,而前端 VISUAL 注释要求 base64.
这是纯编码,不含任何内容决策(不挑版式,不改组件,不补字段).

已删除的硬编码(曾导致产出带硬编码味,且 STYLEDNA 因前端不识别显示在页面上):
  _coerce_iwb / _render_interaction / build_markdown / 分类外挂 / 字段推算.
这些内容全部回到提示词,由 Skill 自行产出与自检.

用法(需 DASHSCOPE_API_KEY + DATABASE_URL):
    python scripts/generate_seed_coursewares.py --limit 1 --print-md  # 试跑看产出
    python scripts/generate_seed_coursewares.py --force               # 全量覆盖落库
    python scripts/generate_seed_coursewares.py --plan plan.json      # 外部课件清单
"""
import argparse
import base64
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

# 复用检查器的字数口径（**单一事实源**）：本文件既被 api_server 以包方式导入
# （`from scripts.generate_seed_coursewares import ...`），也可能被
# `python scripts/generate_seed_coursewares.py` 直接执行 —— 两种情况都要能 import。
if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.check_courseware_quality import (  # noqa: E402
    text_len, is_en, VALID_LAYOUTS as SLIDE_VALID_LAYOUTS, H5_SCENE_LAYOUTS,
    CONTENT_LAYOUTS as CHECKER_CONTENT_LAYOUTS, INTERACTION_RE as CHECKER_INTERACTION_RE,
)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import dashscope
from dashscope import Generation

dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")
MODEL = os.getenv("CW_SEED_MODEL", "qwen-plus")

from asset_candidates import build as asset_build, to_prompt_block  # noqa: E402
from check_courseware_quality import (  # noqa: E402
    check_markdown, VALID_VISUAL_TYPES,
)

# psycopg2 延迟导入:试跑(--dry-run / --out-dir)不连库,
# 缺驱动不该挡住"看一眼 Skill 产出"这件事.

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    h = os.getenv("DB_HOST", "localhost")
    p = os.getenv("DB_PORT", "5432")
    u = os.getenv("DB_USER", "zhiwei")
    pw = os.getenv("DB_PASSWORD", "zhiwei2026")
    db = os.getenv("DB_NAME", "zhiwei")
    DATABASE_URL = f"postgresql://{u}:{pw}@{h}:{p}/{db}?sslmode=disable"

# 种子课件归属学校.前端素材列表按 school_id 精确过滤,写 NULL 会不可见.
SCHOOL_ID = os.getenv("CW_SEED_SCHOOL_ID", "sch-0001")

# 课件归属教师账号(user_id).与教案归属对齐:
# 这批教案全部挂在 u-teacher 名下,课件也挂同一账号,
# 便于"教案 -> 课件"链路在同一账号下对照验证.留空则仍写 NULL(学校公共素材).
OWNER_ID = os.getenv("CW_SEED_OWNER_ID", "")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS_DIR = os.path.join(BASE, "skills")

# -- 种子课件计划 --
# 与 backend/cmd/seed/full 中的 4 个教案 1:1 匹配(语文/四年级),
# 确保"教案 -> 课件"链路可对照验证;再加 3 套跨学科/学段/格式的覆盖验证.
COURSEWARES = [
    {"name": "《观潮》PPT课件", "subject": "语文", "grade": "四年级",
     "style": "china", "format": "ppt", "lesson": "《观潮》第一课时"},
    {"name": "《桂花雨》PPT课件", "subject": "语文", "grade": "四年级",
     "style": "china", "format": "ppt", "lesson": "《桂花雨》精读"},
    {"name": "《走月亮》PPT课件", "subject": "语文", "grade": "四年级",
     "style": "fresh", "format": "ppt", "lesson": "《走月亮》赏析"},
    {"name": "《繁星》PPT课件", "subject": "语文", "grade": "四年级",
     "style": "fresh", "format": "ppt", "lesson": "《繁星》阅读"},
    {"name": "《函数》PPT课件", "subject": "数学", "grade": "高一",
     "style": "tech", "format": "ppt"},
    {"name": "《My School》PPT课件", "subject": "英语", "grade": "三年级",
     "style": "fresh", "format": "ppt"},
    {"name": "《天气》H5互动课件", "subject": "科学", "grade": "二年级",
     "style": "fresh", "format": "h5"},
]

THEME_BY_STYLE = {
    "china": "zgf-ink-wash",
    "tech": "te-quantum-blue",
    "fresh": "fr-mint",
    "academic": "aca-edu-blue",
    "cartoon": "sp-cartoon",
    "minimal": "min-classic-blue",
}


# -- Skill 领域知识加载 --

def load_skill_doc(rel: str) -> str:
    """从 skills/ 读一份领域知识.缺失返回空串(不内置副本,避免两套规则)."""
    path = os.path.join(SKILLS_DIR, rel)
    if not os.path.exists(path):
        print(f"[warn] Skill 领域知识缺失:{path}", file=sys.stderr)
        return ""
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read().strip()
    except Exception as e:
        print(f"[warn] Skill 领域知识读取失败 {path}:{e}", file=sys.stderr)
        return ""


def skill_rules(fmt: str, style: str) -> str:
    """组装本次生成要遵守的 Skill 规则.

    套路 = 通用骨架 + 专属差异:

      通用骨架(skills/shared/,PPT 与 H5 共用)
        质量宪法 -- 内容质量(视角 / 篇幅 / 互动 / 占位符)
        输出契约 -- 分段方式 / 注释白名单 / 互动标记 / meta / 通用禁忌
        字数分拆 -- 拆句手法(字长上限按格式在文件内分列)
      专属差异
        PPT -> courseware-ppt/references/版式与组件选型.md
        H5  -> courseware-h5/references/场景与互动规范.md
        page_structure(fmt) -- 决定产物形态的那一段,不可通用
      风格卡:只给语义倾向,色值由 Skill 当次生成
    """
    # 与 api_server.py 的 _SKILL_REFS 必须一致（两套清单 = 两套 prompt，历史上正是这样漂移的）
    refs = [
        "shared/质量宪法.md",
        "shared/输出契约.md",
        "shared/字数分拆.md",
        "courseware-h5/references/场景与互动规范.md" if fmt == "h5"
        else "courseware-ppt/references/版式与组件选型.md",
        # 媒介纪律（2026-09-12 接线）：此前写好却未进提示词，等于没写
        "courseware-h5/references/媒介纪律-H5.md" if fmt == "h5"
        else "courseware-ppt/references/媒介纪律-PPT.md",
    ]
    chunks = [load_skill_doc(r) for r in refs]
    chunks.append(page_structure(fmt))

    # 不指定风格时(style 为空)故意**不加载**风格卡 -- 把风格决策权完整交给 Skill,
    # 由它依据课题内容自行确定气质/母题/禁忌(用于验证 Skill 自主定风格的能力).
    style_doc = load_skill_doc(f"shared/styles/{style}.md") if style else ""
    if style_doc:
        chunks.append("## 风格卡\n\n"
                      "下面只描述**语义倾向**(气质 / 形态 / 母题 / 禁忌),**不给色值**--\n"
                      "配色由你当次生成,并写入 styleDNA.\n\n" + style_doc)
    return "\n\n--\n\n".join(c for c in chunks if c)


# -- 输出契约(提示词核心) --

PPT_STRUCTURE = """[本课件是 PPT]

**结构骨架**(顺序固定,缺一不可):
`## 标题` -> `<!-- layout: 版式名 -->` -> 若干 `- 要点` -> `<!-- VISUAL_JSON:... -->`

**约束**(全部见 `courseware-ppt/references/版式与组件选型.md`):
- 版式集合,版式x字长,组件字段结构与字数契约,丰满度
- 候选素材清单中**装饰的 ID 走 decor_refs**,不是 VISUAL_JSON 的 type

**不要做的**:
- **不示范具体场景**--你自己按课题设计,**不要参考"## 潮来...## 水在..."这样的固定模板**
- 不要把 VISUAL_JSON 写成二维 `cells`(对比表是 `rows` 嵌套)
- 不要把互动(quiz/read/readalong/reveal/draw)写成 VISUAL_JSON 的 type
  --它们不是组件,平台一律丢弃,等于你的互动全没了
- 不要自创版式名;不要把组件类型当版式

**自检**:
- 内容页(content-2col / content-grid / image-text / title-body)每页必须有 visual；
  **没有合适组件时用 content-text(纯文本页,不要求组件)**,不要硬塞组件凑数
- 12~15 页,每页正文 <=120 字,要点 <=5 条
- edu-goal / edu-summary / edu-homework 只能用 quote / annotate
- 互动 >=2 处,组件 >=3 种不同类型
- **版式多样性(流程要求,2026-09-03):全课版式 >=4 种且交错;禁止连续 3 页同一版式;
  结构页(cover/goal/summary/homework)合计 <=4 页,主体是教学/内容页**
- 组件数量下限(填不满就换组件或不放):sequence items 3~6 / compare-table rows 2~5 /
  timeline nodes 3~6 / char-card chars 4~12 / icon-card items 3~6 / flow steps 3~8 /
  diagram branches 3~6 / structure levels 2~4 且每层 children 2~6
- 严禁 null / None / 空串--写 None 会渲染成"None"
"""

H5_STRUCTURE = """[本课件是 H5]

**结构骨架**(每页):
`## 场景标题` -> `<!-- layout: scene-<类型> -->` -> 旁白/角色对话 -> (可选)互动标记
即升级自检为受控版式集合:每页**必须**在下列 8 类中显式选 1 个(v1 7 类 + v2 phenomenon)。

**受控场景版式集合(按本页主要教学动作选,不要跟风上一页)**:
- scene-dialog 角色对话推进 / scene-read 词汇点读跟读 / scene-quiz 随堂选择
- scene-reveal 悬念揭晓 / scene-draw 现场绘图 / scene-focus 单条重点收束
- scene-transition 封面转场结尾(纯旁白低密度)
- scene-phenomenon 自然现象演示(科学/观察类:天气雷电水循环,须带 weather/storm/cycle)

**v2 自然科学互动**(科学/物理/化学/生物/地理/观察内容用):
- `<!-- weather: 晴,多云,雷阵雨,雪 -->` 天气切换
- `<!-- storm: 云里的正负电荷越聚越多,就会放电 -->` 雷电模拟
- `<!-- cycle: 水的循环:蒸发 => 凝结 => 降水 => 径流 -->` 现象循环
语法细则见 references,不许在非气象/非现象主题凑数.

**约束**(全部见 `courseware-h5/references/场景与互动规范.md`):
- 场景数,字数,互动类型,学段差异,屏幕适配

**不要做的**:
- **不示范具体场景**--自己按课题设计情节与对话,不要套固定模板
- 不要写 VISUAL_JSON 组件(那是 PPT 的);不要用 `- 要点` 罗列(那是 PPT 写法)
- 不要出现学习目标 / 课堂小结 / 分层作业页;layout 只用上表 8 类,不得用 PPT 版式

**自检**:
- 8~16 个场景,每场景 <=60 字(旁白 <=40,气泡每条 <=20,每场景 2~4 条)
- 互动 >=2 处且类型不单一(quiz 之外穿插 reveal/draw/read;自然科学可用 v2 组件)
- **骨架节奏**:显式 scene-<类型> 至少 3 种并交错;禁止满篇同一种(如全 scene-dialog)
- **理科课件(科学/物理/化学/生物/地理)必须含 1 页 scene-phenomenon 现象演示**
- 角色有性格区分,气泡推进情节(不是复述旁白)
- 窄屏装得下:quiz 每个选项 <=12 字
- 严禁 null / None / 空串
"""


def page_structure(fmt: str) -> str:
    """本格式的页面结构要求--决定产物形态的那一段.

    历史上 H5 被生成成 PPT(14 页 + bullets + VISUAL,0 个 scene),
    根因就是提示词里只写了 PPT 的页面结构,模型无从知道 H5 长什么样.
    这段必须按格式给,不能通用.
    """
    return H5_STRUCTURE if fmt == "h5" else PPT_STRUCTURE


def decor_prompt_block(cw: dict) -> str:
    """平台按 学科x学段x风格 算出候选素材清单,交给 Skill 选(禁止自造)."""
    try:
        need = {"decor": 4, "icon": 3, "subject": 3}
        # 即使不指定风格,候选素材仍按中性风格计算:风格卡可以缺,但候选清单不能缺,
        # 否则模型会自造不存在的 asset_id(decor_refs 幻觉).
        cands = asset_build(need, cw.get("style") or "minimal", "新授课",
                            cw["grade"], cw["subject"])
        block = to_prompt_block(cands, need)
        return block
    except Exception as e:
        print(f"[warn] 候选素材计算失败(本次不给候选,decor_refs 给空数组):{e}",
              file=sys.stderr)
        return ""


def build_prompt(cw: dict, palette_hint: str = "") -> str:
    fmt = cw["format"]
    style = cw.get("style", "")
    rules = skill_rules(fmt, style)
    decor_block = decor_prompt_block(cw)

    kind = "H5 互动课件" if fmt == "h5" else "PPT 课件"
    scope = "8~16 个场景" if fmt == "h5" else "12~15 页"
    head = (
        f"你是资深中小学课件设计专家,善于把一节课设计得\"充实但不冗长\".\n"
        f"请为{cw['grade']}{cw['subject']}设计一份{kind}({scope}).\n"
    )
    if cw.get("lesson"):
        head += f"对应课时:{cw['lesson']}\n"
    if not style:
        # 不指定风格时**显式**告知模型"风格由你定",而不是默默不给风格卡 --
        # 否则模型可能误以为遗漏而退化成默认风格,测不出真实自主能力.
        head += ("\n[风格] 本次**不指定**风格卡,请你依据课题内容(体裁 / 题材 / 学段)\n"
                 "自行确定风格气质、形态母题与禁忌,并把配色写入 styleDNA。\n")
    if palette_hint:
        # 同风格多套课件要各自不同配色,把"主色相锚点 + 已用色相"作为硬约束注入,
        # 引导 LLM 往空闲色相走(落库前仍有 distinct_style_dna 兜底,双保险).
        head += f"\n[配色约束]{palette_hint}\n"
    if decor_block:
        head += f"\n[候选素材清单(只能从这里选,禁止自造)]\n{decor_block}\n"

    return f"{head}\n[Skill 领域知识(必须遵守)]\n{rules}"


# -- 后处理(仅编码,无决策) --

# 各组件的"必需内容"字段--缺了它就是空壳
REQUIRED_LIST = {
    "sequence": "items", "compare-table": "rows", "timeline": "nodes",
    "char-card": "chars", "compare-card": "pairs", "diagram": "branches",
    "icon-card": "items", "structure": "levels", "flow": "steps",
}
TEXT_TYPES = ("quote", "annotate")


def empty_reason(v: dict) -> str:
    """判断组件是否空壳,返回原因(非空壳返回空串).

    实测:Skill 对"数量下限"的遵守远弱于"字数上限",常交出
    rows=[] / items=[] / label=None.留着会渲染成空表或字面量 "None",
    比不放组件更糟,故整块丢弃.
    """
    t = v.get("type")
    if t in TEXT_TYPES:
        txt = str(v.get("text") or "").strip()
        return "text 为空" if (not txt or txt == "None") else ""
    field = REQUIRED_LIST.get(t)
    if not field:
        return ""
    items = v.get(field)
    if items is None or (isinstance(items, list) and not items):
        return f"{field} 为空"
    if isinstance(items, list):
        for i, it in enumerate(items):
            if it is None:
                return f"{field}[{i}] 是 None"
            if isinstance(it, dict) and any(x is None for x in it.values()):
                return f"{field}[{i}] 含 None"
    return ""


def encode_visuals(md: str) -> tuple:
    """把模型写的 `VISUAL_JSON:{...}` 编码为前端要求的 `VISUAL:base64`.

    这是**纯编码**:不挑组件,不改字段,不补内容.
    模型无法输出 base64,所以这一步只能由平台做,但不是内容决策.
    """
    bad = []

    def repl(m):
        payload = m.group(1).strip()
        # raw_decode 取"第一个完整 JSON 值":模型偶尔在 JSON 后多带一个 ">"
        # (写成 `...}]}> -->`),非贪婪正则会把它吃进 payload.
        # 这里只截断尾部噪音,编码的仍是模型原文,不重排,不改字段.
        try:
            obj, end = json.JSONDecoder().raw_decode(payload)
        except Exception as e:
            bad.append(f"{e} :: {payload[:160]}")
            return ""                    # 非法 JSON 直接丢弃,不污染页面
        # type 不在 11 种合法组件内则丢弃:模型常把互动标记名(readalong)
        # 或装饰素材 ID(eye / clock)当成组件类型,这类 VISUAL 前端渲染不出东西.
        t = obj.get("type") if isinstance(obj, dict) else None
        if t not in VALID_VISUAL_TYPES:
            bad.append(f"非法组件类型 {t!r}(已丢弃):: {payload[:100]}")
            return ""
        # 空壳组件丢弃:模型对"数量下限"的遵守远弱于"字数上限",
        # 常交出 rows=[] / items=[] / label=None.留着会在页面上渲染出
        # 空表或字面量 "None",比不放组件更糟.
        why = empty_reason(obj)
        if why:
            bad.append(f"{t} {why}(已丢弃):: {payload[:80]}")
            return ""
        return "<!-- VISUAL:%s -->" % base64.b64encode(
            payload[:end].encode("utf-8")).decode("ascii")

    # 先给未闭合的 VISUAL_JSON 补上 -->:模型漏写闭合符时正则匹配不到,
    # 整条注释会原样留在页面上(实测发生过).
    md = re.sub(r"^(<!--\s*VISUAL_JSON:(?:(?!-->).)*)$", r"\1 -->", md,
                flags=re.MULTILINE)
    out = re.sub(r"<!--\s*VISUAL_JSON:(.*?)\s*-->", repl, md, flags=re.DOTALL)
    return out, bad


# 平台渲染器认识的注释白名单.白名单外的注释会被当成正文显示给学生--
# STYLEDNA 事故即因前端不识别而直接出现在页面上,故此处兜底删除.
# 口径来源：前端解析端（mdToStory.ts）**真正能解析**的标记集合——白名单必须 ≥ 解析集，
# 否则模型写对了标记也会被这里删掉（静默失效）。2026-09-12 补齐此前被误删的四个：
#   focus（场景重点条，H5 SKILL 明确教过）/ popup / audio / video
ALLOWED_COMMENTS = {"layout", "VISUAL", "read", "readalong", "quiz", "reveal", "draw",
                    "focus", "popup", "audio", "video",
                    "weather", "storm", "cycle",
                    # 前端**落盘**格式（2026-09-14）：元素层与互动组件保存后以它们持久化
                    # （`exportPptx.ts:581/583` 写 `<!-- CW-EL:... -->` / `<!-- CW-IT:... -->`）。
                    # 不放进白名单 → 一旦模型在回灌/修订时把当前 markdown 原样带回，
                    # strip_unknown_comments 会把教师的手工排版（元素层）与互动组件**整段删掉**。
                    "CW-EL", "CW-IT"}


def strip_unknown_comments(md: str) -> tuple:
    """删掉白名单外的 HTML 注释,返回 (markdown, 被删的注释名列表).

    这不是内容决策--只删"前端根本不认识,留着必定显示成乱码"的东西.
    """
    dropped = []

    def repl(m):
        name = m.group(1)
        if name in ALLOWED_COMMENTS:
            return m.group(0)
        dropped.append(name)
        return ""

    # ⚠️ 必须整段删除(含结尾 -->):旧版正则只匹配了 "<!-- NAME:" 这个开头,
    # 于是不认识的注释会留下 "[...] -->" 残骸,被前端当正文显示给学生
    # (与 2026-09-01 STYLEDNA 事故同类,实测 DECOR_REFS 即中招).
    out = re.sub(r"<!--\s*([A-Za-z_][\w-]*)[:\s](?:(?!-->).)*-->", repl, md)
    out = re.sub(r"\n{3,}", "\n\n", out)   # 删除后可能留下的连续空行
    return out, dropped


# ───────────────────── 违规的**确定性兜底**（2026-09-14）─────────────────────
# 背景（staging 实测，非推测）：检查器的判据**已全部写进 skills/**，但模型仍反复违反三类：
#   · `annotate.marks` 被写成"关键事实/日期"而非 text 中真实出现的词
#     （实测：marks=["八月十八"]，text 里根本没有这四个字）
#   · `content-grid` 塞 15~30 字长句（技能明写每条 ≤12 字）、`content-2col` 塞 36 字（明写 ≤30）
#   · 内容页不带组件（技能明写"必须带且只带一个组件"）
# S4 关卡1 的**重试闭环存在且会回灌报告**（api_server 里 retry_prompt），但连续重试后仍残留
# （实测国风 7 处 / 科技 4 处）——说明这三类属于"模型能力边界"，按本仓既有范式
# （encode_visuals / strip_unknown_comments 都是"平台替模型做它做不稳的一步"）应由平台兜底。
#
# 原则：只做**规则可机械判定**的修复，且**不改一个字的内容**（改写语义属模型职责，不在这里做）。
#   ① marks 过滤到 text 中真实出现者；不足 2 个则从 text 的标点边界取短片段；仍取不到就丢弃该组件
#   ② 多列版式单条字长超标 → 按**技能自己的规则**降级版式（grid→2col→title-body）
#   ③ 内容页无组件且无互动 → 降级 content-text（前端与检查器都认，且它本就不要求组件）
LAYOUT_COMMENT_RE = re.compile(r"<!--\s*layout:\s*[\w-]+\s*-->")
VISUAL_B64_RE = re.compile(r"<!--\s*VISUAL:([A-Za-z0-9+/=]+)\s*-->")
CW_EL_ANY_RE = re.compile(r"<!--\s*CW-EL:([A-Za-z0-9+/=]+)\s*-->")
INTERACTION_ANY_RE = CHECKER_INTERACTION_RE       # 单一事实源：与检查器同一份（含 CW-IT 之外的全部互动标记）
CONTENT_LAYOUTS = CHECKER_CONTENT_LAYOUTS          # 单一事实源：这些版式"必须有组件"
MARK_SPLIT_RE = re.compile(r"[，。！？、；：,.;:!?（）()「」“”\s]+")


def _decode_visual(b64: str):
    """解出 VISUAL 的 JSON（失败返回 None）。"""
    try:
        return json.loads(base64.b64decode(b64).decode("utf-8"))
    except Exception:
        return None


def _has_component(chunk: str) -> bool:
    """该页是否有组件 —— 两种落盘形态都算：`<!-- VISUAL:... -->` 与 CW-EL 里的 visual 元素。"""
    for b in VISUAL_B64_RE.findall(chunk):
        if isinstance(_decode_visual(b), dict):
            return True
    for b in CW_EL_ANY_RE.findall(chunk):
        els = _decode_visual(b)
        if isinstance(els, list) and any(isinstance(e, dict) and e.get("visual") for e in els):
            return True
    return False


def fix_compare_table(v: dict) -> str:
    """compare-table「残表」修正（2026-09-15），返回修复说明（无修复则空串）。

    契约（`skills/shared/返修指引.md:33/91`）：`cols` 是**数据列**（对象甲/对象乙…），`rows[].label`
    是行首，且 `len(cells) == len(cols)`。实测（PPT·科技 P7「跨界桥接①」）：模型给
    `cols=[物理量,数值,生活参照]`（3 列）而每行只给 2 个 cells → 检查器报「compare-table 残表」，
    画布上表格**列错位**（1.5米落在“物理量”列下、最后一列空白）——教师看到的正是"表格没画对"。

    机械判定：cols 比 cells 恰好多 1 → 首列其实是**行首列的名字**（已由 label 承担），删掉即可；
    多更多 → 同样删首列后截断；cols 比 cells 少 → 截断 cells（保留模型给的列定义）。
    只动列定义与多余单元格，**不改一个字的内容语义**。
    **可单独调用**：存量课件也能只修这一项（不动其它页面/组件）。
    """
    cols = list(v.get("cols") or [])
    rows = v.get("rows") or []
    if not cols or not rows:
        return ""
    maxc = max((len(r.get("cells") or []) for r in rows if isinstance(r, dict)), default=0)
    if maxc == 0 or len(cols) == maxc:
        return ""
    before = (len(cols), maxc)
    if len(cols) >= maxc + 1:
        v["cols"] = cols[1:1 + maxc]
    for r in rows:
        if isinstance(r, dict) and isinstance(r.get("cells"), list) and len(r["cells"]) > len(v["cols"]):
            r["cells"] = r["cells"][:len(v["cols"])]
    return (f"compare-table 残表（cols {before[0]} / cells {before[1]}）"
            f"→ 对齐为 {len(v['cols'])} 列")


def fix_compare_tables_in(obj) -> list:
    """对 dict（VISUAL 载荷）或 list（CW-EL 元素数组）就地修 compare-table，返回修复说明列表。"""
    targets = []
    if isinstance(obj, dict) and obj.get("type") == "compare-table":
        targets.append(obj)
    if isinstance(obj, list):
        for e in obj:
            if (isinstance(e, dict) and isinstance(e.get("visual"), dict)
                    and e["visual"].get("type") == "compare-table"):
                targets.append(e["visual"])
    return [n for n in (fix_compare_table(v) for v in targets) if n]


def repair_violations(md: str, fmt: str = "ppt") -> tuple:
    """确定性修复"规则可机械判定"的违规，返回 (md, notes)。

    notes 是给教师/日志看的**修复说明**（平台做了什么，而不是模型说了什么）。
    fmt 用于选**合法版式集合**（PPT 与 H5 是两套，绝不能混用）。
    """
    valid_layouts = H5_SCENE_LAYOUTS if fmt == "h5" else SLIDE_VALID_LAYOUTS
    notes: list = []
    notes_append = notes.append
    parts = re.split(r"(?m)^(?=## )", md)      # parts[0] = 页前前言，与检查器 parse 的 [1:] 对齐
    out = [parts[0]]
    # 每种版式出现几次：供下面的"改动是否安全"判断
    kinds: dict = {}
    for k in re.findall(r"<!--\s*layout:\s*([\w-]+)\s*-->", md):
        kinds[k] = kinds.get(k, 0) + 1
    # 修复必须**单调**：只消除违规，绝不引入新违规。
    # 版式多样性规则是"全课 ≥4 种"（check_courseware），所以任何改版式前先试算：
    # 改完种类数不得低于 min(4, 原有的种类数) —— 不然就会出现
    # "grid 字长修好了，却冒出 版式多样性 违规"（实测国风 4 页降级即中招）。
    _target_kinds = min(4, len([k for k, v in kinds.items() if v > 0]))

    def _safe_layout_change(old: str, new: str) -> bool:
        ks = dict(kinds)
        ks[old] = ks.get(old, 0) - 1
        ks[new] = ks.get(new, 0) + 1
        return len([k for k, v in ks.items() if v > 0]) >= _target_kinds

    for ch in parts[1:]:
        lines = ch.split("\n")
        title = lines[0].strip() if lines else ""
        bullets = [l[2:].strip() for l in lines if l.startswith("- ")]
        layouts = re.findall(r"<!--\s*layout:\s*([\w-]+)\s*-->", ch)
        lay = layouts[0] if layouts else None
        short = title[:12]

        # ① annotate.marks 修正 —— 兼容**两种落盘形态**：
        #    `<!-- VISUAL:b64 -->`（组件本体）与 `<!-- CW-EL:b64 -->`（元素数组，组件在 visual 元素里）。
        #    只改前者会导致"改了一份、另一份仍是旧的"（实测：兜底报已修正，检查器仍报旧 marks）。
        def _marks_fixed(v: dict):
            """返回修正后的 marks；None = 无需改动；[] = text 里构造不出，保留原样并记 note。"""
            txt = str(v.get("text") or "")
            orig = list(dict.fromkeys(
                str(x.get("text", "")) if isinstance(x, dict) else str(x)
                for x in (v.get("marks") or [])))
            good = [s for s in orig if s and s in txt and text_len(s) <= 10]
            if len(good) < 2:                   # 不足 2 个：从 text 的标点边界取短片段
                for seg in MARK_SPLIT_RE.split(txt):
                    seg = seg.strip()
                    if 2 <= len(seg) <= 10 and seg in txt and seg not in good:
                        good.append(seg)
                    if len(good) >= 3:
                        break
            if not good:
                notes_append(f"{short}：annotate 的 text 无法构造 marks → 保留原样（需人工/重试）")
                return None
            if good[:5] == orig:
                return None
            notes_append(f"{short}：annotate.marks {orig} → {good[:5]}")
            return good[:5]

        def _fix_annotate_in(obj):
            """就地修正 obj（或元素数组）里的 annotate；返回是否改动过。"""
            targets = []
            if isinstance(obj, dict) and obj.get("type") == "annotate":
                targets.append(obj)
            if isinstance(obj, list):
                for e in obj:
                    if (isinstance(e, dict) and isinstance(e.get("visual"), dict)
                            and e["visual"].get("type") == "annotate"):
                        targets.append(e["visual"])
            changed = False
            for v in targets:
                new = _marks_fixed(v)
                if new is not None:
                    v["marks"] = new
                    changed = True
            return changed


        def _fix_table_in(obj) -> bool:
            """就地修正 obj（或元素数组）里的 compare-table；返回是否改动过。"""
            fixed = fix_compare_tables_in(obj)
            for n in fixed:
                notes_append(f"{short}：{n}")
            return bool(fixed)

        def _fix_payload(m):
            obj = _decode_visual(m.group(2))
            if obj is None:
                return m.group(0)
            changed = _fix_annotate_in(obj)
            if _fix_table_in(obj):
                changed = True
            if not changed:
                return m.group(0)
            b64 = base64.b64encode(json.dumps(obj, ensure_ascii=False).encode("utf-8")).decode()
            return f"<!-- {m.group(1)}:{b64} -->"

        ch = re.sub(r"<!--\s*(VISUAL|CW-EL):([A-Za-z0-9+/=]+)\s*-->", _fix_payload, ch)

        # ①.5 版式写成了**组件名**（技能明写"组件类型名绝不能当 layout 写"，实测 sequence / compare-card /
        #      structure 各占一页）→ 修正为合法版式。取法与前端 materializeOutline 的"提升"同一语义：
        #        · 该页有组件 → `visual-top`（组件页的承载版式：组件在上、正文在下）
        #        · 该页无组件 → `content-text`（技能里唯一不要求组件的版式）
        #      H5 的受控场景集合另有一套，凭语义猜不出来 → 只记 note，不擅改。
        if lay and lay not in valid_layouts:
            if fmt != "h5":
                new = "visual-top" if _has_component(ch) else "content-text"
                if _safe_layout_change(lay, new):
                    ch = LAYOUT_COMMENT_RE.sub(f"<!-- layout: {new} -->", ch, count=1)
                    notes_append(f"{short}：版式「{lay}」非法（疑似组件名）→ 修正为 {new}")
                    kinds[lay] = kinds.get(lay, 0) - 1
                    kinds[new] = kinds.get(new, 0) + 1
                    lay = new
                else:
                    notes_append(f"{short}：版式「{lay}」非法，但修正会使版式种类不足 → 保留（需人工/重试）")
            else:
                notes_append(f"{short}：H5 版式「{lay}」不在受控场景集合 → 保留原样（需人工/重试）")

        # ② 多列版式字长（判据与检查器完全一致：中文 12/30，英文 6/15）
        #    这一类是**真实渲染缺陷**（卡片装不下长句 → 字被压小）。改动前先试算种类数（见上），
        #    若降级会把某一种版式改没、从而触发版式多样性违规，则**不改**并把原因写进 notes
        #    （宁可留一处可见的违规，也不引入一处新的 —— 修复必须单调）。
        longest = max((text_len(b) for b in bullets), default=0)
        gmax, cmax = (6, 15) if is_en(title + "".join(bullets)) else (12, 30)
        if lay == "content-grid" and longest > gmax:
            new = "content-2col" if longest <= cmax else "title-body"
            if _safe_layout_change(lay, new):
                ch = LAYOUT_COMMENT_RE.sub(f"<!-- layout: {new} -->", ch, count=1)
                notes_append(f"{short}：grid 最长 {longest} 字 >{gmax} → 降级 {new}")
                kinds[lay] = kinds.get(lay, 0) - 1
                kinds[new] = kinds.get(new, 0) + 1
                lay = new
            else:
                notes_append(f"{short}：grid 最长 {longest} 字 >{gmax}，"
                             f"但降级会使版式种类不足 → 保留原版式（留待重试/人工）")
        if lay == "content-2col" and longest > cmax:
            if _safe_layout_change(lay, "title-body"):
                ch = LAYOUT_COMMENT_RE.sub("<!-- layout: title-body -->", ch, count=1)
                notes_append(f"{short}：2col 最长 {longest} 字 >{cmax} → 降级 title-body")
                kinds[lay] = kinds.get(lay, 0) - 1
                kinds["title-body"] = kinds.get("title-body", 0) + 1
                lay = "title-body"
            else:
                notes_append(f"{short}：2col 最长 {longest} 字 >{cmax}，"
                             f"但降级会使版式种类不足 → 保留原版式（留待重试/人工）")

        # ③ 内容页无组件且无互动 → 纯文本页（技能里唯一不要求组件的版式）。
        #    注意：这不是"掩盖生成缺陷" —— 该页本来就只有文字，content-text 是它的**真实形态**；
        #    且技能明写"没有合适组件时用 content-text"。修正动作本身以 notes 形式回报给教师/日志。
        has_visual = _has_component(ch)
        if (lay in CONTENT_LAYOUTS and not has_visual and not INTERACTION_ANY_RE.search(ch)
                and _safe_layout_change(lay, "content-text")):
            ch = LAYOUT_COMMENT_RE.sub("<!-- layout: content-text -->", ch, count=1)
            notes_append(f"{short}：内容页无组件 → 降级 content-text")
            kinds[lay] = kinds.get(lay, 0) - 1
            kinds["content-text"] = kinds.get("content-text", 0) + 1

        out.append(ch)

    return "".join(out), notes


def split_output(raw: str) -> tuple:
    """拆分模型输出的两段.返回 (markdown, meta_dict).

    容错:若模型漏写标记,退化为"整篇即 markdown",meta 为空--
    宁可少些元数据,也不把标记文字留在页面上.
    """
    m = re.search(r"<<<COURSEWARE>>>(.*?)(?:<<<META>>>|$)", raw, re.DOTALL)
    md = m.group(1).strip() if m else raw.strip()
    # 兜底:清掉可能残留的标记行(模型偶尔重复输出标记)
    md = re.sub(r"^\s*<<<(COURSEWARE|META)>>>\s*$", "", md, flags=re.MULTILINE)

    meta = {}
    mm = re.search(r"<<<META>>>(.*)", raw, re.DOTALL)
    if mm:
        txt = mm.group(1).strip()
        txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", txt, flags=re.MULTILINE).strip()
        # 用 raw_decode 取"第一个完整 JSON 值":模型偶尔在 meta 后再絮叨几句,
        # 直接 json.loads 会因 Extra data 整体失败,丢掉本可救回的配色与装饰.
        try:
            meta, _ = json.JSONDecoder().raw_decode(txt)
        except Exception as e:
            print(f"[warn] meta 解析失败,本次不写配色/装饰:{e}", file=sys.stderr)
    return md.strip(), meta if isinstance(meta, dict) else {}


# -- styleDNA 同风格差异化(耐久性修复) --
#
# 旧逻辑:styleDNA 完全交给 LLM 自由生成,结果同风格(fresh/china/tech)的多套课件
# 经常撞同一主色(实测 fresh 三套全 #4CAF50),前端 resolveTheme 解析后视觉雷同,
# 即用户说的"两个完全一样模板".此处改为落库前强制同风格主色互异 + 贴合风格色相,
# 不再依赖 LLM 自觉:按课件在同风格组内的序号分配风格合适的色相锚点,冲突则旋转到
# 空闲档。内容仍由 LLM 生成,只把"配色独一份"这件事做确定性保证。
import colorsys

# 每个风格一组"合适色相",按课件在该组内的出现顺序各分配一个,保证同风格互不相同.
# 选值贴合各自风格气质:fresh=清爽冷色,china=暖色国风,tech=科技蓝青.
_STYLE_HUE_ANCHORS = {
    "fresh": [150, 195, 225, 275, 330, 120],
    "china": [8, 38, 350, 22, 15],
    "tech":  [212, 190, 165, 235],
}
_DEFAULT_HUES = [0, 40, 80, 120, 160, 200, 240, 280, 320]
# 形态字典 morph（2026-09-03，与 api_server._STYLE_MORPH / 前端同构）：
# styleDNA 不再只是配色，还携带疏密/动效/装饰母题，供渲染端打散同套路。
_STYLE_MORPH = {
    "china":     {"density": "tight",  "motion": "calm",      "motif": "classroom"},
    "tech":      {"density": "tight",  "motion": "energetic", "motif": "urban"},
    "fresh":     {"density": "loose",  "motion": "lively",    "motif": "nature"},
    "minimal":   {"density": "normal", "motion": "calm",      "motif": "classroom"},
    "academic":  {"density": "normal", "motion": "lively",    "motif": "classroom"},
    "cartoon":   {"density": "loose",  "motion": "energetic", "motif": "playful"},
    "flat":      {"density": "normal", "motion": "lively",    "motif": "playful"},
    "business":  {"density": "tight",  "motion": "calm",      "motif": "urban"},
    "":          {"density": "normal", "motion": "lively",    "motif": "playful"},
}


def _hue_anchor(style: str, idx: int) -> float:
    anchors = _STYLE_HUE_ANCHORS.get(style, _DEFAULT_HUES)
    if idx < len(anchors):
        return float(anchors[idx])
    # 超出锚点数:在该风格基色上均匀铺开
    return (anchors[idx % len(anchors)] + 360.0 * (idx // len(anchors))) % 360


def _angular_diff(a: float, b: float) -> float:
    return abs(((a - b) % 360 + 180) % 360 - 180)


def _hex_to_hsl(hex_str):
    s = (hex_str or "").strip().lstrip("#")
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    if len(s) != 6:
        return None
    try:
        r, g, b = (int(s[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    except ValueError:
        return None
    h, l, sat = colorsys.rgb_to_hls(r, g, b)
    return (h * 360.0, sat * 100.0, l * 100.0)


def _hsl_to_hex(h: float, s: float, l: float) -> str:
    h = h % 360
    r, g, b = colorsys.hls_to_rgb(h / 360.0,
                                  max(0.0, min(1.0, l / 100.0)),
                                  max(0.0, min(1.0, s / 100.0)))
    return "#%02X%02X%02X" % (round(r * 255), round(g * 255), round(b * 255))


def distinct_style_dna(style_dna, style: str, used: set) -> dict:
    """改写 styleDNA,保证同风格主色(及 accent)互不相同且贴合风格色相.

    used: 该风格已落库的主色相集合(调用方持有,跨课件累积).
    返回(可能新建的)style_dna dict.
    """
    sd = style_dna if isinstance(style_dna, dict) else {}
    colors = sd.get("colors")
    if not isinstance(colors, dict):
        colors = {}
        sd["colors"] = colors

    idx = len(used)
    anchor = _hue_anchor(style, idx)

    # 主色:若模型给的主色色相贴合锚点,保留其饱和度/明度;否则落到锚点
    hp = _hex_to_hsl(str(colors.get("primary") or ""))
    if hp and _angular_diff(hp[0], anchor) <= 35:
        h, s, l = hp
    else:
        h, s, l = anchor, 58.0, 45.0
    # 双保险:与已用主色太近就旋转到空闲色相
    guard = 0
    while any(_angular_diff(h, u) < 18 for u in used) and guard < 16:
        h = (h + 23) % 360
        guard += 1
    s = s if 25 <= s <= 90 else 58.0
    l = l if 28 <= l <= 72 else 45.0
    colors["primary"] = _hsl_to_hex(h, s, l)

    # accent:由已分散的主色 h 按序号错开派生(类比/补色区间),保证同组 accent 也各异.
    # 不沿用 LLM 给的 accent——实测同风格 LLM 给的 accent 也雷同,会拖累"各一套"观感.
    acc_hue = (h + 40 + idx * 30) % 360
    aguard = 0
    while (_angular_diff(acc_hue, h) < 18 or
           any(_angular_diff(acc_hue, u) < 18 for u in used)) and aguard < 16:
        acc_hue = (acc_hue + 25) % 360
        aguard += 1
    colors["accent"] = _hsl_to_hex(acc_hue, 70.0, 55.0)

    used.add(h)
    # 形态字典随 styleDNA 落库（配色之外的"形态"维；缺省兜底）
    sd["morph"] = dict(_STYLE_MORPH.get(style, _STYLE_MORPH[""]))
    return sd


def preload_used_hues(out_dir: str, used: dict) -> None:
    """跨批次续跑时预载入已产出课件的主色相.

    used_hues 是**进程内**状态,分批跑(每批新起进程)时会归零,后批课件可能
    撞上已用色相 -- 即历史上"两个模板看起来完全一样"的成因。这里从 out_dir
    既有的 *.meta.json 还原,保证多批次之间"同风格互异"仍然成立。
    """
    import glob as _glob
    for fp in _glob.glob(os.path.join(out_dir, "*.meta.json")):
        try:
            with open(fp, encoding="utf-8") as fh:
                m = json.load(fh)
            colors = (m.get("style_dna") or {}).get("colors") or {}
            hsl = _hex_to_hsl(str(colors.get("primary") or ""))
            if hsl:
                used.setdefault(m.get("style", ""), set()).add(round(hsl[0]))
        except Exception:
            continue


def _derive_facets(cw: dict) -> list:
    """由课件元数据派生 decor_facets 字符串路径(与前端 cwTemplate 的 STYLE_LABELS /
    COLOR_FAMILIES 同源),供 AI 装饰自动匹配。

    ⚠️ 坑:decor_refs(对象数组,含 asset_id/count/scale/opacity)是装饰引用,绝不是 facet,
    绝不能写进 decor_facets 列。否则 jsonb 对象数组无法被后端 DecorFacets([]string).Scan
    解析,会整条 material List 报错、素材库全空(已踩过)。decor_refs 仅留作 meta.json 参考。
    """
    facets = []
    fmt = cw.get("format")
    if fmt:
        facets.append(f"applicable.{fmt}")
    style = cw.get("style")
    if style:
        facets.append(f"motif.{style}")
    return facets


# -- 生成与落库 --

def call_llm(prompt: str, retries: int = 3):
    last = None
    for i in range(retries):
        try:
            r = Generation.call(model=MODEL, messages=[{"role": "user", "content": prompt}],
                                result_format="message", timeout=600)
            if r.status_code == 200:
                return r.output.choices[0].message.content
            last = f"HTTP {r.status_code}: {getattr(r, 'message', '')}"
        except Exception as e:
            last = str(e)
        print(f"[warn] 第 {i + 1} 次调用失败:{last}", file=sys.stderr)
        if i < retries - 1:
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"LLM 调用失败({retries} 次):{last}")


_REPAIR_GUIDE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "skills", "shared", "返修指引.md")


def _load_repair_guide(items=None) -> str:
    """返修指引（**只在重试时注入**，且**按本次违规项裁剪**）。

    实测结论 1：光给违规清单，模型改不对——它不知道自己写的 quiz 被当成非法组件丢掉了，
    也不知道"下界类"违规必须**补内容**而不是改措辞。
    实测结论 2（2026-09-12）：**注入整份（约 4000 字）会"规则过载"**——模型为满足所有条款
    过度补偿，反而引入上一轮没有的新违规（如 grid 字长）。故**只给它这次真正踩到的那几类**。

    单一事实源在 `skills/shared/返修指引.md`，本函数只读取，不内置副本。
    """
    try:
        with open(_REPAIR_GUIDE_PATH, encoding="utf-8") as fh:
            doc = fh.read()
    except Exception as e:
        print(f"[warn] 返修指引读取失败：{e}", file=sys.stderr)
        return ""

    hits = [str(i) for i in (items or []) if i]
    parts = re.split(r"\n(?=#{2,3} )", doc)
    if not hits:                                    # 拿不到违规项时退回整份（保守）
        return "\n\n[返修指引 —— 按违规类型逐条对照着改]\n" + doc.strip()

    keep = []
    for p in parts:
        head = p.lstrip()
        if head.startswith("### "):                  # 具体违规类型：命中才留
            if any(h in p for h in hits):
                keep.append(p)
        elif head.startswith("## 总则"):              # 总则：永远留（判断上界/下界的方法论）
            keep.append(p)
        elif not head.startswith("#"):               # 文档标题与引言
            keep.append(p)
    if not keep:
        return ""
    return ("\n\n[返修指引 —— 只列了本次踩到的这几类，逐条对照着改]\n"
            + "\n".join(s.strip() for s in keep).strip())


def retry_prompt(base: str, report: dict, bad: list, current_md: str = "") -> str:
    """把关卡1 的违规清单回灌提示词,让 Skill 自己改--平台不代改内容.

    对应 Skill SOP 的 S4:"不通过则回退重试(限次),并把失败原因回灌提示词".

    关键:光说"互动 0 处"模型改不对--它不知道自己写的 quiz 被当成非法组件
    丢掉了.必须把它**被丢弃的东西**一并回灌,它才知道该往哪儿改.
    """
    errs = [i for i in report["issues"] if i[0] == "ERR"]
    lines = "\n".join(f"  . {item}:{detail}" for _, item, detail in errs[:40])
    more = f"\n  (另有 {len(errs) - 40} 条未列出)" if len(errs) > 40 else ""

    dropped = ""
    if bad:
        dropped = (
            "\n\n另外,你上次写的这些 VISUAL **已被平台丢弃**(type 不是合法组件):\n"
            + "\n".join(f"  . {x}" for x in bad[:10])
            + "\n若它们其实是想要\"互动\"(quiz / readalong / read / reveal / draw),"
              "请改用对应的**互动标记**重写,不要塞进 VISUAL_JSON--否则等于写了但没生效."
        )
    # 附上上一版让它"在原稿上改".只给违规清单会让它推倒重写,
    # 已合规的页面被重新摇一遍,反而引入新违规(实测 10 -> 5 -> 9 的反弹).
    keep = ""
    if current_md:
        keep = (f"\n\n[你上一版的产出--请在它的基础上**逐条修订**,不要推倒重写]\n"
                f"{current_md}\n")

    repair = _load_repair_guide([item for _, item, _ in errs])
    return (
        f"{base}\n\n"
        f"[上一次产出未通过自动规则校验]\n"
        f"逐条违规如下(判据就是你手上那份规则,不是新增要求):\n{lines}{more}"
        f"{dropped}{repair}{keep}\n\n"
        f"要求:在上面这一版的基础上**只改违规条目**,已合规的页面务必一字不动;"
        f"修订后**完整重新输出** COURSEWARE 与 META 两段,不要解释,不要只给改动部分."
    )


def generate_one(cw: dict, max_retry: int = 2, palette_hint: str = "") -> tuple:
    """生成一套,并走 S4 关卡1 重试闭环.返回 (markdown, meta, notes, report)."""
    base = build_prompt(cw, palette_hint)
    prompt = base
    md, meta = "", {}
    notes = []
    bad, dropped = [], []
    report = {"issues": []}

    best = None   # (违规数, md, meta, report, bad, dropped)
    for attempt in range(max_retry + 1):
        raw = call_llm(prompt)
        md, meta = split_output(raw)
        md, b = encode_visuals(md)
        md, d = strip_unknown_comments(md)

        report = check_markdown(md, cw["name"], cw.get("subject", ""))
        errs = [i for i in report["issues"] if i[0] == "ERR"]
        # 保留违规最少的一版:每次重生成都是全新产出,可能比上一版更差.
        # 取"最后一次"等于听天由命--实测出现过 10 -> 5 -> 9 的反弹.
        if best is None or len(errs) < best[0]:
            best = (len(errs), md, meta, report, b, d)
        if not errs:
            break
        if attempt < max_retry:
            notes.append(f"第 {attempt + 1} 次校验未过({len(errs)} 处),回灌重生成")
            prompt = retry_prompt(base, report, b, md)
        else:
            notes.append(f"已达重试上限,仍有 {len(errs)} 处违规(保留最好的一版:{best[0]} 处)")

    _, md, meta, report, bad, dropped = best

    if bad:
        notes.append(f"VISUAL JSON 非法 {len(bad)} 处(已丢弃):")
        notes.extend(f"    . {x}" for x in bad)
    if dropped:
        notes.append(f"自创注释 {len(dropped)} 处已删除(前端不识别会显示乱码):"
                     f"{', '.join(sorted(set(dropped)))}")
    if not md:
        notes.append("产出为空")
    return md, meta, notes, report


def upsert_material(conn, cw, content, force, color_root="", decor_facets=None,
                    status="active"):
    """写库 materials.返回 created / updated / skipped.

    color_root:styleDNA(JSON 字符串),前端读取配色快照
    decor_facets:装饰引用(JSON 数组字符串)

    这两者绝不写进 markdown content--前端 PptxPreview 只认 layout / VISUAL,
    其他注释会原样显示在页面上(2026-09-01 的 STYLEDNA 事故即源于此).
    """
    if decor_facets is None:
        decor_facets = []
    cur = conn.cursor()
    cur.execute("SELECT id FROM materials WHERE name=%s AND type='courseware'", (cw["name"],))
    row = cur.fetchone()
    theme = THEME_BY_STYLE.get(cw.get("style", ""), "min-classic-blue")
    now = datetime.now(timezone.utc)
    if row:
        if not force:
            cur.close()
            return "skipped"
        cur.execute("DELETE FROM materials WHERE id=%s", (row[0],))
    cur.execute(
        """
        INSERT INTO materials
        (id, school_id, user_id, name, type, format, size, tag, url, content,
         h5_html, interactive_slots, status, grade, subject, theme_id, category,
         decor_facets, applicable, motif_root, color_root, page_type, parent_ids,
         ai_generated, ai_model_version, human_edited, created_at, updated_at)
        VALUES (gen_random_uuid(), %s, %s, %s, 'courseware', %s, '', %s, '', %s,
                '', '', %s, %s, %s, %s, 'courseware',
                %s, '', '', %s, '', '[]',
                TRUE, %s, FALSE, %s, %s)
        """,
        (SCHOOL_ID, cw.get("teacher_id") or OWNER_ID, cw["name"], cw["format"], cw["subject"] + cw["grade"], content,
         status, cw["grade"], cw["subject"], theme,
         json.dumps(decor_facets, ensure_ascii=False),
         color_root, MODEL, now, now),
    )
    conn.commit()
    cur.close()
    return "updated" if row else "created"


def main():
    global MODEL, OWNER_ID
    ap = argparse.ArgumentParser(description="AI 批量生成种子课件(走 skills/ 的 Skill)")
    ap.add_argument("--limit", type=int, default=0, help="只处理前 N 套")
    ap.add_argument("--name", default="", help="只处理指定课件名(子串匹配)")
    ap.add_argument("--exclude", action="append", default=[], help="排除的课件名子串")
    ap.add_argument("--plan", default="", help="外部课件清单 JSON(覆盖内置清单)")
    ap.add_argument("--dry-run", action="store_true", help="只生成不写库")
    ap.add_argument("--print-md", action="store_true", help="打印生成的 markdown")
    ap.add_argument("--out-dir", default="", help="导出 markdown 到目录(不写库)")
    ap.add_argument("--from-dir", default="",
                    help="把 --out-dir 导出的产物直接落库(不调 LLM,零 token)")
    ap.add_argument("--force", action="store_true", help="覆盖已存在的同名课件")
    ap.add_argument("--status", default="active", help="落库状态(active / draft)")
    ap.add_argument("--model", default=MODEL, help="LLM 模型")
    ap.add_argument("--owner", default="",
                    help="课件归属教师 user_id(与教案归属对齐;留空则 user_id 为 NULL)")
    ap.add_argument("--sleep", type=int, default=0,
                    help="两套课件之间的间隔秒数(百炼限流时调大,配合分批慢慢生成)")
    ap.add_argument("--max-retry", type=int, default=2,
                    help="关卡1 校验未过时的重试次数(默认 2)."
                         "不指定风格的样本建议调高,把风格自主决策一次做到位.")
    args = ap.parse_args()
    MODEL = args.model
    OWNER_ID = args.owner

    if not dashscope.api_key:
        print("错误:缺少 DASHSCOPE_API_KEY 环境变量", file=sys.stderr)
        sys.exit(1)

    plan = COURSEWARES
    if args.plan:
        with open(args.plan, encoding="utf-8") as fh:
            plan = json.load(fh)

    if args.from_dir:
        # 把 --out-dir 已导出的产物直接落库,不调 LLM--
        # 重新生成一遍纯粹是浪费 token,产出已经验证过了.
        import glob
        import psycopg2  # 延迟导入
        conn = psycopg2.connect(DATABASE_URL)
        stats = {"created": 0, "updated": 0, "skipped": 0, "failed": 0}
        used_f_hues = {}  # style -> 已落库主色相集合(保证重载也互异)
        plan_by_name = {c["name"]: c for c in plan}  # 按课件名回查清单,取归属教师
        for meta_fp in sorted(glob.glob(os.path.join(args.from_dir, "*.meta.json"))):
            with open(meta_fp, encoding="utf-8") as fh:
                m = json.load(fh)
            name = m.get("name", "")
            if args.name and args.name not in name:
                continue
            try:
                with open(os.path.join(args.from_dir, m["file"]), encoding="utf-8") as fh:
                    md = fh.read()
            except FileNotFoundError:
                print(f"  跳过(缺 {m.get('file')})", file=sys.stderr)
                stats["failed"] += 1
                continue
            cw = {k: m.get(k, "") for k in ("name", "subject", "grade", "format", "style")}
            # 归属跟随教案:课件挂在**它所匹配的那篇教案**的 teacher_id 名下。
            # 必须逐篇取,不能全局刷一个值 -- 教案分散在多个教师账号时才会各自归位。
            cw["teacher_id"] = (m.get("teacher_id")
                                or plan_by_name.get(name, {}).get("teacher_id", ""))
            style = cw.get("style", "")
            sd = distinct_style_dna(m.get("style_dna"), style,
                                   used_f_hues.setdefault(style, set()))
            r = upsert_material(
                conn, cw, md, args.force,
                json.dumps(sd, ensure_ascii=False),
                _derive_facets(cw), args.status)
            stats[r] += 1
            print(f"  {name} -> {r}")
        conn.close()
        print(f"\n完成:{stats}")
        return

    targets = [c for c in plan
               if (not args.name or args.name in c["name"])
               and not any(x in c["name"] for x in args.exclude)]
    if args.limit:
        targets = targets[:args.limit]

    conn = None
    if not args.dry_run and not args.out_dir:
        import psycopg2  # 延迟导入:只有真正落库才需要
        conn = psycopg2.connect(DATABASE_URL)

    if args.out_dir:
        os.makedirs(args.out_dir, exist_ok=True)

    stats = {"created": 0, "updated": 0, "skipped": 0, "failed": 0}
    used_hues = {}  # style -> 已落库主色相集合(跨课件累积,保证同风格互异)
    if args.out_dir:
        # 必须在 used_hues 初始化之后调用:还原既往批次的已用色相,避免跨批次撞色
        preload_used_hues(args.out_dir, used_hues)
    for cw in targets:
        # 断点续跑(--out-dir):产出文件已存在就**在调用 LLM 之前**跳过。
        # 必须放在生成之前 -- 放在写文件前判断的话,token 已经花掉了,等于没省。
        if args.out_dir and not args.force:
            _safe = re.sub(r"[^\w\u4e00-\u9fff-]", "_", cw["name"])
            if os.path.exists(os.path.join(args.out_dir, f"{_safe}.md")):
                print(f"- 跳过 {cw['name']}(已产出,不重复消耗 token)", flush=True)
                stats["skipped"] += 1
                continue
        t0 = time.time()
        print(f"-> 生成 {cw['name']} ...", flush=True)
        style = cw.get("style", "")
        used = used_hues.setdefault(style, set())
        anchor = _hue_anchor(style, len(used))
        used_list = ", ".join(f"{round(u)}°" for u in sorted(used)) or "无"
        palette_hint = (
            f"本次 styleDNA 的主色相请落在约 {round(anchor)}°(色相角度)附近,"
            f"必须与已用色相 [{used_list}] 明显不同,保证本课件视觉独一份;"
            f"accent 也要与主色及已用色相区分开。")
        try:
            md, meta, notes, report = generate_one(
                cw, max_retry=args.max_retry, palette_hint=palette_hint)
        except Exception as e:
            print(f"  失败:{e}", file=sys.stderr)
            stats["failed"] += 1
            continue

        # 耐久性修复:落库前强制同风格主色互异 + 贴合风格色相(LLM 自觉之外的双保险)
        sd = distinct_style_dna(meta.get("style_dna"), style, used)
        meta["style_dna"] = sd

        for n in notes:
            print(f"  [note] {n}", file=sys.stderr)

        pages = len(re.findall(r"^## ", md, re.MULTILINE))
        layouts = len(re.findall(r"<!--\s*layout:", md))
        errs = [i for i in report["issues"] if i[0] == "ERR"]
        warns = [i for i in report["issues"] if i[0] == "WARN"]
        print(f"  页数 {pages} / 版式 {layouts} / VISUAL "
              f"{len(re.findall(r'<!-- VISUAL:', md))} / 互动 "
              f"{len(re.findall(r'<!-- (?:read|readalong|quiz|reveal|draw|weather|storm|cycle):', md))}"
              f" / 关卡1 违规 {len(errs)}(提醒 {len(warns)})")
        for _, item, detail in errs[:6]:
            print(f"      . {item}: {detail}")

        if args.print_md:
            print("-" * 60)
            print(md)
            print("-" * 60)

        if args.out_dir:
            safe = re.sub(r"[^\w\u4e00-\u9fff-]", "_", cw["name"])
            with open(os.path.join(args.out_dir, f"{safe}.md"), "w", encoding="utf-8") as fh:
                fh.write(md)
            with open(os.path.join(args.out_dir, f"{safe}.meta.json"), "w",
                      encoding="utf-8") as fh:
                json.dump({"name": cw["name"], "subject": cw["subject"],
                           "grade": cw["grade"], "format": cw["format"],
                           "teacher_id": cw.get("teacher_id", ""),
                           "style": cw.get("style", ""), "file": f"{safe}.md",
                           "style_dna": meta.get("style_dna") or {},
                           "decor_refs": meta.get("decor_refs") or []},
                          fh, ensure_ascii=False, indent=2)
            stats["created"] += 1
        elif not args.dry_run:
            cr = json.dumps(meta.get("style_dna") or {}, ensure_ascii=False)
            r = upsert_material(conn, cw, md, args.force, cr, _derive_facets(cw), args.status)
            stats[r] += 1
            print(f"  {r}  ({time.time() - t0:.1f}s)")

        # 主动降速:百炼可能限流,套与套之间留出间隔(配合分批,慢慢生成)
        if args.sleep > 0:
            time.sleep(args.sleep)

    if conn:
        conn.close()
    print(f"\n完成:{stats}")


if __name__ == "__main__":
    main()
