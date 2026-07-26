import { type ReactNode } from 'react'

/**
 * P0-2 全屏预览承载层（外壳）。四件套共用：全屏 + 不可编辑 + 一键编辑 + 标题栏。
 * 外壳内渲染什么由产品通过 children 注入，因产品而异：
 *   文字类 = 锁定只读版式 / PPT = 放映态播放器 / H5 = 运行态 iframe。
 * 外壳只负责"全屏承载 + 返回编辑"，不关心内部是版式还是播放器。
 */
interface Props {
  open: boolean
  title?: string
  onClose: () => void
  /** 可选：覆盖 onClose 的"编辑"动作（如页面想直接进入编辑态）。不传则按钮用 onClose */
  onEdit?: () => void
  children: ReactNode
}

export default function PreviewOverlay({ open, title, onClose, onEdit, children }: Props) {
  if (!open) return null
  const handleEdit = onEdit || onClose
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* 标题栏 */}
      <div className="h-12 flex items-center justify-between px-5 border-b border-[#E7E7EB] shrink-0">
        <span className="text-[14px] font-medium text-[#353535]">{title || '预览'}</span>
        <button
          onClick={handleEdit}
          className="px-4 py-1.5 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors"
        >
          编辑
        </button>
      </div>
      {/* 正文区 */}
      <div className="flex-1 overflow-hidden bg-[#F6F7F8]">
        {children}
      </div>
    </div>
  )
}
