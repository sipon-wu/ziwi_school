# AI 生成课件「风格模板」方案（PPT + H5 作品）

> 版本：V1.0　起草：2026-08-08　状态：待评审

## 0. 背景与动机

### 0.1 现状
- 课件（PPT）的**视觉风格**目前完全由教师在编辑器里**手动选模板 / 选配色**决定。
- H5 互动课件已落地「绘本式卡通化视觉基线」（详见 §5.1）：默认 `storybook` 主题，渲染器强制带卡通装饰层（☁️🌞⭐ 等 emoji 点缀）与卡通化控件（大圆翻页钮、胶囊互动标签、白边头像），由 `courseware-h5/` 实现，AI 不指定主题时仍自动生效。
- 后端 `POST /api/ai/courseware/generate` 只产出「结构 + 内容 + 版式标注（`<!-- layout: 版式名 -->`）」，AI **不参与任何视觉风格决策**（PPT 侧）；H5 侧风格由前端 `STORY_THEMES` 语义映射决定。
- 前端模板库（`cwTemplate.ts`）是**程序化 SVG 缩微图 + 复用 `pptThemes.ts` 配色**生成，零外部图片依赖、零版权风险（这是已拍板的设计铁律，见 `cwTemplate.ts` 注释）。

### 0.2 用户诉求
> "AI 生成 PPT，AI 生成各种 PPT 风格模板，很难吗？"

用户希望：套用 AI 的能力，**一键生成不同视觉风格的课件**，而不是每次都手动挑色系/挑模板。本质是"让 AI 决定风格语义"，而非"让 AI 搬运外部版权素材"。

### 0.3 合规红线（不可逾越）
- **绝不抓取 / 打包 Ibaotu、第一PPT 等第三方站点的 pptx 或图片**进 SaaS 课件库分发——其授权普遍禁止"用于商业产品分发"，触碰内容合规底线。
- 所有风格必须**零外部二进制、零版权风险**：AI 只生成"风格语义描述"，具体色值由我们已有的 `CwTheme` 配色盘落地。

---

## 1. 核心思路：AI 定"风格语义"，系统落"具体配色"

把"风格"拆成两层，职责清晰：

| 层 | 谁负责 | 产出 | 示例 |
|---|---|---|---|
| **风格语义层** | AI（LLM） | 一段风格画像 JSON：基调词 + 版式节奏 + 视觉语言 | `{"mood":"沉稳学术","palette_hint":"深蓝+米白","rhythm":"封面→目录→双栏讲解→大图例题→小结","density":"精简"}` |
| **配色落地层** | 系统（`pptThemes.ts` + `cwTemplate.ts`） | 把语义映射到最接近的 `CwTheme` + `StyleTag` | `aca-deep-green` / `style=academic` |

**AI 不做 pptx、不抓图、不搬运**——它只在我们定义的"风格词表"内输出语义，系统再映射回已有配色盘。这与现有"模板库 = 配色×版式骨架"体系天然契合。

### 1.1 为什么不难（难度评估）
- ✅ **接口改造小**：`generate` 增加可选 `style_profile` 入参；`render-ppt` 增加可选 `style_profile`。
- ✅ **Prompt 工程为主**：在现有 prompt 注入"按该风格组织版式节奏与视觉语言"的指令，AI 已具备此能力。
- ✅ **前端复用成熟体系**：`CwTheme`（56 套配色）、`STYLE_LABELS`（9 类风格）、`COLOR_FAMILIES`（8 色系）全部现成，AI 语义直接映射。
- ✅ **H5 同构**：H5 复用同一套 `CwTheme` + 风格标签，仅媒介标记不同（`kind: 'h5'`），改造点一致。
- ❌ **不碰**：pptx 解析、外部素材下载、第三方格式兼容——这些是真正难且违规的部分，本方案刻意规避。

**结论：中等偏低难度，约 1~2 个迭代可落地首版。**

---

## 2. 风格词表（AI 输出域 = 系统映射域）

定义**受控词表**，AI 只能从表中选，杜绝 AI 自由发挥引入未知配色/外部风格。

### 2.1 风格大类（复用 `STYLE_LABELS`）
```
basic     通用结构（百搭）
china     中国风（水墨 / 国潮 / 山水 / 宋青）
minimal   极简（经典蓝 / 几何 / 灰阶高级 / 纯白 / 现代线 / 藏青智识）
tech      科技（量子蓝 / 科技深蓝 / 赛博紫 / 极光绿 / 数字青）
fresh     清新（薄荷 / 天空蓝 / 暖橙 / 马卡龙粉 / 樱粉）
academic  严谨学术（教务蓝 / 理性灰 / 深绿 / 米cream）
cartoon   卡通（卡通 / 涂鸦）
flat      扁平（雾蓝 / 灰紫 / 豆绿）
business  商务（藏青智识 / 蓝紫 / 优雅紫）
```

