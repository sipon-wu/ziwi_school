import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Undo2, Redo2 } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { CwElement, CwSlide, H5Component } from '../lib/exportPptx'
import { layoutElements, extractBullets, normalizeInteractive } from '../lib/exportPptx'
import type { CwTheme } from '../lib/pptThemes'
import { DEFAULT_THEME } from '../lib/pptThemes'
import { getSkeleton, distributeToSlots, isStructuredLayout } from '../lib/cwTemplate'
import type { SlideLayout, SlideSlots } from '../lib/cwTemplate'
import { normalizeVisuals } from '../lib/exportPptx'
import { VisualBlockView } from './VisualBlocks'
import type { DecorSlots, DecorItem } from '../lib/api'

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
function SlideFrame({ theme, layout, visCount = 0 }: { theme: CwTheme; layout: string; visCount?: number }) {
  const p = c(theme.primary)
  const f = c(theme.footer || theme.primary)
  const sub = c(theme.subtle)
  const band = (top: string, h: string) => (
    <div className="absolute left-0 w-full" style={{ top, height: h, background: p, opacity: 0.92 }} />
  )
  // 该页挂了可视化组件时，容器造型由内容层（renderLayoutContent 的 visual + bullets）完整渲染；
  // 空壳骨架会把视觉元素压住（如 edu-goal 的 3 个空卡片压住金句/对比表），此处直接不画。
  if (visCount > 0) return null
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
      <div className="pointer-events-none absolute inset-0" style={{ fontFamily: '"KaiTi","STKaiti",serif' }}>
        {isCover ? (
          <>
            {/* 封面：右上古朴印章 */}
            <div className="absolute right-[7%] top-[9%] flex h-16 w-16 flex-col items-center justify-center rounded-md text-center text-[12px] font-bold leading-tight"
                 style={{ background: p, color: onP, boxShadow: '0 2px 8px rgba(0,0,0,0.25)', transform: 'rotate(-3deg)', border: `2px solid ${onP}33` }}>
              知<br />微
            </div>
            {/* 左下：淡墨山影 */}
            <svg className="absolute bottom-0 left-0" width="40%" height="45%" viewBox="0 0 200 120" style={{ opacity: 0.14 }} aria-hidden>
              <path d="M0 120 Q 40 60 80 95 Q 110 40 150 75 Q 175 55 200 70 L 200 120 Z" fill={p} />
            </svg>
          </>
        ) : (
          <>
            {/* 左上角小印章（缩小并上移，避开正文 definition 区 y=20%~38%） */}
            <div className="absolute left-[2%] top-[3%] flex h-8 w-8 flex-col items-center justify-center rounded-sm border text-[8px] leading-tight"
                 style={{ borderColor: `${p}88`, color: p, background: `${p}0D`, transform: 'rotate(-2deg)' }}>
              知微<br />教学
            </div>
            {/* 右下：淡墨远山 */}
            <svg className="absolute right-[2%] bottom-[2%]" width="30%" height="28%" viewBox="0 0 200 120" style={{ opacity: 0.10 }} aria-hidden>
              <path d="M40 120 Q 70 60 110 90 Q 145 40 200 70 L 200 120 Z" fill={p} />
            </svg>
            {/* 顶部：细墨线（版眉） */}
            <div className="absolute left-[4%] right-[4%] top-[13.5%] h-[1.5px]" style={{ background: `${p}55` }} />
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

/**
 * 装饰元件层（模板内置装饰 / 用户替换装饰）：
 * 渲染 slide.decor（插槽式 DecorSlots）的装饰元件图片——背景铺满 + 页眉/页脚/四角/浮动区。
 * 与 SlideDecor（按 theme.decor 绘制的风格化 SVG 角标）是两套东西：本层渲染真实图片资产。
 * selectable=true 时（编辑态）每个装饰图可点击选中（高亮边框），onSelect 上报 {slot, index}；
 * 否则 pointer-events-none 不干扰内容编辑。
 */
export interface DecorSelection { slot: 'header' | 'footer' | 'corner' | 'floating' | 'background'; index: number }

function DecorLayer({ decor, selectable, selected, onSelect, onContextMenu }: {
  decor: DecorSlots | null | undefined
  selectable?: boolean
  selected?: DecorSelection | null
  onSelect?: (sel: DecorSelection | null) => void
  onContextMenu?: (e: React.MouseEvent, sel: DecorSelection) => void
}) {
  if (!decor) return null
  const items = (arr: DecorItem[] | undefined) => arr || []
  const isSel = (slot: DecorSelection['slot'], index: number) => !!selected && selected.slot === slot && selected.index === index
  const stop = (e: React.MouseEvent) => { e.stopPropagation() }
  const imgCls = (slot: DecorSelection['slot'], index: number, base: string) =>
    `${base} ${selectable ? 'pointer-events-auto cursor-pointer' : ''} ${isSel(slot, index) ? 'ring-2 ring-[#02A7F0] ring-offset-1' : ''}`
  // 右键装饰：先选中该装饰，再弹出上下文菜单
  const onCtx = (slot: DecorSelection['slot'], index: number) => (e: React.MouseEvent) => {
    if (!selectable) return
    e.preventDefault(); e.stopPropagation()
    const sel: DecorSelection = { slot, index }
    onSelect?.(sel)
    onContextMenu?.(e, sel)
  }
  return (
    <div className={selectable ? 'absolute inset-0 z-[2]' : 'pointer-events-none absolute inset-0 z-[2]'}>
      {decor.background && (
        <div
          onClick={selectable ? (e) => { stop(e); onSelect?.(isSel('background', 0) ? null : { slot: 'background', index: 0 }) } : undefined}
          onContextMenu={onCtx('background', 0)}
          className={`absolute inset-0 ${selectable ? 'pointer-events-auto cursor-pointer' : ''} ${isSel('background', 0) ? 'ring-2 ring-inset ring-[#02A7F0]' : ''}`}
          style={{ backgroundImage: `url(${decor.background})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.18 }}
        />
      )}
      {/* 页眉 */}
      <div className="absolute top-0 left-0 right-0 h-[18%] flex items-center justify-center gap-2">
        {items(decor.header).map((it, i) => (
          <img key={`h${i}`} src={it.url} alt={it.name || '装饰'}
            onClick={selectable ? (e) => { stop(e); onSelect?.(isSel('header', i) ? null : { slot: 'header', index: i }) } : undefined}
            onContextMenu={onCtx('header', i)}
            className={imgCls('header', i, 'max-h-[80%] max-w-[40%] object-contain')} />
        ))}
      </div>
      {/* 页脚 */}
      <div className="absolute bottom-0 left-0 right-0 h-[18%] flex items-center justify-center gap-2">
        {items(decor.footer).map((it, i) => (
          <img key={`f${i}`} src={it.url} alt={it.name || '装饰'}
            onClick={selectable ? (e) => { stop(e); onSelect?.(isSel('footer', i) ? null : { slot: 'footer', index: i }) } : undefined}
            onContextMenu={onCtx('footer', i)}
            className={imgCls('footer', i, 'max-h-[80%] max-w-[40%] object-contain')} />
        ))}
      </div>
      {/* 四角 */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((pos, i) => {
        const it = items(decor.corners)[i]
        if (!it) return null
        const style: React.CSSProperties = pos === 'tl' ? { top: '4%', left: '4%' } : pos === 'tr' ? { top: '4%', right: '4%' } : pos === 'bl' ? { bottom: '4%', left: '4%' } : { bottom: '4%', right: '4%' }
        return <img key={pos} src={it.url} alt={it.name || '装饰'} style={style}
          onClick={selectable ? (e) => { stop(e); onSelect?.(isSel('corner', i) ? null : { slot: 'corner', index: i }) } : undefined}
          onContextMenu={onCtx('corner', i)}
          className={imgCls('corner', i, 'absolute max-w-[14%] max-h-[14%] object-contain')} />
      })}
      {/* 浮动 */}
      {items(decor.floating).map((it, i) => {
        const style: React.CSSProperties = i === 0 ? { top: '42%', left: '8%' } : i === 1 ? { top: '58%', right: '8%' } : { top: '30%', right: '10%' }
        return <img key={`fl${i}`} src={it.url} alt={it.name || '装饰'} style={style}
          onClick={selectable ? (e) => { stop(e); onSelect?.(isSel('floating', i) ? null : { slot: 'floating', index: i }) } : undefined}
          onContextMenu={onCtx('floating', i)}
          className={imgCls('floating', i, 'absolute max-w-[16%] max-h-[16%] object-contain')} />
      })}
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
  /** 选中装饰元件变化回调（向上冒泡，供外层唤起「替换/删除装饰」操作） */
  onSelectDecor?: (sel: DecorSelection | null) => void
  /** 请求替换当前选中装饰元件（外层打开素材库装饰元件面板） */
  onReplaceDecor?: (sel: DecorSelection) => void
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
  onSelectDecor,
  onReplaceDecor,
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
          <EditableCanvas key={current} slideKey={current} slide={slides[current]} theme={theme} onChange={handleSlideChange} cw={CW} ch={CH} ar={ar} onArChange={setAr} embedFullscreen={embedFullscreen} onSelect={onSelect} onSelectDecor={onSelectDecor} onReplaceDecor={onReplaceDecor} />
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

/** PPT 互动组件面板：把 quiz/reveal/readalong/drawing 以可交互控件呈现（点击左下角按钮弹出） */
function InteractiveItem({ it, theme }: { it: H5Component; theme: CwTheme }) {
  const p = c(theme.primary)
  if (it.type === 'quiz') {
    const [sel, setSel] = useState<number | null>(null)
    return (
      <div>
        <div className="mb-2 text-sm font-semibold">✏️ {it.question}</div>
        <div className="space-y-2">
          {it.options.map((o, i) => {
            const right = sel === null ? null : i === it.correct
            return (
              <button key={i} onClick={() => setSel(i)}
                className="block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                style={{ borderColor: sel === null ? '#ddd' : right ? '#3FA34D' : '#FF6B6B', background: sel === i ? (right ? '#3FA34D22' : '#FF6B6B22') : '#fff' }}>
                {o}
              </button>
            )
          })}
        </div>
        {sel !== null && <div className="mt-2 text-xs font-bold" style={{ color: sel === it.correct ? '#3FA34D' : '#FF6B6B' }}>{sel === it.correct ? '✅ 正确！' : '❌ 再想想~'}</div>}
      </div>
    )
  }
  if (it.type === 'reveal') {
    const [show, setShow] = useState(false)
    return (
      <div>
        <button onClick={() => setShow(true)} className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: p }}>{it.prompt || '点我揭晓'}</button>
        {show && <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm">{it.answer}</div>}
      </div>
    )
  }
  if (it.type === 'readalong') {
    const tts = (t: string) => { try { if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(t); u.lang = 'en-US'; u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u) } } catch { /* noop */ } }
    return (
      <div>
        <div className="mb-2 text-xs font-bold text-gray-500">🎤 跟读</div>
        {it.sentences.map((s, i) => (
          <div key={i} className="mb-1 flex items-center gap-2">
            <span className="text-sm">{s.text}</span>
            <button onClick={() => tts(s.text)} className="rounded bg-blue-500 px-2 py-1 text-xs text-white">▶ 示范</button>
          </div>
        ))}
      </div>
    )
  }
  if (it.type === 'drawing') {
    const ref = useRef<HTMLCanvasElement>(null)
    return (
      <div>
        <div className="mb-1 text-xs font-bold text-gray-500">🎨 {it.title}</div>
        <canvas ref={ref} width={400} height={160} className="w-full rounded-lg border-2 border-dashed" style={{ borderColor: p }} />
        <button onClick={() => { const cv = ref.current; if (cv) cv.getContext('2d')?.clearRect(0, 0, cv.width, cv.height) }} className="mt-1 rounded bg-red-500 px-2 py-1 text-xs text-white">清除</button>
      </div>
    )
  }
  return null
}

function InteractivePanel({ components, theme }: { components: H5Component[]; theme: CwTheme }) {
  const [open, setOpen] = useState(false)
  if (!components.length) return null
  const p = c(theme.primary)
  return (
    <>
      <button onClick={() => setOpen(o => !o)} className="absolute bottom-[3%] left-[3%] z-20 rounded-full px-3 py-1 text-[11px] font-bold text-white shadow" style={{ background: p }}>
        🎯 互动 ({components.length})
      </button>
      {open && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-[6%]" onClick={() => setOpen(false)}>
          <div className="max-h-full w-full overflow-auto rounded-xl bg-white p-5 shadow-2xl" style={{ color: c(theme.body) }} onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: p }}>课堂互动</span>
              <button onClick={() => setOpen(false)} className="text-xs text-gray-400">关闭</button>
            </div>
            <div className="space-y-4">
              {components.map((it, i) => <InteractiveItem key={i} it={it} theme={theme} />)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function renderStaticSlide(s: CwSlide, theme: CwTheme, idx: number, aspectRatio: '16/9' | '4/3') {
  const lay = s.layout || (s.kind === 'cover' ? 'edu-cover' : 'title-body')
  if (s.kind === 'cover') {
    return (
      <div className="relative" style={{ aspectRatio: aspectRatio === '4/3' ? '4 / 3' : '16 / 9', background: c(theme.coverBg) }}>
        <SlideFrame theme={theme} layout={lay} />
        <SlideDecor theme={theme} layout={lay} />
        <DecorLayer decor={s.decor} />
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
      <SlideFrame theme={theme} layout={lay} visCount={normalizeVisuals((s as any).visuals).length} />
      <SlideDecor theme={theme} layout={lay} />
      <DecorLayer decor={s.decor} />
      <div className="absolute left-[2%] top-0 flex h-[15.3%] items-center" style={{ width: '96%' }}>
        <span className="truncate font-bold"
          style={{ color: c(theme.onPrimary), fontSize: '2.6rem', fontFamily: '"KaiTi","STKaiti",serif' }}>
          {s.title}
        </span>
      </div>
      {/* 内容与模板分离：结构化版式优先按骨架渲染（即时分发/预存 slots），自由元素只在非结构化版式回退 */}
      {isStructuredLayout(lay) ? (
        renderLayoutContent(s, theme)
      ) : s.elements && s.elements.length ? (
        renderElementsStatic(s.elements)
      ) : (
        renderLayoutContent(s, theme)
      )}
      {s.footer && (
        <div className="absolute bottom-[2%] right-[3%] text-[10px]" style={{ color: c(theme.footer), fontFamily: theme.font }}>{s.footer}</div>
      )}
      {normalizeInteractive((s as any).interactive).length > 0 && (
        <InteractivePanel components={normalizeInteractive((s as any).interactive)} theme={theme} />
      )}
    </div>
  )
}

/* ───────────────────────── 版式感内容渲染（把 bullet 按模板分区放置） ───────────────────────── */
function renderLayoutContent(s: CwSlide, theme: CwTheme) {
  const lines = (s.rich || []).map((line) => `${line.options.bullet ? '• ' : ''}${line.text}`)
  const p = c(theme.primary)
  const body = c(theme.body)

  // 通用单行文本块：自动缩放到容器内，字号随文字长度自适应（短文大字号、长文小字号）
  const Line = ({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) => {
    const len = text?.length || 0
    // 参考字号：≤12字 3.6mm，13-20字 3.2mm，21-30字 2.8mm，>30字 2.4mm
    const fs = len <= 12 ? 3.6 : len <= 20 ? 3.2 : len <= 30 ? 2.8 : 2.4
    return (
      <div className={`flex h-full w-full items-center overflow-hidden ${className || ''}`} style={style}>
        <div className="w-full leading-snug" style={{ color: body, fontSize: `${fs}mm` }}>
          {text}
        </div>
      </div>
    )
  }

  const lay = s.layout || 'title-body'

  // ── 可视化组件优先：该页挂了递进图/对比表/时间轴/生字卡等组件时，
  // 用结构表达知识关系（真课件），而不是把 bullets 平铺成文字列表。
  const vis = normalizeVisuals((s as any).visuals)
  if (vis.length) {
    const vt = { primary: p, body: c(theme.body), subtle: c(theme.subtle || '777777'), font: theme.font || FONT }
    // 一主一辅：visual 为主体（金句/对比表/时间轴等），bullets 为下方要点条。
    // 此前该分支直接 return，bullets 被整体丢弃——是"页面内容缺失"的根因。
    const hasBullets = lines.length > 0
    const visTop = '16%'
    const visH = hasBullets ? '50%' : '78%'
    return (
      <>
        {vis.map((b, i) => (
          <div key={i} className="absolute overflow-hidden"
            style={{
              left: '5%', right: '5%',
              top: vis.length === 1 ? visTop : `calc(${visTop} + (${i} * (${visH} / ${vis.length})))`,
              height: vis.length === 1 ? visH : `calc(${visH} / ${vis.length})`,
              // 多组件时靠内边距留间距（box-sizing:border-box，不撑破分配高度）
              paddingBottom: vis.length > 1 ? '0.8%' : undefined,
            }}>
            <VisualBlockView block={b} theme={vt} />
          </div>
        ))}
        {hasBullets && (
          <div className="absolute grid gap-2 px-1"
            style={{
              left: '5%', right: '5%', top: '70%', height: '26%',
              gridTemplateColumns: lines.length <= 3 ? `repeat(${lines.length}, minmax(0,1fr))` : 'repeat(2, minmax(0,1fr))',
            }}>
            {lines.map((txt, i) => (
              <div key={i} className="flex items-center overflow-hidden rounded-md border px-3"
                style={{ borderColor: `${p}44`, background: `${p}06` }}>
                <div className="w-full leading-snug" style={{ color: body, fontSize: '2.7mm' }}>
                  <span className="mr-1 font-bold" style={{ color: p }}>{i + 1}.</span>
                  {txt}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  // ── 教学目标 / 课堂小结 / 课后作业 ──
  // 这三个版式原本被分发进「三维目标三栏」「分层三栏」占位骨架，导致 AI 生成的目标
  // 被切碎塞进三个窄栏、字号被压到 2.4mm 不可读。有真实 bullets 时改为单列铺开：
  // 宽度从 29% 提到 88%，字号可放大约一倍；无 bullets 时才回退到占位骨架。
  if (lines.length && (lay === 'edu-goal' || lay === 'edu-summary' || lay === 'edu-homework')) {
    return (
      <div className="absolute left-[6%] top-[21%] flex w-[88%] flex-col justify-center gap-[3.5%]" style={{ height: '66%' }}>
        {lines.map((txt, i) => (
          <div key={i} className="leading-snug" style={{ color: body, fontSize: '4.4mm' }}>{txt}</div>
        ))}
      </div>
    )
  }

  // ── 内容与模板分离：按骨架几何渲染（全局唯一契约）──
  // 优先用预存 slots；无 slots 但 layout 命中骨架时，即时按骨架分发 bullets（兼容存量数据）。
  const effSlots: SlideSlots | undefined = s.slots ?? (isStructuredLayout(lay) ? distributeToSlots(lay as SlideLayout, lines) : undefined)
  if (effSlots) {
    const sk = getSkeleton(lay as SlideLayout)
    if (sk) {
      return (
        <>
          {sk.placeholders.map((ph) => {
            if (ph.key === 'title' && lay !== 'cover') return null
            const content = effSlots[ph.key] ?? []
            const r = ph.rect!
            const isBullet = ph.kind === 'bullet'
            const display = content.length ? content : (ph.placeholder ? [ph.placeholder] : [])
            const style: React.CSSProperties = {
              left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`,
            }
            if (isBullet && ph.columns && ph.columns > 1) {
              return (
                <div key={ph.key} className={`absolute grid gap-2`} style={{ ...style, gridTemplateColumns: `repeat(${ph.columns}, minmax(0,1fr))` }}>
                  {display.map((txt, i) => (
                    <div key={i} className="flex rounded-md border p-2" style={{ borderColor: `${p}55`, background: `${p}08` }}>
                      <Line text={txt} className="items-center" />
                    </div>
                  ))}
                </div>
              )
            }
            return (
              <div
                key={ph.key}
                className="absolute overflow-hidden px-4 py-3"
                style={{
                  ...style,
                  borderLeft: `6px solid ${p}`,
                  background: ph.kind === 'title' ? 'transparent' : `${p}0F`,
                  display: 'flex', alignItems: ph.kind === 'title' ? 'center' : 'flex-start',
                  fontWeight: ph.bold ? 700 : 400,
                  fontSize: ph.fontSize ? `${ph.fontSize / 18 * 3}mm` : undefined,
                  color: body,
                  textAlign: ph.align || 'left',
                }}
              >
                {display.map((txt, i) => (
                  <div key={i} className="mb-1 leading-snug" style={{ color: body }}>{txt}</div>
                ))}
              </div>
            )
          })}
          {effSlots['__overflow']?.map((txt, k) => (
            <div key={`of-${k}`} className="absolute left-[6.3%] text-[3mm] leading-snug" style={{ top: `${90 + k * 6}%`, width: '87.4%', color: body }}>{txt}</div>
          ))}
        </>
      )
    }
  }

  // 旧数据兼容（无 slots）：沿用原有的行号分配逻辑
  // 教学目标：3 个纵向卡片
  if (lay === 'edu-goal') {
    const chunks = [lines[0] || '', lines[1] || '', lines[2] || '']
    return (
      <div className="pointer-events-none absolute left-[5.3%] top-[22%] flex w-[89.4%] gap-3" style={{ height: '64%' }}>
        {chunks.map((txt, i) => (
          <div key={i} className="relative flex flex-1 flex-col rounded-xl border p-3" style={{ borderColor: `${p}55`, background: `${p}0D` }}>
            <div className="mb-2 h-1.5 w-10 shrink-0 rounded-full" style={{ background: p }} />
            <Line text={txt} className="items-start" />
          </div>
        ))}
      </div>
    )
  }

  // 知识讲解：第 1 条放进概念框，其余在线条下方
  if (lay === 'edu-explain') {
    return (
      <>
        <div className="absolute left-[6.3%] top-[22%] w-[87.4%] rounded-lg border-2 px-4 py-3" style={{ height: '30%', borderColor: `${p}66`, background: `${p}0A` }}>
          <Line text={lines[0] || ''} />
        </div>
        <div className="absolute left-[6.3%] top-[56%] w-[87.4%]" style={{ height: '40%' }}>
          {lines.slice(1).map((txt, k) => (
            <div key={k} className="mb-2 text-[3mm] leading-snug" style={{ color: body }}>{txt}</div>
          ))}
        </div>
      </>
    )
  }

  // 例题演练：第 1 条放进题干栏，第 2~4 条分别放进 3 个卡片
  if (lay === 'edu-example') {
    const stem = lines[0] || ''
    const steps = [lines[1] || '', lines[2] || '', lines[3] || '']
    return (
      <>
        <div className="absolute left-[6.3%] top-[22%] flex w-[87.4%] items-stretch rounded-md px-4 py-3" style={{ height: '20%', borderLeft: `6px solid ${p}`, background: `${p}0F` }}>
          <Line text={stem} />
        </div>
        <div className="absolute left-[5.3%] top-[50%] grid w-[89.4%] grid-cols-3 gap-2" style={{ height: '34%' }}>
          {steps.map((txt, i) => (
            <div key={i} className="rounded-md border p-2" style={{ borderColor: `${p}55`, background: 'rgba(255,255,255,0.7)' }}>
              <Line text={txt} className="items-start" />
            </div>
          ))}
        </div>
        {lines.slice(4).map((txt, k) => (
          <div key={k} className="absolute left-[6.3%] text-[3mm] leading-snug" style={{ top: `${86 + k * 6}%`, width: '87.4%', color: body }}>{txt}</div>
        ))}
      </>
    )
  }

  // 课堂小结：左侧文字 + 右侧装饰圆环
  if (lay === 'edu-summary') {
    return (
      <div className="absolute left-[5.3%] top-[22%]" style={{ width: '52%', height: '70%' }}>
        {lines.map((txt, k) => (
          <div key={k} className="mb-3 flex items-start gap-2 text-[3mm] leading-snug" style={{ color: body }}>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p }} />
            <span>{txt}</span>
          </div>
        ))}
      </div>
    )
  }

  // 作业布置：3 行横向条
  if (lay === 'edu-homework') {
    const rows = [lines[0] || '', lines[1] || '', lines[2] || '']
    const bgOp = ['14', '0E', '08']
    return (
      <div className="absolute left-[5.3%] top-[20%] w-[89.4%] space-y-2" style={{ height: '68%' }}>
        {rows.map((txt, i) => (
          <div key={i} className="h-[28%] rounded-md border px-4" style={{ borderColor: `${p}44`, background: `${p}${bgOp[i]}` }}>
            <Line text={txt} />
          </div>
        ))}
        {lines.slice(3).map((txt, k) => (
          <div key={k} className="text-[3mm] leading-snug" style={{ color: body }}>{txt}</div>
        ))}
      </div>
    )
  }

  // 默认/封面兜底：保持原来的顺序块
  return (
    <div className="absolute left-[5.3%] top-[20%]" style={{ width: '89.4%', height: '70%' }}>
      {lines.map((txt, k) => (
        <p key={k} className="mb-2 text-[3mm] leading-snug" style={{ color: body }}>{txt}</p>
      ))}
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

/** 右键上下文菜单项 */
function MenuItem({ children, onClick, danger, accent }: { children: React.ReactNode; onClick: () => void; danger?: boolean; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full text-left px-3 py-1.5 hover:bg-[#F5F5F5] ${danger ? 'text-[#F5222D]' : accent ? 'text-[#02A7F0] font-medium' : 'text-[#353535]'}`}
    >
      {children}
    </button>
  )
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
  /** 选中装饰元件变化回调（向上冒泡，供外层唤起「替换/删除装饰」操作） */
  onSelectDecor?: (sel: DecorSelection | null) => void
  /** 请求替换当前选中装饰元件（外层打开素材库装饰元件面板） */
  onReplaceDecor?: (sel: DecorSelection) => void
}

/** 画布快照（撤销/重做用） */
interface Snap { elements: CwElement[]; title: string; layout: string }

const SNAP = 1.5 // 吸附阈值（%）
const FONT_OPTS = ['Microsoft YaHei', 'SimSun', 'SimHei', 'KaiTi', 'FangSong', 'Arial', 'Times New Roman']

function EditableCanvas({ slide, slideKey, theme, onChange, cw, ch, ar, onArChange, embedFullscreen, onSelect, onSelectDecor, onReplaceDecor }: EditableCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [selIds, setSelIds] = useState<string[]>([])
  const [selDecor, setSelDecor] = useState<DecorSelection | null>(null)
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
  const drag = useRef<{ mode: 'move' | 'resize' | 'rotate' | 'marquee'; dir?: string; cx?: number; cy?: number; sx: number; sy: number; base: CwElement[]; mx: number; my: number } | null>(null)
  const clipboardRef = useRef<CwElement[]>([])

  // 仅切页（slideKey 变化）时重置画布；同页编辑 slide 引用变化不重置（避免覆盖画布内编辑态）
  useEffect(() => {
    const els = slide.elements || []
    const lay = slide.layout || 'title-body'
    setElements(els)
    setTitle(slide.title)
    setLayout(lay)
    setSelIds([])
    setSelDecor(null)
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

  // 删除指定装饰元件（操作 slide.decor，经 onChange 回传外层）。
  // sel 由调用方显式传入（避免 state 异步导致的 selDecor 闭包旧值）。
  const removeDecor = (sel?: DecorSelection | null) => {
    const target = sel ?? selDecor
    if (!target) return
    const cur: DecorSlots = slide.decor || {}
    if (target.slot === 'background') {
      const next: DecorSlots = { ...cur, background: undefined }
      onChange({ ...slide, decor: next })
    } else {
      const key = target.slot === 'corner' ? 'corners' : target.slot
      const list = (cur as any)[key] || []
      const nextList = list.filter((_: unknown, j: number) => j !== target.index)
      const next: DecorSlots = { ...cur, [key]: nextList }
      onChange({ ...slide, decor: next })
    }
    setSelDecor(null)
    onSelectDecor?.(null)
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
  const moveLayerToEdge = (edge: 'front' | 'back') => {
    if (!selId) return
    const next = [...elements]
    const idx = next.findIndex(e => e.id === selId)
    if (idx < 0) return
    const [moved] = next.splice(idx, 1)
    if (edge === 'front') next.push(moved)
    else next.unshift(moved)
    commit(next)
  }
  const toggleLock = () => {
    if (!selId) return
    commit(elements.map(e => e.id === selId ? { ...e, locked: !e.locked } : e))
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

  // ── AI 一键排版（AI 辅助平台差异化）：智能对齐 + 均匀分布 + 适配版式安全区 ──
  // 规则（本地启发式，无需后端）：
  //  1. 多选：按主轴（水平/垂直占比大的方向）均匀分布 + 居中对齐
  //  2. 单选：元素居中到版式安全区（避开标题区 15.3% 顶部）
  //  3. 所有元素：吸附到安全区内（不超出画布、不压标题）
  const aiAutoLayout = () => {
    const selEls = elementsRef.current.filter(e => selIdsRef.current.includes(e.id))
    if (!selEls.length) return
    // 版式安全区：顶部标题带约 15.3%，内容区在 [15.3%, 100%]
    const SAFE_TOP = 16, SAFE_BOTTOM = 97, SAFE_LEFT = 2, SAFE_RIGHT = 98
    const clampSafe = (el: CwElement) => ({
      ...el,
      x: clamp(el.x, SAFE_LEFT, Math.max(SAFE_LEFT, SAFE_RIGHT - el.w)),
      y: clamp(el.y, SAFE_TOP, Math.max(SAFE_TOP, SAFE_BOTTOM - el.h)),
    })
    if (selEls.length === 1) {
      // 单选：水平居中 + 垂直居中到安全区
      const el = selEls[0]
      const cx = (SAFE_LEFT + SAFE_RIGHT) / 2 - el.w / 2
      const cy = (SAFE_TOP + SAFE_BOTTOM) / 2 - el.h / 2
      commit(elementsRef.current.map(e => e.id === el.id ? { ...e, x: clamp(cx, SAFE_LEFT, SAFE_RIGHT - el.w), y: clamp(cy, SAFE_TOP, SAFE_BOTTOM - el.h) } : e))
      return
    }
    // 多选：按主轴均匀分布
    const bounds = { minX: Math.min(...selEls.map(e => e.x)), maxX: Math.max(...selEls.map(e => e.x + e.w)), minY: Math.min(...selEls.map(e => e.y)), maxY: Math.max(...selEls.map(e => e.y + e.h)) }
    const spanW = bounds.maxX - bounds.minX, spanH = bounds.maxY - bounds.minY
    const horiz = spanW >= spanH
    const sorted = [...selEls].sort((a, b) => (horiz ? a.x - b.x : a.y - b.y))
    if (horiz) {
      // 水平均分：等间距分布，保持各自 y 不变但统一垂直居中
      const firstX = sorted[0].x, lastX = sorted[sorted.length - 1].x + sorted[sorted.length - 1].w
      const totalW = sorted.reduce((s, e) => s + e.w, 0)
      const gap = (lastX - firstX - totalW) / (sorted.length - 1)
      let cur = firstX
      const posMap = new Map<string, { x: number; y: number }>()
      const midY = (bounds.minY + bounds.maxY) / 2
      sorted.forEach((e) => { posMap.set(e.id, { x: cur, y: midY - e.h / 2 }); cur += e.w + gap })
      commit(elementsRef.current.map(e => posMap.has(e.id) ? clampSafe({ ...e, x: posMap.get(e.id)!.x, y: posMap.get(e.id)!.y }) : e))
    } else {
      const firstY = sorted[0].y, lastY = sorted[sorted.length - 1].y + sorted[sorted.length - 1].h
      const totalH = sorted.reduce((s, e) => s + e.h, 0)
      const gap = (lastY - firstY - totalH) / (sorted.length - 1)
      let cur = firstY
      const posMap = new Map<string, { x: number; y: number }>()
      const midX = (bounds.minX + bounds.maxX) / 2
      sorted.forEach((e) => { posMap.set(e.id, { x: midX - e.w / 2, y: cur }); cur += e.h + gap })
      commit(elementsRef.current.map(e => posMap.has(e.id) ? clampSafe({ ...e, x: posMap.get(e.id)!.x, y: posMap.get(e.id)!.y }) : e))
    }
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

  const onPointerDown = (e: ReactPointerEvent, el: CwElement, mode: 'move' | 'resize' | 'rotate', dir?: string) => {
    e.stopPropagation()
    if (editingId === el.id) return
    // 点元素：取消装饰选中
    setSelDecor(null)
    // 多选：Shift 增减；否则若点中已选集合则整组拖动，否则单选
    let nextSel: string[]
    if (e.shiftKey) {
      nextSel = selIdsRef.current.includes(el.id) ? selIdsRef.current.filter(s => s !== el.id) : [...selIdsRef.current, el.id]
      setSelIds(nextSel)
      if (mode !== 'move') nextSel = [el.id]
    } else {
      nextSel = selIdsRef.current.includes(el.id) ? selIdsRef.current : [el.id]
      setSelIds(nextSel)
    }
    // 锁定元素：可选中，但不可拖动/缩放/旋转（不启动拖拽）
    if (el.locked) return
    const base = elementsRef.current.map(x => ({ ...x }))
    // 旋转：记录元素中心（画布 %），拖动时按中心旋转
    const cx = el.x + el.w / 2
    const cy = el.y + el.h / 2
    drag.current = { mode, dir, cx, cy, sx: e.clientX, sy: e.clientY, base, mx: 0, my: 0 }
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
    } else if (d.mode === 'rotate') {
      // 旋转：以元素中心为圆心，计算起始/当前指针角度差
      const rect = canvasRef.current!.getBoundingClientRect()
      const centerX = rect.left + ((d.cx || 0) / 100) * rect.width
      const centerY = rect.top + ((d.cy || 0) / 100) * rect.height
      const startAngle = Math.atan2(d.sy - centerY, d.sx - centerX)
      const curAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX)
      let delta = ((curAngle - startAngle) * 180) / Math.PI
      // 吸附到 15° 整数倍
      const snapped = Math.round(delta / 15) * 15
      const baseRot = d.base.find(el => el.id === selId)?.rotation || 0
      apply(d.base.map(el => el.id === selId
        ? { ...el, rotation: Math.round(baseRot + snapped) % 360 }
        : el))
    } else {
      // 8 方向缩放：边中点单向拉伸；角点等比缩放（保持宽高比，以对角点为锚）
      const dir = d.dir || 'se'
      apply(d.base.map(el => {
        if (el.id !== selId) return el
        let { x, y, w, h } = el
        const minW = 4, minH = 3
        const isCorner = dir.length === 2
        if (isCorner) {
          // 等比缩放：以拖动方向决定新尺寸，对角点固定
          const ratio = el.h / el.w // h = w * ratio
          if (dir === 'se') {
            w = clamp(el.w + dxPct, minW, 100 - el.x); h = w * ratio
          } else if (dir === 'sw') {
            const nw = clamp(el.w - dxPct, minW, el.x + el.w)
            x = el.x + el.w - nw; w = nw; h = w * ratio; y = el.y + el.h - h
          } else if (dir === 'ne') {
            w = clamp(el.w + dxPct, minW, 100 - el.x); h = w * ratio
            y = el.y + el.h - h
          } else { // nw
            const nw = clamp(el.w - dxPct, minW, el.x + el.w)
            x = el.x + el.w - nw; w = nw; h = w * ratio; y = el.y + el.h - h
          }
        } else {
          // 边中点：单向拉伸
          if (dir === 'e') w = clamp(el.w + dxPct, minW, 100 - el.x)
          if (dir === 's') h = clamp(el.h + dyPct, minH, 100 - el.y)
          if (dir === 'w') { const nw = clamp(el.w - dxPct, minW, el.x + el.w); x = el.x + el.w - nw; w = nw }
          if (dir === 'n') { const nh = clamp(el.h - dyPct, minH, el.y + el.h); y = el.y + el.h - nh; h = nh }
        }
        return { ...el, x, y, w, h }
      }))
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
    // 点空白：取消装饰选中 + 关闭右键菜单
    setSelDecor(null)
    setCtxMenu(null)
    // 空白框选
    drag.current = { mode: 'marquee', sx: e.clientX, sy: e.clientY, base: elementsRef.current.map(x => ({ ...x })), mx: 0, my: 0 }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  // 右键菜单：元素右键弹出上下文操作
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; type: 'element' | 'decor'; id?: string; decor?: DecorSelection } | null>(null)
  const onElementContextMenu = (e: React.MouseEvent, el: CwElement) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selIds.includes(el.id)) setSelIds([el.id])
    setCtxMenu({ x: e.clientX, y: e.clientY, type: 'element', id: el.id })
  }
  // 装饰右键：选中装饰 + 弹出替换/删除菜单
  const onDecorContextMenu = (e: React.MouseEvent, sel: DecorSelection) => {
    setSelDecor(sel)
    setSelIds([])
    onSelectDecor?.(sel)
    setCtxMenu({ x: e.clientX, y: e.clientY, type: 'decor', decor: sel })
  }
  // 点击任意处关闭右键菜单
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setCtxMenu(null) })
    return () => { window.removeEventListener('click', close) }
  }, [ctxMenu])

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
          {selDecor && (
            <>
              <span className="mx-0.5 text-[#E7E7EB]">|</span>
              <span className="text-[#7B61FF]">装饰{selDecor.slot === 'background' ? '·背景' : ''}</span>
              <button onClick={() => onReplaceDecor?.(selDecor)} className="px-1.5 py-0.5 rounded text-[#7B61FF] border border-[#7B61FF] hover:bg-[#F3F0FF]">替换</button>
              <button onClick={() => removeDecor()} className="px-1.5 py-0.5 rounded border border-[#F5222D] text-[#F5222D] hover:bg-[#FFF1F0]">删除</button>
            </>
          )}
          {selIds.length > 0 && (
            <>
              <span className="mx-0.5 text-[#E7E7EB]">|</span>
              <button title="AI 排版（单选居中/多选均匀分布，适配版式安全区）" onClick={aiAutoLayout} className="px-1.5 py-0.5 rounded text-[#02A7F0] font-medium border border-[#02A7F0] hover:bg-[#E8F7FF]">✨ AI 排版</button>
              <button title="复制 (Ctrl+C)" onClick={copySelected} className={`px-1.5 py-0.5 rounded ${B}`}>复制</button>
              <button title="粘贴 (Ctrl+V)" onClick={pasteClipboard} className={`px-1.5 py-0.5 rounded ${B}`}>粘贴</button>
              <button title="创建副本 (Ctrl+D)" onClick={duplicateSelected} className={`px-1.5 py-0.5 rounded ${B}`}>副本</button>
              <button onClick={removeSelected} className="px-1.5 py-0.5 rounded border border-[#F5222D] text-[#F5222D] hover:bg-[#FFF1F0]">删除</button>
              {selId && (
                <>
                  <button title="上移一层" onClick={() => moveLayer(1)} className={`px-1.5 py-0.5 rounded ${B}`}>上移</button>
                  <button title="下移一层" onClick={() => moveLayer(-1)} className={`px-1.5 py-0.5 rounded ${B}`}>下移</button>
                  <button title="置于顶层" onClick={() => moveLayerToEdge('front')} className={`px-1.5 py-0.5 rounded ${B}`}>置顶</button>
                  <button title="置于底层" onClick={() => moveLayerToEdge('back')} className={`px-1.5 py-0.5 rounded ${B}`}>置底</button>
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
                      outline: selected ? `2px solid ${el.locked ? '#9A9A9A' : SEL}` : '1px dashed transparent',
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      cursor: editing ? 'text' : el.locked ? 'default' : 'move',
                      zIndex: selected ? 10 : 1,
                    }}
                    onPointerDown={(e) => onPointerDown(e, el, 'move')}
                    onDoubleClick={(e) => { e.stopPropagation(); if (el.type === 'text' && !el.locked) setEditingId(el.id) }}
                    onContextMenu={(e) => onElementContextMenu(e, el)}
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
                    {/* 锁定标识：锁定元素显示🔒角标，且不渲染缩放/旋转把手 */}
                    {el.locked && selected && (
                      <div className="absolute -top-2 -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#9A9A9A] text-white text-[9px] leading-none" title="已锁定（右键解锁）">🔒</div>
                    )}
                    {selected && selIds.length === 1 && !el.locked && (
                      <>
                        {/* 8 点缩放把手：四角等比 + 四边中点单向 */}
                        {([
                          { dir: 'nw', x: '-1.5', y: '-1.5', cur: 'nwse-resize' },
                          { dir: 'n', x: '50%', y: '-1.5', cur: 'ns-resize' },
                          { dir: 'ne', x: 'calc(100% - 4.5px)', y: '-1.5', cur: 'nesw-resize' },
                          { dir: 'e', x: 'calc(100% - 4.5px)', y: '50%', cur: 'ew-resize' },
                          { dir: 'se', x: 'calc(100% - 4.5px)', y: 'calc(100% - 4.5px)', cur: 'nwse-resize' },
                          { dir: 's', x: '50%', y: 'calc(100% - 4.5px)', cur: 'ns-resize' },
                          { dir: 'sw', x: '-1.5', y: 'calc(100% - 4.5px)', cur: 'nesw-resize' },
                          { dir: 'w', x: '-1.5', y: '50%', cur: 'ew-resize' },
                        ] as const).map(h => (
                          <div
                            key={h.dir}
                            className="absolute h-3 w-3 rounded-full bg-white ring-2"
                            style={{ left: h.x, top: h.y, cursor: h.cur, ['--tw-ring-color' as string]: SEL }}
                            onPointerDown={(e) => onPointerDown(e, el, 'resize', h.dir)}
                          />
                        ))}
                        {/* 旋转把手：元素上方圆点，拖拽绕中心旋转 */}
                        <div
                          className="absolute left-1/2 -top-5 h-3 w-3 rounded-full bg-white ring-2 cursor-grab"
                          style={{ transform: 'translateX(-50%)', ['--tw-ring-color' as string]: SEL }}
                          title="拖拽旋转（吸附 15°）"
                          onPointerDown={(e) => onPointerDown(e, el, 'rotate')}
                        />
                        {/* 旋转把手与元素顶部的连接线 */}
                        <div className="absolute left-1/2 -top-4 h-3 w-px" style={{ transform: 'translateX(-50%)', background: SEL }} />
                      </>
                    )}
                  </div>
                )
              })}

              {/* 装饰层（按 theme.decor 渲染风格化角标，视觉最前但不挡交互） */}
              <SlideDecor theme={theme} layout={layout} />
              {/* 装饰元件层（模板内置装饰 / 用户替换装饰的真实图片资产；编辑态可点选 + 右键替换/删除） */}
              <DecorLayer decor={slide.decor} selectable selected={selDecor}
                onSelect={(sel) => {
                  setSelDecor(sel)
                  if (sel) setSelIds([]) // 选中装饰时取消元素选中
                  onSelectDecor?.(sel)
                }}
                onContextMenu={onDecorContextMenu} />

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

      {/* 右键上下文菜单（Portal 到 body） */}
      {ctxMenu && createPortal(
        <div className="fixed z-[100] min-w-[150px] rounded-md bg-white shadow-xl border border-[#E7E7EB] py-1 text-[12px]" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={(e) => e.stopPropagation()}>
          {ctxMenu.type === 'decor' ? (
            <>
              <MenuItem onClick={() => { if (ctxMenu.decor) onReplaceDecor?.(ctxMenu.decor); setCtxMenu(null) }} accent>替换装饰</MenuItem>
              <MenuItem onClick={() => { removeDecor(ctxMenu.decor); setCtxMenu(null) }} danger>删除装饰</MenuItem>
            </>
          ) : (
            <>
              <MenuItem onClick={() => { copySelected(); setCtxMenu(null) }}>复制</MenuItem>
              <MenuItem onClick={() => { pasteClipboard(); setCtxMenu(null) }}>粘贴</MenuItem>
              <MenuItem onClick={() => { duplicateSelected(); setCtxMenu(null) }}>创建副本</MenuItem>
              <div className="my-1 h-px bg-[#F0F0F0]" />
              <MenuItem onClick={() => { moveLayer(1); setCtxMenu(null) }}>上移一层</MenuItem>
              <MenuItem onClick={() => { moveLayer(-1); setCtxMenu(null) }}>下移一层</MenuItem>
              <MenuItem onClick={() => { moveLayerToEdge('front'); setCtxMenu(null) }}>置于顶层</MenuItem>
              <MenuItem onClick={() => { moveLayerToEdge('back'); setCtxMenu(null) }}>置于底层</MenuItem>
              <div className="my-1 h-px bg-[#F0F0F0]" />
              <MenuItem onClick={() => { toggleLock(); setCtxMenu(null) }}>
                {elements.find(e => e.id === ctxMenu.id)?.locked ? '解锁' : '锁定'}
              </MenuItem>
              <div className="my-1 h-px bg-[#F0F0F0]" />
              <MenuItem onClick={() => { aiAutoLayout(); setCtxMenu(null) }} accent>
                ✨ AI 排版
              </MenuItem>
              <MenuItem onClick={() => { removeSelected(); setCtxMenu(null) }} danger>删除</MenuItem>
            </>
          )}
        </div>,
        document.body
      )}
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
