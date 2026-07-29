# 知微教学 · 账户 / 权限 / 计费 联动技术方案（cloud + license）

> 版本：v1.2 ｜ 日期：2026-07-29 ｜ 状态：方案定稿（仅规划，待立项实现）
> 配套产品规格：`产品规划/产品规格补充_注册租户与计费模型.md`
> 继承契约：`产品规划/账户系统与cloud.ziwi.cn对接方案.md`（v0.6，§3 信任模型 / §5 待拍板 #3）
> **v1.1 变更（2026-07-27 用户拍板，对齐 mfg v0.3 契约基线 + cloud 源码实况）**：`license_exp` **不进 cloud JWT**；`products[]` 为**字符串数组**（如 `["school","mfg"]`），roles 走各产品本地体系。License 权威源 = cloud **License 服务/DB**（Phase 2 待建），本地 `LicenseStatus/LicenseExpiresAt` 为运行时判据 + 私有部署/断网兜底。全文锚点已按此修订。
> **v1.2 变更（2026-07-29 讨论拍板）**：新增 §0.5「授权分层总纲」，明确三层正交授权（cloud license 组织/实例级 ↔ 产品内会员用户级）、cloud license 三类被授权组织（自家生产 / 私有化 / 公有云 SaaS 客户）及续期策略、license 与 membership 正交、2C 个体不受 cloud license 约束；并补「已落地现状」对齐 cloud 侧已交付的门禁与两张预发布 license。

---

## 0. 目标

把分散的四件事——**账户（身份/归属）、权限（能做什么）、License（开通/过期门禁）、计费（用了多少/该付多少）**——通过 `cloud.ziwi.cn` IdP 串成一条自洽链路。四者必须联动，否则会出现「已付费却功能锁死」「个体用户无法转化」「租户过期但未降级」等割裂问题。

核心论点：**cloud JWT 的 `tenant_id + products[]`（字符串数组）claims 是统一身份/授权锚点；License 状态另有权威源 = cloud License 服务/DB（Phase 2 待建），不签进 JWT**。school 侧只需在「租户成员」与「个体用户」两种形态下，分别把 License / 计费 接到这两个锚点上（身份锚点=JWT，License 锚点=License 服务 + 本地字段兜底）。

---

## 0.5 授权分层总纲（2026-07-29 补充）

> 本节为全局视角，澄清「谁受 cloud license 约束、谁受产品内会员约束」的边界，避免把个体用户错算进 cloud license 导致模型爆炸。结论与 2026-07-29 讨论拍板一致，且 cloud 侧门禁已落地验证。

### 0.5.1 三层正交授权模型

```
层1 · cloud license（平台/组织级，「谁有资格运营一个知微实例」）
   └─ 对「被授权组织」签发：自家生产 / 私有化客户 / 公有云 SaaS 客户集团
       → 数量少（几十~几百）、走 cloud 签发 + 门禁

层2 · 产品内订阅（用户级，「在产品里能用什么」）
   ├─ 2B 用户：学校已是租户 → 教师是学校套餐内的席位用户（学校付费/分配）
   └─ 2C 用户：学校永不成租户 → 个体教师个人会员（个人付费，只受会员权限）
       → 数量大、由 school 会员体系管，不进 cloud license
```

- **license 与 membership 是两个正交维度，互不替代**：
  - `license`（层1）= 平台/组织级「有没有资格运营/部署实例」，作用对象少，由 cloud 签发。
  - `membership`（层2）= 产品内用户级「能用哪些功能、用多少」，作用对象多，由 school 订阅系统签发。
  - 一个私有化客户（有 license）内部的教师，仍有自己的会员/角色权限；一个 2C 个人会员（只有 membership、无 license）在 school 内也有角色权限。

### 0.5.2 层1 · cloud license 的三类被授权组织

| 被授权组织 | 形态 | license 策略 | 校验位置 |
|---|---|---|---|
| 自家生产（知微教育 / 知微智能 prod） | owner | 长期 / 可续期（策略待定：B owner 或统一续期） | cloud 在线门禁 |
| 私有化客户（装客户机房） | 私有化部署 | **订阅续期制**（非买断，到期不续实例本地拦） | 私有化实例本地验签（cloud 公钥验签名+有效期） |
| 公有云 SaaS 客户（某教育局/集团） | 2B 客户集团 | 订阅续期制（期限 + product + tier + seats） | cloud 在线门禁 |

