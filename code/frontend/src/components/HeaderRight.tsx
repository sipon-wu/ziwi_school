import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, LogOut, User } from 'lucide-react'
import { clearToken } from '../lib/api'

function safeGetUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') || {} } catch { return {} }
}

interface Props {
  /** 配色方案：light=白底header, dark=深色header */
  variant?: 'light' | 'dark'
}

interface Notification {
  id: string
  type: 'ai' | 'review' | 'deadline' | 'share' | 'system'
  title: string
  desc: string
  time: string
  read: boolean
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'ai', title: '教案生成完毕', desc: '《观潮》第二课时教案已自动生成，请前往确认', time: '3 分钟前', read: false },
  { id: 'n2', type: 'review', title: '互审提醒', desc: '李建国老师提交了一份教案等待您审核', time: '28 分钟前', read: false },
  { id: 'n3', type: 'deadline', title: '作业截止提醒', desc: '《观潮》课内阅读练习将于明天截止，已提交 32/42', time: '1 小时前', read: false },
  { id: 'n4', type: 'share', title: '教案分享', desc: '王芳老师分享了五年级英语教案《Unit 3》给您', time: '2 小时前', read: true },
  { id: 'n5', type: 'system', title: '系统通知', desc: '知微教学平台已升级至 V2.3，新增分层作业功能', time: '昨天', read: true },
]

const NOTIFICATION_ICON: Record<string, { icon: string; color: string }> = {
  ai: { icon: '🤖', color: '#02A7F0' },
  review: { icon: '📋', color: '#F6920E' },
  deadline: { icon: '⏰', color: '#FF4D4F' },
  share: { icon: '📤', color: '#52C41A' },
  system: { icon: '📢', color: '#9A9A9A' },
}

export default function HeaderRight({ variant = 'light' }: Props) {
  const nav = useNavigate()
  const user = safeGetUser()
  const [showMenu, setShowMenu] = useState(false)
  const [showNotify, setShowNotify] = useState(false)
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)
  const menuRef = useRef<HTMLDivElement>(null)
  const notifyRef = useRef<HTMLDivElement>(null)

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowMenu(false)
      }
      if (notifyRef.current && !notifyRef.current.contains(target)) {
        setShowNotify(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const logout = () => {
    clearToken()
    localStorage.removeItem('user')
    nav('/login', { replace: true })
  }

  const isLight = variant === 'light'

  // 颜色映射
  const tokenColor = isLight ? 'text-[#9A9A9A]' : 'text-white/40'
  const bellColor = isLight ? 'text-[#9A9A9A] hover:text-[#353535]' : 'text-white/40 hover:text-white'
  const avatarBorder = isLight ? 'border-[#E7E7EB]' : 'border-white/10'
  const nameColor = isLight ? 'text-[#353535]' : 'text-white'
  const initialsBg = isLight ? 'bg-gray-100' : 'bg-[#02A7F0]'
  const initialsText = isLight ? 'text-[#353535]' : 'text-white'

  return (
    <div className="flex items-center gap-3">
      {/* Token */}
      <div className={`flex items-center gap-1.5 text-[11px] ${tokenColor}`}>
        <span className="w-2 h-2 rounded-full bg-[#02A7F0] inline-block" />
        <span>Token <span className="text-[#02A7F0]">5%</span></span>
      </div>

      {/* Bell */}
      <div ref={notifyRef} className="relative">
        <button
          onClick={() => setShowNotify(!showNotify)}
          className={`relative transition-colors ${bellColor}`}
        >
          <Bell size={16} />
        </button>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-3.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-[#FF4D4F] text-white text-[9px] font-bold rounded-full leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {showNotify && (
          <div className={`absolute right-0 top-8 border rounded-[4px] shadow-lg w-80 z-50 ${isLight ? 'bg-white border-[#E7E7EB]' : 'bg-[#2A2A2A] border-white/10'}`}>
            <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isLight ? 'border-[#F0F0F0]' : 'border-white/10'}`}>
              <span className={`text-[13px] font-medium ${isLight ? 'text-[#353535]' : 'text-white'}`}>消息通知</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-[#02A7F0] hover:underline">全部已读</button>
              )}
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {notifications.map(n => {
                const cfg = NOTIFICATION_ICON[n.type] || NOTIFICATION_ICON.system
                return (
                  <div key={n.id} className={`flex gap-2.5 px-4 py-2.5 border-b last:border-0 cursor-pointer transition-colors ${n.read ? (isLight ? 'hover:bg-[#F9FAFB]' : 'hover:bg-white/5') : (isLight ? 'bg-[#F6FDFF] hover:bg-[#ECFBFF]' : 'bg-[#1A3A5C]/20 hover:bg-[#1A3A5C]/30')}`}
                    style={{ borderColor: `${isLight ? '#F0F0F0' : 'transparent'}` }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] shrink-0 mt-0.5"
                      style={{ backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[12px] font-medium truncate ${n.read ? (isLight ? 'text-[#353535]' : 'text-white/70') : (isLight ? 'text-[#353535]' : 'text-white')}`}>{n.title}</span>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#02A7F0] shrink-0" />}
                      </div>
                      <p className={`text-[11px] mt-0.5 line-clamp-2 ${isLight ? 'text-[#9A9A9A]' : 'text-white/40'}`}>{n.desc}</p>
                      <span className={`text-[10px] mt-1 block ${isLight ? 'text-[#B0B0B0]' : 'text-white/30'}`}>{n.time}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className={`px-4 py-2 border-t text-center ${isLight ? 'border-[#F0F0F0]' : 'border-white/10'}`}>
              <a href="/settings" className="text-[11px] text-[#02A7F0] hover:underline">查看全部通知</a>
            </div>
          </div>
        )}
      </div>

      {/* Avatar + Dropdown */}
      <div className="relative flex items-center gap-1" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`w-7 h-7 rounded-full overflow-hidden border hover:opacity-90 transition-opacity flex items-center justify-center ${avatarBorder} ${initialsBg}`}
        >
          <img src="/avatar.jpg?v=3" alt="" className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        </button>

        {/* Username */}
        <span className={`text-[13px] hidden sm:inline whitespace-nowrap shrink-0 ${nameColor}`}>
          {user?.name || '张真真'}
        </span>

        {/* Dropdown */}
        {showMenu && (
          <div className={`absolute right-0 top-9 border rounded-[4px] shadow-lg py-1 w-44 z-50 ${isLight ? 'bg-white border-[#E7E7EB]' : 'bg-[#2A2A2A] border-white/10'}`}>
            <div className={`px-3 py-2.5 border-b ${isLight ? 'border-[#F0F0F0]' : 'border-white/10'}`}>
              <p className={`text-[13px] font-medium ${isLight ? 'text-[#353535]' : 'text-white'}`}>
                {user?.name || '张真真'}
              </p>
              <p className={`text-[11px] mt-0.5 ${isLight ? 'text-[#9A9A9A]' : 'text-white/40'}`}>
                {user?.subject || '语文'} · {user?.grade || '四年级'}({user?.grade_class?.match(/\d+/)?.[0] || '1'}班)
              </p>
            </div>
            <button
              onClick={() => { setShowMenu(false); window.location.href = '/settings' }}
              className={`w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 ${isLight ? 'text-[#353535] hover:bg-[#F9FAFB]' : 'text-white/80 hover:bg-white/10'}`}
            >
              <User size={14} /> 个人设置
            </button>
            <button
              onClick={logout}
              className="w-full text-left px-3 py-2 text-[13px] text-[#FF4D4F] hover:bg-[#FFF2F0] flex items-center gap-2"
            >
              <LogOut size={14} /> 退出登录
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
