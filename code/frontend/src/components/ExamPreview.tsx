/**
 * 试卷 A3 横排预览组件
 * - A3 画布 + 双栏（左 A4 竖 / 右 A4 竖）+ 中折虚线
 * - 正 ⇄ 背面翻页（1 张 A3 纸 = 4 个 A4 版面）
 * - 学生卷 / 教师卷切换
 * - 100% 真实尺寸 / 适应宽度缩放
 */
import { useState, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, Eye, EyeOff, Printer, Download } from 'lucide-react'
import { QUESTION_TYPE_LABELS } from '../lib/TeachingContext'
import FormulaRender, { renderFormulaText } from './FormulaRender'
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

interface Props {
  questions: ExamQuestion[]
  meta: ExamMeta
  onClose: () => void
}

/* ──────── 分栏分页算法 ──────── */
interface PanelQuestions {
  /** 正面左栏 */
  frontLeft: ExamQuestion[]
  /** 正面右栏 */
  frontRight: ExamQuestion[]
  /** 背面左栏 */
  backLeft: ExamQuestion[]
  /** 背面右栏 */
  backRight: ExamQuestion[]
}

/** 将 questions 按序分配到 4 个 A4 版面（1 张 A3 纸正反面） */
function splitToPanels(questions: ExamQuestion[], itemsPerPanel: number): PanelQuestions {
  const n = Math.max(4, Math.ceil(questions.length / 4) * 4)
  // 前一半给正面（左+右），后一半给背面（左+右）
  const half = Math.ceil(n / 2)
  const front = questions.slice(0, half)
  const back = questions.slice(half, n)
  // 各自左右切分
  const fl = Math.ceil(front.length / 2)
  const bl = Math.ceil(back.length / 2)
  return {
    frontLeft: front.slice(0, fl),
    frontRight: front.slice(fl),
    backLeft: back.slice(0, bl),
    backRight: back.slice(bl),
  }
}

/** 估算题目高度评分 */
function questionScore(q: ExamQuestion): number {
  let s = 1
  s += (q.stem?.length || 0) / 80
  if (q.options) s += (q.options.split('\n').length || 1) * 0.5
  if (q.type === 'writing') s += 5
  if (q.type === 'reading' || q.type === 'cloze') s += 3
  return s
}

/** 将所有 questions 分配到多张 A3 纸（每张 4 个版面） */
function paginateQuestions(questions: ExamQuestion[]): PanelQuestions[] {
  if (!questions.length) return []
  const pages: PanelQuestions[] = []
  // 简单策略：每张纸分配等差数列，按题数切分
  const perPage = Math.max(4, Math.ceil(questions.length / Math.ceil(questions.length / 8)))
  let offset = 0
  while (offset < questions.length) {
    const chunk = questions.slice(offset, offset + perPage)
    pages.push(splitToPanels(chunk, perPage))
    offset += perPage
  }
  return pages
}

