-- Token 用量追踪表
CREATE TABLE IF NOT EXISTS token_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID,
    user_id UUID NOT NULL,
    api_type VARCHAR(50) NOT NULL,       -- lesson_plan / exam / grading / composition / chat
    model_name VARCHAR(50) NOT NULL,      -- qwen-plus / qwen-vl-plus / qwen-turbo
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    cost_estimate DECIMAL(10,6) DEFAULT 0, -- 预估费用（元）
    response_time_ms INT,
    status VARCHAR(20) DEFAULT 'success',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_school ON token_usage(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_user  ON token_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_type  ON token_usage(api_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_time  ON token_usage(created_at DESC);
