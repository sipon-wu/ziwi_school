# 统一身份：租户与平台管理账号统一接入 cloud IdP 方案

> 版本：v0.1（决策拍板稿）｜日期：2026-07-28
> 状态：决策已定（用户拍板），待 workbuddy 团队落地
> 依据：
> - `产品规划/域名规划` v2.1-Final（权限驱动入口、heartbeat CNAME→cloud）
> - `产品规划/账户系统与cloud.ziwi.cn对接方案.md` v0.6（§0/§3.4/§3.8/§3.9/§5#4/§12）
> - 记忆：heartbeat 原架构复用 cloud 认证（58236601）、P2 未做（13302805）
> - 工作纪律：cloud/heartbeat/mfg 代码由 workbuddy（Win 机）团队开发部署，本方案为决策拍板 + 跨产品线契约输入

---

## 0. 决策确认（用户拍板 2026-07-28）

1. **租户管理账号**与**平台管理账号**全部统一从 `cloud.ziwi.cn` 登录，不再由各产品线 / heartbeat 各自维护管理账号。
2. 登录后**自动识别账号类型**，按角色分配对应**管理界面**（平台运营控制台 / 租户自助中心），用户无需记忆二级域名（对齐域名规划"权限驱动入口"）。
3. 明确边界：
   - **纳入 cloud 统一走的**：①租户管理账号（IT管理员=tenant owner、财务人员，见 §3.8，**只限管理角色，不含师生/家长终端用户**）；②平台管理账号（super_admin/ops/sales/finance/support，即 heartbeat 当前 `AdminUser` RBAC 角色）。
   - **不纳入**：产品线业务用户（teacher/student/head_teacher/...），仍走各产品线登录（school/mfg 本地 IdP 或 CloudLogin），其角色由产品线本地 RoleMatrix 判定（v0.6 §3.4 约束）。
4. 否决项：heartbeat 自带 `AdminUser` 登录、各产品线本地维护 `platform_ops/devops` 平台角色——均下线，改由 cloud 统一身份源承载。

---

## 1. 现状与缺口

| 维度 | 现状 | 缺口 |
|------|------|------|
| cloud JWT | `sub/email/tenant_id/products[]/iat/exp`，**不带角色**（v0.6 §3.4） | 无法表达"平台 vs 租户"账号类型与角色，导致无法自动路由界面 |
| heartbeat | 独立 Python 服务 + 自带 `AdminUser` 表 + 会话 cookie 登录，与 cloud 不互通 | 管理账号未走 cloud；管理界面与心跳接收端混在同一服务 |
| school/mfg 平台角色 | `platform_ops/platform_devops` 仍在本地 `User` 表（v0.6 §3.4 #4 待拍板） | 未剥离到 cloud，无法靠 cloud JWT 识别 |
| §3.4 候选 | "cloud JWT 独立 claim（需 cloud 扩展）或平台运营走 cloud 独立入口" | 本次拍板取"独立 claim + 运营走 cloud 入口"组合 |

---

## 2. cloud 账号模型扩展

两类账号都进 **cloud 自有 DB**（不与产品线业务用户混表）：

| 账号类 | `account_type` | 角色字段 | 创建者 | 归属 |
|--------|---------------|----------|--------|------|
| 平台管理账号 | `platform` | `roles ∈ {super_admin, ops, sales, finance, support, devops, implementation}` | 平台 super_admin | 全局，无 tenant_id |
| 租户管理账号 | `tenant` | `roles ∈ {tenant_admin(IT管理员/owner), finance(账单子角色)}` | 租户 owner（§3.8） | 绑定 `tenant_id` |

- 租户管理账号标准口径维持 §3.8：每租户 IT管理员（owner）+ 财务人员 2 类，允许 IT管理员邀 1 个备份管理员（bus-factor）。**注意语义边界**：此处"租户管理账号"仅指管理该租户在 cloud 上的 License/账单/Token 的**人员**（IT管理员、财务），**不包括该租户下的师生/家长等终端用户**——后者仍走各产品线本地登录（school/mfg 自有 IdP 或 CloudLogin），不进 cloud 统一登录。
- 平台管理账号由平台 super_admin 在 cloud 运营控制台创建/停用。
- **不进 cloud**：产品线业务用户（teacher/student/...），其身份仍在各产品线本地库（§3.7 私有部署边界、§3.4 角色本地判定）。

---

## 3. JWT claim 设计（解决 v0.6 §3.4 待拍板 #4）

**澄清 v0.6 "roles 不进 JWT" 的适用范围**：该约束仅针对**产品线业务角色**（teacher/head_teacher 等），因其由产品线本地 RoleMatrix 判定、且随业务频繁变化。而本方案的**平台/租户管理角色是 cloud 应用内角色**（§3.8 已确认"cloud 侧自身的租户管理/账单操作权限属 cloud 应用内角色，不经 JWT 下发给产品线"）——因此应进 cloud JWT claim。二者不冲突。

在现有 RS256 JWT 上**扩展**以下 claim（签名算法、JWK 分发、kid 轮换均不变）：

```
sub, email, iat, exp                # 不变
products: string[]                  # 不变（租户订阅的产品，产品线鉴权用）
account_type: "platform" | "tenant" # 新增：账号类型
roles: string[]                     # 新增：按 account_type 取对应角色列表（platform→平台角色；tenant→租户管理角色）
tenant_id: string                   # account_type=tenant 时存在
```

---

## 4. 自动识别与界面路由（登录后）

统一入口 `cloud.ziwi.cn` → 登录成功拿 JWT → 前端（或网关）解析 claims 路由：

