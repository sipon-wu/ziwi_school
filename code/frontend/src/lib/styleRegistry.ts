/**
 * 风格口径注册表（单一事实源 · 2026-09-11）
 *
 * 为什么要有它：此前"风格"的口径散在 4 处、各写一份——
 *   1. `courseware-h5/renderer.ts` 的 `STYLE_PREFIX_MORPH`（theme 前缀 → 形态）
 *   2. `courseware-h5/renderer.ts` 的 `STYLE_PREFIX_LAYOUT`（theme 前缀 → H5 骨架类）
 *   3. `visualAsset/motifPools.ts` 的 `STYLE_PREFIX`（theme 前缀 → 风格 key）
 *   4. `pptThemes.ts` 的 `GROUP_DECOR`（groupId → PPT 装饰/字体）
 * 四份表口径容易漂移（PPT 与 H5 对"同一种风格"理解不一致），也没人能让它们对齐。
 * 现在统一到本文件：**一处定义，四处消费**。
 *
 * 分层原则（本次目标）：
 *   - **主题（theme_id）管色**：色值仍由 CwTheme / styleDNA 提供，本表只给"代表主题"。
 *   - **风格（styleKey）管形**：H5 骨架类、morph、PPT 装饰与字体，全部由本表给出。
 *
 * 只从 pptThemes 引入 **类型**（编译期擦除），不产生运行时循环依赖。
 */

import type { DecorStyle, StyleMorph } from './pptThemes'
// 版面底层法则 → token（字号阶梯/触控/行高的缺省值单一真源，见 lib/layoutLaw.ts）
import { PT_TO_MM, TYPE, TEXT } from './layoutLaw'

/* ───────────── 字体（PPT 与 H5 共用口径） ───────────── */
export const F_KAI = 'KaiTi, "楷体", "STKaiti", "Microsoft YaHei"'
export const F_SONG = '"宋体", "SimSun", "Microsoft YaHei"'
export const F_HEI = '"黑体", "SimHei", "Microsoft YaHei"'
export const F_YAHEI = 'Microsoft YaHei'

/** 受控风格词表（与 cwTemplate 的 StyleTag 对齐） */
export type StyleKey =
  | 'china' | 'minimal' | 'tech' | 'fresh' | 'academic'
  | 'cartoon' | 'flat' | 'business' | 'basic'

export interface StyleSpec {
  key: StyleKey
  /** 中文名（UI 展示） */
  label: string
  /** theme_id 前缀（CwTheme id → 风格），按数组顺序匹配，长前缀须排在前 */
  prefixes: string[]
  /** CwTheme.groupId 归属（数据库分组 → 风格） */
  groupIds: string[]
  /** H5 骨架类（body 上的 layout-* / 场景骨架选择） */
  h5Layout: string
  /** 形态字典（H5：疏密 / 动效 / 母题） */
  morph: StyleMorph
  /** PPT 装饰风格 */
  decor: DecorStyle
  /** PPT 字体 */
  font: string
  /** 该风格的代表主题（仅作默认落地配色；色值仍以 CwTheme/styleDNA 为准） */
  themeId: string
}

