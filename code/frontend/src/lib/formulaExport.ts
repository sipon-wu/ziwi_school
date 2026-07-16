/**
 * 统一公式渲染底座（浏览器端）
 * 解决"编辑态完美、导出断裂"的一致性短板：
 *  - 把 TipTap 产出的 <div data-formula> / <span data-formula-inline> 节点渲染成 KaTeX HTML
 *  - 把文本中的 $...$ / $$...$$ 内联公式渲染成 KaTeX HTML（用于试卷题干、markdown 正文）
 *  - 把公式渲染成 PNG（用于 Word 导出，docx 无法渲染 HTML 公式）
 *
 * 与编辑态 TipTapEditor 使用同一套 KaTeX 参数（throwOnError:false, trust:true, strict:false），
 * 化学式 \ce{} 在 KaTeX 0.17 默认支持。
 */
import katex from 'katex'
import { toPng } from 'html-to-image'
import { marked } from 'marked'

const KATEX_OPTS = { throwOnError: false, trust: true, strict: false }

/** 打印窗口离线引用的 KaTeX 样式（已复制到 public/katex） */
export const KATEX_CSS_HREF = '/katex/katex.min.css'

/** 打印窗口配套的布局样式：让注入的 KaTeX 片段恢复块级/浮动/行内布局 */
export const KATEX_LAYOUT_CSS = `
.katex-block { display:block; text-align:center; margin:8px 0; }
.katex-float-left { float:left; margin:2px 12px 8px 0; }
.katex-float-right { float:right; margin:2px 0 8px 12px; }
.katex-inline { display:inline-block; vertical-align:middle; }
`

/** 把文本中的 $...$ / $$...$$ 替换为 KaTeX 渲染的 HTML 片段 */
export function renderInlineLatex(text: string): string {
  if (!text) return text
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
  return text.replace(regex, (raw) => {
    const isBlock = raw.startsWith('$$')
    const latex = raw.slice(isBlock ? 2 : 1, isBlock ? -2 : -1)
    try {
      return katex.renderToString(latex, { ...KATEX_OPTS, displayMode: isBlock })
    } catch {
      return raw
    }
  })
}

/** 把 HTML 字符串中的 data-formula 节点与文本 $...$ 全部渲染为 KaTeX HTML（用于 PDF 打印） */
export function renderFormulaNodes(html: string): string {
  if (!html || typeof document === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // 1) 渲染 TipTap 公式节点（保留外壳作为布局容器）
  const nodes = doc.querySelectorAll('[data-formula], [data-formula-inline]')
  nodes.forEach((el) => {
    const latex = el.getAttribute('data-latex') || ''
    const wrap = el.getAttribute('data-wrap') || 'block'
    const isInline = el.tagName.toLowerCase() === 'span' || wrap === 'inline'
    try {
      el.innerHTML = katex.renderToString(latex, { ...KATEX_OPTS, displayMode: !isInline })
      if (wrap === 'float-left') el.classList.add('katex-float-left')
      else if (wrap === 'float-right') el.classList.add('katex-float-right')
      else if (!isInline) el.classList.add('katex-block')
      else el.classList.add('katex-inline')
    } catch {
      /* 渲染失败保留原节点 */
    }
  })

  // 2) 文本节点中的 $...$ / $$...$$
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const targets: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) {
    const t = n as Text
    if (/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/.test(t.data)) targets.push(t)
  }
  targets.forEach((t) => {
    const parent = t.parentNode
    if (!parent) return
    const frag = document.createDocumentFragment()
    const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(t.data)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(t.data.slice(last, m.index)))
      const raw = m[0]
      const isBlock = raw.startsWith('$$')
      const latex = raw.slice(isBlock ? 2 : 1, isBlock ? -2 : -1)
      try {
        const span = document.createElement(isBlock ? 'div' : 'span')
        span.className = isBlock ? 'katex-block' : 'katex-inline'
        span.innerHTML = katex.renderToString(latex, { ...KATEX_OPTS, displayMode: isBlock })
        frag.appendChild(span)
      } catch {
        frag.appendChild(document.createTextNode(raw))
      }
      last = m.index + raw.length
    }
    if (last < t.data.length) frag.appendChild(document.createTextNode(t.data.slice(last)))
    parent.replaceChild(frag, t)
  })

  return doc.body.innerHTML
}

