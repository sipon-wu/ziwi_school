-- 0011_users_profile_columns.sql
-- 修「账号设置保存 500」（= QA_BugList_20260707 的 B002/B003，07-07 挂到现在，2026-09-27 收口）。
--
-- 根因（实测：后端日志 `column "region" of relation "users" does not exist (SQLSTATE 42703)`）：
--   `PUT /api/user/profile` 的字段白名单**直接当列名**用（auth_handler.go UpdateProfile → userRepo.UpdateUser(map)），
--   但 `users` 表**从来没有** `gender` / `region` 两列 —— 注意 001 基线里的 `region` 是 **`schools.region`**（学校表），
--   `users.gender` / `users.region` 在**任何迁移里都不存在**（Go 模型也没有这两个字段）。
--   于是教师只要编辑「性别」或「地区」，PG 立刻 42703 → 接口 500 → 前端弹「保存资料失败」。
--   （头像 `avatar` 是同类问题：白名单写 `avatar`，真实列名是 `avatar_url` → 也在 500 之列。）
--
-- 处置：
--   ① 本迁移补列（幂等，可重复执行）；
--   ② 代码侧把 `avatar` 映射改到真实列 `avatar_url`（**不是**再加一个 `avatar` 列——同一语义不留两列）。
--
-- 注意：本文件是**增量迁移**（deploy.sh 只跑 `NNNN_*.sql`、显式跳过 001 基线），
--       所以"基线里有、存量库没有"类的缺口必须像这样用增量补。
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS region VARCHAR(100);
