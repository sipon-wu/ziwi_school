import { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Monitor } from 'lucide-react'
import { parseSections } from '../lib/parseSections'

interface Props {
  content: string
  title: string
  subject: string
  grade: string
  teacherName?: string
  onClose: () => void
  /** embedded=true 时不自带全屏外层与顶部标题栏，由 PreviewOverlay 统一承载（与编辑器官方预览一致） */
  embedded?: boolean
}

export default function PresentationMode({ content, title, subject, grade, teacherName, onClose, embedded = false }: Props) {
  const sections = parseSections(content).filter(s => !s.collapsed && s.body.trim())
  const [slideIdx, setSlideIdx] = useState(0)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const onStagePointerDown = (e: React.PointerEvent) => { dragStart.current = { x: e.clientX, y: e.clientY } }
  const onStagePointerUp = (e: React.PointerEvent) => {
    const s = dragStart.current
    dragStart.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) setSlideIdx(i => Math.min(i + 1, sections.length - 1))
      else setSlideIdx(i => Math.max(i - 1, 0))
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); setSlideIdx(i => Math.min(i+1, sections.length)) }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setSlideIdx(i => Math.max(i-1, 0)) }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sections.length, onClose])

  const slide = sections[slideIdx]
  if (!slide) {
    return (
      <div className={embedded ? 'relative h-full w-full flex items-center justify-center bg-gray-900' : 'fixed inset-0 z-[70] bg-gray-900 flex items-center justify-center'} onClick={onClose}>
        <div className="text-center text-white/70 max-w-md px-6">
          <Monitor size={40} className="mx-auto mb-4 text-white/30" />
          <p className="text-lg">该教案暂无正文内容，无法投屏播放</p>
          <p className="text-sm mt-2 text-white/40">请先在编辑器中 AI 生成教案或填写正文后再预览</p>
          <button onClick={onClose} className="mt-6 px-5 py-2 text-sm text-white border border-white/30 rounded hover:bg-white/10">关闭</button>
        </div>
      </div>
    )
  }

  return (
    <div className={embedded ? 'relative h-full w-full flex flex-col bg-gray-900' : 'fixed inset-0 z-[70] bg-gray-900 flex flex-col'} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {/* 顶部工具栏：独立全屏模式显示；embedded 时由 PreviewOverlay 提供标题栏与「返回编辑」 */}
      {!embedded && (
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800/80 text-white">
        <div className="flex items-center gap-3">
          <img src="/xiaowei.png?v=5" alt="知微" className="w-6 h-6 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <span className="text-xs text-gray-400">{title} · {subject}{grade}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Monitor size={12}/>投屏模式</span>
          <span>{slideIdx + 1} / {sections.length}</span>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X size={16}/></button>
        </div>
      </div>
      )}

      {/* 幻灯片内容 */}
      <div
        className="flex-1 overflow-auto p-8"
        onPointerDown={onStagePointerDown}
        onPointerUp={onStagePointerUp}
        style={{ touchAction: 'pan-y' }}
      >
        <div className="min-h-full flex items-center justify-center">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-12 my-auto flex flex-col max-h-[calc(100vh-8rem)]">
          <div className="mb-8 border-l-4 border-brand pl-4 shrink-0">
            <h1 className="text-3xl font-bold text-gray-900">{slide.title}</h1>
            {slideIdx === 0 && <p className="text-base text-gray-500 mt-2">{title}</p>}
            {teacherName && <p className="text-sm text-gray-400 mt-1">{teacherName} · {subject}{grade}</p>}
          </div>
          <div className="flex-1 text-xl leading-relaxed text-gray-800 whitespace-pre-wrap overflow-auto">
            {slide.body}
          </div>
        </div>
        </div>
      </div>

      {/* 底部导航 */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800/80">
        <button onClick={() => setSlideIdx(i => Math.max(i-1,0))} disabled={slideIdx===0}
          className="flex items-center gap-1 px-4 py-2 text-sm text-white/70 hover:text-white disabled:opacity-30">
          <ChevronLeft size={16}/> 上一页
        </button>
        <div className="flex gap-2">
          {sections.map((_, i) => (
            <button key={i} onClick={() => setSlideIdx(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${i===slideIdx ? 'bg-brand' : 'bg-white/20 hover:bg-white/40'}`} />
          ))}
        </div>
        <button onClick={() => setSlideIdx(i => Math.min(i+1, sections.length-1))} disabled={slideIdx===sections.length-1}
          className="flex items-center gap-1 px-4 py-2 text-sm text-white/70 hover:text-white disabled:opacity-30">
          下一页 <ChevronRight size={16}/>
        </button>
      </div>

      {/* 知微品牌标识 - 仅LOGO，无广告 */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/20">
        知微教学助手 · ziwi.cn
      </div>
    </div>
  )
}
