import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckSquare, MessageSquare, Zap, TrendingUp, Clock,
  FileText, BookOpen, Users, Sparkles
} from 'lucide-react'
import { tokenQuotaAPI, dashboardAPI } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface QuotaState {
  used: number
  total: number
  pct: number
  level: 'normal' | 'warning' | 'danger' | 'blocked'
}

interface Activity {
  icon: 'lesson' | 'exercise' | 'grade' | 'sign'
  text: string
  time: string
}

const ACTIVITY_ICON: Record<string, React.ReactNode> = {
  lesson: <FileText size={12} className="text-blue-500" />,
  exercise: <BookOpen size={12} className="text-green-500" />,
  grade: <CheckSquare size={12} className="text-orange-500" />,
  sign: <Users size={12} className="text-purple-500" />,
}

const ACTIVITY_BG: Record<string, string> = {
  lesson: 'bg-blue-50',
  exercise: 'bg-green-50',
  grade: 'bg-orange-50',
  sign: 'bg-purple-50',
}

const MOCK_ACTIVITIES: Activity[] = [
  { icon: 'lesson', text: '生成教案《分数基本性质》', time: '20分钟前' },
  { icon: 'exercise', text: '发布作业「小数加减练习」', time: '1小时前' },
  { icon: 'grade', text: '批阅了三年级2班 12 份作业', time: '2小时前' },
  { icon: 'sign', text: '李小明家长完成签字', time: '3小时前' },
  { icon: 'lesson', text: '编辑教案《乘法分配律》', time: '昨天' },
]

export default function SidePanel() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [quota, setQuota] = useState<QuotaState>({ used: 0, total: 0, pct: 0, level: 'normal' })
  const [pendingGrading, setPendingGrading] = useState(12)
  const [pendingSign, setPendingSign] = useState(3)

  useEffect(() => {
    tokenQuotaAPI.myQuota().then((res: any) => {
      if (res?.data) {
        setQuota({
          used: res.data.used_monthly || 0,
          total: res.data.quota_monthly || 0,
          pct: res.data.usage_pct || 0,
          level: res.data.level || 'normal',
        })
      }
    }).catch(() => {})

    dashboardAPI.home().then((res: any) => {
      if (res?.stats) {
        setPendingGrading(res.stats.pending_grading || 0)
        setPendingSign(res.stats.pending_sign || 0)
      }
    }).catch(() => {})
  }, [])

  // 仅 >=xl 且在非移动端显示
  if (isMobile) return null

  const svgLen = 62.8 // 2 * PI * 10

  return (
    <aside className="hidden xl:block w-[280px] shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* --- 待办列表 --- */}
        <div>
          <h4 className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-700 mb-3">
            <CheckSquare size={13} className="text-orange-500" />
            待办事项
          </h4>
          <div className="space-y-1.5">
            <button
              onClick={() => navigate('/dashboard/grading')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors text-left group"
            >
              <span className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                <CheckSquare size={14} className="text-orange-600" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-gray-800">待批阅作业</div>
                <div className="text-[11px] text-gray-400">{pendingGrading} 份未批改</div>
              </div>
              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {pendingGrading}
              </span>
            </button>

            <button
              onClick={() => navigate('/dashboard/parent-sign')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-purple-50 transition-colors text-left group"
            >
              <span className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <MessageSquare size={14} className="text-purple-600" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-gray-800">家长未签字</div>
                <div className="text-[11px] text-gray-400">{pendingSign} 位未处理</div>
              </div>
              {pendingSign > 0 && (
                <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {pendingSign}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* --- Token 用量 --- */}
        <div>
          <h4 className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-700 mb-3">
            <Zap size={13} className="text-blue-500" />
            Token 用量（本月）
          </h4>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 shrink-0">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 28 28">
                  <circle cx="14" cy="14" r="12" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                  <circle cx="14" cy="14" r="12" fill="none"
                    stroke={
                      quota.level === 'blocked' ? '#DC2626' :
                      quota.level === 'danger' ? '#EF4444' :
                      quota.level === 'warning' ? '#F59E0B' : '#3B82F6'
                    }
                    strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${Math.min(quota.pct, 100) * 0.754} 75.4`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
                  {Math.round(quota.pct)}%
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-gray-600">
                  {quota.total > 0
                    ? `${quota.used.toLocaleString()} / ${quota.total.toLocaleString()}`
                    : '加载中...'}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp size={10} className="text-gray-400" />
                  <span className="text-[11px] text-gray-400">日均 ~{(quota.total / 30).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- 最近动态 --- */}
        <div>
          <h4 className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-700 mb-3">
            <Clock size={13} className="text-gray-400" />
            最近动态
          </h4>
          <div className="space-y-1">
            {MOCK_ACTIVITIES.map((act, i) => (
              <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${ACTIVITY_BG[act.icon]}`}>
                  {ACTIVITY_ICON[act.icon]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-gray-700 leading-tight">{act.text}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{act.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- 小薇 AI 入口 --- */}
        <div>
          <button
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-gradient-to-r from-brand/5 to-purple-50 border border-brand/10 hover:border-brand/30 transition-colors group"
            onClick={() => {
              // 触发小薇 AI 聊天面板
              const btn = document.querySelector('[data-xiaowei-trigger]') as HTMLButtonElement
              btn?.click()
            }}
          >
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-purple-500 flex items-center justify-center shrink-0 shadow-lg shadow-brand/20">
              <Sparkles size={18} className="text-white" />
            </span>
            <div className="flex-1 text-left">
              <div className="text-[13px] font-semibold text-gray-800">小薇 AI</div>
              <div className="text-[11px] text-gray-400">教学助手 · 随时问我</div>
            </div>
            <span className="text-brand/30 group-hover:text-brand/60 transition-colors">→</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
