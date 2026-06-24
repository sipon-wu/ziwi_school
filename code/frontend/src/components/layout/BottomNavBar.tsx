import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, TrendingUp, MessageSquare, User, AlertCircle, Mic, FileText, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface BottomNavItem {
  path: string
  label: string
  icon: LucideIcon
}

// 教师端消费型5tab（备课/出题不放底部）
const teacherTabs: BottomNavItem[] = [
  { path: '/dashboard', label: '工作台', icon: LayoutDashboard },
  { path: '/dashboard/grading', label: '批阅', icon: CheckSquare },
  { path: '/dashboard/analytics', label: '学情', icon: TrendingUp },
  { path: '#xiaowei', label: '小微', icon: MessageSquare },
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

function getTabs(pathname: string): BottomNavItem[] {
  if (pathname.startsWith('/student')) return studentTabs
  if (pathname.startsWith('/parent')) return parentTabs
  return teacherTabs
}

function getHomePath(pathname: string): string {
  if (pathname.startsWith('/student')) return '/student'
  if (pathname.startsWith('/parent')) return '/parent'
  return '/dashboard'
}

export default function BottomNavBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isMobile = useIsMobile()
  const [voiceActive, setVoiceActive] = useState(false)

  if (!isMobile) return null

  const tabs = getTabs(pathname)
  const homePath = getHomePath(pathname)
  const isTeacher = !pathname.startsWith('/student') && !pathname.startsWith('/parent')

  const handleTabClick = (tab: BottomNavItem) => {
    if (tab.path === '#xiaowei') {
      // 触发小薇 AI 聊天
      const btn = document.querySelector('[data-xiaowei-trigger]') as HTMLButtonElement
      btn?.click()
      return
    }
    navigate(tab.path)
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-bottom">
        <div className="flex h-14 relative">
          {tabs.map((tab, idx) => {
            const active = tab.path === homePath
              ? pathname === homePath || pathname === '/dashboard/'
              : tab.path === '#xiaowei'
                ? false // 小微不参与路径高亮
                : pathname.startsWith(tab.path)
            const Icon = tab.icon
            // 小微tab在中间位置（index 3），需要留空给浮动按钮
            const isCenter = isTeacher && idx === 3

            return (
              <button
                key={tab.path}
                onClick={() => handleTabClick(tab)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                  active ? 'text-[#1A3A6B]' : 'text-gray-400'
                } ${isCenter ? 'invisible' : ''}`}
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

      {/* 浮动小薇语音入口按钮（教师端中间凸起） */}
      {isTeacher && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 safe-bottom">
          <button
            onClick={() => setVoiceActive(!voiceActive)}
            onTouchStart={() => setVoiceActive(true)}
            onTouchEnd={() => setTimeout(() => setVoiceActive(false), 2000)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 ${
              voiceActive
                ? 'bg-red-500 shadow-red-500/30 scale-110'
                : 'bg-gradient-to-br from-brand to-purple-600 shadow-brand/30'
            }`}
          >
            {voiceActive ? (
              <Mic size={24} className="text-white animate-pulse" />
            ) : (
              <Mic size={24} className="text-white" />
            )}
          </button>
          {voiceActive && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
              长按说话，松开发送
              <button onClick={(e) => { e.stopPropagation(); setVoiceActive(false) }}>
                <X size={12} className="inline ml-1" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
