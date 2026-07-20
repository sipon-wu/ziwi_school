/**
 * 试卷导出 Word (.docx)
 * 生成可打印的学生试卷 + 教师答案卷
 * 公式（题干/选项/答案中的 $...$ 与 data-formula 节点）统一渲染为 PNG 嵌入。
 */
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType,
  Table, ImageRun,
  Header, Footer, PageNumber,
} from 'docx'
import { QUESTION_TYPE_LABELS } from './TeachingContext'
import { parseContentFragments, formulaToPng, type FormulaImage } from './formulaExport'

interface ExamQuestion {
  id: number
  type: 'choice'|'fill'|'calculation'|'truefalse'|'short_answer'
  content: string
  options?: string[]
  answer: string
  difficulty: string
  point?: string
}

interface ExamMeta {
  subject: string
  grade: string
  title: string
  difficulty: string
  teacherName: string
  date?: string
  totalScore?: number
}

/** base64 dataURL → Uint8Array */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || ''
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function scaleTransform(img: FormulaImage, displayMode: boolean) {
  const targetH = displayMode ? 26 : 16
  const w = Math.round((img.width * targetH) / Math.max(1, img.height))
  return { width: w, height: targetH }
}

const SIZE = 21

/** 把题干/选项文本解析为 docx runs（文本 + 公式图片） */
async function buildRuns(text: string): Promise<(TextRun | ImageRun)[]> {
  const frags = parseContentFragments(text || '')
  const runs: (TextRun | ImageRun)[] = []
  for (const f of frags) {
    if (f.kind === 'text') {
      if (f.text) runs.push(new TextRun({ text: f.text, size: SIZE, font: 'SimSun' }))
    } else {
      try {
        const img = await formulaToPng(f.latex, { displayMode: f.displayMode, fontSize: f.displayMode ? 24 : 16 })
        runs.push(new ImageRun({
          data: dataUrlToUint8Array(img.dataUrl),
          type: 'png',
          transformation: scaleTransform(img, f.displayMode),
        }))
      } catch {
        runs.push(new TextRun({ text: f.latex, size: SIZE, font: 'SimSun' }))
      }
    }
  }
  if (runs.length === 0) runs.push(new TextRun({ text: '', size: SIZE }))
  return runs
}

/** 生成学生试卷（无答案） */
export async function exportExamPaper(questions: ExamQuestion[], meta: ExamMeta, paperSize: 'A4' | 'A3' | 'A3_3' = 'A4'): Promise<Blob> {
  const children: (Paragraph|Table)[] = []

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 120 },
      children: [new TextRun({ text: meta.title || `${meta.subject}${meta.grade}练习`, size: 32, bold: true, font: 'SimHei' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 40 },
      children: [new TextRun({ text: `${meta.subject} · ${meta.grade}  |  难度: ${meta.difficulty}  |  满分: ${meta.totalScore || 100}分`, size: 20, font: 'SimSun', color: '666666' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 400 },
      children: [new TextRun({ text: `姓名: ________  班级: ________  得分: ________`, size: 20, font: 'SimSun' })],
    }),
  )

  const typeName: Record<string,string> = QUESTION_TYPE_LABELS
  let qi = 0
  for (const q of questions) {
    qi++
    const tName = typeName[q.type] || '题目'
    const score = Math.round((meta.totalScore || 100) / questions.length)
    const contentRuns = await buildRuns(q.content)
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [
          new TextRun({ text: `${qi}. `, size: SIZE, font: 'SimSun' }),
          new TextRun({ text: `[${tName}] `, size: 16, font: 'SimSun', color: '888888' }),
          ...contentRuns,
          new TextRun({ text: ` (${score}分)`, size: 16, font: 'SimSun', color: 'aaaaaa' }),
        ],
      }),
    )

    if (q.type === 'choice' && q.options?.length) {
      for (const opt of q.options) {
        const optRuns = await buildRuns(opt)
        children.push(new Paragraph({
          indent: { left: 480 }, spacing: { after: 40 },
          children: [new TextRun({ text: `    `, size: SIZE, font: 'SimSun' }), ...optRuns],
        }))
      }
    }

    if (['fill','calculation','short_answer'].includes(q.type)) {
      children.push(new Paragraph({ spacing: { before: 40, after: 100 }, children: [] }))
      for (let i = 0; i < 3; i++) {
        children.push(new Paragraph({
          spacing: { after: 20 },
          children: [new TextRun({ text: '________________________________________', size: 16, font: 'SimSun', color: 'cccccc' })],
        }))
      }
    }
  }

  return buildDoc(children, meta, '试卷', paperSize)
}

/** 生成教师答案卷（含答案） */
export async function exportExamAnswer(questions: ExamQuestion[], meta: ExamMeta, paperSize: 'A4' | 'A3' | 'A3_3' = 'A4'): Promise<Blob> {
  const children: (Paragraph|Table)[] = []

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 120 },
      children: [new TextRun({ text: `${meta.title || '试卷'} — 参考答案`, size: 28, bold: true, font: 'SimHei', color: 'cc0000' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 300 },
      children: [new TextRun({ text: `${meta.subject} · ${meta.grade}  |  教师: ${meta.teacherName}`, size: 18, font: 'SimSun', color: '666666' })],
    }),
  )

  const typeName: Record<string,string> = QUESTION_TYPE_LABELS
  let qi = 0
  for (const q of questions) {
    qi++
    const contentRuns = await buildRuns(q.content)
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [
          new TextRun({ text: `${qi}. `, size: SIZE, font: 'SimSun' }),
          new TextRun({ text: `[${typeName[q.type] || '题目'}] `, size: 16, font: 'SimSun', color: '888888' }),
          ...contentRuns,
        ],
      }),
      new Paragraph({
        indent: { left: 480 }, spacing: { after: 120 },
        children: [
          new TextRun({ text: '答案: ', size: SIZE, font: 'SimSun', bold: true, color: 'cc0000' }),
          ...(await buildRuns(q.answer)),
        ],
      }),
    )
  }

  return buildDoc(children, meta, '教师答案卷', paperSize)
}

function buildDoc(children: (Paragraph|Table)[], meta: ExamMeta, label: string, paperSize: 'A4' | 'A3' | 'A3_3' = 'A4') {
  const isA3 = paperSize !== 'A4'
  const cols = paperSize === 'A4' ? 1 : paperSize === 'A3' ? 2 : 3
  const pageProps = isA3
    ? { size: { width: 15874, height: 22445 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
    : { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
  const columns = isA3 ? { count: cols, space: 720 } : undefined

  const footerChildren = [
    new TextRun({ text: '第 ', size: 16, color: '999999' }),
    new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '999999' }),
    new TextRun({ text: ' 页', size: 16, color: '999999' }),
  ]
  if (isA3) {
    const colText = cols === 3 ? 'A3 三栏' : 'A3 双栏'
    footerChildren.push(new TextRun({ text: `    ·    ${colText} · 请双面打印`, size: 16, color: '999999' }))
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'SimSun', size: SIZE } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'SimHei' }, paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
      ],
    },
    sections: [
      {
        properties: {
          page: pageProps,
          ...(columns ? { columns } : {}),
        },
        headers: { default: new Header({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `知微教学 · ${meta.grade}${meta.subject}${label}`, size: 16, font: 'SimSun', color: '999999' })],
        })] })},
        footers: { default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: footerChildren,
        })] })},
        children,
      },
    ],
  })
  return Packer.toBlob(doc)
}