- **私有化也是续期制**（2026-07-29 拍板纠正）：私有化 ≠ 买断。cloud 签发带签名 + 有效期的 license key，私有化实例内置 cloud 公钥本地验签（离线可用）；续期 = cloud 重签/延长 `expires_at`，实例下次心跳/启动拉新 key。需补 `renew_license` 端点 + 离线验签逻辑（Phase 2 待建）。
- **自家生产**：可走 owner 长期特例，或与其余两类统一为「有期限可续期」（策略待定）。当前已落地的两张预发布 license 的 tenant_name 分别为「知微教育·预发布」「知微智能·预发布」，status=approved、有效期 2026-12-31，仅作验证。
- **2B SaaS 客户是 license 系统的核心用户**：临期提醒、续费、扩容（tier/seats）的真实数据源。

### 0.5.3 层2 · 产品内 2B / 2C 与 license 解耦

- **2B 用户**（学校租户内教师）：由 `School.LicenseStatus` + `TokenQuota/Used`（§1、§5，代码已落地）承载，归属 school 多租户，不进 cloud license。
- **2C 用户**（个体教师个人会员）：由 `usage_meters`（free / pro / tenant_covered，见产品规格 §2）+ 会员权限承载，**不受 cloud license 约束**——cloud license 只到「组织/实例级」，根本不进产品内用户这一层。其学校永不成租户时，走个人 Pro 订阅（产品规格 §2.3）。
- 2C 个体教师在 school 内建议建模为「个人租户」（`tenant_type=personal`、席位上限=1），与 2B 学校租户共用一套多租户隔离 + 权限框架，school 内部只用一套引擎，不为个人写分支。

### 0.5.4 已落地现状（代码对齐）

- cloud `AuthService.authenticate` 已对 `tenant_id` 非空账号校验 cloud license（`status∈(approved,completed)` 且 `requested_expires_at>now`），覆盖 `/auth/login` 与统一登录两条路径；`tenant_id=NULL` 的平台/测试账号不受影响。
- 已签发两张预发布 license：tenant_id `school-staging`（tenant_name「知微教育·预发布」）、`mfg-staging`（tenant_name「知微智能·预发布」），brand 命名已落库，看板 `active_licenses=2`、按产品线 `school:1 / mfg:1`。
- 门禁已验证：有效 license 登录成功、过期 license 被拒（提示「租户许可证无效或已过期，请联系运营签发」）。
- 待建（Phase 2）：`renew_license` 端点、私有化离线验签 license key 签发、SaaS 客户 license 的 tier/seats 字段。

---

## 1. 现有锚点（代码已就绪，无需返工）

| 锚点 | 位置 | 含义 |
|------|------|------|
| `School.CloudTenantID` | `models.go:25` | 学校 ↔ cloud `tenant_id`（统一登录 P0 已交付 d3b4518） |
| `School.LicenseStatus` | `models.go:29` | `active` / `trial` / `none`（驱动功能门禁） |
| `School.LicenseExpiresAt` | `models.go:30` | License 过期时间 |
| `School.TokenQuota / TokenUsed` | `models.go:31-32` | **学校级计费额度池**（已就绪） |
| `User.CloudUserID` | `models.go`（P0 已交付） | school 用户 ↔ cloud `sub`（UUID） |
| cloud JWT claims | `auth_cloud.go` | `sub / email / tenant_id / products[] / iat / exp` |
| License 门禁消费点 | `auth_handler.go:95-123` `auth_cloud.go:182-203` | 登录即返回 `LicenseStatus` 供前端门禁；后端 402/只读中间件已就绪 |

> 关键事实：License 门禁与学校级额度池**已在代码里跑通**，本方案只补「个体用户」半边 + 把四者接到 cloud 锚点。

---

## 2. 扩展数据模型（中心注册层，回答 §5 #3 B2C 归属）

个体用户不属于任何 school 租户 DB（当前架构每校独立实例），其身份与计费必须落在**中心层**（与 cloud IdP 同源）。新增三表 + 一个字段：