export const STYLES: Record<StyleKey, StyleSpec> = {
  china: {
    key: 'china', label: '国风',
    prefixes: ['zgf-'], groupIds: ['zhongguofeng'],
    h5Layout: 'china', morph: { density: 'tight', motion: 'calm', motif: 'classroom' },
    decor: 'china', font: F_KAI, themeId: 'zgf-ink-wash',
  },
  minimal: {
    key: 'minimal', label: '素净',
    prefixes: ['min-'], groupIds: ['minimal'],
    h5Layout: 'minimal', morph: { density: 'normal', motion: 'calm', motif: 'classroom' },
    decor: 'minimal', font: F_YAHEI, themeId: 'min-classic-blue',
  },
  tech: {
    key: 'tech', label: '科技',
    prefixes: ['te-'], groupIds: ['tech'],
    h5Layout: 'tech', morph: { density: 'tight', motion: 'energetic', motif: 'urban' },
    decor: 'tech', font: F_HEI, themeId: 'te-quantum-blue',
  },
  fresh: {
    key: 'fresh', label: '清新',
    prefixes: ['fr-'], groupIds: ['fresh', 'morandi', 'nature'],
    h5Layout: 'fresh', morph: { density: 'loose', motion: 'lively', motif: 'nature' },
    decor: 'fresh', font: F_YAHEI, themeId: 'fr-mint',
  },
  academic: {
    key: 'academic', label: '严谨',
    prefixes: ['aca-'], groupIds: ['academic'],
    h5Layout: 'academic', morph: { density: 'normal', motion: 'lively', motif: 'classroom' },
    decor: 'academic', font: F_SONG, themeId: 'aca-edu-blue',
  },
  cartoon: {
    key: 'cartoon', label: '卡通',
    prefixes: ['sp-cartoon', 'sp-'], groupIds: ['special'],
    h5Layout: 'cartoon', morph: { density: 'loose', motion: 'energetic', motif: 'playful' },
    decor: 'special', font: F_YAHEI, themeId: 'sp-cartoon',
  },
  flat: {
    key: 'flat', label: '扁平',
    prefixes: [], groupIds: ['gradient'],
    h5Layout: 'basic', morph: { density: 'normal', motion: 'lively', motif: 'playful' },
    decor: 'gradient', font: F_YAHEI, themeId: 'min-geo',
  },
  business: {
    key: 'business', label: '商务',
    prefixes: [], groupIds: ['warm'],
    h5Layout: 'basic', morph: { density: 'normal', motion: 'calm', motif: 'classroom' },
    decor: 'warm', font: F_KAI, themeId: 'min-navy-intellectual',
  },
  basic: {
    key: 'basic', label: '通用',
    prefixes: ['basic'], groupIds: [],
    h5Layout: 'basic', morph: { density: 'normal', motion: 'lively', motif: 'playful' },
    decor: 'minimal', font: F_YAHEI, themeId: 'min-classic-blue',
  },
}

export const STYLE_ORDER: StyleKey[] = [
  'china', 'minimal', 'tech', 'fresh', 'academic', 'cartoon', 'flat', 'business', 'basic',
]

/* ────────────────────────────────────────────────
 * 结构语汇（StructureTokens）—— "风格管形"的**形**就落在这里。
 *
 * 为什么单独抽出来：此前 PPT 与 H5 各写一套"风格长什么样"（PPT 靠 SlideDecor 内联 SVG，
 * H5 靠 renderer 里的 .layout-* CSS），同一个视觉决定被两处写 → 必然漂移。
 * 现在两端**消费同一份 token**：底纹、边栏、角标、标题形态、圆角、边框、列表记号。
 *
 * 这是"纯文字页也能看出风格"的关键：纯文字页此前只有文字块位移，
 * 现在还会带上底纹/边栏/角标/标题规则线等**结构性**差异。
 * ──────────────────────────────────────────────── */
export interface StructureTokens {
  /** 版心内缩比例（0-1）：越大留白越多 */
  gutter: number
  /** 左侧竖边栏：卷轴书脊 / 细线 / 编号条 */
  rail: 'none' | 'scroll' | 'rule' | 'index'
  /** 页面底纹 */
  texture: 'none' | 'grid' | 'dots'
  /** 右上角标 */
  corner: 'none' | 'triangle' | 'seal'
  /** 标题形态 */
  titleStyle: 'plain' | 'underline' | 'centerRule' | 'block'
  /** 卡片/文本框圆角(px) */
  radius: number
  /** 文本框边框形态 */
  border: 'none' | 'hairline' | 'thickLeft' | 'dashed'
  /** 列表行首记号 */
  mark: 'dot' | 'square' | 'dash' | 'none'
}

