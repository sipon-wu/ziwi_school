# 已退役守卫清单（`qa/_retired_*.cjs`）

生成：2026-09-29（用户选「2 清存量守卫」）。**退役 ≠ 删除**：代码与 git 历史都保留，只是不再被扫描。

## 退役口径（为什么这 72 个不再算"守卫"）

1. **它们从未登记进 `qa/run_all.cjs` 的守卫清单** → **不在 runner / 门禁 / CI 里执行**（可验证，不是推测）。
   没人跑 = 没人知道断言是否还成立；上轮静态门实测：这类历史文件多数带"静默通过"形状（R1~R4）。
2. 其中一部分**已被登记的守卫以同性质、更严的方式接管**（下表"接管者"列，逐组核对过主题）。
3. **其余没有接管者 → 明确登记为"覆盖缺口"**（见文末清单），不假装有覆盖。

`_retired_` 前缀是既有约定（见 `_retired_verify_lesson_export_ui.cjs`）：runner 与静态门都只扫 `verify_*`/`regression_*`，
故退役文件天然被排除；**要复活**：去掉前缀并**登记进 `qa/run_all.cjs`（写 covers）**。

## 清单（共 72 个）

| # | 原文件 | 原用途 | 接管者 |
|---|---|---|---|
| 1 | `verify_0915_deliverables.cjs` | 交付自证（2026-09-15）：把 4 份课件按教师入口打开，确认「不白屏 + 页数正常 + 零报错」， | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 2 | `verify_annotation_version.cjs` | 知微 AI 教学助手 · 通用批注 + 版本快照 真浏览器验证 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 3 | `verify_canvas_fit.cjs` | 画布尺寸一致性验证（2026-09-14） | `qa/verify_canvas_bounds.cjs`（画布/全屏边界，已登记） |
| 4 | `verify_courseware_channels.cjs` | 真浏览器验证：教学课件三频道（PPT / H5 互动 / 视频）独立路由导航与可达性 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 5 | `verify_courseware_list_click.cjs` | (原文件无头部说明) | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 6 | `verify_courseware_ppt_fix.cjs` | 验证 PPT 课件列表点击进编辑态（有工具栏+缩略图可收起），而非只读放映页 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 7 | `verify_courseware_preview.cjs` | 课件(P4)轻量一致性验证：PreviewOverlay 统一承载课件全屏预览/播放 | `qa/verify_preview_pure.cjs` + `qa/verify_materials_preview_decor.cjs`（预览/装饰，已登记） |
| 8 | `verify_courseware_preview_real.cjs` | 真实验证：创建多页课件 → 预览页(带左右侧栏、可下拉) → 编辑态 | `qa/verify_preview_pure.cjs` + `qa/verify_materials_preview_decor.cjs`（预览/装饰，已登记） |
| 9 | `verify_courseware_preview_route.cjs` | 验证路由：列表 → 全屏预览（只读放映） → 编辑 | `qa/verify_preview_pure.cjs` + `qa/verify_materials_preview_decor.cjs`（预览/装饰，已登记） |
| 10 | `verify_courseware_style_p1.cjs` | 真浏览器验证 P1（AI 生成课件风格模板）：登录 → 进 PPT 编辑器(/courseware/ppt/new) → AI 模式 → 选「科技」风格 → 生 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 11 | `verify_cursor.cjs` | 验证公式插入到【光标位置】而非文档末尾（真浏览器）。 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 12 | `verify_cw_view_unified.cjs` | (原文件无头部说明) | `qa/verify_editor_shell.cjs`（2026-09-29 补：6 个编辑器同壳校验 + 预览全屏层 + **真塞坏数据不白屏**）|
| 13 | `verify_distill_base.cjs` | 蒸馏底座回归断言（知微·有谱引擎 RAG 素材层） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 14 | `verify_docx_no_model.cjs` | 自证：教案 Word 导出里**不再出现内部配方**（生成模型 / qwen-plus / 发散边界 / 前置来源）2026-09-15 | `qa/verify_export_no_leak.cjs`（2026-09-29 补：成品不得含内部配方） |
| 15 | `verify_editor_p0.cjs` | Phase 0 编辑器框架重构专项验证（真实浏览器，本地 dev :5173 + staging 后端） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 16 | `verify_editor_p0_exam.cjs` | Phase 0 编辑器框架重构专项验证 · 组卷页（ExamBuilder 迁移） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 17 | `verify_editor_p0_exercise.cjs` | Phase 0 编辑器框架重构专项验证 · 出题页（ExerciseGenerator 迁移） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 18 | `verify_exam_generate.cjs` | verify_exam_generate.cjs — 出题 AI 生成端到端验证 | `qa/verify_exam_flow.cjs`（2026-09-29 补：造卷→回读→预览） |
| 19 | `verify_exam_preview.cjs` | 验证试卷 A3 横排预览（ExamPreview 组件）staging · 13800000002 | `qa/verify_exam_flow.cjs`（2026-09-29 补：A3 对折卷面/预览渲染） |
| 20 | `verify_exam_warn.cjs` | P3 组卷页 G6 遗留 WARN 消除验证：打开 /exams/new，捕获 console 中的 | `qa/verify_exam_flow.cjs`（2026-09-29 补：pageerror=0） |
| 21 | `verify_export_formula.cjs` | 真实验证：公式导出一致性（教案+试卷 × Word+PDF） | `qa/verify_export_no_leak.cjs`（2026-09-29 补：公式须以 word/media 嵌入） |
| 22 | `verify_formula.cjs` | 验证公式渲染集成（KaTeX）staging · 13800000002 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 23 | `verify_formula_frames.cjs` | 公式编辑器逐帧验证 v2（真浏览器 + API 真相源） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 24 | `verify_formula_interactive.cjs` | 公式编辑器深度验证 v3（真点击 + 视觉量化） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 25 | `verify_frame_consistency.cjs` | { key: 'lessonplan', url: '/lesson-plans/new', scene: '教案' }, | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 26 | `verify_gen_version.cjs` | 生成路径验收（2026-09-15，产品规则第 1 条）：**系统生成并显示到屏幕上 = 自动一稿草稿** | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 27 | `verify_geom.cjs` | 两态几何一致性（2026-09-14，第二版） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 28 | `verify_h5_draft_html.cjs` | 验证「H5 草稿也落派生 HTML」（2026-09-15） | `qa/verify_h5_flow.cjs`（2026-09-29 补：派生 HTML 落库/改名重算、两态作用域、不白屏）|
| 29 | `verify_h5_entry_states.cjs` | 按**教师真实入口**验证 H5 两态与右栏（2026-09-15） | `qa/verify_h5_flow.cjs`（2026-09-29 补：派生 HTML 落库/改名重算、两态作用域、不白屏）|
| 30 | `verify_h5_fit.cjs` | H5「整页适配舞台高度」验收（2026-09-15） | `qa/verify_h5_fit.cjs`（2026-09-29 补：HD 档逐页测"缩放后整页可见" + 前置"确实触发过适配"）|
| 31 | `verify_h5_interactive.cjs` | 真浏览器验证 H5 互动课件的投屏互动（7 组件 + XSS + 横屏提示 + 向后兼容） | `qa/verify_h5_interactive.cjs`（2026-09-29 补：8 类组件渲染 + XSS 静态/真浏览器双重验证 + 向后兼容）|
| 32 | `verify_h5_nav.cjs` | H5 导航/白屏两个问题的验收（2026-09-15） | `qa/verify_h5_flow.cjs`（2026-09-29 补：派生 HTML 落库/改名重算、两态作用域、不白屏）|
| 33 | `verify_h5_qr_scope.cjs` | 验证「二维码只属于预览/查看态」（2026-09-15） | `qa/verify_h5_flow.cjs`（2026-09-29 补：派生 HTML 落库/改名重算、两态作用域、不白屏）|
| 34 | `verify_h5_qr_three_entries.cjs` | 二维码只应出现在**预览/放映态**（2026-09-15）—— 按三种真实入口验全。 | `qa/verify_h5_qr_three_entries.cjs`（2026-09-29 补：**按现实现更正口径**——点行=预览（不分状态）/ 本人草稿右侧=编辑草稿→编辑器 / 已发布右侧=打开→预览；注入：真改库状态翻转）|
| 35 | `verify_h5_rules.cjs` | H5 课件是否同一套版本规则的验收（2026-09-15） | `qa/verify_h5_rules.cjs`（2026-09-29 补：事件契约一致 / 版本快照落库 / 画布配色真变）|
| 36 | `verify_h5_template.cjs` | 验证 H5 互动课件频道的模板库接入： | `qa/verify_h5_template.cjs`（2026-09-29 补：池隔离/条目完备/面板真用 H5 池）|
| 37 | `verify_knowledge_boundary_fast.cjs` | 知识边界 · 精简版验收测试 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 38 | `verify_knowledge_graph_fix.cjs` | 知识图谱缺陷修复验证：统计三类错误在 /lesson-plans/new 加载后出现次数 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 39 | `verify_layout_consistency.cjs` | verify_layout_consistency.cjs — 布局一致性巡检 | `qa/verify_style_diversity.cjs`（PPT 版式/几何确定性判据，已登记） |
| 40 | `verify_layout_law.cjs` | 版面法则落地验收（2026-09-15） | `qa/verify_style_diversity.cjs`（PPT 版式/几何确定性判据，已登记） |
| 41 | `verify_lesson_menus.cjs` | 知微 AI 教学助手 · 教案三子菜单职责对齐专项真浏览器 E2E | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 42 | `verify_list_open_mode.cjs` | 验证「课件库列表点入 = 预览态」（2026-09-15） | **部分接管**：`qa/verify_h5_qr_three_entries.cjs`（H5 侧"点行=预览"已验）；**PPT 侧未验** → 仍是缺口|
| 43 | `verify_materials_interactive_staging.cjs` | 聚焦验证：staging 后端 InteractiveSlots 落库 + 指针清空 + /uploads 静态路由 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 44 | `verify_p7_and_h5.cjs` | 两条目测件的**几何/状态证据**（2026-09-15） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 45 | `verify_parity.cjs` | 临时验证脚本（2026-09-14）：编辑态 vs 预览态「同一页」逐字比对。 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 46 | `verify_phase0.cjs` | Phase 0 有据引擎专项验证（真实浏览器） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 47 | `verify_physics_account.cjs` | 物理教师 13800000028 全流程验证 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 48 | `verify_ppt_brand_blue.cjs` | 真浏览器验证：PPT 课件编辑器 品牌蓝统一 + 导出下拉 + 全屏导出补齐 + 撤销/重做图标 | `qa/verify_style_diversity.cjs`（PPT 版式/几何确定性判据，已登记） |
| 49 | `verify_ppt_canvas.cjs` | (原文件无头部说明) | `qa/verify_canvas_bounds.cjs`（画布/全屏边界，已登记） |
| 50 | `verify_ppt_canvas2.cjs` | (原文件无头部说明) | `qa/verify_canvas_bounds.cjs`（画布/全屏边界，已登记） |
| 51 | `verify_ppt_canvas3.cjs` | (原文件无头部说明) | `qa/verify_canvas_bounds.cjs`（画布/全屏边界，已登记） |
| 52 | `verify_ppt_fullscreen.cjs` | 知微 PPT 编辑器 · 全屏编辑 真浏览器验证 | `qa/verify_canvas_bounds.cjs`（画布/全屏边界，已登记） |
| 53 | `verify_ppt_law.cjs` | PPT 端版面法则落地验收（2026-09-15） | `qa/verify_style_diversity.cjs`（PPT 版式/几何确定性判据，已登记） |
| 54 | `verify_ppt_propfs.cjs` | (原文件无头部说明) | `qa/verify_style_diversity.cjs`（PPT 版式/几何确定性判据，已登记） |
| 55 | `verify_ppt_slots.cjs` | 验证 PPT「内容与模板分离」：预览态 P11 作业布置应只显示 3 列，无多余空白框 | `qa/verify_style_diversity.cjs`（PPT 版式/几何确定性判据，已登记） |
| 56 | `verify_preview_overlay.cjs` | 验证 6 个编辑器页 footer「预览」按钮都走全屏预览层（fixed inset-0 z-50）， | `qa/verify_preview_pure.cjs` + `qa/verify_materials_preview_decor.cjs`（预览/装饰，已登记） |
| 57 | `verify_preview_scroll.cjs` | 验证预览页滚动 + 左右滑动翻页 + 底部导航可达（staging · 13800000002） | `qa/verify_preview_pure.cjs` + `qa/verify_materials_preview_decor.cjs`（预览/装饰，已登记） |
| 58 | `verify_probe.cjs` | (原文件无头部说明) | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 59 | `verify_reflow.cjs` | 「重新套版」（重档）语义的**确定性单测**（2026-09-15）——不依赖浏览器、不依赖 LLM。 | `qa/verify_style_intent.cjs`（2026-09-29 补：意图/多轮确认/预演=真实影响/可回退 —— 确定性部分）|
| 60 | `verify_review_pool.cjs` | 知微 AI 教学助手 · 教案互审池专项真浏览器 E2E（复用阅读视图 + 评审人落库） | `qa/verify_review_flow.cjs`（2026-09-29 补：开关→待审列表→决策）|
| 61 | `verify_route_consistency.cjs` | 五类资源：列表端点 + 路径前缀 + 场景关键词 | `qa/verify_editor_shell.cjs`（2026-09-29 补：6 个编辑器同壳校验 + 预览全屏层 + **真塞坏数据不白屏**）|
| 62 | `verify_s52_lock.cjs` | §5.2 家长端功能锁定验证：个人试用模式（licenseStatus !== 'active'）下， | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 63 | `verify_sheet_unified.cjs` | 题单 SheetBuilder 专项验证：渲染健康 / 小微 / 统一 footer / 出题生成 | `qa/verify_worksheet_flow.cjs`（2026-09-29 补：习题库 CRUD + 题单只读可达）**⚠ 当前红：见真缺陷** |
| 64 | `verify_shell_consistency.cjs` | 验证编辑器外壳一致性：题单 / 教案 / 出题 / 组卷 / 试卷 / 课件 | `qa/verify_editor_shell.cjs`（2026-09-29 补：6 个编辑器同壳校验 + 预览全屏层 + **真塞坏数据不白屏**）|
| 65 | `verify_source_panel_hidden.cjs` | 验证「来源（生成配方）」面板：**缺省隐藏**，`?debug=1` 才显示（2026-09-15） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 66 | `verify_switch_flow.cjs` | 换风格「多轮流程」验收（2026-09-15） | `qa/verify_style_intent.cjs`（2026-09-29 补：意图/多轮确认/预演=真实影响/可回退 —— 确定性部分）|
| 67 | `verify_switch_style.cjs` | A 验收（2026-09-14）：「小微明确指令换风格」 | `qa/verify_style_intent.cjs`（2026-09-29 补：意图/多轮确认/预演=真实影响/可回退 —— 确定性部分）|
| 68 | `verify_template_modal.cjs` | 真浏览器验证：课件模板库统一弹层（按风格 / 按色系 双维度分类，选中即全文换肤套用） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 69 | `verify_thumbs.cjs` | 真实缩略图验证（2026-09-14） | `qa/verify_thumbs.cjs`（2026-09-29 补：数量=1封面+正文页数 / 每张有文字与页面标记 / 比例 / 标题顺序）|
| 70 | `verify_user_plan.cjs` | 针对用户指定真实教案 lp_ee1dd53dfaf9（doc 模式）插入公式的真浏览器截图脚本。 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 71 | `verify_version_cadence.cjs` | 版本节奏验收（2026-09-15，按产品规则：生成 / 保存草稿 / 发布 三个时机形成版本） | `qa/verify_version_policy.cjs`（版本策略，已登记） |
| 72 | `verify_view_unified.cjs` | 查看态统一 EditorLayout + 全屏预览 fullscreen 专项验证（staging 真浏览器） | `qa/verify_editor_shell.cjs`（2026-09-29 补：6 个编辑器同壳校验 + 预览全屏层 + **真塞坏数据不白屏**）|

