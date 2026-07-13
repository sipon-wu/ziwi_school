import { useState, useEffect } from 'react'
import { Trash2, Copy, Eye, FileText, PenTool, Files, Send, Image as ImgIcon, Music, Video, X, Bell } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { api } from '../lib/api'
import { useTeaching } from '../lib/TeachingContext'

function safeGetUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') || {} } catch { return {} }
}

interface DashboardData { stats: { pending_grading: number; pending_review: number; parent_sign_total: number; parent_sign_signed: number; period_new_plans: number; period_new_questions: number; period_new_exams: number }; recent: { id: string; title: string; subject: string; grade: string; status: string; updated_at: string }[] }

/* ──────── Quick Create ──────── */
const QUICK_CREATE = [
  { label: '教案', icon: <FileText size={24} />, to: '/lesson-plans/new', newTab: true },
  { label: '习题', icon: <PenTool size={24} />, to: '/exercises/new', newTab: true },
  { label: '试卷', icon: <Files size={24} />, to: '/exams/new', newTab: true },
  { label: '作业', icon: <Send size={24} />, to: '/assignments/new', newTab: true },
  { label: '插图', icon: <ImgIcon size={24} />, to: '/materials' },
  { label: '音频', icon: <Music size={24} />, to: '/materials' },
  { label: '视频', icon: <Video size={24} />, to: '/materials' },
]

