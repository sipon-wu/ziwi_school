import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Edit, Trash2, Eye, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { usePagination } from '../lib/useApi'
import { EmptyState } from '../components/StateComponents'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTeaching } from '../lib/TeachingContext'
import { api } from '../lib/api'
import AppLayout from '../components/AppLayout'

interface QuestionItem {
  id: string
  content: string
  subject: string
  grade: string
  type: string
  difficulty: string
  status: 'draft' | 'published'
  usage_count: number
  updated_at: string
  knowledge_points: string[]
}

const TYPE_LABELS: Record<string, string> = {
  choice: '选择', fill: '填空', calculation: '计算', judge: '判断',
  match: '匹配', cloze: '完形', reading: '阅读', essay: '解答',
  drawing: '作图', writing: '写作',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  L1: '基础', L2: '中等', L3: '进阶', L4: '挑战',
}

const MOCK_QUESTIONS: QuestionItem[] = [
  { id: 'q1', content: '下列哪个数是分数？A. 3 B. ½ C. 0.5 D. 5', subject: '数学', grade: '三年级', type: 'choice', difficulty: 'L1', status: 'published', usage_count: 12, updated_at: '2026-07-04 14:30', knowledge_points: ['分数的初步认识'] },
  { id: 'q2', content: '一个蛋糕平均分成8份，每份是（  ）/8。', subject: '数学', grade: '三年级', type: 'fill', difficulty: 'L2', status: 'published', usage_count: 8, updated_at: '2026-07-03 10:15', knowledge_points: ['分数加减法'] },
  { id: 'q3', content: '计算：3/4 + 1/6 = ?', subject: '数学', grade: '四年级', type: 'calculation', difficulty: 'L3', status: 'draft', usage_count: 0, updated_at: '2026-07-02 16:00', knowledge_points: ['分数四则运算'] },
  { id: 'q4', content: '阅读《观潮》选段，回答：作者是按什么顺序描写钱塘江大潮的？', subject: '语文', grade: '四年级', type: 'reading', difficulty: 'L2', status: 'published', usage_count: 15, updated_at: '2026-07-01 09:20', knowledge_points: ['叙述顺序分析'] },
  { id: 'q5', content: '2/5 读作：A. 二分之五 B. 五分之二 C. 五分二 D. 二五', subject: '数学', grade: '三年级', type: 'choice', difficulty: 'L1', status: 'draft', usage_count: 0, updated_at: '2026-06-30 11:45', knowledge_points: ['分数的意义'] },
  { id: 'q6', content: '下列词语中，没有错别字的一项是：A. 蜿蜒 B. 蜿蜒 C. 蜿蜒 D. 蜿蜒', subject: '语文', grade: '四年级', type: 'choice', difficulty: 'L1', status: 'published', usage_count: 6, updated_at: '2026-06-28 08:00', knowledge_points: ['字形辨析'] },
  { id: 'q7', content: '一个长方形的长是8cm，宽是5cm，面积是多少平方厘米？', subject: '数学', grade: '三年级', type: 'calculation', difficulty: 'L1', status: 'draft', usage_count: 0, updated_at: '2026-06-25 13:30', knowledge_points: ['长方形面积'] },
  { id: 'q8', content: 'There ___ some milk in the glass. A. is B. are C. has D. have', subject: '英语', grade: '五年级', type: 'choice', difficulty: 'L2', status: 'published', usage_count: 10, updated_at: '2026-06-22 15:00', knowledge_points: ['There be句型'] },
]

// jsonb 字段在库里可能是"字符串包裹的数组"(双重编码)，或已是数组；统一归一为数组，避免 .map/.some 崩溃白屏（BUG-001）
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      if (Array.isArray(p)) return p as string[]
    } catch { /* ignore */ }
  }
  return []
}

const GRADE_MAP: Record<number, string> = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级', 7: '七年级', 8: '八年级', 9: '九年级' }

const subjectColors: Record<string, string> = {
  '语文': 'bg-blue-50 text-blue-600',
  '数学': 'bg-orange-50 text-orange-600',
  '英语': 'bg-green-50 text-green-600',
}

