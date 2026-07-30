-- ═══════════════════════════════════════════
-- 知微教学平台 · 初始表结构
-- 版本：001 | 日期：2026-07-04
-- ═══════════════════════════════════════════

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 学校（租户） ──
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(200) NOT NULL,
    short_name VARCHAR(100),
    system_type VARCHAR(10) DEFAULT '六三制',
    region VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    license_expires_at TIMESTAMPTZ,
    token_quota BIGINT DEFAULT 0,
    token_used BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 用户（8种校内角色 + 2种平台角色 + 学生 + 家长） ──
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN (
        'teacher', 'head_teacher', 'research_lead',
        'registrar', 'principal', 'it_admin',
        'platform_ops', 'platform_devops',
        'student', 'parent'
    )),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(200),
    avatar_url VARCHAR(500),
    wechat_openid VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    phone_updated_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    successor_id UUID REFERENCES users(id),
    style_profile JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 班级 ──
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) NOT NULL,
    name VARCHAR(100) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    class_type VARCHAR(20) DEFAULT 'normal',
    head_teacher_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_class_head_teacher ON classes(head_teacher_id) WHERE head_teacher_id IS NOT NULL;

-- ── 教师-班级-学科关联 ──
CREATE TABLE teacher_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES users(id) NOT NULL,
    class_id UUID REFERENCES classes(id) NOT NULL,
    subject VARCHAR(20) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (teacher_id, class_id, subject)
);

-- ── 学生-班级关联 ──
CREATE TABLE student_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) NOT NULL,
    class_id UUID REFERENCES classes(id) NOT NULL,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, class_id)
);

-- ── 家长-学生关联 ──
CREATE TABLE parent_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES users(id) NOT NULL,
    student_id UUID REFERENCES users(id) NOT NULL,
    relationship VARCHAR(20) DEFAULT 'parent',
    is_primary BOOLEAN DEFAULT TRUE,
    UNIQUE (parent_id, student_id)
);

-- ── 教材版本 ──
CREATE TABLE textbook_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    subject VARCHAR(20) NOT NULL,
    grade VARCHAR(20),
    publisher VARCHAR(100) NOT NULL,
    version_name VARCHAR(200) NOT NULL,
    scope VARCHAR(20) DEFAULT 'school',
    status VARCHAR(20) DEFAULT 'active',
    submitted_by UUID REFERENCES users(id),
    source_pdf_url VARCHAR(500),
    auto_extracted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 教案 ──
CREATE TABLE lesson_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES users(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    class_id UUID REFERENCES classes(id),
    subject VARCHAR(20) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    textbook_version_id UUID REFERENCES textbook_versions(id),
    title VARCHAR(12) NOT NULL,
    unit VARCHAR(100),
    lesson_period INT DEFAULT 1,
    template_type VARCHAR(50) DEFAULT 'core_literacy',
    content JSONB NOT NULL,
    knowledge_nodes UUID[],
    custom_tags VARCHAR(50)[],
    curriculum_alignments JSONB,
    supplement_text TEXT,
    material_refs UUID[],
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_model_version VARCHAR(50),
    ai_generation_basis JSONB,
    generation_time_ms INT,
    edit_count INT DEFAULT 0,
    last_edited_at TIMESTAMPTZ,
    review_status VARCHAR(20) DEFAULT 'none',
    reviewer_id UUID REFERENCES users(id),
    review_comment TEXT,
    reviewed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lesson_plans_teacher ON lesson_plans(teacher_id, updated_at DESC);
CREATE INDEX idx_lesson_plans_school ON lesson_plans(school_id);
CREATE INDEX idx_lesson_plans_subject ON lesson_plans(school_id, subject, grade);
CREATE INDEX idx_lesson_plans_status ON lesson_plans(school_id, status);
CREATE INDEX idx_lesson_plans_review ON lesson_plans(reviewer_id, review_status);

-- ── 教案审核分配 ──
CREATE TABLE review_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_plan_id UUID REFERENCES lesson_plans(id) NOT NULL,
    assign_method VARCHAR(20) NOT NULL,
    reviewer_id UUID REFERENCES users(id),
    assigner_id UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (lesson_plan_id)
);
CREATE INDEX idx_review_assignment_reviewer ON review_assignments(reviewer_id);

