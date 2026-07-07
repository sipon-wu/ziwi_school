/**
 * ResourcePicker — 通用资源选择器
 *
 * mode='questions' → 浏览题库（个人+校本），勾选题目
 * mode='materials' → 浏览素材库，勾选素材
 *
 * 输出：onSelect(items) 返回选中项列表
 */
import { useState } from 'react'
import { X, Search, Image, FileText, Music, Video } from 'lucide-react'

/* ── 类型 ── */
type PickerMode = 'questions' | 'materials'

interface QuestionItem {
  id: string
  content: string
  subject: string
  grade: string
  type: string
  difficulty: string
  source: 'personal' | 'school'
}

interface MaterialItem {
  id: string
  name: string
  type: 'image' | 'doc' | 'audio' | 'video'
  group: string
  size: string
}

interface Props {
  open: boolean
  mode: PickerMode
  onClose: () => void
  onSelect: (items: (QuestionItem | MaterialItem)[]) => void
  /** 题库模式：'personal' 仅个人，'all' 个人+校本 */
  questionSource?: 'personal' | 'all'
  selectedIds?: string[]
}

/* ── Mock 数据 ── */
const MOCK_QUESTIONS: QuestionItem[] = [
  { id: 'q1', content: '下列选项中描写了钱塘江大潮的是？A.《观潮》 B.《走月亮》 C.《爬山虎的脚》', subject: '语文', grade: '四年级', type: 'choice', difficulty: 'L1', source: 'personal' },
  { id: 'q2', content: '"宽阔"的反义词是？', subject: '语文', grade: '四年级', type: 'fill', difficulty: 'L1', source: 'personal' },
  { id: 'q4', content: '阅读《观潮》选段，回答：作者是按什么顺序描写钱塘江大潮的？', subject: '语文', grade: '四年级', type: 'reading', difficulty: 'L2', source: 'personal' },
  { id: 'q5', content: '用"犹如"造句（至少20字）', subject: '语文', grade: '四年级', type: 'writing', difficulty: 'L2', source: 'personal' },
  { id: 's1', content: '下列哪个词语是拟声词？A. 哗哗 B. 美丽 C. 跑步', subject: '语文', grade: '四年级', type: 'choice', difficulty: 'L1', source: 'school' },
  { id: 's2', content: '描写一处你见过的自然景观，不少于150字', subject: '语文', grade: '四年级', type: 'writing', difficulty: 'L3', source: 'school' },
  { id: 's3', content: '判断：比喻句中一定有"像"字', subject: '语文', grade: '四年级', type: 'judge', difficulty: 'L1', source: 'school' },
  { id: 's4', content: '将下列句子改为排比句：春天来了', subject: '语文', grade: '四年级', type: 'fill', difficulty: 'L2', source: 'school' },
]

const MOCK_MATERIALS: MaterialItem[] = [
  { id: 'm1', name: '《观潮》课文插图', type: 'image', group: '四上语文', size: '2.3MB' },
  { id: 'm2', name: '《走月亮》朗读音频', type: 'audio', group: '四上语文', size: '5.1MB' },
  { id: 'm3', name: '《爬山虎的脚》板书设计', type: 'image', group: '四上语文', size: '1.8MB' },
  { id: 'm4', name: '四上语文单元思维导图', type: 'image', group: '四上语文', size: '980KB' },
  { id: 'm5', name: '课堂活动：成语接龙', type: 'doc', group: '四上语文', size: '89KB' },
  { id: 'm6', name: '自然景观教学视频', type: 'video', group: '四上语文', size: '18.7MB' },
]

const TYPE_LABELS: Record<string, string> = { choice: '选择', fill: '填空', judge: '判断', match: '匹配', cloze: '完形', reading: '阅读', writing: '写作' }

const MATERIAL_ICONS: Record<string, any> = { image: Image, doc: FileText, audio: Music, video: Video }
const MATERIAL_COLORS: Record<string, string> = { image: '#1890FF', doc: '#52C41A', audio: '#FA8C16', video: '#F5222D' }

