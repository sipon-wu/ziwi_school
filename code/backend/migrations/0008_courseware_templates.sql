-- 课件模板外移：把前端硬编码的 PPT/H5 模板元数据纳入后端管理
-- 设计（见 backend/docs/模板外移方案.md）：
--   - PPT 与 H5 共用一张表，靠 kind 区分（两者结构/风格标签体系/配色池完全一致，仅数据倾斜不同）
--   - 内置装饰 globalDecor 不落库，由 style 经 STYLE_DECOR_MAP 后端派生，避免存 SVG 二进制
--   - theme_id 仅存引用字符串，配色解析仍由前端 pptThemes.ts 负责（后端不维护 theme 表）

CREATE TABLE IF NOT EXISTS courseware_templates (
  id           VARCHAR(64) PRIMARY KEY,
  kind         VARCHAR(16) NOT NULL DEFAULT 'ppt',   -- ppt | h5
  name         VARCHAR(128) NOT NULL,
  style        VARCHAR(32) NOT NULL,                 -- 主风格 (StyleTag)
  color_family VARCHAR(32),                          -- 后生成色系描述（与 COLOR_FAMILIES 同源）
  theme_id     VARCHAR(64) NOT NULL,                 -- 引用 pptThemes 的 CwTheme
  tags         JSONB NOT NULL DEFAULT '[]'::jsonb,   -- TplTag[] 多维标签: style/stage/subject/scenario/pageType
  subjects     JSONB NOT NULL DEFAULT '[]'::jsonb,   -- 适配学科
  grades       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- 适配学段
  demo_outline JSONB,                                -- OutlineSlide[] 示例提纲（套用空课件时注入）
  is_builtin   BOOLEAN NOT NULL DEFAULT true,        -- 平台内置 vs 用户/学校自定义
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpl_kind_style ON courseware_templates(kind, style);
CREATE INDEX IF NOT EXISTS idx_tpl_kind_subject ON courseware_templates(kind, subjects);
