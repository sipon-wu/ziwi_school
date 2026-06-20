-- 知微AI教学助手 — 数据库迁移 v1
-- 初始化核心表结构

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 学校（租户）
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    region VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id),
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('teacher','student','parent','admin')),
    name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    grade VARCHAR(20),
    subject VARCHAR(20),
    parent_student_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 班级
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) NOT NULL,
    name VARCHAR(100) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 教师-班级-科目关联
CREATE TABLE IF NOT EXISTS teacher_classes (
    teacher_id UUID REFERENCES users(id),
    class_id UUID REFERENCES classes(id),
    subject VARCHAR(20) NOT NULL,
    PRIMARY KEY (teacher_id, class_id, subject)
);

-- 学生-班级关联
CREATE TABLE IF NOT EXISTS student_classes (
    student_id UUID REFERENCES users(id),
    class_id UUID REFERENCES classes(id),
    PRIMARY KEY (student_id, class_id)
);

-- 教案
CREATE TABLE IF NOT EXISTS lesson_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES users(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    subject VARCHAR(20) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    textbook_unit VARCHAR(200),
    lesson_title VARCHAR(300) NOT NULL,
    period INT DEFAULT 1,
    content JSONB NOT NULL DEFAULT '{}',
    curriculum_alignments JSONB DEFAULT '[]',
    format_template VARCHAR(50) DEFAULT 'core_literacy',
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_model_version VARCHAR(50),
    generation_time_ms INT,
    manual_edited BOOLEAN DEFAULT FALSE,
    edit_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','final')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher ON lesson_plans(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_school ON lesson_plans(school_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_subject_grade ON lesson_plans(school_id, subject, grade, created_at DESC);

-- 作业
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES users(id) NOT NULL,
    class_id UUID REFERENCES classes(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    subject VARCHAR(20) NOT NULL,
    title VARCHAR(300) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('exercise','composition','exam','writing_game')),
    questions JSONB NOT NULL DEFAULT '[]',
    difficulty_level VARCHAR(5) DEFAULT 'L2',
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id, created_at DESC);

-- 学生提交
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES assignments(id) NOT NULL,
    student_id UUID REFERENCES users(id) NOT NULL,
    answers JSONB NOT NULL DEFAULT '[]',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id, submitted_at DESC);

-- 批阅结果
CREATE TABLE IF NOT EXISTS grading_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES submissions(id) NOT NULL,
    question_id VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL,
    ai_score DECIMAL(5,2),
    ai_confidence DECIMAL(4,3),
    teacher_score DECIMAL(5,2),
    teacher_adjusted BOOLEAN DEFAULT FALSE,
    ai_feedback TEXT,
    teacher_comment TEXT,
    composition_scores JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','ai_graded','teacher_confirmed','parent_signed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grading_status ON grading_results(status, submission_id);
CREATE INDEX IF NOT EXISTS idx_grading_submission ON grading_results(submission_id);

-- 家长签字
CREATE TABLE IF NOT EXISTS parent_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES users(id) NOT NULL,
    student_id UUID REFERENCES users(id) NOT NULL,
    assignment_id UUID REFERENCES assignments(id) NOT NULL,
    signature_img_url VARCHAR(500),
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    notified_at TIMESTAMPTZ,
    UNIQUE (parent_id, assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_signatures_assignment ON parent_signatures(assignment_id);

-- 课标向量表
CREATE TABLE IF NOT EXISTS curriculum_standards (
    id VARCHAR(50) PRIMARY KEY,
    subject VARCHAR(20) NOT NULL,
    stage VARCHAR(20) NOT NULL,
    domain VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    competency_dimension VARCHAR(100),
    quality_standard TEXT,
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_subject ON curriculum_standards(subject, stage);

-- 审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_role VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    detail JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);
