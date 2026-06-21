-- 迁移 v6：内容安全审核
CREATE TABLE IF NOT EXISTS content_audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('text','image')),
    content_hash VARCHAR(64),
    audit_result VARCHAR(20) NOT NULL CHECK (audit_result IN ('pass','block','review')),
    risk_labels  JSONB DEFAULT '[]',
    risk_score  DECIMAL(5,2),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON content_audit_logs(user_id, created_at DESC);