/** 各风格结构语汇（PPT / H5 共用；一处定义、两端消费） */
export const STYLE_STRUCTURE: Record<StyleKey, StructureTokens> = {
  // 国风：卷轴书脊 + 印章角标 + 居中带线标题 + 破折号记号；大留白
  china:     { gutter: 0.18, rail: 'scroll', texture: 'none', corner: 'seal',     titleStyle: 'centerRule', radius: 4,  border: 'hairline', mark: 'dash' },
  // 科技：左编号条 + 网格底纹 + 三角角标 + 色块标题 + 方点记号；满幅
  tech:      { gutter: 0.05, rail: 'index',  texture: 'grid', corner: 'triangle', titleStyle: 'block',      radius: 2,  border: 'thickLeft', mark: 'square' },
  // 极简：无底纹无边栏 + 下划线标题 + 无线条记号；极限留白
  minimal:   { gutter: 0.26, rail: 'none',   texture: 'none', corner: 'none',     titleStyle: 'underline',  radius: 0,  border: 'hairline', mark: 'none' },
  // 学术：左细线（规整栏）+ 下划线标题 + 方点记号
  academic:  { gutter: 0.08, rail: 'rule',   texture: 'none', corner: 'none',     titleStyle: 'underline',  radius: 2,  border: 'hairline', mark: 'square' },
  // 清新：点阵底纹 + 圆角卡片 + 圆点记号
  fresh:     { gutter: 0.12, rail: 'none',   texture: 'dots', corner: 'none',     titleStyle: 'plain',      radius: 16, border: 'none',      mark: 'dot' },
  // 卡通：点阵底纹 + 大圆角 + 色块标题 + 圆点记号
  cartoon:   { gutter: 0.10, rail: 'none',   texture: 'dots', corner: 'none',     titleStyle: 'block',      radius: 24, border: 'none',      mark: 'dot' },
  flat:      { gutter: 0.10, rail: 'none',   texture: 'none', corner: 'none',     titleStyle: 'plain',      radius: 6,  border: 'none',      mark: 'dot' },
  business:  { gutter: 0.08, rail: 'rule',   texture: 'none', corner: 'none',     titleStyle: 'underline',  radius: 3,  border: 'hairline', mark: 'square' },
  basic:     { gutter: 0.06, rail: 'none',   texture: 'none', corner: 'none',     titleStyle: 'plain',      radius: 8,  border: 'hairline', mark: 'dot' },
}

export function styleStructure(key: StyleKey | ''): StructureTokens {
  return (key && STYLE_STRUCTURE[key]) || STYLE_STRUCTURE.basic
}

/**
 * 无"主色标题底带"的版式（共享规则）。
 *
 * 这些版式的容器造型由内容层按骨架+风格渲染，页面**没有**顶部主色底带，
 * 因此标题文字色必须用 `primary`（而非 `onPrimary`，否则白字白底隐形）。
 * 预览（PptxPreview）与导出（exportPptx）必须同用这一份，否则两端标题表现不一致。
 */
export const FRAMELESS_LAYOUTS: string[] = ['edu-goal', 'edu-explain', 'edu-example', 'edu-summary', 'edu-homework']

export function isFramelessLayout(layout?: string): boolean {
  return !!layout && FRAMELESS_LAYOUTS.includes(layout)
}

/**
 * 内容页标题带高度占画布的比例（共享常量）。
 * 此前预览写 `15.3%`、导出写 `(1.15 / 7.5) * CW_H`——同一个决定两处各自推导，易漂移。
 * 现统一由此处给出：预览用百分比，导出用比例 × 画布高。
 */
export const TITLE_BAND_RATIO = 0.153

/* ────────────────────────────────────────────────
 * 字号层级（共享规则 · 2026-09-12）
 *
 * 问题：此前**没有任何层级约束**——
 *   · 数据层：所有段落/列表统一 fontSize:16，不分主标题/小标题/正文；
 *   · 预览层：正文按**字数**自适应（≤12字 3.6mm > … > 30字 2.4mm），
 *     于是"短正文"可以比"长小标题"还大；
 *   · H5 层：各处散写 font-size，极简的标题(20px) 竟小于读卡(24px)。
 *
 * 现在给出层级与不变量（由 `typeOrderValid()` 断言，E2E 逐页检查）：
 *   title > h3 > bodyMax >= body >= bodyMin >= caption
 *
 * 说明：两种媒介量纲不同（预览用 mm、导出/H5 用 px/pt），故各有一张表；
 * 但**层级关系由同一个断言守护**，任何一张表被改乱都会被 E2E 抓住。
 * ──────────────────────────────────────────────── */

/** 导出与 H5 用的 px 层级（sub = 副标题，介于主标题与小标题之间） */
export const TYPE_SCALE = { title: 30, sub: 24, h3: 22, body: 16, caption: 12 } as const

/** 正文自适应上下界（px）：下限取 H5 媒介纪律 R2 的正文硬下限 16px（此前 13px 低于法则） */
export const BODY_RANGE = { min: TEXT.minBodyPx, max: 18 } as const

