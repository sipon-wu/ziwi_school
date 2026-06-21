-- 迁移 v3：三模式体系（演示/体验/正式）
-- 设计依据：《ziwi_school产品规格补充 v2.0》

-- 1. schools 表加 mode 字段
ALTER TABLE schools ADD COLUMN IF NOT EXISTS work_mode VARCHAR(20) DEFAULT 'formal'
    CHECK (work_mode IN ('demo','trial','formal'));

ALTER TABLE schools ADD COLUMN IF NOT EXISTS trial_days    INT DEFAULT 14;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS trial_quota   BIGINT DEFAULT 100000;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS trial_started TIMESTAMPTZ;

COMMENT ON COLUMN schools.work_mode     IS '工作模式: demo/演示 trial/试用 formal/正式';
COMMENT ON COLUMN schools.trial_days    IS '试用天数';
COMMENT ON COLUMN schools.trial_quota   IS '试用Token配额';
COMMENT ON COLUMN schools.trial_started IS '试用开始时间';

-- 2. 数据作用域表（控制不同模式下数据的可见性）
CREATE TABLE IF NOT EXISTS data_scopes (
    mode_name   VARCHAR(20) PRIMARY KEY,
    description VARCHAR(200),
    demo_shared_readonly  BOOLEAN DEFAULT true,   -- 演示标准数据只读共享
    sales_personal_part   BOOLEAN DEFAULT true,   -- 销售操作数据按人隔离
    trial_shared_readonly BOOLEAN DEFAULT true,   -- 体验标准数据只读共享
    trial_ugc_per_user    BOOLEAN DEFAULT true,   -- 体验UGC按用户隔离
    tenant_per_tenant     BOOLEAN DEFAULT true,   -- 租户间隔离
    token_quota_enforced  BOOLEAN DEFAULT false,  -- Token配额管控
    data_persistent       BOOLEAN DEFAULT true,   -- 数据持久化
    data_reset_daily      BOOLEAN DEFAULT false,  -- 日终重置数据
    allow_self_register   BOOLEAN DEFAULT false   -- 允许自行注册
);

INSERT INTO data_scopes (mode_name, description, demo_shared_readonly, sales_personal_part, trial_shared_readonly, trial_ugc_per_user, tenant_per_tenant, token_quota_enforced, data_persistent, data_reset_daily, allow_self_register) VALUES
    ('demo',   '演示模式：销售向客户展示',   true,  true,  false, false, false, false, false, true,  false),
    ('trial',  '体验模式：意向用户试用',    false, false, true,  true,  true,  true,  true,  false, true),
    ('formal', '正式模式：学校采购使用',    false, false, false, false, true,  true,  true,  false, false)
ON CONFLICT (mode_name) DO NOTHING;

-- 3. 用户表加账号类型（区分预设销售号 / 自行注册 / 学校管理员创建）
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_source VARCHAR(20) DEFAULT 'admin_created'
    CHECK (account_source IN ('preset_sales','self_registered','admin_created','trial_created'));

COMMENT ON COLUMN users.account_source IS '账号来源：preset_sales=预设销售号, self_registered=自行注册, admin_created=管理员创建, trial_created=试用创建';

-- 4. 演示学校初始化（模式 = demo）
INSERT INTO schools (id, name, region, work_mode, ai_model_tier, allow_model_switch, show_model_ui)
VALUES ('00000000-0000-0000-0000-000000000001', '知微演示校', '北京', 'demo', 'qwen-max', false, true)
ON CONFLICT (id) DO UPDATE SET work_mode = 'demo';

-- 5. 升级已有教师为预设销售账号
UPDATE users SET account_source = 'preset_sales' 
WHERE school_id = '00000000-0000-0000-0000-000000000001' AND role = 'teacher';

-- 6. 经验演示账号使用 admin_created
UPDATE users SET account_source = 'admin_created' 
WHERE role = 'admin' AND account_source IS NULL;
