# Changelog

本项目课件装饰/模板相关功能的演进记录。

---

## 2026-08-28 AI 标签巡增 + 装饰智能匹配（B 方案）

### 新增：AI 标签巡增调度器（后端）
- `internal/scheduler`：每月定时扫描未打标的装饰元件（`decor_element`/`decor_component`），
  复用既有 `AIBaseURL` 调 AI 服务推断 `motif(母题)/color(色系)/page_type(页型)/applicable(媒介)`
  四维 facet 标签，写回 `materials.decor_facets` + 冗余列。
- **巡增生长**：AI 返回词表外新词时自动注册进 `facet_vocab`，标签体系随每月巡增自动扩充。
- 开关：`AI_TAG_SCHEDULER_ENABLED`（默认关，部署时开）。
- 运维接口：`POST /devops/ai-tag/run-once`（platform_devops 鉴权）——手动触发一次全量巡增，
  便于验证打标效果；带**并发防重入**（进行中重复触发返回 409）与**单次 30 分钟超时**保护。
- 配套：`repository.ListUntaggedDecor` / `SaveDecorFacets`。

### 新增：风格标签云（前端）
- 课件生成前的"课件风格"选择由固定 `<select>` 改为**动态标签云**，从 `/facets?type=motif`
  拉取（即 AI 巡增后的受控词表），AI 巡增新标签后前端自动变多。无后端时回退 `STYLE_LABELS`。

### 调整：装饰匹配改为 B 方案（手动智能配饰）
- 装饰主视觉 = **跟随模板**（模板按风格自带内置装饰 `globalDecor`）。
- AI 素材库装饰匹配降级为**手动触发**：替换装饰面板新增「智能配饰」按钮，按当前模板
  风格/色系 + 媒介（PPT/H5 区分）匹配素材库装饰，教师确认才应用，不自动打扰主流程。

### 说明文档
- `backend/docs/模板外移方案.md`：课件模板外移后端的方案（含 PPT/H5 一致性结论）。

---

## 待办（下一阶段）
- 课件模板外移至 `courseware_templates` 表（见 `backend/docs/模板外移方案.md`）。
- 生成课件时由后端按 facet 推荐模板（替代前端硬编码过滤）。

---

## 2026-08-28（续）课件模板外移（后端闭环）

### 背景
用户确认"模板仅在前端，应存数据库"。结论：**PPT 与 H5 模板结构/风格标签体系/配色池完全一致，
仅数据倾斜不同**，可统一一张 `courseware_templates` 表（kind 区分）。模板自身已带完整标签，
**不需 AI 打标**；外移目的是让模板可被后端管理 + 按 facet 查询（替代前端硬编码过滤）。

### 新增（后端）
- `migrations/0008_courseware_templates.sql`：表结构（kind/name/style/color_family/theme_id/
  tags/subjects/grades/demo_outline/is_builtin）。内置装饰 globalDecor 不落库（由 style 派生）。
- `model/courseware_template.go`：`CoursewareTemplate` + `TplTag`/`TplTags`（jsonb 读写）。
- `repository/courseware_template_repo.go`：`List`（按 kind/style/subject/grade 过滤，jsonb ?| 命中）
  /`GetByID`/`Upsert`/`Delete`。
- `handler/courseware_template_handler.go`：`List`（公开）/ `Create`/`Update`/`Delete`（platform_devops 鉴权）。
- `cmd/server/main.go`：挂载 `GET /courseware-templates`（teacher 组）、
  `POST/PUT/DELETE /devops/courseware-templates[/:id]`（platform_devops 组）。
- `cmd/seed/templates/main.go`：**一次性搬迁 seed**，把前端 `PPT_TEMPLATE_DEFS`/`H5_TEMPLATE_DEFS`
  （共 56+34 套）导入库，作为后端模板真源。幂等（基于 id Upsert）。

### 新增（前端）
- `lib/api.ts`：`templateAPI.list(...)` + `CoursewareTemplate` 类型（纯新增，作后续切换基础；
  **未替换**现有 `PPT_TEMPLATES`/`H5_TEMPLATES` 常量引用，避免回归）。

### 说明
- 配色 `theme_id` 仅存引用字符串，配色解析仍由前端 `pptThemes.ts` 负责，后端不维护 theme 表。
- 前端常量 → 后端切换、生成课件时按 facet 推荐模板，列为后续任务。

---

## 2026-09-12 ~ 09-16（回填：会话改动盘点）

> 来源：代码注释盘点 + 独立复核（`qa/文档评审_20260916.md`）。
> 决议类改动见根 `DECISIONS.md` 同日期回填段；本段只记**缺陷修正**与实现细节。

### 修正（缺陷）
- H5 生成用**旧 themeId/旧 colorRoot** 渲染（生成端 `setState` 异步致快照用旧值）— `CoursewareBuilder.tsx:588`
- 素材库"新建课件"跳登录页：`/courseware/new` 不匹配任何路由 → 命中 `*` — `Materials.tsx:179`
- `GEN_MODEL` 显式传参**绕过通道配置** — `api_server.py:1246`
- 知识点判定条件写错（`not kp_names and kp_ids` 用错分支）— `api_server.py:522`
- `anchor_coverage` 只按名称匹配（应"ID 是身份、名称是匹配依据"）— `api_server.py:539`
- H5 点读**只能开始、无法暂停/关闭** — `renderer.ts:559/615`
- H5 编辑态空白页（真因）— `CoursewareBuilder.tsx:2513/2537`
- **生成后白屏**根因：组件数据消毒（模型把 `items[].label` 写成对象 → React #31）+ 文本元素消毒 + 截断样式落内层 div + 排序传感器须在组件顶层调用 — `VisualBlocks.tsx:531/198`、`PptxPreview.tsx:350`、`CoursewareBuilder.tsx:1611`
- 窄屏词卡被压成"一字一行"（`.read-list` 死写 `1fr 1fr`）— `renderer.ts:1185`
- H1 标题行**永不当旁白** — `mdToStory.ts:334`
- compare-table「残表」修正 — `ai-service/scripts/generate_seed_coursewares.py:447`
- 素材库上传/列表与编辑器渲染不同源（改为物化元素层）— `Materials.tsx:438`
- 左栏按钮硬编码深蓝选中态（脱离主题）— `CoursewareBuilder.tsx:1450`
- 迁移/备份踩坑技术细节（回滚脚本被当迁移执行 → 迁移自动化 + 资产快照）— `deploy.sh:85/93`

### 说明
- 本轮同时落地：`lib/layoutLaw.ts`、`lib/textClean.ts`、`lib/versionPolicy.ts` 三个缺省规则模块（规格见 `产品规划/缺省规则.md`）。
- 静默吞异常仍有约 20 处残留（清单见评审记录），**待专项清理**。
