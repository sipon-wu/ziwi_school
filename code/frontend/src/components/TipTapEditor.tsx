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
import { Bold, Italic, UnderlineIcon, Strikethrough, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Quote, Code, Link2, ImageIcon, Table2, Undo2, Redo2, Heading1, Heading2, Type, ListTree, History, RotateCcw, Eye, Save, ChevronLeft, Plus, MessageSquare, Trash2, X, FileText, Pencil } from 'lucide-react'
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

function FormulaView({ node, updateAttributes, selected, deleteNode, getPos, editor }: { node: any; updateAttributes: (a: Record<string, any>) => void; selected: boolean; deleteNode: () => void; getPos: () => number | undefined; editor: any }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const latex = (node.attrs.latex as string) || ''
  const wrap = (node.attrs.wrap as 'block' | 'float-left' | 'float-right' | 'inline') || 'block'
  const kind = (node.attrs.kind as 'math' | 'chemistry') || 'math'
  const fontSize = (node.attrs.fontSize as number) || 0
  const openEditor = useContext(FormulaEditContext)
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

  // 缩放：8 个控制点共用一个工厂函数，按 handle 方向决定用 dx / dy / max(|dx|,|dy|)
  // 4 边中点：n/s 用 dy，e/w 用 dx（单方向缩放，光标语义与行为一致）
  // 4 角：取两方向绝对值较大者，符号按出门向量投影确定（正=向外=放大）
  // 关键修复（2026-07-15）：左/上边（w/n/nw/sw/ne）方向需 invert，因为向外移动时 delta 为负；
  // 原代码所有 left/top 相关手柄都是反的——拖左边的手柄向中心（向右）=dx>0 → delta>0 → 放大 ❌
  const startResize = (handle: string) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startFont = fontSize || (wrap === 'block' ? 20 : 16)
    // 动态上限：测量编辑区宽度和公式当前宽度，保证放大后不超出页宽
    // maxFont = (编辑区宽 × 0.92 × startFont) / 公式当前宽
    const editorWidth = editor?.view?.dom?.clientWidth || 800
    const formulaWidth = ref.current?.parentElement?.clientWidth || 100
    const maxFont = Math.min(200, Math.max(startFont, Math.floor((editorWidth * 0.92 * startFont) / Math.max(formulaWidth, 1))))
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      let delta: number
      const m = Math.max(Math.abs(dx), Math.abs(dy)) || 0
      // 每个手柄的"向外"方向投影（正=向外=放大）：
      //  e(右):向外=右,dx>0 为正 → delta=dx
      //  w(左):向外=左,dx<0 为正 → delta=-dx
      //  s(下):向外=下,dy>0 为正 → delta=dy
      //  n(上):向外=上,dy<0 为正 → delta=-dy
      //  角：向外方向为沿对角向外,投影用 dx*dirX + dy*dirY
      switch (handle) {
        case 'e':  delta = dx; break
        case 'w':  delta = -dx; break
        case 's':  delta = dy; break
        case 'n':  delta = -dy; break
        case 'se': delta = m * (dx + dy >= 0 ? 1 : -1); break   // 向外=(+1,+1)
        case 'ne': delta = m * (dx - dy >= 0 ? 1 : -1); break   // 向外=(+1,-1)
        case 'sw': delta = m * (-dx + dy >= 0 ? 1 : -1); break  // 向外=(-1,+1)
        case 'nw': delta = m * (-(dx + dy) >= 0 ? 1 : -1); break // 向外=(-1,-1)
        default: delta = 0
      }
      const next = Math.min(maxFont, Math.max(8, Math.round(startFont + delta * 0.6)))
      updateAttributes({ fontSize: next })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // 8 个控制点定义（Figma/Photoshop 选区样式：白底灰边小方块骑在框线上）
  const handles: Array<{ k: string; pos: string; cur: string }> = [
    { k: 'nw', pos: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2', cur: 'nwse-resize' },
    { k: 'n',  pos: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2', cur: 'ns-resize' },
    { k: 'ne', pos: 'top-0 right-0 translate-x-1/2 -translate-y-1/2', cur: 'nesw-resize' },
    { k: 'e',  pos: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2', cur: 'ew-resize' },
    { k: 'se', pos: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cur: 'nwse-resize' },
    { k: 's',  pos: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cur: 'ns-resize' },
    { k: 'sw', pos: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cur: 'nesw-resize' },
    { k: 'w',  pos: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2', cur: 'ew-resize' },
  ]

  // 手动拖拽：mousedown 在公式主体（非控制点/浮窗）后，移动 > 4px 才视为拖拽
  // - 拖拽中：克隆公式渲染结果为 ghost 副本，跟随鼠标并带阻尼插值（丝滑）；同时画一条起点→ghost 的虚线轨迹
  // - 原节点半透明占位，松手前不实际改动文档
  // - 松手：按落点水平位置决定环绕方向（左/右/块级），并用 ProseMirror transaction 把节点移到新位置
  // 关键修复（2026-07-15）：原先在每次 mousedown 立即 appendChild(ghost/svg) + 改 opacity，会在 ProseMirror 选区建立前
  // 动 document.body，导致行内公式首次点中时 selected 永远变不成 true、手柄/编辑/删除图标不出现。
  // 改为：简单点击完全空操作（让 ProseMirror 正常建选区），只有真正检测到移动后才创建 ghost/svg/调 opacity。
  const handleNodeMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-formula-handle]')) return // 点在控制点/浮窗上不进入拖拽

    const startX = e.clientX
    const startY = e.clientY
    let hasMoved = false
    const isInline = !!node.type.spec.inline

    // 拖拽相关 DOM 元素的延迟创建容器（仅在 hasMoved 变 true 时才真正 append）
    let ghost: HTMLDivElement | null = null
    let svg: SVGSVGElement | null = null
    let path: SVGPathElement | null = null
    let placeholder: HTMLElement | null = null
    let curX = startX, curY = startY
    let lastX = startX, lastY = startY
    let raf = 0

    const setupDragVisuals = () => {
      if (ghost) return // 幂等：只创建一次
      // ghost 副本：内容与当前渲染结果一致，fixed 定位跟随鼠标
      ghost = document.createElement('div')
      ghost.innerHTML = ref.current?.innerHTML || ''
      ghost.style.cssText = `position:fixed;z-index:9999;pointer-events:none;opacity:0.85;left:${startX}px;top:${startY}px;transform:translate(-50%,-50%);font-size:${fontSize ? fontSize + 'px' : '16px'};`
      document.body.appendChild(ghost)

      // 轨迹线（SVG 虚线，起点→ghost 当前位置）
      const svgNS = 'http://www.w3.org/2000/svg'
      svg = document.createElementNS(svgNS, 'svg')
      svg.setAttribute('style', 'position:fixed;inset:0;width:100%;height:100%;z-index:9998;pointer-events:none;')
      path = document.createElementNS(svgNS, 'path')
      path.setAttribute('stroke', '#02A7F0')
      path.setAttribute('stroke-width', '2')
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke-dasharray', '5 4')
      path.setAttribute('opacity', '0.55')
      svg.appendChild(path)
      document.body.appendChild(svg)

      // 原节点半透明占位
      placeholder = (ref.current?.parentElement as HTMLElement | null)
      if (placeholder) placeholder.style.opacity = '0.35'
    }

    // 阻尼：ghost 当前位置每帧逼近鼠标目标（系数 0.25 产生丝滑拖尾）
    const tick = () => {
      if (!ghost || !path) return
      curX += (lastX - curX) * 0.25
      curY += (lastY - curY) * 0.25
      ghost.style.left = curX + 'px'
      ghost.style.top = curY + 'px'
      path.setAttribute('d', `M ${startX} ${startY} L ${curX.toFixed(1)} ${curY.toFixed(1)}`)
      raf = requestAnimationFrame(tick)
    }

    const onMove = (ev: MouseEvent) => {
      lastX = ev.clientX
      lastY = ev.clientY
      if (!hasMoved) {
        if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 4) return
        hasMoved = true
        setupDragVisuals() // 关键：只在确认是拖拽时才动 body
        raf = requestAnimationFrame(tick)
      }
    }

    const cleanup = () => {
      cancelAnimationFrame(raf)
      if (ghost) { ghost.remove(); ghost = null }
      if (svg) { svg.remove(); svg = null }
      if (placeholder) { placeholder.style.opacity = ''; placeholder = null }
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    const onUp = (ev: MouseEvent) => {
      cleanup()
      if (!hasMoved) return // 单击不视为拖拽，让 ProseMirror 处理选中

      const pos = getPos?.()
      if (typeof pos !== 'number' || !editor) return
      const nodeRef = editor.state.doc.nodeAt(pos)
      if (!nodeRef) return
      const nodeSize = nodeRef.nodeSize
      const view = editor.view
      const result = view.posAtCoords({ left: ev.clientX, top: ev.clientY })
      if (!result) return
      let targetPos = result.pos
      if (targetPos >= pos && targetPos <= pos + nodeSize) return // 落到原节点内不移动
      if (targetPos > pos + nodeSize) targetPos -= nodeSize // 调整因删除导致的位置偏移

      // 落点水平位置决定环绕方向（字间节点保持 inline；块级节点按左右半区切换环绕方向）
      let newWrap: string = (nodeRef.attrs.wrap as string) || 'block'
      if (isInline) {
        newWrap = 'inline'
      } else {
        const vw = window.innerWidth
        if (ev.clientX < vw * 0.4) newWrap = 'float-left'
        else if (ev.clientX > vw * 0.6) newWrap = 'float-right'
        else newWrap = 'block'
      }

      const tr = view.state.tr
      tr.delete(pos, pos + nodeSize)
      const newNode = nodeRef.type.create({ ...nodeRef.attrs, wrap: newWrap }, nodeRef.content)
      tr.insert(targetPos, newNode)
      view.dispatch(tr)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const onEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openEditor?.({ latex, wrap, kind, type: node.type.name })
  }

  const isInlineSpan = wrap === 'inline' && node.type.spec.inline
  // 内层样式：border/background/padding 紧贴 KaTeX 内容（消除"容器内左侧大量空白"）
  // 外层只管布局/拖拽/控制点定位，不挂 border 避免全宽背景把空白"框"进来
  // 关键修复（2026-07-15）：行内公式改用 align-baseline + py-0，消除"上半截空白"——
  // 之前 align-middle + py-1 让 KaTeX 行内内容掉到容器下半部分。
  const innerBoxClass = `${isInlineSpan
    ? 'inline-block leading-none align-baseline'
    : 'inline-block leading-none align-middle'
  } border rounded text-indent-0 ${selected ? 'border-[#02A7F0]' : 'border-[#02A7F0]/25'} bg-[#F0F9FF]/50 ${isInlineSpan ? 'px-0 py-0' : 'px-1.5 py-1'}`
  return (
    <NodeViewWrapper
      as={isInlineSpan ? 'span' : 'div'}
      data-wrap={wrap}
      data-latex={latex}
      onMouseDown={handleNodeMouseDown}
      className={`formula-box-container select-none relative ${isInlineSpan
        ? 'inline-block align-baseline mx-0'
        : wrap === 'block'
          ? 'flex justify-center my-3'
          : wrap === 'float-left'
            ? 'float-left mr-3 mb-2 max-w-[80%] z-10'
            : 'float-right ml-3 mb-2 max-w-[80%] z-10'}`}
      style={{ userSelect: 'none', textIndent: 0, fontSize: fontSize ? `${fontSize}px` : undefined }}
    >
      <span ref={ref} className={innerBoxClass} style={{ textIndent: 0 }} />
      {selected && (
        <>
          {/* 8 个缩放控制点（Figma/Photoshop 选区样式：白底灰边小方块骑在框线上） */}
          {handles.map(h => (
            <span
              key={h.k}
              draggable={false}
              onPointerDown={startResize(h.k)}
              onMouseDown={e => e.stopPropagation()}
              data-formula-handle
              className={`absolute w-1.5 h-1.5 bg-white border border-[#9CA3AF] ${h.pos} cursor-${h.cur} z-10`}
              contentEditable={false}
            />
          ))}
          {/* 右上角外浮窗：紧凑迷你工具栏（白底+淡边+细分割线），SVG 图标确保跨字体稳定渲染 */}
          <div
            data-formula-handle
            onMouseDown={e => e.stopPropagation()}
            className="absolute -top-3 -right-3 flex items-center bg-white border border-[#D1D5DB] rounded-md shadow-md z-20 overflow-hidden"
            contentEditable={false}
          >
            <button
              type="button"
              onClick={onEdit}
              onMouseDown={e => e.stopPropagation()}
              className="w-6 h-6 flex items-center justify-center cursor-pointer text-[#595959] hover:bg-[#F0F9FF] hover:text-[#02A7F0] border-r border-[#E5E7EB]"
              title="编辑公式"
              contentEditable={false}
            >
              <Pencil size={12} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              onMouseDown={e => e.stopPropagation()}
              className="w-6 h-6 flex items-center justify-center cursor-pointer text-[#595959] hover:bg-[#FEF2F2] hover:text-[#EF4444]"
              title="删除该公式"
              contentEditable={false}
            >
              <Trash2 size={12} strokeWidth={2.2} />
            </button>
          </div>
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
      latex: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-latex') || '',
        renderHTML: (attrs: any) => ({ 'data-latex': attrs.latex || '' }),
      },
      // wrap / kind 一并序列化进 data-*，确保保存后重开环绕/行内布局与公式类型不丢失。
      // mergeAttributes 能正确合并多个 data-* 属性（早前"多属性丢属性"的判断已证伪）。
      wrap: {
        default: 'block' as 'block' | 'float-left' | 'float-right' | 'inline',
        parseHTML: (el: HTMLElement) => (el.getAttribute('data-wrap') as any) || 'block',
        renderHTML: (attrs: any) => ({ 'data-wrap': attrs.wrap || 'block' }),
      },
      kind: {
        default: 'math' as 'math' | 'chemistry',
        parseHTML: (el: HTMLElement) => (el.getAttribute('data-kind') as any) || 'math',
        renderHTML: (attrs: any) => ({ 'data-kind': attrs.kind || 'math' }),
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
    // latex / wrap / kind / fontSize 由 addAttributes 的 renderHTML 统一输出到 data-*，此处仅补 data-formula 标记。
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-formula': 'true',
      contenteditable: 'false',
    })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(FormulaView)
  },
  addCommands() {
    return {
      insertFormula: (attrs: { latex: string; wrap: 'block' | 'float-left' | 'float-right' | 'inline'; kind?: 'math' | 'chemistry' }) => ({ commands }: any) => {
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
      latex: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-latex') || '',
        renderHTML: (attrs: any) => ({ 'data-latex': attrs.latex || '' }),
      },
      wrap: {
        default: 'inline' as 'block' | 'float-left' | 'float-right' | 'inline',
        parseHTML: (el: HTMLElement) => (el.getAttribute('data-wrap') as any) || 'inline',
        renderHTML: (attrs: any) => ({ 'data-wrap': attrs.wrap || 'inline' }),
      },
      kind: {
        default: 'math' as 'math' | 'chemistry',
        parseHTML: (el: HTMLElement) => (el.getAttribute('data-kind') as any) || 'math',
        renderHTML: (attrs: any) => ({ 'data-kind': attrs.kind || 'math' }),
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

// 扩展 TipTap 命令类型，使 editor.commands.insertFormula / insertFormulaInline 合法
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formulaContainer: {
      insertFormula: (attrs: { latex: string; wrap: 'block' | 'float-left' | 'float-right' | 'inline'; kind?: 'math' | 'chemistry' }) => ReturnType
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
  const [formulaWrap, setFormulaWrap] = useState<'block' | 'float-left' | 'float-right' | 'inline'>('block')
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
      // 守卫：编辑器初始化完成前 schema 为 null，此时 getHTML 会崩溃
      if (!editor.isInitialized) return
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

  // 公式弹窗防闪退：弹窗打开时禁用编辑器（setEditable(false)），阻止 ProseMirror 因焦点转移/selection 变化触发任何 transaction
  useEffect(() => {
    if (!formulaOpen) return
    editor?.setEditable(false)
    return () => { editor?.setEditable(true) }
  }, [formulaOpen, editor])

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
  // 守卫 isInitialized：编辑器初始化完成前 schema 为 null，调用 getHTML 会崩溃
  useEffect(() => {
    if (!editor || !editor.isInitialized) return
    if (value && editor.getHTML() !== value && !editor.isFocused) {
      editor.commands.setContent(value)
    }
  }, [value, editor, editor?.isInitialized])

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
    setFormulaWrap(a.wrap as 'block' | 'float-left' | 'float-right' | 'inline')
    setFormulaOpen(true)
  }
  const editFormulaStable = useCallback((a: FormulaEditAttrs) => editFormulaRef.current(a), [])

  const insertFormula = () => {
    if (!formulaDraft.trim()) {
      toast('请先输入公式内容', 'error')
      return
    }
    // 弹窗打开时 editor 被设为不可编辑（防止编辑弹窗内操作触发 blur 闪退）；
    // 但插入/更新命令必须在可编辑状态下执行，否则 ProseMirror 会忽略事务
    editor?.setEditable(true)
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
    // 用 insertContentAt 在【光标位置】显式插入（而非文档末尾），尊重用户编辑位置。
    // 仍用 insertContentAt(显式坐标) 而非 insertContent，避免光标落在某已选中公式节点内时覆盖已有公式。
    if (editor) {
      let pos = editor.state.selection.from
      if (formulaWrap === 'inline') {
        // 行内公式必须落在文本块内：若当前光标不在文本块（如在块级公式上/文档边界），回退到末尾文本块末尾
        const $pos = editor.state.doc.resolve(pos)
        if (!$pos.parent.isTextblock) {
          const doc = editor.state.doc
          const lastChild = doc.lastChild as any
          pos = (lastChild && lastChild.isTextblock)
            ? doc.content.size - lastChild.nodeSize + 1 + lastChild.content.size
            : doc.content.size
        }
        editor.commands.insertContentAt(pos, {
          type: 'formulaInline',
          attrs: { kind: formulaType, latex: formulaDraft, wrap: 'inline' }
        })
      } else {
        editor.commands.insertContentAt(pos, {
          type: 'formulaContainer',
          attrs: { kind: formulaType, latex: formulaDraft, wrap: formulaWrap }
        })
      }
    }
    setFormulaOpen(false)
  }

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => { setFormulaOpen(false); setEditingNodeName(null) }}>
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
                    <button onClick={() => setFormulaWrap('float-left')}
                      className={`px-3 py-1.5 text-[11px] rounded border text-left ${formulaWrap === 'float-left' ? 'bg-[#02A7F0]/10 border-[#02A7F0] text-[#02A7F0]' : 'border-[#E7E7EB] text-[#9A9A9A]'}`}>◧ 四周环绕·左</button>
                    <button onClick={() => setFormulaWrap('float-right')}
                      className={`px-3 py-1.5 text-[11px] rounded border text-left ${formulaWrap === 'float-right' ? 'bg-[#02A7F0]/10 border-[#02A7F0] text-[#02A7F0]' : 'border-[#E7E7EB] text-[#9A9A9A]'}`}>◩ 四周环绕·右</button>
                    <button onClick={() => setFormulaWrap('inline')}
                      className={`px-3 py-1.5 text-[11px] rounded border text-left ${formulaWrap === 'inline' ? 'bg-[#02A7F0]/10 border-[#02A7F0] text-[#02A7F0]' : 'border-[#E7E7EB] text-[#9A9A9A]'}`}>∷ 行内字间（行内）</button>
                  </div>
                </div>
              </div>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setShowLinkInput(false)}>
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={() => setShowImgInput(false)}>
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