### 2.2 风格画像 JSON 结构（AI 输出契约）
```json
{
  "style_tag": "academic",          // 必须 ∈ STYLE_LABELS
  "theme_id": "aca-deep-green",     // 必须 ∈ pptThemes 已存在 CwTheme
  "mood": "沉稳、专业、重逻辑",
  "rhythm": ["cover","section","two-col","example","section","content"],
  "density": "精简",
  "accent_hint": "深绿主色 + 米白底 + 细金线点缀"
}
```
> 系统校验：若 AI 返回未知 `theme_id`，回退到该 `style_tag` 下的默认主题（如 `academic→aca-edu-blue`）。

---

## 3. 后端改造

### 3.1 `POST /api/ai/courseware/generate` 增加风格参数
入参新增：
```json
{
  "style_tag": "tech",                 // 可选，指定风格大类
  "style_profile": "..." ,             // 可选，用户自然语言风格描述（"想要科技感强一点的"）
  "style_mode": "auto|preset|free"     // auto=AI 按学科/学段推荐；preset=用 style_tag；free=按 style_profile 自由发挥（仍受词表约束）
}
```

Prompt 注入逻辑（`api_server.py` `gen_courseware`）：
```
若 style_tag 指定：
  追加"本课件视觉风格须为【{STYLE_LABELS[style_tag]}】，版式节奏参考 {该风格典型 rhythm}，
  配色基调为 {theme_id 对应主色描述}，在版式标注 <!-- layout --> 中保持现有版式集合不变。"
若 style_profile 自由描述：
  追加"用户期望风格：{style_profile}。请在受控风格词表内自行匹配最贴切的 style_tag 与 theme_id，
  并在课件结构与版式节奏上体现该风格（如科技风多用双栏/大图/模块化，国风多用留白/竖排韵味）。"
```

**关键点**：AI 改的是"内容组织节奏 + 版式标注倾向"，**不改版式集合本身**（版式骨架仍由 `EDU_LAYOUT_SKELETONS` 约束，保证与前端 `applyTemplate` 对齐）。

### 3.2 `POST /api/ai/courseware/render-ppt` 增加风格参数
入参新增 `style_tag` / `theme_id`，在渲染 JSON 时按风格调整：
- `cover` 页副标题排布（科技风横排大标题 / 国风竖排韵味）
- `content` 页 bullet 密度（极简风更少更精 / 学术风可稍密）
- 返回结构新增 `style_tag` / `theme_id` 字段，前端直接据此 setThemeId。

### 3.3 新增轻量端点（可选，P2）
`POST /api/ai/courseware/suggest-style`
- 入参：学科、学段、课题、可选用户偏好
- 返回：AI 推荐的 `style_tag` + `theme_id` + 一句话理由
- 用途：编辑器"AI 推荐风格"按钮，降低教师选择成本。

---

## 4. 前端改造

### 4.1 AI 生成面板增加"风格"选择
在 `CoursewareBuilder.tsx` 的 AI 生成区（`genTitle` 附近）增加：
- **风格下拉**：复用 `STYLE_LABELS`（9 类）+ "AI 智能推荐"选项。
- **参照风格描述框**（可选）：`style_profile` 自由文本（"科技感强一点""活泼卡通"）。
- 选择后随 `generateCourseware` 请求下发 `style_tag` / `style_profile` / `style_mode`。

### 4.2 生成结果自动套用风格
`handleGenCourseware` 拿到后端返回的 `theme_id` / `style_tag` 后：
```ts
if (res.theme_id) setThemeId(res.theme_id)   // 直接落到对应 CwTheme 配色
```
→ 生成完成即"AI 风格模板"生效，中间画布实时预览该风格，无需教师再手动挑模板。

### 4.3 "AI 风格模板"进入模板库（首版即解决"只是几个色系"）
- 模板库缩微图已改为**三页版式构图**（`renderTemplateThumb` 改造完成），直观呈现版式差异。
- 新增"AI 推荐"入口：点击即按当前学科/学段让 AI 推荐一套风格模板（调 `suggest-style`），一键套用。
- H5 作品同构：`H5_TEMPLATES` 复用同一风格标签与配色，AI 生成 H5 时同样下发 `style_tag`/`theme_id`。

### 4.4 撤销/重置
套用 AI 风格 = 改 `themeId` + 各页 `layout`，复用现有 `tplAppliedId` / `tplPrevTheme` / `tplPrevLayouts` 撤销机制，无需新机制。

---

## 5. H5 作品风格模板（同构落地）

H5 课件（`/courseware/h5`，`exportH5.ts` + `courseware-h5/renderer.ts`）与 PPT 共用 `CwTheme` 配色盘：
- AI 生成 H5 内容时，同样下发 `style_tag` / `theme_id`，H5 渲染按该主题着色。
- H5 风格偏亮色/跳色（投屏平板更出彩），`H5_STYLE_THEMES` 已对卡通/清新权重更高，AI 推荐时遵循此倾斜。
- 模板库"H5"筛选下展示 `H5_TEMPLATES` 缩微图（同样三页构图），套用逻辑与 PPT 完全一致。

### 5.1 H5 绘本式卡通化视觉基线（风格铁律，2026-08-19 落地）

