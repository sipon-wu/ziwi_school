/**
 * 打印导出 PDF（通用）
 * 在新窗口渲染清洁 HTML → 自动触发打印 → 用户保存为 PDF
 * 公式统一走 formulaExport（KaTeX 渲染 + 离线 CSS 引用）
 */
import { QUESTION_TYPE_LABELS } from './TeachingContext'
import { prepareHtmlForPdf, renderInlineLatex, KATEX_CSS_HREF, KATEX_LAYOUT_CSS } from './formulaExport'

const showToast = (msg: string, _type?: string) => {
  console.warn('[printPdf]', msg)
}

interface ExamQuestion {
  id: number
  type: string
  content: string
  options?: string[]
  answer: string
  difficulty: string
  point?: string
}

/** 试卷打印（学生卷） */
export function printExamPaper(questions: ExamQuestion[], meta: { subject:string; grade:string; title:string; difficulty:string; teacherName:string }, paperSize: 'A4' | 'A3' | 'A3_3' = 'A4') {
  const typeName: Record<string,string> = QUESTION_TYPE_LABELS
  let qi = 0
  const questionsHtml = questions.map(q => {
    qi++
    // 题干公式渲染（文本内联 $...$）
    const content = renderInlineLatex(q.content || '')
    let html = `<div class="question"><strong>${qi}. [${typeName[q.type] || '题目'}]</strong> ${content} <em>(${Math.round(100/questions.length)}分)</em></div>`
    if (q.type === 'choice' && q.options?.length) {
      html += `<div class="options">${q.options.map((o,i) => `<div class="option">${String.fromCharCode(65+i)}. ${renderInlineLatex(o)}</div>`).join('')}</div>`
    }
    if (['fill','calculation','short_answer'].includes(q.type)) {
      html += '<div class="answer-blank">___________________________<br/>___________________________<br/>___________________________</div>'
    }
    return html
  }).join('')

  const isA3 = paperSize !== 'A4'
  const cols = paperSize === 'A4' ? 1 : paperSize === 'A3' ? 2 : 3
  const pageCss = isA3 ? '@page { size: A3; margin: 1.5cm 2cm; }' : '@page { size: A4; margin: 2cm 2.5cm; }'
  const columnCss = isA3 ? `body { columns: ${cols}; column-gap: 40px; }` : ''
  const hintText = paperSize === 'A3_3' ? 'A3 三栏 · 请双面打印' : (isA3 ? 'A3 双栏 · 请双面打印' : '')
  const hint = hintText ? `<div class="hint">${hintText}</div>` : ''
  const hintCss = isA3 ? '.hint { text-align:center; font-size:12px; color:#999; margin-top:8px; }' : ''

  const win = window.open('', '_blank', 'width=800,height=600')
  if (!win) return showToast('请允许弹窗以打印试卷', 'warning')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${meta.title}</title>
<link rel="stylesheet" href="${KATEX_CSS_HREF}">
<style>
  ${pageCss}
  body { font-family: SimSun, serif; font-size: 14px; line-height: 1.8; color: #333; }
  ${columnCss}
  h1 { text-align:center; font-size:22px; margin-bottom:4px; }
  .meta { text-align:center; font-size:13px; color:#888; margin-bottom:8px; }
  .info { text-align:center; font-size:13px; margin-bottom:24px; border-bottom:1px dashed #ddd; padding-bottom:12px; }
  .question { font-weight:500; margin:16px 0 6px; break-inside:avoid; }
  .options { padding-left:24px; }
  .option { margin:2px 0; }
  .answer-blank { margin:6px 0 12px; color:#ccc; line-height:1.6; }
  em { color:#aaa; font-size:12px; }
  ${hintCss}
  ${KATEX_LAYOUT_CSS}
  @media print { .no-print { display:none; } }
</style></head><body>
  <h1>${meta.title}</h1>
  <div class="meta">${meta.subject} · ${meta.grade}  |  难度: ${meta.difficulty}  |  满分: 100分</div>
  <div class="info">姓名: ________ &nbsp;&nbsp; 班级: ________ &nbsp;&nbsp; 得分: ________</div>
  ${questionsHtml}
  ${hint}
  <div class="no-print" style="text-align:center;margin-top:32px;">
    <button onclick="window.print()" style="padding:10px 24px;font-size:15px;cursor:pointer;background:#1A3A6B;color:white;border:none;border-radius:6px;">🖨️ 打印 / 另存为 PDF</button>
  </div>
</body></html>`)
  win.document.close()
  setTimeout(() => win.print(), 500)
}

/** 教案打印 */
export function printLessonPlan(content: string, meta: { subject:string; grade:string; title:string; teacherName:string; textbookUnit?:string }) {
  // 统一走 formulaExport：markdown / HTML 自动识别，公式（data-formula 节点 + 文本 $...$）渲染为 KaTeX HTML
  const bodyHtml = prepareHtmlForPdf(content)
  const win = window.open('', '_blank', 'width=800,height=600')
  if (!win) return showToast('请允许弹窗以打印教案', 'warning')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${meta.title}</title>
<link rel="stylesheet" href="${KATEX_CSS_HREF}">
<style>
  @page { size: A4; margin: 2cm 2.5cm; }
  /* 与编辑器（.ProseMirror）完全一致的版式，确保「所见即所得」：编辑态 = 打印/导出态。
     工具栏所选字体/字号会以 inline 样式带入正文，故此处仅定默认（无衬线 = 编辑器默认）。 */
  body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif; font-size: 16px; line-height: 2; color: #333; max-width:700px; margin:0 auto; padding:20px; }
  h1 { font-size:22px; font-weight:700; }
  h2 { font-size:18px; font-weight:600; margin-top:20px; border-bottom:1px solid #eee; padding-bottom:4px; }
  h3 { font-size:16px; font-weight:600; margin-top:16px; }
  p { margin:0 0 0.75em 0; text-indent: 2em; min-height: 1em; }
  pre { background:#f5f5f5; padding:12px; border-radius:4px; font-size:12px; white-space:pre-wrap; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; font-size: 13px; }
  th { background: #f6f7f8; }
  .meta { color:#888; font-size:13px; margin-bottom:16px; }
  ${KATEX_LAYOUT_CSS}
  @media print { .no-print { display:none; } }
</style></head><body>
  <h1>${meta.title}</h1>
  <div class="meta">${meta.subject} · ${meta.grade}${meta.textbookUnit ? ' · '+meta.textbookUnit : ''}  |  教师: ${meta.teacherName}</div>
  ${bodyHtml}
  <div class="no-print" style="text-align:center;margin-top:32px;">
    <button onclick="window.print()" style="padding:10px 24px;font-size:15px;cursor:pointer;background:#1A3A6B;color:white;border:none;border-radius:6px;">🖨️ 打印 / 另存为 PDF</button>
  </div>
</body></html>`)
  win.document.close()
  setTimeout(() => win.print(), 500)
}
