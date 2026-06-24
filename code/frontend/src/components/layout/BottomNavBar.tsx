import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, BookOpen, User, AlertCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface BottomNavItem {
  path: string
  label: string
  icon: LucideIcon
}

// 教师端快捷入口
const teacherTabs: BottomNavItem[] = [
  { path: '/dashboard', label: '工作台', icon: LayoutDashboard },
  { path: '/dashboard/lesson-plans', label: '备课', icon: FileText },
  { path: '/dashboard/exercises', label: '出题', icon: BookOpen },
  { path: '/dashboard/settings', label: '我的', icon: User },
]

// 学生端快捷入口
const studentTabs: BottomNavItem[] = [
  { path: '/student', label: '作业', icon: FileText },
  { path: '/student/error-book', label: '错题本', icon: AlertCircle },
]

// 家长端快捷入口
const parentTabs: BottomNavItem[] = [
  { path: '/parent', label: '作业', icon: FileText },
]

/** 根据路由前缀自动选择 Tab 配置 */
function getTabs(pathname: string): BottomNavItem[] {
  if (pathname.startsWith('/student')) return studentTabs
  if (pathname.startsWith('/parent')) return parentTabs
  return teacherTabs
}

/** 获取首页路径（用于高亮判断） */
function getHomePath(pathname: string): string {
  if (pathname.startsWith('/student')) return '/student'
  if (pathname.startsWith('/parent')) return '/parent'
  return '/dashboard'
}

export default function BottomNavBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isMobile = useIsMobile()

  if (!isMobile) return null

  const tabs = getTabs(pathname)
  const homePath = getHomePath(pathname)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-bottom">
      <div className="flex h-14">
        {tabs.map(tab => {
          const active = tab.path === homePath
            ? pathname === tab.path
            : pathname.startsWith(tab.path)
          const Icon = tab.icon
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                active ? 'text-[#1A3A6B]' : 'text-gray-400'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-[10px] font-medium leading-none ${active ? 'text-[#1A3A6B]' : ''}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
