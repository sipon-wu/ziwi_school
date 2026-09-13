---
id: courseware.h5
name: H5 互动课件生成
version: 1.0.0
status: draft
intent: 用户要求生成 H5 互动课件 / 绘本式课件 / 可交互课件
triggers:
  - H5课件
  - 互动课件
  - 绘本课件
  - 做个H5
input:
  topic: 课题（必填）
  subject: 学科
  grade: 学段
  style_hint: 风格倾向（可选，对应 shared/styles/ 下某条）
  roles: 角色设定（可选，缺省由 Skill 自定 2~3 个）
output:
  format: Story（场景分镜 JSON）
  schema: code/frontend/src/lib/courseware-h5/types.ts
  render: buildStoryH5（平台渲染器，自带翻页/进度/装饰浮动动画）
tools:
  - template.query   # 取风格提示词（shared/styles/）
  - asset.search     # 取素材候选（assets/ 素材库）
  - story.render     # buildStoryH5
quality:
  gates: [自动规则, AI评审]
  pass_criteria: 场景 8~16；每场景 ≤60 字；互动 ≥2 处；结构符合 Story schema
  max_retry: 2          # S4 关卡1 未过时的回灌重试上限（服务端从本字段读，不写死在代码里）
                        # 2026-09-12 记录一次**被数据证伪的调参**：曾因 3 个样本（8→3→1 / 14→3→3 /
                        # 14→1→1）看着"第 3 轮零收益"而改为 1，但后续样本出现**首轮 19 处违规**
                        # （2 次尝试后仍剩 5 处）——第 3 次尝试正是救这类样本的。
                        # 实测对比：max_retry=2 → ERR 均值 1.67（146~165s）；=1 → ERR 均值 3.5（105~112s）。
                        # **结论：时延问题用"进度反馈"解，不用减少重试换**（n 小、勿再凭 3 个样本调此值）。
---

# H5 互动课件生成 Skill

## 0. 先分清：H5 ≠ PPT

**这是两个 Skill，产物形态完全不同，不可混用。**

| | **H5（本 Skill）** | PPT（`courseware-ppt`） |
|---|---|---|
| 产物 | **Story 场景分镜** | markdown + `layout` + `VISUAL` |
| 页面单位 | 场景 `scene` | 页面 `slide` |
| 呈现 | **角色对话气泡** + 旁白 | 要点 `bullets` + 可视化组件 |
| 文字量 | **每场景 ≤60 字** | 每页 ≤120 字 |
| 互动 | **必须有** | 可选 |
| 动画 | 装饰浮动、翻页淡入、进度条 | 无（静态投屏） |
| 页数 | 8~16 个场景 | 12~15 页 |
| 页面类型 | 情景页，**禁止**学习目标/小结/作业页 | 含学习目标、小结、作业 |
| 渲染 | `buildStoryH5` | `PptxPreview` / `exportPptx` |

> 历史教训：曾把 PPT 结构（15 页 + 学习目标 + 小结 + bullets）渲染成 HTML，
> 结果文字堆砌、零互动、零动效——那不是 H5 课件。

## 1. 输出契约

**当前链路**：脚本 / 服务端输出 **markdown**，经 `mdToStory.ts` 转为 `Story`，再由 `buildStoryH5` 渲染。

markdown 形态（每页一个场景）：

```
## 场景标题
<!-- layout: scene -->
旁白文字

**角色**：老师，小明
小明: 对话内容

<!-- quiz: 下面哪个是函数关系？ | 正方形边长与面积 | 人的年龄与身高 | 一个 x 对应两个 y | 0 -->
```

互动标记与 `StoryInteraction` 的对应：

| markdown 标记 | Story 字段 |
|---|---|
| `<!-- read: 苹果 apple / 香蕉 banana -->` | `type=read`，`reads[]` |
| `<!-- readalong: 句子 -->` | `type=readalong`，`sentences[]` |
| `<!-- quiz: 问句 \| A \| B \| C \| 0 -->` | `type=quiz`，`quiz{question,options,correct}` |
| `<!-- reveal: 提示 => 答案 -->` | `type=reveal`，`prompt` / `answer` |
| `<!-- draw: 说明 -->` | `type=draw`，`drawTitle` |

