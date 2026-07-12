/**
 * 课件导出 PowerPoint (.pptx)
 * 将 AI 生成的 markdown 课件按章节拆分为幻灯片，使用知微主题配色。
 * 浏览器端通过 pptxgenjs 直接生成并触发下载。
 */
import pptxgen from 'pptxgenjs'
import { parseSections } from './parseSections'

const NAVY = '1A3A6B'
const INK = '333333'
const GRAY = '666666'
const FONT = 'Microsoft YaHei'

interface CwOptions {
  subject: string
  grade: string
  title: string
  teacherName?: string
}

function clean(t: string): string {
  return t.replace(/\*{1,3}/g, '').replace(/`/g, '').replace(/_/g, '').trim()
}

/** 将课件正文按行解析为 pptxgenjs 富文本块（段落 / 列表 / 表格行 / 代码块） */
function bodyToRichLines(body: string): any[] {
  const out: any[] = []
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

/** 生成并下载 PPTX */
export async function exportCoursewareToPptx(content: string, opts: CwOptions): Promise<void> {
  const sections = parseSections(content).filter(s => s.title.trim() || s.body.trim())
  const pres: any = new pptxgen()
  pres.layout = 'LAYOUT_WIDE' // 13.3" × 7.5"
  pres.author = '知微教学'
  pres.title = opts.title

  // ── 封面页 ──
  const cover = pres.addSlide()
  cover.background = { color: NAVY }
  cover.addText(opts.title, {
    x: 0.9, y: 2.5, w: 11.5, h: 1.5, fontFace: FONT, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center',
  })
  cover.addText(
    `${opts.subject} · ${opts.grade}${opts.teacherName ? '  ·  ' + opts.teacherName : ''}`,
    { x: 0.9, y: 4.2, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 18, color: 'CADCFC', align: 'center' },
  )
  cover.addText('知微教学 · ziwi.cn', {
    x: 0.9, y: 6.7, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 12, color: '8FA8D6', align: 'center',
  })

  if (sections.length === 0) {
    const only = pres.addSlide()
    only.addText('（课件内容为空）', {
      x: 0.7, y: 3, w: 11.9, h: 1, fontFace: FONT, fontSize: 20, color: GRAY, align: 'center',
    })
  }

  // ── 内容页（每节一页） ──
  sections.forEach((sec, idx) => {
    const slide = pres.addSlide()
    // 顶部标题色带
    slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.3, h: 1.15, fill: { color: NAVY } })
    slide.addText(sec.title || `第 ${idx + 1} 节`, {
      x: 0.7, y: 0, w: 11.9, h: 1.15, fontFace: FONT, fontSize: 24, bold: true, color: 'FFFFFF', valign: 'middle',
    })

    const rich = bodyToRichLines(sec.body)
    if (rich.length) {
      slide.addText(rich, {
        x: 0.7, y: 1.45, w: 11.9, h: 5.7, fontFace: FONT, valign: 'top', align: 'left', color: INK, fontSize: 16, fit: 'shrink',
      })
    } else {
      slide.addText('（本节无正文）', {
        x: 0.7, y: 1.45, w: 11.9, h: 1, fontFace: FONT, fontSize: 14, color: GRAY,
      })
    }

    slide.addText(`${opts.title}  ·  ${idx + 1}`, {
      x: 10.3, y: 7.0, w: 2.6, h: 0.4, fontFace: FONT, fontSize: 10, color: 'B0B8C4', align: 'right',
    })
  })

  await pres.writeFile({ fileName: `${opts.title}.pptx` })
}
