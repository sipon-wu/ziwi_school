import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, LogOut, Settings } from 'lucide-react'
import { clearToken } from '@/lib/api'

export default function TopNavBar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // 点击外部关闭菜单
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <header className="h-11 bg-white border-b border-border flex items-center px-5 shrink-0">
      <span className="text-[13px] text-gray-500">工作台</span>
      <span className="text-[13px] text-gray-300 mx-2">/</span>
      <span className="text-[13px] text-gray-800 font-medium">首页</span>

      <div className="ml-auto flex items-center gap-4">
        {/* 学科/年级切换 */}
        <select className="text-[13px] border border-border rounded-lg px-3 py-1.5 bg-white text-gray-700 outline-none focus:border-brand">
          <option>三年级 · 语文</option>
          <option>四年级 · 语文</option>
          <option>三年级 · 数学</option>
        </select>

        {/* 通知 */}
        <button className="relative p-1 text-gray-500 hover:text-brand transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[14px] rounded-full bg-[#DC3545] text-white text-[10px] font-medium flex items-center justify-center leading-none">
            3
          </span>
        </button>

        {/* 头像 + 下拉菜单 */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-7 h-7 rounded-full bg-brand/20 text-brand text-xs font-medium flex items-center justify-center hover:ring-2 hover:ring-brand/30 transition-all"
          >
            张
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-9 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <button
                onClick={() => { setMenuOpen(false); navigate('/dashboard/settings') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Settings size={14} />
                设置
              </button>
              <button
                onClick={() => { setMenuOpen(false); handleLogout() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={14} />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
