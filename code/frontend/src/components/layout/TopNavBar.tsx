import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, LogOut, Settings } from 'lucide-react'
import { clearToken } from '@/lib/api'

// 读取已保存头像
function getAvatar(): string {
  return localStorage.getItem('zhiwei_avatar') || ''
}

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': '工作台',
  '/dashboard/lesson-plans': '教案备课',
  '/dashboard/lesson-plans/new': '新建教案',
  '/dashboard/exercises': '出题组卷',
  '/dashboard/exercises/new': '新建出题',
  '/dashboard/compositions': '习作指导',
  '/dashboard/grading': '批阅管理',
  '/dashboard/analytics': '班级学情',
  '/dashboard/parent-sign': '家长签字',
  '/dashboard/settings': '个人设置',
  '/dashboard/admin': '管理后台',
  '/dashboard/reviews': '教案互审',
  '/dashboard/principal': '校长仪表盘',
}

// 动态路由匹配
function getBreadcrumbs(pathname: string): string[] {
  // 精确匹配
  if (BREADCRUMB_MAP[pathname]) {
    return [BREADCRUMB_MAP[pathname]]
  }
  // 子路由匹配：/grading/:id → 批阅详情
  if (pathname.startsWith('/dashboard/grading/')) {
    return ['批阅管理', '批阅详情']
  }
  if (pathname.startsWith('/dashboard/lesson-plans/') && pathname.endsWith('/edit')) {
    return ['教案备课', '编辑教案']
  }
  if (pathname.startsWith('/dashboard/review/')) {
    return ['教案互审', '评审详情']
  }
  // 兜底
  return [BREADCRUMB_MAP[pathname] || pathname.replace('/dashboard/', '')]
}

export default function TopNavBar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(getAvatar)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const breadcrumbs = useMemo(() => getBreadcrumbs(pathname), [pathname])

  // 监听头像更新事件
  useEffect(() => {
    const handler = (e: Event) => setAvatarUrl((e as CustomEvent).detail)
    window.addEventListener('avatar-updated', handler)
    return () => window.removeEventListener('avatar-updated', handler)
  }, [])

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
      {/* 动态面包屑 */}
      <div className="flex items-center gap-1.5 text-[13px]">
        <span className="text-gray-400">工作台</span>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-gray-300">/</span>
            <span className={i === breadcrumbs.length - 1 ? 'text-gray-800 font-medium' : 'text-gray-500'}>{crumb}</span>
          </span>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <select className="text-[13px] border border-border rounded-lg px-3 py-1.5 bg-white text-gray-700 outline-none focus:border-brand">
          <option>三年级 · 语文</option>
          <option>四年级 · 语文</option>
          <option>三年级 · 数学</option>
        </select>

        <button className="relative p-1 text-gray-500 hover:text-brand transition-colors" title="通知">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[14px] rounded-full bg-[#DC3545] text-white text-[10px] font-medium flex items-center justify-center leading-none">3</span>
        </button>

        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(!menuOpen)} className="w-7 h-7 rounded-full overflow-hidden hover:ring-2 hover:ring-brand/30 transition-all">
            {avatarUrl ? (
              <img src={avatarUrl} alt="头像" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-brand/20 text-brand text-xs font-medium flex items-center justify-center">张</div>
            )}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <button onClick={() => { setMenuOpen(false); navigate('/dashboard/settings') }} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors">
                <Settings size={14} />设置
              </button>
              <button onClick={() => { setMenuOpen(false); handleLogout() }} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors">
                <LogOut size={14} />退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
