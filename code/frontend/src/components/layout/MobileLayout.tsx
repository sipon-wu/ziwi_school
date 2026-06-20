import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

interface TabConfig {
  path: string
  label: string
  icon: any
}

export default function MobileLayout({ tabs, title }: {
  tabs?: TabConfig[]
  title: string
}) {
  const navigate = useNavigate()
  const location = useLocation()

  const isRoot = tabs && tabs.some(t => location.pathname === t.path || location.pathname.startsWith(t.path + '/'))

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col max-w-md mx-auto relative">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#1A3A6B] to-[#2B5DA8] text-white shadow-md">
        <div className="flex items-center h-12 px-3">
          {!isRoot ? (
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center -ml-1"
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <div className="w-8" />
          )}
          <h1 className="flex-1 text-center font-medium text-[15px] truncate px-2">{title}</h1>
          <div className="w-8" />
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      {/* 底部导航栏 */}
      {tabs && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 safe-area-bottom z-50">
          <div className="flex h-14">
            {tabs.map(tab => {
              const active = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/')
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    active ? 'text-[#1A3A6B]' : 'text-gray-400'
                  }`}
                >
                  <tab.icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                  <span className={`text-[10px] font-medium ${active ? 'scale-105' : ''}`}>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
