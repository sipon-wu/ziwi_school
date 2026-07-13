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

const NAVY = '1A3A6B'
const INK = '333333'
const GRAY = '666666'
const FONT = 'Microsoft YaHei'

export interface CwOptions {
  subject: string
  grade: string
  title: string
  teacherName?: string
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

export interface CwSlide {
  kind: 'cover' | 'content'
  title: string
  subtitle?: string
  footer?: string
  rich?: CwRichLine[]
  notes?: string
  pageNo?: number
  total?: number
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
function bodyToRichLines(body: string): CwRichLine[] {
  const out: CwRichLine[] = []
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
      out.push({ text: clean(t.replace(/\|/g, ' ')), options: { fontFace: FONT, fontSize: 14, color: GRAY, breakLine: true, paraSpaceAfter: 6 } })
      continue
    }
    // 无序列表
    const ul = t.match(/^[-*]\s+(.+)/)
    if (ul) {
      out.push({ text: clean(ul[1]), options: { bullet: { indent: 18 }, fontFace: FONT, fontSize: 16, color: INK, breakLine: true, paraSpaceAfter: 9 } })
      continue
    }
    // 有序列表
    const ol = t.match(/^\d+[\.)]\s+(.+)/)
    if (ol) {
      out.push({ text: clean(ol[1]), options: { bullet: { type: 'number', indent: 26 }, fontFace: FONT, fontSize: 16, color: INK, breakLine: true, paraSpaceAfter: 9 } })
      continue
    }
    // 普通段落
    out.push({ text: clean(t), options: { fontFace: FONT, fontSize: 16, color: INK, breakLine: true, paraSpaceAfter: 11 } })
  }
  flushCode()
  return out
}

/** 构建与 PPT 完全一致的幻灯片数据模型（供导出与在线预览共用） */
export function buildCoursewareSlides(content: string, opts: CwOptions): CwSlide[] {
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
      rich: bodyToRichLines(sec.body),
      pageNo: idx + 1,
      total,
      footer: `${opts.title}  ·  ${idx + 1}`,
    })
  })

  return slides
}

/** 将 AI 渲染的 PptSlide[] 转为与导出/预览一致的 CwSlide[]（支持教师备注） */
export function slidesFromPpt(ppt: PptSlide[], opts: CwOptions): CwSlide[] {
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
        text: b, options: { bullet: { indent: 18 }, fontFace: FONT, fontSize: 18, color: INK, breakLine: true, paraSpaceAfter: 12 },
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
}

/** 从课件 Markdown 解析为可编辑提纲（按 ## 分节，每段作为一条要点） */
export function markdownToOutline(md: string): OutlineSlide[] {
  const slides: OutlineSlide[] = []
  let cur: OutlineSlide | null = null
  for (const raw of md.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('## ')) {
      if (cur) slides.push(cur)
      cur = { title: line.slice(3).trim(), bullets: [] }
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
        text: b, options: { bullet: { indent: 18 }, fontFace: FONT, fontSize: 18, color: INK, breakLine: true, paraSpaceAfter: 12 },
      })),
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
    s.bullets.forEach(b => lines.push(`- ${b}`))
    if (s.notes) lines.push('', `> 教师备注：${s.notes}`)
    lines.push('')
  })
  return lines.join('\n')
}

/** 将幻灯片数据模型写入 PPTX 并触发下载 */
export async function exportCoursewareToPptx(
  input: string | CwSlide[],
  opts: CwOptions,
): Promise<void> {
  const slides: CwSlide[] = typeof input === 'string'
    ? buildCoursewareSlides(input, opts)
    : input
  const pres: any = new pptxgen()
  pres.layout = 'LAYOUT_WIDE' // 13.3" × 7.5"
  pres.author = '知微教学'
  pres.title = opts.title

  slides.forEach((s) => {
    if (s.kind === 'cover') {
      const cover = pres.addSlide()
      cover.background = { color: NAVY }
      cover.addText(s.title, {
        x: 0.9, y: 2.5, w: 11.5, h: 1.5, fontFace: FONT, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center',
      })
      cover.addText(s.subtitle || '', {
        x: 0.9, y: 4.2, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 18, color: 'CADCFC', align: 'center',
      })
      cover.addText(s.footer || '', {
        x: 0.9, y: 6.7, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 12, color: '8FA8D6', align: 'center',
      })
      if (s.notes) cover.addNotes(s.notes)
      return
    }

    const slide = pres.addSlide()
    // 顶部标题色带
    slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.3, h: 1.15, fill: { color: NAVY } })
    slide.addText(s.title, {
      x: 0.7, y: 0, w: 11.9, h: 1.15, fontFace: FONT, fontSize: 24, bold: true, color: 'FFFFFF', valign: 'middle',
    })

    if (s.rich && s.rich.length) {
      slide.addText(s.rich, {
        x: 0.7, y: 1.45, w: 11.9, h: 5.7, fontFace: FONT, valign: 'top', align: 'left', color: INK, fontSize: 16, fit: 'shrink',
      })
    } else {
      slide.addText('（本节无正文）', {
        x: 0.7, y: 1.45, w: 11.9, h: 1, fontFace: FONT, fontSize: 14, color: GRAY,
      })
    }

    slide.addText(s.footer || '', {
      x: 10.3, y: 7.0, w: 2.6, h: 0.4, fontFace: FONT, fontSize: 10, color: 'B0B8C4', align: 'right',
    })
    if (s.notes) slide.addNotes(s.notes)
  })

  await pres.writeFile({ fileName: `${opts.title}.pptx` })
}
