import { type ReactNode, useState } from 'react'
import { MessageSquare, History } from 'lucide-react'

/**
 * P0-7 右侧批注/版本通用面板（A6 空容器）。
 * 统一置于右栏，各产品注入批注/版本内容；初期未实现时传空显示占位。
 * 不各产品自画顶栏菜单放版本（违反铁律）。
 */
interface Props {
  /** 批注内容（产品注入） */
  annotations?: ReactNode
  /** 版本历史内容（产品注入） */
  versions?: ReactNode
  /** 默认激活的 tab */
  defaultTab?: 'annotations' | 'versions'
}

export default function SidePanel({ annotations, versions, defaultTab = 'annotations' }: Props) {
  const [tab, setTab] = useState<'annotations' | 'versions'>(defaultTab)
  return (
    <div className="w-[300px] border-l border-[#E7E7EB] bg-white flex flex-col shrink-0">
      <div className="flex border-b border-[#E7E7EB] shrink-0">
        <button
          onClick={() => setTab('annotations')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] transition-colors ${
            tab === 'annotations' ? 'text-[#1A3A6B] font-medium border-b-2 border-[#02A7F0]' : 'text-[#9A9A9A] hover:text-[#353535]'
          }`}
        >
          <MessageSquare size={14} /> 批注
        </button>
        <button
          onClick={() => setTab('versions')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] transition-colors ${
            tab === 'versions' ? 'text-[#1A3A6B] font-medium border-b-2 border-[#02A7F0]' : 'text-[#9A9A9A] hover:text-[#353535]'
          }`}
        >
          <History size={14} /> 版本
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'annotations'
          ? (annotations || <EmptyHint text="暂无批注" />)
          : (versions || <EmptyHint text="暂无版本历史" />)}
      </div>
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center text-[12px] text-[#9A9A9A] py-10">
      {text}
    </div>
  )
}
