/**
 * 教案导出 Word (.docx)
 * 将 markdown 教案内容解析为结构化 Word 文档
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ShadingType, WidthType,
  Table, TableRow, TableCell,
  Header, Footer, PageNumber,
} from 'docx'

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

/** 解析 markdown 教案内容为结构化段落 */
function parseContent(markdown: string): { sections: { level: number; title: string; body: string[] }[] } {
  const lines = markdown.split('\n')
  const sections: { level: number; title: string; body: string[] }[] = []
  let current: { level: number; title: string; body: string[] } | null = null

  for (const line of lines) {
    const hMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (hMatch) {
      if (current) sections.push(current)
      current = { level: hMatch[1].length, title: hMatch[2].replace(/\*+/g, '').trim(), body: [] }
    } else if (current) {
      current.body.push(line)
    } else {
      //  preamble before any heading
      if (line.trim()) {
        if (!current) current = { level: 1, title: '', body: [] }
        current.body.push(line)
      }
    }
  }
  if (current) sections.push(current)
  return { sections }
}

function cleanText(t: string): string {
  return t.replace(/\*{1,3}/g, '').replace(/`/g, '').trim()
}

/** 生成 Word 文档 Blob */
export async function exportLessonPlanToDocx(content: string, meta: LessonMeta): Promise<Blob> {
  const { sections } = parseContent(content)
  const children: (Paragraph | Table)[] = []

  // ── 封面信息 ──
  children.push(
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
  )

  // 基本信息表
  const infoRows = [
    ['学科', meta.subject],
    ['年级', meta.grade],
    ['课题', meta.title],
    ...(meta.textbookUnit ? [['教材单元', meta.textbookUnit]] as [string, string][] : []),
    ...(meta.period ? [['课时', `第 ${meta.period} 课时`]] as [string, string][] : []),
    ['生成模型', meta.model || 'qwen-plus'],
    ['生成日期', meta.date || new Date().toLocaleDateString('zh-CN')],
  ]

  const border = { style: BorderStyle.SINGLE, size: 1, color: 'BFBFBF' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 }

  children.push(
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [2000, 7026],
      rows: infoRows.map(([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: 2000, type: WidthType.DXA },
              shading: { fill: 'F0F4FF', type: ShadingType.CLEAR },
              margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 21, font: 'SimSun' })] })],
            }),
            new TableCell({
              borders,
              width: { size: 7026, type: WidthType.DXA },
              margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: String(value), size: 21, font: 'SimSun' })] })],
            }),
          ],
        })
      ),
    }),
    new Paragraph({ spacing: { after: 300 }, children: [] }),
  )

  // ── 教案正文 ──
  const level2heading: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_2,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
  }

  for (const sec of sections) {
    if (sec.title) {
      const hLevel = level2heading[sec.level] || HeadingLevel.HEADING_3
      children.push(
        new Paragraph({
          heading: hLevel,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: sec.title, bold: true, size: 26, font: 'SimSun' })],
        }),
      )
    }
    for (const line of sec.body) {
      const trimmed = cleanText(line)
      if (!trimmed) {
        children.push(new Paragraph({ spacing: { after: 60 }, children: [] }))
        continue
      }
      // 代码块/板书
      if (line.trim().startsWith('```')) continue
      // 表格行
      if (line.trim().startsWith('|')) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: line.trim(), size: 20, font: 'SimSun' })],
          }),
        )
        continue
      }
      // 有序列表
      const olMatch = trimmed.match(/^(\d+)[\.)]\s*(.+)/)
      if (olMatch) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            indent: { left: 480 },
            children: [
              new TextRun({ text: `${olMatch[1]}. `, bold: true, size: 21, font: 'SimSun' }),
              new TextRun({ text: cleanText(olMatch[2]), size: 21, font: 'SimSun' }),
            ],
          }),
        )
        continue
      }
      // 无序列表
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            indent: { left: 480 },
            children: [
              new TextRun({ text: '• ', size: 21, font: 'SimSun' }),
              new TextRun({ text: trimmed.slice(2), size: 21, font: 'SimSun' }),
            ],
          }),
        )
        continue
      }
      // 普通段落
      children.push(
        new Paragraph({
          spacing: { after: 80, line: 360 },
          children: [new TextRun({ text: trimmed, size: 21, font: 'SimSun' })],
        }),
      )
    }
  }

  // ── 构建文档 ──
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'SimSun', size: 21 } },
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'SimHei' },
          paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'SimHei' },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'SimHei' },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `知微教学 · ${meta.title || '教案'}`, size: 16, font: 'SimSun', color: '999999' })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: '第 ', size: 16, font: 'SimSun', color: '999999' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'SimSun', color: '999999' }),
                  new TextRun({ text: ' 页', size: 16, font: 'SimSun', color: '999999' }),
                ],
              }),
            ],
          }),
        },
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
