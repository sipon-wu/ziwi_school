import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Eye, ChevronLeft, ChevronRight, Files } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePagination } from '../lib/useApi'
import { EmptyState } from '../components/StateComponents'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTeaching } from '../lib/TeachingContext'
import { api, notifyError } from '../lib/api'
import AppLayout from '../components/AppLayout'
import ExamPreview, { type ExamQuestion, type ExamMeta } from '../components/ExamPreview'

interface ExamItem {
  id: string
  title: string
  subject: string
  grade: string
  question_count: number
  total_score: number
  status: 'draft' | 'published'
  updated_at: string
}

const MOCK_EXAMS: ExamItem[] = [
  { id: 'e1', title: '四年级语文第一单元检测', subject: '语文', grade: '四年级', question_count: 15, total_score: 100, status: 'published', updated_at: '2026-07-03 10:30' },
  { id: 'e2', title: '四年级语文期中考试卷', subject: '语文', grade: '四年级', question_count: 25, total_score: 100, status: 'published', updated_at: '2026-06-25 14:00' },
  { id: 'e3', title: '《观潮》课内阅读练习', subject: '语文', grade: '四年级', question_count: 8, total_score: 50, status: 'draft', updated_at: '2026-07-04 09:15' },
  { id: 'e4', title: '修辞手法专项训练', subject: '语文', grade: '四年级', question_count: 10, total_score: 60, status: 'draft', updated_at: '2026-07-01 16:45' },
  { id: 'e5', title: '阅读理解综合测试', subject: '语文', grade: '四年级', question_count: 12, total_score: 80, status: 'published', updated_at: '2026-06-28 11:20' },
  { id: 'e6', title: '写作专项练习卷', subject: '语文', grade: '四年级', question_count: 3, total_score: 100, status: 'draft', updated_at: '2026-06-30 08:00' },
]

const GRADE_MAP: Record<number, string> = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级', 7: '七年级', 8: '八年级', 9: '九年级' }

