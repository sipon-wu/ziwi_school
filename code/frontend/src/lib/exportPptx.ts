/**
 * 课件导出 PowerPoint (.pptx)
 * 将 AI 生成的 markdown 课件按章节拆分为幻灯片，使用知微主题配色。
 * 浏览器端通过 pptxgenjs 直接生成并触发下载。
 *
 * 同时导出 buildCoursewareSlides()：返回与 PPT 完全一致的幻灯片数据模型，
 * 供「在线预览」组件在浏览器内高保真渲染，所见即所得。
 */
import pptxgen from 'pptxgenjs'
import { parseSections } from './parseSections'
import type { CwTheme } from './pptThemes'
import { DEFAULT_THEME } from './pptThemes'
import type { DecoSpec } from './visualAsset/types'
import type { DecorSlots, DecorItem } from './api'
import type { SlideLayout, SlideSlots } from './cwTemplate'
import { distributeToSlots, getSkeleton, isStructuredLayout, pickContentLayout } from './cwTemplate'
// 风格管形（2026-09-11）：导出必须与预览同口径，几何同样按风格打补丁
import { styleKeyFromThemeId, styleStructure, isFramelessLayout, TITLE_BAND_RATIO, TYPE_SCALE, looksLikeHeading, splitTitle, type StyleKey } from './styleRegistry'
import { singleColumnRect, twoColumnRects } from './styleSkeletons'

const NAVY = '1A3A6B'
const INK = '333333'
const GRAY = '666666'
const FONT = 'Microsoft YaHei'

/**
 * PPTX 的 `typeface` 只接受**单个字体名**，而我们的风格字体是 CSS 字体栈
 * （如 `"黑体", "SimHei", "Microsoft YaHei"`）。直接写入会因内含双引号而截断 XML——
 * 实测 `typeface="黑体"...` 直接变成**空值**（导出字体静默丢失）。
 * 这里取首个字体族并去掉引号。
 */
function pptxFont(css?: string): string {
  if (!css) return FONT
  const first = String(css).split(',')[0].trim().replace(/^["']|["']$/g, '')
  return first || FONT
}

export interface CwOptions {
  /** 任教班级展示名（如"四年级(2)班"）。**没有班级时必须留空，不要拿年级顶替**（2026-09-15 准确性修正） */
  classLabel?: string
  subject: string
  grade: string
  title: string
  teacherName?: string
  /** 课件风格主题（官方模板库），缺省用经典深蓝 */
  theme?: CwTheme
  /** 版心比例：16/9（默认）或 4:3，导出版面跟随 */
  aspect?: '16/9' | '4/3'
}

/** 单行富文本（与 pptxgenjs addText 的 text 对象结构一致） */
export interface CwRichLine {
  text: string
  options: {
    fontFace?: string
    fontSize?: number
    color?: string
    bullet?: { type?: string; indent?: number } | boolean
    breakLine?: boolean
    paraSpaceAfter?: number
  }
}

/**
 * 自由编辑态元素（绝对定位层）。坐标用百分比（0-100），与 16:9 预览和 PPTX 一致。
 * 标题色带由主题固定渲染，elements 是「可拖拽的自由内容层」（文本框/图片/形状）。
 */
export interface CwElement {
  id: string
  /** visual（2026-09-14）：知识结构组件也是**一种元素**（复合对象），与文本框/形状/图片同层同源。
   *  这样编辑态与预览态才可能用同一份数据渲染 —— 此前组件只在预览的渲染分支里临时画，编辑态看不到。 */
  type: 'text' | 'image' | 'shape' | 'visual'
  x: number
  y: number
  w: number
  h: number
  /** 旋转角度（度），仅形状/图片支持 */
  rotation?: number
  /** 锁定：锁定后不可拖动/缩放/旋转（防误触），需右键解锁 */
  locked?: boolean
  // ── 文本 ──
  text?: string
  /** px 基准字号（960 宽画布），导出时约等于 pt */
  fontSize?: number
  /** hex 不带 # */
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: 'left' | 'center' | 'right'
  /** 行距倍数（默认 1.4） */
  lineHeight?: number
  /** 字体（缺省 Microsoft YaHei） */
  fontFamily?: string
  /** 多行文本是否按条目渲染为项目符号 */
  bullet?: boolean
  // ── 形状 ──
  shape?: 'rect' | 'ellipse' | 'line' | 'triangle' | 'roundRect' | 'arrow' | 'star' | 'bubble'
  /** hex 不带 # */
  fill?: string
  // ── 图片 ──
  src?: string
  // ── 知识结构组件（type === 'visual'，2026-09-14）──
  /** 组件载荷（对比卡/时间轴/递进图/生字卡…）。依据上游做法：复合对象（图表/SmartArt）是**独立的元素类型**，
   *  带自己的 rect；渲染由组件自身负责，元素层只负责"它在哪里、多大"。 */
  visual?: VisualBlock
  /** 组合标记（PPT 的 groupId 语义）：共享 groupId 的元素被视作**单个可选中/可移动单元**，
   *  但在数组中仍是独立条目（为将来"取消组合/重设"留口子）。 */
  groupId?: string
  // ── 版式引用与覆盖语义（2026-09-14，对应 PPT 的「占位符 + 局部覆盖」）──
  /** 来源槽位（骨架占位符 key）。**有它且未被 overridden 时，几何跟随当前版式 + 当前风格骨架**
   *  （换风格/换版式即自动重解析，见 resolveElementRect）；教师改动过则固化。
   *  多列 bullet 的槽位不打此标：一个占位符被切成多列，无法从单个矩形反推列宽。 */
  slotKey?: string
  /** 是否已被教师手工改动（拖动/缩放/改字号颜色等）。**缺省（undefined）视为已覆盖** ——
   *  老数据没有这个字段，因此行为与引入前完全一致（冻结），保证零回归。 */
  overridden?: boolean
}

/**
 * 封面信息条的真实值（2026-09-15）
 *
 * 封面下方那条信息带此前是**写死的装饰占位**（标签"年级/学科/教师"，值恒为"—"），
 * 教师看到三个空格子，观感像没做完。现在统一由这里给值：学科 / 年级 / 班级 / 教师署名，
 * 空项直接不出现（不显示"—"占位）。班级用任教班级名，**取不到就不显示**（不拿年级顶替）。
 */
export function coverInfoFrom(opts: CwOptions): Array<{ label: string; value: string }> {
  return [
    { label: '学科', value: opts.subject || '' },
    { label: '年级', value: opts.grade || '' },
    { label: '班级', value: (opts.classLabel || '').trim() },
    { label: '教师', value: (opts.teacherName || '').trim() },
  ].filter(it => it.value !== '')
}

export interface CwSlide {
  kind: 'cover' | 'content'
  title: string
  subtitle?: string
  /** 封面信息条（学科/年级/班级/教师）：只给有值的项，见 coverInfoFrom */
  coverInfo?: Array<{ label: string; value: string }>
  footer?: string
  rich?: CwRichLine[]
  notes?: string
  pageNo?: number
  total?: number
  /** 版式：title-body（默认）| title-only | two-col | blank | edu-* 教学版式 */
  layout?: string
  /** 内容与模板分离的槽位绑定：key=骨架占位符（如 question/solution），value=该槽位内容条目。
   *  有则按骨架几何渲染；无则回退 rich 平铺（兼容旧数据）。 */
  slots?: SlideSlots
  /** 自由编辑态存在的绝对定位元素；非空时预览/导出优先按此渲染 */
  elements?: CwElement[]
  /** 可视化组件（递进图/对比表/时间轴/生字卡等）；非空时按组件渲染知识结构，而非平铺要点 */
  visuals?: SlideVisuals
  /** 装饰插槽（插槽式，非自由画布）：各槽位挂装饰元件引用或背景图 URL */
  decor?: DecorSlots | null
  /** 互动组件（quiz/reveal/readalong/drawing 等）；由明文互动注释或 CW-IT 解析而来，PPT 预览渲染为互动面板 */
  interactive?: SlideInteractive
}

/** AI 渲染返回的 PPT 幻灯片（render-ppt 端点输出） */
export interface PptSlide {
  kind?: 'cover' | 'content'
  title: string
  bullets?: string[]
  notes?: string
}

function clean(t: string): string {
  return t.replace(/\*{1,3}/g, '').replace(/`/g, '').replace(/_/g, '').trim()
}

/** 将课件正文按行解析为 pptxgenjs 富文本块（段落 / 列表 / 表格行 / 代码块） */
function bodyToRichLines(body: string, theme: CwTheme = DEFAULT_THEME): CwRichLine[] {
  const out: CwRichLine[] = []
  const font = pptxFont(theme.font)
  const lines = body.split('\n')
  let inCode = false
  let codeBuf: string[] = []

  const flushCode = () => {
    if (codeBuf.length) {
      out.push({
        text: codeBuf.join('\n'),
        options: { fontFace: 'Consolas', fontSize: 13, color: '33415C', breakLine: true, paraSpaceAfter: 10 },
      })
      codeBuf = []
    }
  }

  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('```')) {
      if (inCode) { flushCode(); inCode = false } else { inCode = true }
      continue
    }
    if (inCode) { codeBuf.push(t); continue }
    if (!t) continue

    // 表格行（保留为纯文本行）
    if (t.startsWith('|')) {
      out.push({ text: clean(t.replace(/\|/g, ' ')), options: { fontFace: font, fontSize: 14, color: theme.subtle, breakLine: true, paraSpaceAfter: 6 } })
      continue
    }
    // 无序列表
    const ul = t.match(/^[-*]\s+(.+)/)
    if (ul) {
      out.push({ text: clean(ul[1]), options: { bullet: { indent: 18 }, fontFace: font, fontSize: 16, color: theme.body, breakLine: true, paraSpaceAfter: 9 } })
      continue
    }
    // 有序列表
    const ol = t.match(/^\d+[\.)]\s+(.+)/)
    if (ol) {
      out.push({ text: clean(ol[1]), options: { bullet: { type: 'number', indent: 26 }, fontFace: font, fontSize: 16, color: theme.body, breakLine: true, paraSpaceAfter: 9 } })
      continue
    }
    // 普通段落：像小标题的走 h3 档，其余走正文档（字号层级共享规则 · 2026-09-12）
    // 此前所有段落统一 16，主标题/小标题/正文在数据层就没有层级 → 导出必然出现字号倒挂。
    const plain = clean(t)
    const isHeading = looksLikeHeading(plain)
    out.push({
      text: plain,
      options: isHeading
        ? { fontFace: font, fontSize: TYPE_SCALE.h3, color: theme.primary, breakLine: true, paraSpaceAfter: 8 }
        : { fontFace: font, fontSize: TYPE_SCALE.body, color: theme.body, breakLine: true, paraSpaceAfter: 11 },
    })
  }
  flushCode()
  return out
}

