/**
 * TipTap WYSIWYG 教案编辑器 — Word 级富文本体验
 * - 所见即所得排版（无 Markdown 对照预览）
 * - Word 标准工具栏：字体/字号/B/I/U/S/H1/H2/H3/对齐/公式∫/化学⚗/表格/图片/链接/撤销/重做
 * - 右侧：版本历史面板（保存快照 + 恢复）
 * - 公式/化学式：自定义节点，支持拖拽位移 + 缩放（调字号）+ 上下/四周环绕
 */
import { useState, useCallback, useRef, useEffect, createContext, useContext, type JSX, type PointerEvent as ReactPointerEvent } from 'react'
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import { Node, mergeAttributes } from '@tiptap/core'
import { Maximize2, Minimize2, Bold, Italic, UnderlineIcon, Strikethrough, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Quote, Code, Link2, ImageIcon, Table2, Undo2, Redo2, Heading1, Heading2, Type, ListTree, History, RotateCcw, Eye, Save, ChevronLeft, Plus, MessageSquare, Trash2, X, FileText } from 'lucide-react'
import { FormulaPreview } from './FormulaRender'
import ResourcePicker from './ResourcePicker'
import { useToast } from './Toast'
// @ts-ignore - mammoth 浏览器版无类型
import * as mammoth from 'mammoth/mammoth.browser'
import 'katex/dist/katex.min.css'
import katex from 'katex'

/* ──────── 自定义公式节点 ──────── */
/* ──────── 自定义公式节点 ──────── */
// 公式节点 → 主组件 的编辑回调上下文（选中公式后点 ✎ 打开对话框预填）
export type FormulaEditAttrs = { latex: string; wrap: string; kind: 'math' | 'chemistry'; type: string }
const FormulaEditContext = createContext<(a: FormulaEditAttrs) => void>(() => {})

