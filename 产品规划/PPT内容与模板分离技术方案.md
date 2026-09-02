# PPT 课件「内容与模板分离」技术方案

> 版本：V1.0　起草：2026-08-25　状态：技术现状梳理 + 目标架构设计
> 关联文档：`AI生成课件风格模板方案.md`（侧重配色/风格层）、`cwTemplate.ts`（模板库资产）、`exportPptx.ts`（导出链路）

---

## 0. 背景：用户的核心诉求

当前 PPT 课件第 8 页（例题演练 `edu-example`）渲染时，出现「题干栏 + 第一张卡片有内容、其余两张空白」的错位。根因不是「模板没生效」，而是**内容与模板根本没有真正分离**——渲染函数只能按 `lines[0]`、`lines[1~3]` 这种**行号顺序硬拆**，无法按语义把内容填到模板的对应区域。

用户要求的是：

> **PPT 的内容与模板分离，且模板可替换。**

本文档先**如实梳理当前技术现状**（代码里到底怎么做的），再给出**目标架构（槽位绑定模型）**与**分阶段落地路径**，供评审拍板。

---

## 1. 当前技术现状（代码级事实）

### 1.1 数据模型

课件内容在中段有三层模型（全部在 `code/frontend/src/lib/exportPptx.ts`）：

| 模型 | 定义 | 内容组织方式 |
|---|---|---|
| `OutlineSlide` | `产品规划/...`编辑态提纲 | `title: string` + `bullets: string[]`（**扁平数组**）+ `layout?: string` + `elements?: CwElement[]` + `interactive?` + `decor?` |
| `CwSlide` | 预览/导出态 | `kind` + `title` + `rich: CwRichLine[]`（**扁平数组**）+ `layout?` + `elements?` + `notes?` |
| `PptSlide` | 后端 `render-ppt` 返回 | `title` + `bullets: string[]` + `kind?` + `notes?` |

**关键事实**：`layout` 只是一个 **字符串标签**（如 `'edu-example'`），内容（bullets / rich）是**一个不区分语义的扁平数组**。模板的「区域」与内容的「条目」之间没有绑定关系。

### 1.2 模板体系：存在两套，且互相冲突

#### ① 语义骨架（已定义，但未被使用）

`code/frontend/src/lib/cwTemplate.ts` 中的 `EDU_LAYOUT_SKELETONS` 定义了每个教学版式的**语义占位符（placeholder）与几何位置**：

```ts
edu-example: [
  { key: 'question',  type: 'text',    label: '题干',     bounds: { x: 6.3, y: 22, w: 87.4, h: 20 } },
  { key: 'solution',  type: 'bullets', label: '解答步骤', bounds: { x: 5.3, y: 50, w: 89.4, h: 34 }, columns: 3 },
]
```

它**本应是「内容与模板分离」的正确载体**：模板用 `key` 声明自己需要哪些内容槽位，渲染器按 `key` 取内容填充，换模板即换 `key` 映射。

**但全代码库没有任何渲染/导出/编辑代码读取 `EDU_LAYOUT_SKELETONS`**——这是一套孤岛定义。

#### ② 真正生效的：硬编码按行号分配（在 `PptxPreview` 与 `exportPptx`）

**预览渲染** `components/PptxPreview.tsx` 的 `renderLayoutContent`：

```ts
const lay = s.layout || 'title-body'
if (lay === 'edu-example') {
  const stem = lines[0] || ''                 // 第 1 条 → 题干栏
  const steps = [lines[1], lines[2], lines[3]] // 第 2~4 条 → 3 张卡片
  ...
}
```

`edu-goal` / `edu-explain` / `edu-summary` / `edu-homework` 全部是**同样的 `lines[0]/[1]/[2]` 硬编码**。

**自由编辑物化** `exportPptx.ts` 的 `layoutElements`：

```ts
case 'edu-example':
  return [
    { ..., text: slide.bullets[0] || '题干（填写）', ... },           // 第 1 条 → 题干文本框
    { ..., text: (slide.bullets.slice(1).join('\n') || '解答步骤'), }, // 第 2~N 条合并 → 解答文本框
  ]
```

### 1.3 导出链路会丢失 layout

- `buildCoursewareSlides(content: string, opts)`：从 markdown 字符串解析，生成的 `CwSlide` **完全没有 `layout` 字段**——所有页都退化成默认 `title-body` 平铺。
- `outlineToSlides(outline, opts)`：虽然有 `layout: s.layout`，但 `rich` 仍是 `s.bullets` 整体平铺，`renderLayoutContent` 再按行号猜。
- `slidesFromPpt(ppt, opts)`：同样只把 `bullets` 平铺成 `rich`，无槽位。

