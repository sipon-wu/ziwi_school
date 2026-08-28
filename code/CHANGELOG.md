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
