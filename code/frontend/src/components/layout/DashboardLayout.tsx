import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import SideBar from './SideBar'
import TopNavBar from './TopNavBar'
import BottomNavBar from './BottomNavBar'
import HamburgerSheet from './HamburgerSheet'
import GlobalStatusBar from './GlobalStatusBar'
import SidePanel from './SidePanel'
import XiaoWeiChat from '../XiaoWeiChat'
import DemoEnv from '../DemoEnv'
import KnowledgePanel from '../KnowledgePanel'
import { KnowledgeGraphProvider, useKGContext } from '@/lib/KnowledgeGraphContext'
import { useTeaching } from '@/lib/TeachingContext'
import { useIsMobile } from '@/hooks/useMediaQuery'

/** 知识图谱面板插槽（>=lg 时在右侧显示） */
function KnowledgePanelSlot() {
  const { picker } = useKGContext()
  const teaching = useTeaching()

  if (!teaching.knowledgeGraphEnabled || !picker) return null

  return (
    <KnowledgePanel
      picker={picker}
      onClose={() => teaching.setKnowledgeGraphEnabled(false)}
    />
  )
}

/** 判断当前路由是否需要显示 SidePanel */
function useIsWorkbenchPage(): boolean {
  const { pathname } = useLocation()
  return pathname === '/dashboard' || pathname === '/dashboard/'
}

/** 判断当前路由是否为编辑器页面（显示 KnowledgePanel） */
function useIsEditorPage(): boolean {
  const { pathname } = useLocation()
  return (
    pathname.includes('/lesson-plans/') ||
    pathname.includes('/exercises/new') ||
    pathname.includes('/compositions/')
  )
}

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()
  const { pathname } = useLocation()
  const teaching = useTeaching()

  const isWapRoute = pathname.startsWith('/student') || pathname.startsWith('/parent')
  const isWorkbench = useIsWorkbenchPage()
  const isEditor = useIsEditorPage()

  return (
    <KnowledgeGraphProvider>
      <div className="flex h-screen overflow-hidden bg-page">
        {/* 桌面端侧边栏 */}
        {!isMobile && <SideBar />}

        {/* 移动端侧滑抽屉 */}
        {isMobile && (
          <HamburgerSheet open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        )}

        <div className="flex flex-1 flex-col min-w-0">
          {/* 全局状态栏（>=lg 深蓝底） */}
          <GlobalStatusBar />

          {/* 环境标识横幅 */}
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
              <button className="relative w-8 h-8 flex items-center justify-center text-gray-500">
                <span className="w-2 h-2 rounded-full bg-[#DC3545]" />
              </button>
            </header>
          ) : (
            <TopNavBar />
          )}

          {/* 主内容区 + 右侧面板（知识图谱 / SidePanel） */}
          <div className="flex flex-1 min-h-0">
            <main className={`flex-1 overflow-auto ${isMobile ? 'p-3 pb-20' : 'p-5'}`}>
              {isWapRoute && !isMobile ? (
                <div className="max-w-2xl mx-auto">
                  <Outlet />
                </div>
              ) : (
                <Outlet />
              )}
            </main>

            {/* 右侧面板区域：编辑器用 KnowledgePanel，工作台用 SidePanel，互斥 */}
            {isEditor && <KnowledgePanelSlot />}
            {isWorkbench && !isMobile && !teaching.knowledgeGraphEnabled && <SidePanel />}
          </div>
        </div>

        {/* 小微 AI 助手 */}
        <XiaoWeiChat />

        {/* 移动端底部导航栏 */}
        <BottomNavBar />
      </div>
    </KnowledgeGraphProvider>
  )
}
