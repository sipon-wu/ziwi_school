import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Plus, Search, Calendar, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePagination } from '../lib/useApi'
import { EmptyState } from '../components/StateComponents'

const MOCK_EXERCISES = [
  { id: '1', title: '分数加减法练习', subject: '数学', class: '三年级2班', type: 'exercise', difficulty: 'L2', questions: 10, due_date: '2026-06-20', submitted: 35, total: 40 },
  { id: '2', title: '《观潮》课后练习', subject: '语文', class: '四年级1班', type: 'exercise', difficulty: 'L1', questions: 8, due_date: '2026-06-19', submitted: 28, total: 38 },
  { id: '3', title: 'Unit 3 词汇练习', subject: '英语', class: '五年级3班', type: 'writing_game', difficulty: 'L2', questions: 15, due_date: '2026-06-21', submitted: 20, total: 42 },
]

export default function ExerciseList() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')

  const filtered = MOCK_EXERCISES.filter(item => {
    if (searchTerm && !item.title.includes(searchTerm)) return false
    if (filterSubject && item.subject !== filterSubject) return false
    if (filterDifficulty && item.difficulty !== filterDifficulty) return false
    return true
  })

  const { page, totalPages, paginated, goTo } = usePagination(filtered, 8)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">出题组卷</h1>
          <p className="text-sm text-gray-500 mt-1">AI 自动生成练习题，支持选择/填空/计算三种题型</p>
        </div>
        <button onClick={() => navigate('/dashboard/exercises/new')} className="flex items-center gap-2 px-4 py-2.5 bg-[#1A3A6B] text-white rounded-lg hover:bg-[#2B5DA8] transition-colors shadow-sm">
          <Plus size={18} /> 新建出题
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '本月出题', value: '12', sub: '份试卷', icon: FileSpreadsheet, color: 'bg-blue-50 text-blue-600' },
          { label: '平均提交率', value: '92%', sub: '较上月↑3%', icon: CheckCircle, color: 'bg-green-50 text-green-600' },
          { label: '待批阅', value: '15', sub: '份作业', icon: Clock, color: 'bg-orange-50 text-orange-600' },
          { label: '即将截止', value: '3', sub: '份作业', icon: Calendar, color: 'bg-red-50 text-red-600' },
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

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input id="ex-search" type="text" placeholder="搜索作业..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); goTo(1) }} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20" />
        </div>
        <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); goTo(1) }} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">
          <option value="">全部学科</option><option>语文</option><option>数学</option><option>英语</option>
        </select>
        <select value={filterDifficulty} onChange={e => { setFilterDifficulty(e.target.value); goTo(1) }} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">
          <option value="">全部难度</option><option value="L1">L1-基础</option><option value="L2">L2-中等</option><option value="L3">L3-提高</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="暂无匹配的习题" description="尝试调整搜索条件或新建一份出题" action={{ label: '新建出题', onClick: () => navigate('/dashboard/exercises/new') }} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">作业标题</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">学科</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">班级</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">难度</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">截止日期</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">提交进度</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => navigate(`/dashboard/grading/${item.id}`)}>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">{item.title}</span>
                      <span className="ml-2 text-xs text-gray-400">({item.questions}题)</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${item.subject === '语文' ? 'bg-blue-100 text-blue-700' : item.subject === '数学' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{item.subject}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.class}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${item.difficulty === 'L1' ? 'bg-green-50 text-green-600' : item.difficulty === 'L2' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>{item.difficulty}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.due_date}</td>
                    <td className="px-4 py-3"><div className="flex items-center justify-center gap-2"><div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${(item.submitted/item.total)*100}%` }} /></div><span className="text-xs text-gray-500">{item.submitted}/{item.total}</span></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">第 {page}/{totalPages} 页</span>
              <div className="flex gap-1">
                <button onClick={() => goTo(page - 1)} disabled={page <= 1} className="px-2.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-30 hover:bg-white"><ChevronLeft size={14} /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => goTo(p)} className={`px-3 py-1 text-xs border rounded ${p === page ? 'bg-brand text-white border-brand' : 'border-gray-200 hover:bg-white'}`}>{p}</button>
                ))}
                <button onClick={() => goTo(page + 1)} disabled={page >= totalPages} className="px-2.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-30 hover:bg-white"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