/** 判断 content 是 HTML 还是 markdown */
function isHtml(content: string): boolean {
  const c = (content || '').trim()
  return c.startsWith('<') && /<[a-z!]/i.test(c)
}

/**
 * 把内容（HTML 或 markdown）整理成可打印的 HTML，公式已渲染。
 * 供 PDF 打印窗口直接使用（需同时注入 KATEX_CSS_HREF 与 KATEX_LAYOUT_CSS）。
 */
export function prepareHtmlForPdf(content: string): string {
  let html = content || ''
  if (!isHtml(html)) {
    try {
      html = marked.parse(html) as string
    } catch {
      html = `<p>${html.replace(/\n/g, '<br/>')}</p>`
    }
  }
  return renderFormulaNodes(html)
}

/* ──────── Word 导出：公式 → PNG ──────── */

export interface FormulaImage {
  dataUrl: string
  width: number // 像素
  height: number // 像素
}

/** 把单个公式渲染为高清 PNG（用于 docx ImageRun 嵌入） */
export async function formulaToPng(
  latex: string,
  opts: { displayMode?: boolean; fontSize?: number } = {}
): Promise<FormulaImage> {
  const displayMode = opts.displayMode ?? false
  const fontSize = opts.fontSize ?? (displayMode ? 28 : 18)
  const host = document.createElement('span')
  host.style.display = 'inline-block'
  host.style.padding = '2px 4px'
  host.style.fontSize = `${fontSize}px`
  host.style.lineHeight = '1'
  host.style.background = 'transparent'
  host.innerHTML = katex.renderToString(latex, { ...KATEX_OPTS, displayMode })
  host.style.position = 'fixed'
  host.style.left = '-99999px'
  host.style.top = '0'
  document.body.appendChild(host)
  try {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready } catch { /* ignore */ }
    }
    const dataUrl = await toPng(host, { pixelRatio: 3, cacheBust: true, backgroundColor: 'transparent' })
    const rect = host.getBoundingClientRect()
    return { dataUrl, width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) }
  } finally {
    document.body.removeChild(host)
  }
}

/** 内容片段：普通文本 或 公式 */
export type ContentFragment =
  | { kind: 'text'; text: string }
  | { kind: 'formula'; latex: string; displayMode: boolean }

/**
 * 把一段内容（HTML 或纯文本或 markdown）解析为「文本 + 公式」片段序列。
 * 用于 Word 导出：文本 → TextRun，公式 → formulaToPng → ImageRun。
 */
export function parseContentFragments(input: string): ContentFragment[] {
  const text = input || ''
  if (!text.trim()) return []
  const fragments: ContentFragment[] = []
  const pushText = (s: string) => {
    if (s) fragments.push({ kind: 'text', text: s })
  }
  const pushFormula = (latex: string, displayMode: boolean) => {
    if (latex && latex.trim()) fragments.push({ kind: 'formula', latex: latex.trim(), displayMode })
  }

  // 先把文本中的 $...$ 切出（纯文本 / markdown 路径）
  const inlineRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
  const flushMixed = (s: string) => {
    let last = 0
    let m: RegExpExecArray | null
    while ((m = inlineRegex.exec(s)) !== null) {
      if (m.index > last) pushText(s.slice(last, m.index))
      const raw = m[0]
      const isBlock = raw.startsWith('$$')
      pushFormula(raw.slice(isBlock ? 2 : 1, isBlock ? -2 : -1), isBlock)
      last = m.index + raw.length
    }
    if (last < s.length) pushText(s.slice(last))
  }

  if (isHtml(text)) {
    const doc = new DOMParser().parseFromString(text, 'text/html')
    const walk = (node: Node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          flushMixed((child as Text).data)
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement
          if (el.hasAttribute('data-formula') || el.hasAttribute('data-formula-inline')) {
            const latex = el.getAttribute('data-latex') || ''
            const wrap = el.getAttribute('data-wrap') || 'block'
            pushFormula(latex, !(el.tagName.toLowerCase() === 'span' || wrap === 'inline'))
          } else {
            walk(child)
          }
        }
      })
    }
    walk(doc.body)
  } else {
    flushMixed(text)
  }
  return fragments
}
