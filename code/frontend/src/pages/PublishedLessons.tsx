import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Search, Trash2, Eye, Copy, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePagination } from '../lib/useApi'
import { EmptyState } from '../components/StateComponents'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTeaching } from '@/lib/TeachingContext'
import { api, lessonPlanAPI, notifyError } from '../lib/api'
import AppLayout from '../components/AppLayout'

interface LessonPlan {
  id: string
  lesson_title: string
  subject: string
  grade: string
  school_year?: string
  status: 'final'
  review_status: 'reviewing' | 'approved' | 'rejected'
  updated_at: string
  format_template: string
}

const MOCK_PUBLISHED: LessonPlan[] = [
  { id: '1', lesson_title: '《观潮》第一课时', subject: '语文', grade: '四年级', school_year: '2025-2026', status: 'final', review_status: 'approved', updated_at: '2026-06-17 14:30', format_template: 'core_literacy' },
  { id: '5', lesson_title: '小数加减法练习课', subject: '数学', grade: '四年级', status: 'final', review_status: 'approved', updated_at: '2026-06-14 11:45', format_template: 'unit_teaching' },
  { id: '7', lesson_title: '长方形和正方形面积', subject: '数学', grade: '三年级', status: 'final', review_status: 'approved', updated_at: '2026-06-12 08:00', format_template: 'core_literacy' },
  { id: '9', lesson_title: 'Unit 2 My Family - 词汇课', subject: '英语', grade: '四年级', status: 'final', review_status: 'reviewing', updated_at: '2026-06-10 09:30', format_template: '3d_objective' },
  { id: '10', lesson_title: '《忆江南》古诗赏析', subject: '语文', grade: '四年级', status: 'final', review_status: 'reviewing', updated_at: '2026-06-08 16:00', format_template: 'core_literacy' },
  { id: '11', lesson_title: '三角形内角和', subject: '数学', grade: '四年级', status: 'final', review_status: 'rejected', updated_at: '2026-06-05 11:00', format_template: 'core_literacy' },
  { id: '12', lesson_title: 'Unit 4 At the Farm - 听说课', subject: '英语', grade: '四年级', status: 'final', review_status: 'approved', updated_at: '2026-06-03 13:20', format_template: '3d_objective' },
  { id: '2', lesson_title: '分数的意义和性质', subject: '数学', grade: '三年级', status: 'final', review_status: 'approved', updated_at: '2026-06-17 10:15', format_template: 'core_literacy' },
]

const subjectColors: Record<string, string> = {
  '语文': 'bg-blue-50 text-blue-600',
  '数学': 'bg-orange-50 text-orange-600',
  '英语': 'bg-green-50 text-green-600',
}

const GRADE_MAP: Record<number, string> = { 1:'一年级',2:'二年级',3:'三年级',4:'四年级',5:'五年级',6:'六年级',7:'七年级',8:'八年级',9:'九年级' }

export default function PublishedLessons() {
  const navigate = useNavigate()
  const teaching = useTeaching()
  const [plans, setPlans] = useState<LessonPlan[]>([])
  useEffect(() => {
    api<{ items: any[] }>('/lesson-plans').then(res => {
      setPlans(res.items.filter(r => r.status === 'final').map(r => ({
        id: r.id, lesson_title: r.title || r.lesson_title, subject: r.subject, grade: r.grade,
        school_year: r.created_at?.slice(0,4) || '', status: r.status,
        review_status: r.review_status || 'none', updated_at: r.updated_at,
        format_template: r.template_type || '',
      })))
    }).catch((e) => notifyError('已发布教案加载失败', e))
  }, [])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterReview, setFilterReview] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const classFiltered = useMemo(() => {
    const gradeStr = GRADE_MAP[teaching.grade] || ''
    return plans.filter(p => p.subject === teaching.subject && p.grade === gradeStr)
  }, [plans, teaching.subject, teaching.grade])

  const filtered = classFiltered.filter(p => {
    if (searchTerm && !p.lesson_title.includes(searchTerm)) return false
    if (filterSubject && p.subject !== filterSubject) return false
    if (filterYear && p.school_year !== filterYear) return false
    if (filterReview && p.review_status !== filterReview) return false
    return true
  })

  const { page, totalPages, paginated, goTo } = usePagination(filtered, 8)

  const handleReference = (plan: LessonPlan) => {
    // 引用创建：跳转到新建页面，通过 URL 参数传递引用源
    window.open(`/lesson-plans/new?ref=${plan.id}`, '_blank')
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#353535]">教案发布库</h1>
            <p className="text-[11px] text-[#9A9A9A] mt-0.5">已定稿的正式教案，可预览、引用创建新教案，不可编辑</p>
          </div>
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
          <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部学科</option>
            <option value="语文">语文</option>
            <option value="数学">数学</option>
            <option value="英语">英语</option>
          </select>
          <select value={filterYear} onChange={e => { setFilterYear(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部学年</option>
            <option value="2025-2026">2025-2026</option>
            <option value="2026-2027">2026-2027</option>
          </select>
          <select value={filterReview} onChange={e => { setFilterReview(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部状态</option>
            <option value="approved">已通过</option>
            <option value="reviewing">待审核</option>
            <option value="rejected">需修改</option>
          </select>
        </div>

        {/* 统计条 */}
        <div className="flex items-center gap-3 text-[12px] text-[#9A9A9A]">
          <span>共 {filtered.length} 份已发布教案</span>
          <span className="text-[#E7E7EB]">|</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> {teaching.subject} · {GRADE_MAP[teaching.grade] || '四年级'}
          </span>
        </div>

        {/* 教案表格 */}
        {filtered.length === 0 ? (
          <EmptyState title="暂无已发布的教案" description="在草稿箱中完成编写后，发布到发布库即可在此查看" action={{ label: '前往草稿箱', onClick: () => navigate('/lesson-plans') }} />
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
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">评审</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">更新时间</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase w-[100px]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {paginated.map(plan => (
                    <tr key={plan.id} className="hover:bg-[#F9FAFB] transition-colors group">
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
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {plan.review_status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] bg-green-50 text-green-600">已通过</span>
                        ) : plan.review_status === 'reviewing' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] bg-blue-50 text-blue-600">待审核</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] bg-orange-50 text-orange-600">需修改</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#9A9A9A] hidden lg:table-cell">{plan.updated_at}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-100 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); handleReference(plan) }} className="p-1.5 text-[#9A9A9A] hover:text-[#722ED1] hover:bg-purple-50 rounded-[3px]" title="引用创建新教案">
                            <Copy size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); window.open(`/lesson-plans/${plan.id}`, '_blank') }} className="p-1.5 text-[#9A9A9A] hover:text-[#353535] hover:bg-gray-100 rounded-[3px]" title="查看">
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
        {deleteTarget && (
          <ConfirmDialog
            open={!!deleteTarget}
            title="确认删除"
            message="删除后教案将移至回收站，30天内可恢复。"
            onConfirm={() => { if (deleteTarget) { lessonPlanAPI.delete(deleteTarget).catch((e) => notifyError('删除教案失败', e)); setDeleteTarget(null) } }}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>
    </AppLayout>
  )
}