### 1.4 当前「模板替换」实际发生什么

`cwTemplate.ts` 的 `applyTemplate` / `revertTemplate` 在 `CoursewareBuilder.tsx` 里只做两件事：
1. 改每页 `layout` 字符串（如 `title-body` → `edu-example`）；
2. 改 `themeId`（配色）。

**它不改内容、不重排内容到新模板的槽位**。所以「换模板」只是换了个标签 + 配色，渲染器仍按行号硬拆——内容不会自动映射到新模板区域。这才是用户感知到「模板换了没用 / 内容错位」的本质。

---

## 2. 问题总结（为什么当前做不到「可替换」）

| 维度 | 现状 | 导致的问题 |
|---|---|---|
| **内容语义** | bullets 扁平数组，无槽位 key | 渲染器不知道「哪条是题干、哪条是解答」 |
| **模板定义** | `EDU_LAYOUT_SKELETONS` 有语义 key 但**未被消费** | 模板的语义能力是死代码 |
| **渲染规则** | 写在 `renderLayoutContent` 里按行号硬拆 | 规则与数据耦合，换模板不换规则 |
| **导出链路** | `buildCoursewareSlides` 丢 layout；`outlineToSlides` 平铺 rich | 导出与预览不一致，且都依赖行号猜测 |
| **替换能力** | `applyTemplate` 只换 layout 标签 + 配色 | 内容不随模板重排，替换无效 |

**一句话根因**：模板的「区域结构」与内容的「条目」之间缺少**以语义 key 为纽带的绑定层（slots）**。当前所有映射都是「第 N 条放第 N 区」的脆弱约定。

---

## 3. 目标架构：槽位绑定模型（Slot-Binding Model）

### 3.1 核心思想

引入 **`slots: Record<placeholderKey, CwRichLine[]>`** 作为内容与模板之间的绑定层：

- **内容** 按模板声明的 placeholder key 存放（如 `question`、`solution`）；
- **模板**（`EDU_LAYOUT_SKELETONS`）声明自己有哪些 placeholder 及各自几何/样式；
- **渲染/导出/编辑** 一律按 `skeleton[key]` + `slots[key]` 渲染；
- **换模板** = 换 `layout` 标签，内容按新模板的 placeholder key **重新映射**（同名 key 自动对应，缺失 key 留空，多余内容进「溢出区」）。

### 3.2 数据模型升级

`OutlineSlide` / `CwSlide` 增加可选槽位字段（向后兼容，旧数据无 slots 时回退现有逻辑）：

```ts
interface OutlineSlide {
  title: string
  bullets: string[]          // 保留：兼容旧数据 / 纯文本态
  layout?: string
  slots?: Record<string, string[]>   // 新增：按 placeholder key 组织的内容
  elements?: CwElement[]
  notes?: string
  interactive?: H5Component | null
  decor?: DecorSlots | null
}
```

`CwSlide.rich` 改为可由 `slots` 派生；或直接新增 `slots?: Record<string, CwRichLine[]>`。

### 3.3 模板契约（消费已有 `EDU_LAYOUT_SKELETONS`）

每份 skeleton 明确：

```ts
interface LayoutSkeleton {
  key: string                       // 模板标识，对应 layout 字符串
  placeholders: Placeholder[]       // 区域定义
}
interface Placeholder {
  key: string                      // 内容槽位 key（question / solution / goal1 ...）
  type: 'text' | 'bullets' | 'image'
  label: string                    // 教师可见标签
  bounds: { x, y, w, h }           // 几何（百分比或厘米，与现有 CwElement 一致）
  columns?: number                 // bullets 类多列布局
  required?: boolean
}
```

`edu-example` 的契约即：`question`（题干，text）、`solution`（解答步骤，bullets × 3 列）。

### 3.4 渲染/导出/编辑三端统一规则

```
render(slide):
  skeleton = EDU_LAYOUT_SKELETONS[slide.layout]
  if slide.slots:
    for each placeholder in skeleton:
      内容 = slide.slots[placeholder.key] || []
      render(内容, placeholder.bounds, placeholder.type)
  else:
    fallback(现有按行号逻辑)   // 兼容无 slots 旧数据
```

这样：
- **预览**（`PptxPreview.renderLayoutContent`）= 按 skeleton 渲染；
- **导出**（`exportCoursewareToPptx`）= 按 skeleton 把 slots 写进 PPTX 文本框；
- **编辑**（`layoutElements` / 文档模式提纲编辑）= 按 placeholder key 编辑对应槽位，而非编辑整个 bullets 数组；
- **替换**（`applyTemplate`）= 换 `layout`，内容按新 skeleton 的 key 重映射。

