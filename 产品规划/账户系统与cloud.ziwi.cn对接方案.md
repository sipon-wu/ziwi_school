# 知微教学（school.ziwi.cn）账户系统对接 cloud.ziwi.cn 方案

> 版本：v0.6（对齐 mfg v0.3 契约基线：license_exp 不进 JWT、products 为字符串数组、roles 走本地）｜日期：2026-07-27
> **v0.6 变更（2026-07-27 用户拍板）**：以 `ziwi-integration-contracts/contracts/mfg接入cloud接口契约.md` v0.3（2026-07-10 已闭环）+ cloud 源码实况（`jwt_service.py`）为权威基线，修正本文档残留的 v0.1 旧写法：① cloud JWT claims = `sub/email/tenant_id/products[]/iat/exp`，**不含 `license_exp`**；② `products[]` 是**字符串数组**（如 `["school","mfg"]`），**无 `products[].roles/license_exp` 对象结构**；③ 角色走各产品本地体系；④ License 权威源 = cloud **License 服务/DB**（Phase 2 待建），本地 `LicenseStatus/LicenseExpiresAt` 为运行时判据 + 私有部署/断网兜底。受影响段落：§1.4、§3.3、§3.4、§3.5、§12。
> 历史变更：v0.4 完成 cloud IdP 对接（公钥验签 + CloudLogin 邮箱登录）后，手机号短信验证码通道、微信登录两项正式纳入统一认证路线图，见 §9、§10；改造清单 §4、待拍板 §5 同步更新。2026-07-16 方案定稿：短信服务商定腾讯云、微信登录定范围（仅 Web 扫码）、身份归属定 school 自管，三项均仅规划不实现；§12 新增 mfg 跨产品线统一认证决策（租户管理员/财务/SaaS 用户纳入 cloud 认证，同构 school 策略）。v0.5.1：§8.1 补入「注册·租户·计费」专题文档双向引用。
> 依据：
> - `cloud运营与运维/multi-product-platform-integration.md` v0.1（cloud 统一 IdP 总体说明）
> - ziwi_school 代码现状（models.go / auth_handler.go / middleware/auth.go / rbac.go / frontend api.ts）
> - `产品规划/域名规划` v2.1（定稿，school 侧对接以此为准）
> - `cloud运营与运维/blazing-pulse-turing.md`（V2.0 域名策略可执行性评估 7/10；V2.1 已吸收其主要断裂，见第 7 节）
> - mfg 团队 `cloud-jwt-integration-guide.md` v1.0（姊妹产品线的 cloud JWT 集成指南，school 侧参考对齐）

---

## 0. 背景与目标

cloud.ziwi.cn 已定位为**统一身份与授权平台（IdP）**：统一登录、签发 RS256 JWT（含 `tenant_id` + `products[]` claims）、统管 License/Token/财务/发票；各产品线（mfg/school/...）信任 cloud JWT，**不自签**业务 token。该总体方案见 `multi-product-platform-integration.md`，其第 8 节明确列出"待 school 团队评审的问题"。

**姊妹产品线说明**：school（知微教学）与 mfg（mfg.ziwi.cn，智能制造 / 工业化生产数字化服务系统）是 cloud 旗下**同架构、不同领域**的两条产品线——两者都是 TO B（学校/制造企业租户）+ TO C（教师学生 / 一线工人与管理者）混合架构，仅业务领域不同。本方案是 school 侧对 cloud 的对接答复；mfg 侧有对应的姊妹方案，账户系统的对接契约（信任模型、租户映射、License/Token 对账）应保持一致，以便跨产品线复用 cloud 能力。

**为什么现在必须插入本方案**：ziwi_school 当前账户系统（HS256 自签 JWT + 自有 User/School 表）与 cloud 之间**没有任何对接契约**。一旦多校区（A1：同 School + CampusID）、B2C 个人版、私有部署 License 心跳等能力扩出，没有这套契约，账户系统会被反复返工。

**目标**：
1. 回答 cloud 文档第 8 节的评审问题（基于真实代码）。
2. 定义 school 侧对接契约（信任模型、用户映射、租户隔离、角色、License、Token）。
3. 给出可落地的改造清单（P0/P1/P2），对齐 cloud 文档第 7.1 节。

---

## 1. school 当前账户系统现状（证据）

### 1.1 用户模型
- `model.User`（`code/backend/internal/model/models.go:36-56`）：
  - 主键 `ID`（zw_ 前缀短 ID）、`SchoolID`（*string，学校即租户）、`Phone`（unique，登录主键）、`PasswordHash`（bcrypt）、`Role`、`Name`、`Email`、`CampusID`（多校区 A1）、`StudentNumber`、`Status`。
  - **无 `cloud_user_id` 字段**。
- `model.School`（`models.go:21-33`）：租户实体，本地字段 `LicenseExpiresAt` / `TokenQuota` / `TokenUsed` 已存在（本地 License 与 Token 配额）。

### 1.2 认证实现
- 登录（`auth_handler.go:53-114`）：手机号 + 密码（bcrypt 校验）→ 签发 **HS256** JWT。
- `generateToken`（`auth_handler.go:159-171`）：claims = `{sub: user.ID, role, school_id, name, exp(+2h), iat}`，密钥为对称 `jwtSecret`。
- 中间件 `JWTAuth`（`middleware/auth.go:11-50`）：验证 HS256，注入 `user_id / user_role / school_id` 到 context。
- 前端（`frontend/src/lib/api.ts:6-18`）：token 存 `localStorage('zhiwei_token')`；已支持 401（过期跳登录）、402/429（Token 不足弹窗）。

