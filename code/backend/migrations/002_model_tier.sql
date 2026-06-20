-- 知微AI教学助手 — 迁移 v2：租户模型档位 + 费率表
-- 执行方式: 自动通过 Docker entrypoint 加载

-- 1. 学校表加模型策略字段
ALTER TABLE schools ADD COLUMN IF NOT EXISTS ai_model_tier      VARCHAR(50) DEFAULT 'qwen-plus'
    CHECK (ai_model_tier IN ('qwen-turbo','qwen-plus','qwen-max'));
ALTER TABLE schools ADD COLUMN IF NOT EXISTS allow_model_switch BOOLEAN DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS show_model_ui      BOOLEAN DEFAULT false;

COMMENT ON COLUMN schools.ai_model_tier      IS '运营指定的模型档位，租户不可自主修改';
COMMENT ON COLUMN schools.allow_model_switch IS '租户是否能自主切换模型';
COMMENT ON COLUMN schools.show_model_ui      IS '前端是否展示模型切换入口';

-- 2. Token 用量表（如果之前没建）
CREATE TABLE IF NOT EXISTS token_usage (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id        UUID REFERENCES schools(id),
    user_id          UUID NOT NULL,
    api_type         VARCHAR(50) NOT NULL,
    model_name       VARCHAR(50) NOT NULL,
    prompt_tokens    INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_tokens     INT DEFAULT 0,
    cost_estimate    DECIMAL(10,6) DEFAULT 0,
    response_time_ms INT,
    status           VARCHAR(20) DEFAULT 'success',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_token_usage_school ON token_usage(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model_name);

-- 3. 模型费率表（运营可实时调价，无需重启）
CREATE TABLE IF NOT EXISTS model_rates (
    model_name   VARCHAR(50) PRIMARY KEY,
    input_price  DECIMAL(10,6) NOT NULL COMMENT '元/百万Tokens',
    output_price DECIMAL(10,6) NOT NULL COMMENT '元/百万Tokens',
    description  VARCHAR(200),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 插入官方公开价（2026年6月实时）
INSERT INTO model_rates (model_name, input_price, output_price, description) VALUES
    ('qwen-turbo',      0.300,  0.600, '轻量对话、意图识别'),
    ('qwen-plus',       0.800,  2.000, '主力文本生成（默认）'),
    ('qwen-max',        2.400,  9.600, '旗舰文本生成'),
    ('qwen-vl-plus',    0.800,  2.000, '基础视觉理解'),
    ('qwen-vl-max',     1.600,  4.000, '旗舰视觉理解'),
    ('qwen-math-plus',  4.000, 12.000, '数学专项出题批改')
ON CONFLICT (model_name) DO UPDATE SET
    input_price  = EXCLUDED.input_price,
    output_price = EXCLUDED.output_price,
    updated_at   = NOW();

-- 4. 运营公告表（如果之前没建）
CREATE TABLE IF NOT EXISTS announcements (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       VARCHAR(200) NOT NULL,
    content     TEXT,
    target_role VARCHAR(20) DEFAULT 'all',
    pinned      BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 初始化演示学校（运营用）
INSERT INTO schools (id, name, region, ai_model_tier, allow_model_switch, show_model_ui)
VALUES ('00000000-0000-0000-0000-000000000001', '知微演示校', '北京', 'qwen-max', false, true)
ON CONFLICT (id) DO UPDATE SET
    ai_model_tier      = 'qwen-max',
    allow_model_switch = false,
    show_model_ui      = true;
