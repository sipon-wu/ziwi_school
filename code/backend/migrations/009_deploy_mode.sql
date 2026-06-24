-- 迁移 v9：SaaS/私有部署模式区分
-- 设计依据：《产品战略讨论总结 2026-06-24》
-- SaaS：手机号+验证码/密码登录，可自注册
-- 私有部署：用户名+密码登录，管理员创建账号，无自注册

-- 1. users 表加 username 字段（私有部署用）
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE users ADD UNIQUE INDEX IF NOT EXISTS idx_users_username (username);

COMMENT ON COLUMN users.username IS '用户名（私有部署模式登录用，SaaS模式可选）';

-- 2. 演示校管理员设置 username（私有部署演示用）
UPDATE users SET username = 'admin' WHERE phone = '13800000001' AND username IS NULL;
UPDATE users SET username = 'teacher' WHERE phone = '13800000002' AND username IS NULL;

-- 3. phone 字段在私有部署模式可空（username 替代标识）
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