### 1.3 角色矩阵
- `rbac.go:40-86`：RoleMatrix 定义 8 角色，**已内置平台角色 `platform_ops` / `platform_devops`**——即 school 当前自己管理平台运营/运维账号。

### 1.4 现状小结
| 维度 | 现状 | 与 cloud 的差异 |
|------|------|----------------|
| 签名算法 | HS256（对称） | cloud 用 RS256（非对称，公钥可分发） |
| Token 语义 | `school_id` + `role` | cloud 用 `tenant_id` + `products[]`（字符串数组，如 `["school"]`；roles 不进 JWT，走各产品本地体系） |
| 用户标识 | `sub`=zw_ ID，`phone` 主键 | cloud 用 `sub`=UUID，`email` 匹配键 |
| 平台角色 | school 自建 `platform_ops/devops` | cloud 统管（识别机制见 §3.4 待拍板，不经 `products[].roles`） |
| License | School 本地字段 + 过期只读中间件 | cloud License 服务/DB 权威（Phase 2 待建）；**不进 JWT**，本地字段作运行时判据 + 兜底 |
| 多租户 | School = 租户（每校一行） | cloud `tenant_id` 对应 |

---

## 2. 对 cloud 文档第 8 节"待评审问题"的回答

| # | 问题 | school 团队回答 |
|---|------|----------------|
| 1 | 用户模型 / 密码存储 | User 表见 §1.1；密码 bcrypt 哈希（`PasswordHash`）。 |
| 2 | 当前 JWT / 认证 | 自研 HS256（golang-jwt/v5），有效期 2h，无 refresh 机制（前端靠 401 重登）。与 cloud 的 RS256 + 30min access / 7d refresh 不同。 |
| 3 | 是否多租户 | 是。School 即租户（每校一行）；多校区按 A1 = 同 School + `CampusID`（非独立租户）。 |
| 4 | 迁移时间窗口 | 建议**并行期长期保留**旧登录，不强制切换；确切窗口 [待拍板]。 |
| 5 | 私有部署场景 | 是，已有私有部署路径（`api.ts` 注释：SaaS=phone / 私有=username，本地 License）。需对齐 cloud 文档 5.5 心跳上报 `heartbeat.ziwi.cn`。 |
| 6 | 技术栈 | 后端 Go + Gin + golang-jwt/v5（**支持 RS256 验证**）；前端 React + Vite + TS。对接开发无障碍。 |

---

## 3. school 侧对接契约（核心）

### 3.1 信任模型
- school **不再自签业务 JWT**；保留旧 HS256 登录作为并行期兼容通道。
- 新增 `verify_cloud_token` 中间件：验证 **RS256** 签名，信任 cloud 公钥（JWK 格式，缓存 1h，按 `kid` 选钥）。
- 中间件按 token 特征分支：带 `kid` 的 RS256 → cloud 路径；旧 HS256 → 现有路径。两路并存于并行期。

### 3.2 用户映射
- `User` 表新增 `cloud_user_id varchar(50)`（**空字段，不阻塞现有功能**）。
- 绑定规则：cloud 登录后，按 `email` 匹配 school 已有用户；无匹配则由管理员手动绑定（`cloud_user_id` 写入）。
- 业务侧仍用 school 内部 `user.ID`：收到 cloud JWT 后，用 `cloud_user_id` → 反查 school `user.ID`，再注入 context（沿用现有 `user_id` 语义）。

### 3.3 租户隔离映射
- cloud JWT `tenant_id` → school 的 `School` 实体。
- ✅ 已落地：新增 `School.CloudTenantID` 映射字段（P0 已交付 d3b4518），不复用 `School.ID`。
- 多校区（A1）：`tenant_id` 对应 School 级；校区级 License 粒度由 cloud **License 服务/DB** 的 license 记录（tenant + product + campus 维度）承载 [待拍板具体粒度]——**不经 JWT**（v0.6 修正：JWT 无 license 信息）。

### 3.4 角色映射（v0.6 修正）
- **roles 不进 cloud JWT**（v0.3 基线）：cloud JWT 只表达「是谁 + 属哪个租户 + 订阅了哪些产品」；校内角色（teacher/head_teacher/...）由 school 本地 `User.Role` + RoleMatrix 判定，cloud 登录绑定后沿用绑定用户的本地角色。
- **[待拍板]** `platform_ops` / `platform_devops`：仍建议从 school 用户表剥离、由 cloud 侧统管，但识别机制需与 v0.3 对齐——不走 `products[].roles`（该结构不存在），候选：cloud JWT 独立 claim（需 cloud 侧扩展）或平台运营走 cloud 管理端独立入口。

### 3.5 License 校验（v0.6 修正：License 不进 JWT）
- 现状：`School.LicenseStatus/LicenseExpiresAt` + 过期只读中间件（拦截写操作）——**这就是运行时判据，长期保留**。
- 权威源：cloud **License 服务/DB**（Phase 2 待建，mfg v0.3 契约 §A.2/H2 已闭环此决策；cloud `jwt_service.py` 实测不签 `license_exp`）。选择理由：License 变更（续费/停用）须即时生效，签进 JWT 会被 token 生命周期（30min）拖慢；且 JWT 保持精瘦、身份与计费职责分离（2026-07-27 用户拍板）。
- 同步机制：cloud License 服务就绪后，通过定时/事件同步刷新 school 本地字段；私有部署/断网时本地字段独立兜底（License 文件 + 心跳，见 §3.7）。就绪前，本地字段由运营开通/续费动作直接写入。
- **[待拍板]** 同步通道：webhook 推送 vs 学校端定时心跳拉取（域名规划已有 `heartbeat.ziwi.cn`，倾向心跳）。

