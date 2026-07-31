import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { CwElement, CwSlide } from '../lib/exportPptx'
import { layoutElements, extractBullets } from '../lib/exportPptx'
import type { CwTheme } from '../lib/pptThemes'
import { DEFAULT_THEME } from '../lib/pptThemes'

const FONT = 'Microsoft YaHei'

interface PptxPreviewProps {
  slides: CwSlide[]
  theme?: CwTheme
  className?: string
  /** WYSIWYG 可编辑模式：绝对定位元素层可拖拽/缩放/编辑 */
  editable?: boolean
  /** 受控当前页；不传则内部自管 */
  index?: number
  onIndexChange?: (i: number) => void
  /** 编辑态元素/标题变更回写 */
  onSlideChange?: (index: number, slide: CwSlide) => void
  showPager?: boolean
}

const CANVAS_W = 960
const CANVAS_H = 540
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export default function PptxPreview({
  slides,
  theme: themeProp,
  className,
  editable = false,
  index,
  onIndexChange,
  onSlideChange,
  showPager = true,
}: PptxPreviewProps) {
  const theme = useMemo(() => themeProp || DEFAULT_THEME, [themeProp])
  const [i, setI] = useState(0)
  const current = clamp(index ?? i, 0, slides.length - 1)

  const setIndex = (n: number) => {
    const c = clamp(n, 0, slides.length - 1)
    setI(c)
    onIndexChange?.(c)
  }

  // 编辑态：当前页元素变更回写
  const handleSlideChange = (slide: CwSlide) => {
    onSlideChange?.(current, slide)
  }

  return (
    <div className={`flex flex-col items-center ${className || ''}`}>
      <div className="w-full max-w-4xl">
        {editable ? (
          <EditableCanvas slide={slides[current]} theme={theme} onChange={handleSlideChange} />
        ) : (
          <div className="space-y-6">
            {slides.map((s, idx) => (
              <div key={idx} className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5">
                {renderStaticSlide(s, theme, idx)}
              </div>
            ))}
          </div>
        )}
      </div>

      {showPager && !editable && slides.length > 1 && (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setIndex(current - 1)}
            disabled={current === 0}
            className="rounded px-3 py-1 text-sm bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:bg-white disabled:opacity-40"
          >
            上一页
          </button>
          <span className="text-sm text-slate-500">{current + 1} / {slides.length}</span>
          <button
            onClick={() => setIndex(current + 1)}
            disabled={current === slides.length - 1}
            className="rounded px-3 py-1 text-sm bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:bg-white disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── 静态（放映/预览）渲染 ───────────────────────── */

function renderStaticSlide(s: CwSlide, theme: CwTheme, idx: number) {
  if (s.kind === 'cover') {
    return (
      <div className="relative" style={{ aspectRatio: '16/9', background: theme.coverBg }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
          <h2 className="text-4xl font-bold" style={{ color: theme.onPrimary }}>{s.title}</h2>
          {s.subtitle && <p className="mt-4 text-lg" style={{ color: theme.lightText }}>{s.subtitle}</p>}
        </div>
        {s.footer && (
          <div className="absolute bottom-5 w-full text-center text-xs" style={{ color: theme.footer }}>{s.footer}</div>
        )}
      </div>
    )
  }
  return (
    <div className="relative bg-white" style={{ aspectRatio: '16/9' }}>
      <div className="absolute left-0 top-0 h-[15.3%] w-full" style={{ background: theme.primary }} />
      <div className="absolute left-[2%] top-0 flex h-[15.3%] items-center" style={{ width: '96%' }}>
        <span className="truncate text-2xl font-bold" style={{ color: theme.onPrimary }}>{s.title}</span>
      </div>
      {s.elements && s.elements.length ? (
        renderElementsStatic(s.elements)
      ) : (
        <div className="absolute left-[5.3%] top-[20%]" style={{ width: '89.4%', height: '70%' }}>
          {(s.rich || []).map((line, k) => (
            <p key={k} className="mb-2" style={{ color: theme.body, fontSize: 16, fontFamily: FONT }}>
              {line.options.bullet ? '• ' : ''}{line.text}
            </p>
          ))}
        </div>
      )}
      {s.footer && (
        <div className="absolute bottom-[2%] right-[3%] text-[10px]" style={{ color: theme.footer }}>{s.footer}</div>
      )}
    </div>
  )
}

function renderElementsStatic(elements: CwElement[]) {
  return (
    <>
      {elements.map((el) => (
        <div
          key={el.id}
          className="absolute overflow-hidden"
          style={{
            left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`,
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          }}
        >
          {el.type === 'text' && (
            <div
              className="h-full w-full whitespace-pre-wrap"
              style={{
                color: `#${el.color || '222222'}`, fontSize: el.fontSize || 18, fontWeight: el.bold ? 700 : 400,
                textAlign: el.align || 'left', fontFamily: FONT, lineHeight: 1.4,
              }}
            >
              {el.bullet ? (el.text || '').split('\n').map((t, k) => <div key={k}>• {t}</div>) : el.text}
            </div>
          )}
          {el.type === 'image' && el.src && (
            <img src={el.src} alt="" className="h-full w-full object-contain" />
          )}
          {el.type === 'shape' && (
            <div
              className="h-full w-full"
              style={{
                background: el.fill ? `#${el.fill}` : '#CCCCCC',
                borderRadius: el.shape === 'ellipse' ? '50%' : el.shape === 'triangle' ? '0' : 4,
                clipPath: el.shape === 'triangle' ? 'polygon(50% 0, 100% 100%, 0 100%)' : undefined,
              }}
            />
          )}
        </div>
      ))}
    </>
  )
}

/* ───────────────────────── 可编辑画布 ───────────────────────── */

interface EditableCanvasProps {
  slide: CwSlide
  theme: CwTheme
  onChange: (slide: CwSlide) => void
}

function EditableCanvas({ slide, theme, onChange }: EditableCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [selId, setSelId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [elements, setElements] = useState<CwElement[]>(slide.elements || [])
  const [title, setTitle] = useState(slide.title)
  const [layout, setLayout] = useState(slide.layout || 'title-body')
  const elementsRef = useRef(elements)
  const titleRef = useRef(title)
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null)

  useEffect(() => {
    setElements(slide.elements || [])
    setTitle(slide.title)
    setLayout(slide.layout || 'title-body')
    setSelId(null)
    setEditingId(null)
  }, [slide])

  useEffect(() => { elementsRef.current = elements }, [elements])
  useEffect(() => { titleRef.current = title }, [title])

  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(() => { setScale(el.clientWidth / CANVAS_W) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pct = (e: ReactPointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }
  }

  const onPointerDown = (e: ReactPointerEvent, el: CwElement, mode: 'move' | 'resize') => {
    e.stopPropagation()
    if (editingId === el.id) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = pct(e)
    drag.current = { id: el.id, mode, sx: p.x, sy: p.y, ox: el.x, oy: el.y, ow: el.w, oh: el.h }
    setSelId(el.id)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return
    const p = pct(e)
    const d = drag.current
    const dx = p.x - d.sx
    const dy = p.y - d.sy
    setElements((prev) => prev.map((el) => {
      if (el.id !== d.id) return el
      if (d.mode === 'move') {
        return { ...el, x: clamp(d.ox + dx, 0, 100 - el.w), y: clamp(d.oy + dy, 0, 100 - el.h) }
      }
      return { ...el, w: clamp(d.ow + dx, 4, 100 - el.x), h: clamp(d.oh + dy, 3, 100 - el.y) }
    }))
  }

  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    onChange({ ...slide, title: titleRef.current, elements: elementsRef.current })
  }

  const commitElements = (next: CwElement[]) => {
    elementsRef.current = next
    setElements(next)
    onChange({ ...slide, title: titleRef.current, elements: next })
  }

  const updateEl = (id: string, patch: Partial<CwElement>) =>
    commitElements(elementsRef.current.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const addEl = (type: CwElement['type']) => {
    const base: CwElement = {
      id: crypto.randomUUID(),
      type,
      x: 30, y: 30, w: 40, h: 20,
      rotation: 0,
    }
    if (type === 'text') Object.assign(base, { text: '双击编辑文本', fontSize: 18, color: '222222', bullet: false, align: 'left' })
    if (type === 'shape') Object.assign(base, { shape: 'rect', fill: '4C8BF5' })
    commitElements([...elementsRef.current, base])
    setSelId(base.id)
  }

  const addImage = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base: CwElement = { id: crypto.randomUUID(), type: 'image', x: 25, y: 25, w: 50, h: 35, src: reader.result as string, rotation: 0 }
      commitElements([...elementsRef.current, base])
      setSelId(base.id)
    }
    reader.readAsDataURL(file)
  }

  const deleteSel = () => {
    if (!selId) return
    commitElements(elementsRef.current.filter((e) => e.id !== selId))
    setSelId(null)
  }

  const reorder = (dir: 'up' | 'down') => {
    if (!selId) return
    const arr = [...elementsRef.current]
    const idx = arr.findIndex((e) => e.id === selId)
    if (idx < 0) return
    const j = dir === 'up' ? idx + 1 : idx - 1
    if (j < 0 || j >= arr.length) return
    ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
    commitElements(arr)
  }

  const applyLayout = (v: string) => {
    const bullets = extractBullets(elementsRef.current)
    const next = layoutElements({ title, bullets }, v)
    setLayout(v)
    onChange({ ...slide, title, elements: next, layout: v })
    setElements(next)
  }

  const sel = elements.find((e) => e.id === selId) || null

  return (
    <div className="select-none">
      {/* 顶部工具条 */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 ring-1 ring-slate-200">
        <button className="rounded px-2 py-1 text-xs font-medium bg-white ring-1 ring-slate-200 hover:bg-slate-100" onClick={() => addEl('text')}>+ 文本框</button>
        <label className="cursor-pointer rounded px-2 py-1 text-xs font-medium bg-white ring-1 ring-slate-200 hover:bg-slate-100">
          + 图片
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && addImage(e.target.files[0])} />
        </label>
        <button className="rounded px-2 py-1 text-xs font-medium bg-white ring-1 ring-slate-200 hover:bg-slate-100" onClick={() => addEl('shape')}>+ 形状</button>
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <button className="rounded px-2 py-1 text-xs bg-white ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-40" onClick={deleteSel} disabled={!sel}>删除</button>
        <button className="rounded px-2 py-1 text-xs bg-white ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-40" onClick={() => reorder('up')} disabled={!sel}>上移</button>
        <button className="rounded px-2 py-1 text-xs bg-white ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-40" onClick={() => reorder('down')} disabled={!sel}>下移</button>
        {sel?.type === 'text' && (
          <>
            <span className="mx-1 h-4 w-px bg-slate-200" />
            <button className={`rounded px-2 py-1 text-xs ${sel.bold ? 'bg-slate-800 text-white' : 'bg-white ring-1 ring-slate-200'}`} onClick={() => updateEl(sel.id, { bold: !sel.bold })}>B</button>
            <input type="color" value={`#${sel.color || '222222'}`} onChange={(e) => updateEl(sel.id, { color: e.target.value.replace('#', '') })} className="h-7 w-8 cursor-pointer rounded border-0" title="文字颜色" />
            <input type="number" value={sel.fontSize || 18} min={8} max={96} onChange={(e) => updateEl(sel.id, { fontSize: Number(e.target.value) })} className="w-14 rounded px-1 py-0.5 text-xs ring-1 ring-slate-200" title="字号" />
            <button className={`rounded px-2 py-1 text-xs ${sel.align === 'center' ? 'bg-slate-800 text-white' : 'bg-white ring-1 ring-slate-200'}`} onClick={() => updateEl(sel.id, { align: 'center' })}>居中</button>
            <button className={`rounded px-2 py-1 text-xs ${sel.bullet ? 'bg-slate-800 text-white' : 'bg-white ring-1 ring-slate-200'}`} onClick={() => updateEl(sel.id, { bullet: !sel.bullet })}>• 条目</button>
          </>
        )}
        {sel?.type === 'shape' && (
          <>
            <span className="mx-1 h-4 w-px bg-slate-200" />
            <select value={sel.shape || 'rect'} onChange={(e) => updateEl(sel.id, { shape: e.target.value as CwElement['shape'] })} className="rounded px-1 py-0.5 text-xs ring-1 ring-slate-200">
              <option value="rect">矩形</option>
              <option value="ellipse">椭圆</option>
              <option value="triangle">三角</option>
              <option value="line">线条</option>
            </select>
            <input type="color" value={`#${sel.fill || 'CCCCCC'}`} onChange={(e) => updateEl(sel.id, { fill: e.target.value.replace('#', '') })} className="h-7 w-8 cursor-pointer rounded border-0" title="填充" />
          </>
        )}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <select value={layout} onChange={(e) => applyLayout(e.target.value)} className="rounded px-1 py-0.5 text-xs ring-1 ring-slate-200" title="页面版式">
          <option value="title-body">标题+正文</option>
          <option value="title-only">仅标题</option>
          <option value="two-col">两栏</option>
          <option value="blank">空白</option>
        </select>
      </div>

      {/* 画布 */}
      <div className="relative w-full overflow-hidden rounded-lg bg-slate-200" style={{ aspectRatio: '16/9' }}>
        <div
          ref={canvasRef}
          className="absolute left-0 top-0 bg-white"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={(e) => { if (e.target === e.currentTarget) { setSelId(null); setEditingId(null) } }}
        >
          {/* 标题色带 */}
          <div className="absolute left-0 top-0 flex h-[15.3%] w-full items-center" style={{ background: theme.primary }}>
            {editingTitle ? (
              <span
                contentEditable
                suppressContentEditableWarning
                className="ml-[2%] w-[96%] text-2xl font-bold outline-none"
                style={{ color: theme.onPrimary }}
                onBlur={(e) => { setTitle(e.currentTarget.textContent || ''); setEditingTitle(false); onChange({ ...slide, title: e.currentTarget.textContent || '', elements: elementsRef.current }) }}
              >
                {title}
              </span>
            ) : (
              <span
                className="ml-[2%] w-[96%] cursor-text truncate text-2xl font-bold"
                style={{ color: theme.onPrimary }}
                onDoubleClick={() => setEditingTitle(true)}
                title="双击编辑标题"
              >
                {title}
              </span>
            )}
          </div>

          {/* 自由元素层 */}
          {elements.map((el) => {
            const isSel = el.id === selId
            return (
              <div
                key={el.id}
                className={`absolute ${editingId === el.id ? '' : 'cursor-move'} ${isSel ? 'ring-2 ring-blue-500' : ''}`}
                style={{
                  left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  zIndex: elements.indexOf(el),
                }}
                onPointerDown={(e) => onPointerDown(e, el, 'move')}
                onDoubleClick={(e) => { e.stopPropagation(); if (el.type === 'text') setEditingId(el.id) }}
                title={el.type === 'text' ? '双击编辑文字' : '拖拽移动'}
              >
                {el.type === 'text' && (
                  editingId === el.id ? (
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="h-full w-full whitespace-pre-wrap outline-none"
                      style={{ color: `#${el.color || '222222'}`, fontSize: el.fontSize || 18, fontWeight: el.bold ? 700 : 400, textAlign: el.align || 'left', fontFamily: FONT, lineHeight: 1.4 }}
                      onBlur={(e) => { updateEl(el.id, { text: e.currentTarget.innerText }); setEditingId(null) }}
                    >
                      {el.text}
                    </div>
                  ) : (
                    <div
                      className="h-full w-full whitespace-pre-wrap"
                      style={{ color: `#${el.color || '222222'}`, fontSize: el.fontSize || 18, fontWeight: el.bold ? 700 : 400, textAlign: el.align || 'left', fontFamily: FONT, lineHeight: 1.4 }}
                    >
                      {el.bullet ? (el.text || '').split('\n').map((t, k) => <div key={k}>• {t}</div>) : el.text}
                    </div>
                  )
                )}
                {el.type === 'image' && el.src && <img src={el.src} alt="" className="pointer-events-none h-full w-full object-contain" />}
                {el.type === 'shape' && (
                  <div
                    className="h-full w-full"
                    style={{
                      background: el.fill ? `#${el.fill}` : '#CCCCCC',
                      borderRadius: el.shape === 'ellipse' ? '50%' : el.shape === 'triangle' ? '0' : 4,
                      clipPath: el.shape === 'triangle' ? 'polygon(50% 0, 100% 100%, 0 100%)' : undefined,
                    }}
                  />
                )}
                {/* 缩放手柄 */}
                {isSel && editingId !== el.id && (
                  <div
                    className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm bg-blue-500 ring-2 ring-white"
                    onPointerDown={(e) => onPointerDown(e, el, 'resize')}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-1 text-center text-xs text-slate-400">双击标题/文本框编辑文字 · 拖拽移动 · 拖右下角缩放</p>
    </div>
  )
}