```
account_type = platform
  ├─ super_admin / ops / sales / finance / support
  └─ → cloud 运营控制台（§3.9 单 dashboard）
        • 含 heartbeat 的 License / 部署 / 告警 / 审计 只读或管理视图
        • 含跨产品线对账只读视图（按 product/tenant_id 过滤）
        • 按 platform_roles 控制可见功能：
            - finance → 仅 License 查看 / 账单视图（PERM_LICENSE_VIEW）
            - ops     → 部署/告警/审计 等查看类（无用户管理/系统设置写权）
            - super_admin → 全权 + 用户管理/系统设置
（以上可见性均按 JWT 的 `roles` 列表判定）

account_type = tenant
  ├─ tenant_admin / finance
  └─ → 租户自助中心
        • License 激活、心跳配置、账单、发票、付款（§3.8）
        • tenant_admin 可增删本租户账号；finance 仅账单/发票子角色
```

无需用户手动输入二级域名，全部从 `cloud.ziwi.cn` 进入后按角色分流（对齐域名规划"用户只记主站，manage/admin 通过角色权限控制可见"）。

---

## 5. heartbeat 改造

1. **管理界面迁入 cloud 运营控制台**：当前 heartbeat 的 AdminUser HTML 页面（dashboard/licenses/customers/deployments/alerts/audit/users/settings）迁移为 cloud 控制台内的视图模块；`heartbeat.ziwi.cn` 回归**纯心跳接收端**（server-to-server 上报 + 供 cloud 控制台调用的数据查询 API）。与 §3.9 心跳路由决策（独立域名仅做接收端、爆炸半径隔离）一致，回归原架构意图（记忆 58236601：heartbeat = cloud 后端 `/api/v1/heartbeat` 模块、独立域名反代）。
2. **信任 cloud RS256 JWT**：heartbeat 后端新增 `CloudTokenAuth`（同 school 侧），验签后按 `roles` 映射本地 RBAC：
   - `finance` → `PERM_LICENSE_VIEW`（只读查看）
   - `ops` → 部署/告警/审计 查看类权限（无 manage/users/settings 写权）
   - `super_admin` → 全权
3. **下线自带 `AdminUser` 登录**（P2"关闭旧登录入口"）：日常不再使用 `AdminUser` 表登录；保留一个本地 **break-glass 应急账号**（仅 cloud 不可达/离线时启用），不用于日常、不对外。
4. **私有部署 IT 管理员**：按 §3.8 持 cloud 侧独立租户账号，与本地账号不自动同步；其 License 对账经 heartbeat 上报，不在 cloud 侧承载业务页面。

---

## 6. school / mfg 平台角色剥离（落地 v0.6 §3.4 #4 / §12）

- **school**：`User.Role` 中的 `platform_ops/platform_devops` 从本地剥离，改由 cloud JWT `roles` 识别；本地 RoleMatrix 仅保留产品线业务角色（teacher/head_teacher/...）。绑定沿用已落地的 `CloudLogin` 机制（按 email 匹配、写 `cloud_user_id`）。
- **mfg**：同构（§12.3 三类租户角色已规划走 cloud；补充平台角色剥离到 cloud JWT 的 `roles`）。
- 并行期：保留产品线旧平台角色作为兜底，逐步切换；单通道失败不阻断其他通道（对齐 §11 原则）。

---

## 7. 实施阶段（P2，与现有 P0/P1 不冲突）

| 阶段 | 任务 | 负责 |
|------|------|------|
| P2-a | cloud 账号模型扩展（account_type + roles）+ JWT claim 扩展 + 注册/邀请流程 | codebuddy（Mac，CVM key 在手） |
| P2-b | cloud 运营控制台（单 dashboard）承载 heartbeat 管理视图 + 租户自助中心 | codebuddy（Mac，CVM key 在手） |
| P2-c | heartbeat 信任 cloud JWT、下线 AdminUser 登录、管理界面迁入 cloud、保留 break-glass | codebuddy（Mac，CVM key 在手） |
| P2-d | school/mfg 平台角色剥离到 cloud JWT `roles` | codebuddy + school/mfg 团队 |
| 迁移 | 并行期保留 heartbeat 旧登录 + 产品线旧平台角色，逐步切换、可回退 | 各团队 |

---

## 8. 团队边界与落地分工（纪律）

- 依据 v0.6 §12.4 + 工作纪律：cloud、heartbeat、mfg 全部代码由 **workbuddy（Win 机）团队**开发并部署；本 agent（codebuddy）职责限于**提供认证策略与跨产品线决策备忘**，不代执行 cloud/heartbeat/mfg 任何代码或部署。
- 本方案作为决策拍板 + 跨产品线契约输入，须同步到 `ziwi-integration-contracts` 共享仓 SOP，由 workbuddy 落地；跨环境对齐走该仓既定 SOP，避免重踩 school 已付过代价的坑（如部署前先 rsync 再 up --build）。
- **生产部署**：须用户明确"发生产"指令后方可执行（纪律红线）。

---

## 9. 引用与依赖

- `产品规划/域名规划` v2.1-Final：权限驱动入口、heartbeat CNAME→cloud、admin.{产品线} 公司运营后台定位
- `产品规划/账户系统与cloud.ziwi.cn对接方案.md` v0.6：§0 统一 IdP 定位、§3.4 角色不进 JWT（及 platform 角色待拍板）、§3.8 私有部署 cloud 标准账号、§3.9 总运营统一控制台、§5#4 平台角色剥离、§12 跨产品线统一认证
- 记忆 58236601：heartbeat 原设计复用 cloud 认证、独立域名反代
- 记忆 13302805：P2（私有部署心跳/关闭旧登录入口）未做