> **版式受控集合（v1，2026-09-03）**：H5 每页必须是 `scene` 或 `scene-<类型>`；
> 不得用 `edu-goal` / `edu-summary` 等 PPT 版式，反之 PPT 也不得用 `scene`。
> 两者不可混用（历史教训：混用整套课件会被判非法）。
>
> 场景版式 **8 类**——按**该页的主要教学动作**选择（值只能取自下表，禁止自创）：
>
> | layout 标注 | 场景类型 | 用途（选型依据） |
> |---|---|---|
> | `<!-- layout: scene-dialog -->` | dialog 对话 | 角色对话推进情节（默认；凡有 ≥2 条对话气泡即属此类） |
> | `<!-- layout: scene-read -->` | read 点读 | 词汇/句子点读·跟读（须带 read/readalong 标记） |
> | `<!-- layout: scene-quiz -->` | quiz 选择 | 随堂选择题（须带 quiz 标记） |
> | `<!-- layout: scene-reveal -->` | reveal 揭晓 | 悬念/答案揭晓（须带 reveal 标记） |
> | `<!-- layout: scene-draw -->` | draw 绘图 | 现场绘图/涂鸦（须带 draw 标记） |
> | `<!-- layout: scene-focus -->` | focus 收束 | 关键词/要点收束（只强调 1 条重点，勿堆叠要点） |
> | `<!-- layout: scene-transition -->` | transition 转场 | 封面/转场/结尾：纯旁白、低信息密度、无对话无互动 |
> | `<!-- layout: scene-phenomenon -->` | phenomenon 现象演示 | **自然科学观察类**（天气/雷电/水循环/物态变化/电路/动植物生长），须带 weather / storm / cycle 标记；**文科禁用** |
>
> > 2026-09-12 口径修正：此前本表写"7 类"且漏 `phenomenon`，而解析端
> > （`mdToStory.ts` 的 `SCENE_TYPES`）与服务端硬编码均按 **8 类**——同一件事两个数，
> > 正是"服务端另一份规则副本"造成漂移的活样本。现以解析端为权威对齐。
>
> 选型规则：带 read/readalong/quiz/reveal/draw 标记的页，layout 用对应 `scene-<类型>`；
> 纯对话推进用 `scene-dialog`；纯旁白（封面/转场/收束）用 `scene-transition`；
> 渲染端对每类有独立视觉骨架（点读词放大、选择题大按钮、绘图全宽画布…），
> 不要因为"上页用了什么"而跟风，要按本页动作选。

Story 目标结构（转换后的形态）：

```json
{
  "title": "函数",
  "subject": "数学", "grade": "初中",
  "teacherName": "小微",
  "themeId": "forest",
  "roles": [{ "name": "老师", "avatar": "🧑‍🏫" }, { "name": "小明", "avatar": "👦" }],
  "scenes": [
    {
      "title": "场景标题",
      "narration": "旁白/背景说明（≤40 字）",
      "bubbles": [{ "role": "小明", "text": "对话（≤20 字）" }],
      "focus": "教学重点（底部高亮条）",
      "mood": "warm",
      "interaction": { "type": "quiz", "quiz": { "question": "...", "options": ["..."], "correct": 0 } }
    }
  ]
}
```

主题 `themeId` 可选：`storybook`（童趣）/ `forest`（森林）/ `night`（星空）/ `ocean`（海洋）。
情绪 `mood` 可选：`warm` / `playful` / `calm` / `energetic`。

## 2. 互动是硬要求

**每个课件互动 ≥2 处**，可用类型：

| type | 用途 | 关键字段 |
|---|---|---|
| `read` | 点读（TTS 朗读） | `reads: [{text, hint?}]` |
| `readalong` | 跟读（录音回放） | `sentences: [{text}]` |
| `quiz` | 随堂选择 | `quiz: {question, options[], correct}` |
| `reveal` | 点击揭示答案 | `prompt` / `answer` |
| `draw` | 绘图白板 | `drawTitle` / `drawHint` |
| `popup` | 弹层 | `triggerText` / `popupContent` |
| `gallery` | 图册 | `images[]` |

> **markdown 里能写出的标记**（与解析端 `mdToStory.ts` 一致，banned 的一律不要写）：
> - 通用 5 种：`read` / `readalong` / `quiz` / `reveal` / `draw`（见第 1 节映射表）
> - 另有 `focus`（场景重点条）以及 `audio` / `video` / `popup` / `weather` / `storm` / `cycle`
>   ——后几项属特定能力（自然科学等），按需使用
> - `gallery` **无 markdown 标记**，只能由 Story JSON 直传，别在 markdown 里写

**不是所有场景都要互动**——对话推进的场景靠气泡即可，互动放在需要学生动手的地方。

## 3. 写法要求

- **每场景 ≤60 字**（旁白 + 所有气泡合计）
- 气泡每条 ≤20 字，口语化，像真人说话
- 旁白交代背景，气泡推动情节
- `focus` 只放一句教学重点，不要复述整页
- 靠**对话推进**，不是靠罗列要点

## 4. SOP

| 阶段 | 动作 |
|---|---|
| S0 澄清 | 学科/学段/课题必问；无则停止生成 |
| S1 取风格 | `template.query` 取风格提示词（只取语义，不取色值） |
| S2 取素材 | `asset.search` 按 风格×学段×学科 取候选（需要量×3） |
| S3 生成 | 按 Story 契约产出场景分镜 |
| S4 校验 | 场景数、字数、互动数、schema 合法性 |
| S5 渲染 | `story.render`（`buildStoryH5`）→ 可交付 HTML |

## 5. 共用与专属

- **共用**（`shared/`）：质量宪法（教学性要求 + 层次可辨 + 内容量与版面平衡）、风格提示词库、输出契约
- **专属**（本目录）：
  - `references/媒介纪律-H5.md` —— **流式场景媒介的硬纪律**（单屏上限 / 触控 ≥44px / 层次可辨但不强制字号阶梯 / 动效是信息）
  - `references/场景与互动规范.md` —— 场景类型与互动契约