/**
 * 预览用的 mm 层级 —— **由法则派生**（2026-09-15 纳入缺省规则，见 lib/layoutLaw.ts）。
 *
 * 规则（媒介纪律-PPT R2/R3）：正文 **≥22pt**；相邻层级差 **≥1.25×**；标题落在 36~44pt。
 * 于是自下而上推：正文 = 22pt → h3 = ×1.25 → sub = ×1.25² → title = ×1.25³（=43pt，落在 36~44 内 ✔）。
 * 注释级 = 正文 / 1.25 ≈ 17.6pt（降一档的边界）。
 *
 * 此前是一组**明显低于法则**的随手值（title 11 / h3 4.8 / bodyMax 3.6 / bodyMin 2.6 ≈ 正文 10pt 与 7pt），
 * 投影上根本不可读 —— 而且 bodyMin 还允许正文再缩到 7pt，等于"用缩小字号掩盖内容过载"（质量宪法 12 明禁）。
 */
export const TYPE_MM = {
  title: +(TYPE.bodyPt * 1.25 ** 3 * PT_TO_MM).toFixed(1),    // 43pt ≈ 15.2mm
  sub: +(TYPE.bodyPt * 1.25 ** 2 * PT_TO_MM).toFixed(1),      // 34pt ≈ 12.1mm
  h3: +(TYPE.bodyPt * 1.25 * PT_TO_MM).toFixed(1),            // 28pt ≈ 9.7mm
  bodyMax: +(TYPE.bodyPt * PT_TO_MM).toFixed(2),              // 22pt = 7.76mm（法则下限，也是常态）
  bodyMin: +(TYPE.bodyPt * PT_TO_MM).toFixed(2),              // 同上：正文不再允许缩小
  caption: +(TYPE.notePt * PT_TO_MM).toFixed(1),              // 18pt ≈ 6.4mm
} as const

/** 各风格页面标题字号（px）——H5 用它保证"标题永远最大"，也供内容元素封顶 */
export const STYLE_TITLE_PX: Record<StyleKey, number> = {
  china: 30, tech: 28, minimal: 20, academic: 26, fresh: 26, cartoon: 28, flat: 26, business: 26, basic: 26,
}

/**
 * H5 内容元素基准字号（px）。生成 CSS 时会统一封顶为 `min(基准, 标题-2px)`，
 * 从而**在结构上不可能出现"内容比标题大"**（极简风格标题 20px、读卡此前 24px 即为此类倒挂）。
 */
export const H5_CONTENT_PX = { readWord: 24, quizOpt: 18, narration: 21, revealBtn: 18 } as const

/* ────────────────────────────────────────────────
 * 页内填充率自适应（autofit · PPT/H5 共享规则 · 2026-09-12）
 *
 * 由来：H5 在 2026-09-11 就定了这套（`fill = 内容高/可用高`，<0.62 sparse、>1.0 dense），
 * 但 PPT 侧一直没接，导致"内容少 → 大片露白"。现在抽成共享规则，两端同口径。
 * 关键：sparse 档允许正文字号**受控上探**到 bodyMax 与 h3 之间（仍 < h3）
 * → 既能"撑满画布"，又不会破坏"标题 > 小标题 > 正文"的层级不变量。
 * ──────────────────────────────────────────────── */
export const FILL_SPARSE = 0.62
export const FILL_DENSE = 1.0

export type FillTier = 'sparse' | 'normal' | 'dense'

export function fillTier(contentH: number, availH: number): FillTier {
  if (!(availH > 0) || !(contentH > 0)) return 'normal'
  const f = contentH / availH
  if (f < FILL_SPARSE) return 'sparse'
  if (f > FILL_DENSE) return 'dense'
  return 'normal'
}

/** 按档位取正文字号（mm，供 PPT 预览） */
export function bodyMmForTier(tier: FillTier): number {
  if (tier === 'sparse') return (TYPE_MM.bodyMax + TYPE_MM.h3) / 2   // 4.2mm，仍 < h3(4.8)
  if (tier === 'dense') return TYPE_MM.bodyMin
  return TYPE_MM.bodyMax
}

/** 按档位取正文字号（px，供导出与 H5）；sparse 上探但 < h3(22) */
export function bodySizeForTier(tier: FillTier): number {
  if (tier === 'sparse') return Math.round((BODY_RANGE.max + TYPE_SCALE.h3) / 2)   // 20px
  if (tier === 'dense') return BODY_RANGE.min
  return BODY_RANGE.max
}

