-- 0012: AI 生成留痕表（P1 受控编排 S0–S5 的"逐次留痕"落点，2026-09-27）
--
-- 为什么**新建表**而不是复用 audit_logs：
--   · `audit_logs` 是**操作审计**——"谁对什么做了什么"，details 是短文本；回答的是**追责**。
--   · 本表是**过程留痕**——六步步骤、工具入参/结果摘要、每轮耗时、三关质检分数；回答的是
--     "这份课件**是怎么生成出来的**"（P1 DoD：留痕含工具调用参数与质检分数、断点可回放）。
--   两者频率与体积差一个量级，混表会同时拖累审计语义与容量。互补关系：一个答"谁改的"，一个答"怎么来的"。
--
-- 幂等：`IF NOT EXISTS` —— 部署脚本会重复执行迁移目录（且**跳过 001 基线**，见 0010 的说明），
-- 故新表必须自带幂等，不能依赖"只跑一次"。
CREATE TABLE IF NOT EXISTS ai_generation_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           TEXT,                    -- 生成任务 id（前端生成时传入；留痕与 SSE 用它对齐）
  school_id        TEXT,
  user_id          TEXT,
  skill_id         TEXT,                    -- SKILL.md frontmatter 的 id（声明层，非代码写死）
  skill_version    TEXT,                    -- 同上：留痕要能回答"这次用的是哪个版本的技能"
  pipeline_version TEXT,                    -- 流水线版本（步骤/口径变更时可区分新旧产物）
  steps            JSONB,                   -- S0–S5：id/名称/说明/耗时/数据
  tool_calls       JSONB,                   -- template.query / asset.search 的**入参**与结果摘要
  rounds           JSONB,                   -- 每轮生成：attempt/role/model/ms/chars
  quality          JSONB,                   -- 三关质检分数 + 锚点覆盖率
  status           TEXT,                    -- ok | warn（有 ERR 违规）| error
  duration_ms      INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_gen_logs_job ON ai_generation_logs (job_id);
CREATE INDEX IF NOT EXISTS idx_ai_gen_logs_created ON ai_generation_logs (created_at DESC);
