import { useEffect } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { clearToken } from '@/lib/api'
import { X, LogOut, LayoutDashboard, FileText, BookOpen, PenLine, CheckSquare, BarChart3, UserCheck, FileSearch, TrendingUp } from 'lucide-react'
import { useTeaching } from '@/lib/TeachingContext'

interface Props {
  open: boolean
  onClose: () => void
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '工作台' },
  { to: '/dashboard/lesson-plans', icon: FileText, label: '教案备课' },
  { to: '/dashboard/exercises', icon: BookOpen, label: '出题组卷' },
  { to: '/dashboard/question-bank', icon: BookOpen, label: '题库管理' },
  { to: '/dashboard/compositions', icon: PenLine, label: '习作指导' },
  { to: '/dashboard/grading', icon: CheckSquare, label: '批阅管理' },
  { to: '/dashboard/reviews', icon: FileSearch, label: '教案互审' },
  { to: '/dashboard/principal', icon: TrendingUp, label: '校长仪表盘' },
  { to: '/dashboard/analytics', icon: BarChart3, label: '班级学情' },
  { to: '/dashboard/parent-sign', icon: UserCheck, label: '家长签字' },
]

export default function HamburgerSheet({ open, onClose }: Props) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const handleLogout = () => { clearToken(); navigate('/login', { replace: true }) }
  const teaching = useTeaching()

  // 路由变化自动关闭
  useEffect(() => {
    if (open) onClose()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // 禁止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const gradeLabel = `${teaching.grade}年级${teaching.semester}`
  const subjectLabel = teaching.subject

  return (
    <>
      {/* 遮罩 */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* 抽屉面板 */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-[280px] max-w-[75vw] bg-[#1A3A6B] z-50 flex flex-col transition-transform duration-300 ease-out safe-top safe-bottom ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/ziwiAI.jpg" alt="知微" className="w-7 h-7 rounded" />
            <span className="text-[15px] font-semibold text-white tracking-wide">知微教学</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to))
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 h-11 text-[13px] px-4 transition-all duration-150 ${
                  active
                    ? 'bg-brand/30 text-white border-l-[3px] border-brand'
                    : 'text-white/70 hover:bg-white/10 border-l-[3px] border-transparent'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* 底部用户信息 */}
        <div className="px-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-medium">
              张
            </div>
            <div>
              <div className="text-[13px] text-white">张老师</div>
              <div className="text-[11px] text-white/50">{subjectLabel} · {gradeLabel}</div>
            </div>
          </div>
          <button
            onClick={() => { handleLogout(); onClose() }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] text-red-300 hover:bg-white/10 rounded-lg active:bg-white/20"
          >
            <LogOut size={14} />退出登录
          </button>
        </div>
      </div>
    </>
  )
}
