import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSearch, CheckCircle, Clock, AlertTriangle, User } from 'lucide-react'
import { usePagination } from '../lib/useApi'
import { EmptyState } from '../components/StateComponents'

const MOCK_REVIEWS = [
  { id: '1', plan_title: '《观潮》第一课时', author: '张老师', grade: '四年级', subject: '语文', status: 'pending', submitted_at: '2026-06-18 09:00', reviewers: 0 },
  { id: '2', plan_title: '分数的意义和性质', author: '李老师', grade: '三年级', subject: '数学', status: 'reviewing', submitted_at: '2026-06-17 14:00', reviewers: 1 },
  { id: '3', plan_title: 'Unit 3 My School', author: '王老师', grade: '五年级', subject: '英语', status: 'pending', submitted_at: '2026-06-19 10:00', reviewers: 0 },
  { id: '4', plan_title: '《桂花雨》第二课时', author: '赵老师', grade: '五年级', subject: '语文', status: 'completed', submitted_at: '2026-06-16 08:00', reviewers: 2 },
]

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待评审', color: 'bg-yellow-50 text-yellow-600' },
  reviewing: { label: '评审中', color: 'bg-blue-50 text-blue-600' },
  completed: { label: '已完成', color: 'bg-green-50 text-green-600' },
}

export default function ReviewList() {
  const navigate = useNavigate()
  const [filterStatus, setFilterStatus] = useState('')

  const filtered = MOCK_REVIEWS.filter(r => !filterStatus || r.status === filterStatus)
  const { page, totalPages, paginated, goTo } = usePagination(filtered, 8)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">教案互审</h1>
          <p className="text-sm text-gray-500 mt-1">同事评审教案，提升教学质量</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: '待我评审', value: '2', icon: Clock, color: 'text-orange-600 bg-orange-50' },
          { label: '我已提交', value: '1', icon: FileSearch, color: 'text-blue-600 bg-blue-50' },
          { label: '评审中', value: '1', icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50' },
          { label: '已完成', value: '5', icon: CheckCircle, color: 'text-green-600 bg-green-50' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{card.label}</span>
              <div className={`p-1.5 rounded-lg ${card.color}`}><card.icon size={16} /></div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200">
        <span className="text-xs text-gray-500">筛选：</span>
        {['', 'pending', 'reviewing', 'completed'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${filterStatus === s ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === '' ? '全部' : statusMap[s]?.label || s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="暂无互审记录" description="还没有提交互审的教案" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">教案</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">作者</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">学科/年级</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">提交时间</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">状态</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.plan_title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600"><User size={12} className="inline mr-1" />{r.author}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.grade} · {r.subject}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.submitted_at}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusMap[r.status]?.color}`}>{statusMap[r.status]?.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => navigate(`/dashboard/review/${r.id}`)} className="px-3 py-1 text-xs bg-brand text-white rounded-lg hover:bg-brand-hover">开始评审</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
              <span>第 {page}/{totalPages} 页</span>
              <div className="flex gap-1">
                <button onClick={() => goTo(page - 1)} disabled={page <= 1} className="px-2 py-0.5 border rounded disabled:opacity-30 hover:bg-white">上一页</button>
                <button onClick={() => goTo(page + 1)} disabled={page >= totalPages} className="px-2 py-0.5 border rounded disabled:opacity-30 hover:bg-white">下一页</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