## 覆盖缺口清单（无接管者，共 31 个；2026-09-29 已收口 24 条）

这些性质**目前没有自动守卫**。要补，就在 `qa/` 下新写守卫并登记进 `qa/run_all.cjs`（写 covers + critical 视情况）。

- `verify_0915_deliverables` — 交付自证（2026-09-15）：把 4 份课件按教师入口打开，确认「不白屏 + 页数正常 + 零报错」，
- `verify_annotation_version` — 知微 AI 教学助手 · 通用批注 + 版本快照 真浏览器验证
- `verify_courseware_channels` — 真浏览器验证：教学课件三频道（PPT / H5 互动 / 视频）独立路由导航与可达性
- `verify_courseware_list_click` — (原文件无头部说明)
- `verify_courseware_ppt_fix` — 验证 PPT 课件列表点击进编辑态（有工具栏+缩略图可收起），而非只读放映页
- `verify_courseware_style_p1` — 真浏览器验证 P1（AI 生成课件风格模板）：登录 → 进 PPT 编辑器(/courseware/ppt/new) → AI 模式 → 选
- `verify_cursor` — 验证公式插入到【光标位置】而非文档末尾（真浏览器）。
- `verify_cw_view_unified` — (原文件无头部说明)
- `verify_distill_base` — 蒸馏底座回归断言（知微·有谱引擎 RAG 素材层）
- `verify_docx_no_model` — 自证：教案 Word 导出里**不再出现内部配方**（生成模型 / qwen-plus / 发散边界 / 前置来源）2026-09-15
- `verify_editor_p0` — Phase 0 编辑器框架重构专项验证（真实浏览器，本地 dev :5173 + staging 后端）
- `verify_editor_p0_exam` — Phase 0 编辑器框架重构专项验证 · 组卷页（ExamBuilder 迁移）
- `verify_editor_p0_exercise` — Phase 0 编辑器框架重构专项验证 · 出题页（ExerciseGenerator 迁移）
- `verify_exam_generate` — verify_exam_generate.cjs — 出题 AI 生成端到端验证
- `verify_exam_preview` — 验证试卷 A3 横排预览（ExamPreview 组件）staging · 13800000002
- `verify_exam_warn` — P3 组卷页 G6 遗留 WARN 消除验证：打开 /exams/new，捕获 console 中的
- `verify_export_formula` — 真实验证：公式导出一致性（教案+试卷 × Word+PDF）
- `verify_formula` — 验证公式渲染集成（KaTeX）staging · 13800000002
- `verify_formula_frames` — 公式编辑器逐帧验证 v2（真浏览器 + API 真相源）
- `verify_formula_interactive` — 公式编辑器深度验证 v3（真点击 + 视觉量化）
- `verify_frame_consistency` — { key: 'lessonplan', url: '/lesson-plans/new', scene: '教案' },
- `verify_gen_version` — 生成路径验收（2026-09-15，产品规则第 1 条）：**系统生成并显示到屏幕上 = 自动一稿草稿**
- `verify_geom` — 两态几何一致性（2026-09-14，第二版）
- `verify_h5_draft_html` — 验证「H5 草稿也落派生 HTML」（2026-09-15）
- `verify_h5_entry_states` — 按**教师真实入口**验证 H5 两态与右栏（2026-09-15）
- `verify_h5_fit` — H5「整页适配舞台高度」验收（2026-09-15）
- `verify_h5_interactive` — 真浏览器验证 H5 互动课件的投屏互动（7 组件 + XSS + 横屏提示 + 向后兼容）
- `verify_h5_nav` — H5 导航/白屏两个问题的验收（2026-09-15）
- `verify_h5_qr_scope` — 验证「二维码只属于预览/查看态」（2026-09-15）
- `verify_h5_qr_three_entries` — 二维码只应出现在**预览/放映态**（2026-09-15）—— 按三种真实入口验全。
- `verify_h5_rules` — H5 课件是否同一套版本规则的验收（2026-09-15）
- `verify_h5_template` — 验证 H5 互动课件频道的模板库接入：
- `verify_knowledge_boundary_fast` — 知识边界 · 精简版验收测试
- `verify_knowledge_graph_fix` — 知识图谱缺陷修复验证：统计三类错误在 /lesson-plans/new 加载后出现次数
- `verify_lesson_menus` — 知微 AI 教学助手 · 教案三子菜单职责对齐专项真浏览器 E2E
- `verify_list_open_mode` — 验证「课件库列表点入 = 预览态」（2026-09-15）
- `verify_materials_interactive_staging` — 聚焦验证：staging 后端 InteractiveSlots 落库 + 指针清空 + /uploads 静态路由
- `verify_p7_and_h5` — 两条目测件的**几何/状态证据**（2026-09-15）
- `verify_parity` — 临时验证脚本（2026-09-14）：编辑态 vs 预览态「同一页」逐字比对。
- `verify_phase0` — Phase 0 有据引擎专项验证（真实浏览器）
- `verify_physics_account` — 物理教师 13800000028 全流程验证
- `verify_probe` — (原文件无头部说明)
- `verify_reflow` — 「重新套版」（重档）语义的**确定性单测**（2026-09-15）——不依赖浏览器、不依赖 LLM。
- `verify_review_pool` — 知微 AI 教学助手 · 教案互审池专项真浏览器 E2E（复用阅读视图 + 评审人落库）
- `verify_route_consistency` — 五类资源：列表端点 + 路径前缀 + 场景关键词
- `verify_s52_lock` — §5.2 家长端功能锁定验证：个人试用模式（licenseStatus !== 'active'）下，
- `verify_sheet_unified` — 题单 SheetBuilder 专项验证：渲染健康 / 小微 / 统一 footer / 出题生成
- `verify_shell_consistency` — 验证编辑器外壳一致性：题单 / 教案 / 出题 / 组卷 / 试卷 / 课件
- `verify_source_panel_hidden` — 验证「来源（生成配方）」面板：**缺省隐藏**，`?debug=1` 才显示（2026-09-15）
- `verify_switch_flow` — 换风格「多轮流程」验收（2026-09-15）
- `verify_switch_style` — A 验收（2026-09-14）：「小微明确指令换风格」
- `verify_template_modal` — 真浏览器验证：课件模板库统一弹层（按风格 / 按色系 双维度分类，选中即全文换肤套用）
- `verify_thumbs` — 真实缩略图验证（2026-09-14）
- `verify_user_plan` — 针对用户指定真实教案 lp_ee1dd53dfaf9（doc 模式）插入公式的真浏览器截图脚本。
- `verify_view_unified` — 查看态统一 EditorLayout + 全屏预览 fullscreen 专项验证（staging 真浏览器）

