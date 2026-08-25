import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Undo2, Redo2 } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { CwElement, CwSlide } from '../lib/exportPptx'
import { layoutElements, extractBullets } from '../lib/exportPptx'
import type { CwTheme } from '../lib/pptThemes'
import { DEFAULT_THEME } from '../lib/pptThemes'

const FONT = 'Microsoft YaHei'

/** 根据主题封面底色判断是否为暗色背景，用于编辑态自适应默认文字色（所见即所得） */
function themeIsDark(t: CwTheme): boolean {
  const h = (t.coverBg || t.primary || '').replace('#', '')
  if (h.length < 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b < 128
}

/** 将主题库存的 6 位 hex 转为合法 CSS 颜色（coverGradient 等完整字符串原样返回） */
function c(v?: string): string {
  if (!v) return '#000000'
  if (v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl') || v.includes('gradient')) return v
  if (/^[0-9A-Fa-f]{6}$/.test(v) || /^[0-9A-Fa-f]{3}$/.test(v)) return '#' + v
  return v
}

/**
 * 版式框架层（纯装饰，非交互）：按 slide.layout 绘制各版式的「容器造型」，
 * 垫在元素层之下，使「选模板→自动按语义分配版式」真正在画布上呈现布局差异，
 * 而不只是换色系。所有造型均绝对定位 + pointer-events-none，不干扰编辑。
 */
function SlideFrame({ theme, layout }: { theme: CwTheme; layout: string }) {
  const p = c(theme.primary)
  const f = c(theme.footer || theme.primary)
  const sub = c(theme.subtle)
  const band = (top: string, h: string) => (
    <div className="absolute left-0 w-full" style={{ top, height: h, background: p, opacity: 0.92 }} />
  )
  switch (layout) {
    case 'edu-cover':
      return (
        <div className="pointer-events-none absolute inset-0">
          {/* 底部信息条（年级/学科/教师三栏底纹） */}
          <div className="absolute bottom-[8%] left-[12%] flex w-[76%] items-center justify-between rounded-md px-5 py-3"
               style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(2px)' }}>
            <div className="text-center" style={{ color: c(theme.onPrimary), fontFamily: theme.font }}>
              <div className="text-[10px] opacity-70">年级</div>
              <div className="text-sm font-bold">—</div>
            </div>
            <div className="h-6 w-px" style={{ background: 'rgba(255,255,255,0.4)' }} />
            <div className="text-center" style={{ color: c(theme.onPrimary), fontFamily: theme.font }}>
              <div className="text-[10px] opacity-70">学科</div>
              <div className="text-sm font-bold">—</div>
            </div>
            <div className="h-6 w-px" style={{ background: 'rgba(255,255,255,0.4)' }} />
            <div className="text-center" style={{ color: c(theme.onPrimary), fontFamily: theme.font }}>
              <div className="text-[10px] opacity-70">教师</div>
              <div className="text-sm font-bold">—</div>
            </div>
          </div>
        </div>
      )
    case 'edu-goal':
      return (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[5.3%] top-[22%] flex w-[89.4%] gap-3" style={{ height: '64%' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 rounded-xl border" style={{ borderColor: `${p}55`, background: `${p}0D` }}>
                <div className="mx-auto mt-3 h-1.5 w-10 rounded-full" style={{ background: p }} />
              </div>
            ))}
          </div>
        </div>
      )
    case 'edu-explain':
      return (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[5.3%] top-[20%] w-[89.4%] rounded-lg border-2" style={{ height: '34%', borderColor: `${p}66`, background: `${p}0A` }} />
          <div className="absolute left-[5.3%] top-[58%] w-[89.4%] border-t-2" style={{ borderColor: `${sub}66` }} />
        </div>
      )
    case 'edu-example':
      return (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[5.3%] top-[20%] flex w-[89.4%] items-stretch rounded-md" style={{ height: '24%', borderLeft: `6px solid ${p}`, background: `${p}0F` }} />
          <div className="absolute left-[5.3%] top-[50%] grid w-[89.4%] grid-cols-3 gap-2" style={{ height: '34%' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-md border" style={{ borderColor: `${f}55`, background: 'rgba(255,255,255,0.6)' }} />
            ))}
          </div>
        </div>
      )
    case 'edu-summary':
      return (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-[7%] top-[26%] h-[52%] w-[30%] rounded-full border-2 border-dashed" style={{ borderColor: `${p}77` }} />
          <div className="absolute left-[5.3%] top-[22%] w-[52%] border-t-2" style={{ borderColor: `${sub}66` }} />
        </div>
      )
    case 'edu-homework':
      return (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[5.3%] top-[20%] w-[89.4%] space-y-2" style={{ height: '68%' }}>
            {[0.16, 0.5, 0.84].map((op, i) => (
              <div key={i} className="h-[28%] rounded-md border" style={{ borderColor: `${p}44`, background: `${p}${i === 0 ? '14' : i === 1 ? '0E' : '08'}` }} />
            ))}
          </div>
        </div>
      )
    default:
      return (
        <div className="pointer-events-none absolute inset-0">
          {band('0%', '15.3%')}
          <div className="absolute bottom-0 left-0 h-[2.5%] w-full" style={{ background: f }} />
        </div>
      )
  }
}

/**
 * 装饰层（中等丰富度，纯 SVG/CSS，无外部图依赖）：按 theme.decor 渲染风格化角标/版眉，
 * 使同一色系下不同 decor 也呈现不同版式气质。绝对定位 + pointer-events-none，不干扰编辑。
 */
