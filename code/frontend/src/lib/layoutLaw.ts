/**
 * 版面底层法则 → 渲染层 token（**缺省规则，单一真源**）
 *
 * 为什么要有这个文件（2026-09-15）：
 *   间距/内边距/触控目标/行高 这些"排版基本功"此前散落在各处硬编码
 *   （CSS 里 10/13/14/16/18px、组件里 px-1/py-1/gap-2.5 …），既不成阶梯，
 *   也**不来自任何法则** —— 于是出现"文字贴框、块间距忽大忽小、手指点不准"。
 *   产品要求（教师原话）：**这些要由平台按 skill 的底层法则当缺省规则保证，不是写在提示词里求模型**。
 *
 * 法则出处（改这里前先读原文，别另立数字）：
 *   · ai-service/skills/courseware-ppt/references/媒介纪律-PPT.md  R2 远观可读 / R3 层次相邻档差 ≥1.25 / R6 字体≤2
 *   · ai-service/skills/courseware-h5/references/媒介纪律-H5.md    R2 正文≥16px、行高≥1.6、行宽20~35字 / R3 触控≥44×44
 *   · ai-service/skills/shared/质量宪法.md 第 11/12 条（层次可辨；内容量与版面平衡，不许靠缩字号塞）
 *
 * 两条纪律：
 *   ① 间距只从 SPACE 阶梯里取（4/8/12/16/24…），不出现 13/18 这类"随手值"；
 *   ② 下限是**硬约束**（触控 44、行高 1.6、正文 16px）—— 渲染层兜底，缺省即合规。
 */

/** 间距阶梯（px）：4 = 半格，8 为主格。用于内边距 / 块间距 / 内元素间距。 */
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const

/** 文字与触控的硬下限（H5 媒介纪律 R2/R3；PPT 见下方 pt 口径）。 */
export const TEXT = {
  /** H5 正文最小字号（px）——R2 */
  minBodyPx: 16,
  /** H5 正文最小行高 ——R2 */
  minLineHeight: 1.6,
  /** 可点元素有效触控区最小边（px）——R3（W3C WCAG 2.5.5 / Apple HIG 44pt） */
  minTouchPx: 44,
  /** 相邻层级字号差 ——PPT 媒介纪律 R3 */
  typeRatio: 1.25,
  /** PPT 正文最小字号（pt）——R2（中文投影惯例） */
  minBodyPt: 22,
} as const

/** 1pt = 0.352778mm（字号阶梯用 pt 定，落到画布用 mm）。 */
export const PT_TO_MM = 0.352778

/**
 * 字号硬阶梯（pt → mm）。**这是"缺省规则"的另一半：渲染层不许把字号压到下限以下。**
 *
 * 法则出处（媒介纪律-PPT R2 / R3）：
 *   · 标题 36~44pt、正文 22~36pt，**正文不得低于 22pt**（中文投影惯例；远观可读）
 *   · 相邻层级字号差 ≥1.25×（同屏全可见时，字号是唯一区分手段）
 *   · 推论（法则原话）：**"字小就意味着内容太多——正确做法是拆页或减字，不是缩字号"**
 *
 * 所以这里给的是**下限**，不是"建议值"：`fs()` 只允许在阶梯内缩放，触底即停。
 * 注释级：法则只要求"正文 ≥ 注释"，取其"降一档"边界 = 正文 / 1.25 ≈ 17.6 → 18pt（也是阶梯值，不是随手值）。
 */
export const TYPE = {
  titlePt: { min: 36, max: 44 },
  /** 小标题 = 正文 × 1.25（档差达标）≈ 27.5 → 28pt */
  subPt: 28,
  /** 正文下限（R2） */
  bodyPt: 22,
  /** 注释 = 正文 / 1.25（降一档） */
  notePt: 18,
  titleMinMm: 12.7,   // 36pt
  titleMaxMm: 15.5,   // 44pt
  subMm: 9.88,        // 28pt
  bodyMm: 7.76,       // 22pt
  noteMm: 6.35,       // 18pt
} as const

export type TypeRole = 'title' | 'sub' | 'body' | 'note'

/** 各级字号下限（mm）——渲染层用来兜底，不许低于它。 */
export const floorMm = (role: TypeRole): number =>
  role === 'title' ? TYPE.titleMinMm : role === 'sub' ? TYPE.subMm : role === 'body' ? TYPE.bodyMm : TYPE.noteMm

/**
 * PPT 画布内的排版 token（单位 = 画布 CSS px；16:9 画布宽 960px ≈ 254mm，故 1px ≈ 0.26mm）。
 * 取值依据：**文字与框线的最小内边距 ≥ 2.5mm（≈10px）**——低于这个值视觉上"字贴着框"；
 * 原先把单元格写成 px-1 py-1（≈1mm）正是这个观感问题的来源。
 */
export const PPT = {
  /** 版心内块与块之间 */
  blockGap: SPACE.sm,
  /** 卡片/容器内边距（横向 ≥10px ≈ 2.6mm） */
  cardPadX: 12,
  cardPadY: 10,
  /** 表格单元格等"小格"内边距 */
  cellPadX: 10,
  cellPadY: SPACE.sm,
  /** 容器内元素之间（标题↔正文↔注释） */
  innerGap: SPACE.sm,
  /** 正文行高（远观可读，别挤） */
  lineHeight: 1.5,
  /** 注释/辅助文字行高 */
  lineHeightTight: 1.4,
} as const

/** H5 场景内的排版 token（px；竖屏近观）。 */
export const H5 = {
  /** 场景内块与块之间（旁白↔对话↔互动） */
  blockGap: SPACE.lg,
  /** 同一块内行与行（气泡之间） */
  rowGap: SPACE.md,
  /** 面板（旁白/互动壳）内边距 */
  panelPadX: SPACE.lg,
  panelPadY: SPACE.md,
  /** 气泡内边距（紧凑块） */
  bubblePadX: SPACE.lg,
  bubblePadY: SPACE.md,
  /** 小元素之间的间距（词卡、选项） */
  itemGap: SPACE.md,
  /** 小标题与其内容之间 */
  labelGap: SPACE.md,
} as const