export default function ResourcePicker({ open, mode, onClose, onSelect, questionSource = 'all', selectedIds = [] }: Props) {
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set(selectedIds))

  if (!open) return null

  const questions = questionSource === 'personal'
    ? MOCK_QUESTIONS.filter(q => q.source === 'personal')
    : MOCK_QUESTIONS

  const materials = MOCK_MATERIALS

  const toggle = (id: string) => {
    setPicked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    if (mode === 'questions') {
      onSelect(questions.filter(q => picked.has(q.id)))
    } else {
      onSelect(materials.filter(m => picked.has(m.id)))
    }
    onClose()
  }

  const items = mode === 'questions' ? questions : materials

  const filtered = items.filter(item => {
    if (!search) return true
    if (mode === 'questions') {
      const q = item as QuestionItem
      return q.content.includes(search) || (q.type && TYPE_LABELS[q.type]?.includes(search))
    }
    const m = item as MaterialItem
    return m.name.includes(search) || m.group.includes(search)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-[4px] shadow-2xl w-[640px] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E7E7EB] shrink-0">
          <h3 className="text-[14px] font-semibold text-[#353535]">
            {mode === 'questions' ? '选择题目' : '选择素材'}
            <span className="text-[11px] text-[#9A9A9A] ml-2 font-normal">已选 {picked.size} 项</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[#F6F7F8] rounded-[4px]">
            <X size={16} className="text-[#9A9A9A]" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 border-b border-[#F0F0F0]">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={mode === 'questions' ? '搜索题目内容...' : '搜索素材名称...'}
              className="w-full pl-8 pr-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-[#9A9A9A] py-8">暂无匹配结果</p>
          ) : (
            filtered.map(item => {
              const isChecked = picked.has(item.id)
              if (mode === 'questions') {
                const q = item as QuestionItem
                return (
                  <label key={q.id}
                    className={`flex items-start gap-3 p-2.5 rounded-[4px] cursor-pointer border transition-colors ${isChecked ? 'border-[#02A7F0] bg-[#02A7F0]/5' : 'border-transparent hover:bg-[#F6F7F8]'}`}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggle(q.id)}
                      className="mt-0.5 w-3.5 h-3.5 rounded border-[#E7E7EB] text-[#02A7F0] focus:ring-[#02A7F0]" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] text-[#353535] line-clamp-2">{q.content}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#F6F7F8] rounded text-[#9A9A9A]">{TYPE_LABELS[q.type] || q.type}</span>
                        <span className="text-[10px] text-[#9A9A9A]">{q.difficulty}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${q.source === 'school' ? 'bg-green-50 text-green-600' : 'text-[#9A9A9A]'}`}>
                          {q.source === 'school' ? '校本' : '个人'}
                        </span>
                      </div>
                    </div>
                  </label>
                )
              }
              const m = item as MaterialItem
              const MIcon = MATERIAL_ICONS[m.type] || FileText
              return (
                <label key={m.id}
                  className={`flex items-center gap-3 p-2.5 rounded-[4px] cursor-pointer border transition-colors ${isChecked ? 'border-[#02A7F0] bg-[#02A7F0]/5' : 'border-transparent hover:bg-[#F6F7F8]'}`}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggle(m.id)}
                    className="w-3.5 h-3.5 rounded border-[#E7E7EB] text-[#02A7F0] focus:ring-[#02A7F0]" />
                  <MIcon size={16} style={{ color: MATERIAL_COLORS[m.type] }} />
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <span className="text-[12px] text-[#353535]">{m.name}</span>
                    <span className="text-[10px] text-[#9A9A9A] shrink-0 ml-3">{m.size} · {m.group}</span>
                  </div>
                </label>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E7E7EB] bg-[#F6F7F8] shrink-0">
          <span className="text-[11px] text-[#9A9A9A]">共 {filtered.length} 项，已选 {picked.size} 项</span>
          <div className="flex gap-2">
            <button onClick={() => { setPicked(new Set()); onClose() }}
              className="px-4 py-1.5 text-[12px] text-[#9A9A9A] border border-[#E7E7EB] rounded-[4px] hover:bg-white">
              取消
            </button>
            <button onClick={handleConfirm}
              className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors">
              确认选择 ({picked.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
