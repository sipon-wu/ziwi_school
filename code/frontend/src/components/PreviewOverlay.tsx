import { type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * P0-2 全屏预览承载层（外壳）。四件套共用：全屏 + 不可编辑 + 一键返回 + 标题栏。
 * 外壳内渲染什么由产品通过 children 注入，因产品而异：
 *   文字类 = 锁定只读版式 / PPT = 放映态播放器 / H5 = 运行态 iframe。
 * 外壳只负责"全屏承载 + 返回编辑"，不关心内部是版式还是播放器。
 */
interface Props {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
}

export default function PreviewOverlay({ open, title, onClose, children }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative bg-white w-full h-full flex flex-col shadow-2xl">
        {/* 标题栏：全屏 + 一键返回编辑 */}
        <div className="h-12 flex items-center justify-between px-5 border-b border-[#E7E7EB] shrink-0 bg-white">
          <span className="text-[14px] font-medium text-[#353535]">{title || '预览'}</span>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] transition-colors"
          >
            <X size={14} /> 返回编辑
          </button>
        </div>
        {/* 内里：产品注入的预览内容（不可编辑，由产品自身保证） */}
        <div className="flex-1 overflow-auto bg-[#F6F7F8]">
          {children}
        </div>
      </div>
    </div>
  )
}