/** 构建与 PPT 完全一致的幻灯片数据模型（供导出与在线预览共用） */
export function buildCoursewareSlides(content: string, opts: CwOptions): CwSlide[] {
  const theme = opts.theme || DEFAULT_THEME
  const sections = parseSections(content).filter(s => s.title.trim() || s.body.trim())
  const slides: CwSlide[] = []

  // ── 封面页 ──
  slides.push({
    kind: 'cover',
    title: opts.title,
    subtitle: `${opts.subject} · ${opts.grade}${opts.teacherName ? '  ·  ' + opts.teacherName : ''}`,
    coverInfo: coverInfoFrom(opts),
    footer: '知微教学 · ziwi.cn',
  })

  if (sections.length === 0) {
    slides.push({ kind: 'content', title: '提示', rich: [{ text: '（课件内容为空）', options: { fontFace: FONT, fontSize: 20, color: GRAY, breakLine: true } }] })
  }

  // ── 内容页（每节一页） ──
  const total = sections.length || 1
  sections.forEach((sec, idx) => {
    slides.push({
      kind: 'content',
      title: sec.title || `第 ${idx + 1} 节`,
      rich: bodyToRichLines(sec.body, theme),
      pageNo: idx + 1,
      total,
      footer: `${opts.title}  ·  ${idx + 1}`,
    })
  })

  return slides
}

/** 将 AI 渲染的 PptSlide[] 转为与导出/预览一致的 CwSlide[]（支持教师备注） */
export function slidesFromPpt(ppt: PptSlide[], opts: CwOptions): CwSlide[] {
  const theme = opts.theme || DEFAULT_THEME
  const slides: CwSlide[] = []
  const content = ppt.filter(s => (s.kind || 'content') !== 'cover')
  const total = content.length || 1
  ppt.forEach((s, idx) => {
    const kind = (s.kind || (idx === 0 ? 'cover' : 'content')) as 'cover' | 'content'
    if (kind === 'cover') {
      slides.push({
        kind: 'cover',
        title: s.title,
        subtitle: `${opts.subject} · ${opts.grade}${opts.teacherName ? '  ·  ' + opts.teacherName : ''}`,
        coverInfo: coverInfoFrom(opts),
        footer: '知微教学 · ziwi.cn',
      })
      return
    }
    slides.push({
      kind: 'content',
      title: s.title,
      notes: s.notes || '',
        rich: (s.bullets && s.bullets.length ? s.bullets : [s.title]).map(b => ({
        text: b, options: { bullet: { indent: 18 }, fontFace: pptxFont(theme.font), fontSize: 18, color: theme.body, breakLine: true, paraSpaceAfter: 12 },
      })),
      pageNo: slides.filter(x => x.kind === 'content').length,
      total,
      footer: `${opts.title}  ·  ${slides.filter(x => x.kind === 'content').length}`,
    })
  })
  return slides
}

/** H5 互动组件（与 PPT 提纲同源；PPT/Word/PDF 导出忽略，H5 消费） */
export type H5Component =
  | { type: 'reveal'; prompt?: string; answer: string }
  | { type: 'quiz'; question: string; options: string[]; correct: number }
  | { type: 'audio'; src: string; title?: string }
  | { type: 'video'; src: string; title?: string; poster?: string }
  | { type: 'gallery'; images: string[]; direction?: 'h' | 'v' }
  | { type: 'popup'; triggerText: string; content: string }
  | { type: 'readalong'; sentences: { text: string; src: string }[] }
  | { type: 'drawing'; title?: string; prompt?: string }

// ── 可视化组件（真课件核心：呈现知识结构，而非罗列文字要点）──
// 通过 <!-- VISUAL:base64 --> 内嵌于页面（与 CW-EL / CW-IT 同款机制），
// 一页可挂多个组件（如"样子递进"+"声音递进"并列）。
type VisualBlockCore =
  /** 递进图：层层推进（白线 → 水墙 → 战马） */
  | { type: 'sequence'; title?: string; items: { label: string; hint?: string }[] }
  /** 对比表：行=维度、列=阶段的三段式知识结构 */
  | { type: 'compare-table'; title?: string; cols: string[]; rows: { label: string; cells: string[] }[] }
  /** 时间轴：按时间/顺序排列的节点 */
  | { type: 'timeline'; title?: string; nodes: { label: string; desc?: string }[] }
  /** 生字卡：田字格大字 + 拼音 + 组词，支持点读 */
  | { type: 'char-card'; title?: string; chars: { char: string; pinyin?: string; word?: string }[] }
  /** 对比卡：左右两栏辨析（多音字、易混概念） */
  | { type: 'compare-card'; title?: string; pairs: { label?: string; left: string; right: string }[] }
  /** 金句大字：原文重点句强调 */
  | { type: 'quote'; text: string; from?: string }
  /** 示意图：中心主题 + 若干分支（概念辐射） */
  | { type: 'diagram'; title?: string; center: string; branches: { label: string; desc?: string }[] }
  /** 图标卡：图标 + 标题 + 说明的并列要点网格 */
  | { type: 'icon-card'; title?: string; items: { icon?: string; label: string; desc?: string }[] }
  /** 结构图：层级知识体系（每层 = 类目 + 若干子项） */
  | { type: 'structure'; title?: string; levels: { label: string; children: string[] }[] }
  /** 流程图：带箭头的步骤链（>4 步自动换行两行） */
  | { type: 'flow'; title?: string; steps: { label: string; desc?: string }[] }
  /** 标注文本：正文段落 + 需高亮的关键词（适合文本分析/古诗文赏析） */
  | { type: 'annotate'; title?: string; text: string; marks?: string[] }

/**
 * 装饰外观：所有组件共有，与内容结构解耦。
 *
 * 内容结构（type/items/cols…）管"装什么"，deco 管"长什么样"。
 * **缺省时渲染层回退为传统「圆角方框 + 浅色底」，保证已生成的课件视觉不变。**
 */
export type VisualBlock = VisualBlockCore & { deco?: DecoSpec }

const VISUAL_TYPES = ['sequence', 'compare-table', 'timeline', 'char-card', 'compare-card', 'quote',
  'diagram', 'icon-card', 'structure', 'flow', 'annotate'] as const