---

## 下一批建议（2026-09-29 摸底，按"价值 ÷ 成本"排序；成本含"要不要真浏览器/真 AI"）

| 优先 | 缺口 | 退役文件 | 成本 | 强形态注入点（预备） |
|---|---|---|---|---|
| ✅ | ~~**换风格流程**~~ **2026-09-29 已收（确定性部分）** | → `verify_style_intent`（25 断言 + 强形态变异：写死影响范围 / 剥掉 elements 回退）**仍未守：画布实际换肤/重排的渲染结果**（需真浏览器，见下表 ★★） | — | — |
| ✅ | ~~**教案互审**（开关 → 待审列表 → 评审决策）~~ **2026-09-29 已收** | → `verify_review_flow`（12 断言 + 强形态变异：psql 改回 pending → 列表必须重新出现） | — | — |
| ✅ | ~~**缩略图**（数量==页数、内容是真实渲染）~~ **2026-09-29 已收** | → `verify_thumbs`（9 断言 + 强形态变异：psql 删库里一页 → 缩略图 5→4 且该页标题消失） | — | — |
| ✅ | ~~**H5 交互一族**~~ **2026-09-29 全族清空** | → `verify_h5_flow`（草稿HTML/改名重算/两态作用域/不白屏）+ `verify_h5_interactive`（8组件/XSS/兼容）+ `verify_h5_template`（模板池隔离）+ `verify_h5_fit`（整页适配）+ `verify_h5_rules`（事件契约/快照/重渲染）+ `verify_h5_qr_three_entries`（三种入口） | — | — |
| ✅ | ~~**编辑器外壳/路由一致性**~~ **2026-09-29 已收** | → `verify_editor_shell`（6 页同壳 + 预览全屏层 + 坏数据不白屏）。**仍未验**：PPT 侧列表"点行=预览" | — | — |
| ★ | 其余（公式插入光标、知识图谱、批注版本、S52 锁定、频道导航…） | 见下表 | 视条目 | 逐条定 |

