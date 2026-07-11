/**
 * 试卷导出 Word (.docx)
 * 生成可打印的学生试卷 + 教师答案卷
 */
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType,
  Table,
  Header, Footer, PageNumber,
} from 'docx'
import { QUESTION_TYPE_LABELS } from './TeachingContext'

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

// border/cellMargins reserved for future table styling

/** 生成学生试卷（无答案） */
export async function exportExamPaper(questions: ExamQuestion[], meta: ExamMeta): Promise<Blob> {
  const children: (Paragraph|Table)[] = []

  // 标题
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

    children.push(
      // 题号 + 题型标签
      new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [
          new TextRun({ text: `${qi}. `, size: 21, font: 'SimSun' }),
          new TextRun({ text: `[${tName}] `, size: 16, font: 'SimSun', color: '888888' }),
          new TextRun({ text: q.content, size: 21, font: 'SimSun' }),
          new TextRun({ text: ` (${score}分)`, size: 16, font: 'SimSun', color: 'aaaaaa' }),
        ],
      }),
    )

    // 选择题：选项
    if (q.type === 'choice' && q.options?.length) {
      for (const opt of q.options) {
        children.push(new Paragraph({
          indent: { left: 480 },
          spacing: { after: 40 },
          children: [new TextRun({ text: `    ${opt}`, size: 21, font: 'SimSun' })],
        }))
      }
    }

    // 填空/计算：留空行
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

  return buildDoc(children, meta, '试卷')
}

/** 生成教师答案卷（含答案） */
export async function exportExamAnswer(questions: ExamQuestion[], meta: ExamMeta): Promise<Blob> {
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
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [
          new TextRun({ text: `${qi}. `, size: 21, font: 'SimSun' }),
          new TextRun({ text: `[${typeName[q.type] || '题目'}] `, size: 16, font: 'SimSun', color: '888888' }),
          new TextRun({ text: q.content, size: 21, font: 'SimSun' }),
        ],
      }),
      new Paragraph({
        indent: { left: 480 },
        spacing: { after: 120 },
        children: [
          new TextRun({ text: '答案: ', size: 21, font: 'SimSun', bold: true, color: 'cc0000' }),
          new TextRun({ text: q.answer, size: 21, font: 'SimSun', color: 'cc0000' }),
        ],
      }),
    )
  }

  return buildDoc(children, meta, '教师答案卷')
}

function buildDoc(children: (Paragraph|Table)[], meta: ExamMeta, label: string) {
  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'SimSun', size: 21 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'SimHei' }, paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        headers: { default: new Header({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `知微教学 · ${meta.grade}${meta.subject}${label}`, size: 16, font: 'SimSun', color: '999999' })],
        })] })},
        footers: { default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: '第 ', size: 16, color: '999999' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '999999' }),
            new TextRun({ text: ' 页', size: 16, color: '999999' }),
          ],
        })] })},
        children,
      },
    ],
  })
  return Packer.toBlob(doc)
}
