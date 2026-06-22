import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Search, Filter, Edit, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePagination } from '../lib/useApi'
import { EmptyState } from '../components/StateComponents'
import ConfirmDialog from '../components/ConfirmDialog'

interface LessonPlan {
  id: string
  lesson_title: string
  subject: string
  grade: string
  status: 'draft' | 'final'
  updated_at: string
  format_template: string
}

const MOCK_PLANS: LessonPlan[] = [
  { id: '1', lesson_title: '《观潮》第一课时', subject: '语文', grade: '四年级', status: 'final', updated_at: '2026-06-17 14:30', format_template: 'core_literacy' },
  { id: '2', lesson_title: '分数的意义和性质', subject: '数学', grade: '三年级', status: 'final', updated_at: '2026-06-17 10:15', format_template: 'core_literacy' },
  { id: '3', lesson_title: 'Unit 3 My School - 阅读课', subject: '英语', grade: '五年级', status: 'draft', updated_at: '2026-06-16 16:00', format_template: '3d_objective' },
  { id: '4', lesson_title: '《荷花》赏析与仿写', subject: '语文', grade: '三年级', status: 'draft', updated_at: '2026-06-15 09:20', format_template: 'core_literacy' },
  { id: '5', lesson_title: '小数加减法练习课', subject: '数学', grade: '四年级', status: 'final', updated_at: '2026-06-14 11:45', format_template: 'unit_teaching' },
  { id: '6', lesson_title: '《草船借箭》精读', subject: '语文', grade: '五年级', status: 'draft', updated_at: '2026-06-13 15:30', format_template: 'core_literacy' },
  { id: '7', lesson_title: '长方形和正方形面积', subject: '数学', grade: '三年级', status: 'final', updated_at: '2026-06-12 08:00', format_template: 'core_literacy' },
  { id: '8', lesson_title: 'Unit 5 Weather - 对话课', subject: '英语', grade: '四年级', status: 'draft', updated_at: '2026-06-11 13:20', format_template: '3d_objective' },
]

const subjectColors: Record<string, string> = {
  '语文': 'bg-blue-100 text-blue-700',
  '数学': 'bg-orange-100 text-orange-700',
  '英语': 'bg-green-100 text-green-700',
}

export default function LessonPlanList() {
  const navigate = useNavigate()
  const [plans] = useState<LessonPlan[]>(MOCK_PLANS)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // P2: 删除确认
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const filtered = plans.filter(p => {
    if (searchTerm && !p.lesson_title.includes(searchTerm)) return false
    if (filterSubject && p.subject !== filterSubject) return false
    if (filterStatus && p.status !== filterStatus) return false
    return true
  })

  // P2: 分页
  const { page, totalPages, paginated, goTo } = usePagination(filtered, 8)

  const handleDelete = () => {
    if (deleteTarget) {
      // TODO: 调用 API 删除
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">教案备课</h1>
          <p className="text-sm text-gray-500 mt-1">管理您的所有教案，支持 AI 生成和手动编辑</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/lesson-plans/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1A3A6B] text-white rounded-lg hover:bg-[#2B5DA8] transition-colors shadow-sm"
        >
          <Plus size={18} />
          新建教案
        </button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="plan-search"
            type="text"
            placeholder="搜索教案标题..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); goTo(1) }}
          />
        </div>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20"
          value={filterSubject}
          onChange={e => { setFilterSubject(e.target.value); goTo(1) }}
        >
          <option value="">全部学科</option>
          <option value="语文">语文</option>
          <option value="数学">数学</option>
          <option value="英语">英语</option>
        </select>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20"
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); goTo(1) }}
        >
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="final">已定稿</option>
        </select>
        <button className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          <Filter size={14} /> 更多筛选
        </button>
      </div>

      {/* 统计条 */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>共 {filtered.length} 份教案</span>
        <span className="w-1 h-1 bg-gray-300 rounded-full" />
        <span>已定稿 {filtered.filter(p => p.status === 'final').length} 份</span>
        <span className="w-1 h-1 bg-gray-300 rounded-full" />
        <span>草稿 {filtered.filter(p => p.status === 'draft').length} 份</span>
      </div>

      {/* 教案列表 */}
      {filtered.length === 0 ? (
        <EmptyState title="暂无匹配的教案" description="尝试调整搜索条件或新建一份教案" action={{ label: '新建教案', onClick: () => navigate('/dashboard/lesson-plans/new') }} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">教案标题</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">学科</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">年级</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">模板</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">更新时间</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(plan => (
                  <tr key={plan.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900">{plan.lesson_title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${subjectColors[plan.subject]}`}>
                        {plan.subject}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{plan.grade}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {plan.format_template === 'core_literacy' ? '核心素养' : plan.format_template === '3d_objective' ? '三维目标' : '单元教学'}
                    </td>
                    <td className="px-4 py-3">
                      {plan.status === 'final' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> 已定稿
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700">
                          <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" /> 草稿
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{plan.updated_at}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/dashboard/lesson-plans/${plan.id}/edit`)} className="p-1.5 text-gray-400 hover:text-brand hover:bg-blue-50 rounded" title="编辑">
                          <Edit size={15} />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="预览">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(plan.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded" title="删除">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* P2: 分页控件 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">第 {page}/{totalPages} 页，共 {filtered.length} 条</span>
              <div className="flex gap-1">
                <button onClick={() => goTo(page - 1)} disabled={page <= 1} className="px-2.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-30 hover:bg-white">
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => goTo(p)} className={`px-3 py-1 text-xs border rounded ${p === page ? 'bg-brand text-white border-brand' : 'border-gray-200 hover:bg-white'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => goTo(page + 1)} disabled={page >= totalPages} className="px-2.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-30 hover:bg-white">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* P2: 删除确认弹窗 */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="确认删除"
        message="删除后将无法恢复，确认删除此教案吗？"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
