-- 迁移 0007: materials 表扩展装饰元件 facet 支持
-- 目的: 支持「装饰元件」(模板内置装饰 / 用户个性替换) 的 facet 自动匹配。
-- 原则: 仅加列 + 索引，不动现有数据与列，零破坏、可回滚(见末尾 DROP)。
--
-- 落地方式说明: 本仓库 main.go 采用 GORM AutoMigrate（已含 &model.Material{}），
-- 新增的装饰字段已在 Material struct 中声明（type: jsonb），
-- AutoMigrate 会自动加列，与本项目既有迁移模式一致。本 SQL 文件作为
-- 等价文档 + 手动执行备份保留；若需手动执行，请在 staging 验证后再上 prod。
--
-- facet 维度收敛为 4 维（与前端 cwTemplate.ts 的 STYLE_LABELS / COLOR_FAMILIES 同源）：
--   applicable 媒介: ppt|h5|common
--   motif      母题: 国风|科技|清新|...（与模板风格标签同源）
--   color      色系: 蓝系|红金系|暖棕系|...（与模板色系标签同源）
--   page_type  页型: cover|content|summary|homework|...

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS category     varchar(30) NOT NULL DEFAULT 'courseware',
  ADD COLUMN IF NOT EXISTS decor_facets jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS applicable   varchar(10),
  ADD COLUMN IF NOT EXISTS motif_root   varchar(40),
  ADD COLUMN IF NOT EXISTS color_root   varchar(40),
  ADD COLUMN IF NOT EXISTS page_type    varchar(30),
  ADD COLUMN IF NOT EXISTS parent_ids  jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN materials.category     IS 'courseware=普通课件素材; decor_element=装饰元件; decor_component=元件组合';
COMMENT ON COLUMN materials.decor_facets IS '4维 facet 标签路径数组, 如 ["motif.国风","color.蓝系","page_type.cover"]';
COMMENT ON COLUMN materials.applicable   IS '媒介适用性: ppt | h5 | common (冗余自 facet, 便于索引)';
COMMENT ON COLUMN materials.motif_root   IS '母题一级 (冗余自 facet, 便于索引)';
COMMENT ON COLUMN materials.color_root   IS '色系一级 (冗余自 facet, 与 COLOR_FAMILIES 同源)';
COMMENT ON COLUMN materials.page_type    IS '适用页型: cover|content|summary|homework (冗余自 facet)';
COMMENT ON COLUMN materials.parent_ids   IS '组件指向其元件的 asset_id 数组';

CREATE INDEX IF NOT EXISTS idx_materials_category    ON materials (category);
CREATE INDEX IF NOT EXISTS idx_materials_applicable  ON materials (applicable);
CREATE INDEX IF NOT EXISTS idx_materials_motif_root  ON materials (motif_root);
CREATE INDEX IF NOT EXISTS idx_materials_color_root  ON materials (color_root);
CREATE INDEX IF NOT EXISTS idx_materials_page_type   ON materials (page_type);
CREATE INDEX IF NOT EXISTS idx_materials_facets_gin  ON materials USING gin (decor_facets);

-- 回滚 (如需):
-- ALTER TABLE materials
--   DROP COLUMN IF EXISTS category,
--   DROP COLUMN IF EXISTS decor_facets,
--   DROP COLUMN IF EXISTS applicable,
--   DROP COLUMN IF EXISTS motif_root,
--   DROP COLUMN IF EXISTS color_root,
--   DROP COLUMN IF EXISTS page_type,
--   DROP COLUMN IF EXISTS parent_ids;

