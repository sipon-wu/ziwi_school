import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import SideBar from './SideBar'
import TopNavBar from './TopNavBar'
import BottomNavBar from './BottomNavBar'
import HamburgerSheet from './HamburgerSheet'
import XiaoWeiChat from '../XiaoWeiChat'
import DemoEnv from '../DemoEnv'
import { useIsMobile } from '@/hooks/useMediaQuery'

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()
  const { pathname } = useLocation()

  // 判断是否为 WAP 学生/家长端路径（需要居中窄幅布局）
  const isWapRoute = pathname.startsWith('/student') || pathname.startsWith('/parent')

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      {/* 桌面端侧边栏（仅 lg 以上显示） */}
      {!isMobile && <SideBar />}

      {/* 移动端侧滑抽屉 */}
      {isMobile && (
        <HamburgerSheet open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <DemoEnv />

        {/* 桌面端完整顶栏 / 移动端精简顶栏 */}
        {isMobile ? (
          <header className="h-11 bg-white border-b border-border flex items-center px-3 shrink-0 gap-2 z-30">
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-brand rounded-lg active:bg-gray-100"
            >
              <Menu size={20} />
            </button>
            <span className="text-[13px] font-medium text-gray-800 truncate flex-1">
              {isWapRoute ? (pathname.startsWith('/student') ? '知微教学' : '知微家校') : '知微教学'}
            </span>
            {/* 移动端显示小红点通知 */}
            <button className="relative w-8 h-8 flex items-center justify-center text-gray-500">
              <span className="w-2 h-2 rounded-full bg-[#DC3545]" />
            </button>
          </header>
        ) : (
          <TopNavBar />
        )}

        {/* 主内容区 */}
        <main className={`flex-1 overflow-auto ${isMobile ? 'p-3 pb-20' : 'p-5'}`}>
          {/* WAP 路由在桌面端居中窄幅显示，移动端全宽 */}
          {isWapRoute && !isMobile ? (
            <div className="max-w-2xl mx-auto">
              <Outlet />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* 小微 AI 助手（桌面端浮动 / 移动端底部全屏面板） */}
      <XiaoWeiChat />

      {/* 移动端底部导航栏 */}
      <BottomNavBar />
    </div>
  )
}
