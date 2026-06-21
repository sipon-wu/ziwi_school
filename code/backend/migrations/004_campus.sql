-- 迁移 v4：学校管理后台（分校 + 批量导入 + 教学检查）
-- 设计依据：《ziwi_school产品规格补充 v2.0》第6部分（IT负责人/教务管理员）

-- 1. 分校表
CREATE TABLE IF NOT EXISTS campuses (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) NOT NULL,
    name      VARCHAR(200) NOT NULL,
    grades    JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (school_id, name)
);
CREATE INDEX IF NOT EXISTS idx_campuses_school ON campuses(school_id);

COMMENT ON COLUMN campuses.grades IS '年级范围配置，JSON数组如: ["一年级","二年级","三年级"]';

-- 2. 班级关联到分校
ALTER TABLE classes ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES campuses(id);
COMMENT ON COLUMN classes.campus_id IS '所属分校';

-- 3. 教材版本配置表（后续第4项用）
CREATE TABLE IF NOT EXISTS textbook_versions (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) NOT NULL,
    subject   VARCHAR(20) NOT NULL,
    grade     VARCHAR(20) NOT NULL,
    publisher  VARCHAR(100) NOT NULL,
    version    VARCHAR(100),
    curriculum_ref VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (school_id, subject, grade)
);
CREATE INDEX IF NOT EXISTS idx_textbook_school ON textbook_versions(school_id);

-- 4. 课程课标对照表
CREATE TABLE IF NOT EXISTS curriculum_mapping (
    id          VARCHAR(50) PRIMARY KEY,
    subject     VARCHAR(20) NOT NULL,
    grade       VARCHAR(20) NOT NULL,
    publisher   VARCHAR(100),
    textbook_version VARCHAR(100),
    standard_code VARCHAR(50) NOT NULL,
    standard_content TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_curriculum_map_subject ON curriculum_mapping(subject, grade);

COMMENT ON TABLE curriculum_mapping IS '教材→课标对照关系，支撑自动提示';