/** 可视化组件白名单校验（与 isValidComponent 同构，防止非法对象静默丢失） */
export function isValidVisual(v: any): v is VisualBlock {
  if (!v || typeof v !== 'object' || typeof v.type !== 'string') return false
  if (!VISUAL_TYPES.includes(v.type as any)) return false
  switch (v.type) {
    case 'sequence': return Array.isArray(v.items) && v.items.length > 0
    case 'compare-table': return Array.isArray(v.cols) && Array.isArray(v.rows) && v.rows.length > 0
    case 'timeline': return Array.isArray(v.nodes) && v.nodes.length > 0
    case 'char-card': return Array.isArray(v.chars) && v.chars.length > 0
    case 'compare-card': return Array.isArray(v.pairs) && v.pairs.length > 0
    case 'quote': return typeof v.text === 'string' && v.text.length > 0
    case 'diagram': return typeof v.center === 'string' && Array.isArray(v.branches) && v.branches.length > 0
    case 'icon-card': return Array.isArray(v.items) && v.items.length > 0
    case 'structure': return Array.isArray(v.levels) && v.levels.length > 0
    case 'flow': return Array.isArray(v.steps) && v.steps.length > 0
    case 'annotate': return typeof v.text === 'string' && v.text.length > 0
    default: return false
  }
}

/** 单值或数组统一归一化为 VisualBlock[] */
export type SlideVisuals = VisualBlock | VisualBlock[] | null
export function normalizeVisuals(v: SlideVisuals | undefined): VisualBlock[] {
  if (!v) return []
  return Array.isArray(v) ? v.filter(isValidVisual) : (isValidVisual(v) ? [v] : [])
}

/** 可编辑提纲（PPT 课件编辑态：提纲修改 + 页面排序调整） */
export interface OutlineSlide {
  title: string
  bullets: string[]
  notes?: string
  /** 版式：title-body（默认）| title-only | two-col | blank | edu-* 教学版式 */
  layout?: string
  /** 内容与模板分离的槽位绑定：key=骨架占位符，value=该槽位内容条目。
   *  有则按骨架几何渲染；无则回退 bullets 平铺（兼容旧数据）。 */
  slots?: SlideSlots
  /** 自由编辑态元素层；为空时按 title+bullets 默认布局 */
  elements?: CwElement[]
  /** H5 互动组件（手动插槽）；可为单个或数组（可视化拖拽编辑器支持每页多组件）；null/缺省=无互动；PPT 等导出忽略 */
  interactive?: SlideInteractive
  /** 可视化组件（递进图/对比表/时间轴/生字卡等，真课件的知识结构载体）；
   *  可为单个或数组；null/缺省=无（回退为纯文字要点渲染） */
  visuals?: SlideVisuals
  /** 装饰插槽（插槽式，非自由画布）：各槽位挂装饰元件引用或背景图 URL */
  decor?: DecorSlots | null
  /**
   * 透明保真行（2026-09-03，编辑器=兼容工具原则）：
   * 编辑器不理解的原始行（H5 场景页的旁白/气泡/`**角色**`/互动注释如 weather/storm/cycle、
   * PPT 页白名单外的注释如 read/popup 等）原样保留，保存时按原顺序写回，
   * 绝不压成 bullets 文本或丢弃——保证"打开不破坏、保存不改写"。
   */
  keepRaw?: string[]
}

/** 互动组件白名单校验（防止残缺/非法对象静默丢失互动） */
export function isValidComponent(it: any): it is H5Component {
  if (!it || typeof it !== 'object' || typeof it.type !== 'string') return false
  const types = ['reveal', 'quiz', 'audio', 'video', 'gallery', 'popup', 'readalong']
  if (!types.includes(it.type)) return false
  switch (it.type) {
    case 'reveal': return typeof it.answer === 'string'
    case 'quiz': return typeof it.question === 'string' && Array.isArray(it.options) && typeof it.correct === 'number'
    case 'audio': return typeof it.src === 'string'
    case 'video': return typeof it.src === 'string'
    case 'gallery': return Array.isArray(it.images)
    case 'popup': return typeof it.triggerText === 'string' && typeof it.content === 'string'
    case 'readalong': return Array.isArray(it.sentences)
    default: return false
  }
}

/** 单值或数组统一归一化为 H5Component[]（可视化拖拽编辑器支持每页多组件） */
export type SlideInteractive = H5Component | H5Component[] | null
export function normalizeInteractive(it: SlideInteractive | undefined): H5Component[] {
  if (!it) return []
  return Array.isArray(it) ? it.filter(isValidComponent) : (isValidComponent(it) ? [it] : [])
}

/** 将互动组件累积进提纲页（兼容已有数组/单值/空），供 markdownToOutline 解析明文互动注释使用 */
function pushInteractive(cur: OutlineSlide | null, comp: H5Component) {
  if (!cur) return
  cur.interactive = Array.isArray(cur.interactive)
    ? [...cur.interactive, comp]
    : (cur.interactive ? [cur.interactive as H5Component, comp] : comp)
}