> 口径不变：**没有真注入点就先不要写**（弱形态只保底、不算数）。

## 缺口收口记录（按需补，补一条划一条）

| 日期 | 缺口 | 新守卫（已登记 `qa/run_all.cjs`） | 覆盖了哪些退役文件 |
|---|---|---|---|
| 2026-09-29 | 出题 · 组卷/试卷库 | `verify_exam_flow`（真造卷 → 回读一致 → 列表/预览读真数据；变异：**真改库题目** → 列表与预览必须跟着变） | `verify_exam_generate` / `verify_exam_preview` / `verify_exam_warn` |
| 2026-09-29 | 导出 · 内部配方不泄漏 + 公式嵌入 | `verify_export_no_leak`（真打包导出器 → 真 docx 产物：正文进档 / 公式进 `word/media` / **不出现生成模型等内部配方**；变异：**真改被测源码**把"生成模型"写回 → 判据必须抓到） | `verify_docx_no_model` / `verify_export_formula`（公式部分） |
| 2026-09-29 | 编辑器外壳一致性（6 页同壳 / 预览全屏层 / 路由可达） | `verify_editor_shell`（① 6 个编辑器新建页（教案/课件/出题/组卷/题单/作业）**都不白屏**（实测 366/2144/646/427/330/338 字）② 都有 footer「预览」入口 ③ 点预览都打开**同一个全屏承载层** `fixed inset-0 z-50`，且点前点后计数必须变化（不变则判据失效）④ **真塞坏数据不白屏**：psql 真改库把 content 置空 / 置成非法内容 → 编辑页仍可渲染且 pageerror=0，跑完写回；变异：④ 即真注入） | `verify_shell_consistency` / `verify_view_unified` / `verify_cw_view_unified` / `verify_route_consistency` |
| 2026-09-29 | H5 课件库三种入口归属 | `verify_h5_qr_three_entries`（① 列表可达+草稿徽标 ② **点行 → 预览态**（2026-09-15 修正后的规则，草稿也一样）③ **本人草稿右侧按钮「编辑草稿」→ 编辑器** ④ **psql 真改库状态（草稿→已发布）**：徽标变「已发布」、点行仍是预览、右侧按钮 title 翻成「打开」且点击仍是预览 ⑤ pageerror=0；变异：状态翻转本身就是真注入，另加【变异测试·真注入】证据断言） | `verify_h5_qr_three_entries` |
| 2026-09-29 | H5 换风格规则（与 PPT 同规则） | `verify_h5_rules`（① **跨模块契约**：派发端常量 `SWITCH_STYLE_EVENT` === 监听端注册的事件名（不一致=面板说换了、画布不动）② 快照标签只有一处模板、无按格式分支（H5 与 PPT 同规则）③ 真页面按契约派发轻档换素净 → `handled=true` ④ 版本接口出现「换风格前（轻档 → 素净）」⑤ 画布 `srcdoc` 变了**且配色集合双向改变**（真换肤）⑥ pageerror=0；变异：**真改被测源码**改名事件常量 → ① 必须红） | `verify_h5_rules` |
| 2026-09-29 | H5 整页适配（HD 档） | `verify_h5_fit`（① `?hd=1` 真进 HD 档且舞台 16:9 ② **逐页**量 `innerH(transform 后 rect) ≤ avail`（不看 scrollHeight —— 那是错口径）③ **前置**：至少一页确实触发等比适配，否则记**未验证**（防真空通过）④ pageerror=0；变异：**真改被测源码**让 `fitToStage` 提前 return（关掉适配）→ 出现"超屏不缩放"的页且无 `.fit` 页 ⇒ ②③ 必须红） | `verify_h5_fit` |
| 2026-09-29 | H5 模板库接入 | `verify_h5_template`（① 池隔离：H5 池非空、每条 kind=h5、`getTemplatesByKind` 按媒介分流、**两池 id 不相交** ② 条目完备：id/name/themeId 非空、**themeId 能被配色解析器解析**（单独打包 pptThemes 做真解析，避免真空通过）、style 有中文标签、面板筛选函数不抛错 ③ **真浏览器**进 `/courseware/h5/new` 点「模板库」→ 出现 **H5 池独有模板名**（名字取自被测对象）且**不出现** PPT 独有模板名；变异：**真改被测源码**（H5 池清空 + 取池串池）→ ①② 必须红） | `verify_h5_template` |
| 2026-09-29 | H5 互动组件（8 类渲染 / XSS / 向后兼容） | `verify_h5_interactive`（① 点读/跟读/选择/揭示/绘图/音频/视频/弹层**八类标记逐个列缺** ② 静态转义：产物里不得有裸 `<script>` 或裸 `onerror="`，且必须能看到 `&lt;script&gt;` ③ **真浏览器** `setContent` 后注入的 `window.__xss` 未被置位、组件在真 DOM 里存在、pageerror=0 ④ 未知类型/残缺 quiz 不抛错也不冒脏组件 ⑤ 含 HD 舞台+固定比例；变异：**真改被测源码把 `esc()` 置恒等** → ②③ 必须红，且实测**注入脚本在真浏览器里确实执行**） | `verify_h5_interactive` |
| 2026-09-29 | H5：派生 HTML 落库与重算 / 两态作用域 / 不白屏 | `verify_h5_flow`（① 保存草稿 → 库里 `h5_html` 非空且含 **HD 舞台+固定比例**运行时代码 ② **改课题名→保存 → h5_html 必须含新标题**（守 `CoursewareBuilder.tsx:780` 记录过的真缺陷）③ 编辑态右栏=批注/版本且**无**二维码；**预览态右栏必须有**扫码分享（`img[alt="扫码查看"]`）④ 两态切换不白屏、pageerror=0；变异：**psql 直接改库里的 h5_html** → API 回读显示被改后的值） | `verify_h5_draft_html` / `verify_h5_nav` / `verify_h5_entry_states` / `verify_h5_qr_scope`（`verify_h5_qr_three_entries` 仅部分） |
| 2026-09-29 | PPT 编辑器缩略图 | `verify_thumbs`（① 数量 == 1 封面 + 正文页数（口径=库内容 `## ` 段数，探针实测）② 每张**有文字**且含该页独有标记（线框 0 字即红）③ 16:9 或 4:3 且尺寸非零 ④ 标题逐页且顺序一致 ⑤ pageerror=0；变异：**psql 绕过 API 删库里一页** → 缩略图 5→4 且该页标题消失） | `verify_thumbs` |
| 2026-09-29 | 换风格流程（确定性部分） | `verify_style_intent`（①不抢生成意图 ②多轮状态机含"顺序坑" ③文案口径：light"位置不动"/heavy 报**预演影响**、快照失败如实降级 ④**预演=真实影响**（报出的 pages/elements 必须等于从结果反推的实际变化）+ 只改几何 ⑤**可回退**（撤销后几何回到原样）；变异：**真改被测源码**写死影响范围 + 剥掉 elements 回退 → ④⑤必须红） | `verify_switch_style` / `verify_switch_flow` / `verify_reflow` |
| 2026-09-29 | 教案互审（开关/待审列表/评审决策） | `verify_review_flow`（开关真写库 → 开关注入行为：定稿即 `pending` → 待审列表**含同事件、排除自己的** → 决策落地：列表消失且教案 `approved`；变异：**psql 绕过 API 改回 pending** → 列表必须重新出现） | `verify_review_pool` |
| 2026-09-29 | 题单 · 习题库（工作单/简单卷面） | `verify_worksheet_flow`（真 CRUD：新建→回读一致→更新真写库→列表读真源→删除真删 404，题单只读可达；变异：**psql 绕过 API 改库** → 回读必须立刻反映）**⚠ 本守卫当前判红**：它抓到了缺陷 1（`exercise_sheets` 缺表；见下文），依赖项显式记未验证 | `verify_sheet_unified` |