function FormulaView({ node, updateAttributes, selected, deleteNode }: { node: any; updateAttributes: (a: Record<string, any>) => void; selected: boolean; deleteNode: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const latex = (node.attrs.latex as string) || ''
  const wrap = (node.attrs.wrap as 'block' | 'inline') || 'block'
  const kind = (node.attrs.kind as 'math' | 'chemistry') || 'math'
  const fontSize = (node.attrs.fontSize as number) || 0
  const openEditor = useContext(FormulaEditContext)
  const [resizing, setResizing] = useState(false)
  const onDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    deleteNode()
  }
  useEffect(() => {
    if (!ref.current) return
    try {
      ref.current.innerHTML = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: wrap === 'block',
        trust: true,
        strict: false,
      })
    } catch {
      ref.current.textContent = latex
    }
  }, [latex, wrap])

  // 缩放：拖右下角手柄，按纵向位移调整公式字号（真正缩放公式，而非只缩放空白框）
  const startResize = (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing(true)
    const startY = e.clientY
    const startFont = fontSize || (wrap === 'block' ? 20 : 16)
    const onMove = (ev: PointerEvent) => {
      const next = Math.min(200, Math.max(8, Math.round(startFont + (ev.clientY - startY) * 0.6)))
      updateAttributes({ fontSize: next })
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openEditor?.({ latex, wrap, kind, type: node.type.name })
  }

  const isInlineSpan = wrap === 'inline' && node.type.spec.inline
  return (
    <NodeViewWrapper
      as={isInlineSpan ? 'span' : 'div'}
      data-wrap={wrap}
      data-latex={latex}
      draggable={!resizing}
      className={`formula-box-container select-none relative ${isInlineSpan
        ? 'inline-block align-middle border rounded bg-[#F0F9FF]/50 px-0.5 mx-0.5'
        : wrap === 'block'
          ? 'block my-3 mx-auto text-center border-2 rounded bg-[#F0F9FF]/50 py-1 px-1.5'
          : 'inline-block float-right ml-3 mb-2 max-w-[80%] border-2 rounded bg-[#F0F9FF]/50 py-1 px-1.5'} ${selected ? 'border-[#02A7F0]' : 'border-[#02A7F0]/30'}`}
      style={{ userSelect: 'none', fontSize: fontSize ? `${fontSize}px` : undefined }}
    >
      <span ref={ref} className="inline-block leading-none align-middle" />
      {selected && (
        <>
          {/* 拖拽提示：节点 draggable=true，按住公式主体即可在文档内移动位置 */}
          <span
            className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 flex items-center justify-center rounded bg-[#02A7F0] text-white text-[9px] cursor-grab opacity-90"
            title="按住公式主体拖拽即可移动位置"
            contentEditable={false}
          >⠿</span>
          {/* 编辑按钮：打开对话框预填当前公式，原地修改而非删除重来 */}
          <span
            onClick={onEdit}
            className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 flex items-center justify-center rounded bg-[#F59E0B] text-white text-[9px] cursor-pointer opacity-90"
            title="编辑公式内容"
            contentEditable={false}
          >✎</span>
          {/* 缩放手柄 */}
          <span
            onPointerDown={startResize}
            draggable={false}
            className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 flex items-center justify-center rounded bg-[#02A7F0] text-white text-[9px] cursor-nwse-resize opacity-90"
            title="拖拽缩放公式"
            contentEditable={false}
          >⤡</span>
          {/* 删除按钮：直接从文档移除该公式节点（省得用键盘 Delete） */}
          <span
            onClick={onDelete}
            className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 flex items-center justify-center rounded bg-[#EF4444] text-white text-[9px] cursor-pointer opacity-90"
            title="删除该公式"
            contentEditable={false}
          >🗑</span>
        </>
      )}
    </NodeViewWrapper>
  )
}

const FormulaNode = Node.create({
  name: 'formulaContainer',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  content: '',
  addAttributes() {
    return {
      latex: { default: '' },
      wrap: { default: 'block' as 'block' | 'inline' },
      kind: {
        default: 'math' as 'math' | 'chemistry',
        parseHTML: (el: HTMLElement) => (el.getAttribute('data-kind') as any) || 'math',
      },
      fontSize: {
        default: 0,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-fsize')) || 0,
        renderHTML: (attrs: any) => (attrs.fontSize ? { 'data-fsize': String(attrs.fontSize) } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-formula]' }]
  },
  renderHTML({ HTMLAttributes }) {
    // HTML 序列化时只输出占位外壳，KaTeX 内容由 NodeView 渲染
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-formula': 'true',
      'data-kind': (HTMLAttributes as any).kind || 'math',
      contenteditable: 'false',
    })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(FormulaView)
  },
  addCommands() {
    return {
      insertFormula: (attrs: { latex: string; wrap: 'block' | 'float' | 'inline'; kind?: 'math' | 'chemistry' }) => ({ commands }: any) => {
        return commands.insertContent({ type: this.name, attrs: { kind: 'math', ...attrs } })
      },
    } as any
  },
})

// 真·行内公式节点：inline atom，插入到段落字间（仅用于不超行高的简单化学式/短数学式）
const FormulaInlineNode = Node.create({
  name: 'formulaInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  content: '',
  addAttributes() {
    return {
      latex: { default: '' },
      wrap: { default: 'inline' as 'block' | 'inline' },
      kind: {
        default: 'math' as 'math' | 'chemistry',
        parseHTML: (el: HTMLElement) => (el.getAttribute('data-kind') as any) || 'math',
      },
      fontSize: {
        default: 0,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-fsize')) || 0,
        renderHTML: (attrs: any) => (attrs.fontSize ? { 'data-fsize': String(attrs.fontSize) } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-formula-inline]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-formula-inline': 'true',
      'data-kind': (HTMLAttributes as any).kind || 'math',
      contenteditable: 'false',
    })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(FormulaView)
  },
  addCommands() {
    return {
      insertFormulaInline: (attrs: { latex: string; kind?: 'math' | 'chemistry' }) => ({ commands }: any) => {
        return commands.insertContent({ type: this.name, attrs: { kind: 'math', wrap: 'inline', ...attrs } })
      },
    } as any
  },
})

// 高度检测：包含高结构（分式/根号/矩阵/大型算子/多行/可换行的化学机理）→ 应走块级，避免挤压正文行高
function isTallFormula(latex: string): boolean {
  if (!latex) return false
  const patterns = [
    /\\frac\s*[{]/,            // 分式 a/b
    /\\dfrac\s*[{]/,          // 显示分式
    /\\sqrt\s*[{]/,           // 根号
    /\\int/, /\\sum/, /\\prod/, /\\lim/, /\\iint/, /\\oint/, // 大算子
    /\\begin\s*[{]/,          // 矩阵/多行环境（pmatrix/bmatrix/array/cases）
    /\\over/, /\\overline\s*[{]/, /\\underbrace/, /\\overbrace/,
    /\\substack/, /\\binom\s*[{]/, /\\limits/,
    // 注：横向反应箭头（\rightleftharpoons / \rightarrow 等）虽宽但不占行高，行内可用，不计入"高公式"
    // 反应箭头（\rightarrow 等）虽宽但不占行高，行内可用，不计入"高公式"
  ]
  return patterns.some(p => p.test(latex))
}

// 扩展 TipTap 命令类型，使 editor.commands.insertFormula / insertFormulaInline 合法
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formulaContainer: {
      insertFormula: (attrs: { latex: string; wrap: 'block' | 'float' | 'inline'; kind?: 'math' | 'chemistry' }) => ReturnType
    }
    formulaInline: {
      insertFormulaInline: (attrs: { latex: string; kind?: 'math' | 'chemistry' }) => ReturnType
    }
  }
}

/* ──────── 工具栏按钮 ──────── */
function Tb({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: JSX.Element | string; title: string }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`w-7 h-7 flex items-center justify-center rounded text-[12px] ${active ? 'bg-[#E3ECFA] text-[#1A3A6B]' : 'text-[#595959] hover:bg-[#F6F7F8]'} transition-colors`}
    >
      {children}
    </button>
  )
}

/* ──────── 主组件 ──────── */
interface Props {
  value: string   // HTML 内容（或 Markdown，通过 TipTap 双向转换）
  onChange: (html: string) => void
  placeholder?: string
}

export default function TipTapEditor({ value, onChange, placeholder }: Props) {
  const { toast } = useToast()
  const [outlineVisible, setOutlineVisible] = useState(true)
  const [historyVisible, setHistoryVisible] = useState(true)

  // 版本快照
  const [snapshots, setSnapshots] = useState<Array<{ time: string; content: string; label?: string }>>([])
  // 批注
  const [annotations, setAnnotations] = useState<Array<{ id: string; text: string; comment: string; time: string }>>([])
  const [newAnnotation, setNewAnnotation] = useState('')
  const [rightTab, setRightTab] = useState<'annotations' | 'history'>('annotations')

  // 公式编辑弹窗
  const [formulaOpen, setFormulaOpen] = useState(false)
  const [formulaDraft, setFormulaDraft] = useState('')
  const [formulaType, setFormulaType] = useState<'math' | 'chemistry'>('math')
  const [formulaWrap, setFormulaWrap] = useState<'block' | 'float' | 'inline'>('block')
  // 正在编辑的已有公式节点名（null=新建）；保存时原地更新而非插入新节点
  const [editingNodeName, setEditingNodeName] = useState<null | 'formulaContainer' | 'formulaInline'>(null)

  // 链接弹窗
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)

  // 图片弹窗
  const [showImgInput, setShowImgInput] = useState(false)
  const [imgUrl, setImgUrl] = useState('')
  const [showMaterialPicker, setShowMaterialPicker] = useState(false)
  // 字号
  const [fontSize, setFontSize] = useState('16')
  const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '36']

  // Word 导入
  const wordInputRef = useRef<HTMLInputElement | null>(null)
  const handleWordImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    try {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.convertToHtml({ arrayBuffer })
      // 把 mammoth 转换的 HTML 设置到编辑器（覆盖当前内容）
      editor.commands.setContent(result.value || '<p></p>')
      onChange(result.value || '')
      toast(`已导入 ${file.name}（${file.size} 字节）`, 'success')
    } catch (err: any) {
      toast('Word 导入失败：' + (err.message || '未知错误'), 'error')
    } finally {
      e.target.value = '' // 允许重复导入同一文件
    }
  }

  const editorRef = useRef<Editor | null>(null)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: placeholder || '开始编写教案正文...' }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      Image, Link.configure({ openOnClick: false }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle, FontFamily,
      FormulaNode,
      FormulaInlineNode,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none px-6 py-4 min-h-[400px]',
        style: 'line-height: 2; font-size: 16px;',
      },
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData
        if (!clipboard) return false
        // 已有 HTML 格式交给 TipTap 默认处理
        if (clipboard.getData('text/html')) return false
        const text = clipboard.getData('text/plain')
        if (!text) return false
        // 纯文本：按段落切分（双换行 = 段落分隔；单换行 = 段内换行）
        const blocks = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)
        if (blocks.length === 0) return false
        event.preventDefault()
        const html = blocks.map(b =>
          `<p>${b.replace(/\n/g, '<br/>').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`
        ).join('')
        // 通过 editor.commands.setContent 注入（更可靠的 HTML 注入）
        const { state } = view
        const tr = state.tr
        view.dispatch(tr)
        if (editorRef.current) {
          editorRef.current.commands.setContent(html)
        }
        return true
      },
    },
  }, [])

  // 同步 editorRef
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  // ── ProseMirror 段落 WYSIWYG 样式注入 ──
  useEffect(() => {
    const css = `
      .ProseMirror p { margin: 0 0 0.75em 0; line-height: 2; font-size: 16px; text-indent: 2em; min-height: 1em; }
      .ProseMirror h1 { font-size: 22px; font-weight: 700; margin: 1em 0 0.5em; line-height: 1.5; color: #1A1A2E; }
      .ProseMirror h2 { font-size: 18px; font-weight: 600; margin: 0.8em 0 0.4em; line-height: 1.5; color: #1A1A2E; }
      .ProseMirror ul, .ProseMirror ol { padding-left: 2em; margin: 0.5em 0; }
      .ProseMirror li { line-height: 2; font-size: 16px; }
      .ProseMirror blockquote { border-left: 3px solid #1A3A6B; padding: 0.5em 1em; margin: 0.75em 0; color: #595959; background: #F6F7F8; }
      .ProseMirror table { border-collapse: collapse; width: 100%; margin: 0.75em 0; }
      .ProseMirror th, .ProseMirror td { border: 1px solid #E7E7EB; padding: 6px 10px; font-size: 14px; }
      .ProseMirror th { background: #F6F7F8; font-weight: 600; }
      .ProseMirror img { max-width: 100%; margin: 0.5em 0; }
      .ProseMirror .is-empty::before { content: attr(data-placeholder); color: #C0C0C0; float: left; pointer-events: none; height: 0; }
    `
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [editor])

  // 同步外部 value 变化（仅在 value 与 editor 内容不一致时）
  useEffect(() => {
    if (editor && value && editor.getHTML() !== value && !editor.isFocused) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  // TOC 提取
  const [toc, setToc] = useState<Array<{ level: number; text: string; pos: number }>>([])
  useEffect(() => {
    if (!editor) return
    const timer = setInterval(() => {
      const headings: Array<{ level: number; text: string; pos: number }> = []
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          headings.push({ level: node.attrs.level, text: node.textContent, pos })
        }
      })
      setToc(headings)
    }, 1000)
    return () => clearInterval(timer)
  }, [editor])

  // 版本快照
  const takeSnapshot = useCallback((label?: string) => {
    if (!editor) return
    const html = editor.getHTML()
    setSnapshots(prev => [{ time: new Date().toLocaleTimeString(), content: html, label: label || '手动保存' }, ...prev].slice(0, 30))
  }, [editor])

  const restoreSnapshot = useCallback((html: string) => {
    if (!editor) return
    editor.commands.setContent(html)
    onChange(html)
  }, [editor, onChange])

  // 批注
  const addAnnotation = () => {
    const sel = window.getSelection()
    const selText = sel?.toString()?.trim()
    if (!selText || !newAnnotation.trim()) return
    const ann = { id: Date.now().toString(36), text: selText, comment: newAnnotation.trim(), time: new Date().toLocaleTimeString() }
    setAnnotations(prev => [ann, ...prev])
    setNewAnnotation('')
  }
  const deleteAnnotation = (id: string) => setAnnotations(prev => prev.filter(a => a.id !== id))

  // 公式插入（新建）
  const openFormulaEditor = (type: 'math' | 'chemistry') => {
    setEditingNodeName(null)
    setFormulaType(type)
    setFormulaDraft(type === 'chemistry' ? '2H_{2} + O_{2} \\rightarrow 2H_{2}O' : '')
    setFormulaWrap('block')
    setFormulaOpen(true)
  }

  // 公式编辑（来自节点 ✎ 按钮）：预填当前节点内容，记录节点类型
  const editFormulaRef = useRef<(a: FormulaEditAttrs) => void>(() => {})
  editFormulaRef.current = (a: FormulaEditAttrs) => {
    setEditingNodeName(a.type as 'formulaContainer' | 'formulaInline')
    setFormulaType(a.kind || 'math')
    setFormulaDraft(a.latex)
    setFormulaWrap(a.wrap as 'block' | 'float' | 'inline')
    setFormulaOpen(true)
  }
  const editFormulaStable = useCallback((a: FormulaEditAttrs) => editFormulaRef.current(a), [])

  const insertFormula = () => {
    if (!formulaDraft.trim()) {
      toast('请先输入公式内容', 'error')
      return
    }
    // 编辑已有节点：原地更新属性，而非插入新节点
    if (editingNodeName) {
      if (editingNodeName === 'formulaInline') {
        editor?.chain().focus().updateAttributes('formulaInline', { latex: formulaDraft, wrap: 'inline', kind: formulaType }).run()
      } else {
        editor?.chain().focus().updateAttributes('formulaContainer', { latex: formulaDraft, wrap: formulaWrap, kind: formulaType }).run()
      }
      setEditingNodeName(null)
      setFormulaOpen(false)
      return
    }
    if (formulaWrap === 'inline') {
      editor?.commands.insertFormulaInline({ latex: formulaDraft, kind: formulaType })
    } else {
      editor?.commands.insertFormula({ latex: formulaDraft, wrap: formulaWrap, kind: formulaType })
    }
    setFormulaOpen(false)
  }

  // 高度自动检测：含分式/根号/矩阵/大算子/反应箭头的高公式，行内会挤压正文，自动降级为块级
  useEffect(() => {
    if (formulaWrap === 'inline' && isTallFormula(formulaDraft)) {
      setFormulaWrap('block')
    }
  }, [formulaDraft, formulaWrap])

  // 链接
  const setLink = () => {
    if (!editor) return
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }

  const addImage = () => {
    if (!editor || !imgUrl) return
    editor.chain().focus().setImage({ src: imgUrl }).run()
    setShowImgInput(false)
    setImgUrl('')
  }

  // 图片从素材库选择
  const handleMaterialImageSelect = (items: any[]) => {
    if (!editor || !items.length) return
    for (const item of items) {
      const url = item.url || item.file_url || ''
      if (url) editor.chain().focus().setImage({ src: url }).run()
    }
    setShowImgInput(false)
  }

  if (!editor) return null

  const headingNodes = toc

  return (
    <FormulaEditContext.Provider value={editFormulaStable}>
    <div className="h-full flex flex-col bg-white">
      {/* ── Word 式工具栏 ── */}
      <div className="border-b border-[#E7E7EB] bg-[#F9FAFB] px-2 py-1.5 flex items-center gap-0.5 flex-wrap select-none text-[#595959] shrink-0">
        {/* 正文类型 */}
        <div className="flex items-center gap-0.5 mr-2">
          <button onClick={() => editor.chain().focus().setParagraph().run()}
            className={`px-2 h-7 text-[11px] rounded flex items-center gap-1 ${editor.isActive('paragraph') ? 'bg-[#E3ECFA] text-[#1A3A6B]' : 'hover:bg-[#F0F2F5]'}`}>
            <Type size={12} />正文
          </button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`h-7 w-7 flex items-center justify-center rounded ${editor.isActive('heading', { level: 1 }) ? 'bg-[#E3ECFA] text-[#1A3A6B]' : 'hover:bg-[#F0F2F5]'}`}
            title="标题 1">
            <Heading1 size={14} />
          </button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`h-7 w-7 flex items-center justify-center rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-[#E3ECFA] text-[#1A3A6B]' : 'hover:bg-[#F0F2F5]'}`}
            title="标题 2">
            <Heading2 size={14} />
          </button>
        </div>
        <div className="w-px h-5 bg-[#D9D9D9] mx-1" />

        {/* 字体 / 字号 */}
        <select
          onChange={e => editor.chain().focus().setFontFamily(e.target.value || '').run()}
          className="h-7 text-[11px] border border-[#E7E7EB] rounded px-1 bg-white hover:border-[#02A7F0] outline-none"
          title="字体"
        >
          <option value="">字体</option>
          <option value="SimSun">宋体</option>
          <option value="SimHei">黑体</option>
          <option value="KaiTi">楷体</option>
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
        </select>
        <select
          value={fontSize}
          onChange={e => {
            setFontSize(e.target.value)
            editor.chain().focus().selectAll().setMark('textStyle', { fontSize: e.target.value + 'px' }).run()
            // 只对选中区域生效，不是 selectAll
            const sel = window.getSelection()
            if (sel && !sel.isCollapsed) {
              editor.chain().focus().setMark('textStyle', { fontSize: e.target.value + 'px' }).run()
            }
          }}
          className="h-7 text-[11px] border border-[#E7E7EB] rounded px-1 bg-white hover:border-[#02A7F0] outline-none w-[52px]"
          title="字号"
        >
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="w-px h-5 bg-[#D9D9D9] mx-1" />

        {/* 加粗/斜体/下划线/删除线 */}
        <Tb active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="加粗"><Bold size={13} /></Tb>
        <Tb active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体"><Italic size={13} /></Tb>
        <Tb active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="下划线"><UnderlineIcon size={13} /></Tb>
        <Tb active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="删除线"><Strikethrough size={13} /></Tb>

        <div className="w-px h-5 bg-[#D9D9D9] mx-1" />

        {/* 对齐 */}
        <Tb active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="左对齐"><AlignLeft size={13} /></Tb>
        <Tb active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="居中"><AlignCenter size={13} /></Tb>
        <Tb active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="右对齐"><AlignRight size={13} /></Tb>

        <div className="w-px h-5 bg-[#D9D9D9] mx-1" />

        {/* 列表 */}
        <Tb active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="无序列表"><List size={13} /></Tb>
        <Tb active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="有序列表"><ListOrdered size={13} /></Tb>
        <Tb active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="引用"><Quote size={13} /></Tb>
        <Tb active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="代码块"><Code size={13} /></Tb>

        <div className="w-px h-5 bg-[#D9D9D9] mx-1" />

        {/* 公式 / 化学式 — 核心自定义按钮 */}
        <Tb onClick={() => openFormulaEditor('math')} title="插入数学公式（图片式容器）">
          <img src="/icon-math.svg" alt="数学式" width="14" height="14" style={{ filter: 'none' }} />
        </Tb>
        <Tb onClick={() => openFormulaEditor('chemistry')} title="插入化学式（图片式容器）">
          <img src="/icon-chemistry.svg" alt="化学式" width="10" height="10" style={{ filter: 'none' }} />
        </Tb>

        <div className="w-px h-5 bg-[#D9D9D9] mx-1" />

        {/* 表格 / 图片 / 链接 */}
        <Tb onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="插入表格"><Table2 size={13} /></Tb>
        <Tb onClick={() => { setShowImgInput(true); setImgUrl('') }} title="插入图片（URL / 素材库）"><ImageIcon size={13} /></Tb>
        <Tb active={editor.isActive('link')} onClick={() => {
          const prev = editor.getAttributes('link').href || ''
          setLinkUrl(prev)
          setShowLinkInput(true)
        }} title="插入链接"><Link2 size={13} /></Tb>

        <div className="w-px h-5 bg-[#D9D9D9] mx-1" />

        {/* 撤销 / 重做 */}
        <Tb onClick={() => editor.chain().focus().undo().run()} title="撤销"><Undo2 size={13} /></Tb>
        <Tb onClick={() => editor.chain().focus().redo().run()} title="重做"><Redo2 size={13} /></Tb>

        <div className="flex-1" />

        {/* 导入 Word & 版本快照 & 全屏 */}
        <input ref={wordInputRef} type="file" accept=".docx" className="hidden" onChange={handleWordImport} />
        <button onClick={() => wordInputRef.current?.click()} title="导入本地 Word 文档（.docx）"
          className="flex items-center gap-1 px-2 h-7 text-[10px] rounded hover:bg-[#F0F2F5] text-[#9A9A9A] mr-1">
          <FileText size={11} /> 导入 Word
        </button>
        <button onClick={() => takeSnapshot('手动快照')} title="保存版本快照"
          className="flex items-center gap-1 px-2 h-7 text-[10px] rounded hover:bg-[#F0F2F5] text-[#9A9A9A] mr-1">
          <Save size={11} /> 保存版本
        </button>
      </div>

      {/* ── 主编辑区（三栏) ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：章节导航 */}
        {outlineVisible && (
          <div className="w-[180px] border-r border-[#E7E7EB] bg-[#FAFBFC] flex flex-col shrink-0 overflow-hidden">
            <div className="px-3 py-2 text-[11px] font-semibold text-[#9A9A9A] flex items-center justify-between border-b border-[#F0F0F0] shrink-0">
              <span className="flex items-center gap-1"><ListTree size={12} />章节导航</span>
              <button onClick={() => setOutlineVisible(false)} className="text-[#C0C0C0] hover:text-[#9A9A9A]"><ChevronLeft size={12} /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {headingNodes.length === 0 ? (
                <p className="text-[11px] text-[#C0C0C0] px-3 py-2">暂无标题</p>
              ) : (
                headingNodes.map((h, i) => (
                  <button key={i}
                    onClick={() => editor.chain().focus().setNodeSelection(h.pos).run()}
                    className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#F0F2F5] truncate block ${h.level === 1 ? 'font-semibold text-[#353535]' : h.level === 2 ? 'pl-5 text-[#595959]' : 'pl-7 text-[#9A9A9A]'}`}
                  >
                    {h.level === 1 ? '▸ ' : h.level === 2 ? '· ' : '- '}{h.text || '（空标题）'}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* 中央：编辑器 */}
        <div className="flex-1 overflow-auto">
          <EditorContent editor={editor} />
        </div>

        {/* 右侧：批注 / 版本历史（双 Tab） */}
        {historyVisible && (
          <div className="w-[220px] border-l border-[#E7E7EB] bg-[#FAFBFC] flex flex-col shrink-0 overflow-hidden">
            {/* Tab 切换 */}
            <div className="flex border-b border-[#F0F0F0] shrink-0">
              <button onClick={() => setRightTab('annotations')}
                className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-colors ${rightTab === 'annotations' ? 'border-[#02A7F0] text-[#02A7F0] bg-white' : 'border-transparent text-[#9A9A9A] hover:text-[#595959]'}`}>
                <MessageSquare size={11} className="inline mr-1" />批注
              </button>
              <button onClick={() => setRightTab('history')}
                className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-colors ${rightTab === 'history' ? 'border-[#02A7F0] text-[#02A7F0] bg-white' : 'border-transparent text-[#9A9A9A] hover:text-[#595959]'}`}>
                <History size={11} className="inline mr-1" />版本
              </button>
              <button onClick={() => setHistoryVisible(false)} className="px-2 text-[#C0C0C0] hover:text-[#9A9A9A]">
                <ChevronLeft size={12} style={{ transform: 'rotate(180deg)' }} />
              </button>
            </div>

            {/* 批注面板 */}
            {rightTab === 'annotations' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* 新增批注 */}
                <div className="p-2 border-b border-[#F0F0F0] bg-white shrink-0">
                  <p className="text-[10px] text-[#9A9A9A] mb-1.5">选中正文文字后，在此输入批注内容</p>
                  <textarea
                    value={newAnnotation}
                    onChange={e => setNewAnnotation(e.target.value)}
                    rows={2}
                    placeholder="输入批注..."
                    className="w-full px-2 py-1 text-[11px] border border-[#E7E7EB] rounded focus:border-[#02A7F0] outline-none resize-none"
                  />
                  <button onClick={addAnnotation}
                    disabled={!newAnnotation.trim()}
                    className="w-full mt-1.5 py-1 text-[11px] text-white bg-[#02A7F0] rounded hover:bg-[#0288D1] disabled:opacity-40 flex items-center justify-center gap-1">
                    <Plus size={10} /> 添加批注
                  </button>
                </div>
                {/* 批注列表 */}
                <div className="flex-1 overflow-y-auto">
                  {annotations.length === 0 ? (
                    <p className="text-[11px] text-[#C0C0C0] text-center py-4">暂无批注</p>
                  ) : (
                    annotations.map((a) => (
                      <div key={a.id} className="p-2 border-b border-[#F5F5F5] hover:bg-[#F0F2F5]">
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[11px] text-[#1A3A6B] bg-[#E3ECFA] px-1.5 py-0.5 rounded truncate max-w-[120px]" title={a.text}>
                            "{a.text.substring(0, 20)}{a.text.length > 20 ? '…' : ''}"
                          </span>
                          <button onClick={() => deleteAnnotation(a.id)} className="text-[#C0C0C0] hover:text-red-400 shrink-0">
                            <X size={10} />
                          </button>
                        </div>
                        <p className="text-[11px] text-[#595959] mt-1 leading-relaxed">{a.comment}</p>
                        <span className="text-[9px] text-[#C0C0C0]">{a.time}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 版本历史面板 */}
            {rightTab === 'history' && (
              <div className="flex-1 overflow-y-auto py-1">
                <button onClick={() => takeSnapshot('点击保存')}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-[#02A7F0] hover:bg-[#F0F2F5] flex items-center gap-1">
                  <Plus size={10} /> 保存当前版本
                </button>
                <div className="border-t border-[#F0F0F0] my-1" />
                {snapshots.length === 0 ? (
                  <p className="text-[11px] text-[#C0C0C0] px-3 py-2">暂无版本记录</p>
                ) : (
                  snapshots.map((s, i) => (
                    <div key={i} className="px-3 py-1.5 hover:bg-[#F0F2F5] border-b border-[#F5F5F5]">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#353535]">{s.time}</span>
                        <span className="text-[9px] text-[#C0C0C0]">{s.label}</span>
                      </div>
                      <div className="flex gap-2 mt-0.5">
                        <button onClick={() => restoreSnapshot(s.content)}
                          className="text-[10px] text-[#02A7F0] hover:underline flex items-center gap-0.5">
                          <RotateCcw size={9} />恢复
                        </button>
                        <button onClick={() => editor?.commands.setContent(s.content)}
                          className="text-[10px] text-[#9A9A9A] hover:underline flex items-center gap-0.5">
                          <Eye size={9} />预览
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* 收起后的展开按钮 */}
        {!outlineVisible && (
          <button onClick={() => setOutlineVisible(true)} title="展开章节导航"
            className="absolute left-0 top-1/3 w-5 h-12 bg-white border border-[#E7E7EB] rounded-r flex items-center justify-center hover:bg-[#F6F7F8] z-10">
            <ChevronLeft size={12} style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
        {!historyVisible && (
          <button onClick={() => setHistoryVisible(true)} title="展开版本历史"
            className="absolute right-0 top-1/3 w-5 h-12 bg-white border border-[#E7E7EB] rounded-l flex items-center justify-center hover:bg-[#F6F7F8] z-10">
            <ChevronLeft size={12} />
          </button>
        )}
      </div>

      {/* ── 公式/化学式 编辑弹窗 ── */}
      {formulaOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" onClick={() => { setFormulaOpen(false); setEditingNodeName(null) }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-2xl w-[540px] max-w-[92vw] z-10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F0F0]">
              <span className="text-sm font-semibold text-[#353535] flex items-center gap-1.5">
                <img src={formulaType === 'math' ? '/icon-math.svg' : '/icon-chemistry.svg'} alt="" width={formulaType === 'math' ? 16 : 10} height={formulaType === 'math' ? 16 : 10} />
                {editingNodeName ? (formulaType === 'math' ? '编辑数学公式' : '编辑化学式') : (formulaType === 'math' ? '插入数学公式' : '插入化学式')}
              </span>
              <span className="text-[10px] text-[#9A9A9A]">图片式容器 · 行内字间 / 四周环绕 / 上下环绕 · 选中公式可点 ✎ 编辑</span>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {(formulaType === 'math' ? [
                  { label: '二次公式', tex: '\\frac{-b \\pm \\sqrt{b^{2}-4ac}}{2a}' },
                  { label: '勾股定理', tex: 'a^{2} + b^{2} = c^{2}' },
                  { label: '平方根', tex: '\\sqrt{x}' },
                  { label: '分数', tex: '\\frac{a}{b}' },
                  { label: '幂', tex: 'x^{n}' },
                  { label: '下标', tex: 'x_{1}' },
                  { label: '积分', tex: '\\int_{0}^{\\infty}' },
                  { label: '求和', tex: '\\sum_{i=1}^{n}' },
                  { label: '希腊', tex: '\\alpha \\beta \\gamma \\pi' },
                  { label: '矩阵', tex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
                ] : [
                  { label: '方程式', tex: '2H_{2} + O_{2} \\rightarrow 2H_{2}O' },
                  { label: '离子', tex: 'Na^{+} + Cl^{-} \\rightarrow NaCl' },
                  { label: '可逆', tex: 'A + B \\rightleftharpoons C + D' },
                  { label: '沉淀', tex: 'Ag^{+} + Cl^{-} \\rightarrow AgCl \\downarrow' },
                  { label: '气体', tex: 'Zn + 2HCl \\rightarrow ZnCl_{2} + H_{2} \\uparrow' },
                  { label: '氧化还原', tex: '2Fe^{3+} + 2I^{-} \\rightarrow 2Fe^{2+} + I_{2}' },
                  { label: '酸碱', tex: 'H^{+} + OH^{-} \\rightarrow H_{2}O' },
                  { label: '分子式', tex: 'H_{2}SO_{4}' },
                  { label: '有机', tex: 'CH_{3}COOH' },
                  { label: '配位', tex: '[Cu(NH_{3})_{4}]^{2+}' },
                ]).map((item, i) => (
                  <button key={i}
                    onClick={() => setFormulaDraft(prev => prev + ' ' + item.tex)}
                    className="px-2 py-0.5 text-[10px] bg-[#F6F7F8] border border-[#E7E7EB] rounded hover:bg-[#E8F7FF] hover:border-[#02A7F0]">
                    {item.label}
                  </button>
                ))}
              </div>
              <textarea value={formulaDraft} onChange={e => setFormulaDraft(e.target.value)}
                rows={4} className="w-full px-3 py-2 text-[13px] font-mono border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0] resize-y" autoFocus />
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[11px] text-[#9A9A9A] mb-1">实时预览</label>
                  <div className="min-h-[48px] p-3 bg-[#F9FAFB] border border-[#E7E7EB] rounded-[4px] flex items-center justify-center">
                    <FormulaPreview latex={formulaDraft} isBlock={formulaWrap !== 'inline'} />
                  </div>
                </div>
                <div className="shrink-0">
                  <label className="block text-[11px] text-[#9A9A9A] mb-1">插入方式</label>
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => setFormulaWrap('block')}
                      className={`px-3 py-1.5 text-[11px] rounded border text-left ${formulaWrap === 'block' ? 'bg-[#02A7F0]/10 border-[#02A7F0] text-[#02A7F0]' : 'border-[#E7E7EB] text-[#9A9A9A]'}`}>▬ 上下环绕（块级）</button>
                    <button onClick={() => setFormulaWrap('float')}
                      className={`px-3 py-1.5 text-[11px] rounded border text-left ${formulaWrap === 'float' ? 'bg-[#02A7F0]/10 border-[#02A7F0] text-[#02A7F0]' : 'border-[#E7E7EB] text-[#9A9A9A]'}`}>◧ 四周环绕（浮动）</button>
                    <button onClick={() => setFormulaWrap('inline')}
                      className={`px-3 py-1.5 text-[11px] rounded border text-left ${formulaWrap === 'inline' ? 'bg-[#02A7F0]/10 border-[#02A7F0] text-[#02A7F0]' : 'border-[#E7E7EB] text-[#9A9A9A]'}`}>∷ 行内字间（行内）</button>
                  </div>
                </div>
              </div>
              {isTallFormula(formulaDraft) && formulaWrap !== 'block' && (
                <p className="text-[11px] text-[#B26A00] bg-[#FFF7E6] border border-[#FFE0A3] rounded px-2 py-1.5">
                  检测到该公式含分式 / 根号 / 矩阵 / 大算子 / 反应箭头，行内或浮动会挤压正文行高，已自动切换为「上下环绕（块级）」。如需紧凑排版，建议用块级并适当缩放。
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#F0F0F0]">
              <button onClick={() => { setFormulaOpen(false); setEditingNodeName(null) }} className="px-4 py-1.5 text-[12px] text-[#595959] border border-[#E7E7EB] rounded-[4px]">取消</button>
              <button onClick={insertFormula} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1]">{editingNodeName ? '保存修改' : '插入到文档'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 链接弹窗 ── */}
      {showLinkInput && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" onClick={() => setShowLinkInput(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-2xl w-[400px] z-10 p-5" onClick={e => e.stopPropagation()}>
            <label className="block text-[12px] font-medium text-[#353535] mb-2">链接地址</label>
            <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..." className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:border-[#02A7F0] mb-3" autoFocus />
            <div className="flex justify-end gap-2">
              <button onClick={() => { editor.chain().focus().unsetLink().run(); setShowLinkInput(false) }} className="px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50 rounded">移除链接</button>
              <button onClick={() => setShowLinkInput(false)} className="px-3 py-1.5 text-[12px] text-[#595959] border rounded">取消</button>
              <button onClick={setLink} className="px-3 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded">确定</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 图片弹窗（URL / 素材库）── */}
      {showImgInput && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" onClick={() => setShowImgInput(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-2xl w-[420px] z-10 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setShowMaterialPicker(false)}
                className={`flex-1 py-2 text-[12px] rounded border ${!showMaterialPicker ? 'bg-[#02A7F0]/10 border-[#02A7F0] text-[#02A7F0] font-medium' : 'border-[#E7E7EB] text-[#9A9A9A]'}`}
              >
                🔗 粘贴 URL
              </button>
              <button
                onClick={() => setShowMaterialPicker(true)}
                className={`flex-1 py-2 text-[12px] rounded border ${showMaterialPicker ? 'bg-[#02A7F0]/10 border-[#02A7F0] text-[#02A7F0] font-medium' : 'border-[#E7E7EB] text-[#9A9A9A]'}`}
              >
                🖼️ 从素材库选择
              </button>
            </div>
            {showMaterialPicker ? (
              <div className="text-center py-6">
                <button onClick={() => { setShowMaterialPicker(false); setShowImgInput(false) }}
                  className="px-4 py-2 text-[12px] text-white bg-[#02A7F0] rounded hover:bg-[#0288D1]">
                  打开素材库
                </button>
                <p className="text-[11px] text-[#9A9A9A] mt-2">从个人素材库或校本题库中选择图片</p>
              </div>
            ) : (
              <>
                <label className="block text-[12px] font-medium text-[#353535] mb-2">图片 URL</label>
                <input value={imgUrl} onChange={e => setImgUrl(e.target.value)}
                  placeholder="https://..." className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:border-[#02A7F0] mb-3" autoFocus />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowImgInput(false)} className="px-3 py-1.5 text-[12px] text-[#595959] border rounded">取消</button>
                  <button onClick={addImage} className="px-3 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded">插入</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 素材库图片选择器 ── */}
      {showImgInput && showMaterialPicker && (
        <ResourcePicker
          open={true}
          mode="materials"
          onClose={() => setShowMaterialPicker(false)}
          onSelect={handleMaterialImageSelect}
          selectedIds={[]}
        />
      )}
    </div>
    </FormulaEditContext.Provider>
  )
}
