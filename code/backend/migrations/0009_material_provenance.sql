-- 课件「生成配方 / 溯源」（2026-09-13）
--
-- 背景：materials 此前只落「产物」（content / theme_id / grade / subject），**不落「这份课件是按什么生成的」**。
--   于是从预览进编辑页时，左栏只能回填标题/主题，其余退化成空表单
--   → 表现为「左栏与画布脱节」（用户反馈：左栏显示"英语·对话·绘图"，而这份 PPT 根本不是按它生成的）。
--
-- 关键事实：**即使课件由系统预生成，其链路与教师手工生成是同构的**，区别只是"谁填了配方"：
--   教材版本 → 单元 → 教案(参照) → 知识点(课标锚点) → 场景化要求/风格/发散 → 产出
--
-- 口径（已与产品确认）：
--   · 教材版本 / 单元 / 教案 / 知识点 都是**实体引用**，不是自由文本；
--     其中教材版本会按「学校/班级/教师」**解析**（ResolvedTextbook），同一全局版本在不同学校解析结果不同，
--     故保留「解析结果引用 + 当时快照」（快照存 gen_params）。
--   · 知识点：教师选了 → 用教师选的（source=teacher）；**没选 → 系统按知识图谱边界解析**
--     （前置链 qian_zhi，为空则 parent_id 向上追溯一级；往后不超过 ±1 档 beyond_band）
--     两种情况用 gen_params.scope_resolved.source / prereq_source 区分，否则事后无法复盘。
--
-- 命名**对齐 lesson_plans**（unit / knowledge_node_ids / curriculum_alignments / period / ai_model_version），
-- 避免"同一件事两套命名"（本项目历史上多次因两份口径漂移出问题）。
--
-- 安全性：**仅加列、不动存量数据**；全部 IF NOT EXISTS，可重复执行。

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS textbook_version_id   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS textbook_unit         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS lesson_plan_id        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS knowledge_node_ids    JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS curriculum_alignments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS period                INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gen_params            TEXT;

-- 溯源反查：这些课件用了哪个教材版本 / 来自哪份教案
CREATE INDEX IF NOT EXISTS idx_material_textbook    ON materials(textbook_version_id);
CREATE INDEX IF NOT EXISTS idx_material_lesson_plan ON materials(lesson_plan_id);
