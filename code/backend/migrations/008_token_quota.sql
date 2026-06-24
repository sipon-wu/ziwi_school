-- 迁移 v8：Token 月配额体系
-- 设计依据：《产品战略讨论总结 2026-06-24》
-- 校方可批量设配额 + 教师端进度环 + 3级预警

-- 1. schools 表加默认 Token 月配额
ALTER TABLE schools ADD COLUMN IF NOT EXISTS default_token_quota BIGINT DEFAULT 0;

COMMENT ON COLUMN schools.default_token_quota IS '学校默认教师月Token配额，0=不限';

-- 2. users 表加配额字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_quota_monthly BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_quota_custom  BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_used_monthly   BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_reset_date     DATE DEFAULT NULL;

COMMENT ON COLUMN users.token_quota_monthly IS '教师月Token配额，0=不限';
COMMENT ON COLUMN users.token_quota_custom  IS '是否个性化配额（覆盖校默认值）';
COMMENT ON COLUMN users.token_used_monthly  IS '本月已消耗Token';
COMMENT ON COLUMN users.token_reset_date    IS '配额下次重置日期（通常为下月1日）';

-- 3. 为演示校教师设示例配额
UPDATE users SET token_quota_monthly = 500000, token_reset_date = date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
WHERE school_id = '00000000-0000-0000-0000-000000000001' AND role = 'teacher';

-- 4. 演示校默认配额 500000/月
UPDATE schools SET default_token_quota = 500000
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 5. 初始化本月已用量（从已有 token_usage 统计）
UPDATE users u SET token_used_monthly = (
    SELECT COALESCE(SUM(tu.total_tokens), 0)
    FROM token_usage tu
    WHERE tu.user_id = u.id
      AND tu.created_at >= date_trunc('month', CURRENT_DATE)
);