/* ──────── 单栏题目渲染 ──────── */
function QuestionItem({ q, index, showAnswer }: {
  q: ExamQuestion
  index: number
  showAnswer: boolean
}) {
  const typeLabel = QUESTION_TYPE_LABELS[q.type] || q.type
  const options = q.options?.split('\n').filter(Boolean) || []

  return (
    <div className="mb-4 break-inside-avoid">
      {/* 题号 + 题型 + 分值 */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-sm font-bold text-[#1A3A6B]">{index}.</span>
        {typeLabel && (
          <span className="text-[10px] text-[#9A9A9A] bg-[#F6F7F8] px-1.5 py-0.5 rounded">{typeLabel}</span>
        )}
        {q.score != null && q.score > 0 && (
          <span className="text-[10px] text-[#B0B8C4]">({q.score}分)</span>
        )}
      </div>

      {/* 题干 */}
      <div className="text-[13px] leading-relaxed text-[#353535]">{renderFormulaText(q.stem)}</div>

      {/* 选项 */}
      {options.length > 0 && (
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
          {options.map((opt, i) => (
            <span key={i} className="text-[12px] text-[#353535]">
              {String.fromCharCode(65 + i)}. {renderFormulaText(opt)}
            </span>
          ))}
        </div>
      )}

      {/* 填空/简答留白 */}
      {['fill', 'calculation', 'short_answer'].includes(q.type) && !showAnswer && (
        <div className="mt-2 border-b border-dotted border-[#D9D9D9] h-8" />
      )}

      {/* 教师答案视图 */}
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

/* ──────── 单列渲染 ──────── */
function QuestionColumn({ questions, startNum, showAnswer }: {
  questions: ExamQuestion[]
  startNum: number
  showAnswer: boolean
}) {
  return (
    <div className="flex-1 px-3">
      {questions.map((q, i) => (
        <QuestionItem key={q.id || i} q={q} index={startNum + i} showAnswer={showAnswer} />
      ))}
    </div>
  )
}

/* ──────── 主组件 ──────── */
export default function ExamPreview({ questions, meta, onClose }: Props) {
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [showAnswer, setShowAnswer] = useState(false)
  const [zoom100, setZoom100] = useState(false)
  const sorted = useMemo(() => {
    const arr = [...questions]
    if (arr.every(q => q.sort != null)) arr.sort((a, b) => (a.sort || 0) - (b.sort || 0))
    return arr
  }, [questions])

  const pages = useMemo(() => paginateQuestions(sorted), [sorted])

  if (!sorted.length) {
    return (
      <div className="fixed inset-0 z-[70] bg-gray-900 flex items-center justify-center" onClick={onClose}>
        <div className="text-center text-white/70">
          <p className="text-lg">该试卷暂无题目</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 text-sm border border-white/30 rounded hover:bg-white/10">关闭</button>
        </div>
      </div>
    )
  }

  const handleExportWord = async () => {
    try {
      const { exportExamPaper, exportExamAnswer } = await import('../lib/exportExamDocx')
      const docxQs = questions.map((q, i) => ({
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
      const blob = await exportExamPaper(docxQs, docMeta)
      import('../lib/exportDocx').then(m => m.downloadBlob(blob, `${meta.title}_学生卷.docx`))
    } catch (e) {
      console.error('export failed', e)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-gray-900/95 flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {/* ── 顶部工具栏 ── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-gray-800/90 text-white shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{meta.title || '试卷预览'}</span>
          <span className="text-xs text-gray-400">{meta.subject} · {meta.grade}</span>
          {meta.totalScore != null && (
            <span className="text-xs text-gray-500">满分 {meta.totalScore} 分</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {/* 学生卷/教师卷切换 */}
          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded ${showAnswer ? 'bg-[#52C41A]/20 text-[#52C41A]' : 'hover:bg-white/10'}`}
            title={showAnswer ? '切换到学生卷' : '切换到教师卷'}
          >
            {showAnswer ? <><Eye size={14} /> 教师卷</> : <><EyeOff size={14} /> 学生卷</>}
          </button>
          {/* 缩放 */}
          <button
            onClick={() => setZoom100(!zoom100)}
            className={`px-2.5 py-1 rounded ${zoom100 ? 'bg-white/10' : 'hover:bg-white/10'}`}
          >
            {zoom100 ? '适应宽度' : '100%'}
          </button>
          {/* 导出 */}
          <button onClick={handleExportWord} className="flex items-center gap-1 px-2.5 py-1 rounded hover:bg-white/10">
            <Download size={14} /> 导出 Word
          </button>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X size={16} /></button>
        </div>
      </div>

      {/* ── A3 画布区域（可滚动）── */}
      <div className={`flex-1 overflow-auto ${zoom100 ? 'p-2' : 'p-4'}`}>
        <div className="flex flex-col items-center gap-6">
          {pages.map((page, pi) => {
            const panels = side === 'front'
              ? [page.frontLeft, page.frontRight]
              : [page.backLeft, page.backRight]

            // 题号累计
            let cum = 0
            for (let pj = 0; pj < pi; pj++) {
              const p = pages[pj]
              cum += p.frontLeft.length + p.frontRight.length + p.backLeft.length + p.backRight.length
            }
            const leftStart = cum + 1
            const rightStart = (side === 'front')
              ? cum + page.frontLeft.length + 1
              : cum + page.backLeft.length + 1

            return (
              <div key={pi} className="relative">
                {/* 纸张标签 */}
                <div className="absolute -top-6 left-0 text-[10px] text-gray-500">
                  第 {pi + 1} 张 · {side === 'front' ? '正面' : '背面'}
                </div>

                {/* A3 画布 */}
                <div
                  className={zoom100
                    ? 'w-[1190px] aspect-[420/297]' /* 100%: 真实 420mm → 1190px */
                    : 'w-[calc(100vw-3rem)] max-w-[1120px] aspect-[420/297]'
                  }
                  style={{ background: 'white' }}
                >
                  <div className="h-full flex">
                    {/* 左栏 (A4 竖) */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                      <div className="px-4 py-5 flex-1 overflow-hidden">
                        <QuestionColumn
                          questions={panels[0]}
                          startNum={leftStart}
                          showAnswer={showAnswer}
                        />
                      </div>
                    </div>

                    {/* 中折虚线 */}
                    <div className="h-full border-r-2 border-dashed border-gray-300 relative">
                      <span className="absolute top-1/2 -translate-y-1/2 -right-[7px] text-[8px] text-gray-300 whitespace-nowrap rotate-90 origin-center">
                        · · 对折 · ·
                      </span>
                    </div>

                    {/* 右栏 (A4 竖) */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                      <div className="px-4 py-5 flex-1 overflow-hidden">
                        <QuestionColumn
                          questions={panels[1]}
                          startNum={rightStart}
                          showAnswer={showAnswer}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 底部导航 ── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-gray-800/90 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSide('front')}
            className={`px-3 py-1 text-xs rounded ${side === 'front' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}
          >
            正面
          </button>
          <button
            onClick={() => setSide('back')}
            className={`px-3 py-1 text-xs rounded ${side === 'back' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}
          >
            背面
          </button>
        </div>

        <div className="flex items-center gap-1 text-xs text-white/60">
          <span>A3 横排 · 双栏 · {side === 'front' ? '正面' : '背面'}</span>
          {zoom100 && <span> · 100% 真实尺寸</span>}
          <span className="text-white/30">|</span>
          <span>共 {pages.length} 张纸</span>
          <span className="text-white/30">|</span>
          <span>{sorted.length} 题 · {meta.totalScore || '—'} 分</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportWord}
            className="flex items-center gap-1 px-3 py-1 text-xs border border-white/20 rounded hover:bg-white/10"
          >
            <Download size={12} /> 导出 Word
          </button>
        </div>
      </div>
    </div>
  )
}
