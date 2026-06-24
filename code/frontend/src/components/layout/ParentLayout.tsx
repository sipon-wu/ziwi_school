import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Menu, Bell, BookOpen, LogOut, MessageSquare } from 'lucide-react'
import BottomNavBar from './BottomNavBar'
import { useIsMobile } from '@/hooks/useMediaQuery'

/**
 * ParentLayout — 家长端轻量布局
 *
 * 设计要点：
 * - 无侧边栏，暖色系（橙/琥珀）
 * - 桌面端全宽内容区
 * - 移动端精简顶栏 + 5Tab底部导航（与教师端共用 BottomNavBar，但因路由自动切家长tabs）
 */

export default function ParentLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifCount] = useState(1)

  const pageTitle = (() => {
    if (pathname === '/parent' || pathname === '/parent/') return '孩子作业'
    if (pathname.includes('/parent/sign')) return '家长签字'
    return '知微家校通'
  })()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-orange-50/30">
      {/* 桌面端顶栏 */}
      <header className={`${isMobile ? 'h-11' : 'h-12'} bg-white border-b border-orange-100 flex items-center px-3 shrink-0 z-30`}>
        {isMobile ? (
          <>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-8 h-8 flex items-center justify-center text-gray-600 rounded-lg active:bg-gray-100"
            >
              <Menu size={20} />
            </button>
            <span className="text-[13px] font-medium text-gray-800 truncate flex-1 ml-2">
              {pageTitle}
            </span>
            <button className="relative w-8 h-8 flex items-center justify-center text-gray-500">
              <Bell size={16} />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[12px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {notifCount}
                </span>
              )}
            </button>

            {menuOpen && (
              <div className="absolute top-11 left-0 right-0 bg-white border-b border-orange-100 shadow-lg z-40">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-sm font-bold">
                      李
                    </div>
                    <div>
                      <div className="text-[14px] font-medium text-gray-800">李爸爸</div>
                      <div className="text-[12px] text-gray-400">李小明家长 · 四年级2班</div>
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  <button onClick={() => { setMenuOpen(false); navigate('/parent') }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">
                    <BookOpen size={16} className="text-gray-400" /> 孩子作业
                  </button>
                  <button onClick={() => { setMenuOpen(false); navigate('/parent/sign/1') }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">
                    <MessageSquare size={16} className="text-gray-400" /> 待签字
                  </button>
                  <button onClick={() => { setMenuOpen(false); navigate('/login', { replace: true }) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50">
                    <LogOut size={16} /> 退出登录
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 桌面端 */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                家
              </div>
              <div>
                <span className="text-[14px] font-semibold text-gray-800">知微家校通</span>
                <span className="ml-2 text-[12px] text-gray-400">李小明家长 · 四年级2班</span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-4">
              <button className="relative p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                <Bell size={16} />
                {notifCount > 0 && (
                  <span className="absolute top-0 right-0 min-w-[16px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {notifCount}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-[10px] font-bold">
                  李
                </div>
                <span className="text-[13px] text-gray-700">李爸爸</span>
              </div>
            </div>
          </>
        )}
      </header>

      {/* 主内容区 — 全宽 */}
      <main className={`flex-1 overflow-auto ${isMobile ? 'p-3 pb-20' : 'p-6'}`}>
        <Outlet />
      </main>

      {/* 移动端底部导航 */}
      <BottomNavBar />
    </div>
  )
}