export default function Exercises() {
  const navigate = useNavigate()
  const teaching = useTeaching()
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  useEffect(() => { api<{ items: any[] }>('/exercises').then(res => { setQuestions(res.items || []) }).catch(() => {}) }, [])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // 按当前教学上下文过滤（学科+年级）
  const classFiltered = useMemo(() => {
    const gradeStr = GRADE_MAP[teaching.grade] || ''
    return questions.filter(q => q.subject === teaching.subject && q.grade === gradeStr)
  }, [questions, teaching.subject, teaching.grade])

  const filtered = classFiltered.filter(q => {
    if (searchTerm && !q.content.includes(searchTerm) && !asArray(q.knowledge_points).some(kp => kp.includes(searchTerm))) return false
    if (filterSubject && q.subject !== filterSubject) return false
    if (filterType && q.type !== filterType) return false
    if (filterDifficulty && q.difficulty !== filterDifficulty) return false
    if (filterStatus && q.status !== filterStatus) return false
    return true
  })

  const { page, totalPages, paginated, goTo } = usePagination(filtered, 8)

  const handleRowClick = (q: QuestionItem) => {
    if (q.status === 'draft') {
      navigate(`/exercises/${q.id}`)
    } else {
      navigate(`/exercises/${q.id}?preview=1`)
    }
  }

  const handleDelete = () => {
    if (deleteTarget) {
      setQuestions(prev => prev.filter(q => q.id !== deleteTarget))
      setDeleteTarget(null)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#353535]">出题·题库</h1>
            <p className="text-[11px] text-[#9A9A9A] mt-0.5">管理个人题目，支持 AI 智能出题和手动编辑</p>
          </div>
          <button
            onClick={() => window.open('/exercises/new', '_blank')}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors"
          >
            <Plus size={16} /> 出题
          </button>
        </div>

        {/* 搜索 + 筛选 */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 relative min-w-[140px] max-w-[280px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              type="text" placeholder="搜索题目内容或知识点..." value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); goTo(1) }}
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]"
            />
          </div>
          <select value={filterType} onChange={e => { setFilterType(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部题型</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterDifficulty} onChange={e => { setFilterDifficulty(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部难度</option>
            {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </select>
        </div>

        {/* 统计条 */}
        <div className="flex items-center gap-3 text-[12px] text-[#9A9A9A]">
          <span>共 {filtered.length} 题</span>
          <span className="text-[#E7E7EB]">|</span>
          <span>已发布 {filtered.filter(q => q.status === 'published').length} 题</span>
          <span className="text-[#E7E7EB]">|</span>
          <span>草稿 {filtered.filter(q => q.status === 'draft').length} 题</span>
        </div>

        {/* 题目表格 */}
        {filtered.length === 0 ? (
          <EmptyState title="暂无匹配的题目" description="尝试调整搜索条件或点「出题」新建题目" action={{ label: 'AI 出题', onClick: () => window.open('/exercises/new', '_blank') }} />
        ) : (
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F6F7F8] border-b border-[#E7E7EB]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase w-[40%]">题目内容</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">学科</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">题型</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">难度</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">状态</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">使用次数</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {paginated.map(q => (
                    <tr key={q.id} onClick={() => handleRowClick(q)} className="hover:bg-[#F9FAFB] transition-colors cursor-pointer group">
                      <td className="px-4 py-3">
                        <div className="max-w-md">
                          <span className="text-[13px] text-[#353535] leading-relaxed line-clamp-2">{q.content}</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {asArray(q.knowledge_points).map((kp, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#F6F7F8] text-[#9A9A9A] rounded-[3px]">{kp}</span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`inline-block px-2 py-0.5 rounded-[3px] text-[11px] font-medium ${subjectColors[q.subject] || 'bg-gray-50 text-gray-500'}`}>
                          {q.subject}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#353535] hidden lg:table-cell">
                        {TYPE_LABELS[q.type] || q.type}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-[3px] text-[11px] font-medium ${
                          q.difficulty === 'L1' ? 'bg-green-50 text-green-600' :
                          q.difficulty === 'L2' ? 'bg-blue-50 text-blue-600' :
                          q.difficulty === 'L3' ? 'bg-orange-50 text-orange-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {DIFFICULTY_LABELS[q.difficulty] || q.difficulty}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {q.status === 'published' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-green-50 text-green-600">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> 已发布
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-yellow-50 text-yellow-600">
                            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" /> 草稿
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#9A9A9A] hidden lg:table-cell">{q.usage_count}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/exercises/${q.id}`) }} className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title="编辑">
                            <Edit size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/exercises/${q.id}?preview=1`) }} className="p-1.5 text-[#9A9A9A] hover:text-[#353535] hover:bg-gray-100 rounded-[3px]" title="预览">
                            <Eye size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(q.id) }} className="p-1.5 text-[#9A9A9A] hover:text-[#FF4D4F] hover:bg-red-50 rounded-[3px]" title="删除">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#F0F0F0] bg-[#F6F7F8]">
                <span className="text-[11px] text-[#9A9A9A]">第 {page}/{totalPages} 页，共 {filtered.length} 条</span>
                <div className="flex gap-1">
                  <button onClick={() => goTo(page - 1)} disabled={page <= 1} className="px-2.5 py-1 text-[12px] border border-[#E7E7EB] rounded-[3px] disabled:opacity-30 hover:bg-white">
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => goTo(p)} className={`px-3 py-1 text-[12px] rounded-[3px] ${p === page ? 'bg-[#02A7F0] text-white' : 'border border-[#E7E7EB] hover:bg-white text-[#353535]'}`}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => goTo(page + 1)} disabled={page >= totalPages} className="px-2.5 py-1 text-[12px] border border-[#E7E7EB] rounded-[3px] disabled:opacity-30 hover:bg-white">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 删除确认 */}
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="确认删除"
          message="删除后将无法恢复，确认删除此题目吗？"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </AppLayout>
  )
}