### 3.6 Token 配额对账
- 现有 `tokenQuotaAPI` + `School.TokenQuota/TokenUsed` 已就绪（前端 `api.ts:239-252`）。
- 对接：school 按 cloud 文档 5.1 向 cloud 上报消耗；超额由 cloud 控制或 school 本地拦截（已有 402 处理，无需改动）。

### 3.7 私有部署账户边界（关键约束）
- 私有部署（离线学校）**裁剪 cloud 依赖**：用户登录走本地轻量 IdP（username + 本地 License），**不登录 cloud.ziwi.cn，账号也不与 cloud 互通**（依据 cloud 文档 5.5 + school `api.ts` 注释：SaaS=phone / 私有=username）。
- 因此：私有部署的**非 IT 管理员业务用户（教师/学生/家长/校长等）既不应当、也无法登录 cloud.ziwi.cn**——其账号仅存在于私有部署本地库，cloud 侧无对应身份。
- 私有部署与 cloud 的关联仅为 **License 级**：本地 License 文件 + 可选 `heartbeat.ziwi.cn` 心跳上报（每天 1 次，连续 3 天失联标记）。**不是用户身份级打通**。
- IT 管理员如需在 cloud 端做 License 采购/对账/账单，应持 cloud 侧**独立开立的租户管理员账号**，与私有部署本地账号是两回事，不自动同步。
- 含义：本方案 §3.1–§3.6 的 cloud JWT 对接**仅适用于 SaaS 多租户场景**；私有部署走 §3.7 的本地 IdP 路径，两者账户边界必须清晰，否则账户系统后续会混淆。

### 3.8 私有部署 cloud 租户标准账号（= IT管理员 + 财务人员）
私有部署客户在 cloud.ziwi.cn **只需要 2 类账号**，因为 cloud 侧不承载任何业务页面，只承接 License/对账/发票/账单，业务用户全部在本地 IdP（§3.7）。据此定稿如下：

| cloud 账号角色 | 职责 | 与本地账号关系 |
|---|---|---|
| **IT 管理员**（租户 owner） | License 激活、心跳配置、`heartbeat.ziwi.cn` 对接、可增删本租户下账号、改租户设置 | 与私有部署本地 IT 管理员**独立，不自动同步**（见 §3.7） |
| **财务人员**（账单/发票子角色） | 查看账单、申请/下载发票、操作付款；**可看可操作付款，但无账号管理权** | 仅 cloud 侧存在，本地无对应身份 |

**定稿的 3 个边角决策**：
1. **租户 owner 权限归 IT 管理员**：IT 管理员即租户 owner，可管理本租户账号与设置；财务人员为仅账单/发票子角色（管不了账号）。不另设独立 owner，避免凭空多一个账号。
2. **容灾/备份管理员**：标准对外口径为"2 人"，但允许 IT 管理员再邀 **1 个备份管理员**（bus-factor 防护，防止 IT 管理员离职/失联导致 License 续费卡住）。备份管理员不计入标准 2 人口径。
3. **cloud 账号与本地账号严格独立**：这 2 个（或含备份共 3 个）cloud 账号**不**与私有部署本地 IT 管理员账号自动同步、不共享密码；财务人员的身份只存在于 cloud，本地业务库无对应行。

**多校区（A1）不影响**：cloud 租户是 per-School 维度，无论几个 CampusID，cloud 侧标准账号仍是这 2 类（per-School 一个租户），校区不单独开 cloud 账号。

### 3.9 cloud 侧统一对账子系统（单引擎 / 双输入流 / 总运营单一控制台）
平台总运营在 cloud 上管理并核对 token / License，**不应为每个业务线实例（school / mfg / …）各建一套独立对账系统**——应建**一套统一对账子系统**，复用 §0 的 `tenant_id + products[]` 自描述 claims。

**单引擎 + 产品参数化**：对账数据统一按 `(tenant_id, product)` 组织；school（按席位 + Campus 维度）与 mfg（按机器/工厂）的 License/计量差异，写成 `product_config` / `license_rule` 配置行（按 `product` 作用域），由**同一条引擎**读取。新增产品线 = 加一行配置，不新增系统。

**双输入流，一个存储**：
- **流 A — Token 签发/刷新事件日志**（cloud 自身 auth 产出）：覆盖 SaaS（school SaaS / mfg SaaS）的 token 级审计（谁 / 何时 / 从哪 / 有效）。
- **流 B — 私有部署心跳上报**（独立域名 `heartbeat.ziwi.cn`，见下）：覆盖 on-prem 的 License 状态 + 活跃席位对账（其 session token 本地签发，cloud 不可见，故不数 token）。

**总运营控制台 = 单一 dashboard**：按 `product` / `tenant_id` / 状态过滤；**异常驱动**——仅对差异告警（如心跳报 120 席位但 License 允许 100）介入，不做日常人工巡检。各业务线运营与 §3.8 的财务人员持**只读 scoped 视图**（只看本租户），把总运营日常活分流。

**唯一例外（仍复用 schema）**：完全 air-gapped 的私有部署连不上心跳，本地先跑对账副本（同 schema），连通后回灌统一存储——是"同 schema 的本地副本"，非另一条业务线系统。

**明确否定**：per-业务线实例对账系统——违背 §0 统一身份 + 统管 License/Token/财务的定位。

