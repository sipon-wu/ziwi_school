/**
 * 版本粒度策略 —— **单一事实源**（2026-09-15）。
 *
 * 为什么单独成模块：粒度规则是两个彼此冲突的诉求之间的取舍 ——
 *   ① 教师要求"每次都形成版本"（可回溯）
 *   ② 系统要防"无意反复点保存"把版本列表灌满
 * 规则散在组件里就说不清、也没法验证，所以抽成纯函数：**只有输入与输出，可确定性单测**。
 *
 * 结论（产品口径）：
 *   · 系统生成        → **总是**建版（里程碑）。label 形如 `AI 生成（一稿）`
 *   · 点击【保存草稿】→ 内容完全没变 → 跳过；否则距上一版 < 1 分钟 → **合并**（不建）；≥ 1 分钟 → 建版
 *   · 自动保存        → 同规则，窗口放宽到 3 分钟（自动保存本身就频繁）
 *   · 里程碑（生成 / 换风格前 / 发布）之间**互不合并** —— 只在"同 label 的相邻两次保存"之间做窗口合并，
 *     否则一次换风格快照会把紧接其后的正常保存吞掉（那是两件事，不能混为一版）
 *
 * 注意：**合并 = 跳过这次建版**，不是覆盖旧版本。版本一旦写下就不可改（"版本即证据"）——
 * 被跳过的那次改动仍在草稿里，会在窗口结束后的下一次保存时形成新版本。
 */

/** 触发来源 */
export type VersionTrigger = 'gen' | 'click' | 'auto'

/** 点击保存的合并窗口：1 分钟内的连续保存只留一版（产品定档 2026-09-15） */
export const CLICK_COALESCE_MS = 1 * 60 * 1000
/** 自动保存的节流窗口 */
export const AUTO_THROTTLE_MS = 3 * 60 * 1000

export interface VersionCandidate {
  kind?: string
  label?: string
  created_at?: string
}

export interface VersionPolicyInput {
  trigger: VersionTrigger
  /** 最新一条版本（列表按时间倒序的第一条；不存在传 null） */
  last?: VersionCandidate | null
  /** 当前内容与**最新版本内容**是否相同（调用方用稳定序列化算好，见 CoursewareBuilder.stableJson） */
  contentSame: boolean
  /** 当前时间（可注入，便于测试） */
  now?: number
}

export type VersionDecision = 'create' | 'skip-identical' | 'skip-window'

/** 这次保存该不该形成新版本 */
export function decideVersion(input: VersionPolicyInput): VersionDecision {
  const { trigger, last, contentSame } = input

  // ① 生成是里程碑：总是建版（即使内容与上一版相同 —— 那也是一次新的生成事件）
  if (trigger === 'gen') return 'create'

  const label = '保存草稿'
  // ② 只与"同 label 的最近一次保存"比：里程碑（换风格前/发布版/手工快照）不参与合并
  if (last && last.kind === 'snapshot' && last.label === label) {
    if (contentSame) return 'skip-identical'
    const now = input.now ?? Date.now()
    const at = last.created_at ? new Date(last.created_at).getTime() : 0
    const window = trigger === 'auto' ? AUTO_THROTTLE_MS : CLICK_COALESCE_MS
    if (at && now - at < window) return 'skip-window'
  }
  return 'create'
}