/** 从课件 Markdown 解析为可编辑提纲（按 ## 分节，每段作为一条要点） */
export function markdownToOutline(md: string): OutlineSlide[] {
  const slides: OutlineSlide[] = []
  let cur: OutlineSlide | null = null
  // 兼容工具原则（2026-09-03）：scene-* 版式的 H5 页进入"透明保真"模式——
  // 编辑器不把该页旁白/气泡/未知互动注释压成 bullets，原样保留，保存时按原顺序写回。
  let sceneMode = false
  const keepLine = (s: OutlineSlide | null, ln: string) => {
    if (!s) return
    s.keepRaw = s.keepRaw ? [...s.keepRaw, ln] : [ln]
  }
  for (const raw of md.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    // 自由元素层内嵌注释：<!-- CW-EL:base64 --> 还原到当前页 elements
    const elMatch = line.match(/^<!--\s*CW-EL:([A-Za-z0-9+/=]+)\s*-->$/)
    if (elMatch && cur) {
      const els = b64dec(elMatch[1])
      if (els) cur.elements = els
      // 往返保真（2026-09-14）：组件物化后住在元素层（元素 `type:'visual'`），落盘时不再另写
      // VISUAL 注释（见 outlineToMarkdown 的去重说明）。此处把元素层里的组件**反推回 visuals**，
      // 使"单一真源=元素层"下 visuals 仍有值（读取端多处以 normalizeVisuals(s.visuals) 为准）。
      const fromEls = (Array.isArray(els) ? els : [])
        .filter((e: any) => e && e.type === 'visual' && e.visual)
        .map((e: any) => e.visual)
      if (fromEls.length) {
        const seen = new Set((Array.isArray(cur.visuals) ? cur.visuals : cur.visuals ? [cur.visuals as VisualBlock] : [])
          .map((v: any) => JSON.stringify(v)))
        for (const v of fromEls) {
          const k = JSON.stringify(v)
          if (!seen.has(k)) { seen.add(k); cur.visuals = Array.isArray(cur.visuals) ? [...cur.visuals, v] : (cur.visuals ? [cur.visuals as VisualBlock, v] : v) }
        }
      }
      continue
    }
    // H5 互动组件内嵌注释：<!-- CW-IT:base64 --> 还原到当前页 interactive（可多个，累积为数组）
    const itMatch = line.match(/^<!--\s*CW-IT:([A-Za-z0-9+/=]+)\s*-->$/)
    if (itMatch && cur) {
      const it = b64dec<H5Component>(itMatch[1])
      if (it && isValidComponent(it)) {
        cur.interactive = Array.isArray(cur.interactive)
          ? [...cur.interactive, it]
          : (cur.interactive ? [cur.interactive as H5Component, it] : it)
      }
      continue
    }
    // 可视化组件内嵌注释：<!-- VISUAL:base64 --> 还原到当前页 visuals（可多个，累积为数组）
    const visMatch = line.match(/^<!--\s*VISUAL:([A-Za-z0-9+/=]+)\s*-->$/)
    if (visMatch && cur) {
      const v = b64dec<VisualBlock>(visMatch[1])
      if (v && isValidVisual(v)) {
        cur.visuals = Array.isArray(cur.visuals)
          ? [...cur.visuals, v]
          : (cur.visuals ? [cur.visuals as VisualBlock, v] : v)
      }
      continue
    }
    // 文档级总标题（# 课件名）不属于任何一页，仅作为元数据跳过
    if (line.match(/^#\s+/) && !cur) continue
    // 文档级元信息行（如 "> 学科 · 年级"，由 outlineToMarkdown 写出）不属于任何一页，
    // 在 cur 为 null 时跳过，避免被误当成一页"课件"幽灵页
    if (!cur && line.startsWith('>')) continue
    // 版式标注注释：<!-- layout: edu-xxx --> 写入当前页 layout（AI 生成时自动带上教学版式）
    // 明文注释：layout / quiz / readalong / reveal / draw（技能直接输出，非 base64 编码）
    // 解析进结构化字段，避免被当 bullet 文本原样显示；quiz/readalong 用转义 \| 分隔多选项。
    const cm = line.match(/^<!--\s*(\w+)\s*:\s*(.*?)\s*-->\s*$/i)
    if (cm && cur) {
      const kw = cm[1].toLowerCase()
      const val = cm[2]
      if (kw === 'layout') {
        cur.layout = val.trim()
        // scene-* 版式（H5 场景页）→ 整页进入透明保真；PPT edu-*/content-* 保持结构化编辑
        sceneMode = (cur.layout || '').startsWith('scene')
        continue
      }
      if (sceneMode) { keepLine(cur, line); continue }   // 场景页互动注释（weather/quiz/…）原文保留
      if (kw === 'quiz') {
        const parts = val.split(/(?<!\\)\|/).map(s => s.replace(/\\\|/g, '|').trim()).filter(Boolean)
        if (parts.length >= 3) {
          const correct = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(correct)) pushInteractive(cur, { type: 'quiz', question: parts[0], options: parts.slice(1, parts.length - 1), correct })
        }
        continue
      }
      if (kw === 'readalong') {
        const parts = val.split(/(?<!\\)\|/).map(s => s.replace(/\\\|/g, '|').trim()).filter(Boolean)
        if (parts.length) pushInteractive(cur, { type: 'readalong', sentences: parts.map(t => ({ text: t, src: '' })) })
        continue
      }
      if (kw === 'reveal') {
        const seg = val.split('=>')
        pushInteractive(cur, { type: 'reveal', prompt: (seg[0] || '').trim(), answer: (seg[1] || '').trim() })
        continue
      }
      if (kw === 'draw') { pushInteractive(cur, { type: 'drawing', title: val.trim(), prompt: '' }); continue }
      // 白名单外注释（read/audio/video/popup/weather/storm/cycle/focus…）：
      // 编辑器不理解 → 原样保留，绝不压成 bullet 文本或丢弃
      keepLine(cur, line)
      continue
    }
    if (line.startsWith('## ')) {
      if (cur) { flushSlide(cur); slides.push(cur) }
      const title = line.slice(3).trim()
      cur = { title, bullets: [] }
      sceneMode = false
      continue
    }
    // 场景页正文（旁白/气泡/角色声明）：## 已排除，页内其余行全部透明保真
    if (sceneMode && cur) { keepLine(cur, line); continue }
    if (cur) {
      cur.bullets.push(line.replace(/^[-*]\s*/, '').replace(/^#{1,2}\s*/, '').replace(/\*{1,3}/g, '').replace(/`/g, ''))
    } else {
      cur = { title: '课件', bullets: [line.replace(/^[-*]\s*/, '').replace(/^#{1,2}\s*/, '')] }
    }
  }
  if (cur) { flushSlide(cur); slides.push(cur) }
  return slides
}

// 将一页的扁平 bullets 按当前 layout 的骨架自动分发进 slots（内容与模板分离入口）。
// 已带显式 slots 的页不覆盖；无 layout 或未知版式的页不处理。
function flushSlide(s: OutlineSlide) {
  if (s.slots) return
  // 自适应：纯内容页（无显式 layout）按要点数自动选 content-* 版式（1+2→1+3 等）
  if (!s.layout && s.bullets.length >= 2) {
    s.layout = pickContentLayout(s.bullets.length)
  }
  if (isStructuredLayout(s.layout)) {
    const dist = distributeToSlots(s.layout as SlideLayout, s.bullets)
    if (Object.keys(dist).length) s.slots = dist
  }
}

/** 将 AI 渲染的 PptSlide[] 转为可编辑提纲 */
export function pptToOutline(ppt: PptSlide[]): OutlineSlide[] {
  return ppt
    .filter(s => (s.kind || 'content') !== 'cover')
    .map(s => ({ title: s.title, bullets: s.bullets && s.bullets.length ? s.bullets : [s.title], notes: s.notes || '' }))
}

/** 将可编辑提纲转为与导出/预览一致的 CwSlide[] */
export function outlineToSlides(outline: OutlineSlide[], opts: CwOptions): CwSlide[] {
  const theme = opts.theme || DEFAULT_THEME
  const total = outline.length || 1
  const slides: CwSlide[] = [{
    kind: 'cover', title: opts.title,
    subtitle: `${opts.subject} · ${opts.grade}${opts.teacherName ? '  ·  ' + opts.teacherName : ''}`,
    coverInfo: coverInfoFrom(opts),
    footer: '知微教学 · ziwi.cn',
  }]
  outline.forEach((s, i) => {
    slides.push({
      kind: 'content', title: s.title, notes: s.notes || '',
      layout: s.layout,
      slots: s.slots,
      rich: (s.bullets.length ? s.bullets : [s.title]).map(b => ({
        text: b, options: { bullet: { indent: 18 }, fontFace: pptxFont(theme.font), fontSize: 18, color: theme.body, breakLine: true, paraSpaceAfter: 12 },
      })),
      elements: s.elements,
      visuals: s.visuals,
      decor: s.decor || null,
      interactive: s.interactive,
      pageNo: i + 1, total, footer: `${opts.title}  ·  ${i + 1}`,
    })
  })
  return slides
}

/** 将可编辑提纲转回 Markdown（供 Word / PDF 导出与素材库保存，与 PPT 同步） */
export function outlineToMarkdown(outline: OutlineSlide[], opts: CwOptions): string {
  const lines: string[] = [`# ${opts.title}`, '', `> ${opts.subject} · ${opts.grade}`, '']
  outline.forEach(s => {
    lines.push(`## ${s.title}`)
    // 版式保真（2026-09-03）：layout 注释随往返写回——否则骨架在"打开→保存"后丢失
    if (s.layout) lines.push(`<!-- layout: ${s.layout} -->`)
    // 透明保真行：scene 结构/未知注释等编辑器不理解的内容按原顺序写回，不做任何改写
    if (s.keepRaw && s.keepRaw.length) lines.push(...s.keepRaw)
    const bs = s.elements && s.elements.length ? extractBullets(s.elements) : s.bullets
    bs.forEach(b => lines.push(`- ${b}`))
    if (s.notes) lines.push('', `> 教师备注：${s.notes}`)
    // 内嵌自由元素层（坐标/图片/形状），重新打开时还原；不影响人类可读提纲
    if (s.elements && s.elements.length) lines.push(`<!-- CW-EL:${b64enc(s.elements)} -->`)
    // 内嵌 H5 互动组件（base64，避免 -->/换行/引号截断注释）
    if (s.interactive && isValidComponent(s.interactive)) lines.push(`<!-- CW-IT:${b64enc(s.interactive)} -->`)
    // 内嵌可视化组件（递进图/对比表/时间轴/生字卡等，可多个各占一行）
    // 去重（2026-09-14）：组件一旦物化进元素层（元素 `type:'visual'`，已由上面的 CW-EL 落盘），
    // 再写一份 VISUAL 注释就是**同一组件的两份副本**。前端渲染以元素层为准（注释被忽略），
    // 但服务端检查器会读注释 —— 于是"注释里的过时副本"会持续报错
    // （实测：兜底修好 marks 后仍报旧 marks 不在 text 中，就是这份副本造成的）。
    // 故：元素层已承载组件时，不再写 VISUAL 注释（单一真源 = 元素层）。
    const hasVisualEls = !!(s.elements && s.elements.some((e) => (e as any).type === 'visual'))
    if (!hasVisualEls) {
      for (const v of normalizeVisuals(s.visuals)) lines.push(`<!-- VISUAL:${b64enc(v)} -->`)
    }
    lines.push('')
  })
  return lines.join('\n')
}

/** 将任意对象 base64 化（UTF-8 安全），用于内嵌注释，规避特殊字符截断 */
function b64enc(x: any): string {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(x)))) }
  catch { return '' }
}
/** base64 还原（对应 b64enc）；失败返回 null 并上报 */
function b64dec<T = any>(s: string): T | null {
  try { return JSON.parse(decodeURIComponent(escape(atob(s)))) as T }
  catch (e) { reportPersistError('CW-IT/CW-EL 解析失败', e); return null }
}
/** 持久化解析失败上报（不静默吞，便于排查“保存后互动丢失”） */
function reportPersistError(msg: string, e: any) {
  // 仅在开发环境打印，避免污染生产；如需上报可在此接日志端
  if (typeof console !== 'undefined') console.warn('[persist]', msg, e)
}

// ───────────────────────────────────────────────────────────
// 自由编辑态：物化（outline → elements）与回提（elements → bullets）
// ───────────────────────────────────────────────────────────
let _cwElSeq = 0
function uid(prefix = 'el'): string {
  _cwElSeq += 1
  return `${prefix}_${Date.now().toString(36)}_${_cwElSeq}`
}

/** 按版式生成默认自由元素（标题色带由主题固定渲染，不在此层） */
export function layoutElements(slide: OutlineSlide, layout?: string, styleKey?: StyleKey | ''): CwElement[] {
  const parts = slide.bullets.length ? slide.bullets : []
  // 教学目标 / 课堂小结 / 课后作业：有真实 bullets 时不走"三维目标三栏/分层三栏"占位骨架，
  // 直接列 bullets；只有在编辑态无内容时才回退到占位骨架。
  // 几何按风格给（此前写死 6/23/88/64 → 换风格也一样，是"一个头面"的一处来源）
  if (parts.length && (layout === 'edu-goal' || layout === 'edu-summary' || layout === 'edu-homework')) {
    const sc = singleColumnRect(styleKey ?? '')
    return [{ id: uid(), type: 'text', x: sc.x, y: sc.y, w: sc.w, h: sc.h, text: parts.join('\n'), fontSize: 18, bullet: true }]
  }
  // 内容与模板分离：有 slots 时按骨架几何生成元素（与预览/导出一致）；无 slots 但 layout 命中骨架时即时分发（兼容存量）
  // 知识结构组件：作为 visual 元素进入元素层（与文本元素同源 → 编辑态/预览态渲染同一份数据）
  const vis = normalizeVisuals((slide as any).visuals)
  const sk0 = layout && isStructuredLayout(layout) ? getSkeleton(layout as SlideLayout, { styleKey: styleKey ?? '' }) : undefined
  // 组件要占用的槽位：优先专属组件槽（visual），否则图片/信息槽（info-block）。
  // 这些槽位**不参与文本分发** —— 否则分发到该槽的那条文本会随组件一起消失（内容丢失，探针实测）。
  const visSlotKeys: string[] = []
  if (sk0 && vis.length) {
    const k = sk0.placeholders.find((p) => p.kind === 'visual')?.key || sk0.placeholders.find((p) => p.kind === 'info-block')?.key
    if (k) visSlotKeys.push(k)
  }
  // 有组件时不用历史 slots：那是在"没有组件"的前提下分发的；按当前版式重分发并避开组件槽。
  const effSlots = (slide.slots && !vis.length)
    ? slide.slots
    : (layout && isStructuredLayout(layout) ? distributeToSlots(layout as SlideLayout, slide.bullets, { skipKeys: visSlotKeys }) : undefined)
  if (effSlots && layout && isStructuredLayout(layout)) {
    const sk = sk0
    if (sk) {
      const els: CwElement[] = []
      for (const ph of sk.placeholders) {
        // 页标题由顶部标题色带统一渲染，骨架里的 title 占位不再生成元素（否则导出成品会出现“标题”二字）
        if (ph.key === 'title' && layout !== 'cover') continue
        // ── 组件槽位：把知识结构组件物化为 visual 元素 ──
        // ① 专属组件槽（kind='visual'，如 visual-top）；② 兼容图片槽（info-block，如 image-text）——
        //    有组件时优先让组件占用它，避免出现"文字摆在图片位上"的错配。
        if (ph.kind === 'visual' || (ph.kind === 'info-block' && vis.length)) {
          const r = ph.rect!
          if (!vis.length) continue
          if (vis.length === 1) {
            // 单组件：几何直接取自槽位 → 打「引用 + 未覆盖」标，可跟随版式/风格
            els.push({ id: uid(), type: 'visual', visual: vis[0], x: r.x, y: r.y, w: r.w, h: r.h, slotKey: ph.key, overridden: false })
          } else {
            // 多组件共用一个槽位：纵向均分；几何不再等于槽位，故不打引用标（视为已固化）
            const hh = r.h / vis.length
            vis.forEach((b, i) => els.push({ id: uid(), type: 'visual', visual: b, x: r.x, y: r.y + i * hh, w: r.w, h: hh }))
          }
          continue
        }
        const content = effSlots[ph.key] ?? []
        // 无内容的占位不生成元素：避免“思维导图占位”等未填充提示进入导出成品
        if (!content.length) continue
        const display = content.join('\n')
        const r = ph.rect!
        if (ph.kind === 'bullet' && ph.columns && ph.columns > 1) {
          const colW = r.w / ph.columns
          content.forEach((txt, i) => {
            els.push({ id: uid(), type: 'text', x: r.x + i * colW, y: r.y, w: colW, h: r.h, text: txt, fontSize: ph.fontSize || 16, bullet: true })
          })
        } else {
          els.push({
            id: uid(), type: 'text', x: r.x, y: r.y, w: r.w, h: r.h,
            text: display, fontSize: ph.fontSize || (ph.kind === 'title' ? 32 : 16),
            bold: ph.bold ?? (ph.kind === 'title'), align: (ph.align as any) || 'left', bullet: ph.kind === 'bullet',
            // 几何直接取自骨架占位符 → 打「引用 + 未覆盖」标，之后换版式/换风格可跟随
            slotKey: ph.key, overridden: false,
          })
        }
      }
      if (effSlots['__overflow']?.length) {
        els.push({ id: uid(), type: 'text', x: 6, y: 90, w: 88, h: 8, text: effSlots['__overflow'].join('\n'), fontSize: 14, color: '999999' })
      }
      return els
    }
  }
  switch (layout) {
    case 'title-only':
      return []
    case 'two-col': {
      const mid = Math.ceil(parts.length / 2)
      // 非结构化版式同样按风格给几何（此前写死 x:6/52 w:42 → 换风格无变化）
      const { left: L, right: R } = twoColumnRects(styleKey ?? '')
      return [
        { id: uid(), type: 'text', x: L.x, y: L.y, w: L.w, h: L.h, text: parts.slice(0, mid).join('\n'), fontSize: 18, bullet: true },
        { id: uid(), type: 'text', x: R.x, y: R.y, w: R.w, h: R.h, text: parts.slice(mid).join('\n'), fontSize: 18, bullet: true },
      ]
    }
    case 'blank':
      return []
    // ── 教学语义版式：按结构占位生成默认自由元素（老师填空式编辑） ──
    case 'edu-cover':
      return [
        { id: uid(), type: 'text', x: 10, y: 30, w: 80, h: 18, text: slide.title || '课题名称', fontSize: 32, bold: true, align: 'center' },
        { id: uid(), type: 'text', x: 10, y: 56, w: 80, h: 10, text: '年级 / 学科 / 教师', fontSize: 16, align: 'center', color: '666666' },
      ]
    case 'edu-goal':
      // 有 AI 生成的 bullets 时展示真实内容，不再硬编码"知识与技能"占位
      if (parts.length) {
        return [{ id: uid(), type: 'text', x: 6, y: 23, w: 88, h: 64, text: parts.join('\n'), fontSize: 18, bullet: true }]
      }
      return [
        { id: uid(), type: 'text', x: 6, y: 23, w: 28, h: 60, text: '知识与技能\n（填写）', fontSize: 16, bullet: true },
        { id: uid(), type: 'text', x: 36, y: 23, w: 28, h: 60, text: '过程与方法\n（填写）', fontSize: 16, bullet: true },
        { id: uid(), type: 'text', x: 66, y: 23, w: 28, h: 60, text: '情感态度价值观\n（填写）', fontSize: 16, bullet: true },
      ]
    case 'edu-explain':
      return [
        { id: uid(), type: 'text', x: 6, y: 23, w: 88, h: 22, text: slide.bullets[0] || '概念定义（填写）', fontSize: 18, bold: true },
        { id: uid(), type: 'text', x: 6, y: 50, w: 88, h: 38, text: (slide.bullets.slice(1).join('\n') || '要点展开（填写）'), fontSize: 16, bullet: true },
      ]
    case 'edu-example':
      return [
        { id: uid(), type: 'text', x: 6, y: 23, w: 88, h: 26, text: slide.bullets[0] || '题干（填写）', fontSize: 18, bold: true },
        { id: uid(), type: 'text', x: 6, y: 54, w: 88, h: 34, text: (slide.bullets.slice(1).join('\n') || '解答步骤（填写）'), fontSize: 16, bullet: true },
      ]
    case 'edu-summary':
      if (parts.length) {
        return [{ id: uid(), type: 'text', x: 6, y: 23, w: 88, h: 64, text: parts.join('\n'), fontSize: 18, bullet: true }]
      }
      return [
        { id: uid(), type: 'text', x: 6, y: 23, w: 60, h: 60, text: '要点归纳（填写）', fontSize: 16, bullet: true },
        { id: uid(), type: 'shape', x: 70, y: 28, w: 24, h: 50, shape: 'ellipse', fill: 'E8F7FF' },
      ]
    case 'edu-homework':
      if (parts.length) {
        return [{ id: uid(), type: 'text', x: 6, y: 23, w: 88, h: 64, text: parts.join('\n'), fontSize: 18, bullet: true }]
      }
      return [
        { id: uid(), type: 'text', x: 6, y: 23, w: 28, h: 60, text: '基础\n（填写）', fontSize: 16, bullet: true },
        { id: uid(), type: 'text', x: 36, y: 23, w: 28, h: 60, text: '提高\n（填写）', fontSize: 16, bullet: true },
        { id: uid(), type: 'text', x: 66, y: 23, w: 28, h: 60, text: '拓展\n（填写）', fontSize: 16, bullet: true },
      ]
    case 'title-body':
    default: {
      // 正文兜底：几何按风格给（此前写死 x:6 y:23 w:88 h:64）
      const sc = singleColumnRect(styleKey ?? '')
      return parts.length ? [{ id: uid(), type: 'text', x: sc.x, y: sc.y, w: sc.w, h: sc.h, text: parts.join('\n'), fontSize: 18, bullet: true }] : []
    }
  }
}

/** ── 元素几何解析：引用 + 覆盖（2026-09-14）──
 * 背景（实测）：物化（layoutElements）把骨架占位符的 rect 变成写死的 x/y/w/h，元素与骨架/风格**彻底脱钩**；
 * 而 applyTemplate 只改 layout/slots/decor，`lib/cwTemplate.ts` 里对 elements 零处理 → 换模板/换风格时
 * **编辑态毫无变化，预览态却会变**（预览走 slots + getSkeleton(styleKey)），这是「编辑≠预览」的第二个独立成因。
 *
 * 本函数是两态共用的唯一几何出口：
 *   未覆盖（有 slotKey 且 overridden!==true）→ 查当前 layout + 当前风格的骨架占位符（风格补丁在 getSkeleton 内打）
 *   已覆盖（教师改过 / 无 slotKey 的老数据）→ 用元素自身固化的 x/y/w/h
 * 于是「换风格」对未覆盖元素自动生效，且教师手工调过的位置不会被覆盖掉。
 */
export function resolveElementRect(
  el: CwElement,
  layout?: string,
  styleKey?: StyleKey | '',
): { x: number; y: number; w: number; h: number } {
  const own = { x: el.x, y: el.y, w: el.w, h: el.h }
  if (!el.slotKey || el.overridden === true || !layout) return own
  if (!isStructuredLayout(layout)) return own
  const sk = getSkeleton(layout as SlideLayout, { styleKey: styleKey ?? '' })
  const ph = sk?.placeholders.find((p) => p.key === el.slotKey)
  const r = ph?.rect
  if (!r) return own
  return { x: r.x, y: r.y, w: r.w, h: r.h }
}

/**
 * 进入自由编辑时调用：给尚无 elements 的页物化默认元素（保留 AI 提纲内容）。
 * 2026-09-11：新增 styleKey —— 物化出来的默认元素几何也须带风格，
 * 否则这些页（如 title-body）会绕开骨架、换风格完全不变。
 */
/** 该版式能否承载知识结构组件：骨架里有专属组件槽（visual）或图片/信息槽（info-block）。 */
function layoutCanHostVisual(layout: string, styleKey?: StyleKey | ''): boolean {
  if (!isStructuredLayout(layout)) return false
  const sk = getSkeleton(layout as SlideLayout, { styleKey: styleKey ?? '' })
  return !!sk?.placeholders.some((p) => p.kind === 'visual' || p.kind === 'info-block')
}

/** 进入编辑/渲染前调用：保证**每一页都有一份完整的元素层**（文本 + 组件），它是唯一渲染源。
 *  2026-09-14 补齐：此前只物化"尚无 elements"的页，于是老保存的 CW-EL 页里没有组件对象
 *  → 收敛渲染路径后组件会消失。现在改为「缺什么补什么」。
 *  同时做一次版式规范化：页面有组件而版式没有组件槽位 → 提升为 visual-top
 *  （与既有 pickContentLayout 同属"生成器按内容选版式"，避免内容硬塞进不合适的版式而重叠）。 */
export function materializeOutline(outline: OutlineSlide[], styleKey?: StyleKey | ''): OutlineSlide[] {
  return outline.map((s) => {
    const want = (s.layout || 'title-body') as SlideLayout
    const vis = normalizeVisuals((s as any).visuals)
    const layout: SlideLayout = vis.length && !layoutCanHostVisual(want, styleKey) ? 'visual-top' : want
    const changed = layout !== want
    // 版式改了 → 旧 slots 的 key 属旧版式（如 content-2col 的 left/right），必须丢弃重分发，
    // 否则新版式（visual-top 的 visual/body）取不到内容 → 文本整段消失（探针实测踩到）。
    const base = { ...s, layout, ...(changed ? { slots: undefined } : {}) } as OutlineSlide
    const els = s.elements || []
    if (!els.length) {
      return { ...base, elements: layoutElements(base, layout, styleKey) }
    }
    const hasVis = els.some((e) => e.type === 'visual')
    if (!vis.length) return changed ? base : s
    if (hasVis && !changed) return s
    // 组件必须进元素层，而现有元素层没为它留位（旧保存的 CW-EL / 旧版式几何）→ **按版式重排元素层**：
    // 直接追加会与文本重叠；只留旧几何又会与组件打架（两者探针实测）。文本从原元素回提（内容不丢），
    // 形状/图片等非文本元素是教师手工添加的，原样保留。
    const kept = els.filter((e) => e.type !== 'text' && e.type !== 'visual')
    const rebuilt = layoutElements({ ...base, bullets: extractBullets(els) } as OutlineSlide, layout, styleKey)
    return { ...base, elements: [...rebuilt, ...kept] }
  })
}

/** 从 elements 回提纯文本条目（用于发布/导出 doc/pdf 时写入 bullets） */
export function extractBullets(elements?: CwElement[]): string[] {
  if (!elements || !elements.length) return []
  const out: string[] = []
  elements.forEach((e) => {
    if (e.type !== 'text' || !e.text) return
    if (e.bullet) {
      e.text.split('\n').forEach((line) => { if (line.trim()) out.push(line.trim()) })
    } else {
      const t = e.text.trim()
      if (t) out.push(t)
    }
  })
  return out
}

/**
 * 把可视化组件绘制到 PPTX（形状 + 原生表格），与预览端 VisualBlocks 视觉一致。
 * 用 pptxgenjs 的 shape/table，保证导出的是可编辑的原生对象而非图片。
 */
function renderVisualToPptx(
  pres: any, slide: any, v: VisualBlock,
  box: { x: number; y: number; w: number; h: number },
  theme: CwTheme, font: string,
) {
  const p = theme.primary || '1A3A6B'
  const body = theme.body || '333333'
  const subtle = theme.subtle || '777777'
  const vTitle = (v as any).title as string | undefined
  const titleH = vTitle ? 0.38 : 0
  const areaY = box.y + titleH
  const areaH = Math.max(0.4, box.h - titleH)

  if (vTitle) {
    slide.addText(vTitle, { x: box.x, y: box.y, w: box.w, h: titleH, fontFace: font, fontSize: 20, bold: true, color: p })
  }

  if (v.type === 'sequence') {
    const n = v.items.length || 1
    const arrowW = 0.32
    const cellW = (box.w - arrowW * (n - 1)) / n
    v.items.forEach((it, i) => {
      const x = box.x + i * (cellW + arrowW)
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: areaY, w: cellW, h: areaH,
        fill: { color: i === n - 1 ? p : 'FFFFFF' },
        line: { color: p, width: 1 },
        rectRadius: 0.06,
      })
      slide.addText(it.label + (it.hint ? `\n${it.hint}` : ''), {
        x, y: areaY, w: cellW, h: areaH,
        fontFace: font, fontSize: 16, bold: true,
        color: i === n - 1 ? 'FFFFFF' : body, align: 'center', valign: 'middle',
      })
      if (i < n - 1) {
        slide.addText('→', {
          x: x + cellW, y: areaY, w: arrowW, h: areaH,
          fontFace: font, fontSize: 14, bold: true, color: p, align: 'center', valign: 'middle',
        })
      }
    })
    return
  }

  if (v.type === 'compare-table') {
    // 表头 / 行首 / 单元格三级样式，形成清晰层级
    const header = [
      { text: '', options: { fill: { color: p + '26' } } },
      ...v.cols.map(c => ({ text: c, options: { bold: true, fontSize: 15, color: p, fontFace: font, fill: { color: p + '26' } } })),
    ]
    const rows = v.rows.map(r => [
      { text: r.label, options: { bold: true, fontSize: 13, color: p, fontFace: font, fill: { color: p + '14' } } },
      ...v.cols.map((_, j) => ({ text: r.cells?.[j] || '', options: { fontSize: 12, color: body } })),
    ])
    slide.addTable([header, ...rows], {
      x: box.x, y: areaY, w: box.w, h: areaH,
      border: { type: 'solid', color: p + '44', pt: 0.5 },
      fontFace: font, valign: 'middle', align: 'center',
      rowH: areaH / (rows.length + 1),
    })
    return
  }

  if (v.type === 'timeline') {
    // 纵向时间轴：与预览端 VisualBlocks 一致（节点竖向均分，卡片横向占满）
    const n = v.nodes.length || 1
    const nodeH = areaH / n
    const badgeD = Math.min(0.75, nodeH * 0.7)
    const badgeX = box.x
    const lineX = box.x + badgeD / 2 - 0.03
    const cardX = box.x + badgeD + 0.25
    const cardW = Math.max(0.5, box.w - badgeD - 0.25)
    // 竖向主墨线
    slide.addShape(pres.shapes.RECTANGLE, {
      x: lineX, y: areaY + badgeD / 2, w: 0.06, h: Math.max(0.1, areaH - badgeD),
      fill: { color: p }, line: { color: p, width: 0.5 },
    })
    const highlightIdx = n === 3 ? 1 : n - 1
    v.nodes.forEach((nd, i) => {
      const isHi = i === highlightIdx
      const y = areaY + i * nodeH
      const badgeY = y + (nodeH - badgeD) / 2
      slide.addShape(pres.shapes.OVAL, {
        x: badgeX, y: badgeY, w: badgeD, h: badgeD,
        fill: { color: isHi ? p : 'FFFFFF' }, line: { color: p, width: 2 },
      })
      slide.addText(['一', '二', '三', '四', '五'][i] || String(i + 1), {
        x: badgeX, y: badgeY, w: badgeD, h: badgeD,
        fontFace: font, fontSize: isHi ? 24 : 21, bold: true,
        color: isHi ? 'FFFFFF' : p, align: 'center', valign: 'middle',
      })
      const cardH = Math.max(0.4, nodeH * 0.78)
      const cardY = y + (nodeH - cardH) / 2
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: cardX, y: cardY, w: cardW, h: cardH,
        fill: { color: isHi ? p : 'FFFFFF' },
        line: { color: p, width: isHi ? 2 : 1 }, rectRadius: 0.08,
      })
      slide.addText([
        { text: nd.label, options: { fontSize: 23, bold: true, fontFace: font, color: isHi ? 'FFFFFF' : p, breakLine: true } },
        ...(nd.desc ? [{ text: nd.desc, options: { fontSize: 17, color: isHi ? 'F0F0F0' : body } }] : []),
      ], {
        x: cardX + 0.12, y: cardY, w: cardW - 0.24, h: cardH,
        align: 'left', valign: 'middle',
      })
    })
    return
  }

  if (v.type === 'char-card') {
    const n = v.chars.length
    const cols = n > 8 ? 6 : n > 4 ? 4 : Math.max(1, n)
    const rowsN = Math.ceil(n / cols)
    const cw = box.w / cols
    const ch = areaH / rowsN
    v.chars.forEach((c, i) => {
      const x = box.x + (i % cols) * cw
      const y = areaY + Math.floor(i / cols) * ch
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: x + 0.05, y: y + 0.05, w: cw - 0.1, h: ch - 0.1,
        fill: { color: 'FFFFFF' }, line: { color: p, width: 0.75, dashType: 'dash' }, rectRadius: 0.05,
      })
      // 生字 / 拼音 / 组词 三级字号（田字格感：生字足够大）
      const rich: any[] = [{ text: c.char, options: { fontSize: 40, bold: true, fontFace: font, color: body, breakLine: true } }]
      if (c.pinyin) rich.push({ text: c.pinyin, options: { fontSize: 14, bold: true, color: p, breakLine: true } })
      if (c.word) rich.push({ text: c.word, options: { fontSize: 12, color: subtle } })
      slide.addText(rich, {
        x: x + 0.05, y: y + 0.05, w: cw - 0.1, h: ch - 0.1,
        align: 'center', valign: 'middle',
      })
    })
    return
  }

  if (v.type === 'compare-card') {
    const n = v.pairs.length || 1
    const rowH = areaH / n
    v.pairs.forEach((pr, i) => {
      const y = areaY + i * rowH
      const labelW = pr.label ? box.w * 0.18 : 0
      if (pr.label) {
        slide.addText(pr.label, { x: box.x, y, w: labelW, h: rowH, fontFace: font, fontSize: 15, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
      }
      const sideW = (box.w - labelW - 0.5) / 2
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: box.x + labelW, y: y + 0.05, w: sideW, h: rowH - 0.1, fill: { color: 'FFFFFF' }, line: { color: p, width: 0.75 }, rectRadius: 0.05 })
      slide.addText(pr.left, { x: box.x + labelW, y: y + 0.05, w: sideW, h: rowH - 0.1, fontFace: font, fontSize: 15, bold: true, color: body, align: 'center', valign: 'middle' })
      slide.addText('VS', { x: box.x + labelW + sideW, y: y + 0.05, w: 0.5, h: rowH - 0.1, fontFace: font, fontSize: 10, bold: true, color: p, align: 'center', valign: 'middle' })
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: box.x + labelW + sideW + 0.5, y: y + 0.05, w: sideW, h: rowH - 0.1, fill: { color: 'FFFFFF' }, line: { color: p, width: 0.75 }, rectRadius: 0.05 })
      slide.addText(pr.right, { x: box.x + labelW + sideW + 0.5, y: y + 0.05, w: sideW, h: rowH - 0.1, fontFace: font, fontSize: 15, bold: true, color: body, align: 'center', valign: 'middle' })
    })
    return
  }

  if (v.type === 'quote') {
    const fs = v.text.length <= 20 ? 26 : v.text.length <= 40 ? 22 : v.text.length <= 70 ? 19 : 16
    slide.addText(v.text, {
      x: box.x, y: areaY, w: box.w, h: areaH,
      fontFace: font, fontSize: fs, bold: true, color: body,
      align: 'center', valign: 'middle',
    })
    if (v.from) {
      slide.addText(`—— ${v.from}`, { x: box.x, y: areaY + areaH - 0.32, w: box.w, h: 0.3, fontFace: font, fontSize: 12, color: subtle, align: 'right' })
    }
  }
}