/** 层级不变量：任一表被改乱则返回 false（E2E 与运行期断言都查它） */
export function typeOrderValid(): boolean {
  const px = TYPE_SCALE.title > TYPE_SCALE.sub && TYPE_SCALE.sub > TYPE_SCALE.h3 && TYPE_SCALE.h3 > BODY_RANGE.max
    && BODY_RANGE.max >= TYPE_SCALE.body && TYPE_SCALE.body >= BODY_RANGE.min && BODY_RANGE.min >= TYPE_SCALE.caption
  const mm = TYPE_MM.title > TYPE_MM.sub && TYPE_MM.sub > TYPE_MM.h3 && TYPE_MM.h3 > TYPE_MM.bodyMax
    && TYPE_MM.bodyMax >= TYPE_MM.bodyMin && TYPE_MM.bodyMin >= TYPE_MM.caption
  return px && mm
}

/**
 * 字体是否**合法则**（2026-09-15 纳入缺省规则）：层级不变量之外，再断言"投影可读"的硬下限。
 *   ① 正文 ≥ 22pt（R2）——投影远观可读的下限，低于它等于"用缩小字号塞内容"（质量宪法 12 明禁）
 *   ② 相邻层级差 ≥1.25×（R3）——同屏全可见时，字号是唯一区分手段
 *   ③ 标题落在 36~44pt（R2）
 * 任何一条不满足 → 返回 false，由运行期断言 / E2E 抓住（不再靠人肉目测）。
 */
export function typeLawValid(): boolean {
  const pt = (mm: number) => mm / PT_TO_MM
  const body = pt(TYPE_MM.bodyMin)
  const okBody = body + 0.01 >= TYPE.bodyPt
  const okSteps = pt(TYPE_MM.h3) / pt(TYPE_MM.bodyMax) >= TEXT.typeRatio - 0.01
    && pt(TYPE_MM.sub) / pt(TYPE_MM.h3) >= TEXT.typeRatio - 0.01
    && pt(TYPE_MM.title) / pt(TYPE_MM.sub) >= TEXT.typeRatio - 0.01
  const title = pt(TYPE_MM.title)
  const okTitle = title >= TYPE.titlePt.min - 0.5 && title <= TYPE.titlePt.max + 0.5
  const okH5 = TYPE_SCALE.body >= TEXT.minBodyPx
  return okBody && okSteps && okTitle && okH5
}

/* ────────────────────────────────────────────────
 * 标题拆分（共享规则 · 2026-09-12）
 *
 * 问题：AI 生成的长标题（如"九、跨学科发散一：科学中的'潮'"）直接当标题用，
 * 既挤占版面、又在窄屏折行难读。
 * 规则：**长标题提炼为「短主标题 + 副标题」**，两者合起来完整表达原意（不丢信息）。
 *   · 优先在分隔符（：|｜— 及连续空格）处切分；
 *   · 主标题过短(<3字)或过长(>上限)时退化为按字数硬切；
 *   · 短标题（≤上限）不拆，直接作主标题。
 * PPT（预览 + 导出）与 H5 三处共用本函数，保证两端标题形态一致。
 * ──────────────────────────────────────────────── */

/** 主标题字数上限（含"一、"这类序号） */
export const TITLE_MAIN_MAX = 14

export interface SplitTitle { main: string; sub: string }

/**
 * 副标题才是"补充说明"的一方，理应比主标题更有信息量。
 * 但分隔符切出来的主标题常常更长（如"七、跨学科发散一"8字 vs "科学中的'潮'"6字），
 * 视觉上"副标题比提炼出的主标题还短"反直觉。此时对主标题再做一次提炼：
 * 去掉序号前缀（七、）与尾部序数（一/二…），使其短于副标题。
 */
function refineMain(main: string, sub: string): string {
  if ([...sub].length > [...main].length) return main
  let s = main
    .replace(/^[一二三四五六七八九十百千\d]+\s*[、.．,，]\s*/, '')   // 去"七、"这类序号
    .replace(/[（(]?[一二三四五六七八九十\d]+[）)]?\s*$/, '')        // 去尾部序数"一"
    .trim()
  if (!s) return main
  return [...s].length < [...main].length ? s : main
}