-- ── 题目 ──
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES users(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    subject VARCHAR(20) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    stem TEXT NOT NULL,
    answer TEXT NOT NULL,
    analysis TEXT,
    question_type VARCHAR(20) NOT NULL,
    score DECIMAL(5,2) DEFAULT 0,
    knowledge_nodes UUID[],
    difficulty VARCHAR(5) DEFAULT 'L2',
    discrimination DECIMAL(4,3),
    source VARCHAR(50) DEFAULT 'original',
    use_count INT DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_questions_school ON questions(school_id, subject, grade);
CREATE INDEX idx_questions_difficulty ON questions(school_id, difficulty);

-- ── 试卷 ──
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES users(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    title VARCHAR(200) NOT NULL,
    subject VARCHAR(20) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    total_score DECIMAL(6,2) DEFAULT 100,
    duration_minutes INT DEFAULT 60,
    questions JSONB NOT NULL,
    knowledge_coverage JSONB,
    difficulty_distribution JSONB,
    layout_config JSONB,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 作业 ──
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES users(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    class_id UUID REFERENCES classes(id) NOT NULL,
    subject VARCHAR(20) NOT NULL,
    title VARCHAR(300) NOT NULL,
    assignment_type VARCHAR(20) NOT NULL,
    questions JSONB NOT NULL,
    total_score DECIMAL(6,2),
    due_type VARCHAR(10) DEFAULT 'relative',
    due_hours INT,
    due_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    grading_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 学生提交 ──
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES assignments(id) NOT NULL,
    student_id UUID REFERENCES users(id) NOT NULL,
    answers JSONB NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (assignment_id, student_id)
);

-- ── 批阅结果 ──
CREATE TABLE grading_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES submissions(id) NOT NULL,
    question_id UUID NOT NULL,
    ai_score DECIMAL(5,2),
    ai_confidence DECIMAL(4,3),
    teacher_score DECIMAL(5,2),
    teacher_adjusted BOOLEAN DEFAULT FALSE,
    ai_feedback TEXT,
    teacher_comment TEXT,
    composition_scores JSONB,
    handwriting_confidence DECIMAL(4,3),
    status VARCHAR(20) DEFAULT 'pending',
    graded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_grading_low_conf ON grading_results(ai_confidence, status)
    WHERE status = 'ai_graded' AND ai_confidence < 0.85;

-- ── 素材库 ──
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES users(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    subject VARCHAR(20),
    grade VARCHAR(20),
    title VARCHAR(200) NOT NULL,
    material_type VARCHAR(30) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    ai_tags JSONB,
    groups VARCHAR(50)[],
    heat_level INT DEFAULT 1,
    reference_count INT DEFAULT 0,
    is_shared BOOLEAN DEFAULT FALSE,
    share_scope VARCHAR(20) DEFAULT 'private',
    version INT DEFAULT 1,
    previous_version_id UUID REFERENCES materials(id),
    copyright_type VARCHAR(20) DEFAULT 'original',
    copyright_source VARCHAR(200),
    resource_level VARCHAR(5) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_materials_school ON materials(school_id, subject, grade);

-- ── 家校：家长签字 ──
CREATE TABLE parent_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES users(id) NOT NULL,
    student_id UUID REFERENCES users(id) NOT NULL,
    assignment_id UUID REFERENCES assignments(id) NOT NULL,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    reminded_at TIMESTAMPTZ,
    UNIQUE (parent_id, assignment_id, student_id)
);

-- ── 家校：成长关爱记录 ──
CREATE TABLE growth_care_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) NOT NULL,
    teacher_id UUID REFERENCES users(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    current_status TEXT NOT NULL,
    data_basis JSONB,
    ai_assessment TEXT,
    teacher_observation TEXT,
    weekly_plan JSONB,
    plan_status VARCHAR(20) DEFAULT 'draft',
    kindness_reviewed BOOLEAN DEFAULT FALSE,
    kindness_reviewed_at TIMESTAMPTZ,
    parent_notified BOOLEAN DEFAULT FALSE,
    parent_confirmed BOOLEAN DEFAULT FALSE,
    parent_comment TEXT,
    teacher_group VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 学生观察记录 ──
CREATE TABLE student_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) NOT NULL,
    teacher_id UUID REFERENCES users(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    description TEXT NOT NULL,
    context VARCHAR(200),
    observed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_observations_student ON student_observations(student_id, observed_at DESC);

-- ── 方法论贡献 ──
CREATE TABLE methodology (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id UUID REFERENCES users(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    subject VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    ai_identified BOOLEAN DEFAULT FALSE,
    ai_summary TEXT,
    review_status VARCHAR(20) DEFAULT 'pending',
    research_reviewer_id UUID REFERENCES users(id),
    research_reviewed_at TIMESTAMPTZ,
    platform_reviewer_id UUID REFERENCES users(id),
    platform_reviewed_at TIMESTAMPTZ,
    share_scope VARCHAR(20) DEFAULT 'school',
    attribution VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 错题本 ──
CREATE TABLE wrong_question_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    question_id UUID REFERENCES questions(id) NOT NULL,
    assignment_id UUID REFERENCES assignments(id) NOT NULL,
    submission_id UUID REFERENCES submissions(id) NOT NULL,
    student_answer TEXT,
    correct_answer TEXT NOT NULL,
    knowledge_node_id UUID,
    wrong_type VARCHAR(30),
    difficulty VARCHAR(5),
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    similar_error_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_wrong_book_student ON wrong_question_books(student_id, collected_at DESC);
CREATE INDEX idx_wrong_book_question ON wrong_question_books(question_id);

-- ── 通知 ──
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    school_id UUID REFERENCES schools(id) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    notification_type VARCHAR(30) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    link_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

-- ── 公告 ──
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    publisher_id UUID REFERENCES users(id) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    scope VARCHAR(20) DEFAULT 'school',
    is_pinned BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 审计日志 ──
CREATE TABLE audit_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR REFERENCES users(id),
    school_id VARCHAR REFERENCES schools(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_school ON audit_logs(school_id, created_at DESC);
