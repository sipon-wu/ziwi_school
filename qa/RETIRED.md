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
| 12 | `verify_cw_view_unified.cjs` | (原文件无头部说明) | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
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
| 28 | `verify_h5_draft_html.cjs` | 验证「H5 草稿也落派生 HTML」（2026-09-15） | `qa/verify_h5_stage.cjs` **仅接管"HD 等比档 / 手机档"这一条**；其余性质（交互/二维码/导航/模板）**无接管** → 覆盖缺口 |
| 29 | `verify_h5_entry_states.cjs` | 按**教师真实入口**验证 H5 两态与右栏（2026-09-15） | `qa/verify_h5_stage.cjs` **仅接管"HD 等比档 / 手机档"这一条**；其余性质（交互/二维码/导航/模板）**无接管** → 覆盖缺口 |
| 30 | `verify_h5_fit.cjs` | H5「整页适配舞台高度」验收（2026-09-15） | `qa/verify_h5_stage.cjs` **仅接管"HD 等比档 / 手机档"这一条**；其余性质（交互/二维码/导航/模板）**无接管** → 覆盖缺口 |
| 31 | `verify_h5_interactive.cjs` | 真浏览器验证 H5 互动课件的投屏互动（7 组件 + XSS + 横屏提示 + 向后兼容） | `qa/verify_h5_stage.cjs` **仅接管"HD 等比档 / 手机档"这一条**；其余性质（交互/二维码/导航/模板）**无接管** → 覆盖缺口 |
| 32 | `verify_h5_nav.cjs` | H5 导航/白屏两个问题的验收（2026-09-15） | `qa/verify_h5_stage.cjs` **仅接管"HD 等比档 / 手机档"这一条**；其余性质（交互/二维码/导航/模板）**无接管** → 覆盖缺口 |
| 33 | `verify_h5_qr_scope.cjs` | 验证「二维码只属于预览/查看态」（2026-09-15） | `qa/verify_h5_stage.cjs` **仅接管"HD 等比档 / 手机档"这一条**；其余性质（交互/二维码/导航/模板）**无接管** → 覆盖缺口 |
| 34 | `verify_h5_qr_three_entries.cjs` | 二维码只应出现在**预览/放映态**（2026-09-15）—— 按三种真实入口验全。 | `qa/verify_h5_stage.cjs` **仅接管"HD 等比档 / 手机档"这一条**；其余性质（交互/二维码/导航/模板）**无接管** → 覆盖缺口 |
| 35 | `verify_h5_rules.cjs` | H5 课件是否同一套版本规则的验收（2026-09-15） | `qa/verify_h5_stage.cjs` **仅接管"HD 等比档 / 手机档"这一条**；其余性质（交互/二维码/导航/模板）**无接管** → 覆盖缺口 |
| 36 | `verify_h5_template.cjs` | 验证 H5 互动课件频道的模板库接入： | `qa/verify_h5_stage.cjs` **仅接管"HD 等比档 / 手机档"这一条**；其余性质（交互/二维码/导航/模板）**无接管** → 覆盖缺口 |
| 37 | `verify_knowledge_boundary_fast.cjs` | 知识边界 · 精简版验收测试 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 38 | `verify_knowledge_graph_fix.cjs` | 知识图谱缺陷修复验证：统计三类错误在 /lesson-plans/new 加载后出现次数 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 39 | `verify_layout_consistency.cjs` | verify_layout_consistency.cjs — 布局一致性巡检 | `qa/verify_style_diversity.cjs`（PPT 版式/几何确定性判据，已登记） |
| 40 | `verify_layout_law.cjs` | 版面法则落地验收（2026-09-15） | `qa/verify_style_diversity.cjs`（PPT 版式/几何确定性判据，已登记） |
| 41 | `verify_lesson_menus.cjs` | 知微 AI 教学助手 · 教案三子菜单职责对齐专项真浏览器 E2E | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 42 | `verify_list_open_mode.cjs` | 验证「课件库列表点入 = 预览态」（2026-09-15） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
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
| 59 | `verify_reflow.cjs` | 「重新套版」（重档）语义的**确定性单测**（2026-09-15）——不依赖浏览器、不依赖 LLM。 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 60 | `verify_review_pool.cjs` | 知微 AI 教学助手 · 教案互审池专项真浏览器 E2E（复用阅读视图 + 评审人落库） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 61 | `verify_route_consistency.cjs` | 五类资源：列表端点 + 路径前缀 + 场景关键词 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 62 | `verify_s52_lock.cjs` | §5.2 家长端功能锁定验证：个人试用模式（licenseStatus !== 'active'）下， | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 63 | `verify_sheet_unified.cjs` | 题单 SheetBuilder 专项验证：渲染健康 / 小微 / 统一 footer / 出题生成 | `qa/verify_worksheet_flow.cjs`（2026-09-29 补：习题库 CRUD + 题单只读可达）**⚠ 当前红：见真缺陷** |
| 64 | `verify_shell_consistency.cjs` | 验证编辑器外壳一致性：题单 / 教案 / 出题 / 组卷 / 试卷 / 课件 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 65 | `verify_source_panel_hidden.cjs` | 验证「来源（生成配方）」面板：**缺省隐藏**，`?debug=1` 才显示（2026-09-15） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 66 | `verify_switch_flow.cjs` | 换风格「多轮流程」验收（2026-09-15） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 67 | `verify_switch_style.cjs` | A 验收（2026-09-14）：「小微明确指令换风格」 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 68 | `verify_template_modal.cjs` | 真浏览器验证：课件模板库统一弹层（按风格 / 按色系 双维度分类，选中即全文换肤套用） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 69 | `verify_thumbs.cjs` | 真实缩略图验证（2026-09-14） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 70 | `verify_user_plan.cjs` | 针对用户指定真实教案 lp_ee1dd53dfaf9（doc 模式）插入公式的真浏览器截图脚本。 | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |
| 71 | `verify_version_cadence.cjs` | 版本节奏验收（2026-09-15，按产品规则：生成 / 保存草稿 / 发布 三个时机形成版本） | `qa/verify_version_policy.cjs`（版本策略，已登记） |
| 72 | `verify_view_unified.cjs` | 查看态统一 EditorLayout + 全屏预览 fullscreen 专项验证（staging 真浏览器） | **无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单） |

