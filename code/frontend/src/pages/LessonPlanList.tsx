import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Search, Edit, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePagination } from '../lib/useApi'
import { EmptyState } from '../components/StateComponents'
import ConfirmDialog from '../components/ConfirmDialog'
import { api, lessonPlanAPI } from '../lib/api'
import AppLayout from '../components/AppLayout'

interface LessonPlan {
  id: string
  lesson_title: string
  subject: string
  grade: string
  school_year?: string
  status: 'draft' | 'final'
  updated_at: string
  format_template: string
}

const _MOCK_PLANS: LessonPlan[] = [
  { id: '1', lesson_title: '《观潮》第一课时', subject: '语文', grade: '四年级', school_year: '2025-2026', status: 'final', updated_at: '2026-06-17 14:30', format_template: 'core_literacy' },
  { id: '2', lesson_title: '分数的意义和性质', subject: '数学', grade: '三年级', status: 'final', updated_at: '2026-06-17 10:15', format_template: 'core_literacy' },
  { id: '3', lesson_title: 'Unit 3 My School - 阅读课', subject: '英语', grade: '五年级', status: 'draft', updated_at: '2026-06-16 16:00', format_template: '3d_objective' },
  { id: '4', lesson_title: '《荷花》赏析与仿写', subject: '语文', grade: '三年级', status: 'draft', updated_at: '2026-06-15 09:20', format_template: 'core_literacy' },
  { id: '5', lesson_title: '小数加减法练习课', subject: '数学', grade: '四年级', status: 'final', updated_at: '2026-06-14 11:45', format_template: 'unit_teaching' },
  { id: '6', lesson_title: '《草船借箭》精读', subject: '语文', grade: '五年级', status: 'draft', updated_at: '2026-06-13 15:30', format_template: 'core_literacy' },
  { id: '7', lesson_title: '长方形和正方形面积', subject: '数学', grade: '三年级', status: 'final', updated_at: '2026-06-12 08:00', format_template: 'core_literacy' },
  { id: '8', lesson_title: 'Unit 5 Weather - 对话课', subject: '英语', grade: '四年级', status: 'draft', updated_at: '2026-06-11 13:20', format_template: '3d_objective' },
]

const subjectColors: Record<string, string> = {
  '语文': 'bg-blue-50 text-blue-600',
  '数学': 'bg-orange-50 text-orange-600',
  '英语': 'bg-green-50 text-green-600',
}

const GRADE_MAP: Record<number, string> = { 1:'一年级',2:'二年级',3:'三年级',4:'四年级',5:'五年级',6:'六年级',7:'七年级',8:'八年级',9:'九年级' }

export default function LessonPlanList() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<LessonPlan[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [_loading, setLoading] = useState(true)

  useEffect(() => {
    api<{ items: any[] }>('/lesson-plans').then(res => {
      setPlans(res.items.map((r: any) => ({
        id: r.id, lesson_title: r.title, subject: r.subject, grade: r.grade,
        school_year: r.created_at?.slice(0,4) || '', status: r.status,
        review_status: r.review_status || 'none', updated_at: r.updated_at,
        format_template: r.template_type || '',
      })))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // 草稿箱展示教师本人的全部教案；学科/年级仅作可选筛选（默认全部），不再按全局教学上下文硬藏
  const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理']
  const GRADES = Object.values(GRADE_MAP)

  const filtered = plans.filter(p => {
    if (searchTerm && !p.lesson_title.includes(searchTerm)) return false
    if (filterStatus && p.status !== filterStatus) return false
    if (filterYear && p.school_year !== filterYear) return false
    if (filterSubject && p.subject !== filterSubject) return false
    if (filterGrade && p.grade !== filterGrade) return false
    return true
  })

  const { page, totalPages, paginated, goTo } = usePagination(filtered, 8)

  const handleDelete = () => {
    if (deleteTarget) {
      lessonPlanAPI.delete(deleteTarget).catch(e => console.error('delete failed', e))
      setPlans(prev => prev.filter(p => p.id !== deleteTarget))
      setDeleteTarget(null)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#353535]">教案草稿箱</h1>
            <p className="text-[11px] text-[#9A9A9A] mt-0.5">管理您的所有教案，支持 AI 生成和手动编辑</p>
          </div>
          <button
            onClick={() => navigate('/lesson-plans/new')}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors"
          >
            <Plus size={16} /> 新建教案
          </button>
        </div>

        {/* 搜索 + 筛选 */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 relative min-w-[140px] max-w-[280px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              type="text" placeholder="搜索教案标题..." value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); goTo(1) }}
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]"
            />
          </div>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="final">已定稿</option>
          </select>
          <select value={filterYear} onChange={e => { setFilterYear(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部学年</option>
            <option value="2025-2026">2025-2026</option>
            <option value="2026-2027">2026-2027</option>
          </select>
          <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部学科</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterGrade} onChange={e => { setFilterGrade(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部年级</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {/* 统计条 */}
        <div className="flex items-center gap-3 text-[12px] text-[#9A9A9A]">
          <span>共 {filtered.length} 份教案</span>
          <span className="text-[#E7E7EB]">|</span>
          <span>已定稿 {filtered.filter(p => p.status === 'final').length} 份</span>
          <span className="text-[#E7E7EB]">|</span>
          <span>草稿 {filtered.filter(p => p.status === 'draft').length} 份</span>
        </div>

        {/* 教案表格 */}
        {filtered.length === 0 ? (
          <EmptyState title="暂无匹配的教案" description="尝试调整搜索条件或新建一份教案" action={{ label: '新建教案', onClick: () => navigate('/lesson-plans/new') }} />
        ) : (
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F6F7F8] border-b border-[#E7E7EB]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">教案标题</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">学科</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">年级</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">模板</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">状态</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">更新时间</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {paginated.map(plan => (
                    <tr key={plan.id} onClick={() => navigate(`/lesson-plans/${plan.id}/view`)} className="hover:bg-[#F9FAFB] transition-colors cursor-pointer group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <BookOpen size={14} className="text-[#9A9A9A] shrink-0" />
                          <span className="text-[13px] font-medium text-[#353535]">{plan.lesson_title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-[3px] text-[11px] font-medium ${subjectColors[plan.subject] || 'bg-gray-50 text-gray-500'}`}>
                          {plan.subject}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#353535] hidden lg:table-cell">{plan.grade}</td>
                      <td className="px-4 py-3 text-[12px] text-[#9A9A9A] hidden lg:table-cell">
                        {plan.format_template === 'core_literacy' ? '核心素养' : plan.format_template === '3d_objective' ? '三维目标' : '单元教学'}
                      </td>
                      <td className="px-4 py-3">
                        {plan.status === 'final' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-green-50 text-green-600">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> 已定稿
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-yellow-50 text-yellow-600">
                            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" /> 草稿
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#9A9A9A] hidden lg:table-cell">{plan.updated_at}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/lesson-plans/${plan.id}/edit`) }} className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title="编辑">
                            <Edit size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/lesson-plans/${plan.id}/view`) }} className="p-1.5 text-[#9A9A9A] hover:text-[#353535] hover:bg-gray-100 rounded-[3px]" title="查看">
                            <Eye size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(plan.id) }} className="p-1.5 text-[#9A9A9A] hover:text-[#FF4D4F] hover:bg-red-50 rounded-[3px]" title="删除">
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
          message="删除后将无法恢复，确认删除此教案吗？"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </AppLayout>
  )
}
