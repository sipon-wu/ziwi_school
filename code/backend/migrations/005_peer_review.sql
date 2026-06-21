-- 迁移 v5：互审机制
-- 设计依据：《ziwi_school产品规格补充 v2.0》第11部分

CREATE TABLE IF NOT EXISTS lesson_reviews (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id      UUID REFERENCES lesson_plans(id) NOT NULL,
    reviewer_id  UUID REFERENCES users(id) NOT NULL,
    rating       VARCHAR(20) NOT NULL CHECK (rating IN ('recommend','improvable','neutral')),
    quick_feedback VARCHAR(200),
    detail_feedback TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (plan_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_plan ON lesson_reviews(plan_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON lesson_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_school ON lesson_reviews(plan_id);

COMMENT ON TABLE lesson_reviews IS '教师互审记录';
COMMENT ON COLUMN lesson_reviews.rating IS '评审评级：recommend=推荐, improvable=可改进, neutral=中立';
