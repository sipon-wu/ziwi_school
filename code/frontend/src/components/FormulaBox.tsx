/**
 * 公式容器组件（图片式）：
 * - 在 MDEditor 预览区渲染为可视化 KaTeX 块
 * - 支持鼠标拖拽移位（在预览区内）
 * - 支持文字环绕：上下型(block) / 四周型(inline float)
 *
 * 标记语法（存储在 markdown 中）：
 * - 上下型：<!-- formula block latex -->（独占一行，文字在上下）
 * - 四周型：<!-- formula inline latex -->（float right，文字环绕）
 */
import { useState, useRef, useEffect } from 'react'
import katex from 'katex'

export interface FormulaBoxData {
  /** 标记文本，如 <!-- formula block \frac{a}{b} --> */
  marker: string
  /** LaTeX 源码 */
  latex: string
  /** 环绕方式 */
  wrap: 'block' | 'inline'
}

/* ──────── 标记 ↔ 数据 解析 ──────── */
const MARKER_RE = /<!--\s*formula\s+(block|inline)\s+(.+?)\s*-->/g

/** 从 markdown 文本中提取所有公式容器的位置和参数 */
export function extractFormulaBoxes(md: string): FormulaBoxData[] {
  const boxes: FormulaBoxData[] = []
  let m: RegExpExecArray | null
  // reset regex
  MARKER_RE.lastIndex = 0
  while ((m = MARKER_RE.exec(md)) !== null) {
    boxes.push({ marker: m[0], latex: m[2].trim(), wrap: m[1] as 'block' | 'inline' })
  }
  return boxes
}

/** 将 markdown 文本中的公式标记替换为占位 HTML（在预览区渲染） */
export function renderFormulaBoxes(md: string): string {
  return md.replace(MARKER_RE, (_match, wrap, latex) => {
    const display = wrap === 'block'
    try {
      const html = katex.renderToString(latex.trim(), {
        throwOnError: false, displayMode: display, trust: true, strict: false,
      })
      return `<span class="formula-box" data-wrap="${wrap}" data-latex="${escapeHtml(latex.trim())}">${html}</span>`
    } catch {
      return `<span class="formula-box" data-wrap="${wrap}" data-latex="${escapeHtml(latex.trim())}">[公式渲染失败]</span>`
    }
  })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/* ──────── 渲染组件 ──────── */
interface Props {
  latex: string
  wrap: 'block' | 'inline'
  /** 编辑回调 */
  onEdit?: (newLatex: string, newWrap: 'block' | 'inline') => void
  /** 删除回调 */
  onDelete?: () => void
  /** 拖拽开始 → 通知父组件 */
  onDragStart?: () => void
}

export default function FormulaBox({ latex, wrap, onEdit, onDelete, onDragStart }: Props) {
  const [hover, setHover] = useState(false)

  let html = ''
  try {
    html = katex.renderToString(latex, {
      throwOnError: false, displayMode: wrap === 'block', trust: true, strict: false,
    })
  } catch { html = '[公式渲染失败]' }

  const baseClass = wrap === 'block'
    ? 'block my-2 mx-auto max-w-full'
    : 'inline-block float-right ml-3 mb-2 max-w-[50%]'

  return (
    <span
      className={`formula-box-container relative ${baseClass} cursor-grab active:cursor-grabbing select-none`}
      data-wrap={wrap}
      data-latex={latex}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onPointerDown={(e) => {
        // 拖拽：通知父组件
        if (e.button === 0) {
          onDragStart?.()
        }
      }}
    >
      {/* 公式渲染 */}
      <span
        className={`formula-render p-2 rounded border-2 ${hover ? 'border-[#02A7F0] bg-[#F0F9FF]' : 'border-[#E7E7EB]/50 bg-white/80'} transition-colors`}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Hover 操作栏 */}
      {hover && (
        <div className="absolute -top-7 right-0 flex gap-1 bg-white border border-[#E7E7EB] rounded shadow px-1 py-0.5 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit?.(latex, wrap) }}
            className="text-[10px] px-1.5 py-0.5 hover:bg-[#F6F7F8] rounded text-[#02A7F0]"
            title="编辑公式"
          >
            ✎ 编辑
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); /* toggle wrap */ onEdit?.(latex, wrap === 'block' ? 'inline' : 'block') }}
            className="text-[10px] px-1.5 py-0.5 hover:bg-[#F6F7F8] rounded text-[#9A9A9A]"
            title={wrap === 'block' ? '切换：四周环绕' : '切换：上下环绕'}
          >
            {wrap === 'block' ? '◧ 环绕' : '▬ 独行'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.() }}
            className="text-[10px] px-1.5 py-0.5 hover:bg-red-50 rounded text-red-400"
            title="删除公式"
          >
            ✕
          </button>
        </div>
      )}
    </span>
  )
}
