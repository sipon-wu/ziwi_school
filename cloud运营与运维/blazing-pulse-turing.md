# V2.0 域名策略可执行性评估

---

## 综合评价

**可执行性评分：7/10**。DNS 层面完全可行，但与现有产品架构存在 4 处断裂，建议修正后再配置。

---

## ✅ 无问题的部分

| 项目 | 评估 |
|:-----|:------|
| 两条产品线对等结构 | ✅ 清晰工整，易维护 |
| 语义短前缀原则（m/D/x） | ✅ 简洁统一 |
| 私有化路径前缀映射对照 | ✅ 考虑周到，IP方式可用 |
| CNAME vs A 记录标准 | ✅ 判断逻辑合理 |
| Wildcard `*.cloud.ziwi.cn` | ✅ 与三端矩阵一致 |
| `cloud.ziwi.cn` 租户服务总入口 | ✅ 跨产品线合理 |
| `demo.ziwi.cn` 作为统一演示中心 | ✅ 避免两线抢域名 |

---

## ❌ 不可执行的 4 处断裂

### 断裂 1：`admin.nqpf.ziwi.cn` ≠ 运营后台

V2.0：
> "运营后台（内部）— AI Agent 调用，非人工频繁访问"

实际项目中的 SaaS 运营管理后台（`code/admin/`）：
- 知微运营团队**人工操作**，非 AI 调用
- 每天使用：租户管理 / License签发 / 平台监控
- 与教育 admin 对等

**修正**：承认 admin.nqpf.ziwi.cn 为人工运营入口，与教育 admin.school.ziwi.cn 对等。

### 断裂 2：`nqpf.ziwi.cn` 用户端认知成本高

"新质生产力"是政策术语，工厂用户不认识 nqpf 缩写：
- 车间工人：记不住 n-q-p-f 四个字母
- 口头传递：13 个音节（嗯-秋-批-艾夫-dot-zi-wi-dot-cn）
- 打字困难：输入法无联想

**修正**：建议改为 `mfg.ziwi.cn` 或保留原 `cloud.ziwi.cn` 作为制造入口（此时 cloud 不再做"租户服务中心"）。

### 断裂 3：`help.ziwi.cn` 登录态自动跳转需要 SSO

> "已登录用户根据产品线归属自动跳转"

这个功能需要跨域 SSO 基础设施，Phase 1 没有：
- 两条产品线各自独立认证
- 跨域 Cookie 无法共享
- help.ziwi.cn 无法判断用户归属

**修正**：Phase 1 改为路径式（`help.ziwi.cn/school/` / `help.ziwi.cn/mfg/`），或直接展示两条线入口卡片让用户手动选择。

### 断裂 4：`ai.ziwi.cn` 及其三个子域名 Phase 1 不可执行

ai.ziwi.cn 的定义需要：
- 大模型 API 代理（对接多家模型供应商）
- Token 分销与计费系统
- 用量计量与费用控制
- 多模型路由引擎
- 供应商结算模块

这是一个**完整的新产品线**，需要至少 3-6 个月开发。Phase 1 DNS 配置清单中包含 ai.ziwi.cn 可能导致 DNS 配了但服务 404。

**修正**：ai.ziwi.cn 从 Phase 1 DNS 清单中移除，列为 Phase 3 或独立产品线规划。

---

## ⚠️ 建议优化的 3 项

### 优化 1：`cloud.ziwi.cn` 角色变更需要全量文档同步

V2.0 将 cloud.ziwi.cn 从"制造门户"改为"租户服务中心"，影响：
- `three-tier-role-matrix.md` — 三端访问域名表
- `product-functional-specification.md` — 各处提到的 cloud.ziwi.cn
- `frontend-page-map.md` — 前端路由中涉及 cloud.ziwi.cn 的部分
- `20260620域名规划分析.md` — 我昨天出的分析文档

**建议**：确认此变更后，统一更新所有文档。

### 优化 2：API CNAME 链三层影响延迟

`api.nqpf.ziwi.cn` → CNAME → `api.ziwi.cn` → CNAME → `cloud.ziwi.cn` → A

每次 API 调用增加 ~50ms DNS 解析时间。PDA 仓储操作对延迟敏感。

**建议**：`api.nqpf.ziwi.cn` 改用 A 记录直接指向制造 CVM。

### 优化 3：PDA 终端接入方式需补充说明

`m.nqpf.ziwi.cn` 定义"PDA/PAD/手机 WAP"，三者差异大：
- PDA：独立 App，走 API，需要低延迟
- PAD Web：浏览器访问 m.nqpf.ziwi.cn
- 手机 WAP：浏览器访问，响应式

**建议**：PDA 明确走 `api.nqpf.ziwi.cn`（建议 A 记录），文档中补充 PDA 的域名接入说明。

---

## Phase 1 DNS 配置核减建议

| 原清单 31 条 | 核减 | 理由 |
|:------------|:----:|:------|
| ai.ziwi.cn | ❌ 移除 | Phase 1 无 AI 服务 |
| console.ai.ziwi.cn | ❌ 移除 | Phase 1 无 AI 控制台 |
| api.ai.ziwi.cn | ❌ 移除 | Phase 1 无 AI 网关 |
| proxy.nqpf.ziwi.cn | ❌ 移除 | Phase 1 无敌对隧道需求 |
| **核减后 Phase 1** | **27 条** | |

---

## 结论

**DNS 可以按当前清单配置，但以上 4 处断裂会导致上线后出现以下问题：**
1. admin.nqpf.ziwi.cn 上线后知微运营团队找不到管理入口
2. nqpf.ziwi.cn 新客户记不住域名
3. help.ziwi.cn 自动跳转不工作，显示空白或404
4. ai.ziwi.cn 打开显示 404（服务不存在）

**建议**：先修 4 处断裂，再执行 DNS 配置。