### 2.1 `schools_registry`（中心学校注册表，跨租户全局唯一）
```go
type SchoolRegistry struct {
    ID               string     `gorm:"primaryKey"`        // 中心学校 ID（区别于各实例 School.ID）
    FullName         string     `gorm:"uniqueIndex"`       // 学校全名（用于查重/认领）
    Region           string     // 省/市/区
    Status           string     `gorm:"index"`             // tenant(正式租户) | claimed(仅被个体认领)
    TenantInstanceRef *string   // 转正后回填对应 school 实例引用(CloudTenantID)
    CreatedAt        time.Time
}
```
- `status=tenant` → Rule 2 走「申请加入」；`status=claimed/none` → Rule 3 走「个体认领」。

### 2.2 `user_school_claims`（个体用户认领归属）
```go
type UserSchoolClaim struct {
    UserID           string `gorm:"primaryKey"`  // cloud sub / school User.ID
    SchoolRegistryID string `gorm:"primaryKey"`
    Class            string // 任教学科所在班级
    Subject          string // 任教学科
    ClaimedAt        time.Time
}
```
- 多教师认领同校 → 中心聚合（线索）+ (校,班,学科) 防重复标记。
- 学校转正时批量转为租户成员邀请。

### 2.3 `usage_meters`（个体用户计费额度，中心层）
```go
type UsageMeter struct {
    UserID             string `gorm:"primaryKey"`
    SchoolRegistryID   string // 关联认领学校（用于转化归集）
    Period             string // 计费周期，如 2026-07
    Quota              int64  // 月度免费额度（如 30 次 AI 生成）
    Used               int64  // 已用
    Status             string // free | pro | tenant_covered
}
```
- `tenant_covered`：该校转正后，个体计费终止、并入 `School.TokenQuota`。

### 2.4 `User.AccountType`（区分来源，运营端创建 vs 自主注册）
```go
AccountType string `gorm:"default:'system'"` // system(系统设置/运营创建/导入) | self(自主注册)
```
- `system`：免手机+邮箱验证（运营端指定密码即可）。
- `self`：强制手机+邮箱验证（规格 §0 边界）。

---

## 3. 四者联动链路

```
                        cloud IdP (RS256 JWT)
                 ┌───────────────────────────────┐
                 │ sub │ email │ tenant_id        │
                 │ products[]（字符串数组）        │
                 └──────────────┬─────────────────┘
                 （License 不在 JWT 内：权威源=cloud License 服务/DB，
                   本地 LicenseStatus/LicenseExpiresAt 同步兜底）
                                │
            ┌───────────────────┴───────────────────┐
        tenant_id 非空                            tenant_id 为空
        （租户成员）                            （个体用户）
            │                                        │
   School.CloudTenantID 反查                    UserSchoolClaim
            │                                        │
   ┌────────┴─────────┐                     ┌────────┴─────────┐
 License 门禁        计费池                 认领元数据          计费
 LicenseStatus     TokenQuota/Used         (校,班,学科)      UsageMeter
 active/trial/none  (全校池,402拦截)         →中心聚合线索      (个人月额度)
   ↓                  ↓                        │                ↓
 功能可用/只读    超额→402弹窗            触发漏斗A销售      超额→推Pro/本校转化
```

**联动要点**：
1. **权限**：`products[]` 含 `"school"` 才放行（已有 `hasProduct` 校验）；校内细粒度角色由 school 本地 `RoleMatrix` + `AccountType` 组合判定（**roles 不进 cloud JWT**，走各产品本地角色体系；个体用户默认 teacher 能力，无租户管理权）。
2. **License 门禁**：运行时判据 = 本地 `LicenseStatus/LicenseExpiresAt`（代码已落地）；权威源 = cloud **License 服务/DB**（Phase 2 待建），通过定时/事件同步刷新本地字段（机制见 v0.6 §3.5，倾向心跳拉取）；私有部署/断网时本地字段独立兜底。**License 不从 JWT 取**。
3. **计费**：租户走 `TokenQuota/Used`（已就绪）；个体走 `UsageMeter`（新增）；两者共用「AI 生成额度」计量口径，便于转化时合并。
4. **转化**：学校转正 → `schools_registry.Status=tenant` + 回填 `TenantInstanceRef` → `UserSchoolClaim` 转成员 → `UsageMeter.Status=tenant_covered` 且额度并入 `School.TokenQuota`。

---

## 4. 注册状态机 → 端点映射（Rule 1/2/3）