function renderElement(pres: any, slide: any, e: CwElement, CW_W: number, CW_H: number, theme: CwTheme, font: string) {
  const x = (e.x / 100) * CW_W
  const y = (e.y / 100) * CW_H
  const w = (e.w / 100) * CW_W
  const h = (e.h / 100) * CW_H
  if (e.type === 'visual' && e.visual) {
    // 组件元素（2026-09-14）：与预览共用同一份组件数据、同一个绘制器，
    // 导出为**原生形状/表格**（可编辑对象），而不是位图。
    renderVisualToPptx(pres, slide, e.visual, { x, y, w, h }, theme, font)
  } else if (e.type === 'image' && e.src) {
    slide.addImage({ data: e.src, x, y, w, h, rotation: e.rotation })
  } else if (e.type === 'shape') {
    const shapeMap: any = { rect: 'rect', ellipse: 'ellipse', line: 'line', triangle: 'triangle' }
    slide.addShape(shapeMap[e.shape || 'rect'], { x, y, w, h, fill: { color: '#' + (e.fill || 'CCCCCC') }, line: { color: '#' + (e.fill || 'CCCCCC') }, rotation: e.rotation })
  } else {
    slide.addText(e.text || '', {
      x, y, w, h,
      fontFace: FONT, fontSize: e.fontSize || 18, color: '#' + (e.color || '222222'),
      bold: e.bold, align: e.align || 'left', bullet: e.bullet || false, valign: 'top',
    })
  }
}