**心跳上报路由决策（答复 mfg 团队提问：子路由 vs 独立域名）**：心跳走**独立域名 `heartbeat.ziwi.cn`**，不走 `cloud.ziwi.cn` 子路由。依据：
1. **爆炸半径隔离**——心跳是流 B、喂给本对账子系统；若 IdP（`cloud.ziwi.cn`）故障，独立域名的心跳接收端仍可存活，总运营仍能看"最后心跳"，不被 IdP 事故致盲。
2. **流量画像隔离**——on-prem 每日上报是 fire-and-forget 遥测，QoS / 限速 / 日志与鉴权请求不同，不应共享请求路径与速率限制。
3. **企业出网白名单**——on-prem 后端 server-to-server 上报，部分企业仅放行特定域名出网；独立稳定域名比"共享登录域下的子路径"更易白名单（且无浏览器，CORS 不适用，子路由的同源优势不存在）。
4. **成本极低**——沿用域名规划已定的 `heartbeat.ziwi.cn`，仅多一个 nginx vhost + ACME 证书；后端可复用 cloud 同一服务的 `/api/v1/heartbeat` 路由（独立域名反代），无需独立代码库。

---

## 4. school 侧改造清单（对齐 cloud 文档 7.1，2026-07-10 已同步实际进度）

| 任务 | 优先级 | 状态 | 改动点 |
|------|:-------|:-----|:-------|
| User 表加 `cloud_user_id` | P0 | ✅ 已交付 (d3b4518) | `User.CloudUserID *string`，自动迁移 |
| School 表加 `CloudTenantID` §3.3 | P0 | ✅ 已交付 (d3b4518) | `School.CloudTenantID *string`，预留映射字段 |
| `CloudJWKS` 公钥拉取+缓存+验签 | P0 | ✅ 已交付 (d3b4518) | `internal/cloud/jwks.go`；RS256 验签、本地文件降级、按 kid 轮换 |
| `CloudTokenAuth` 中间件 | P0 | ✅ 已交付 (d3b4518) | `internal/middleware/cloud_auth.go`；三类错误码区分 |
| `VerifyCloudToken` 纯验证端点 | P0 | ✅ 已交付 (d3b4518) | `POST /api/auth/cloud/verify` |
| `CloudLogin` 云登录+email 绑定 | P1 | ✅ 已交付 (68e383f) | `POST /api/auth/cloud/login`；调 cloud API 验证→独立验签→按 email 匹配→自动绑定→签发 school HS256 token |
| 产品级鉴权（检查 `products[]` 含 `"school"`） | P1 | ✅ 已交付 (43d5642) | `CloudLogin`→`hasProduct()`，指南 §4.1 对齐 |
| 结构化日志 | P1 | ✅ 已交付 (43d5642) | `[cloud-jwks]`/`[cloud-auth]`/`[cloud-login]` 三段日志 |
| 前端增加「知微云登录」入口 | P1 | ✅ 已交付 (68e383f) | `LoginPage.tsx` tab 切换；`api.ts` `authAPI.cloudLogin` |
| 并行期保留旧 HS256 登录 | 长期 | 🔄 并行运行 | 不移除 |
| 私有部署心跳对齐 `heartbeat.ziwi.cn` | P2 | ⬜ 未做 | cron + 离线 License |
| 逐步关闭旧登录入口 | P2 | ⬜ 未做 | 等迁移完成 |
| 数据初始化更新机制（KG/课标/教材版本刷新 pipeline） | P2 | 📋 备忘 | 设计备忘，不绑上线。与教材覆盖层"上报审核回灌"同理（2026-07-09 拍板暂缓）。当前 staging 数据够跑 MVP，后续按需迭代。 |
| 短信验证码通道（school 侧自建，见 §9） | P1 | 📋 规划 | `/api/auth/sms/{send,login,bind}` + Redis 存码 + 服务商对接 |
| 微信登录（school 侧 OAuth，见 §10） | P1 | 📋 规划 | `/api/auth/wechat/{web,miniapp}/login` + `User.WeChatUnionID` 绑定 |

**不阻塞上线条件**：school 可先上"公钥获取 + cloud JWT 验证"能力，但**不强制**用户使用，对现有用户零影响（继承 cloud 7.2）。

---

## 5. 关键待拍板决策点

1. **School↔cloud 租户映射**：✅ 已定并落地——新增 `School.CloudTenantID`（P0 已交付 d3b4518）。
2. **License 同步机制**：webhook 推送 vs 心跳拉取（倾向心跳，域名已规划）？前提已定（2026-07-27）：License 权威源 = cloud License 服务/DB，**不进 JWT**（见 §3.5）。
3. **B2C 个人版账户归属**：由 cloud 独立库管，还是 school `User` 表加"无 SchoolID 的个人版标记"？
4. **平台角色**：`platform_ops/devops` 是否从 school 用户表剥离，纯靠 cloud JWT 识别？
5. **迁移节奏**：并行期持续多久？是否有强制切换时间窗？
6. **短信服务商选型**：✅ 已定——腾讯云短信（`sms.tencentcloudapi.com`，与现有腾讯云 CVM 同生态，SDK 即 `tencentcloud-sdk-go`）
7. **微信登录形态**：✅ 已定——**先做 Web 端扫码登录**（微信开放平台"网站应用" `snsapi_login`）；公众号网页授权、小程序 `wx.login` 暂不实现，待统一小程序策略推进时再补。资质（开放平台认证 300 元/年 + 回调域名白名单）办好前不排期。
8. **身份归属**：✅ 已定——短信验证码（phone OTP）与微信 unionid 均由 **school 自管**（phone 本就是 school 主键，且 §3.7 私有部署边界要求业务身份不出本地），不沉淀 cloud IdP。

