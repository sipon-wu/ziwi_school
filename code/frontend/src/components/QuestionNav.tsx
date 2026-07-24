/**
 * QuestionNav — 题目导航面板（180px）
 * 与教案的「章节导航」同位置、同交互。
 * - 列出所有题目（序号 + 题型标签 + 题干概要）
 * - 点击题目 → scrollIntoView 定位到对应题目
 * - 可折叠 + 深灰 chip 恢复
 */
import { useState } from 'react'
import { ChevronLeft, ListTree } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  choice: '选择', fill: '填空', judge: '判断', truefalse: '判断',
  match: '匹配', cloze: '完形', reading: '阅读', writing: '写作',
  short_answer: '简答', calculation: '计算',
}

interface QItem { id: string; type: string; stem: string }

interface Props { questions: QItem[] }

export default function QuestionNav({ questions }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const handleClick = (idx: number) => {
    const el = document.querySelector(`[data-qidx="${idx}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)} title="展开题目导航"
        className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-12 bg-gray-700/70 hover:bg-gray-800 rounded-r-md flex items-center justify-center text-white z-20 transition-all shadow-md">
        <ChevronLeft size={14} style={{ transform: 'rotate(180deg)' }} />
      </button>
    )
  }

  return (
    <div className="w-[180px] border-r border-[#E7E7EB] bg-[#FAFBFC] flex flex-col shrink-0 overflow-hidden relative">
      <div className="px-3 py-2 text-[11px] font-semibold text-[#9A9A9A] flex items-center justify-between border-b border-[#F0F0F0] shrink-0">
        <span className="flex items-center gap-1">
          <ListTree size={12} />
          题目导航
          <span className="font-normal text-[#C0C0C0]">{questions.length}题</span>
        </span>
        <button onClick={() => setCollapsed(true)} className="text-[#C0C0C0] hover:text-[#9A9A9A]"><ChevronLeft size={12} /></button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {questions.length === 0 ? (
          <p className="text-[11px] text-[#C0C0C0] px-3 py-2">暂无题目</p>
        ) : (
          questions.map((q, i) => (
            <button key={q.id || i} onClick={() => handleClick(i + 1)}
              className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#F0F2F5] flex items-center gap-1.5 truncate">
              <span className="font-semibold text-[#1A3A6B] shrink-0">{i + 1}.</span>
              <span className="text-[9px] text-[#9A9A9A] bg-[#F6F7F8] px-1 rounded shrink-0">{TYPE_LABELS[q.type] || q.type}</span>
              <span className="text-[#9A9A9A] truncate">{(q.stem || '').slice(0, 24)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