function SlideDecor({ theme, layout }: { theme: CwTheme; layout: string }) {
  const decor = theme.decor || 'minimal'
  const p = c(theme.primary)
  const onP = c(theme.onPrimary)
  const sub = c(theme.subtle)
  const isCover = layout === 'edu-cover'

  if (decor === 'china') {
    return (
      <div className="pointer-events-none absolute inset-0">
        {isCover ? (
          <div className="absolute right-[7%] top-[9%] flex h-14 w-14 items-center justify-center rounded-md text-center text-[11px] font-bold leading-tight"
               style={{ background: p, color: onP, fontFamily: '"KaiTi","STKaiti",serif', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            知<br />微
          </div>
        ) : (
          <>
            <div className="absolute left-0 top-[15.3%] h-[84.7%] w-[3px]" style={{ background: p }} />
            <div className="absolute right-[5%] bottom-[6%] h-12 w-12 rounded-sm" style={{ background: p, opacity: 0.9 }} />
          </>
        )}
      </div>
    )
  }
  if (decor === 'tech') {
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `linear-gradient(${p} 1px, transparent 1px), linear-gradient(90deg, ${p} 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
        }} />
        <div className="absolute right-0 top-0 h-0 w-0" style={{ borderTop: `36px solid ${p}`, borderLeft: '36px solid transparent' }} />
      </div>
    )
  }
  if (decor === 'fresh' || decor === 'warm') {
    const accent = decor === 'warm' ? `${p}AA` : p
    return (
      <div className="pointer-events-none absolute inset-0">
        {isCover ? (
          <div className="absolute right-[8%] top-[10%] h-16 w-16 rounded-full" style={{ background: `${accent}22`, border: `2px solid ${accent}66` }} />
        ) : (
          <div className="absolute right-[4%] bottom-[5%] h-10 w-10 rounded-full" style={{ background: `${accent}1F`, border: `1.5px dashed ${accent}88` }} />
        )}
        <div className="absolute left-0 top-[15.3%] h-[2px] w-full" style={{ background: accent, opacity: decor === 'warm' ? 0.7 : 0.4 }} />
      </div>
    )
  }
  if (decor === 'academic') {
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-[15.3%] h-[2px] w-full" style={{ background: sub }} />
        <div className="absolute left-0 top-[15.3%] h-[5px] w-full" style={{ background: sub, opacity: 0.35 }} />
        <div className="absolute bottom-[3%] left-[3%] h-2 w-2" style={{ background: p }} />
      </div>
    )
  }
  if (decor === 'gradient') {
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-[15.3%] h-[84.7%] w-[14px]" style={{ background: `linear-gradient(${p}, transparent)`, opacity: 0.5 }} />
        <div className="absolute right-[3%] top-[6%] h-8 w-8 rounded-lg" style={{ background: p, opacity: 0.55 }} />
      </div>
    )
  }
  if (decor === 'special') {
    return (
      <div className="pointer-events-none absolute inset-0">
        <svg className="absolute bottom-0 left-0 w-full" height="22" viewBox="0 0 300 22" preserveAspectRatio="none">
          <path d="M0 14 Q 25 4 50 14 T 100 14 T 150 14 T 200 14 T 250 14 T 300 14" fill="none" stroke={p} strokeWidth="2" />
        </svg>
      </div>
    )
  }
  // minimal：极简右下小圆点
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute bottom-[4%] right-[3%] h-2.5 w-2.5 rounded-full" style={{ background: p, opacity: 0.6 }} />
    </div>
  )
}

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
  /** 只读态展示方式：scroll=竖向长列表（默认），single=单页+翻页（配合左侧缩略图导航） */
  viewMode?: 'scroll' | 'single'
  /** 版心比例：16/9（默认）或 4/3，影响画布基准尺寸与导出版面 */
  aspectRatio?: '16/9' | '4/3'
  /** 是否处于外层全屏嵌入态（此时隐藏 PptxPreview 自身的全屏按钮，避免重复） */
  embedFullscreen?: boolean
  /** 选中元素变化回调（向上冒泡，供外层自动唤起属性面板；null 表示点空白取消选择） */
  onSelect?: (id: string | null) => void
  /** single 模式下自动轮播播放 */
  autoPlay?: boolean
  /** 自动播放间隔（毫秒），默认 8000 */
  autoPlayInterval?: number
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** 按版心比例取画布基准尺寸（4:3 高度更高） */
const canvasSizeOf = (ar: '16/9' | '4/3') => ar === '4/3' ? { w: 960, h: 720 } : { w: 960, h: 540 }

export default function PptxPreview({
  slides,
  theme: themeProp,
  className,
  editable = false,
  index,
  onIndexChange,
  onSlideChange,
  showPager = true,
  aspectRatio = '16/9',
  viewMode = 'scroll',
  embedFullscreen = false,
  onSelect,
  autoPlay = false,
  autoPlayInterval = 8000,
}: PptxPreviewProps) {
  // 版心比例：受控 prop 优先，否则内部自管（工具条可切换）
  const [ar, setAr] = useState<'16/9' | '4/3'>(aspectRatio || '16/9')
  useEffect(() => { if (aspectRatio) setAr(aspectRatio) }, [aspectRatio])
  const { w: CW, h: CH } = canvasSizeOf(ar)
  const theme = useMemo(() => themeProp || DEFAULT_THEME, [themeProp])
  const [i, setI] = useState(0)
  useEffect(() => { if (typeof index === 'number') setI(clamp(index, 0, slides.length - 1)) }, [index, slides.length])
  const current = clamp(index ?? i, 0, slides.length - 1)
  const wheelLock = useRef(false)

  const setIndex = (n: number) => {
    const c = clamp(n, 0, slides.length - 1)
    setI(c)
    onIndexChange?.(c)
  }

  // single 模式自动轮播：仅在非编辑、多页、开启 autoPlay 时生效
  const [autoPlaying, setAutoPlaying] = useState(autoPlay)
  useEffect(() => { setAutoPlaying(autoPlay) }, [autoPlay])
  useEffect(() => {
    if (!autoPlaying || editable || viewMode !== 'single' || slides.length <= 1) return
    const t = setInterval(() => {
      setI((prev) => {
        const next = prev >= slides.length - 1 ? 0 : prev + 1
        onIndexChange?.(next)
        return next
      })
    }, autoPlayInterval)
    return () => clearInterval(t)
  }, [autoPlaying, editable, viewMode, slides.length, autoPlayInterval, onIndexChange])

  // 编辑态：当前页元素变更回写
  const handleSlideChange = (slide: CwSlide) => {
    onSlideChange?.(current, slide)
  }

  return (
    <div className={`flex flex-col ${className || ''}`}>
      <div className="mx-auto max-w-4xl" style={{ width: 'min(896px, 100%)' }}>
        {editable ? (
          <EditableCanvas key={current} slideKey={current} slide={slides[current]} theme={theme} onChange={handleSlideChange} cw={CW} ch={CH} ar={ar} onArChange={setAr} embedFullscreen={embedFullscreen} onSelect={onSelect} />
        ) : viewMode === 'single' ? (
          <div className="space-y-4">
            <div
              className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5"
              onWheel={e => {
                if (wheelLock.current || slides.length <= 1) return
                const dir = e.deltaY > 0 ? 1 : -1
                if ((dir === -1 && current === 0) || (dir === 1 && current === slides.length - 1)) return
                wheelLock.current = true
                setIndex(current + dir)
                window.setTimeout(() => { wheelLock.current = false }, 320)
              }}
            >
              {renderStaticSlide(slides[current], theme, current, ar)}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {slides.map((s, idx) => (
              <div key={idx} className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5">
                {renderStaticSlide(s, theme, idx, ar)}
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
          {viewMode === 'single' && (
            <button
              onClick={() => setAutoPlaying((p) => !p)}
              className="rounded px-3 py-1 text-sm bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-100"
            >
              {autoPlaying ? '⏸ 暂停' : '▶ 播放'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── 静态（放映/预览）渲染 ───────────────────────── */

function renderStaticSlide(s: CwSlide, theme: CwTheme, idx: number, aspectRatio: '16/9' | '4/3') {
  const lay = s.layout || (s.kind === 'cover' ? 'edu-cover' : 'title-body')
  if (s.kind === 'cover') {
    return (
      <div className="relative" style={{ aspectRatio: aspectRatio === '4/3' ? '4 / 3' : '16 / 9', background: c(theme.coverBg) }}>
        <SlideFrame theme={theme} layout={lay} />
        <SlideDecor theme={theme} layout={lay} />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8" style={{ fontFamily: theme.font }}>
          <h2 className="text-4xl font-bold" style={{ color: c(theme.onPrimary) }}>{s.title}</h2>
          {s.subtitle && <p className="mt-4 text-lg" style={{ color: c(theme.lightText) }}>{s.subtitle}</p>}
        </div>
        {s.footer && (
          <div className="absolute bottom-5 w-full text-center text-xs" style={{ color: c(theme.footer), fontFamily: theme.font }}>{s.footer}</div>
        )}
      </div>
    )
  }
  return (
    <div className="relative bg-white" style={{ aspectRatio: aspectRatio === '4/3' ? '4 / 3' : '16 / 9', fontFamily: theme.font }}>
      <SlideFrame theme={theme} layout={lay} />
      <SlideDecor theme={theme} layout={lay} />
      <div className="absolute left-[2%] top-0 flex h-[15.3%] items-center" style={{ width: '96%' }}>
        <span className="truncate text-2xl font-bold" style={{ color: c(theme.onPrimary) }}>{s.title}</span>
      </div>
      {s.elements && s.elements.length ? (
        renderElementsStatic(s.elements)
      ) : (
        <div className="absolute left-[5.3%] top-[20%]" style={{ width: '89.4%', height: '70%' }}>
          {(s.rich || []).map((line, k) => (
            <p key={k} className="mb-2" style={{ color: c(theme.body), fontSize: 16, fontFamily: FONT }}>
              {line.options.bullet ? '• ' : ''}{line.text}
            </p>
          ))}
        </div>
      )}
      {s.footer && (
        <div className="absolute bottom-[2%] right-[3%] text-[10px]" style={{ color: c(theme.footer), fontFamily: theme.font }}>{s.footer}</div>
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
                fontStyle: el.italic ? 'italic' : undefined,
                textDecoration: el.underline ? 'underline' : undefined,
                textAlign: el.align || 'left', fontFamily: el.fontFamily || FONT, lineHeight: el.lineHeight || 1.4,
              }}
            >
              {el.bullet ? (el.text || '').split('\n').map((t, k) => <div key={k}>• {t}</div>) : el.text}
            </div>
          )}
          {el.type === 'image' && el.src && (
            <img src={el.src} alt="" className="h-full w-full object-contain" />
          )}
          {el.type === 'shape' && (
            <ShapeRender shape={el.shape} fill={el.fill} />
          )}
        </div>
      ))}
    </>
  )
}

/** 形状渲染（编辑态/静态态共用）：矩形/椭圆/三角/线条/圆角矩形/箭头/星形/气泡 */
function ShapeRender({ shape, fill }: { shape?: CwElement['shape']; fill?: string }) {
  const bg = fill ? `#${fill}` : '#CCCCCC'
  if (shape === 'line') {
    return <div className="h-full w-full flex items-center"><div className="w-full" style={{ height: 3, background: bg }} /></div>
  }
  const style: React.CSSProperties = { background: bg }
  switch (shape) {
    case 'ellipse':
      style.borderRadius = '50%'
      break
    case 'triangle':
      style.clipPath = 'polygon(50% 0, 100% 100%, 0 100%)'
      break
    case 'roundRect':
      style.borderRadius = 16
      break
    case 'arrow':
      style.clipPath = 'polygon(0 30%, 62% 30%, 62% 0, 100% 50%, 62% 100%, 62% 70%, 0 70%)'
      break
    case 'star':
      style.clipPath = 'polygon(50% 0, 63% 36%, 100% 38%, 71% 61%, 81% 100%, 50% 76%, 19% 100%, 29% 61%, 0 38%, 37% 36%)'
      break
    case 'bubble':
      style.borderRadius = 18
      style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 78%, 34% 78%, 18% 100%, 22% 78%, 0% 78%)'
      break
    default:
      style.borderRadius = 4
  }
  return <div className="h-full w-full" style={style} />
}

/* ───────────────────────── 可编辑画布 ───────────────────────── */

interface EditableCanvasProps {
  slide: CwSlide
  /** 页标识：仅切页时变化 → 触发重置；同页编辑（slide 引用变化）不重置，避免覆盖画布内编辑态 */
  slideKey?: number
  theme: CwTheme
  onChange: (slide: CwSlide) => void
  /** 画布基准宽高（随版心比例变化） */
  cw: number
  ch: number
  /** 当前版心比例 */
  ar: '16/9' | '4/3'
  /** 切换版心比例 */
  onArChange: (v: '16/9' | '4/3') => void
  /** 是否处于外层全屏嵌入态（隐藏画布自身的全屏按钮，避免重复） */
  embedFullscreen?: boolean
  /** 选中元素变化回调（向上冒泡，供外层自动唤起属性面板） */
  onSelect?: (id: string | null) => void
}

/** 画布快照（撤销/重做用） */
interface Snap { elements: CwElement[]; title: string; layout: string }

const SNAP = 1.5 // 吸附阈值（%）
const FONT_OPTS = ['Microsoft YaHei', 'SimSun', 'SimHei', 'KaiTi', 'FangSong', 'Arial', 'Times New Roman']

function EditableCanvas({ slide, slideKey, theme, onChange, cw, ch, ar, onArChange, embedFullscreen, onSelect }: EditableCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [selIds, setSelIds] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [elements, setElements] = useState<CwElement[]>(slide.elements || [])
  const [title, setTitle] = useState(slide.title)
  const [layout, setLayout] = useState<string>(slide.layout || 'title-body')
  // 所见即所得：编辑画布随模板主题视觉变化
  const isCover = layout === 'edu-cover'
  const darkTheme = themeIsDark(theme)
  const defaultTextColor = darkTheme ? 'FFFFFF' : '222222'
  // 历史栈（撤销/重做）
  const [history, setHistory] = useState<Snap[]>([{ elements: slide.elements || [], title: slide.title, layout: slide.layout || 'title-body' }])
  const [hIndex, setHIndex] = useState(0)
  // 对齐参考线
  const [guide, setGuide] = useState<{ v?: number; h?: number }>({})
  const elementsRef = useRef(elements)
  const titleRef = useRef(title)
  const layoutRef = useRef(layout)
  const selIdsRef = useRef(selIds)
  const hIndexRef = useRef(hIndex)
  const historyRef = useRef(history)
  const drag = useRef<{ mode: 'move' | 'resize' | 'marquee'; sx: number; sy: number; base: CwElement[]; mx: number; my: number } | null>(null)
  const clipboardRef = useRef<CwElement[]>([])

  // 仅切页（slideKey 变化）时重置画布；同页编辑 slide 引用变化不重置（避免覆盖画布内编辑态）
  useEffect(() => {
    const els = slide.elements || []
    const lay = slide.layout || 'title-body'
    setElements(els)
    setTitle(slide.title)
    setLayout(lay)
    setSelIds([])
    setEditingId(null)
    setGuide({})
    setHistory([{ elements: els, title: slide.title, layout: lay }])
    setHIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideKey])

  useEffect(() => { elementsRef.current = elements }, [elements])
  useEffect(() => { titleRef.current = title }, [title])
  useEffect(() => { layoutRef.current = layout }, [layout])
  useEffect(() => { selIdsRef.current = selIds }, [selIds])
  useEffect(() => { hIndexRef.current = hIndex }, [hIndex])
  useEffect(() => { historyRef.current = history }, [history])

  // 自适应缩放：用 canvasRef 父级的父级（flex-1 容器）的 clientWidth 作为可用宽度基准
  useLayoutEffect(() => {
    const wrap = canvasRef.current?.parentElement?.parentElement
    if (!wrap) return
    const update = () => setScale(Math.min(1, wrap.clientWidth / cw))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  const emit = (els: CwElement[], t: string, lay: string) => {
    onChange({ ...slide, title: t, layout: lay as CwSlide['layout'], elements: els })
  }
  /** 应用变更（不入历史栈，拖动过程中的实时预览用） */
  const apply = (els: CwElement[], t = titleRef.current, lay = layoutRef.current) => {
    setElements(els); setTitle(t); setLayout(lay)
    emit(els, t, lay)
  }
  /** 提交变更（入历史栈，截断 redo 分支） */
  const commit = (els: CwElement[], t = titleRef.current, lay = layoutRef.current) => {
    setElements(els); setTitle(t); setLayout(lay)
    emit(els, t, lay)
    const snap: Snap = { elements: els, title: t, layout: lay }
    setHistory(prev => [...prev.slice(0, hIndexRef.current + 1), snap].slice(-50))
    setHIndex(prev => Math.min(prev + 1, 49))
  }

  const undo = () => {
    const idx = hIndexRef.current
    if (idx <= 0) return
    const s = historyRef.current[idx - 1]
    setHIndex(idx - 1)
    apply(s.elements, s.title, s.layout)
    setSelIds([])
  }
  const redo = () => {
    const idx = hIndexRef.current
    if (idx >= historyRef.current.length - 1) return
    const s = historyRef.current[idx + 1]
    setHIndex(idx + 1)
    apply(s.elements, s.title, s.layout)
    setSelIds([])
  }

  const selId = selIds.length === 1 ? selIds[0] : null
  const sel = elements.find(e => e.id === selId)

  // 选中变化：冒泡通知外层 + 自动展开/收起属性面板 + 计算面板屏幕跟随定位
  useEffect(() => {
    onSelect?.(selId)
    setPanelCollapsed(!selId)
    // 用户拖动过面板 → 保留用户拖到的位置，不再自动跟随
    if (dragPos) return
    if (!selId || !canvasRef.current) { setPopupPos(null); return }
    // 计算选中元件在画布中的屏幕坐标，面板浮在元件上方/侧方避免遮挡
    const rect = canvasRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) { setPopupPos(null); return }
    const elemX = rect.left + (sel!.x / 100) * rect.width
    const elemY = rect.top + (sel!.y / 100) * rect.height
    const elemW = (sel!.w / 100) * rect.width
    const elemH = (sel!.h / 100) * rect.height
    const PANEL_W = 240
    const PANEL_H_EST = 380 // 预估值（含文本框所有控件；形状面板更短）
    const GAP = 8
    // 首选：元件上方居中；上方空间不足时改为元件下方
    let top = elemY - PANEL_H_EST - GAP
    if (top < 8) top = elemY + elemH + GAP
    // 左右居中于元件，但不超出视口
    const left = Math.max(GAP, Math.min(window.innerWidth - PANEL_W - GAP, elemX + elemW / 2 - PANEL_W / 2))
    setPopupPos({ top, left })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId])
  const patchSel = (p: Partial<CwElement>) => {
    if (!selId) return
    commit(elements.map(e => (e.id === selId ? { ...e, ...p } : e)))
  }

  const addElement = (type: 'text' | 'image' | 'shape', extra?: Partial<CwElement>) => {
    const el: CwElement = {
      id: `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      x: 30, y: 35, w: 40, h: type === 'text' ? 12 : 25,
      ...(type === 'text' ? { text: '双击编辑文本', fontSize: 18, color: defaultTextColor } : {}),
      ...(type === 'shape' ? { shape: 'rect', fill: '4472C4' } : {}),
      ...extra,
    }
    commit([...elements, el])
    setSelIds([el.id])
  }

  const removeSelected = () => {
    if (!selIdsRef.current.length) return
    commit(elementsRef.current.filter(e => !selIdsRef.current.includes(e.id)))
    setSelIds([])
  }

  const duplicateSelected = () => {
    if (!selIdsRef.current.length) return
    const copies = elementsRef.current
      .filter(e => selIdsRef.current.includes(e.id))
      .map(e => ({ ...e, id: `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, x: Math.min(95, e.x + 2), y: Math.min(95, e.y + 2) }))
    commit([...elementsRef.current, ...copies])
    setSelIds(copies.map(c => c.id))
  }

  const copySelected = () => {
    clipboardRef.current = elementsRef.current.filter(e => selIdsRef.current.includes(e.id)).map(e => ({ ...e }))
  }
  const pasteClipboard = () => {
    if (!clipboardRef.current.length) return
    const copies = clipboardRef.current.map(e => ({ ...e, id: `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, x: Math.min(95, e.x + 2), y: Math.min(95, e.y + 2) }))
    commit([...elementsRef.current, ...copies])
    setSelIds(copies.map(c => c.id))
  }

  const moveLayer = (dir: 1 | -1) => {
    if (!selId) return
    const idx = elements.findIndex(e => e.id === selId)
    const to = idx + dir
    if (idx < 0 || to < 0 || to >= elements.length) return
    const next = [...elements]
    const [moved] = next.splice(idx, 1)
    next.splice(to, 0, moved)
    commit(next)
  }

  // ── 对齐分布（多选） ──
  const alignSelected = (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom' | 'hdistribute' | 'vdistribute') => {
    const selEls = elementsRef.current.filter(e => selIdsRef.current.includes(e.id))
    if (selEls.length < 2) return
    const px = (v: number) => v
    if (mode === 'hdistribute' || mode === 'vdistribute') {
      if (selEls.length < 3) return
      const horiz = mode === 'hdistribute'
      const sorted = [...selEls].sort((a, b) => (horiz ? a.x - b.x : a.y - b.y))
      const first = sorted[0], last = sorted[sorted.length - 1]
      const span = horiz ? (last.x - first.x) : (last.y - first.y)
      const step = span / (sorted.length - 1)
      const posMap = new Map(sorted.map((e, i) => [e.id, first[horiz ? 'x' : 'y'] + step * i]))
      commit(elementsRef.current.map(e => posMap.has(e.id) ? { ...e, [horiz ? 'x' : 'y']: px(posMap.get(e.id)!) } : e))
      return
    }
    const edges = selEls.map(e => ({ l: e.x, r: e.x + e.w, t: e.y, b: e.y + e.h, cx: e.x + e.w / 2, cy: e.y + e.h / 2 }))
    let target = 0
    if (mode === 'left') target = Math.min(...edges.map(e => e.l))
    if (mode === 'right') target = Math.max(...edges.map(e => e.r))
    if (mode === 'hcenter') target = edges.reduce((s, e) => s + e.cx, 0) / edges.length
    if (mode === 'top') target = Math.min(...edges.map(e => e.t))
    if (mode === 'bottom') target = Math.max(...edges.map(e => e.b))
    if (mode === 'vcenter') target = edges.reduce((s, e) => s + e.cy, 0) / edges.length
    commit(elementsRef.current.map(e => {
      if (!selIdsRef.current.includes(e.id)) return e
      if (mode === 'left') return { ...e, x: target }
      if (mode === 'right') return { ...e, x: target - e.w }
      if (mode === 'hcenter') return { ...e, x: target - e.w / 2 }
      if (mode === 'top') return { ...e, y: target }
      if (mode === 'bottom') return { ...e, y: target - e.h }
      return { ...e, y: target - e.h / 2 }
    }))
  }

  const onUpload = (f: File) => {
    const reader = new FileReader()
    reader.onload = () => addElement('image', { src: String(reader.result), w: 30, h: 30 })
    reader.readAsDataURL(f)
  }

  // 坐标换算：client → 画布 %
  const toPct = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: ((clientX - rect.left) / rect.width) * 100, y: ((clientY - rect.height) / rect.height) * 100 }
  }

  // ── 吸附计算：返回修正后的 dx/dy 与参考线 ──
  const snapDrag = (moving: CwElement[], dx: number, dy: number) => {
    const lead = moving[0]
    const nx = lead.x + dx, ny = lead.y + dy
    const edges = { l: nx, cx: nx + lead.w / 2, r: nx + lead.w, t: ny, cy: ny + lead.h / 2, b: ny + lead.h }
    let bestV: { d: number; line: number; corr: number } | null = null
    let bestH: { d: number; line: number; corr: number } | null = null
    const considerV = (line: number, corr: number) => { const d = Math.abs(corr); if (d < SNAP && (!bestV || d < bestV.d)) bestV = { d, line, corr } }
    const considerH = (line: number, corr: number) => { const d = Math.abs(corr); if (d < SNAP && (!bestH || d < bestH.d)) bestH = { d, line, corr } }
    // 画布中线
    considerV(50, 50 - edges.cx)
    considerH(50, 50 - edges.cy)
    // 其他元素边缘
    const movingIds = new Set(moving.map(m => m.id))
    for (const e of elementsRef.current) {
      if (movingIds.has(e.id)) continue
      const l = e.x, r = e.x + e.w, t = e.y, b = e.y + e.h, cx = e.x + e.w / 2, cy = e.y + e.h / 2
      considerV(l, l - edges.l); considerV(l, l - edges.cx); considerV(l, l - edges.r)
      considerV(r, r - edges.l); considerV(r, r - edges.cx); considerV(r, r - edges.r)
      considerV(cx, cx - edges.l); considerV(cx, cx - edges.cx); considerV(cx, cx - edges.r)
      considerH(t, t - edges.t); considerH(t, t - edges.cy); considerH(t, t - edges.b)
      considerH(b, b - edges.t); considerH(b, b - edges.cy); considerH(b, b - edges.b)
      considerH(cy, cy - edges.t); considerH(cy, cy - edges.cy); considerH(cy, cy - edges.b)
    }
    const vSnap = bestV as { d: number; line: number; corr: number } | null
    const hSnap = bestH as { d: number; line: number; corr: number } | null
    return {
      dx: dx + (vSnap ? vSnap.corr : 0),
      dy: dy + (hSnap ? hSnap.corr : 0),
      v: vSnap ? vSnap.line : undefined,
      h: hSnap ? hSnap.line : undefined,
    }
  }

  const onPointerDown = (e: ReactPointerEvent, el: CwElement, mode: 'move' | 'resize') => {
    e.stopPropagation()
    if (editingId === el.id) return
    // 多选：Shift 增减；否则若点中已选集合则整组拖动，否则单选
    let nextSel: string[]
    if (e.shiftKey) {
      nextSel = selIdsRef.current.includes(el.id) ? selIdsRef.current.filter(s => s !== el.id) : [...selIdsRef.current, el.id]
      setSelIds(nextSel)
      if (mode === 'resize') nextSel = [el.id]
    } else {
      nextSel = selIdsRef.current.includes(el.id) ? selIdsRef.current : [el.id]
      setSelIds(nextSel)
    }
    const base = elementsRef.current.map(x => ({ ...x }))
    drag.current = { mode, sx: e.clientX, sy: e.clientY, base, mx: 0, my: 0 }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const dxPct = ((e.clientX - d.sx) / rect.width) * 100
    const dyPct = ((e.clientY - d.sy) / rect.height) * 100
    if (d.mode === 'marquee') {
      d.mx = dxPct; d.my = dyPct
      setGuide({})
      // 框选：以起点为基准算画布 % 矩形
      const start = toPct(d.sx, d.sy)
      const cur = toPct(e.clientX, e.clientY)
      const x1 = Math.min(start.x, cur.x), x2 = Math.max(start.x, cur.x)
      const y1 = Math.min(start.y, cur.y), y2 = Math.max(start.y, cur.y)
      const hit = d.base.filter(el => el.x < x2 && el.x + el.w > x1 && el.y < y2 && el.y + el.h > y1).map(el => el.id)
      setSelIds(hit)
      setMarquee({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 })
      return
    }
    const moving = d.base.filter(el => selIdsRef.current.includes(el.id))
    if (d.mode === 'move') {
      const snapped = snapDrag(moving, dxPct, dyPct)
      setGuide({ v: snapped.v, h: snapped.h })
      apply(d.base.map(el => selIdsRef.current.includes(el.id)
        ? { ...el, x: clamp(el.x + snapped.dx, 0, 100 - el.w), y: clamp(el.y + snapped.dy, 0, 100 - el.h) }
        : el))
    } else {
      // 缩放仅作用于单选元素
      apply(d.base.map(el => el.id === selId
        ? { ...el, w: clamp(el.w + dxPct, 4, 100 - el.x), h: clamp(el.h + dyPct, 3, 100 - el.y) }
        : el))
    }
  }

  const onPointerUp = () => {
    if (drag.current) {
      const d = drag.current
      drag.current = null
      setGuide({})
      setMarquee(null)
      // 拖动结束入历史栈（当前 elements 已是最终态）
      commit(elementsRef.current)
    }
  }

  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  // 右侧属性面板收起（默认收起，点中画布元件时自动弹出，点空白自动收起，更聚焦画布）
  const [panelCollapsed, setPanelCollapsed] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  // 属性面板屏幕跟随定位：选中元件后计算其屏幕坐标，面板浮在元件上方以避免遮挡
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null)
  // 用户拖动后的位置（null 表示跟随选中元件自动定位；非 null 表示用户拖到了固定位置）
  const [dragPos, setDragPos] = useState<{ top: number; left: number } | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; top: number; left: number } | null>(null)

  const onCanvasPointerDown = (e: ReactPointerEvent) => {
    if (e.target !== canvasRef.current) return
    setEditingId(null); setEditingTitle(false)
    // 空白框选
    drag.current = { mode: 'marquee', sx: e.clientX, sy: e.clientY, base: elementsRef.current.map(x => ({ ...x })), mx: 0, my: 0 }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  // ── 键盘操作 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      const isTyping = tag === 'textarea' || tag === 'input' || (document.activeElement as HTMLElement)?.isContentEditable
      if (isTyping) return
      const meta = e.ctrlKey || e.metaKey
      if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return }
      if (meta && e.key.toLowerCase() === 'c') { copySelected(); return }
      if (meta && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteClipboard(); return }
      if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selIdsRef.current.length) { e.preventDefault(); removeSelected() } return }
      // 方向键微调
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      if (arrows[e.key] && selIdsRef.current.length) {
        e.preventDefault()
        const [ax, ay] = arrows[e.key]
        const step = e.shiftKey ? 5 : 0.5
        commit(elementsRef.current.map(el => selIdsRef.current.includes(el.id)
          ? { ...el, x: clamp(el.x + ax * step, 0, 100 - el.w), y: clamp(el.y + ay * step, 0, 100 - el.h) }
          : el))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [slide])

  const applyLayout = (lay: string) => {
    const next = layoutElements({ title: titleRef.current, bullets: extractBullets(elementsRef.current) }, lay)
    commit(next, titleRef.current, lay)
  }

  // ── 设计系统配色（对齐知微，替代散乱 slate/#4472C4） ──
  const B = 'border border-[#E7E7EB] hover:bg-[#F6F7F8] text-[#353535]'
  const BActive = 'border border-[#02A7F0] bg-[#02A7F0] text-white'
  const SEL = '#02A7F0' // 选中高亮（替代 #4472C4）

  // ── 属性面板（Portal 到 body，fixed 定位跟随选中元件，避免遮挡画布内容与批注栏） ──
  const propPanelContent = !panelCollapsed && selId && sel && (dragPos || popupPos) && (
    <div
      style={{ position: 'fixed', top: (dragPos || popupPos)!.top, left: (dragPos || popupPos)!.left, zIndex: 50 }}
      className="w-[240px] flex flex-col border border-[#E7E7EB] bg-white overflow-y-auto shadow-2xl rounded-lg"
      onMouseDown={e => e.stopPropagation()}>
      <div
        className="flex items-center justify-between px-2.5 py-2 border-b border-[#F0F0F0] shrink-0 bg-[#FAFBFC] cursor-move select-none"
        onMouseDown={e => {
          // 仅左键拖动；点收起按钮不触发拖动
          if (e.button !== 0) return
          e.preventDefault()
          const cur = dragPos || popupPos!
          dragStartRef.current = { x: e.clientX, y: e.clientY, top: cur.top, left: cur.left }
          const onMove = (ev: MouseEvent) => {
            if (!dragStartRef.current) return
            const dx = ev.clientX - dragStartRef.current.x
            const dy = ev.clientY - dragStartRef.current.y
            const newTop = dragStartRef.current.top + dy
            const newLeft = dragStartRef.current.left + dx
            setDragPos({ top: newTop, left: newLeft })
          }
          const onUp = () => {
            dragStartRef.current = null
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
          }
          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
        }}
      >
        <span className="text-[11px] font-medium text-[#353535] flex items-center gap-1">
          <span className="text-[#C0C0C0]">⋮⋮</span>
          {sel.type === 'text' ? '文本框' : sel.type === 'shape' ? '形状' : '图片'}
        </span>
        <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setPanelCollapsed(true); setDragPos(null) }} title="收起面板" className="text-[#9A9A9A] hover:text-[#353535] text-[12px]">›</button>
      </div>
      <div className="p-2.5 space-y-3 text-[11px]">
        {/* 位置尺寸 */}
        <div>
          <p className="text-[#9A9A9A] mb-1.5">位置 · 尺寸 (%)</p>
          <div className="grid grid-cols-4 gap-1">
            {(['x', 'y', 'w', 'h'] as const).map(k => (
              <label key={k} className="flex flex-col">
                <span className="text-[#C0C0C0] text-[9px] uppercase">{k}</span>
                <input type="number" value={Math.round(sel[k])} onChange={e => patchSel({ [k]: clamp(Number(e.target.value) || 0, 0, 100) })}
                  className="w-full border border-[#E7E7EB] rounded px-1 py-0.5 focus:border-[#02A7F0] outline-none" />
              </label>
            ))}
          </div>
        </div>

        {/* 文本样式 */}
        {sel.type === 'text' && (
          <>
            <div>
              <p className="text-[#9A9A9A] mb-1.5">字体 · 字号 · 行距</p>
              <select value={sel.fontFamily || FONT} onChange={e => patchSel({ fontFamily: e.target.value })}
                className="w-full border border-[#E7E7EB] rounded px-1.5 py-1 bg-white focus:border-[#02A7F0] outline-none mb-1.5">
                {FONT_OPTS.map(f => <option key={f} value={f}>{f === FONT ? '默认(雅黑)' : f}</option>)}
              </select>
              <div className="flex gap-1">
                <input type="number" min={10} max={72} value={sel.fontSize || 18} onChange={e => patchSel({ fontSize: Number(e.target.value) || 18 })}
                  className="w-1/2 border border-[#E7E7EB] rounded px-1.5 py-1 focus:border-[#02A7F0] outline-none" title="字号" />
                <select value={sel.lineHeight || 1.4} onChange={e => patchSel({ lineHeight: Number(e.target.value) })}
                  className="w-1/2 border border-[#E7E7EB] rounded px-1 py-1 bg-white focus:border-[#02A7F0] outline-none" title="行距">
                  {[1, 1.15, 1.4, 1.6, 2].map(l => <option key={l} value={l}>{l}x</option>)}
                </select>
              </div>
            </div>
            <div>
              <p className="text-[#9A9A9A] mb-1.5">样式</p>
              <div className="flex gap-1">
                <button onClick={() => patchSel({ bold: !sel.bold })} className={`flex-1 py-1 rounded ${sel.bold ? BActive : B}`} title="加粗"><b>B</b></button>
                <button onClick={() => patchSel({ italic: !sel.italic })} className={`flex-1 py-1 rounded italic ${sel.italic ? BActive : B}`} title="斜体">I</button>
                <button onClick={() => patchSel({ underline: !sel.underline })} className={`flex-1 py-1 rounded underline ${sel.underline ? BActive : B}`} title="下划线">U</button>
                <button onClick={() => patchSel({ bullet: !sel.bullet })} className={`flex-1 py-1 rounded ${sel.bullet ? BActive : B}`} title="条目符号">•</button>
              </div>
            </div>
            <div>
              <p className="text-[#9A9A9A] mb-1.5">对齐</p>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map(a => (
                  <button key={a} onClick={() => patchSel({ align: a })} className={`flex-1 py-1 rounded ${sel.align === a || (a === 'left' && !sel.align) ? BActive : B}`}>
                    {a === 'left' ? '左' : a === 'center' ? '中' : '右'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[#9A9A9A] mb-1.5">文字颜色</p>
              <input type="color" value={`#${sel.color || '222222'}`} onChange={e => patchSel({ color: e.target.value.replace('#', '') })}
                className="w-full h-7 border border-[#E7E7EB] rounded cursor-pointer" />
            </div>
          </>
        )}

        {/* 形状样式 */}
        {sel.type === 'shape' && (
          <>
            <div>
              <p className="text-[#9A9A9A] mb-1.5">形状</p>
              <select value={sel.shape || 'rect'} onChange={e => patchSel({ shape: e.target.value as CwElement['shape'] })}
                className="w-full border border-[#E7E7EB] rounded px-1.5 py-1 bg-white focus:border-[#02A7F0] outline-none">
                <option value="rect">矩形</option>
                <option value="roundRect">圆角矩形</option>
                <option value="ellipse">椭圆</option>
                <option value="triangle">三角形</option>
                <option value="line">线条</option>
                <option value="arrow">箭头</option>
                <option value="star">星形</option>
                <option value="bubble">气泡</option>
              </select>
            </div>
            <div>
              <p className="text-[#9A9A9A] mb-1.5">填充色</p>
              <input type="color" value={`#${sel.fill || '4472C4'}`} onChange={e => patchSel({ fill: e.target.value.replace('#', '') })}
                className="w-full h-7 border border-[#E7E7EB] rounded cursor-pointer" />
            </div>
          </>
        )}
      </div>
    </div>
  )

  // 属性面板无独立唤醒按钮——只在画布命中元件时由 useEffect 自动展开，关闭靠点空白或面板 › 收起

  // ── 画布主体（工具条 + 画布 + 右侧属性面板） ──
  const body = (
    <div className="flex flex-1 overflow-hidden relative">
      {/* 中央：工具条 + 画布 */}
      <div className="flex-1 flex flex-col overflow-hidden px-4 py-3">
        {/* 工具条（与画布同宽居中） */}
        <div className="mb-1.5 flex flex-wrap items-center gap-1 text-[11px] shrink-0 mx-auto" style={{ maxWidth: 'min(896px, 100%)' }}>
          <button title="撤销 (Ctrl+Z)" disabled={hIndex <= 0} onClick={undo} className={`px-1.5 py-0.5 rounded ${B} disabled:opacity-40 flex items-center gap-1`}><Undo2 size={13} /> 撤销</button>
          <button title="重做 (Ctrl+Y)" disabled={hIndex >= history.length - 1} onClick={redo} className={`px-1.5 py-0.5 rounded ${B} disabled:opacity-40 flex items-center gap-1`}><Redo2 size={13} /> 重做</button>
          <span className="mx-0.5 text-[#E7E7EB]">|</span>
          <button onClick={() => addElement('text')} className={`px-1.5 py-0.5 rounded ${B}`}>+ 文本框</button>
          <label className={`px-1.5 py-0.5 rounded ${B} cursor-pointer`}>
            + 图片
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
          <button onClick={() => addElement('shape')} className={`px-1.5 py-0.5 rounded ${B}`}>+ 形状</button>
          {selIds.length > 0 && (
            <>
              <span className="mx-0.5 text-[#E7E7EB]">|</span>
              <button title="复制 (Ctrl+C)" onClick={copySelected} className={`px-1.5 py-0.5 rounded ${B}`}>复制</button>
              <button title="粘贴 (Ctrl+V)" onClick={pasteClipboard} className={`px-1.5 py-0.5 rounded ${B}`}>粘贴</button>
              <button title="创建副本 (Ctrl+D)" onClick={duplicateSelected} className={`px-1.5 py-0.5 rounded ${B}`}>副本</button>
              <button onClick={removeSelected} className="px-1.5 py-0.5 rounded border border-[#F5222D] text-[#F5222D] hover:bg-[#FFF1F0]">删除</button>
              {selId && (
                <>
                  <button title="上移一层" onClick={() => moveLayer(1)} className={`px-1.5 py-0.5 rounded ${B}`}>上移</button>
                  <button title="下移一层" onClick={() => moveLayer(-1)} className={`px-1.5 py-0.5 rounded ${B}`}>下移</button>
                </>
              )}
            </>
          )}
          {selIds.length >= 2 && (
            <>
              <span className="mx-0.5 text-[#E7E7EB]">|</span>
              <span className="text-[#9A9A9A]">对齐</span>
              <button title="左对齐" onClick={() => alignSelected('left')} className={`px-1.5 py-0.5 rounded ${B}`}>左</button>
              <button title="水平居中" onClick={() => alignSelected('hcenter')} className={`px-1.5 py-0.5 rounded ${B}`}>水平中</button>
              <button title="右对齐" onClick={() => alignSelected('right')} className={`px-1.5 py-0.5 rounded ${B}`}>右</button>
              <button title="顶对齐" onClick={() => alignSelected('top')} className={`px-1.5 py-0.5 rounded ${B}`}>顶</button>
              <button title="垂直居中" onClick={() => alignSelected('vcenter')} className={`px-1.5 py-0.5 rounded ${B}`}>垂直中</button>
              <button title="底对齐" onClick={() => alignSelected('bottom')} className={`px-1.5 py-0.5 rounded ${B}`}>底</button>
              {selIds.length >= 3 && (
                <>
                  <button title="水平等间距" onClick={() => alignSelected('hdistribute')} className={`px-1.5 py-0.5 rounded ${B}`}>水平匀</button>
                  <button title="垂直等间距" onClick={() => alignSelected('vdistribute')} className={`px-1.5 py-0.5 rounded ${B}`}>垂直匀</button>
                </>
              )}
            </>
          )}
          <span className="mx-0.5 text-[#E7E7EB]">|</span>
          <select value={layout} onChange={(e) => applyLayout(e.target.value)} className={`rounded px-1 py-0.5 bg-white ${B}`} title="页面版式">
            <option value="title-body">标题+正文</option>
            <option value="title-only">仅标题</option>
            <option value="two-col">两栏</option>
            <option value="blank">空白</option>
            <optgroup label="教学版式">
              <option value="edu-cover">封面</option>
              <option value="edu-goal">教学目标</option>
              <option value="edu-explain">知识讲解</option>
              <option value="edu-example">例题演练</option>
              <option value="edu-summary">课堂小结</option>
              <option value="edu-homework">作业布置</option>
            </optgroup>
          </select>
          {/* 版心比例由父级顶栏控制（避免重复），此处不重复 */}
          <span className={`rounded px-1.5 py-0.5 ${B} text-[#9A9A9A]`} title="版心比例">版心 {ar}</span>
          <span className="flex-1" />
          {!fullscreen && !embedFullscreen && (
            <button onClick={() => setFullscreen(true)} title="全屏编辑" className={`px-2 py-0.5 rounded ${B}`}>⛶ 全屏</button>
          )}
        </div>

        {/* 画布（按版心比例基准，按容器缩放） */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto flex items-start justify-center py-2">
          <div style={{ width: cw * scale, height: ch * scale }}>
            <div
              ref={canvasRef}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="relative overflow-hidden rounded-md ring-1 ring-[#E7E7EB] shadow"
              style={{ width: cw, height: ch, transform: `scale(${scale})`, transformOrigin: 'top left', background: isCover ? (theme.coverGradient || c(theme.coverBg)) : '#FFFFFF', fontFamily: theme.font }}
            >
              {/* 版式框架层（按 layout 绘制容器造型，垫在元素层下） */}
              <SlideFrame theme={theme} layout={layout} />
              {editingTitle ? (
                <input
                  autoFocus value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => { setEditingTitle(false); commit(elementsRef.current, titleRef.current) }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="absolute left-[2%] top-[3%] z-20 text-2xl font-bold rounded px-1 outline-none"
                  style={{ width: '90%', color: isCover ? c(theme.onPrimary) : '#222', background: isCover ? 'transparent' : 'rgba(255,255,255,0.9)' }}
                />
              ) : (
                <div
                  className="absolute left-[2%] top-0 flex h-[15.3%] items-center"
                  style={{ width: '96%' }}
                  onDoubleClick={() => setEditingTitle(true)}
                  title="双击编辑标题"
                >
                  <span className="truncate text-2xl font-bold" style={{ color: c(theme.onPrimary) }}>{title}</span>
                </div>
              )}

              {/* 元素层 */}
              {elements.map((el) => {
                const selected = selIds.includes(el.id)
                const editing = editingId === el.id
                return (
                  <div
                    key={el.id}
                    className="absolute"
                    style={{
                      left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`,
                      outline: selected ? `2px solid ${SEL}` : '1px dashed transparent',
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      cursor: editing ? 'text' : 'move',
                      zIndex: selected ? 10 : 1,
                    }}
                    onPointerDown={(e) => onPointerDown(e, el, 'move')}
                    onDoubleClick={(e) => { e.stopPropagation(); if (el.type === 'text') setEditingId(el.id) }}
                  >
                    {el.type === 'text' && (
                      editing ? (
                        <textarea
                          autoFocus value={el.text || ''}
                          onChange={(e) => apply(elements.map(x => x.id === el.id ? { ...x, text: e.target.value } : x))}
                          onBlur={() => { setEditingId(null); commit(elementsRef.current) }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="h-full w-full resize-none bg-white/80 outline-none"
                          style={{
                            color: `#${el.color || '222222'}`, fontSize: el.fontSize || 18, fontWeight: el.bold ? 700 : 400,
                            fontStyle: el.italic ? 'italic' : undefined,
                            textDecoration: el.underline ? 'underline' : undefined,
                            textAlign: el.align || 'left', fontFamily: el.fontFamily || FONT, lineHeight: el.lineHeight || 1.4,
                          }}
                        />
                      ) : (
                        <div
                          className="h-full w-full overflow-hidden whitespace-pre-wrap"
                          style={{
                            color: `#${el.color || '222222'}`, fontSize: el.fontSize || 18, fontWeight: el.bold ? 700 : 400,
                            fontStyle: el.italic ? 'italic' : undefined,
                            textDecoration: el.underline ? 'underline' : undefined,
                            textAlign: el.align || 'left', fontFamily: el.fontFamily || FONT, lineHeight: el.lineHeight || 1.4,
                          }}
                        >
                          {el.bullet ? (el.text || '').split('\n').map((t, k) => <div key={k}>• {t}</div>) : el.text}
                        </div>
                      )
                    )}
                    {el.type === 'image' && el.src && <img src={el.src} alt="" draggable={false} className="h-full w-full object-contain pointer-events-none" />}
                    {el.type === 'shape' && <ShapeRender shape={el.shape} fill={el.fill} />}
                    {selected && selIds.length === 1 && (
                      <div
                        className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full bg-white ring-2"
                        style={{ cursor: 'nwse-resize', ['--tw-ring-color' as string]: SEL }}
                        onPointerDown={(e) => onPointerDown(e, el, 'resize')}
                      />
                    )}
                  </div>
                )
              })}

              {/* 装饰层（按 theme.decor 渲染风格化角标，视觉最前但不挡交互） */}
              <SlideDecor theme={theme} layout={layout} />

              {/* 对齐参考线 */}
              {guide.v != null && (
                <div className="absolute top-0 pointer-events-none" style={{ left: `${guide.v}%`, width: 1, height: '100%', background: '#FF4D4F', zIndex: 50 }} />
              )}
              {guide.h != null && (
                <div className="absolute left-0 pointer-events-none" style={{ top: `${guide.h}%`, height: 1, width: '100%', background: '#FF4D4F', zIndex: 50 }} />
              )}

              {/* 框选矩形 */}
              {marquee && (
                <div className="absolute pointer-events-none border bg-opacity-10" style={{ left: `${marquee.x}%`, top: `${marquee.y}%`, width: `${marquee.w}%`, height: `${marquee.h}%`, zIndex: 60, borderColor: SEL, background: `${SEL}1A` }} />
              )}

              {/* 内容页底部主题色带（增强模板风格辨识，封面整页已用主题底故不叠） */}
              {!isCover && <div className="absolute left-0 bottom-0 h-[2.5%] w-full" style={{ background: c(theme.footer || theme.primary) }} />}
            </div>
          </div>
        </div>
        <p className="mt-1 text-center text-xs text-[#9A9A9A] shrink-0">双击标题/文本框编辑文字 · 拖拽移动(自动吸附) · 拖右下角缩放 · 空白处拖框选 · Ctrl+Z/Y 撤销重做 · Ctrl+C/V/D 复制粘贴副本 · Delete 删 · 方向键微调</p>
      </div>

      {/* 属性面板展开内容（Portal 到 body，fixed 跟随选中元件）；面板只在命中元件时才出现，无独立唤醒按钮 */}
      {propPanelContent && createPortal(propPanelContent, document.body)}
    </div>
  )

  // ── 全屏编辑（fixed inset-0 + 深色标题栏 + 退出/完成，借鉴教案全屏编辑器） ──
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[80] bg-[#F0F2F5] flex flex-col select-none" onClick={(e) => { if (e.target === e.currentTarget) setFullscreen(false) }}>
        <div className="flex items-center justify-between px-4 py-2 bg-[#212529] text-white shrink-0">
          <span className="text-sm font-medium truncate">{title || '未命名'} · PPT 全屏编辑</span>
          <div className="flex gap-2">
            <button onClick={() => setFullscreen(false)} className="px-3 py-1 text-xs rounded bg-white/15 hover:bg-white/25">退出全屏</button>
            <button onClick={() => setFullscreen(false)} className="px-3 py-1 text-xs rounded bg-[#02A7F0] hover:bg-[#0288D1]">完成</button>
          </div>
        </div>
        {body}
      </div>
    )
  }

  return <div className="w-full select-none flex flex-col">{body}</div>
}
