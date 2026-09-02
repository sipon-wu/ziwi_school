---
id: courseware.generate
name: 课件生成
version: 1.0.0
status: active
intent: 用户要求生成 / 修改 / 优化课件
triggers:
  - 生成课件
  - 做个PPT
  - 出课件
  - 帮我做课件
  - 课件
input:
  topic: 课题（必填，如《函数》《观潮》）
  subject: 学科（必填）
  grade: 年级（必填）
  period: 课时（默认 1）
  format: ppt | h5（默认 ppt）
  style_tag: 受控风格词表之一（可选，见 styles/受控风格词表.md）
  style_profile: 风格自由描述（可选，由 Skill 匹配到受控词表）
  lesson_plan: 教案（可选；无教案时走 S0 从课标/知识点推断）
output:
  format: 课件内容（Markdown + `<!-- layout: -->` 版式标注 + VISUAL 组件）
  deliverables: [平台课件, PPTX, PDF, H5]
sop:
  - S0 需求澄清 ★课标对齐守门
  - S1 教案解析
  - S2 提示词生成
  - S3 课件生成
  - S4 质量检验（三关）
  - S5 交付入库
tools:
  - template.query   # 按风格/学科/学段查风格卡
  - asset.search     # 装饰资产检索
  - slide.render     # 页面渲染（平台渲染器）
  - visual.check     # 视觉检查（转图 + 评审）
quality:
  gates: [自动规则, AI评审, 视觉检查]
  pass_criteria: 关卡1全过；关卡2各项≥4分；关卡3无阻塞问题
---

# 课件生成 Skill

## 定位与边界

**本 Skill 解决「怎么生成一节好课」，不解决「怎么生成 PPT 文件」。**

文件生成（.pptx/.pdf）由底层现成能力完成（pptxgenjs / 官方 pptx skill / H5 渲染器），
本 Skill **只产出课件内容与结构决策**，渲染必须回到结构化对象，否则教师无法编辑。

```
自研 courseware.generate Skill（本文件）
  · sop: S0–S5
  · 领域知识：质量宪法 / 选型规则 / 质检标准
  · tools: template.query / asset.search / visual.check
        ↓ 调用底层
现成能力（直接用，别造）
  pptxgenjs / 官方 pptx skill / H5 渲染器
```

### 核心理念：模板即风格示意

**模板不提供结构，只提供风格语汇与可引用资产。** 结构由本 Skill 跟随内容纲要自行选择。

```
传统（模板驱动）：模板（固定结构）+ 内容 → 填充输出   ← 削足适履，字密/撑破的根源
本方案（风格驱动）：内容 + 风格语汇 → Skill 现场设计版式 → 输出
```

---

## SOP

### S0 需求澄清 ★课标对齐守门

**这一步不能跳过。** 用户可能只给一句模糊需求，直接生成会产出「会话式无效产出」——
对话流畅、内容像样，但课标不对齐、课时不匹配、学段不适配。

| 检查项 | 缺失时 |
|---|---|
| 学科 / 年级 | **必须提问补全**，不可臆测 |
| 课题 | 必须明确 |
| 课时 | 默认 1，但影响页数与深度 |
| 教案 | 可无；改为从知识点库 / 课标库推断，并请用户确认 |

输出：`CoursewareSpec`（课题、学科、年级、课时、风格、目标知识点、课标条目）

### S1 教案解析

教案（或 S0 推断结果）→ 结构化 JSON：教学目标、重难点、教学环节、知识点、评价任务。
规则解析为主，AI 补全为辅。

### S2 提示词生成

教案结构 + 质量宪法 + 学段课时规则 + 风格卡 → 生成提示词（页面规划 + 组件 + 素材 + 互动）。

### S3 课件生成 ★核心

提示词 + 风格卡 + 资产库 → 课件内容。

**必须遵守 references/ 下的硬约束**：
- `references/版式与组件选型.md` —— 版式 × 字长、组件 × 形态（防止字密/撑破）
- `references/质量宪法.md` —— 内容质量（学生视角、具体化、互动）

### S4 质量检验（三关）

| 关卡 | 内容 | 判据 |
|---|---|---|
| 1 | 自动规则校验 | 硬约束全过（字数、版式、组件齐全度、占位符） |
| 2 | AI 内容评审 | 各项 ≥4 分（对齐/深度/负荷/呈现/科学） |
| 3 | 视觉检查 | 转图 + 评审，无阻塞问题 |

不通过则回退重试（限次），并把失败原因回灌提示词。

### S5 交付入库

入库（materials）→ 可编辑 → 可导出（PPTX/PDF/H5）。

---

## 输出格式规范

产出与前端 `outlineToMarkdown` / `markdownToOutline` 完全兼容的 Markdown：

```markdown
## 页面标题
<!-- layout: 版式名 -->
- 要点一
- 要点二
<!-- VISUAL:base64 -->
```

- 每页**必须有且仅有一个** `<!-- layout: -->`，独占一行、紧接标题行之后
- 版式只能从受控集合取，**严禁把可视化组件类型名当 layout**
- 严禁占位符（"占位""待补充""XXX"）

---

## 硬约束摘要（详见 references/）

| 约束 | 判据 |
|---|---|
| 版式 × 单条字长 | 单条 >12 字严禁 `content-grid`；>30 字严禁多列版式 |
| 组件 × 形态 | 长文本（>12 字）严禁进 icon-card / diagram / sequence / flow / timeline |
| 对比表完整性 | cells 与 cols 等长，且每格必须填内容，严禁空串/占位 |
| 组件多样性 | 同一课件 ≥3 种不同组件 |
| 页数 | PPT 12~15 页；H5 8~16 页 |

---

## 相关文档

- `code/backend/docs/课件生成Skills架构方案.md` —— Skill 架构与平台化路径
- `code/backend/docs/课件生成流程方案.md` —— S0–S5 详细流程
- `code/backend/docs/课件质量规则.md` —— 五层质量模型（对齐/深度/负荷/呈现/科学）
- `code/backend/docs/课件视觉资产架构方案.md` —— 风格 DNA、装饰资产、校准闭环