> 其余 **31** 条缺口仍**无接管者**（见上表"覆盖缺口清单"，已收口的 24 条见上表"接管者"列），按需一条条收。

---

## 新守卫抓到的真缺陷（2026-09-29 · **留红待决**）

写 `verify_worksheet_flow` 时立刻抓到一条，并连带把 `verify_schema_drift` 的**两个盲区**修出来。

### 缺陷 1 ✅ **已修复（2026-09-29，修法 ①）**：`/api/worksheets`（习题库/工作单）曾**全 500**

- **症状**：`POST/GET /api/worksheets` → `500 {"error":"ERROR: relation \"exercise_sheets\" does not exist (SQLSTATE 42P01)"}`。
  路由在 `code/backend/cmd/server/main.go:318-322` 已注册、前端有页面、模型也在，但**表不存在**。
- **根因（证据）**：`code/backend/cmd/server/main.go:48-61` 的 `AutoMigrate(...)` 清单里有 `&model.Sheet{}`，
  **没有 `&model.ExerciseSheet{}`**；`code/backend/migrations/` 里也没有任何 `exercise_sheets` 建表语句。
  实测：`SELECT tablename FROM pg_tables` 只有 `sheets`，没有 `exercise_sheets`。
- **影响面（实测）**：有 `TableName()` 的模型共 19 个，**库里缺表的就这 1 个**。
- **建议修法（二选一，需你定）**：
  1. `main.go` 的 AutoMigrate 清单加 `&model.ExerciseSheet{}`（最小改动，GORM 幂等建表）；或
  2. 新增迁移 `0013_exercise_sheets.sql`（与"迁移是结构真源"的口径更一致）。
