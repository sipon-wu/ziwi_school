import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, FileText, BookOpen, PenLine,
  CheckSquare, BarChart3, UserCheck,
  FileSearch, TrendingUp, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useTeaching } from '@/lib/TeachingContext'

function getAvatar(): string {
  return localStorage.getItem('zhiwei_avatar') || ''
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '工作台' },
  { to: '/dashboard/lesson-plans', icon: FileText, label: '教案备课' },
  { to: '/dashboard/exercises', icon: BookOpen, label: '出题组卷' },
  { to: '/dashboard/compositions', icon: PenLine, label: '习作指导' },
  { to: '/dashboard/grading', icon: CheckSquare, label: '批阅管理' },
  { to: '/dashboard/reviews', icon: FileSearch, label: '教案互审' },
  { to: '/dashboard/principal', icon: TrendingUp, label: '校长仪表盘' },
  { to: '/dashboard/analytics', icon: BarChart3, label: '班级学情' },
  { to: '/dashboard/parent-sign', icon: UserCheck, label: '家长签字' },
]

export default function SideBar() {
  const { pathname } = useLocation()
  const teaching = useTeaching()
  const [avatarUrl, setAvatarUrl] = useState(getAvatar)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => setAvatarUrl((e as CustomEvent).detail)
    window.addEventListener('avatar-updated', handler)
    return () => window.removeEventListener('avatar-updated', handler)
  }, [])

  // 读取教学配置构建显示文本
  const gradeLabel = `${teaching.grade}年级${teaching.semester}`
  const subjectLabel = teaching.subject === '语文' ? '语文' : teaching.subject === '数学' ? '数学' : '英语'

  return (
    <aside className={`${collapsed ? 'w-[56px]' : 'w-[200px]'} bg-sidebar flex flex-col shrink-0 transition-[width] duration-200`}>
      {/* 顶部 Logo */}
      <div className={`h-14 flex items-center border-b border-white/5 transition-all duration-200 ${collapsed ? 'justify-center px-2' : 'gap-2 px-4'}`}>
        <img src="/ziwiAI.jpg" alt="知微" className="w-7 h-7 rounded shrink-0" />
        {!collapsed && <span className="text-[15px] font-semibold text-white tracking-wide">知微教学</span>}
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 py-2 overflow-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to))
          return (
            <Link
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={`flex items-center h-11 text-[13px] transition-all duration-150 ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${active ? 'bg-brand/30 text-white border-l-[3px] border-brand' : 'text-white/70 hover:bg-white/10 border-l-[3px] border-transparent'}`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* 底部：收起展开按钮 + 用户信息 */}
      <div className="border-t border-white/5">
        {/* 收起/展开切换 */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center h-9 text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* 用户信息 */}
        <div className={`h-[52px] flex items-center border-t border-white/5 transition-all duration-200 ${collapsed ? 'justify-center px-0' : 'gap-2 px-4'}`}>
          <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="头像" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-brand text-white flex items-center justify-center text-xs font-medium">张</div>
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-white truncate">张老师</div>
              <div className="text-[11px] text-white/50">{gradeLabel} · {subjectLabel} · {teaching.textbook_math}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
