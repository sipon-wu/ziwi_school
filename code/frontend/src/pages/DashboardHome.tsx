import { useNavigate } from 'react-router-dom'
import { FileText, BookOpen, CheckSquare } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { dashboardAPI } from '../lib/api'
import { PageShell } from '../components/StateComponents'

const recentPlansFallback = [
  { title: '《观潮》第一课时', subject: '四年级 · 语文', type: '录入教案', status: '已定稿', time: '2小时前' },
  { title: '《分数的初步认识》', subject: '三年级 · 数学', type: '复习课', status: '草稿', time: '昨天' },
  { title: 'Unit 3 My School Calendar', subject: '五年级 · 英语', type: 'A Let\'s talk', status: '已定稿', time: '3天前' },
  { title: '《桂花雨》第二课时', subject: '五年级 · 语文', type: '精读课', status: '已定稿', time: '1周前' },
  { title: '《长方形和正方形周长》', subject: '三年级 · 数学', type: '新授课', status: '草稿', time: '2周前' },
]

const statusColors: Record<string, string> = {
  '已定稿': 'bg-green-50 text-green-600',
  '草稿': 'bg-yellow-50 text-yellow-700',
}

export default function DashboardHome() {
  const navigate = useNavigate() // P1-4: 导航支持
  const { data: dashData, loading } = useApi(() => dashboardAPI.home(), {
    stats: { pending_grading: 12, pending_sign: 3, overdue_sign: 2, draft_plans: 5 },
    recent_plans: recentPlansFallback
  })

  if (loading) return <PageShell loading empty={false} error={null}>{null}</PageShell>

  const plans = dashData?.recent_plans || recentPlansFallback

  return (
    <>
      {/* 欢迎横幅 */}
      <div className="bg-gradient-to-br from-[#1A3A6B] via-[#2B5DA8] to-[#1E3A5F] rounded-xl px-4 lg:px-6 py-4 lg:py-5 mb-5 text-white">
        <h2 className="text-sm lg:text-base font-semibold mb-1">下午好，张老师 👋</h2>
        <p className="text-[12px] lg:text-[13px] text-white/80">今天还有 12 份作业待批阅，3 位家长未签字</p>
      </div>

      {/* 三张统计卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4 mb-5">
        <div onClick={() => navigate('/dashboard/grading')} className="bg-white rounded-xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-gray-500">待批阅作业</span>
            <span className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-orange-500" />
            </span>
          </div>
          <div className="text-[28px] font-semibold text-gray-900 leading-none mb-1">12</div>
          <div className="text-[12px] text-gray-400">较昨日 <span className="text-red-500">+3</span></div>
        </div>

        <div onClick={() => navigate('/dashboard/parent-sign')} className="bg-white rounded-xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-gray-500">家长未签字</span>
            <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-red-500" />
            </span>
          </div>
          <div className="text-[28px] font-semibold text-gray-900 leading-none mb-1">3</div>
          <div className="text-[12px] text-gray-400">三年级2班 <span className="text-red-500">已逾期2人</span></div>
        </div>

        <div onClick={() => navigate('/dashboard/lesson-plans')} className="bg-white rounded-xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-gray-500">教案草稿</span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-500" />
            </span>
          </div>
          <div className="text-[28px] font-semibold text-gray-900 leading-none mb-1">5</div>
          <div className="text-[12px] text-gray-400">最近编辑：30分钟前</div>
        </div>
      </div>

      {/* 快捷入口 + 最近教案 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
        <div className="bg-white rounded-xl p-4 lg:p-5">
          <h3 className="text-[14px] font-semibold text-gray-800 mb-4">快捷入口</h3>
          <div className="space-y-2">
            <button onClick={() => navigate('/dashboard/lesson-plans/new')} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-brand-light text-brand text-[13px] font-medium hover:bg-brand/10 transition-colors">
              <FileText className="w-4 h-4" /> 新建教案
            </button>
            <button onClick={() => navigate('/dashboard/exercises/new')} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 text-gray-700 text-[13px] hover:bg-gray-100 transition-colors">
              <BookOpen className="w-4 h-4" /> 快速出题
            </button>
            <button onClick={() => navigate('/dashboard/analytics')} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-50 text-gray-700 text-[13px] hover:bg-gray-100 transition-colors">
              <CheckSquare className="w-4 h-4" /> 查看学情
            </button>
          </div>
          <div className="mt-5 pt-4 border-t border-border">
            <div className="text-[12px] text-gray-400 mb-3">本周统计</div>
            <div className="flex justify-between text-center">
              <div><div className="text-lg font-semibold text-gray-800">8</div><div className="text-[11px] text-gray-400">生成教案</div></div>
              <div><div className="text-lg font-semibold text-gray-800">3</div><div className="text-[11px] text-gray-400">发布作业</div></div>
              <div><div className="text-lg font-semibold text-green-600">92%</div><div className="text-[11px] text-gray-400">课标对齐率</div></div>
              <div><div className="text-lg font-semibold text-gray-800">85%</div><div className="text-[11px] text-gray-400">教案接受率</div></div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl p-4 lg:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold text-gray-800">最近教案</h3>
            <button onClick={() => navigate('/dashboard/lesson-plans')} className="text-[13px] text-brand hover:text-brand-hover">查看全部 →</button>
          </div>
          <div>
            {plans.map((plan: any, i: number) => (
              <div key={i} onClick={() => navigate(`/dashboard/lesson-plans/${plan.id || 'new'}/edit`)}
                className={`flex items-center gap-4 py-3 px-3 -mx-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${i < plans.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="w-9 h-9 rounded-lg bg-brand-light flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-800 truncate">{plan.title}</div>
                  <div className="text-[12px] text-gray-400 mt-0.5">{plan.subject} · {plan.type}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${statusColors[plan.status]}`}>{plan.status}</span>
                <span className="text-[12px] text-gray-400 shrink-0">{plan.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