export default function TeacherDashboard() {
  const user = safeGetUser()
  const teaching = useTeaching()
  const [timeTab, setTimeTab] = useState<'7' | '30'>('7')
  const [data, setData] = useState<DashboardData | null>(null)
  const [showUrge, setShowUrge] = useState(false)
  const [urgeSent, setUrgeSent] = useState(false)

  useEffect(() => {
    const gradeName = (() => {
      const g = teaching.grade
      if (g <= 0 || g > 9) return ''
      return `${['一','二','三','四','五','六','七','八','九'][g-1]}年级`
    })()
    const params = new URLSearchParams({
      days: timeTab,
      class_id: teaching.selectedClassId || '',
      subject: teaching.subject || '',
      grade: gradeName,
    })
    api<DashboardData>(`/analytics/teacher-dashboard?${params.toString()}`).then(setData).catch(() => {})
  }, [timeTab, teaching.selectedClassId, teaching.subject, teaching.grade])

  const s = data?.stats
  const recent = data?.recent || []

  const formatDate = (iso: string) => iso?.slice(0, 10) || ''

  return (
    <AppLayout>
      {/* Row 1: User Card + Right cards */}
      <div className="flex gap-4 mb-4">
        {/* Left: User Overview Card */}
        <div className="w-[260px] bg-white border border-[#E7E7EB] rounded-[4px] p-5 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-gray-200 border border-[#E7E7EB] flex items-center justify-center text-[#9A9A9A] text-sm overflow-hidden">
              <img src="/avatar.jpg?v=3" alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#353535]">{user?.name || '张真真'}</p>
              <p className="text-[11px] text-[#9A9A9A]">{user?.school_name || '成都市金牛区第一小学'}</p>
            </div>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between items-center">
              <span>作业待批改</span>
              <span className="text-[#F6920E] font-bold">{s?.pending_grading ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>教案待互审</span>
              <span className="text-[#02A7F0] font-bold">{s?.pending_review ?? 0}</span>
            </div>
            {((s?.parent_sign_total ?? 0) > 0) && (
            <div className="flex justify-between items-center">
              <span>家长签字 {s?.parent_sign_signed}/{s?.parent_sign_total}</span>
              {(s?.parent_sign_total ?? 0) > (s?.parent_sign_signed ?? 0) ? (
                <button onClick={() => setShowUrge(true)} className="text-[12px] text-[#02A7F0] hover:underline flex items-center gap-1">
                  <Bell size={11} />催办
                </button>
              ) : (
                <span className="text-[11px] text-[#9A9A9A]">已全部签完</span>
              )}
            </div>
            )}
          </div>
        </div>

        {/* Right: Tab + 评分单行 + 3统计卡片 */}
        <div className="flex-1 space-y-4">
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-3 flex items-center">
            <div className="flex gap-1 mr-4">
              <button onClick={() => setTimeTab('7')} className={`px-3 py-1 text-[13px] rounded-[3px] ${timeTab === '7' ? 'bg-[#353535] text-white' : 'bg-white border border-[#E7E7EB] hover:border-[#02A7F0]'}`}>7日内</button>
              <button onClick={() => setTimeTab('30')} className={`px-3 py-1 text-[13px] rounded-[3px] ${timeTab === '30' ? 'bg-[#353535] text-white' : 'bg-white border border-[#E7E7EB] hover:border-[#02A7F0]'}`}>30日内</button>
            </div>
            <div className="text-[11px] text-[#02A7F0] flex items-center gap-3">
              <span>课标对齐率: <strong>90%</strong></span>
              <span>教案评分(AI): <strong className="text-[#F6920E]">9.5</strong> 分</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-5 text-center">
              <div className="text-[11px] text-[#9A9A9A] mb-2">新增教案 (篇)</div>
              <div className="text-[32px] font-bold text-[#353535]">{s?.period_new_plans ?? 0}</div>
            </div>
            <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-5 text-center">
              <div className="text-[11px] text-[#9A9A9A] mb-2">新增题型 (道)</div>
              <div className="text-[32px] font-bold text-[#353535]">{s?.period_new_questions ?? 0}</div>
            </div>
            <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-5 text-center">
              <div className="text-[11px] text-[#9A9A9A] mb-2">新增试卷 (张)</div>
              <div className="text-[32px] font-bold text-[#353535]">{s?.period_new_exams ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: 新的创作 */}
      <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-5 mb-4">
        <h3 className="text-[15px] font-semibold text-[#353535] mb-4">新的创作</h3>
        <div className="grid grid-cols-7">
          {QUICK_CREATE.map((q) => (
            <a key={q.label} href={q.to}
              target={q.newTab ? '_blank' : undefined}
              rel={q.newTab ? 'noopener noreferrer' : undefined}
              className="flex flex-col items-center gap-2 py-5 hover:bg-[#F9FAFB] transition-colors group">
              <span className="text-[#02A7F0] group-hover:scale-110 transition-transform">{q.icon}</span>
              <span className="text-[13px] text-[#353535]">{q.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Row 3: 近期草稿 */}
      <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-[#353535]">近期草稿</h3>
          <a href="/lesson-plans" className="text-[13px] text-[#9A9A9A] border border-[#E7E7EB] rounded-[3px] px-3 py-1 hover:border-[#02A7F0] hover:text-[#02A7F0]">全部草稿</a>
        </div>
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-[#E7E7EB]">
            <th className="text-left py-2.5 px-3 text-[11px] text-[#9A9A9A] font-normal">草稿内容</th>
            <th className="text-left py-2.5 px-3 text-[11px] text-[#9A9A9A] font-normal w-16">年级</th>
            <th className="text-left py-2.5 px-3 text-[11px] text-[#9A9A9A] font-normal">状态</th>
            <th className="text-left py-2.5 px-3 text-[11px] text-[#9A9A9A] font-normal whitespace-nowrap">更新时间</th>
            <th className="text-left py-2.5 px-3 text-[11px] text-[#9A9A9A] font-normal w-28">操作</th>
          </tr></thead>
          <tbody>
            {recent.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-[13px] text-[#9A9A9A]">暂无草稿</td></tr>
            ) : recent.map((d) => (
              <tr key={d.id} className="border-b border-[#F0F0F0] hover:bg-[#F9FAFB]">
                <td className="py-3 px-3"><a href={`/lesson-plans/${d.id}`} className="text-[#353535] hover:text-[#02A7F0]">{d.title}</a></td>
                <td className="py-3 px-3 text-[#9A9A9A]">{d.grade}</td>
                <td className="py-3 px-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-sm ${d.status === 'final' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>{d.status === 'final' ? '已定稿' : '草稿'}</span>
                </td>
                <td className="py-3 px-3 text-[#9A9A9A]">{formatDate(d.updated_at)}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <a href={`/lesson-plans/${d.id}`} target="_blank" rel="noopener noreferrer" className="text-[#9A9A9A] hover:text-[#02A7F0]"><Eye size={14} /></a>
                    <button className="text-[#9A9A9A] hover:text-[#02A7F0]"><Copy size={14} /></button>
                    <button className="text-[#9A9A9A] hover:text-[#FF4D4F]"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-4 text-[11px] text-[#9A9A9A] py-4">
        <span>蜀ICP备2026000247号</span>
      </div>

      {/* 催办通知弹层 */}
      {showUrge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowUrge(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-[8px] shadow-xl w-[480px] max-w-[90vw] z-10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F0F0F0]">
              <div className="flex items-center gap-2"><Bell size={16} className="text-[#F6920E]" /><span className="text-[14px] font-semibold text-[#353535]">催办通知</span></div>
              <button onClick={() => setShowUrge(false)} className="text-[#9A9A9A] hover:text-[#353535]"><X size={16} /></button>
            </div>
            {urgeSent ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-50 flex items-center justify-center text-2xl">✅</div>
                <p className="text-[14px] font-medium text-[#353535]">催办已发送</p>
                <p className="text-[11px] text-[#9A9A9A] mt-1">已通过站内信提醒相关家长，预计24小时内响应</p>
                <button onClick={() => { setShowUrge(false); setUrgeSent(false) }} className="mt-4 px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px]">知道了</button>
              </div>
            ) : (
              <>
                <div className="p-5 space-y-3">
                  <p className="text-[13px] text-[#353535]">向以下状态的家长发送催办通知：</p>
                  <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" defaultChecked className="accent-[#02A7F0]" /> 未签字的家长（7人）</label>
                  <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" defaultChecked className="accent-[#02A7F0]" /> 未查阅教案的家长（3人）</label>
                  <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="accent-[#02A7F0]" /> 未提交作业回执的家长（5人）</label>
                  <div className="mt-2">
                    <label className="block text-[11px] text-[#9A9A9A] mb-1">附加留言（选填）</label>
                    <textarea defaultValue="请及时查阅并签字确认，感谢配合！" className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0] resize-none h-[60px]" />
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-[#F0F0F0] flex justify-end gap-2">
                  <button onClick={() => setShowUrge(false)} className="px-4 py-1.5 text-[12px] text-[#595959] border rounded-[4px]">取消</button>
                  <button onClick={() => setUrgeSent(true)} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px]">发送催办</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
