/**
 * 装饰母题库与选材规则（单一事实源 · 2026-09-11）
 *
 * 规则来源：
 *   - **风格级禁忌** ← `@styles/asset_scope.json`（= `code/ai-service/skills/shared/styles/asset_scope.json`）
 *     该文件同时被服务端 `api_server._load_style_asset_scope()` 读取注入生成 prompt，
 *     放 ai-service 目录内是为了**容器内可达**（前端在本地构建时引用它）。
 *   - **学科级禁忌 / 语义** ← 本文件的 MOTIF_GLYPHS（如"书包为低龄意象，高中学段不适"）。
 *
 * 匹配顺序：**veto 优先**（风格禁忌 ∪ 学科禁忌 → 硬排除）→ 学科母题 → 风格母题 → 正向打分 → 兜底。
 *
 * 为什么要有否定：正向打分在候选都弱时会选"相对最不差"的那个——
 * 这正是 🚦交通灯被塞进《观潮》的机制。否定才能把"绝对不该用"拦下来。
 */

import {
  isVetoed,
  affinityScore,
  type AssetApplicability,
  type AssetExclusions,
  type AssetContext,
} from './types'
import styleRules from '@styles/asset_scope.json'

/* ───────────────────────── 风格级规则（来自共享 JSON） ───────────────────────── */

interface StyleRule {
  name?: string
  motif?: { prefer?: string[]; vetoGlyphs?: string[]; reasons?: string }
}
const RULES = styleRules as unknown as { version: number; styles: Record<string, StyleRule> }

/** 风格 → 该风格下被硬禁用的母题元素（来自风格卡结构化数据） */
export const STYLE_VETO_GLYPHS: Record<string, string[]> = Object.fromEntries(
  Object.entries(RULES.styles).map(([k, v]) => [k, v.motif?.vetoGlyphs ?? []]),
)

/** 风格 → 该风格偏好的母题（来自风格卡结构化数据） */
export const STYLE_PREFER_MOTIF: Record<string, string[]> = Object.fromEntries(
  Object.entries(RULES.styles).map(([k, v]) => [k, v.motif?.prefer ?? []]),
)

/** 读取某风格的完整 asset_scope（供其它渲染端 / 调试面板复用） */
export function assetScopeOf(styleKey: string): StyleRule['motif'] & {
  assetScope?: Record<string, unknown>
} {
  const s = RULES.styles[styleKey] as (StyleRule & { assetScope?: Record<string, unknown> }) | undefined
  return { ...(s?.motif ?? {}), assetScope: s?.assetScope }
}

/* ───────────────────────── 母题元素（含学科级规则） ───────────────────────── */

/** 母题元素（带适用/不适用描述，与 DecorAsset 同构，保持单一模型） */
export interface MotifGlyph {
  glyph: string
  applicability?: AssetApplicability
  /** 学科/学段级禁忌（风格级禁忌由 asset_scope.json 统一提供，此处不重复） */
  exclusions?: AssetExclusions
}

/**
 * 形态母题池：key 与后端 `_STYLE_MORPH` / 前端 `STYLE_PREFIX_MORPH` 的 motif 对齐。
 */
export const MOTIF_GLYPHS: Record<string, MotifGlyph[]> = {
  nature: [
    { glyph: '🌿' }, { glyph: '🍃' }, { glyph: '🌳' }, { glyph: '🌸' },
    { glyph: '🍂' }, { glyph: '🌻' }, { glyph: '🐞' }, { glyph: '☁️' },
  ],
  playful: [
    { glyph: '⭐' }, { glyph: '✨' }, { glyph: '🌈' }, { glyph: '🍎' },
    { glyph: '🍌' }, { glyph: '🎈' }, { glyph: '☁️' }, { glyph: '🦋' },
  ],
  classroom: [
    { glyph: '📚' }, { glyph: '✏️' },
    { glyph: '🎒', exclusions: { subjects: ['高中'], reasons: '书包为低龄意象，高中学段不适' } },
    { glyph: '🖍️', exclusions: { subjects: ['高中'] } },
    { glyph: '📎' }, { glyph: '⭐' }, { glyph: '📐' },
    { glyph: '🎨', exclusions: { subjects: ['数学', '物理', '化学', '生物', '信息技术'], reasons: '画板为艺术语义，理科课题不适' } },
  ],
  // 原 urban 池为城市交通（🏢🏙️🚏🚲🚦🏫🛴），与绝大多数课堂无关 → 改为"科技/探究"母题。
  // 保留 key `urban` 以免破坏 morph 契约（前后端均引用该 key）。
  urban: [
    { glyph: '📊', exclusions: { subjects: ['语文', '历史', '政治', '道德与法治', '美术', '音乐', '英语'], reasons: '数据图表符号，人文艺术类课题会出戏' } },
    { glyph: '📈', exclusions: { subjects: ['语文', '历史', '政治', '道德与法治', '美术', '音乐', '英语'] } },
    { glyph: '🔢', exclusions: { subjects: ['语文', '历史', '政治', '道德与法治', '美术', '音乐', '英语'] } },
    { glyph: '⚙️', exclusions: { subjects: ['语文', '历史', '政治', '道德与法治', '美术', '音乐', '英语'] } },
    { glyph: '🧪', exclusions: { subjects: ['语文', '历史', '政治', '道德与法治', '美术', '音乐', '英语'] } },
    { glyph: '🔬', exclusions: { subjects: ['语文', '历史', '政治', '道德与法治', '美术', '音乐', '英语'] } },
    { glyph: '📐' }, { glyph: '💡' },
  ],
  starlit: [
    { glyph: '🌙' }, { glyph: '⭐' }, { glyph: '✨' }, { glyph: '💫' },
    { glyph: '🌟' }, { glyph: '🪐' }, { glyph: '🌌' }, { glyph: '☄️' },
  ],
}