---

## 6. 风险与对策（继承 cloud 文档 7.3）

| 风险 | 对策 |
|------|------|
| school 与 cloud 的 email 不匹配 | 允许管理员手动绑定 `cloud_user_id` |
| school 用户表已存在大量用户 | 增量迁移，不一次性强迁 |
| 迁移期体验下降 | 并行期保留旧登录 |
| 私有部署离线 | 本地 License 文件 + 心跳失联标记（连续 3 天未上报） |

---

## 7. 实际接入踩坑记录（v0.4 新增，来自 staging e2e 实测）

本节的每一坑都是 school 侧实际编码→部署→线上验证过程中暴露的，不是设计文档推演。

### 7.1 cloud JWKS 响应 `data` 包裹格式

**坑**：cloud 的 `GET /api/v1/auth/public-key` 返回 `{"data":{"keys":[...]}}`（带 `data` 外包裹），不是裸 `{"keys":[...]}`。若 JWK **仅解析裸 `keys` 字段**，`refresh()` 拿到 0 条 key → 后续验签全部失败。

**症状**：验签时 kid 不匹配→触发 refresh→refresh "成功"（无报错）但 keys 为空→后续验签仍然 No key→401。

**修复**：`jwks.go` → `jwksResp` 同时解析 `Data.keys` 和 `Keys`，`refresh()` 优先用 `Keys`，为空时 fallback 到 `Data.Keys`。

### 7.2 docker compose staging 必须显式 `--env-file`

**坑**：`docker compose up --build` 默认加载同级 `.env`（prod 配置），不是 `.env.staging`。staging 的 `${DB_NAME}` 解析为空 → DATABASE_URL 退化为默认库名 `zhiwei`（不存在）→ backend 容器 crash loop。

**症状**：容器状态 `Restarting (1)`，日志 `FATAL: database "zhiwei" does not exist`。

**修复**：deploy 命令必须带 `--env-file .env.staging`：
```bash
docker compose -p zhiwei-staging --env-file .env.staging -f docker-compose.staging.yml up -d --build
```

### 7.3 Go model 定义未提交导致 CI 编译失败

**坑**：本地 `go build` 通过（因为编译器也读工作区未提交文件），但 CI 只拉 Git 分支内容 → `undefined: model.SchoolTextbookOverride`。

**症状**：`go build ./...` 本地通过，GitHub Actions CI 红。`main.go` AutoMigrate 引用了 `model.SchoolTextbookOverride`，但 `knowledge.go` 的定义从未 `git add` 提交。

**修复**：`git add code/backend/internal/model/knowledge.go && git commit`。教训：**提交前确认 `git status` 无遗漏的模型定义文件**。

### 7.4 前端 CloudLogin 必须绕过全局 401 拦截

**坑**：`api.ts` → `request()` 全局处理 401 → `clearToken()` + `window.location.href = '/login'`。CloudLogin 时用户还没登录（无 school token），cloud API 凭据错误返回 401 → 被全局拦截 → 错误信息变成"登录已过期"而非真正的"知微云账号验证失败"。

**症状**：LoginPage 输入错误 cloud 邮箱密码 → 页面刷新（被跳转 /login）→ 用户看不到错误提示。

**修复**：`authAPI.cloudLogin()` 直连 `fetch()` 不经过 `request()` 包裹：
```ts
cloudLogin: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/cloud/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'same-origin',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || ...)
    return data
}
```

### 7.5 cloud token 的 `products[]` 为空数组时的产品鉴权

**坑**：cloud 注册接口返回 `products: []`（空数组）。若 `CloudLogin` 不做产品级鉴权，任何 cloud 注册用户都能登录 school，即使未订阅 school。

**症状**：任意 cloud 邮箱+正确密码 → school CloudLogin 返回 200 + bound=true（因为 email 恰好匹配 school 库中的用户）。

**修复**：`CloudLogin` 步骤 2.5 加 `hasProduct(claims["products"], "school")` 检查。不包含 `"school"` → 返回 403 `PRODUCT_NOT_SUBSCRIBED`。对齐 mfg 集成指南 §4.1 `require_product()`。

### 7.6 JWKS 刷新时无本地文件降级

**坑**：cloud 服务抖动/网络中断 → school 无法拉取 JWKS → 所有 cloud token 验签失败 → 云登录不可用。若无本地缓存，恢复前完全拒绝服务。

**症状**：cloud 服务维护期间，所有 `POST /api/auth/cloud/login` 和 `POST /api/auth/cloud/verify` 返回 503 `JWKS_UNAVAILABLE`（如果有降级，可继续用上次缓存的 key）。

**修复**（v0.4 已做）：`jwks.go` → `refresh()` 拉取成功后 `writeCacheFile()` 写 `/tmp/cloud_jwks_cache.json`；拉取失败时 `fallbackFromFile()` 读回。TTL 1 小时与 cloud 公钥轮换周期对齐（指南 §2.3）。

### 7.7 小结：正确性验证矩阵

| 测试项 | staging 实测结果 |
|---|---|
| 无 token → /verify | 401 `MISSING_TOKEN` ✅ |
| 真实 cloud token → /verify | 200, claims 完整 ✅ |
| 错误 token → /verify | 401 `INVALID_TOKEN` ✅ |
| 过期 token → /verify | 401 `TOKEN_EXPIRED` ✅ |
| 正确凭据首次 CloudLogin | 200, bound=true, CloudUserID 落库 ✅ |
| 正确凭据二次 CloudLogin | 200, bound=false ✅ |
| 错误凭据 CloudLogin | 401 `CLOUD_AUTH_FAILED` ✅ |
| 未订阅 school 产品 | 403 `PRODUCT_NOT_SUBSCRIBED` (v0.4 新增) |
| cloud 不可达 + 本地缓存 | 200（降级到文件，v0.4 新增） |

