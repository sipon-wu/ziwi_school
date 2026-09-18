-- 0010_ensure_audit_logs.sql
-- 让 `audit_logs` 表在**存量库**上自愈（2026-09-18）。
--
-- 背景（实测事故级缺口）：该表定义在 **001 基线**（001_init_schema.up.sql）里，而 deploy.sh 只应用
-- `NNNN_*.sql` 增量迁移、**显式跳过 001 基线**（见脚本注释：基线是"从零建库"用的）——
-- 于是任何"建库时没跑到这条 DDL"的库（实测 staging 就是这样）**永远缺这张表**。
-- 更糟的是审计写入用的是 `_ = repo.Write(...)`（吞错）：
-- 实测 staging `SELECT count(*) FROM audit_logs` → `relation "audit_logs" does not exist`，
-- 即 IT 的教材版本增/改/删/导入**一条审计都没留下**，而且没有任何报错。
--
-- 处置：以幂等 DDL 补表（IF NOT EXISTS），让存量库自愈、不依赖重跑基线。
-- 注意：Go 侧写入审计字段用 `details`；`ip_address` / `user_agent` 已在表内预留（当前未写）。
CREATE TABLE IF NOT EXISTS audit_logs (
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school ON audit_logs(school_id, created_at DESC);
