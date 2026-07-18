import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Eye, ChevronLeft, ChevronRight, Send, Clock } from 'lucide-react'
import { usePagination } from '../lib/useApi'
import { EmptyState } from '../components/StateComponents'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTeaching } from '../lib/TeachingContext'
import { api, notifyError } from '../lib/api'
import AppLayout from '../components/AppLayout'

interface AssignmentItem {
  id: string
  title: string
  class_name: string
  subject: string
  grade: string
  question_count: number
  status: 'draft' | 'published' | 'scheduled' | 'shared'
  shared_from?: string
  scheduled_at?: string
  due_at: string
  submissions: number
  total_students: number
  updated_at: string
}

const MOCK_DATA: AssignmentItem[] = [
  { id: 'a1', title: '《观潮》课内阅读练习', class_name: '四年级 (1)班', subject: '语文', grade: '四年级', question_count: 8, status: 'published', due_at: '2026-07-06', submissions: 32, total_students: 42, updated_at: '2026-07-01 14:30' },
  { id: 'a2', title: '修辞手法专项训练', class_name: '四年级 (1)班', subject: '语文', grade: '四年级', question_count: 10, status: 'published', due_at: '2026-07-04', submissions: 28, total_students: 42, updated_at: '2026-06-28 10:15' },
  { id: 'a3', title: '第一单元综合检测', class_name: '四年级 (2)班', subject: '语文', grade: '四年级', question_count: 15, status: 'scheduled', scheduled_at: '2026-07-08 08:00', due_at: '2026-07-10', submissions: 0, total_students: 40, updated_at: '2026-07-05 09:00' },
  { id: 'a4', title: '自然之美写景练习', class_name: '四年级 (1)班', subject: '语文', grade: '四年级', question_count: 5, status: 'draft', due_at: '', submissions: 0, total_students: 42, updated_at: '2026-07-03 16:45' },
  { id: 'a5', title: '阅读摘抄积累任务', class_name: '四年级 (3)班', subject: '语文', grade: '四年级', question_count: 3, status: 'published', due_at: '2026-07-05', submissions: 35, total_students: 38, updated_at: '2026-06-30 11:20' },
  // 来自其他班级的分享
  { id: 'a6', title: '《观潮》课内阅读练习', class_name: '四年级 (2)班', subject: '语文', grade: '四年级', question_count: 8, status: 'shared', shared_from: '四年级 (1)班', due_at: '2026-07-06', submissions: 0, total_students: 40, updated_at: '2026-07-01 14:30' },
  { id: 'a7', title: '修辞手法专项训练', class_name: '四年级 (3)班', subject: '语文', grade: '四年级', question_count: 10, status: 'shared', shared_from: '四年级 (1)班', due_at: '2026-07-04', submissions: 0, total_students: 38, updated_at: '2026-06-28 10:15' },
]

const GRADE_MAP: Record<number, string> = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级', 7: '七年级', 8: '八年级', 9: '九年级' }