- **现状（已修）**：`code/backend/cmd/server/main.go` 的 AutoMigrate 清单已补 `&model.ExerciseSheet{}`（并留注释说明为何曾漏）；
  部署后实测：`exercise_sheets` 表已建、`POST /api/worksheets` → 201、DELETE → 200。
  `verify_worksheet_flow`（正常 10 断言 / 变异 11 断言）与 `verify_schema_drift`（14 断言）**均转绿**；
  变异门对 `verify_worksheet_flow` 的"未验证"也随之解除（15 个关键守卫全部满足变异契约）。
  教训留档：**"路由+模型+前端都在、只差一张表"**这种漏写，光靠代码评审看不出来 —— 只有"声明 ↔ 库"对账能抓。

### 口径修正（2026-09-29，写 `verify_h5_flow` 时发现）：退役文件里的"二维码只属于查看态"**已不成立**

- 退役的 `h5_qr_scope` / `h5_qr_three_entries` 写的是"查看态路由 `/courseware/h5/:id` 右栏有二维码、编辑态没有"。
- **现实现**：二维码在「**全屏预览**」的高级右栏（`CwPreviewPane` 的 `img[alt="扫码查看"]`，H5 且已保存时才有），
  两条路由页本身都不显示；另有一个发布后提示用的弹层（`扫码在手机查看`）。
