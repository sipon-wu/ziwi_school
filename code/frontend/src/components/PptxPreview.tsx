import { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Monitor, FileText } from 'lucide-react'
import type { CwSlide } from '../lib/exportPptx'

interface Props {
  slides: CwSlide[]
  title: string
  onClose: () => void
  /** embedded=true 时不自带全屏外层与顶部标题栏，由 PreviewOverlay 统一承载（与编辑器官方预览一致） */
  embedded?: boolean
}

/** 渲染单行富文本（与 pptxgenjs 文本对象结构一致） */
function RichLine({ line, index }: { line: NonNullable<CwSlide['rich']>[number]; index: number }) {
  const { text, options } = line
  const size = options.fontSize || 16
  const color = '#' + (options.color || '333333')
  const spaceAfter = (options.paraSpaceAfter || 0)

  if (options.bullet) {
    const isNumber = options.bullet && typeof options.bullet === 'object' && (options.bullet as any).type === 'number'
    return (
      <div key={index} className="flex items-start gap-2" style={{ fontSize: size, color, marginBottom: spaceAfter }}>
        <span className="select-none mt-[2px] text-[#1A3A6B] font-bold">{isNumber ? `${index + 1}.` : '•'}</span>
        <span className="flex-1 leading-snug">{text}</span>
      </div>
    )
  }
  return (
    <div key={index} style={{ fontSize: size, color, marginBottom: spaceAfter, lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: "'Consolas', monospace" }}>
      {text}
    </div>
  )
}

export default function PptxPreview({ slides, title, onClose, embedded = false }: Props) {
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const onStagePointerDown = (e: React.PointerEvent) => { dragStart.current = { x: e.clientX, y: e.clientY } }
  const onStagePointerUp = (e: React.PointerEvent) => {
    const s = dragStart.current
    dragStart.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) setIdx(i => Math.min(i + 1, slides.length - 1))
      else setIdx(i => Math.max(i - 1, 0))
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); setIdx(i => Math.min(i + 1, slides.length - 1)) }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [slides.length, onClose])

  const slide = slides[idx]
  if (!slide) return null

  return (
    <div className={embedded ? 'relative h-full w-full flex flex-col bg-[#0f172a]' : 'fixed inset-0 z-[70] bg-gray-900/95 flex flex-col'} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {/* 顶部工具栏：独立全屏模式显示；embedded 时由 PreviewOverlay 提供标题栏与「返回编辑」 */}
      {!embedded && (
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800/90 text-white shrink-0">
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-[#722ED1]" />
          <span className="text-sm font-medium">PPT 在线预览</span>
          <span className="text-xs text-gray-400">{title}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Monitor size={12} />所见即所得</span>
          <span>{idx + 1} / {slides.length}</span>
          <button onClick={() => setZoom(z => !z)} className="px-2 py-1 rounded hover:bg-white/10">{zoom ? '退出放大' : '放大'}</button>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X size={16} /></button>
        </div>
      </div>
      )}

      {/* 幻灯片舞台（16:9） */}
      <div
        className="flex-1 overflow-auto p-6"
        onPointerDown={onStagePointerDown}
        onPointerUp={onStagePointerUp}
        style={{ touchAction: 'pan-y' }}
      >
        <div className="min-h-full flex items-center justify-center">
        <div
          ref={stageRef}
          className={`relative bg-white shadow-2xl rounded-sm overflow-hidden ${zoom ? 'w-[95vw] max-w-none' : 'w-full max-w-[1000px] aspect-video'}`}
          style={zoom ? { aspectRatio: '16 / 9', maxHeight: '88vh' } : undefined}
        >
          {slide.kind === 'cover' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-10" style={{ background: '#1A3A6B' }}>
              <h1 className="text-[clamp(24px,4vw,44px)] font-bold text-white leading-tight">{slide.title}</h1>
              {slide.subtitle && <p className="mt-5 text-[clamp(14px,1.6vw,18px)] text-[#CADCFC]">{slide.subtitle}</p>}
              {slide.footer && <p className="absolute bottom-6 text-[12px] text-[#8FA8D6]">{slide.footer}</p>}
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col">
              {/* 顶部标题色带 */}
              <div className="h-[15.3%] min-h-[54px] flex items-center px-[5.3%]" style={{ background: '#1A3A6B' }}>
                <h2 className="text-[clamp(16px,2.2vw,26px)] font-bold text-white truncate">{slide.title}</h2>
              </div>
              {/* 正文 */}
              <div className="flex-1 px-[5.3%] py-[3%] overflow-auto">
                {slide.rich && slide.rich.length ? (
                  slide.rich.map((line, i) => <RichLine key={i} line={line} index={i} />)
                ) : (
                  <p className="text-gray-400 text-base">（本节无正文）</p>
                )}
              </div>
              {slide.footer && (
                <div className="absolute bottom-2 right-4 text-[10px] text-[#B0B8C4]">{slide.footer}</div>
              )}
            </div>
          )}

          {/* 教师备注 / 讲稿 */}
          {slide.notes && (
            <div className="absolute left-[5.3%] right-[5.3%] bottom-[2.5%] bg-[#FFF8E6] border-l-4 border-[#FAAD14] rounded-sm px-3 py-2">
              <p className="text-[10px] text-[#AD6800] font-medium mb-0.5">📝 教师备注（不显示给学生）</p>
              <p className="text-[11px] text-[#614700] leading-snug whitespace-pre-wrap">{slide.notes}</p>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* 底部导航 */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800/90 shrink-0">
        <button onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx === 0}
          className="flex items-center gap-1 px-4 py-2 text-sm text-white/70 hover:text-white disabled:opacity-30">
          <ChevronLeft size={16} /> 上一页
        </button>
        <div className="flex gap-2 max-w-[60%] overflow-x-auto">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors shrink-0 ${i === idx ? 'bg-[#722ED1]' : 'bg-white/20 hover:bg-white/40'}`} />
          ))}
        </div>
        <button onClick={() => setIdx(i => Math.min(i + 1, slides.length - 1))} disabled={idx === slides.length - 1}
          className="flex items-center gap-1 px-4 py-2 text-sm text-white/70 hover:text-white disabled:opacity-30">
          下一页 <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