| 规则 | 端点 | 动作 |
|------|------|------|
| 漏斗 A·申请 | `POST /api/tenant/apply` | 写入 `schools_registry(status=claimed 占位)` + 运营工作台待办（知了辅助） |
| 漏斗 A·开通 | `POST /api/admin/tenant/open`（运营） | 建实例 + 写 `CloudTenantID` + `LicenseStatus` + `TokenQuota` |
| Rule 2·加入申请 | `POST /api/school/:id/join-request` | 仅登记，提醒找管理员；管理员用 `POST /api/admin/users` 建号 |
| Rule 3·个体认领 | `POST /api/user/claim-school` | 建/更新 `UserSchoolClaim`；聚合同校认领者 |
| 运营端账号 | `POST /api/admin/users` | 创建 `system` 用户 + 可选初始密码 + `ForceReset` |
| 运营端改密 | `PUT /api/admin/users/:id/password` | 代设/重置，可选 `ForceReset=true` |

> 运营端账号/改密端点即前序讨论结论；`ForceReset` 字段已存在待消费。

---

## 5. 计费 × License 联动细节

- **租户侧（已有）**：`School.TokenQuota` 为池，`TokenUsed` 递增；超额由后端 402 拦截（前端 `api.ts` 已处理）。License 过期（`LicenseStatus!=active/trial`）→ 只读中间件拦截写操作。
- **个体侧（新增）**：每次 AI 生成 → `UsageMeter.Used++`；达 `Quota` → 返回 `403 QUOTA_EXHAUSTED` → 前端弹「升级个人 Pro / 加速本校开通」二选一。
- **统一计量口径**：租户与个体都以「AI 生成次数」为单元，转化时 `School.TokenQuota += Σ个体剩余`、个体 `Status=tenant_covered`。
- **私有部署边界**：本方案仅 SaaS；私有部署走 v0.6 §3.7 本地 IdP + License 文件 + 心跳，不接入中心层计费。

---

## 6. 权限组合判定（伪代码）

```
func resolveAccess(user, schoolRegistry, cloudClaims):
    if cloudClaims.tenant_id == nil:           # 个体用户
        assert user.AccountType == 'self'
        plan = UsageMeter(user).Status          # free / pro
        return RoleMatrix['teacher'] + planGatedFeatures(plan)
    else:                                       # 租户成员
        school = School.byCloudTenantID(cloudClaims.tenant_id)
        assert "school" in cloudClaims.products              # 产品级授权（JWT 唯一授权语义）
        assert school.LicenseStatus in (active, trial)       # License 判本地字段（权威源=License 服务同步），否则只读
        role = RoleMatrix[user.Role]                         # 角色走 school 本地体系，不从 JWT 取
        return role + licenseGatedFeatures(school.LicenseStatus)
```

---

## 7. 待实现清单（P 级）

| 任务 | 优先级 | 说明 |
|------|:-------:|------|
| `schools_registry` + 迁移 | P0 | 中心注册表，Rule 2/3 分流前提 |
| `user_school_claims` + 迁移 | P0 | 个体认领归属 + 聚合线索 |
| `usage_meters` + 月度重置 cron | P1 | 个体计费 |
| `User.AccountType` 字段 | P0 | system/self 区分 + 验证豁免 |
| `POST /api/tenant/apply` + 运营工作台 | P1 | 漏斗 A 入口 + 知了辅助 |
| `POST /api/user/claim-school` + 聚合告警 | P1 | Rule 3 线索 |
| 运营端 `POST/PUT /admin/users`(/password) | P1 | 账号+改密（前序结论） |
| 个体 403→二选一引导 | P1 | 计费转化衔接 |
| 转化脚本：claims→租户成员 + meter并入 | P1 | 飞轮闭环 |
| 短信/微信通道（P2，不阻塞） | P2 | 验证通道替代 |

> 与 v0.6 §4 已交付项（CloudUserID / CloudTenantID / CloudLogin / JWKS）无缝衔接，本方案只补中心层三表 + 个体半边链路。
> **License 服务（cloud 侧，Phase 2）**：本清单不含 cloud License 服务/DB 的建设（归 cloud 侧排期）；在其就绪前，school 本地 `LicenseStatus/LicenseExpiresAt` 由运营开通/续费时人工/脚本写入，语义不变、后续平滑切到同步机制。