- 故新守卫按**现实现**写：编辑态**不得**有分享二维码；点「预览」后预览态**必须**有。
  **提醒下一个人：不要照退役文件里的旧规则写断言。**

### 手法教训（2026-09-29，写 `verify_h5_flow` / `verify_thumbs` 时踩到 · 已修）

- **往库里写含换行的内容一律走 base64**（见下条）；**改 `content` 未必对**：H5 编辑器是从**派生的 `h5_html`**
  渲染并回写的（`CoursewareBuilder.tsx:284` 同口径），改 `content` 会在保存时被覆盖 → 要改成**走 UI 动作**
  或改 `h5_html`。**保存草稿是本地暂存**（localStorage）：验证服务端内容前必须先清本地草稿，否则画布走旧草稿。

**用 psql 写含换行的内容时不能拼字面量**：`ssh` + shell 往返会把 `JSON.stringify` 的 `\n` 变成字面反斜杠+n，
PostgreSQL 不把它当换行 → 内容塌成一整行 → 被测应用解析出 **0 页**。首版变异因此"看起来像产品坏了"，其实是**注入手法写错**。
**正确做法**：`convert_from(decode('<base64>','base64'),'UTF8')`（字符串里无引号/换行，过 shell 不变形）。
凡"要往库里写真内容"的注入，一律走 base64。

