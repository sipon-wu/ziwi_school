/**
 * 新建分流弹层（共享组件）
 * - 「出题」→ 新标签打开 /exercises/new
 * - 「组卷」→ 新标签打开 /exams/new
 * 被 Exercises / ExamList 复用，避免两处重复实现分流逻辑。
 */
import { Plus, Files, X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

export default function CreateNewModal({ open, onClose }: Props) {
  if (!open) return null

  const go = (path: string) => {
    window.open(path, '_blank')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-[4px] shadow-2xl w-[520px] max-w-[92vw] z-10 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-[#353535]">新建什么？</h3>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#353535] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => go('/exercises/new')}
            className="group p-4 border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-8 h-8 rounded bg-[#02A7F0]/10 text-[#02A7F0] flex items-center justify-center">
                <Plus size={16} />
              </span>
              <span className="text-[13px] font-semibold text-[#353535]">出题</span>
            </div>
            <p className="text-[11px] text-[#9A9A9A]">AI 生成习题 · 文档模式可自由排版</p>
          </button>

          <button
            onClick={() => go('/exams/new')}
            className="group p-4 border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-8 h-8 rounded bg-[#1A3A6B]/10 text-[#1A3A6B] flex items-center justify-center">
                <Files size={16} />
              </span>
              <span className="text-[13px] font-semibold text-[#353535]">组卷</span>
            </div>
            <p className="text-[11px] text-[#9A9A9A]">AI 组卷 · 文档模式可自由排版</p>
          </button>
        </div>
      </div>
    </div>
  )
}
