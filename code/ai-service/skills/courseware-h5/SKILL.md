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

> **每页 layout 必须是 `scene`**——不得用 `edu-goal` / `edu-summary` 等 PPT 版式。
> 反之，PPT 也不得用 `scene`。**两者不可混用**（历史教训：H5 规则曾残留在共用文件里，
> 导致 PPT 生成时模型误用 `scene`，整套课件被判非法）。

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

- **共用**（`shared/`）：质量宪法（教学性要求）、风格提示词库
- **专属**（本目录）：场景与互动规范（见 `references/场景与互动规范.md`）
