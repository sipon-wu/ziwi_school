/**
 * 教案导出 Word (.docx)
 * 统一底座：HTML-aware 解析（markdown 自动转 HTML），公式节点 / 文本 $...$ 渲染为 PNG 嵌入。
 * 解决"编辑态完美、导出断裂"：content 经 TipTap 编辑后已是 HTML，原 markdown 正则解析会整体失配。
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ShadingType, WidthType,
  Table, TableRow, TableCell, ImageRun,
  Header, Footer, PageNumber,
} from 'docx'
import { marked } from 'marked'
import { parseContentFragments, formulaToPng, type FormulaImage } from './formulaExport'

interface LessonMeta {
  subject: string
  grade: string
  title: string
  textbookUnit?: string
  period?: number
  teacher?: string
  date?: string
  model?: string
}

/** base64 dataURL → Uint8Array（docx 浏览器端 ImageRun 需要） */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || ''
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** 公式 PNG 按目标逻辑像素缩放，高度对齐正文（inline≈12pt, block≈19pt） */
function scaleTransform(img: FormulaImage, displayMode: boolean) {
  const targetH = displayMode ? 26 : 16
  const w = Math.round((img.width * targetH) / Math.max(1, img.height))
  return { width: w, height: targetH }
}

/** 把一段 HTML/文本解析为 docx runs（文本 TextRun + 公式 ImageRun） */
async function buildRuns(html: string, fontSize: number): Promise<(TextRun | ImageRun)[]> {
  const frags = parseContentFragments(html)
  const runs: (TextRun | ImageRun)[] = []
  for (const f of frags) {
    if (f.kind === 'text') {
      if (f.text) runs.push(new TextRun({ text: f.text, size: fontSize, font: 'SimSun' }))
    } else {
      try {
        const img = await formulaToPng(f.latex, { displayMode: f.displayMode, fontSize: f.displayMode ? 24 : 16 })
        runs.push(new ImageRun({
          data: dataUrlToUint8Array(img.dataUrl),
          type: 'png',
          transformation: scaleTransform(img, f.displayMode),
        }))
      } catch {
        runs.push(new TextRun({ text: f.latex, size: fontSize, font: 'SimSun' }))
      }
    }
  }
  if (runs.length === 0) runs.push(new TextRun({ text: '', size: fontSize }))
  return runs
}

const border = { style: BorderStyle.SINGLE, size: 1, color: 'BFBFBF' }
const borders = { top: border, bottom: border, left: border, right: border }
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 }

/** 解析 HTML 正文为 docx 块序列 */
async function htmlToDocxBlocks(html: string): Promise<(Paragraph | Table)[]> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks: (Paragraph | Table)[] = []
  const levelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_2, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4,
  }

  const children = Array.from(doc.body.children)
  for (const el of children) {
    const tag = el.tagName.toLowerCase()
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      const level = Number(tag[1])
      const runs = await buildRuns(el.innerHTML, 26)
      blocks.push(new Paragraph({
        heading: levelMap[level] || HeadingLevel.HEADING_3,
        spacing: { before: 240, after: 120 },
        children: runs,
      }))
    } else if (tag === 'ul' || tag === 'ol') {
      const ordered = tag === 'ol'
      const items = Array.from(el.children)
      const paras = await Promise.all(items.map(async (li, i) => {
        const prefix = ordered ? `${i + 1}. ` : '• '
        const runs = await buildRuns((li as HTMLElement).innerHTML, 21)
        return new Paragraph({
          spacing: { after: 40 }, indent: { left: 480 },
          children: [new TextRun({ text: prefix, size: 21, font: 'SimSun' }), ...runs],
        })
      }))
      blocks.push(...paras)
    } else if (tag === 'table') {
      blocks.push(await tableFromEl(el as HTMLElement))
    } else {
      // p / div / 其他：作为普通段落
      const runs = await buildRuns(el.innerHTML, 21)
      blocks.push(new Paragraph({ spacing: { after: 80, line: 360 }, children: runs }))
    }
  }
  return blocks
}

async function tableFromEl(el: HTMLElement): Promise<Table> {
  const rows = Array.from(el.querySelectorAll('tr'))
  const tableRows = await Promise.all(rows.map(async (r) => {
    const cells = Array.from(r.children)
    const tableCells = await Promise.all(cells.map(async (c) => {
      const runs = await buildRuns((c as HTMLElement).innerHTML, 20)
      return new TableCell({
        borders, width: { size: Math.floor(9026 / Math.max(1, cells.length)), type: WidthType.DXA },
        shading: (c as HTMLElement).tagName.toLowerCase() === 'th' ? { fill: 'F0F4FF', type: ShadingType.CLEAR } : undefined,
        margins: cellMargins,
        children: [new Paragraph({ children: runs })],
      })
    }))
    return new TableRow({ children: tableCells })
  }))
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    rows: tableRows,
  })
}

/** 生成 Word 文档 Blob */
export async function exportLessonPlanToDocx(content: string, meta: LessonMeta): Promise<Blob> {
  let html = content || ''
  if (!(html.trim().startsWith('<') && /<[a-z!]/i.test(html))) {
    try { html = marked.parse(html) as string } catch { html = `<p>${html.replace(/\n/g, '<br/>')}</p>` }
  }
  const bodyBlocks = await htmlToDocxBlocks(html)

  // ── 封面信息 ──
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: meta.title || '教案', bold: true, size: 36, font: 'SimSun' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({ text: `${meta.subject} · ${meta.grade}`, size: 24, font: 'SimSun', color: '666666' }),
        meta.textbookUnit ? new TextRun({ text: ` · ${meta.textbookUnit}`, size: 24, font: 'SimSun', color: '666666' }) : new TextRun({}),
      ],
    }),
  ]

  const infoRows = [
    ['学科', meta.subject],
    ['年级', meta.grade],
    ['课题', meta.title],
    ...(meta.textbookUnit ? [['教材单元', meta.textbookUnit]] as [string, string][] : []),
    ...(meta.period ? [['课时', `第 ${meta.period} 课时`]] as [string, string][] : []),
    ['生成模型', meta.model || 'qwen-plus'],
    ['生成日期', meta.date || new Date().toLocaleDateString('zh-CN')],
  ]

  children.push(
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [2000, 7026],
      rows: infoRows.map(([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              borders, width: { size: 2000, type: WidthType.DXA },
              shading: { fill: 'F0F4FF', type: ShadingType.CLEAR }, margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 21, font: 'SimSun' })] })],
            }),
            new TableCell({
              borders, width: { size: 7026, type: WidthType.DXA }, margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: String(value), size: 21, font: 'SimSun' })] })],
            }),
          ],
        })
      ),
    }),
    new Paragraph({ spacing: { after: 300 }, children: [] }),
  )

  children.push(...bodyBlocks)

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'SimSun', size: 21 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'SimHei' }, paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'SimHei' }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'SimHei' }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        headers: { default: new Header({ children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `知微教学 · ${meta.title || '教案'}`, size: 16, font: 'SimSun', color: '999999' })] }),
        ] }) },
        footers: { default: new Footer({ children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: '第 ', size: 16, font: 'SimSun', color: '999999' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'SimSun', color: '999999' }),
            new TextRun({ text: ' 页', size: 16, font: 'SimSun', color: '999999' }),
          ] }),
        ] }) },
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}

/** 触发下载 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
