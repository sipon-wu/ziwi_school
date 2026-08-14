/**
 * 计价抽象层（模板资产域 · 统一计费单位）
 * ─────────────────────────────────────────────────────────────
 * 设计原则（用户拍板 2026-08-13）：
 * 1. 消费层只认抽象额度 CostUnit，不知道自己叫 token / 微币 / 词元；
 * 2. 用户可见词由 UNIT_LABEL 常量控制（当前 'token'，远期 '微币' 仅改此常量）；
 * 3. 定价是策略函数 price(t, ctx)，本期最简 = t.base_cost（运营在 Registry 填，官方模板填 0）；
 *    远期由运营端"知了"助手综合来源/频次/学校套餐/活动折扣算出，消费层无感；
 * 4. authorize(t) 是消费层统一调用入口，本期恒放行（不接余额校验/扣减）；
 *    未来填"余额校验→扣减/提示"分支即可，结构不动。
 *
 * 核心纪律：CoursewareBuilder / applyTemplate / 模板面板 永远只 import
 * CostUnit / authorize / price，绝不出现 token/积分/price_token 具体字眼
 * （展示文案除外，走 UNIT_LABEL）。
 */

// 抽象额度类型：纯数值，单位无关。永不暴露具体货币/代币名。
export type CostUnit = number

// 用户可见单位词（仅展示层使用；远期换"微币/词元"只改此常量）。
export const UNIT_LABEL = 'token'

// 模板来源（决定治理与上架流程，不影响消费层逻辑）。
export type TemplateSource = 'official' | 'curated' | 'user_contributed'

// 模板在 Registry 中的状态（运营端增量纳入规则使用）。
export type TemplateStatus = 'pending' | 'active' | 'rejected'

// 计费元数据：所有模板统一携带，差异只折叠进取值。
export interface CostMeta {
  source: TemplateSource
  /** 基准额度（抽象单位，非具体代币名）；公共模板 = 0。 */
  base_cost: CostUnit
  /** 模板展示名（运营资产域可读名，便于治理视图呈现）。 */
  name?: string
  /** 贡献者标识（user_contributed 时记，本期恒空）。 */
  owner_id?: string
  /** 定价/套餐标识（本期恒 null；远期有偿模板非空）。 */
  price_plan?: string | null
}

// 定价策略上下文（远期由知了助手填充；本期不使用）。
export interface PriceContext {
  schoolId?: string
  userId?: string
  campaignId?: string
}

/**
 * 定价策略：template → CostUnit。
 * 本期：恒等返回 base_cost（运营在 Registry 预填）。
 * 远期：此处替换为调用知了定价服务的实现，消费层无感。
 */
export function price(meta: CostMeta, _ctx?: PriceContext): CostUnit {
  return meta.base_cost
}

export interface AuthorizeResult {
  authorized: boolean
  cost: CostUnit
  /** 本期恒为空；远期可返回"余额不足"等提示键。 */
  reason?: string
}

/**
 * 消费层统一授权入口。
 * 本期：所有模板 base_cost=0 → 恒放行，不触发任何计费 UI。
 * 远期：price>0 时接入余额校验/扣减分支（结构已留，逻辑未实现）。
 */
export function authorize(meta: CostMeta, ctx?: PriceContext): AuthorizeResult {
  const cost = price(meta, ctx)
  // 本期：cost 恒为 0，直接可用。未来在此判断余额并扣减。
  return { authorized: true, cost }
}

// 工具：把任意数值安全规整为 CostUnit（防止 NaN/负数污染）。
export function asCostUnit(v: unknown): CostUnit {
  const n = typeof v === 'number' && isFinite(v) ? v : 0
  return n < 0 ? 0 : n
}
