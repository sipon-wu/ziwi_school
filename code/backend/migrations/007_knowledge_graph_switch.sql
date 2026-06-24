-- 迁移 v7：知识图谱两层开关
-- 设计依据：《产品战略讨论总结 2026-06-24》
-- 学校总开关 OFF → 教师开关置灰 → 教师可申请开启

-- 1. schools 表加知识图谱总开关
ALTER TABLE schools ADD COLUMN IF NOT EXISTS enable_knowledge_graph BOOLEAN DEFAULT false;

COMMENT ON COLUMN schools.enable_knowledge_graph IS '学校级知识图谱功能总开关，关闭时教师端开关置灰';

-- 2. 演示学校默认开启（保证演示效果）
UPDATE schools SET enable_knowledge_graph = true
WHERE id = '00000000-0000-0000-0000-000000000001';