export default function AssignmentList() {
  const teaching = useTeaching()
  const [assignments, setAssignments] = useState<AssignmentItem[]>([])
  useEffect(() => {
    api<{ items: any[] }>('/assignments').then(res => {
      setAssignments(res.items.map((a: any) => {
        const qArr = typeof a.questions === 'string' ? JSON.parse(a.questions || '[]') : (a.questions || [])
        return {
          id: a.id, title: a.title, subject: a.subject, grade: '四年级',
          class_name: a.class_id === 'b0000000-0000-0000-0000-000000000002' ? '四年级 (1)班' : '四年级 (3)班',
          question_count: Array.isArray(qArr) ? qArr.length : 0,
          status: (a.due_at ? 'published' : 'draft') as AssignmentItem['status'],
          due_at: a.due_at || '',
          submissions: 0, total_students: 42, updated_at: a.created_at?.slice(0, 10) || '',
        }
      }))
    }).catch(() => {})
  }, [])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const classFiltered = useMemo(() => {
    const gradeStr = GRADE_MAP[teaching.grade] || ''
    return assignments.filter(a => a.subject === teaching.subject && a.grade === gradeStr)
  }, [assignments, teaching.subject, teaching.grade])

  const filtered = classFiltered.filter(a => {
    if (searchTerm && !a.title.includes(searchTerm) && !a.class_name.includes(searchTerm)) return false
    if (filterStatus && a.status !== filterStatus) return false
    return true
  })

  const ownFiltered = filtered.filter(a => a.status !== 'shared')
  const { page, totalPages, paginated, goTo } = usePagination(ownFiltered, 8)

  const handleRowClick = (a: AssignmentItem) => {
    window.open(`/assignments/${a.id}`, '_blank')
  }

  return (
    <AppLayout>
      <div className="bg-yellow-50 border border-yellow-200 rounded-[4px] px-4 py-2 mb-4 text-[11px] text-[#595959]">
        ⚠️ 已归档班级的作业将停止收发与批改
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#353535]">作业布置</h1>
            <p className="text-[11px] text-[#9A9A9A] mt-0.5">管理班级作业，支持定时发布和批阅统计</p>
          </div>
          <button
            onClick={() => window.open('/assignments/new', '_blank')}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors"
          >
            <Plus size={16} /> 布置作业
          </button>
        </div>

        <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 relative min-w-[140px] max-w-[280px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input type="text" placeholder="搜索作业标题或班级..." value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); goTo(1) }}
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" />
          </div>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="scheduled">定时中</option>
          </select>
        </div>

        <div className="flex items-center gap-3 text-[12px] text-[#9A9A9A]">
          <span>共 {filtered.length} 项作业</span>
          <span className="text-[#E7E7EB]">|</span>
          <span>已发布 {filtered.filter(a => a.status === 'published').length} 项</span>
          <span className="text-[#E7E7EB]">|</span>
          <span>定时中 {filtered.filter(a => a.status === 'scheduled').length} 项</span>
          <span className="text-[#E7E7EB]">|</span>
          <span>草稿 {filtered.filter(a => a.status === 'draft').length} 项</span>
          <span className="text-[#E7E7EB]">|</span>
          <span>共享 {filtered.filter(a => a.status === 'shared').length} 项</span>
        </div>

        {/* 共享作业（来自其他班级） */}
        {classFiltered.filter(a => a.status === 'shared').length > 0 && (
          <div className="bg-white border border-[#02A7F0]/20 rounded-[4px] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#02A7F0]/5 border-b border-[#02A7F0]/10 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#02A7F0] rounded-full" />
              <span className="text-[12px] font-medium text-[#02A7F0]">同年级共享</span>
              <span className="text-[10px] text-[#9A9A9A]">（来自您其他班级的作业，可采纳后布置）</span>
            </div>
            <div className="divide-y divide-[#F0F0F0]">
              {classFiltered.filter(a => a.status === 'shared').map(a => (
                <div key={a.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F9FAFB]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[#353535]">{a.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#02A7F0]/10 text-[#02A7F0] rounded">来自{a.shared_from}</span>
                    </div>
                    <div className="text-[11px] text-[#9A9A9A] mt-0.5">{a.question_count} 题 · 截止 {a.due_at}</div>
                  </div>
                  <button onClick={() => window.open('/assignments/new', '_blank')}
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-[#02A7F0] border border-[#02A7F0]/30 rounded-[4px] hover:bg-[#02A7F0]/5 shrink-0 ml-4">
                    采纳并编辑
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 本班作业 */}
        {filtered.filter(a => a.status !== 'shared').length === 0 ? (
          <EmptyState title="暂无匹配的作业" description="尝试调整搜索条件或布置新作业" action={{ label: '布置作业', onClick: () => window.open('/assignments/new', '_blank') }} />
        ) : (
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F6F7F8] border-b border-[#E7E7EB]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">作业标题</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">班级</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">题量</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">截止日期</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">提交</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">状态</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {paginated.map(a => (
                    <tr key={a.id} onClick={() => handleRowClick(a)} className="hover:bg-[#F9FAFB] transition-colors cursor-pointer group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Send size={14} className="text-[#9A9A9A] shrink-0" />
                          <span className="text-[13px] font-medium text-[#353535]">{a.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#353535] hidden lg:table-cell">{a.class_name}</td>
                      <td className="px-4 py-3 text-[13px] text-[#353535]">{a.question_count} 题</td>
                      <td className="px-4 py-3 text-[12px] text-[#9A9A9A] hidden lg:table-cell">{a.due_at || '-'}</td>
                      <td className="px-4 py-3 text-[13px] text-[#02A7F0]">{a.submissions}/{a.total_students}</td>
                      <td className="px-4 py-3">
                        {a.status === 'published' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-green-50 text-green-600">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> 已发布
                          </span>
                        ) : a.status === 'scheduled' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-blue-50 text-blue-600">
                            <Clock size={10} /> 定时中
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-yellow-50 text-yellow-600">
                            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" /> 草稿
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(ev) => { ev.stopPropagation(); window.open(`/assignments/${a.id}`, '_blank') }} className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title="编辑">
                            <Edit size={14} />
                          </button>
                          <button onClick={(ev) => { ev.stopPropagation(); window.open(`/assignments/${a.id}?preview=1`, '_blank') }} className="p-1.5 text-[#9A9A9A] hover:text-[#353535] hover:bg-gray-100 rounded-[3px]" title="预览">
                            <Eye size={14} />
                          </button>
                          <button onClick={(ev) => { ev.stopPropagation(); setDeleteTarget(a.id) }} className="p-1.5 text-[#9A9A9A] hover:text-[#FF4D4F] hover:bg-red-50 rounded-[3px]" title="删除">
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

        <ConfirmDialog open={Boolean(deleteTarget)} title="确认删除" message="删除后将无法恢复，确认删除吗？" danger onConfirm={() => { if (deleteTarget) { const tok = localStorage.getItem('zhiwei_token'); fetch('/api/assignments/' + deleteTarget, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + tok } }).catch((e) => notifyError('删除作业失败', e)); setDeleteTarget(null) }}} onCancel={() => setDeleteTarget(null)} />
      </div>
    </AppLayout>
  )
}