/** 将幻灯片数据模型写入 PPTX 并触发下载 */
export async function exportCoursewareToPptx(
  input: string | CwSlide[],
  opts: CwOptions,
): Promise<void> {
  const slides: CwSlide[] = typeof input === 'string'
    ? buildCoursewareSlides(input, opts)
    : input
  const theme = opts.theme || DEFAULT_THEME
  const font = pptxFont(theme.font)   // 统一净化：CSS 字体栈 → PPTX 单字体名
  const is43 = opts.aspect === '4/3'
  const CW_W = is43 ? 10 : 13.3
  const CW_H = 7.5
  const pres: any = new pptxgen()
  pres.defineLayout({ name: 'CW', width: CW_W, height: CW_H })
  pres.layout = 'CW'
  pres.author = '知微教学'
  pres.title = opts.title

  // 标题带高度：与预览共用同一常量（此前预览 15.3%、导出 (1.15/7.5)*CW_H，两处各自推导）
  const bandH = TITLE_BAND_RATIO * CW_H
  const titleW = CW_W - 1.4
  slides.forEach((s) => {
    if (s.kind === 'cover') {
      const cover = pres.addSlide()
      cover.background = { color: theme.coverBg }
      cover.addText(s.title, {
        x: 0.9, y: 2.5, w: CW_W - 1.8, h: 1.5, fontFace: font, fontSize: 40, bold: true, color: theme.onPrimary, align: 'center',
      })
      cover.addText(s.subtitle || '', {
        x: 0.9, y: 4.2, w: CW_W - 1.8, h: 0.6, fontFace: font, fontSize: 18, color: theme.lightText, align: 'center',
      })
      cover.addText(s.footer || '', {
        x: 0.9, y: 6.7, w: CW_W - 1.8, h: 0.4, fontFace: font, fontSize: 12, color: theme.footer, align: 'center',
      })
      if (s.notes) cover.addNotes(s.notes)
      return
    }

    const slide = pres.addSlide()
    // ── 风格结构语汇（2026-09-11）：导出端此前**完全没有**结构差异，
    //    导致"预览有网格/边栏/角标、导出的 PPTX 却没有"。现与预览消费同一份 token。 ──
    const st = styleStructure(styleKeyFromThemeId(theme.id))
    const frameless = isFramelessLayout(s.layout)
    const p = theme.primary

    // 标题色带：仅"有底带"的版式绘制（此前导出恒画、预览不画 → 两端结构不一致）
    if (!frameless) {
      slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: CW_W, h: bandH, fill: { color: p } })
    }
    const titleColor = frameless ? p : theme.onPrimary
    const titleY = frameless ? 0.3 : 0
    const titleAlign = st.titleStyle === 'centerRule' ? 'center' : 'left'
    // 长标题拆「主标题 + 副标题」两行（共享规则 splitTitle，与预览/H5 同源）
    const { main: tMain, sub: tSub } = splitTitle(s.title)
    if (tSub) {
      slide.addText(tMain, {
        x: 0.7, y: titleY, w: titleW, h: bandH * 0.62, fontFace: font,
        fontSize: TYPE_SCALE.title - 4, bold: true, color: titleColor, valign: 'bottom', align: titleAlign,
      })
      slide.addText(tSub, {
        x: 0.7, y: titleY + bandH * 0.62, w: titleW, h: bandH * 0.38, fontFace: font,
        fontSize: TYPE_SCALE.sub - 6, color: titleColor, valign: 'top', align: titleAlign,
      })
    } else {
      slide.addText(s.title, {
        x: 0.7, y: titleY, w: titleW, h: bandH, fontFace: font, fontSize: TYPE_SCALE.title, bold: true,
        color: titleColor, valign: 'middle', align: titleAlign,
      })
    }
    // 标题形态（下划线 / 色块 / 居中带线）
    if (st.titleStyle === 'underline') {
      slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: titleY + bandH - 0.07, w: 4.0, h: 0.045, fill: { color: p } })
    } else if (st.titleStyle === 'block') {
      slide.addShape(pres.shapes.RECTANGLE, { x: 0.65, y: titleY + bandH * 0.3, w: 0.12, h: bandH * 0.4, fill: { color: p } })
    } else if (st.titleStyle === 'centerRule') {
      slide.addShape(pres.shapes.RECTANGLE, { x: CW_W / 2 - 1.5, y: titleY + bandH - 0.08, w: 3.0, h: 0.035, fill: { color: p } })
    }
    // 左边栏
    if (st.rail === 'scroll') {
      slide.addShape(pres.shapes.RECTANGLE, { x: 0.16, y: 1.5, w: 0.1, h: CW_H - 3.0, fill: { color: p, transparency: 78 }, line: { color: p, width: 1 } })
    } else if (st.rail === 'rule') {
      slide.addShape(pres.shapes.RECTANGLE, { x: 0.2, y: 1.4, w: 0.014, h: CW_H - 2.8, fill: { color: p, transparency: 52 } })
    } else if (st.rail === 'index') {
      for (let i = 0; i < 5; i++) {
        slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 1.45 + i * 0.36, w: 0.12, h: 0.11, fill: { color: p, transparency: i === 0 ? 0 : 70 } })
      }
    }
    // 右上角标
    if (st.corner === 'triangle') {
      slide.addShape(pres.shapes.RECTANGLE, { x: CW_W - 0.5, y: -0.5, w: 1.0, h: 1.0, rotate: 45, fill: { color: p } })
    } else if (st.corner === 'seal') {
      slide.addShape(pres.shapes.RECTANGLE, { x: CW_W - 0.86, y: 0.3, w: 0.48, h: 0.48, fill: { color: 'FFFFFF', transparency: 100 }, line: { color: p, width: 1.5 } })
    }
    // 轻纹理（PPTX 无平铺底纹能力，用少量细线示意，保证"看得出风格"）
    if (st.texture === 'grid') {
      for (let i = 1; i <= 4; i++) slide.addShape(pres.shapes.RECTANGLE, { x: (CW_W / 5) * i, y: 1.35, w: 0.008, h: CW_H - 2.3, fill: { color: p, transparency: 87 } })
      for (let i = 1; i <= 3; i++) slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 1.35 + i * (CW_H - 2.3) / 4, w: CW_W - 0.6, h: 0.008, fill: { color: p, transparency: 87 } })
    } else if (st.texture === 'dots') {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          slide.addShape(pres.shapes.OVAL, { x: 0.5 + c * 2.6, y: 1.6 + r * 1.9, w: 0.07, h: 0.07, fill: { color: p, transparency: 74 } })
        }
      }
    }

    // 内容层：**元素层优先**（与编辑态/预览态同源 → 四端一致）
    // 2026-09-14 修正两处：
    //   ① 此前"有组件就先只画组件并 return"→ 有组件的页**整页文本都进不了 pptx**；
    //   ② renderElement 不认识 visual 元素 → 卡片被丢成空文本框。
    const visList = normalizeVisuals(s.visuals)
    if (s.elements && s.elements.length) {
      s.elements.forEach((e) => renderElement(pres, slide, e, CW_W, CW_H, theme, font))
    } else if (visList.length) {
      // 旧数据（无元素层）：退回按组件渲染（PPTX 原生形状/表格）
      const top = bandH + 0.3
      const areaH = CW_H - top - 0.4
      const eachH = areaH / visList.length
      visList.forEach((v, vi) => {
        const y = top + vi * eachH
        renderVisualToPptx(pres, slide, v, { x: 0.55, y, w: CW_W - 1.1, h: eachH - 0.15 }, theme, font)
      })
      if (s.notes) slide.addNotes(s.notes)
      return
    } else if (isStructuredLayout(s.layout)) {
      // 内容与模板分离：按骨架几何把每个 slot 写成独立文本框（无 slots 时即时分发，兼容存量）
      const effSlots = s.slots ?? distributeToSlots(s.layout as SlideLayout, (s.rich || []).map(r => r.text))
      const sk = getSkeleton(s.layout as SlideLayout, { styleKey: styleKeyFromThemeId(theme.id) })
      if (sk && effSlots) {
        for (const ph of sk.placeholders) {
          if (ph.key === 'title' && (s.layout as SlideLayout) !== 'cover') continue
          const content = effSlots[ph.key] ?? []
          // 导出成品不渲染占位提示文字（编辑态可显示以提示教师填写，但导出/投屏不得出现
          // “思维导图占位”“内容要点”等未填充占位符）
          if (!content.length) continue
          const display = content
          const r = ph.rect!
          const x = (r.x / 100) * CW_W
          const y = (r.y / 100) * CW_H
          const w = (r.w / 100) * CW_W
          const h = (r.h / 100) * CW_H
          const textOpts: any = {
            x, y, w, h,
            fontFace: font,
            fontSize: ph.fontSize || (ph.kind === 'title' ? 28 : 16),
            bold: ph.bold ?? (ph.kind === 'title'),
            color: theme.body,
            align: ph.align || 'left',
            valign: ph.kind === 'title' ? 'middle' : 'top',
            fit: 'shrink',
          }
          if (ph.kind === 'bullet' && ph.columns && ph.columns > 1) {
            // 多列 bullet：每列一个文本框
            const colW = w / ph.columns
            display.forEach((txt, i) => {
              slide.addText(txt, { ...textOpts, x: x + i * colW, y, w: colW, h })
            })
          } else {
            slide.addText(display.map((t) => ({ text: t, options: { bullet: ph.kind === 'bullet' ? { indent: 14 } : undefined, breakLine: true } })), textOpts)
          }
        }
        if (effSlots['__overflow']?.length) {
          slide.addText(effSlots['__overflow'].map((t) => ({ text: t, options: { breakLine: true } })), {
            x: 0.7, y: CW_H - 1.2, w: titleW, h: 1, fontFace: font, fontSize: 14, color: theme.subtle,
          })
        }
      }
    } else if (s.rich && s.rich.length) {
      slide.addText(s.rich, {
        x: 0.7, y: bandH + 0.3, w: titleW, h: CW_H - bandH - 0.6, fontFace: font, valign: 'top', align: 'left', color: theme.body, fontSize: 16, fit: 'shrink',
      })
    } else {
      slide.addText('（本节无正文）', {
        x: 0.7, y: bandH + 0.3, w: titleW, h: 1, fontFace: font, fontSize: 14, color: theme.subtle,
      })
    }

    slide.addText(s.footer || '', {
      x: CW_W - 3, y: CW_H - 0.5, w: 2.7, h: 0.4, fontFace: font, fontSize: 10, color: theme.footer, align: 'right',
    })
    if (s.notes) slide.addNotes(s.notes)
  })

  await pres.writeFile({ fileName: `${opts.title}.pptx` })
}
