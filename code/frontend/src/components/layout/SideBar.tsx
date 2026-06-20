import { useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, FileText, BookOpen, PenLine,
  CheckSquare, BarChart3, UserCheck
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '工作台' },
  { to: '/dashboard/lesson-plans', icon: FileText, label: '教案备课' },
  { to: '/dashboard/exercises', icon: BookOpen, label: '出题组卷' },
  { to: '/dashboard/compositions', icon: PenLine, label: '习作指导' },
  { to: '/dashboard/grading', icon: CheckSquare, label: '批阅管理' },
  { to: '/dashboard/analytics', icon: BarChart3, label: '班级学情' },
  { to: '/dashboard/parent-sign', icon: UserCheck, label: '家长签字' },
]

export default function SideBar() {
  const { pathname } = useLocation()

  return (
    <aside className="w-[200px] bg-sidebar flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2 px-4 border-b border-white/5">
        <img src="/ziwiAI.jpg" alt="知微" className="w-7 h-7 rounded" />
        <span className="text-[15px] font-semibold text-white tracking-wide">知微教学</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to))
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-4 h-11 text-[13px] transition-colors duration-150
                ${active
                  ? 'bg-brand/30 text-white border-l-[3px] border-brand'
                  : 'text-white/70 hover:bg-white/10 border-l-[3px] border-transparent'
                }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User Info */}
      <div className="h-[52px] flex items-center gap-2 px-4 border-t border-white/5">
        <div className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center text-xs font-medium">
          张
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-white truncate">张老师</div>
          <div className="text-[11px] text-white/50">三年级2班 · 语文</div>
        </div>
      </div>
    </aside>
  )
}
