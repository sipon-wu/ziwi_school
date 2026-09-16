/**
 * 课件页列表（缩略图导航）（2026-09-16 从 CoursewareBuilder.tsx 抽出，抽组件 Step 2）
 *
 * 原先在页面里**复制了 2 份**：
 *   · 编辑态左栏：w-44 白底，hover 显示上移 / 下移 / 删除，封面不给这些按钮
 *   · 全屏态左栏：w-[170px] 灰底，只读（无操作按钮），标题截断 16 字
 * 两者结构一致、只有"是否可编辑"和容器样式不同，故用一个组件 + editable 开关覆盖。
 *
 * ★ 页序语义（与 useCwPreview 保持一致，勿改）：
 *   列表第 0 项是**封面**（outlineToSlides 自动插入），不属于 cwOutline；
 *   正文项 i 对应 cwOutline 下标 `oi = i - 1`，上移/下移/删除传的都是 oi。
 *   封面不给移动/删除按钮 —— 否则会产生"删掉封面"这种无意义操作。
 *
 * 拆分原则：行为逐行搬迁，不改逻辑、不改视觉。
 */
import { SlideThumb } from './PptxPreview'
import { resolveTheme } from '../lib/pptThemes'
import type { CwSlide } from '../lib/exportPptx'

export interface CwPageListProps {
  /** 外层容器 class（编辑态 w-44 白底 / 全屏态 w-[170px] 灰底） */
  className?: string
  /** 整本幻灯片（已含封面，来自 cwThumbSlides） */
  slides: CwSlide[]
  /** 当前整本页序（0 = 封面） */
  deckIdx: number
  onSelect: (i: number) => void
  theme: ReturnType<typeof resolveTheme>
  aspect: '16/9' | '4/3'
  /** 是否显示上移/下移/删除（编辑态 true，全屏态 false） */
  editable?: boolean
  /** 正文页总数（cwOutline.length），用于禁用首项上移与末项下移 */
  pageCount?: number
  onMove?: (oi: number, dir: -1 | 1) => void
  onDelete?: (oi: number) => void
  /** 无标题时的占位文案 */
  emptyTitle?: string
  /** 标题最大字数（全屏态传 16） */
  titleMax?: number
}

export function CwPageList({
  className = '', slides, deckIdx, onSelect, theme, aspect,
  editable = false, pageCount = 0, onMove, onDelete,
  emptyTitle = '（无标题）', titleMax,
}: CwPageListProps) {
  const t = (s: string) => (titleMax ? s.slice(0, titleMax) : s)
  return (
    <div className={className}>
      {/* 整本页列表（含封面，2026-09-15）：此前只列正文页 + 缩略图取 cwThumbSlides[idx+1]，
          结果编辑器里**既看不到封面、也选不到它**（教师原话："编辑器里也需要加上封面"）。
          规则：第 0 项 = 封面（内容由左栏「课题名称/学科/年级/班级/署名」驱动，故不给上移/删除按钮）；
          正文项按下标 -1 映射回 cwOutline，原有上移/下移/删除照旧。 */}
      {slides.map((s, i) => {
        const isCover = i === 0
        const oi = i - 1                                  // 正文页在 cwOutline 中的下标
        return (
          <div key={i} onClick={() => onSelect(i)}
            className={`group w-full text-left cursor-pointer rounded-[4px] border overflow-hidden transition-colors ${i === deckIdx ? 'border-[#02A7F0] ring-1 ring-[#02A7F0]' : 'border-[#E7E7EB] hover:border-[#02A7F0]'}`}>
            <div className="relative">
              <SlideThumb slide={s} theme={theme} idx={i} ar={aspect} />
              {editable && !isCover && (
                <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); onMove?.(oi, -1) }} disabled={oi === 0} className="px-1 py-0.5 text-[10px] text-[#353535] bg-white/90 rounded hover:text-[#02A7F0] disabled:opacity-30 shadow-sm">↑</button>
                  <button onClick={(e) => { e.stopPropagation(); onMove?.(oi, 1) }} disabled={oi === pageCount - 1} className="px-1 py-0.5 text-[10px] text-[#353535] bg-white/90 rounded hover:text-[#02A7F0] disabled:opacity-30 shadow-sm">↓</button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete?.(oi) }} className="px-1 py-0.5 text-[10px] text-[#F5222D] bg-white/90 rounded hover:bg-[#FFF1F0] shadow-sm">✕</button>
                </div>
              )}
            </div>
            <p className="px-1.5 py-1 text-[11px] text-[#353535] truncate">{isCover ? '封面' : t(s.title || emptyTitle)}</p>
          </div>
        )
      })}
    </div>
  )
}