/** 兼容导出：只要 emoji 字符串的调用方（旧代码）仍可用 */
export const MOTIF_POOL: Record<string, string[]> = Object.fromEntries(
  Object.entries(MOTIF_GLYPHS).map(([k, list]) => [k, list.map((g) => g.glyph)]),
)

/* ───────────────────────── 上下文映射 ───────────────────────── */

/** 口径统一（2026-09-11）：theme 前缀 → 风格 key 由 styleRegistry 单一提供，此处仅转出 */
export { styleKeyFromThemeId } from '../styleRegistry'

/**
 * 学科 → 母题偏好（内容相关性的第一层；后续可由数据驱动进化）。
 * 只在母题与学科明显不搭时改判：理科→数据/探究，人文→书卷，艺术/语言→童趣。
 */
export function motifForSubject(subject: string | undefined): string | null {
  const s = (subject || '').trim()
  if (!s) return null
  if (['数学', '物理', '化学', '生物', '科学', '信息技术', '通用技术'].includes(s)) return 'urban'
  if (['语文', '历史', '政治', '道德与法治', '地理'].includes(s)) return 'classroom'
  if (['美术', '音乐', '英语'].includes(s)) return 'playful'
  return null
}

/** 兜底：任何过滤后为空时用的安全通用元素（书卷/星标，不挑学科） */
const SAFE_FALLBACK: MotifGlyph[] = [{ glyph: '📚' }, { glyph: '⭐' }, { glyph: '✏️' }]

/* ───────────────────────── 选材主函数 ───────────────────────── */

/**
 * 选最终装饰元素：**veto 优先** → 学科母题 / 风格偏好母题 → 正向打分定序 → 兜底。
 *
 * H5 与 PPT 两端都应调用本函数（PPT 端把 glyph 映射到自有 SVG 资产即可），
 * 保证"哪些元素被硬禁用、该按学科还是按风格选"在两端完全一致。
 */
export function pickDecoGlyphs(
  motif: string,
  styleKey: string,
  subject?: string,
  stage?: string,
  semantics?: string[],
  limit = 10,
): string[] {
  const ctx: AssetContext = { styleKey, subject, stage, semantics }
  const styleVeto = new Set(STYLE_VETO_GLYPHS[styleKey] || [])
  /** 综合否决：风格级禁忌 ∪ 学科级禁忌 */
  const vetoed = (g: MotifGlyph) => styleVeto.has(g.glyph) || isVetoed(g, ctx)

  // 候选母题：学科母题 → 传入母题 → 风格偏好母题 → playful
  const prefer = STYLE_PREFER_MOTIF[styleKey] || []
  const subjMotif = motifForSubject(subject)
  const candidateMotifs = [...new Set(
    [subjMotif, motif, ...prefer, 'playful'].filter(Boolean) as string[],
  )]

  // ① veto 优先：取第一个"过滤后非空"的母题池
  let pool: MotifGlyph[] = []
  for (const m of candidateMotifs) {
    const list = (MOTIF_GLYPHS[m] || []).filter((g) => !vetoed(g))
    if (list.length) { pool = list; break }
  }
  if (!pool.length) pool = MOTIF_GLYPHS.playful.filter((g) => !vetoed(g))
  if (!pool.length) pool = SAFE_FALLBACK

  // ② 正向打分定序（同分保持原序，保证确定性）
  const ordered = pool
    .map((g, i) => ({ g, s: affinityScore(g, ctx), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.g)

  // ③ 展开到 limit（不足则循环取用）
  const out: string[] = []
  for (let i = 0; i < Math.min(limit, ordered.length * 2 - 1); i++) {
    out.push(ordered[i % ordered.length].glyph)
  }
  return out
}