---

## 8. 与 cloud 文档的关系

本方案即 school 团队对 `multi-product-platform-integration.md` 第 8 节的评审回答 + 落地计划。建议在该 cloud 文档第 9 节「参考文献 / 学校侧对接」补充本方案链接，形成双向引用。

另：school 接入所需的**实测接口契约模板**已建在 `cloud运营与运维/school接入cloud接口契约模板.md`（v1.0 待填），由 mfg 团队部署 cloud 后填实测值交付 school，作为 `verify_cloud_token` 中间件实现的唯一依据。本方案 §3.1–§3.8 的对接契约对应模板的 A–F 章节。

另：`blazing-pulse-turing.md` 是针对早期 V2.0（`nqpf` 命名）域名策略的可执行性评估（7/10），其 4 处断裂中，断裂 1（admin 入口对等）、断裂 2（`nqpf`→`mfg` 改名）、断裂 4（`ai.ziwi.cn` 延后）已被 `域名规划` v2.1-Final 吸收。遗留的“优化 1：cloud 角色变更后全量文档同步”提示——**school 项目内若有旧文档仍把 `cloud.ziwi.cn` 当作“制造门户”，需同步修正**。本方案以 v2.1-Final（cloud = 租户服务中心）为准，不引用 `nqpf` 旧命名。

### 8.1 注册·租户·计费专题文档（2026-07-27 新增，与本方案配套）

本方案 §5 待拍板 #3（B2C 个人版账户归属）、§3.3（租户映射）、§3.5–§3.6（License/Token 计费对账）在以下两份专题文档中被展开为完整业务规则与落地技术方案，构成对本方案的补充，三者互为引用：

| 文档 | 定位 | 与本方案的衔接点 |
|------|------|------------------|
| `产品规划/产品规格补充_注册租户与计费模型.md` | **业务规则**：双漏斗注册状态机（学校自主申请 / 教师个体认领）、Rule 1/2/3、双轨计费（免费额度 / 个人 Pro / 租户 License） | 展开本方案 §5 #3；「系统设置用户 vs 自主注册」对应 §3.7/§3.8 账户边界 |
| `产品规划/账户权限计费联动技术方案_cloud+license.md` | **落地技术方案**：以 cloud JWT `tenant_id + products[]`（字符串数组）为身份/授权锚点、cloud License 服务/DB 为 License 权威源（不进 JWT），串起账户/权限/License/计费；补中心层三表（`schools_registry` / `user_school_claims` / `usage_meters`）+ `User.AccountType` | 复用本方案已交付锚点（`School.CloudTenantID/LicenseStatus/TokenQuota/TokenUsed`、`User.CloudUserID`、402 门禁）；回答 §5 #1/#3；端点映射含运营端账号/改密 |

**关系说明**：本方案（v0.5）是 school↔cloud 的**对接契约底座**；上述两文档是在此底座上、针对「自主注册 + 个体计费」这一具体业务场景的规则与技术展开。修改任一文档中的租户/计费锚点定义时，须同步核对另两份，避免锚点漂移。

---

## 9. 手机号短信验证码通道（SMS OTP）

### 9.1 目标与定位
- **定位**：在现有「phone+密码」「cloud 邮箱登录」之外，新增**手机号 + 短信验证码**登录/注册/绑定通道，作为并行期第三种登录方式（不替代密码，不强制）。
- **用户价值**：教师/家长/学生免记密码、手机号即身份；用于首次激活、密码找回、家长端认领（见一期 MVP 剩余项）等低摩擦场景。
- **与架构关系**：短信验证码的"身份"仍是 `User.Phone`（school 主键），属 school 业务身份，**由 school 自管**，不下沉 cloud IdP（cloud 以 email 为匹配键，且 §3.7 私有部署边界要求业务身份不出本地）。这与 §3.1「并行期多路并存」一致。

### 9.2 架构（school 侧自建）
- **通道**：school backend 直连短信服务商 API（[待拍板] 腾讯云/阿里云短信），发送 6 位数字码。
- **存码**：复用 compose 已部署的 `zhiwei-redis`（staging/prod 均存在），key=`sms:otp:{phone}`，TTL=5min，附带发送计数防刷。
- **校验**：用户输入 code → 比对 Redis → 通过则签发 school HS256 token（与现有 phone+密码登录同一条签发路径）。
- **不依赖 cloud**：纯 school 域内闭环，SaaS 与私有部署（若网关可达）均可用；私有部署离线时短信不可用属预期降级。