export default function ExamList() {
  const navigate = useNavigate()
  const teaching = useTeaching()
  const [exams, setExams] = useState<ExamItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<{ questions: ExamQuestion[]; meta: ExamMeta } | null>(null)

  useEffect(() => {
    api<{ items: any[] }>('/exams').then(res => {
      setExams(res.items.map((e: any) => {
        const qArr = typeof e.questions === 'string' ? JSON.parse(e.questions || '[]') : (e.questions || [])
        return {
          id: e.id, title: e.title, subject: e.subject, grade: e.grade,
          question_count: Array.isArray(qArr) ? qArr.length : 0,
          total_score: e.total_score || 100, status: e.status,
          updated_at: e.updated_at?.slice(0, 16).replace('T', ' ') || '',
        }
      }))
    }).catch((e) => notifyError('试卷列表加载失败', e))
  }, [])

  const classFiltered = useMemo(() => {
    const gradeStr = GRADE_MAP[teaching.grade] || ''
    return exams.filter(e => e.subject === teaching.subject && e.grade === gradeStr)
  }, [exams, teaching.subject, teaching.grade])

  const filtered = classFiltered.filter(e => {
    if (searchTerm && !e.title.includes(searchTerm)) return false
    if (filterStatus && e.status !== filterStatus) return false
    return true
  })

  const { page, totalPages, paginated, goTo } = usePagination(filtered, 8)

  const handleDelete = () => {
    if (deleteTarget) {
      const tok = localStorage.getItem('zhiwei_token')
      fetch('/api/exams/' + deleteTarget, {
        method: 'DELETE', headers: { 'Authorization': 'Bearer ' + tok },
      }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status) }).catch(e => console.error('delete failed', e))
      setDeleteTarget(null)
    }
  }

  const handlePreview = async (e: ExamItem) => {
    try {
      const res = await api<{ questions: string; title: string; subject: string; grade: string; total_score: number; duration_minutes: number }>(`/exams/${e.id}`)
      const parsed = typeof res.questions === 'string' ? JSON.parse(res.questions || '[]') : (res.questions || [])
      setPreviewData({
        questions: parsed.filter((q: any) => q.stem || q.content).map((q: any) => ({
          id: q.id || '', stem: q.stem || q.content || '', type: q.type || 'choice',
          options: q.options || '', answer: q.answer || '', analysis: q.analysis || '',
          difficulty: q.difficulty, score: q.score, sort: q.sort,
        })),
        meta: { title: res.title || e.title, subject: res.subject || e.subject, grade: res.grade || e.grade, totalScore: res.total_score || e.total_score, durationMinutes: res.duration_minutes },
      })
    } catch { /* fallback: open editor */ window.open(`/exams/${e.id}`, '_blank') }
  }

  const handleRowClick = (e: ExamItem) => {
    window.open(`/exams/${e.id}/edit`, '_blank')
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#353535]">组卷·试卷库</h1>
            <p className="text-[11px] text-[#9A9A9A] mt-0.5">从个人和校本题库中选题组卷，支持 AI 智能配题</p>
          </div>
          <button
            onClick={() => window.open('/exams/new', '_blank')}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors"
          >
            <Plus size={16} /> 新建试卷
          </button>
        </div>

        <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 relative min-w-[140px] max-w-[280px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input type="text" placeholder="搜索试卷标题..." value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); goTo(1) }}
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" />
          </div>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </select>
          <select value={filterType} onChange={e => { setFilterType(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部类型</option>
            <option value="unit">单元检测</option>
            <option value="midterm">期中考试</option>
            <option value="exercise">课堂练习</option>
          </select>
        </div>

        <div className="flex items-center gap-3 text-[12px] text-[#9A9A9A]">
          <span>共 {filtered.length} 份试卷</span>
          <span className="text-[#E7E7EB]">|</span>
          <span>已发布 {filtered.filter(e => e.status === 'published').length} 份</span>
          <span className="text-[#E7E7EB]">|</span>
          <span>草稿 {filtered.filter(e => e.status === 'draft').length} 份</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="暂无匹配的试卷" description="尝试调整搜索条件或新建一份试卷" action={{ label: '新建试卷', onClick: () => window.open('/exams/new', '_blank') }} />
        ) : (
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F6F7F8] border-b border-[#E7E7EB]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">试卷标题</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">年级</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">题量</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">总分</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">状态</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">更新时间</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {paginated.map(e => (
                    <tr key={e.id} onClick={() => handleRowClick(e)} className="hover:bg-[#F9FAFB] transition-colors cursor-pointer group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Files size={14} className="text-[#9A9A9A] shrink-0" />
                          <span className="text-[13px] font-medium text-[#353535]">{e.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#353535] hidden lg:table-cell">{e.grade}</td>
                      <td className="px-4 py-3 text-[13px] text-[#353535]">{e.question_count} 题</td>
                      <td className="px-4 py-3 text-[13px] text-[#353535] hidden lg:table-cell">{e.total_score} 分</td>
                      <td className="px-4 py-3">
                        {e.status === 'published' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-green-50 text-green-600">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> 已发布
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-yellow-50 text-yellow-600">
                            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" /> 草稿
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#9A9A9A] hidden lg:table-cell">{e.updated_at}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(ev) => { ev.stopPropagation(); window.open(`/exams/${e.id}/edit`, '_blank') }} className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title="编辑">
                            <Edit size={14} />
                          </button>
                          <button onClick={(ev) => { ev.stopPropagation(); handlePreview(e) }} className="p-1.5 text-[#9A9A9A] hover:text-[#353535] hover:bg-gray-100 rounded-[3px]" title="预览">
                            <Eye size={14} />
                          </button>
                          <button onClick={(ev) => { ev.stopPropagation(); setDeleteTarget(e.id) }} className="p-1.5 text-[#9A9A9A] hover:text-[#FF4D4F] hover:bg-red-50 rounded-[3px]" title="删除">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#F0F0F0] bg-[#F6F7F8]">
                <span className="text-[11px] text-[#9A9A9A]">第 {page}/{totalPages} 页，共 {filtered.length} 条</span>
                <div className="flex gap-1">
                  <button onClick={() => goTo(page - 1)} disabled={page <= 1} className="px-2.5 py-1 text-[12px] border border-[#E7E7EB] rounded-[3px] disabled:opacity-30 hover:bg-white"><ChevronLeft size={14} /></button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => goTo(p)} className={`px-3 py-1 text-[12px] rounded-[3px] ${p === page ? 'bg-[#02A7F0] text-white' : 'border border-[#E7E7EB] hover:bg-white text-[#353535]'}`}>{p}</button>
                  ))}
                  <button onClick={() => goTo(page + 1)} disabled={page >= totalPages} className="px-2.5 py-1 text-[12px] border border-[#E7E7EB] rounded-[3px] disabled:opacity-30 hover:bg-white"><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </div>
        )}

        <ConfirmDialog open={Boolean(deleteTarget)} title="确认删除" message="删除后将无法恢复，确认删除此试卷吗？" danger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

        {previewData && (
          <ExamPreview questions={previewData.questions} meta={previewData.meta} onClose={() => setPreviewData(null)} />
        )}
      </div>
    </AppLayout>
  )
}
