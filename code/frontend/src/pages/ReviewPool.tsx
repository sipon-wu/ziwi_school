import { useState, useMemo } from 'react'
import { GitPullRequest, Search, Eye, CheckCircle2, XCircle, MessageSquare, Trash2 } from 'lucide-react'
import { useTeaching } from '../lib/TeachingContext'
import { useToast } from '../components/Toast'
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

const MOCK_REVIEWS: ReviewItem[] = [
  { id: '9', lesson_title: 'Unit 2 My Family - 词汇课', author: '李小红', subject: '英语', grade: '四年级', unit: '第二单元', format_template: '3d_objective', submitted_at: '2026-07-04 09:30' },
  { id: '10', lesson_title: '《忆江南》古诗赏析', author: '王大力', subject: '语文', grade: '四年级', unit: '第一单元', format_template: 'core_literacy', submitted_at: '2026-07-03 16:00' },
  { id: '13', lesson_title: '观察物体（三视图）', author: '刘小月', subject: '数学', grade: '四年级', unit: '第三单元', format_template: 'core_literacy', submitted_at: '2026-07-05 10:00' },
  { id: '14', lesson_title: 'Unit 5 Weather - 阅读课', author: '陈小花', subject: '英语', grade: '四年级', unit: '第五单元', format_template: '3d_objective', submitted_at: '2026-07-05 14:20' },
  { id: '15', lesson_title: '《鸟的天堂》精读', author: '赵大鹏', subject: '语文', grade: '四年级', unit: '第一单元', format_template: 'core_literacy', submitted_at: '2026-07-02 11:00' },
]

const ALL_UNITS = ['第一单元', '第二单元', '第三单元', '第四单元', '第五单元', '第六单元', '第七单元', '第八单元']

export default function ReviewPool() {
  const teaching = useTeaching()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [articles, setArticles] = useState(MOCK_REVIEWS)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

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

  // ── 审阅操作：toast 反馈（后端审阅 endpoint 待实现）──
  const handleReviewAction = (action: string, item: ReviewItem) => {
    // localStorage 记录审阅操作，防止刷新丢失
    const key = 'zhiwei_review_actions'
    try {
      const existing = JSON.parse(localStorage.getItem(key) || '{}')
      existing[item.id] = { action, at: new Date().toISOString(), title: item.lesson_title }
      localStorage.setItem(key, JSON.stringify(existing))
    } catch {}
    toast(`已${action === 'approve' ? '通过' : action === 'reject' ? '退回' : '留言'}: ${item.lesson_title}`, 'success')
    setArticles(prev => prev.filter(a => a.id !== item.id))
  }

  const pending = filtered.length
  const reviewedToday = 2

  return (
    <AppLayout>
      <div className="bg-yellow-50 border border-yellow-200 rounded-[4px] px-4 py-2 mb-4 text-[11px] text-[#595959]">
        ⚠️ 互审池中已归档班级的互审项将自动移出
      </div>
      
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
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-[13px] text-[#9A9A9A]">暂无待审教案</td></tr>
                ) : (
                  filtered.map(r => (
                    <tr key={r.id} className="hover:bg-[#F9FAFB] transition-colors group">
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
                          <button onClick={() => handleReviewAction('review', r)} className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title="审阅"><Eye size={14} /></button>
                          <button onClick={() => handleReviewAction('approve', r)} className="p-1.5 text-[#9A9A9A] hover:text-green-600 hover:bg-green-50 rounded-[3px]" title="通过"><CheckCircle2 size={14} /></button>
                          <button onClick={() => handleReviewAction('reject', r)} className="p-1.5 text-[#9A9A9A] hover:text-orange-500 hover:bg-orange-50 rounded-[3px]" title="退回"><XCircle size={14} /></button>
                          <button onClick={() => handleReviewAction('comment', r)} className="p-1.5 text-[#9A9A9A] hover:text-[#722ED1] hover:bg-purple-50 rounded-[3px]" title="留言"><MessageSquare size={14} /></button>
                          <button onClick={() => setDeleteTarget(r.id)} className="p-1.5 text-[#9A9A9A] hover:text-red-500 hover:bg-red-50 rounded-[3px]" title="删除"><Trash2 size={14} /></button>
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