### 9.3 端点设计
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/sms/send` | POST | body `{phone}` → 校验手机号格式 + 频控（同号 60s/次、同 IP/号每日上限）→ 发码 → 仅回"已发送"，**绝不回传 code** |
| `/api/auth/sms/login` | POST | body `{phone, code}` → 校验 → 手机号已存在则登录、不存在则自动注册（角色默认=学生/家长按场景，[待拍板]）→ 签发 token |
| `/api/auth/sms/bind` | POST | 已登录用户 body `{phone, code}` → 绑定手机号到当前 `User`（解绑旧号需二次验证） |
| `/api/auth/sms/reset-pwd` | POST | body `{phone, code, new_pwd}` → 校验后重置密码（替代"管理员代找回"） |

### 9.4 服务商与模板（✅ 已定：腾讯云短信）
- **服务商**：腾讯云短信 `sms.tencentcloudapi.com`（SDK `tencentcloud-sdk-go`），SecretId/SecretKey 存入 `.env`，不入库、不提交。
- **签名与模板**：需运营商审核「验证码」类短信模板 + 签名（如"知微教学"）。模板如：`【知微教学】您的验证码为{code}，5分钟内有效，请勿泄露。`
- **成本**：按条计费（约 0.04–0.05 元/条），需评估家长端批量认领的发送量。

### 9.5 安全与防刷
- 频控：单号 60s 冷却、单号单日上限（如 10 条）、单 IP 单日上限；超限返回 429，不发包。
- 验证码：6 位随机、Redis TTL 5min、单次有效（验证后 `DEL`）、连续错误 5 次锁 15min。
- 防刷：图形/滑块验证码前置（高频或异地时触发），避免被刷量。
- 绝不透出 code、绝不因"用户不存在"而差异化响应（防手机号遍历）。

### 9.6 与现有体系衔接
- `User.Phone` 已是 unique 主键，无需加字段；`/api/auth/sms/login` 的"不存在则注册"需与现有导入（IT 批量导入教师/学生）去重——**已存在的 phone 直接登录，不重复建号**。
- 前端：`LoginPage.tsx` 增加「短信验证码登录」tab（对称 CloudLogin 的 tab 切换）；`api.ts` 增加 `authAPI.smsLogin/smsSend/smsBind`。

---

## 10. 微信登录（WeChat OAuth）

### 10.1 形态（✅ 已定：先做 Web 扫码登录）
| 形态 | 适用端 | 资质 | 技术 | 本次范围 |
|------|--------|------|------|----------|
| Web 端扫码登录 | PC 浏览器 school.ziwi.cn | 微信开放平台"网站应用"（appid/secret，认证 300 元/年） | OAuth2 `snsapi_login`（扫码回调 `code`→`access_token`→`userinfo`，拿 `unionid`） | ✅ 规划实现 |
| 公众号网页授权 | 微信内打开的 H5 | 服务号（认证 300 元/年） | `snsapi_base`/`snsapi_userinfo`，同样拿 `unionid` | ⏸ 暂不做（视微信内 H5 投放需求） |
| 小程序 `wx.login` | 知微小程序（见 2026-07-13 统一小程序策略） | 小程序 appid（同主体 unionid 互通） | `code`→`auth.code2Session`→`openid`+`unionid` | ⏸ 暂不做（随统一小程序策略推进） |

**已定范围（2026-07-16）**：先做 **Web 扫码登录**（PC 教师端最强感知）；公众号、小程序延后。三者共用 `unionid` 作为跨端唯一身份键。授权回调域名 `school.ziwi.cn` 需加入微信开放平台白名单（依赖资质办理，办理前不排期实现）。

### 10.2 架构（school 侧 OAuth，对称 CloudLogin）
- 不经由 cloud IdP（cloud 当前不持有微信身份）；由 school backend 直接对接微信开放平台/小程序 API，模式与 §4 的 `CloudLogin` 一致：`调微信 API 验证 → 取 unionid → 按 unionid 匹配/绑定 school User → 签发 school HS256 token`。
- **跨端归一**：以 `unionid` 为绑定键（非 `openid`，openid 各应用不同），保证 Web/小程序/公众号三端识别同一人。

### 10.3 端点设计
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/wechat/web/login` | POST | body `{code}`（前端经微信 JS-SDK/扫码拿到）→ 校后端换 `access_token`+`userinfo`→ 取 `unionid` |
| `/api/auth/wechat/miniapp/login` | POST | body `{code}`（`wx.login` 拿）→ `auth.code2Session`→`unionid`/`openid` |
| `/api/auth/wechat/bind` | POST | 已登录用户 body `{unionid}` → 绑定到当前 `User`（unionid 唯一索引，防重复绑） |
| `/api/auth/wechat/callback`（仅 Web 扫码用） | GET | 微信重定向 `?code=...` → 内部换身份 → 前端 `302` 回带 token 的落地页 |

### 10.4 数据模型
- `User` 表新增 `WeChatUnionID varchar(64) unique`（空字段，不阻塞现有功能），自动迁移；`WeChatOpenID` 可选（按端存，用于消息推送）。
- 绑定规则：`unionid` 匹配已存在 `User` → 直接登录；无匹配 → 走绑定流程（链接到已有 phone 账号，或注册新号）。

### 10.5 绑定流程（新微信用户）
1. 微信身份首次到来（unionid 无匹配）。
2. 若该微信未绑任何 school 账号：
   - 若请求的 `phone` + 短信 code 校验通过 → 绑到该 phone 对应 `User`（优先复用已有教师/学生号）；
   - 否则引导"绑定已有账号"（输 phone+密码/短信）或"注册"（按场景给默认角色）。
3. 绑定后写 `WeChatUnionID`，后续免输直接微信登录。

### 10.6 资质与成本（✅ 范围已定，资质待办理）
- 微信开放平台"网站应用"需企业主体认证（300 元/年）+ 配置授权回调域名（需在 `域名规划` 增 `school.ziwi.cn` 的微信回调白名单）。**资质办好前不排期实现**。
- 小程序需单独 appid（与开放平台同主体 → unionid 互通），本次暂不涉及。
- 隐私合规：微信 `unionid`/`userinfo` 属个人信息，需在校隐私政策与《家长/学生授权》中明示用途（结合 P2 家长端合规）。