### 待定项（**只登记不判红**，2026-09-29 实收 `verify_style_intent` 时发现）：`确认换成国风` 与注释承诺不符

- **函数注释承诺**（`src/lib/styleIntent.ts:181`）：「先判确认/取消/改档，再判新指令，否则'确认换成国风'会被当成新指令而重开流程」。
- **实测行为**：`styleFlowStep({stage:'confirm',…}, '确认换成国风')` → **返回 null**（不是 execute）。
  原因：`CONFIRM_RE` 是**整串锚定**的（`^\s*(确认|确定|…)\s*[。.!！]?\s*$`），"确认换成国风"既不匹配确认、也不匹配取消/改档。
  调用方拿到 null 会走正常处理 → `detectTemplateIntent` 命中（含"换"+风格词）→ **重开流程（再问一次选档）**，正是注释想避免的。
- **两种改法（都不影响"预演/回退"两条安全承诺）**：① 放宽 `CONFIRM_RE`（允许"确认…"开头）；② 修正注释。
- **现状**：定下来之前**不判红**（`verify_style_intent` 打印 `[note] 待定项：…`），等你定。

### 盲区 2（守卫自身缺陷 · 已修）：`verify_schema_drift` 把"声明了表名但库里缺表"**静默跳过**

- 旧写法两处：
  ① `if (!dbTables.has(table)) skipStructs.push(...)` —— 表不存在时**跳过而非判红**（正是 `audit_logs` 那次事故的形状）；
  ② `TableName()` 接收者正则 `\(\s*\w*\s*\*?([A-Z]\w*)\s*\)` 在**值接收者** `func (ExerciseSheet)` 上会贪婪吃掉
     `Exercise`、只捕到 `Sheet` → 声明取不到 → 又落进"猜表名"分支被跳过。
- 已修：① 改为判红（新增断言"模型声明了表名 → 库里必须有该表"）；② 改为取 `)` 前最后一个大写标识符。
- 附带发现（**登记不判红，已加窄白名单**）：修正则后露出 `tb_lesson_source.created_at/updated_at` 与库里不一致 ——
  该表是 `ensureDistillSchema()` 用**幂等原生 SQL** 建的 32 分区表（含 `vector(1024)`/HNSW，GORM 不支持 AutoMigrate），
  模型文件自述"仅供查询扫描"，且全仓无写入消费者 → 属**声明级不一致、当前无害**；按既有口径（同"仅基线声明的缺列"）
  记 note 并写明理由。**一旦有写入路径就必须转红。**

---

> 维护提示：新增守卫 **必须**登记进 `qa/run_all.cjs`，否则它会走进这份"退役"名单 ——
> 因为它同样"没人跑"。详见 `DECISIONS.md` 的「反假绿机制」与 `qa/gate_assert_hygiene.cjs`。