### 3.5 内容进入槽位的两处入口

1. **AI 生成**：`render-ppt` 后端返回结构改为按 placeholder key 组织（或前端 `markdown→outline` 时按 skeleton 自动分发：识别「题干：」前缀进 `question`，剩余按 `columns: 3` 拆成 3 条进 `solution`）。
2. **手动编辑**：教师文档模式编辑时，按当前页 placeholder 直接编辑「题干 / 解答步骤」等语义字段。

---

## 4. 分阶段落地路径（建议）

### 阶段 1：前端数据模型 + 预览/导出按槽位渲染（不动后端 AI）

- `OutlineSlide`/`CwSlide` 增加 `slots?`；
- `outlineToSlides`：若 `layout` 命中 skeleton，按规则把 `bullets` 自动分发进 `slots`（兼容无 slots 旧数据）；
- `renderLayoutContent`：优先读 `s.slots` + skeleton 渲染，无 slots 回退现有逻辑；
- `exportCoursewareToPptx` 同步改为按 skeleton 写文本框（修复导出丢 layout 问题）；
- `buildCoursewareSlides` 补传 `layout`（当前丢失点）。

**收益**：第 8 页立即正确显示（题干栏 + 分析/解答/迁移三卡），且为模板替换打下基础。工作量：约 0.5~1 天。

### 阶段 2：模板真正可替换

- `applyTemplate` 换 `layout` 时，调用 `remapSlots(oldLayout → newLayout)`，按新旧 skeleton 的 key 交集重映射内容；
- 编辑器按 placeholder key 提供「分槽编辑」UI（题干框 / 解答框分别可编辑）；
- 溢出内容（新模板无对应 key）进「未分配区」，避免丢失。

### 阶段 3：AI 生成对齐槽位

- `render-ppt` 返回结构按 placeholder key 输出（或前端解析时按 skeleton 分发）；
- `markdownToOutline` 解析 `<!-- layout: xxx -->` 后，按 skeleton 把同页 bullets 拆进 `slots`；
- 教师润色/重新生成后，槽位保持语义稳定。

### 阶段 4（可选）：模板库支持「自定义骨架」

- 教师/学校可定义新 `LayoutSkeleton`（自定义 placeholder 与几何），复用同一套 slot-binding 渲染，实现真正的模板可扩展。

---

## 5. 边界与克制（纪律对齐）

1. **不推翻现有模板库**：`cwTemplate.ts` 的 `EDU_LAYOUT_SKELETONS` 已接近正确方向，本方案是**激活它**，而非另起炉灶。
2. **向后兼容**：`slots` 为可选字段，旧课件（无 slots）回退现有行号逻辑，不破坏已有数据。
3. **不碰外部素材**：与 `AI生成课件风格模板方案.md` 一致，模板仅为「结构 + 系统自有配色」，零外部二进制。
4. **不自动部署生产**：改动先在 `vite dev` + staging 真浏览器验证，停手交用户验收。
5. **导出与预览一致**：阶段 1 即修复 `buildCoursewareSlides` 丢 layout 的隐患，避免「预览对、导出错」。

---

## 6. 待评审拍板点

- 阶段 1 是否按本文档直接落地（解决当前错位 + 建立槽位基础）？
- `slots` 内容粒度：`string[]`（纯文本，简单）还是 `CwRichLine[]`（带样式，复杂但保真）？建议首版用 `string[]`，导出时套用主题默认样式。
- 是否同步改后端 `render-ppt` 输出结构（阶段 3），还是先用前端解析兜底（阶段 1  suffices）？

---

*附录：当前相关代码索引*
- `code/frontend/src/lib/exportPptx.ts`：`OutlineSlide`/`CwSlide`/`PptSlide` 定义、`markdownToOutline`、`outlineToSlides`、`buildCoursewareSlides`、`layoutElements`、`materializeOutline`、`extractBullets`
- `code/frontend/src/lib/cwTemplate.ts`：`EDU_LAYOUT_SKELETONS`、`PPT_TEMPLATES`、`applyTemplate`/`revertTemplate`
- `code/frontend/src/components/PptxPreview.tsx`：`renderStaticSlide`、`renderLayoutContent`（硬编码行号分配）
- `code/frontend/src/pages/CoursewareBuilder.tsx`：`handleGenCourseware`、`applyTemplate` 调用、`outlineToSlides` 调用
