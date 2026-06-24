import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTeaching } from '@/lib/TeachingContext'
import { useNavigation } from '@/hooks/useNavigation'
import type { NavGroup } from '@/hooks/useNavigation'

function getAvatar(): string {
  return localStorage.getItem('zhiwei_avatar') || ''
}

/** 单组导航 */
function NavGroupSection({
  group,
  collapsed,
  pathname,
  expanded,
  onToggle,
}: {
  group: NavGroup
  collapsed: boolean
  pathname: string
  expanded: boolean
  onToggle: () => void
}) {
  const { icon: GroupIcon } = group

  return (
    <div className="mb-0.5">
      {/* 分组标题 */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center h-10 text-[11px] uppercase tracking-wider text-white/40 hover:text-white/60 hover:bg-white/5 transition-all duration-150 ${collapsed ? 'justify-center px-0' : 'gap-2 px-3'}`}
        title={collapsed ? group.label : undefined}
      >
        <GroupIcon className="w-4 h-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{group.label}</span>
            <ChevronDown
              size={12}
              className={`shrink-0 transition-transform duration-200 ${expanded ? 'rotate-0' : '-rotate-90'}`}
            />
          </>
        )}
      </button>

      {/* 子项展开 */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${
          expanded || collapsed ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {group.items.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to))
          return (
            <Link
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={`flex items-center h-10 text-[13px] transition-all duration-150 ${collapsed ? 'justify-center px-0' : 'gap-3 pl-7 pr-4'} ${
                active
                  ? 'bg-brand/40 text-white font-medium border-l-[3px] border-brand'
                  : 'text-white/70 hover:bg-white/10 border-l-[3px] border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function SideBar() {
  const { pathname } = useLocation()
  const teaching = useTeaching()
  const { groups, workbench, settings, isExpanded, toggleGroup } = useNavigation()
  const [avatarUrl, setAvatarUrl] = useState(getAvatar)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => setAvatarUrl((e as CustomEvent).detail)
    window.addEventListener('avatar-updated', handler)
    return () => window.removeEventListener('avatar-updated', handler)
  }, [])

  const gradeLabel = `${teaching.grade}年级${teaching.semester}`
  const subjectLabel = teaching.subject === '语文' ? '语文' : teaching.subject === '数学' ? '数学' : '英语'
  const workbenchActive = pathname === '/dashboard'
  const settingsActive = pathname === '/dashboard/settings'

  return (
    <aside className={`${collapsed ? 'w-[56px]' : 'w-[200px]'} bg-sidebar flex flex-col shrink-0 transition-[width] duration-250`}>
      {/* Logo */}
      <div className={`h-14 flex items-center border-b border-white/5 transition-all duration-200 ${collapsed ? 'justify-center px-2' : 'gap-2 px-4'}`}>
        <img src="/ziwiAI.jpg" alt="知微" className="w-7 h-7 rounded shrink-0" />
        {!collapsed && <span className="text-[15px] font-semibold text-white tracking-wide">知微教学</span>}
      </div>

      {/* 导航区域 */}
      <nav className="flex-1 py-2 overflow-auto">
        {/* 工作台 - 固定顶部 */}
        <div className="mb-0.5">
          <Link
            to={workbench.to}
            title={collapsed ? workbench.label : undefined}
            className={`flex items-center h-10 text-[13px] font-medium transition-all duration-150 ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
              workbenchActive
                ? 'bg-brand/40 text-white border-l-[3px] border-brand'
                : 'text-white/80 hover:bg-white/10 border-l-[3px] border-transparent'
            }`}
          >
            <workbench.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{workbench.label}</span>}
          </Link>
        </div>

        {/* 分组分隔线 */}
        <div className="mx-3 mb-2 border-t border-white/5" />

        {/* 四组导航 */}
        {groups.map(group => (
          <NavGroupSection
            key={group.id}
            group={group}
            collapsed={collapsed}
            pathname={pathname}
            expanded={isExpanded(group.id)}
            onToggle={() => toggleGroup(group.id)}
          />
        ))}

        {/* 底部分隔 */}
        <div className="mx-3 mt-2 mb-2 border-t border-white/5" />

        {/* 个人设置 - 固定底部 */}
        <Link
          to={settings.to}
          title={collapsed ? settings.label : undefined}
          className={`flex items-center h-10 text-[13px] transition-all duration-150 ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${
            settingsActive
              ? 'bg-brand/40 text-white border-l-[3px] border-brand'
              : 'text-white/50 hover:bg-white/10 border-l-[3px] border-transparent'
          }`}
        >
          <settings.icon className="w-4 h-4 shrink-0" />
          {!collapsed && <span>{settings.label}</span>}
        </Link>
      </nav>

      {/* 底部用户信息区 */}
      <div className="border-t border-white/5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center h-9 text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
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
