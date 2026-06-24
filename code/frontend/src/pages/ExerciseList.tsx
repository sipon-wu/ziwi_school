import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Plus, Search, Calendar, CheckCircle, Clock, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import { usePagination } from '../lib/useApi'
import { EmptyState } from '../components/StateComponents'
import { assignmentAPI } from '../lib/api'

type AssignmentItem = {
  id: string
  title: string
  subject: string
  class_id: string
  class_name?: string
  type: string
  difficulty_level: string
  questions: string // JSONB
  due_date?: string
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  exercise: '课堂练习', homework: '课后作业', exam: '试卷/考试',
  composition: '作文', writing_game: '写作游戏',
}

export default function ExerciseList() {
  const navigate = useNavigate()
  const [items, setItems] = useState<AssignmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await assignmentAPI.list()
      // 解析 questions 数量
      const data = (res.items || []).map((a: AssignmentItem) => {
        let qCount = 0
        try { qCount = JSON.parse(a.questions || '[]').length } catch {}
        return { ...a, question_count: qCount }
      })
      setItems(data)
    } catch (e) { console.error('获取作业列表失败', e) }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const filtered = items.filter(item => {
    if (searchTerm && !item.title.includes(searchTerm)) return false
    if (filterSubject && item.subject !== filterSubject) return false
    if (filterDifficulty && item.difficulty_level !== filterDifficulty) return false
    return true
  })

  const { page, totalPages, paginated, goTo } = usePagination(filtered, 8)

  const questionCount = (item: any) => item.question_count || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">出题组卷</h1>
          <p className="text-sm text-gray-500 mt-1">管理作业、试卷和练习题</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/dashboard/question-bank')} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm">
            <BookOpen size={16} /> 题库
          </button>
          <button onClick={() => navigate('/dashboard/exercises/new')} className="flex items-center gap-2 px-4 py-2.5 bg-[#1A3A6B] text-white rounded-lg hover:bg-[#2B5DA8] transition-colors shadow-sm">
            <Plus size={18} /> 新建出题
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: '作业总数', value: String(items.length), sub: '份', icon: FileSpreadsheet, color: 'bg-blue-50 text-blue-600' },
          { label: '本月新增', value: String(items.filter(i => {
            const d = new Date(i.created_at)
            return d.getMonth() === new Date().getMonth()
          }).length), sub: '份', icon: CheckCircle, color: 'bg-green-50 text-green-600' },
          { label: '课堂练习', value: String(items.filter(i => i.type === 'exercise').length), sub: '份', icon: Clock, color: 'bg-orange-50 text-orange-600' },
          { label: '试卷/考试', value: String(items.filter(i => i.type === 'exam').length), sub: '份', icon: Calendar, color: 'bg-purple-50 text-purple-600' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{card.label}</span>
              <div className={`p-1.5 rounded-lg ${card.color}`}><card.icon size={16} /></div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-xs text-gray-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 搜索过滤 */}
      <div className="flex flex-wrap items-center gap-2 lg:gap-3 bg-white p-3 rounded-xl border border-gray-200">
        <div className="flex-1 relative min-w-[140px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="搜索作业标题..." value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); goTo(1) }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20" />
        </div>
        <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); goTo(1) }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">
          <option value="">全部学科</option><option>语文</option><option>数学</option><option>英语</option>
        </select>
        <select value={filterDifficulty} onChange={e => { setFilterDifficulty(e.target.value); goTo(1) }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">
          <option value="">全部难度</option><option value="L1">L1-基础</option><option value="L2">L2-中等</option><option value="L3">L3-提高</option>
        </select>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">加载中...</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="暂无作业" description="创建你的第一份AI出题" action={{ label: '新建出题', onClick: () => navigate('/dashboard/exercises/new') }} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 lg:px-4 py-3 text-xs font-semibold text-gray-500 uppercase">作业标题</th>
                  <th className="text-left px-3 lg:px-4 py-3 text-xs font-semibold text-gray-500 uppercase">学科</th>
                  <th className="text-left px-3 lg:px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">类型</th>
                  <th className="text-left px-3 lg:px-4 py-3 text-xs font-semibold text-gray-500 uppercase">难度</th>
                  <th className="text-center px-3 lg:px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">题目数</th>
                  <th className="text-left px-3 lg:px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">创建时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50 cursor-pointer"
                    onClick={() => navigate(`/dashboard/grading/${item.id}`)}>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">{item.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        item.subject === '语文' ? 'bg-blue-100 text-blue-700' :
                        item.subject === '数学' ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}>{item.subject}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{TYPE_LABELS[item.type] || item.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        item.difficulty_level === 'L1' ? 'bg-green-50 text-green-600' :
                        item.difficulty_level === 'L2' ? 'bg-yellow-50 text-yellow-600' :
                        'bg-red-50 text-red-600'
                      }`}>{item.difficulty_level || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600 hidden lg:table-cell">{questionCount(item)}题</td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">第 {page}/{totalPages} 页</span>
              <div className="flex gap-1">
                <button onClick={() => goTo(page - 1)} disabled={page <= 1}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-30 hover:bg-white">
                  <ChevronLeft size={14} /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => goTo(p)}
                    className={`px-3 py-1 text-xs border rounded ${p === page ? 'bg-brand text-white border-brand' : 'border-gray-200 hover:bg-white'}`}>{p}</button>
                ))}
                <button onClick={() => goTo(page + 1)} disabled={page >= totalPages}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-30 hover:bg-white">
                  <ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