H5 互动课件采用「绘本式情景」呈现（区别于 PPT 的版式页），其视觉基线**默认即卡通化**，不得退化为"老软件风"裸排版。基线由 `courseware-h5/`（数据模型 `types.ts` + 渲染器 `renderer.ts` + markdown 解析 `mdToStory.ts`）实现，规则如下：

**① 卡通化装饰层（必带，不可省略）**
- 每页（scene）必须渲染主题化卡通点缀：绘本风=☁️🌞⭐✨🌈🍎🍌、森林风=🌿🍃🌳🌸🍂、星空风=🌕🌙⭐💫🌌、海洋风=🌊🐠🐚🪸 等。
- 装饰由 `STORY_THEMES[themeId].deco` 定义 emoji 集，`renderer.renderDeco()` 散布到页面四角/边缘，绝对定位 + 浮动/旋转/闪烁动画。
- **纯文本 emoji + CSS 动画，零外部二进制、零版权风险**（对齐 §0.3 合规红线），保证"保存为独立 H5 文件"也能完整呈现。
- 装饰随 `themeId` 自动换肤，禁止固定写死某一套。

**② 卡通化图标与控件（必带，不可省略）**
- 翻页钮 = 52px 大圆钮、暖色渐变、hover 放大微旋转，禁用生硬方形/系统默认箭头观感。
- 互动标签（点读/跟读/想一想） = 圆润胶囊 + 暖色描边 + 柔和阴影 + emoji 前缀。
- 角色头像 = 白边 + 投影圆形；对话气泡 = 圆角卡片 + 虚线边框旁白卡；重点条 = 渐变胶囊 + ✨。
- 全部 UI 颜色走 `:root` CSS 主题变量（`--accent`/`--accent2` 等），随主题换肤。

**③ 默认主题基线**
- `mdToStory` 解析 AI markdown 后，缺省 `themeId = 'storybook'`（童趣绘本），确保 AI 不指定主题时卡通装饰一定生效，而非裸排版回退。
- 主题可选集：`storybook` / `forest` / `night` / `ocean`，由 `STORY_THEMES` 统一管理（配色 + `deco` 装饰集）。
- AI 生成 H5 时仍可下发 `theme_id` 覆盖默认（如英语低段→storybook、自然探究→forest、夜读→night），但**无论哪个主题都必须带 ①② 的卡通化基线**。

**④ 边界（克制）**
- 卡通装饰是"氛围点缀"，不与正文/互动争视线：`.deco` `pointer-events:none`、`z-index:0`，内容层 `z-index:2` 始终在上。
- 不引入外部图片/字体依赖；图标一律 emoji + CSS，维持零版权风险与"独立 H5 文件可离线打开"能力。
- 与 PPT 风格模板体系**同构但不耦合**：H5 走 `STORY_THEMES`（绘本语义），PPT 走 `CwTheme`，二者各自维护、风格标签可映射对齐（如 cartoon→storybook）。

---

## 6. 落地里程碑

| 阶段 | 内容 | 难度 | 依赖 |
|---|---|---|---|
| **P1（首版）** | `generate`/`render-ppt` 增加 `style_tag`+`theme_id` 参数；前端风格下拉 + 生成即套用；模板库三页构图（已部分完成） | 低 | 现有 `CwTheme`/`STYLE_LABELS` |
| **P2** | `suggest-style` 端点 + "AI 推荐风格"按钮；`style_profile` 自由描述映射到受控词表 | 中 | P1 |
| **P3** | 风格"记忆/偏好"：教师常用风格沉淀，下次默认带出；按学科/学段智能默认风格 | 低 | P1 |
| **P4（探索）** | 风格级联微调（同风格下"更活泼/更稳重"连续档），仍受词表约束 | 中 | P2 |

---

## 7. 边界与克制（纪律对齐）

1. **零外部素材**：任何风格都来自系统自有 `CwTheme` + AI 语义，**不抓 Ibaotu/第一PPT 等站点的 pptx 或图**。
2. **版式集合不变**：AI 只能调"节奏与倾向"，版式骨架仍由 `EDU_LAYOUT_SKELETONS` 约束，保证与前端 `applyTemplate` 对齐、导出链一致。
3. **受控词表**：AI 输出 `style_tag`/`theme_id` 必须 ∈ 系统已定义集合，未知值回退默认，杜绝 AI 引入未知配色。
4. **不自动部署生产**：改动先在本地 `vite dev` + staging 真浏览器验证全绿，停手交用户验收。
5. **H5 与 PPT 同构**：不另起一套风格体系，复用 `CwTheme`，降低维护成本。

---

## 8. 与既有修复的关系

本方案建立在已完成的模板库修复之上（2026-08-08）：
- 模板库缩微图已改为三页版式构图（缓解"只是几个色系"）。
- 套用模板已支持空课件注入 `demoOutline`（解决"编辑器无预览"）。
- 参照课件在文档模式套用时已加载（解决"引用模板加载未生效"）。

本方案在此基础上，把"风格"从"教师手动选"升级为"AI 一键生成 + 系统落地配色"，是同一模板体系的能力延伸，而非推翻重建。
