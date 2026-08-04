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

const NAVY = '1A3A6B'
const INK = '333333'
const GRAY = '666666'
const FONT = 'Microsoft YaHei'

export interface CwOptions {
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
  type: 'text' | 'image' | 'shape'
  x: number
  y: number
  w: number
  h: number
  /** 旋转角度（度），仅形状/图片支持 */
  rotation?: number
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
}

export interface CwSlide {
  kind: 'cover' | 'content'
  title: string
  subtitle?: string
  footer?: string
  rich?: CwRichLine[]
  notes?: string
  pageNo?: number
  total?: number
  /** 版式：title-body（默认）| title-only | two-col | blank */
  layout?: string
  /** 自由编辑态存在的绝对定位元素；非空时预览/导出优先按此渲染 */
  elements?: CwElement[]
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
  const font = theme.font || FONT
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
    // 普通段落
    out.push({ text: clean(t), options: { fontFace: font, fontSize: 16, color: theme.body, breakLine: true, paraSpaceAfter: 11 } })
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
        footer: '知微教学 · ziwi.cn',
      })
      return
    }
    slides.push({
      kind: 'content',
      title: s.title,
      notes: s.notes || '',
        rich: (s.bullets && s.bullets.length ? s.bullets : [s.title]).map(b => ({
        text: b, options: { bullet: { indent: 18 }, fontFace: theme.font || FONT, fontSize: 18, color: theme.body, breakLine: true, paraSpaceAfter: 12 },
      })),
      pageNo: slides.filter(x => x.kind === 'content').length,
      total,
      footer: `${opts.title}  ·  ${slides.filter(x => x.kind === 'content').length}`,
    })
  })
  return slides
}

/** 可编辑提纲（PPT 课件编辑态：提纲修改 + 页面排序调整） */
export interface OutlineSlide {
  title: string
  bullets: string[]
  notes?: string
  /** 版式：title-body（默认）| title-only | two-col | blank */
  layout?: string
  /** 自由编辑态元素层；为空时按 title+bullets 默认布局 */
  elements?: CwElement[]
}