### 10.7 与现有体系衔接
- `LoginPage.tsx` 增加「微信登录」入口（Web 扫码弹窗 / 小程序按钮）；`api.ts` 增加 `authAPI.wechatLogin`。
- 与 §4 `CloudLogin` 同理：并行运行，不关闭旧登录；微信登录失败（如微信不可达）不阻断其他通道。

---

## 11. 统一认证路线图小结（v0.5 方案定稿，仅规划未实现）
| 登录方式 | 状态 | 信任域 | 备注 |
|----------|------|--------|------|
| phone + 密码 | ✅ 在用 | school（HS256） | 基线 |
| cloud 邮箱登录（CloudLogin） | ✅ 已交付 | cloud IdP（RS256） | §4 P1 |
| 手机号短信验证码 | 📋 规划 P1（腾讯云短信已定） | school | §9，待排期实现 |
| 微信登录（Web 扫码） | 📋 规划 P1（范围已定：仅 Web） | school（对称 CloudLogin） | §10，资质办好后实现；公众号/小程序延后 |
| 私有部署本地 IdP | 既有 | 本地 | §3.7，与 SaaS 账户边界隔离 |

**原则**：四种登录方式并行期长期共存，统一收敛到 school `User`（phone 主键 + cloud_user_id + WeChatUnionID 三个外部身份键），业务侧始终用 `user.ID`；任何新通道失败都不阻断其他通道。

**方案定稿说明（2026-07-16）**：本次仅确定方案，不落地代码。已拍板决策——①短信服务商=腾讯云短信；②微信登录先做 Web 扫码、公众号/小程序延后；③短信 OTP 与微信 unionid 均由 school 自管，不沉淀 cloud IdP。实现时机：短信通道可先行（腾讯云已定、家长端认领刚需）；微信登录待开放平台资质（300 元/年 + 回调白名单）办好后再排期。

---

## 12. 跨产品线统一认证一致性（mfg 侧）

### 12.1 决策（2026-07-16）
**mfg 产品线（mfg.ziwi.cn，智能制造）的「租户管理员 / 财务人员 / SaaS 用户」三类角色，同样纳入 cloud 用户认证，采用与 school 一致的統一认证策略**——以 cloud 为统一 IdP，三类角色皆为 cloud 认证用户，由 cloud JWT 的 `tenant_id + products[]` claims 区分归属与产品授权；**角色细分走 mfg 本地体系**（v0.6 修正：roles 不进 cloud JWT，与 v0.3 契约一致）。

### 12.2 与 school 策略的对齐点（同构）
| 维度 | school 侧 | mfg 侧（本决策） |
|------|-----------|------------------|
| 信任锚 | cloud RS256 JWT（邮箱登录）+ school 本地 HS256（phone/SMS/微信） | cloud RS256 JWT 为主；mfg 三类角色均走 cloud 认证 |
| 用户收敛 | `User`（phone + cloud_user_id + WeChatUnionID） | mfg `User`（cloud_user_id 为主键映射，phone/微信同信任域） |
| 登录并行 | 密码/cloud邮箱/短信/微信 长期共存，单通道失败不阻断 | 同：多通道并行，单通道失败不阻断 |
| 角色区分 | school 内 `Role`（本地 RoleMatrix；JWT 仅表达 products 授权） | mfg 内 `tenant_admin` / `finance` / `saas_user`（mfg 本地角色表；JWT 仅表达 `products:["mfg"]` 授权） |
| 外部身份键 | cloud_user_id / WeChatUnionID / phone | 同，三键收敛到 mfg `User` |

### 12.3 mfg 三类角色的映射建议（v0.6 修正：角色在 mfg 本地，JWT 只带 products）
- **租户管理员（tenant_admin）**：cloud `tenant_id` 的 owner；JWT 带 `products:["mfg"]`，mfg 本地用户表标记 `tenant_admin`；对应 mfg 内"企业租户最高权限"（管成员、看账单、配 License）。cloud 侧自身的租户管理/账单操作权限属 cloud 应用内角色（cloud 自有 DB），不经 JWT 下发给产品线。
- **财务人员（finance）**：JWT 带 `products:["mfg"]`，mfg 本地标记 `finance`；仅能访问账单/发票/Token 用量等财务视图，不碰业务数据。
- **SaaS 用户（saas_user）**：多租户下的普通业务用户；JWT 带 `products:["mfg"]`，mfg 本地标记 `member`（或细分岗位角色）；按 `tenant_id` 隔离数据。

### 12.4 落点边界（重要）
- mfg 的详细接入实现以 mfg 团队 `cloud-jwt-integration-guide.md` v1.0（姊妹方案）为准，本 §12 为**产品级决策备忘**，要求该 guide 显式覆盖上述三类角色的映射与登录入口，与 school §9/§10 保持同构。
- **职责边界（2026-07-12 工作流拍板，2026-07-16 重申）**：**cloud、heartbeat 及 mfg 全部代码由 workbuddy（Win 机）团队开发并部署**；本 agent（codebuddy）职责限于**提供认证策略与跨产品线决策备忘**，不代执行 mfg / cloud / heartbeat 任何代码或部署。本 §12 决策需同步到 `cloud-jwt-integration-guide.md` 由 mfg 团队落地，跨环境对齐走 `ziwi-integration-contracts` 共享仓 SOP。
- 本决策与 §0「各产品线信任 cloud JWT、不自签业务 token」的总体定位一致，是对 mfg 侧"哪些角色必须 cloud 认证"的明确化。
