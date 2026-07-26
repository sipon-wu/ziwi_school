/**
 * 试卷预览组件（支持 出题 / 组卷 两种形态）
 * - paperSize: 'A4'（默认，单栏连续分页）/ 'A3'（双栏 + 中折 + 正/背翻页）/ 'A3_3'（三栏 + 中折 + 正/背翻页）
 * - embedded: true 时内联于编辑器文档模式（不浮层、不强制关闭）；false 时为全屏浮层
 * - 学生卷 / 教师卷切换、缩放、导出 Word / PDF 均随当前 paperSize 走（导出 = 预览）
 */
import { useState, useMemo, Fragment } from 'react'
import { X, ChevronLeft, ChevronRight, Eye, EyeOff, Printer, Download } from 'lucide-react'
import { QUESTION_TYPE_LABELS } from '../lib/TeachingContext'
import { renderFormulaText } from './FormulaRender'
import { downloadBlob } from '../lib/exportDocx'
import 'katex/dist/katex.min.css'

/* ──────── 类型 ──────── */
export interface ExamQuestion {
  id: string /* 题目 ID */
  stem: string /* 题干 */
  type: 'choice' | 'fill' | 'judge' | 'match' | 'cloze' | 'reading' | 'writing' | 'short_answer' | 'calculation' | 'truefalse'
  options?: string /* 选项（换行分隔） */
  answer: string
  analysis?: string
  difficulty?: string
  score?: number
  sort?: number
}

export interface ExamMeta {
  title: string
  subject: string
  grade: string
  totalScore?: number
  durationMinutes?: number
  teacherName?: string
}

/** 按学科返回最可能的试卷默认排版（联网调研结论）：
 *  - 语文：长阅读/作文为主 → A3 双栏
 *  - 数学 / 英语：题量密集、小题多 → A3 三栏（较双栏更常见）
 *  - 其余学科：默认 A3 三栏（空间利用率高、题量密集场景多）
 * 预览、导出、打印均以此为初始排版，保证三者对齐。 */
export function defaultPaperSizeForSubject(subject: string): 'A4' | 'A3' | 'A3_3' {
  const s = (subject || '').replace(/\s/g, '')
  if (s.includes('语文')) return 'A3'
  if (s.includes('数学') || s.includes('英语')) return 'A3_3'
  return 'A3_3'
}

interface Props {
  questions: ExamQuestion[]
  meta: ExamMeta
  paperSize?: 'A4' | 'A3' | 'A3_3'
  /** 是否允许切到 A3（出题线锁定 A4，传 false） */
  allowA3?: boolean
  /** 内联模式：渲染进父容器而非全屏浮层 */
  embedded?: boolean
  onClose?: () => void
  /** 排版用途：exam=试卷（预留答题区），practice=题单（紧凑，不留答题空白） */
  layout?: 'exam' | 'practice'
}

/* ──────── 分栏分页算法（A3：1 张纸 = 正/背两面，每面 cols 栏）──────── */
interface SheetPanels {
  front: ExamQuestion[][]   // 每面 = cols 个栏
  back: ExamQuestion[][]
}

/** 把题目均分到 cols 个栏（用于 A3 每面的分栏） */
function splitCols(arr: ExamQuestion[], cols: number): ExamQuestion[][] {
  const n = Math.max(cols, Math.ceil(arr.length / cols) * cols)
  const per = Math.ceil(n / cols)
  const out: ExamQuestion[][] = []
  for (let i = 0; i < cols; i++) out.push(arr.slice(i * per, (i + 1) * per))
  return out
}

/** 估算题目高度评分（用于 A4 单栏分页） */
function questionScore(q: ExamQuestion): number {
  let s = 1
  s += (q.stem?.length || 0) / 80
  if (q.options) s += (q.options.split('\n').length || 1) * 0.5
  if (q.type === 'writing') s += 5
  if (q.type === 'reading' || q.type === 'cloze') s += 3
  return s
}

/** A3：将全部题目分配到多张纸（每张 = 正/背两面，每面 cols 栏，按题数切分） */
function paginateA3(questions: ExamQuestion[], cols: number): SheetPanels[] {
  if (!questions.length) return []
  const pages: SheetPanels[] = []
  const perPage = cols * 4
  let offset = 0
  while (offset < questions.length) {
    const chunk = questions.slice(offset, offset + perPage)
    const half = Math.ceil(chunk.length / 2)
    pages.push({
      front: splitCols(chunk.slice(0, half), cols),
      back: splitCols(chunk.slice(half), cols),
    })
    offset += perPage
  }
  return pages
}