/** 从课件 Markdown 解析为可编辑提纲（按 ## 分节，每段作为一条要点） */
export function markdownToOutline(md: string): OutlineSlide[] {
  const slides: OutlineSlide[] = []
  let cur: OutlineSlide | null = null
  for (const raw of md.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    // 自由元素层内嵌注释：<!-- CW-EL:[...] --> 还原到当前页 elements
    const elMatch = line.match(/^<!--\s*CW-EL:(.*)\s*-->$/)
    if (elMatch && cur) {
      try { cur.elements = JSON.parse(elMatch[1]) } catch { /* 解析失败则忽略，保留 bullets */ }
      continue
    }
    // 版式标注注释：<!-- layout: edu-xxx --> 写入当前页 layout（AI 生成时自动带上教学版式）
    const layoutMatch = line.match(/^<!--\s*layout:\s*([\w-]+)\s*-->$/)
    if (layoutMatch && cur) {
      cur.layout = layoutMatch[1]
      continue
    }
    if (line.startsWith('## ')) {
      if (cur) slides.push(cur)
      const title = line.slice(3).trim()
      // 总标题页（# 后的首个 ## 或标题等于课件名）视为封面
      const isCover: boolean = !cur && /封面|^课件$|^《.+》$/.test(title)
      cur = { title, bullets: [], layout: isCover ? 'edu-cover' : undefined }
    } else if (cur) {
      cur.bullets.push(line.replace(/^[-*]\s*/, '').replace(/\*{1,3}/g, '').replace(/`/g, ''))
    } else {
      cur = { title: '课件', bullets: [line.replace(/^[-*]\s*/, '')] }
    }
  }
  if (cur) slides.push(cur)
  return slides
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
    footer: '知微教学 · ziwi.cn',
  }]
  outline.forEach((s, i) => {
    slides.push({
      kind: 'content', title: s.title, notes: s.notes || '',
      rich: (s.bullets.length ? s.bullets : [s.title]).map(b => ({
        text: b, options: { bullet: { indent: 18 }, fontFace: theme.font || FONT, fontSize: 18, color: theme.body, breakLine: true, paraSpaceAfter: 12 },
      })),
      elements: s.elements,
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
    const bs = s.elements && s.elements.length ? extractBullets(s.elements) : s.bullets
    bs.forEach(b => lines.push(`- ${b}`))
    if (s.notes) lines.push('', `> 教师备注：${s.notes}`)
    // 内嵌自由元素层（坐标/图片/形状），重新打开时还原；不影响人类可读提纲
    if (s.elements && s.elements.length) lines.push(`<!-- CW-EL:${JSON.stringify(s.elements)} -->`)
    lines.push('')
  })
  return lines.join('\n')
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
export function layoutElements(slide: OutlineSlide, layout?: string): CwElement[] {
  const parts = slide.bullets.length ? slide.bullets : []
  switch (layout) {
    case 'title-only':
      return []
    case 'two-col': {
      const mid = Math.ceil(parts.length / 2)
      return [
        { id: uid(), type: 'text', x: 6, y: 23, w: 42, h: 64, text: parts.slice(0, mid).join('\n'), fontSize: 18, bullet: true },
        { id: uid(), type: 'text', x: 52, y: 23, w: 42, h: 64, text: parts.slice(mid).join('\n'), fontSize: 18, bullet: true },
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
      return [
        { id: uid(), type: 'text', x: 6, y: 23, w: 60, h: 60, text: parts.join('\n') || '要点归纳（填写）', fontSize: 16, bullet: true },
        { id: uid(), type: 'shape', x: 70, y: 28, w: 24, h: 50, shape: 'ellipse', fill: 'E8F7FF' },
      ]
    case 'edu-homework':
      return [
        { id: uid(), type: 'text', x: 6, y: 23, w: 28, h: 60, text: '基础\n（填写）', fontSize: 16, bullet: true },
        { id: uid(), type: 'text', x: 36, y: 23, w: 28, h: 60, text: '提高\n（填写）', fontSize: 16, bullet: true },
        { id: uid(), type: 'text', x: 66, y: 23, w: 28, h: 60, text: '拓展\n（填写）', fontSize: 16, bullet: true },
      ]
    case 'title-body':
    default:
      return parts.length ? [{ id: uid(), type: 'text', x: 6, y: 23, w: 88, h: 64, text: parts.join('\n'), fontSize: 18, bullet: true }] : []
  }
}

/** 进入自由编辑时调用：给尚无 elements 的页物化默认元素（保留 AI 提纲内容） */
export function materializeOutline(outline: OutlineSlide[]): OutlineSlide[] {
  return outline.map((s) => {
    if (s.elements && s.elements.length) return s
    return { ...s, elements: layoutElements(s, s.layout || 'title-body') }
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

function renderElement(slide: any, e: CwElement, CW_W: number, CW_H: number) {
  const x = (e.x / 100) * CW_W
  const y = (e.y / 100) * CW_H
  const w = (e.w / 100) * CW_W
  const h = (e.h / 100) * CW_H
  if (e.type === 'image' && e.src) {
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
  const font = theme.font || FONT
  const is43 = opts.aspect === '4/3'
  const CW_W = is43 ? 10 : 13.3
  const CW_H = 7.5
  const pres: any = new pptxgen()
  pres.defineLayout({ name: 'CW', width: CW_W, height: CW_H })
  pres.layout = 'CW'
  pres.author = '知微教学'
  pres.title = opts.title

  const bandH = (1.15 / 7.5) * CW_H
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
    // 顶部标题色带
    slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: CW_W, h: bandH, fill: { color: theme.primary } })
    slide.addText(s.title, {
      x: 0.7, y: 0, w: titleW, h: bandH, fontFace: font, fontSize: 24, bold: true, color: theme.onPrimary, valign: 'middle',
    })

    if (s.elements && s.elements.length) {
      s.elements.forEach((e) => renderElement(slide, e, CW_W, CW_H))
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
