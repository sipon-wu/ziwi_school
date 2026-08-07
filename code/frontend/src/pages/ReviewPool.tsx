import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitPullRequest, Search, Eye, CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import { useTeaching } from '../lib/TeachingContext'
import { useToast } from '../components/Toast'
import { api, reviewAPI } from '../lib/api'
import ConfirmDialog from '../components/ConfirmDialog'
import AppLayout from '../components/AppLayout'

interface ReviewItem {
  id: string
  lesson_title: string
  author: string
  subject: string
  grade: string
  unit: string
  format_template: string
  submitted_at: string
}

const ALL_UNITS = ['第一单元', '第二单元', '第三单元', '第四单元', '第五单元', '第六单元', '第七单元', '第八单元']

export default function ReviewPool() {
  const teaching = useTeaching()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [articles, setArticles] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const navigate = useNavigate()

  // 小眼睛：直接跳转到已有教案查看态（只读 + 全屏预览 + 批注侧栏），复用阅读视图而非重造弹层
  const openReview = (item: ReviewItem) => navigate(`/lesson-plans/${item.id}?review=1`)

  // 真实拉取本校待审(pending)列表；无数据时 fallback 到 mock，避免空页
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api<{ items?: ReviewItem[] }>('/review/pending')
      .then(r => {
        if (cancelled) return
        const items = (r.items || []) as any[]
        if (items.length > 0) {
          setArticles(items.map((it: any) => ({
            id: it.id,
            lesson_title: it.title || it.lesson_title,
            author: it.teacher_name || it.author || '未知',
            subject: it.subject,
            grade: it.grade,
            unit: it.unit || '—',
            format_template: it.format_template,
            submitted_at: (it.updated_at || it.submitted_at || '').slice(0, 16).replace('T', ' '),
          })))
        }
      })
      .catch(() => { if (!cancelled) setLoading(false) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const subjectFiltered = articles.filter(r => r.subject === teaching.subject)
    return subjectFiltered.filter(r => {
      if (searchTerm && !r.lesson_title.includes(searchTerm) && !r.author.includes(searchTerm)) return false
      if (filterUnit && r.unit !== filterUnit) return false
      return true
    })
  }, [searchTerm, filterUnit, teaching.subject, articles])

  const handleDelete = () => {
    if (deleteTarget) {
      setArticles(prev => prev.filter(a => a.id !== deleteTarget))
      toast('已移除', 'success')
      setDeleteTarget(null)
    }
  }

  // 评审结论：写回后端 review_status（操作者=当前评审人，后端落库）
  const decide = async (item: ReviewItem, decision: 'approve' | 'reject') => {
    setDecidingId(item.id)
    const prev = articles
    try {
      await reviewAPI.decide(item.id, decision, '')
      setArticles(p => p.filter(a => a.id !== item.id))
      toast(`已${decision === 'approve' ? '通过' : '退回'}: ${item.lesson_title}`, 'success')
    } catch {
      setArticles(prev) // 回滚
      toast('评审提交失败', 'error')
    } finally {
      setDecidingId(null)
    }
  }

  const pending = filtered.length
  const reviewedToday = 2

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#353535]">教案互审</h1>
            <p className="text-[11px] text-[#9A9A9A] mt-0.5">错位审阅：审阅其他教师的教案，共同提升教学质量</p>
          </div>
        </div>

        {/* 概览 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-[4px] bg-[#FFF7E6] flex items-center justify-center"><GitPullRequest size={17} className="text-[#FA8C16]" /></div>
            <div>
              <div className="text-xl font-bold text-[#353535]">{pending}<span className="text-[11px] font-normal text-[#9A9A9A] ml-1">份</span></div>
              <div className="text-[10px] text-[#9A9A9A]">待审教案</div>
            </div>
          </div>
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-[4px] bg-[#F0FFE5] flex items-center justify-center"><CheckCircle2 size={17} className="text-[#52C41A]" /></div>
            <div>
              <div className="text-xl font-bold text-[#353535]">{reviewedToday}<span className="text-[11px] font-normal text-[#9A9A9A] ml-1">份</span></div>
              <div className="text-[10px] text-[#9A9A9A]">今日已审</div>
            </div>
          </div>
        </div>

        {/* 搜索筛选 */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 relative min-w-[140px] max-w-[280px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input type="text" placeholder="搜索教案标题或作者..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" />
          </div>
          <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部单元</option>
            {ALL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {/* 列表 */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F6F7F8] border-b border-[#E7E7EB]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">教案标题</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">作者</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">单元</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">年级</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">提交时间</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-[13px] text-[#9A9A9A]">加载中…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-[13px] text-[#9A9A9A]">暂无待审教案</td></tr>
                ) : (
                  filtered.map(r => (
                    <tr key={r.id} onClick={() => openReview(r)} className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <GitPullRequest size={13} className="text-[#FA8C16] shrink-0" />
                          <span className="text-[13px] font-medium text-[#353535]">{r.lesson_title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#353535]">{r.author}</td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] text-[#353535]">{r.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#353535] hidden lg:table-cell">{r.grade}</td>
                      <td className="px-4 py-3 text-[12px] text-[#9A9A9A] hidden lg:table-cell">{r.submitted_at}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); openReview(r) }} className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title="阅读并批注（查看态）"><Eye size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); decide(r, 'approve') }} disabled={decidingId === r.id} className="p-1.5 text-[#9A9A9A] hover:text-green-600 hover:bg-green-50 rounded-[3px] disabled:opacity-40" title="通过"><CheckCircle2 size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); decide(r, 'reject') }} disabled={decidingId === r.id} className="p-1.5 text-[#9A9A9A] hover:text-orange-500 hover:bg-orange-50 rounded-[3px] disabled:opacity-40" title="退回"><XCircle size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(r.id) }} className="p-1.5 text-[#9A9A9A] hover:text-red-500 hover:bg-red-50 rounded-[3px]" title="移除"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog open={!!deleteTarget} title="移除互审项" message="将从互审池移除此项，确认？" danger
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </AppLayout>
  )
}