export function splitTitle(raw: string): SplitTitle {
  const rawT = String(raw || '').trim()
  if (!rawT) return { main: '', sub: '' }

  // ① 先剥掉"纯编号标签"（场景六：／第三页：／第2部分：…）——它不承载信息，
  //    若当成主标题，真正的内容会被挤到副标题（实测："场景六：跨学科发散一 —— 科学中的'潮'"）。
  // 必须真的是"标签"才剥：标签词（可带序号）或"第N…"；否则会把正文误当标签丢掉
  const lead = rawT.match(/^((?:(?:场景|封面|课题|题目|导语|引子)\s*[一二三四五六七八九十百千\d]*|第\s*[一二三四五六七八九十百千\d]+\s*(?:页|部分|节|课时|幕|章)?)\s*[：:|｜]\s*)/)
  const label = lead ? lead[1].replace(/[：:|｜]\s*$/, '').trim() : ''
  const t = lead ? rawT.slice(lead[0].length).trim() : rawT
  if (!t) return { main: rawT, sub: '' }

  const chars = [...t]
  const DELIM = /[：:|｜]|—{1,2}|\s{2,}/

  const m = t.match(DELIM)
  // 分隔符至少要落在第 2 个字之后（"观潮——…"这种 2 字主标题也要能拆）
  if (m && m.index != null && m.index >= 2) {
    const main = t.slice(0, m.index).trim()
    const sub = t.slice(m.index + m[0].length).trim()
    // 分隔符切出的主标题要"够短够完整"，否则视为无效切分
    if (sub && [...main].length <= TITLE_MAIN_MAX) {
      return { main: refineMain(main, sub), sub }
    }
  }

  // ② 剥掉标签后已足够短：直接用内容作主标题（标签是序号，不进标题）
  if (chars.length <= TITLE_MAIN_MAX) return { main: t || label, sub: '' }

  // 无有效分隔符但过长：优先在顿号/逗号处切，其次硬切
  const soft = t.match(/[、，,]/)
  if (soft && soft.index != null && soft.index >= 3 && soft.index <= TITLE_MAIN_MAX) {
    return { main: t.slice(0, soft.index).trim(), sub: t.slice(soft.index + 1).trim() }
  }
  return { main: chars.slice(0, TITLE_MAIN_MAX).join(''), sub: chars.slice(TITLE_MAIN_MAX).join('').replace(/^[、，,：:\s]+/, '') }
}

/**
 * 一行是否像"小标题"：短、不以句末标点收尾、且原本不是列表项。
 * 用于把语义层级从"字数"里救回来——短的正文字段不会再被当成标题放大，
 * 而真正的短标题会被明确赋成 h3 档。
 */
export function looksLikeHeading(line: string): boolean {
  const raw = String(line || '')
  // 列表项（• / - / * / + 开头）本身就是正文，绝不能判成标题
  if (/^\s*[•\-*+]\s+\S/.test(raw)) return false
  const s = raw.replace(/^[\s#>]+/, '').trim()
  if (!s || s.length > 18) return false
  if (/[。！？；，,.;:!?、]$/.test(s)) return false
  return true
}

export function styleSpec(k: StyleKey): StyleSpec {
  return STYLES[k] || STYLES.basic
}

/** theme_id 前缀 → 风格 key（匹配不到返回空串，由调用方决定兜底） */
export function styleKeyFromThemeId(themeId: string | undefined): StyleKey | '' {
  const t = themeId || ''
  const hit = STYLE_ORDER.map((k) => STYLES[k])
    .find((s) => s.prefixes.some((p) => t.startsWith(p)))
  return hit ? hit.key : ''
}

/** CwTheme.groupId → 风格 key（匹配不到返回空串） */
export function styleKeyFromGroupId(groupId: string | undefined): StyleKey | '' {
  const g = groupId || ''
  const hit = STYLE_ORDER.map((k) => STYLES[k])
    .find((s) => s.groupIds.includes(g))
  return hit ? hit.key : ''
}

/** 风格标签（StyleTag 字符串）→ 风格 key（非法值返回空串） */
export function styleKeyFromTag(tag: string | undefined): StyleKey | '' {
  const t = (tag || '') as StyleKey
  return t in STYLES ? t : ''
}

/** 风格 → 代表主题（默认落地配色；色值仍以 CwTheme/styleDNA 为准） */
export function themeIdForStyle(styleKey: StyleKey | ''): string {
  return styleKey ? styleSpec(styleKey).themeId : STYLES.basic.themeId
}