/** A4：单栏连续分页（每页约 6 个「评分单位」） */
function paginateA4(questions: ExamQuestion[]): ExamQuestion[][] {
  if (!questions.length) return [[]]
  const pages: ExamQuestion[][] = []
  let cur: ExamQuestion[] = []
  let score = 0
  for (const q of questions) {
    const s = questionScore(q)
    if (cur.length > 0 && score + s > 6) {
      pages.push(cur)
      cur = []
      score = 0
    }
    cur.push(q)
    score += s
  }
  if (cur.length) pages.push(cur)
  return pages
}

/* ──────── 单栏题目渲染 ──────── */
function QuestionItem({ q, index, showAnswer, isPractice }: {
  q: ExamQuestion
  index: number
  showAnswer: boolean
  isPractice?: boolean
}) {
  const typeLabel = QUESTION_TYPE_LABELS[q.type] || q.type
  const options = q.options?.split('\n').filter(Boolean) || []

  return (
    <div className="mb-4 break-inside-avoid" data-qidx={index}>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-sm font-bold text-[#1A3A6B]">{index}.</span>
        {typeLabel && (
          <span className="text-[10px] text-[#9A9A9A] bg-[#F6F7F8] px-1.5 py-0.5 rounded">{typeLabel}</span>
        )}
        {q.score != null && q.score > 0 && (
          <span className="text-[10px] text-[#B0B8C4]">({q.score}分)</span>
        )}
      </div>

      <div className="text-[13px] leading-relaxed text-[#353535]">{renderFormulaText(q.stem)}</div>

      {options.length > 0 && (
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
          {options.map((opt, i) => (
            <span key={i} className="text-[12px] text-[#353535]">
              {String.fromCharCode(65 + i)}. {renderFormulaText(opt)}
            </span>
          ))}
        </div>
      )}

      {!isPractice && ['fill', 'calculation', 'short_answer'].includes(q.type) && !showAnswer && (
        <div className="mt-2 border-b border-dotted border-[#D9D9D9] h-8" />
      )}

      {showAnswer && q.answer && (
        <div className="mt-1.5">
          <span className="text-[11px] text-[#52C41A] bg-[#F6FFED] border border-[#B7EB8F] rounded px-1.5 py-0.5 inline-block">
            答案: {renderFormulaText(q.answer)}
          </span>
        </div>
      )}
    </div>
  )
}

function QuestionColumn({ questions, startNum, showAnswer, isPractice }: {
  questions: ExamQuestion[]
  startNum: number
  showAnswer: boolean
  isPractice?: boolean
}) {
  return (
    <div className="flex-1 px-3">
      {questions.map((q, i) => (
        <QuestionItem key={q.id || i} q={q} index={startNum + i} showAnswer={showAnswer} isPractice={isPractice} />
      ))}
    </div>
  )
}

/* ──────── 主组件 ──────── */
export default function ExamPreview({
  questions,
  meta,
  paperSize: paperSizeProp,
  allowA3 = true,
  embedded = false,
  onClose,
  layout = 'exam',
}: Props) {
  const isPractice = layout === 'practice'
  const [paperSize, setPaperSize] = useState<'A4' | 'A3' | 'A3_3'>(
    isPractice ? 'A4' : (!allowA3 ? 'A4' : (paperSizeProp ?? defaultPaperSizeForSubject(meta.subject)))
  )
  const cols = paperSize === 'A4' ? 1 : paperSize === 'A3' ? 2 : 3
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [sheet, setSheet] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [zoom100, setZoom100] = useState(false)

  const sorted = useMemo(() => {
    const arr = [...questions]
    if (arr.every(q => q.sort != null)) arr.sort((a, b) => (a.sort || 0) - (b.sort || 0))
    return arr
  }, [questions])

  const a3Pages = useMemo(() => paginateA3(sorted, cols), [sorted, cols])
  const a4Pages = useMemo(() => paginateA4(sorted), [sorted])

  const isEmpty = !sorted.length
  // 浮层预览（AI 模式「预览」按钮）无题目时保持原空态弹层；
  // 内联文档模式则继续渲染工具栏 + 空纸面提示，保证 A4/A3 切换与导出始终可用。
  if (isEmpty && !embedded) {
    return (
      <div className="fixed inset-0 z-[70] bg-gray-900 flex items-center justify-center" onClick={onClose}>
        <div className="flex-1 flex items-center justify-center text-center text-white/70">
          <div>
            <p className="text-lg">该试卷暂无题目</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 text-sm border border-white/30 rounded hover:bg-white/10">关闭</button>
          </div>
        </div>
      </div>
    )
  }

  /* 导出（随当前 paperSize） */
  const toExportQs = (qs: ExamQuestion[]) => qs.map((q, i) => ({
    id: i + 1,
    type: q.type === 'truefalse' ? 'truefalse' : q.type as any,
    content: q.stem,
    options: q.options?.split('\n').filter(Boolean),
    answer: q.answer,
    difficulty: q.difficulty || 'L2',
    point: '',
  }))
  const docMeta = {
    subject: meta.subject,
    grade: meta.grade,
    title: meta.title,
    difficulty: '中等',
    teacherName: meta.teacherName || '教师',
    totalScore: meta.totalScore || 100,
  }

  const handleExportWord = async () => {
    if (!sorted.length) return
    try {
      const { exportExamPaper } = await import('../lib/exportExamDocx')
      const blob = await exportExamPaper(toExportQs(sorted), docMeta, paperSize)
      downloadBlob(blob, `${meta.title}_学生卷.docx`)
    } catch (e) {
      console.error('export word failed', e)
    }
  }
  const handleExportPdf = async () => {
    if (!sorted.length) return
    try {
      const { printExamPaper } = await import('../lib/printPdf')
      printExamPaper(toExportQs(sorted), {
        subject: meta.subject, grade: meta.grade, title: meta.title,
        difficulty: '中等', teacherName: meta.teacherName || '教师',
      }, paperSize)
    } catch (e) {
      console.error('export pdf failed', e)
    }
  }

  /* ── A3 当前纸的版面与题号起点（栏数可配置）── */
  const page = (!isEmpty && a3Pages.length) ? a3Pages[Math.min(sheet, a3Pages.length - 1)] : null
  const panels = page ? (side === 'front' ? page.front : page.back) : []
  let cum = 0
  for (let pj = 0; pj < Math.min(sheet, a3Pages.length - 1); pj++) {
    const p = a3Pages[pj]
    cum += p.front.reduce((a, c) => a + c.length, 0) + p.back.reduce((a, c) => a + c.length, 0)
  }
  let acc = cum
  const starts = panels.map(col => { const s = acc + 1; acc += (col?.length || 0); return s })

  /* ── 顶部工具栏 ── */
  const toolbar = (
    <div className="flex items-center justify-between px-5 py-2.5 bg-gray-800/90 text-white shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{meta.title || '试卷预览'}</span>
        <span className="text-xs text-gray-400">{meta.subject} · {meta.grade}</span>
        {meta.totalScore != null && (
          <span className="text-xs text-gray-500">满分 {meta.totalScore} 分</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs">
        {/* 纸型切换（仅组卷/试卷允许，题单锁定 A4） */}
        {allowA3 && !isPractice && (
          <div className="inline-flex rounded-[4px] border border-white/20 overflow-hidden bg-white/10">
            <button onClick={() => setPaperSize('A4')}
              className={`px-2.5 py-1 ${paperSize === 'A4' ? 'bg-white text-[#1A3A6B] font-medium' : 'text-white/70 hover:text-white'}`}>A4</button>
            <button onClick={() => setPaperSize('A3')}
              className={`px-2.5 py-1 border-l border-white/20 ${paperSize === 'A3' ? 'bg-white text-[#1A3A6B] font-medium' : 'text-white/70 hover:text-white'}`}>A3 双排</button>
            <button onClick={() => setPaperSize('A3_3')}
              className={`px-2.5 py-1 border-l border-white/20 ${paperSize === 'A3_3' ? 'bg-white text-[#1A3A6B] font-medium' : 'text-white/70 hover:text-white'}`}>A3 三排</button>
          </div>
        )}
        {/* 学生卷/教师卷 */}
        <button onClick={() => setShowAnswer(!showAnswer)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded ${showAnswer ? 'bg-[#52C41A]/20 text-[#52C41A]' : 'hover:bg-white/10'}`}>
          {showAnswer ? <><Eye size={14} /> 教师卷</> : <><EyeOff size={14} /> 学生卷</>}
        </button>
        {/* 缩放 */}
        <button onClick={() => setZoom100(!zoom100)}
          className={`px-2.5 py-1 rounded ${zoom100 ? 'bg-white/10' : 'hover:bg-white/10'}`}>
          {zoom100 ? '适应宽度' : '100%'}
        </button>
        {/* 导出 */}
        <button onClick={handleExportWord} disabled={isEmpty} className="flex items-center gap-1 px-2.5 py-1 rounded hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"><Download size={14} /> Word</button>
        <button onClick={handleExportPdf} disabled={isEmpty} className="flex items-center gap-1 px-2.5 py-1 rounded hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"><Printer size={14} /> PDF</button>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X size={16} /></button>
        )}
      </div>
    </div>
  )

  /* ── 画布区域 ── */
  const canvasArea = (
    <div className={`flex-1 overflow-auto flex flex-col ${zoom100 ? 'p-2' : 'p-4'}`}>
      {isEmpty ? (
        <div className="h-full flex items-center justify-center text-center text-white/70">
          <div>
            <p className="text-base">该试卷暂无题目</p>
            <p className="text-xs mt-1.5 text-white/40">请先在 AI 模式选取或生成题目，再回到文档模式预览纸面</p>
          </div>
        </div>
      ) : (
      <div className="flex-1 flex flex-col items-center gap-6 min-h-0">
        {paperSize !== 'A4' ? (
          <div key={`a3-${sheet}-${side}`} className="relative">
            <div className="absolute -top-6 left-0 text-[10px] text-gray-500">
              第 {sheet + 1} 张 · {side === 'front' ? '正面' : '背面'}
            </div>
            <div
              className={zoom100
                ? 'w-[1190px]'
                : 'w-[calc(100vw-3rem)] max-w-[1120px]'}
              style={{ height: 842, background: 'white' }}
            >
              <div className="h-full flex">
                {panels.map((col, ci) => (
                  <Fragment key={ci}>
                    <div className="flex-1 overflow-hidden flex flex-col">
                      <div className="px-4 py-5 flex-1 overflow-hidden">
                        <QuestionColumn questions={col} startNum={starts[ci]} showAnswer={showAnswer} isPractice={isPractice} />
                      </div>
                    </div>
                    {ci < panels.length - 1 && (
                      <div className="h-full border-r-2 border-dashed border-gray-300 relative">
                        <span className="absolute top-1/2 -translate-y-1/2 -right-[7px] text-[8px] text-gray-300 whitespace-nowrap rotate-90 origin-center">· · 对折 · ·</span>
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        ) : (
          a4Pages.map((page, pi) => {
            const startNum = a4Pages.slice(0, pi).reduce((a, p) => a + p.length, 0) + 1
            return (
              <div key={`a4-${pi}`} className="relative w-full max-w-[794px] flex-1 flex flex-col items-center" style={{ aspectRatio: '210/297' }}>
                <div className="absolute -top-6 left-0 text-[10px] text-gray-500">第 {pi + 1} 页 / 共 {a4Pages.length} 页</div>
                <div
                  className="bg-white border border-[#E7E7EB] shadow-sm flex-1 w-full"
                >
                  <div className="h-full overflow-hidden">
                    <div className="px-8 py-10">
                      <QuestionColumn questions={page} startNum={startNum} showAnswer={showAnswer} isPractice={isPractice} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    )}
  </div>
  )

  /* ── 底部导航 ── */
  const bottomNav = (
    <div className="flex items-center justify-between px-5 py-2.5 bg-gray-800/90 shrink-0">
      {isEmpty ? (
        <span className="text-xs text-white/60">
          {cols === 1 ? 'A4 · 单栏' : `A3 横排 · ${cols === 3 ? '三栏' : '双栏'} · 双面打印`} · 暂无题目
        </span>
      ) : paperSize !== 'A4' ? (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => setSide('front')}
              className={`px-3 py-1 text-xs rounded ${side === 'front' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}>正面</button>
            <button onClick={() => setSide('back')}
              className={`px-3 py-1 text-xs rounded ${side === 'back' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}>背面</button>
          </div>
          <div className="flex items-center gap-1 text-xs text-white/60">
            <button onClick={() => setSheet(s => Math.max(0, s - 1))} disabled={sheet === 0}
              className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ChevronLeft size={14} /></button>
            <span>第 {sheet + 1}/{a3Pages.length} 张</span>
            <button onClick={() => setSheet(s => Math.min(a3Pages.length - 1, s + 1))} disabled={sheet >= a3Pages.length - 1}
              className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ChevronRight size={14} /></button>
            <span className="text-white/30">|</span>
            <span>A3 横排 · {cols === 3 ? '三栏' : '双栏'} · 双面打印</span>
            {zoom100 && <span> · 100%</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportWord} className="flex items-center gap-1 px-3 py-1 text-xs border border-white/20 rounded hover:bg-white/10"><Download size={12} /> Word</button>
            <button onClick={handleExportPdf} className="flex items-center gap-1 px-3 py-1 text-xs border border-white/20 rounded hover:bg-white/10"><Printer size={12} /> PDF</button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>A4 · 单栏</span>
            <span className="text-white/30">|</span>
            <span>{a4Pages.length} 页</span>
            <span className="text-white/30">|</span>
            <span>{sorted.length} 题 · {meta.totalScore || '—'} 分</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportWord} className="flex items-center gap-1 px-3 py-1 text-xs border border-white/20 rounded hover:bg-white/10"><Download size={12} /> Word</button>
            <button onClick={handleExportPdf} className="flex items-center gap-1 px-3 py-1 text-xs border border-white/20 rounded hover:bg-white/10"><Printer size={12} /> PDF</button>
          </div>
        </>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div className="flex flex-col h-full bg-gray-900/95">
        {toolbar}
        {canvasArea}
        {bottomNav}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/95 flex flex-col" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}>
      {toolbar}
      {canvasArea}
      {bottomNav}
    </div>
  )
}