## 覆盖缺口清单（无接管者，共 49 个；2026-09-29 已收口 6 条）

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
| ★★★ | **换风格流程**（小微指令换风格 / 重新套版：选档 → 二次确认 → 报**真实影响**） | `verify_switch_style` / `verify_switch_flow` / `verify_reflow` | 高：**纯前端**（`hooks/useCwTemplate.ts` + 小微对话），无后端接口 → 必须真浏览器 + 真 AI 对话 | 真改库课件页数/元素 → "预演影响"必须跟着变（不来自写死文案） |
| ★★★ | **教案互审**（开关 → 待审列表 → 评审决策） | `verify_review_pool` / `verify_annotation_version` | 中：有 API（`/review/pending`、`/lesson-plans/:id/review-decision`、`/me/school-review-config`），无需浏览器 | psql 改教案审核状态/开关 → 待审列表必须跟着变 |
| ★★ | **缩略图**（数量==页数、内容是真实渲染） | `verify_thumbs` | 中：真浏览器 + 编辑器选择器（**先探针**，旧选择器多半已过期） | 真改库页数 → 缩略图数量必须跟着变 |
| ★★ | **H5 交互一族**（导航/二维码/规则/模板/进入态/草稿 HTML） | `verify_h5_*`（9 个） | 中高：真浏览器；`verify_h5_stage` 只接管了"HD/手机两档" | 真改库 H5 内容 → 页面渲染必须跟着变 |
| ★ | **编辑器外壳/路由一致性**（6 个编辑器页 footer 预览、路由可达、不白屏） | `verify_route_consistency` / `verify_shell_consistency` / `verify_view_unified` / `verify_cw_view_unified` / `verify_list_open_mode` / `verify_lesson_menus` | 中：真浏览器 smoke，**难点是"强形态注入点"**（改库带不出差异 → 需另想注入，否则只能是弱形态） | 待想：例如真改前端 dist 里的某个 chunk（风险高，不推荐） |
| ★ | 其余（公式插入光标、知识图谱、批注版本、S52 锁定、频道导航…） | 见下表 | 视条目 | 逐条定 |

> 口径不变：**没有真注入点就先不要写**（弱形态只保底、不算数）。

## 缺口收口记录（按需补，补一条划一条）

| 日期 | 缺口 | 新守卫（已登记 `qa/run_all.cjs`） | 覆盖了哪些退役文件 |
|---|---|---|---|
| 2026-09-29 | 出题 · 组卷/试卷库 | `verify_exam_flow`（真造卷 → 回读一致 → 列表/预览读真数据；变异：**真改库题目** → 列表与预览必须跟着变） | `verify_exam_generate` / `verify_exam_preview` / `verify_exam_warn` |
| 2026-09-29 | 导出 · 内部配方不泄漏 + 公式嵌入 | `verify_export_no_leak`（真打包导出器 → 真 docx 产物：正文进档 / 公式进 `word/media` / **不出现生成模型等内部配方**；变异：**真改被测源码**把"生成模型"写回 → 判据必须抓到） | `verify_docx_no_model` / `verify_export_formula`（公式部分） |
| 2026-09-29 | 题单 · 习题库（工作单/简单卷面） | `verify_worksheet_flow`（真 CRUD：新建→回读一致→更新真写库→列表读真源→删除真删 404，题单只读可达；变异：**psql 绕过 API 改库** → 回读必须立刻反映）**⚠ 本守卫当前判红**：它抓到了缺陷 1（`exercise_sheets` 缺表；见下文），依赖项显式记未验证 | `verify_sheet_unified` |

> 其余 **49** 条缺口仍**无接管者**（见上表"覆盖缺口清单"，已收口的 6 条见上表"接管者"列），按需一条条收。

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
