-- 知微AI教学助手 — 数据库迁移 010
-- 题库重构：题目独立表 + 评分体系 + 作业-题目关联

-- 题目表（独立实体，可复用）
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES users(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    subject VARCHAR(20) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    semester VARCHAR(10) DEFAULT '上学期',
    textbook_version VARCHAR(100),
    chapter_unit VARCHAR(200),
    knowledge_points JSONB NOT NULL DEFAULT '[]',
    type VARCHAR(20) NOT NULL,
    difficulty VARCHAR(5) NOT NULL DEFAULT 'L2',
    content TEXT NOT NULL,
    options JSONB DEFAULT '[]',
    answer TEXT,
    answer_detail TEXT,
    source VARCHAR(20) NOT NULL DEFAULT 'ai_generated',
    source_prompt TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    audit_status VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (audit_status IN ('none','pending','approved','rejected')),
    auditor_id UUID REFERENCES users(id),
    contributed_at TIMESTAMPTZ,
    usage_count INT NOT NULL DEFAULT 0,
    avg_rating DECIMAL(3,2) NOT NULL DEFAULT 0,
    rating_count INT NOT NULL DEFAULT 0,
    correct_rate DECIMAL(5,2),
    auto_tags JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 题目评分表（教师用过才有资格评）
CREATE TABLE IF NOT EXISTS question_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES questions(id) NOT NULL,
    teacher_id UUID REFERENCES users(id) NOT NULL,
    assignment_id UUID REFERENCES assignments(id) NOT NULL,
    score INT NOT NULL CHECK (score >= 1 AND score <= 5),
    tags JSONB NOT NULL DEFAULT '[]',
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(question_id, teacher_id, assignment_id)
);

-- 作业-题目关联表（替代旧 JSONB 内嵌）
CREATE TABLE IF NOT EXISTS assignment_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES assignments(id) NOT NULL,
    question_id UUID REFERENCES questions(id) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE(assignment_id, question_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_questions_teacher ON questions(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_school ON questions(school_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject_grade ON questions(school_id, subject, grade);
CREATE INDEX IF NOT EXISTS idx_questions_public ON questions(school_id, is_public, audit_status);
CREATE INDEX IF NOT EXISTS idx_questions_type_diff ON questions(school_id, subject, type, difficulty);
CREATE INDEX IF NOT EXISTS idx_question_ratings_question ON question_ratings(question_id);
CREATE INDEX IF NOT EXISTS idx_assignment_questions_assignment ON assignment_questions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_questions_question ON assignment_questions(question_id);

-- 知识图谱扩展字段补充（如果之前漏了）
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS knowledge_node_ids JSONB NOT NULL DEFAULT '[]';
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS knowledge_node_ids JSONB NOT NULL DEFAULT '[]';

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_questions_updated_at ON questions;
CREATE TRIGGER update_questions_updated_at
    BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
