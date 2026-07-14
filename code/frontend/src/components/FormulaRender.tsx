/**
 * 公式渲染组件：自动检测 $$...$$（块级）和 $...$（行内）标记并用 KaTeX 渲染。
 * editable 模式下，公式块 hover 显示编辑图标，点击弹出公式编辑器。
 */
import { useState, type ReactNode } from 'react'
import katex from 'katex'

/* ──────── 纯渲染：文本 → KaTeX 片段 ──────── */
export function renderFormulaText(text: string): ReactNode[] {
  if (!text) return [text]
  // 匹配 $$...$$（块级，优先）和 $...$（行内）
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
  const parts: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    const raw = match[0]
    const isBlock = raw.startsWith('$$')
    const latex = raw.slice(isBlock ? 2 : 1, isBlock ? -2 : -1)
    try {
      const html = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: isBlock,
        trust: true,
        strict: false,
      })
      parts.push(
        <span
          key={match.index}
          className={isBlock ? 'block text-center my-1' : 'inline'}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    } catch {
      // 渲染失败回退为原文字
      parts.push(<span key={match.index} className="text-red-500 italic">{raw}</span>)
    }
    last = match.index + raw.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : [text]
}

/* ──────── 带编辑器交互的渲染 ──────── */
interface Props {
  text: string
  /** 是否可编辑（hover 显示编辑图标） */
  editable?: boolean
  /** 编辑完成回调：返回修改后的完整文本 */
  onChange?: (newText: string) => void
  className?: string
}

export default function FormulaRender({ text, editable, onChange, className }: Props) {
  if (!text) return <span className={className}>{text}</span>
  if (!editable) {
    return <span className={className}>{renderFormulaText(text)}</span>
  }

  // 编辑模式：对每个公式片段包装 hover 编辑入口
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
  const parts: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  let formulaIdx = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={`t${last}`}>{text.slice(last, match.index)}</span>)
    }
    const raw = match[0]
    const isBlock = raw.startsWith('$$')
    const latex = raw.slice(isBlock ? 2 : 1, isBlock ? -2 : -1)
    const fi = formulaIdx++
    parts.push(
      <FormulaBlock
        key={`f${match.index}`}
        latex={latex}
        isBlock={isBlock}
        fi={fi}
        text={text}
        matchIndex={match.index}
        raw={raw}
        onChange={onChange}
      />
    )
    last = match.index + raw.length
  }
  if (last < text.length) parts.push(<span key={`t${last}`}>{text.slice(last)}</span>)
  return <span className={className}>{parts.length ? parts : [text]}</span>
}

/* ──────── 可编辑公式块 ──────── */
function FormulaBlock({ latex, isBlock, text, matchIndex, raw, onChange }: {
  latex: string; isBlock: boolean; text: string; matchIndex: number; raw: string;
  onChange?: (t: string) => void; fi: number;
}) {
  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(latex)

  const openEdit = () => {
    setDraft(latex)
    setEditing(true)
  }

  const handleSave = () => {
    const wrapper = isBlock ? `$$` : `$`
    const newRaw = `${wrapper}${draft}${wrapper}`
    const newText = text.slice(0, matchIndex) + newRaw + text.slice(matchIndex + raw.length)
    onChange?.(newText)
    setEditing(false)
  }

  let html = ''
  try {
    html = katex.renderToString(latex, {
      throwOnError: false, displayMode: isBlock, trust: true, strict: false,
    })
  } catch { /* fallback to raw */ }

  return (
    <span
      className={`relative inline-block ${isBlock ? 'block text-center my-1' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span dangerouslySetInnerHTML={{ __html: html || raw }} />
      {hover && (
        <button
          onClick={openEdit}
          className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-[#02A7F0] rounded-full flex items-center justify-center shadow-sm hover:bg-[#E8F7FF] cursor-pointer"
          title="编辑公式"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="#02A7F0">
            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10z"/>
          </svg>
        </button>
      )}

      {editing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" onClick={() => setEditing(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-2xl w-[520px] max-w-[92vw] z-10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F0F0]">
              <span className="text-sm font-semibold text-[#353535]">
                {isBlock ? '编辑公式（块级）' : '编辑公式（行内）'}
              </span>
              <span className="text-[10px] text-[#9A9A9A]">支持 LaTeX 语法 | 化学式用 \ce{}</span>
            </div>
            <div className="p-5 space-y-4">
              {/* 快捷输入 */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '平方根', tex: '\\sqrt{x}' },
                  { label: '分数', tex: '\\frac{a}{b}' },
                  { label: '幂', tex: 'x^{2}' },
                  { label: '下标', tex: 'x_{1}' },
                  { label: '积分', tex: '\\int_{0}^{1}' },
                  { label: '求和', tex: '\\sum_{i=1}^{n}' },
                  { label: '希腊', tex: '\\alpha \\beta \\pi' },
                  { label: '化学', tex: '\\ce{2H2 + O2 -> 2H2O}' },
                  { label: '化学·离子', tex: '\\ce{Na+ + Cl- -> NaCl}' },
                  { label: '化学·平衡', tex: '\\ce{A <=> B}' },
                ].map((item, i) => (
                  <button key={i}
                    onClick={() => setDraft(prev => prev + item.tex)}
                    className="px-2 py-0.5 text-[10px] bg-[#F6F7F8] border border-[#E7E7EB] rounded hover:bg-[#E8F7FF] hover:border-[#02A7F0]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 输入区 */}
              <div>
                <label className="block text-[11px] text-[#9A9A9A] mb-1">LaTeX 表达式</label>
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0] font-mono resize-y"
                  autoFocus
                  placeholder={isBlock ? '\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}' : 'x^2 + y^2 = z^2'}
                />
              </div>

              {/* 实时预览 */}
              <div>
                <label className="block text-[11px] text-[#9A9A9A] mb-1">预览</label>
                <div className="min-h-[48px] p-3 bg-[#F9FAFB] border border-[#E7E7EB] rounded-[4px] flex items-center justify-center">
                  <FormulaPreview latex={draft} isBlock={isBlock} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#F0F0F0]">
              <button onClick={() => setEditing(false)} className="px-4 py-1.5 text-[12px] text-[#595959] border border-[#E7E7EB] rounded-[4px] hover:bg-[#F6F7F8]">取消</button>
              <button onClick={handleSave} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1]">确定</button>
            </div>
          </div>
        </div>
      )}
    </span>
  )
}

function FormulaPreview({ latex, isBlock }: { latex: string; isBlock: boolean }) {
  if (!latex.trim()) {
    return <span className="text-[12px] text-[#C0C0C0]">输入 LaTeX 后实时预览公式</span>
  }
  try {
    const html = katex.renderToString(latex, {
      throwOnError: false, displayMode: isBlock, trust: true, strict: false,
    })
    return <span dangerouslySetInnerHTML={{ __html: html }} />
  } catch (e: any) {
    return <span className="text-[12px] text-red-400">{e.message?.substring(0, 60) || '渲染错误'}</span>
  }
}

export { FormulaPreview }
