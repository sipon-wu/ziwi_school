import { useState, useMemo, useEffect, type ReactNode } from 'react'
import {
  LayoutGrid, BookOpen, FileText, PenTool, Files, Send, Image as ImgIcon,
  ListChecks, BarChart3, Footprints, MessageCircle, PenLine, Heart,
  Repeat, Settings, GitPullRequest, ChevronDown, ChevronRight, PanelLeft
} from 'lucide-react'
import HeaderRight from './HeaderRight'
import LogoText from './LogoText'

/* ──────── Sidebar ──────── */
type SidebarGroup = { id: string; label: string; icon: ReactNode; to?: string; children?: SidebarChild[] }
type SidebarChild = { label: string; icon: ReactNode; to: string }

const SIDEBAR: SidebarGroup[] = [
  { id: 'home', label: '首页', icon: <LayoutGrid size={16} />, to: '/teacher' },
  { id: '备课', label: '教学备课', icon: <BookOpen size={16} />, children: [
    { label: '教案草稿箱', icon: <FileText size={14} />, to: '/lesson-plans' },
    { label: '教案发布库', icon: <FileText size={14} />, to: '/published-lessons' },
    { label: '教案互审', icon: <GitPullRequest size={14} />, to: '/review-pool' },
  ]},
  { id: '素材', label: '素材库', icon: <ImgIcon size={16} />, to: '/materials' },
  { id: '练习', label: '作业练习', icon: <ListChecks size={16} />, children: [
    { label: '出题·题库', icon: <PenTool size={14} />, to: '/exercises' },
    { label: '组卷·试卷库', icon: <Files size={14} />, to: '/exams' },
    { label: '作业布置', icon: <Send size={14} />, to: '/assignments' },
  ]},
  { id: '数据', label: '教学数据', icon: <BarChart3 size={16} />, children: [
    { label: '学情分析', icon: <BarChart3 size={14} />, to: '/analytics' },
    { label: '成长足迹', icon: <Footprints size={14} />, to: '/growth' },
  ]},
  { id: '沟通', label: '家校沟通', icon: <MessageCircle size={16} />, children: [
    { label: '家长签字', icon: <PenLine size={14} />, to: '/parent-sign' },
    { label: '成长关爱', icon: <Heart size={14} />, to: '/care' },
  ]},
  { id: '个人', label: '个人中心', icon: <Settings size={16} />, children: [
    { label: '班级切换', icon: <Repeat size={14} />, to: '/classes' },
    { label: '系统设置', icon: <Settings size={14} />, to: '/settings' },
  ]},
]

function safeGetUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') || {} } catch { return {} }
}

interface Props {
  children: ReactNode
  title?: string
}

export default function AppLayout({ children }: Props) {
  const user = safeGetUser()
  const [collapsed, setCollapsed] = useState(false)
  const path = window.location.pathname

  // 根据当前路径自动展开所属分组
  const autoExpanded = useMemo(() => {
    const ids = new Set<string>()
    SIDEBAR.forEach(g => {
      if (g.children?.some(c => path.startsWith(c.to))) {
        ids.add(g.id)
      }
    })
    return ids
  }, [path])

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // 初始：自动展开当前路径所属分组，默认至少展开「备课」
    const init = new Set(autoExpanded)
    if (init.size === 0) init.add('备课')
    return init
  })

  // 路径变化时同步展开对应分组
  useEffect(() => {
    setExpanded(prev => {
      const next = new Set(prev)
      let changed = false
      autoExpanded.forEach(id => {
        if (!next.has(id)) { next.add(id); changed = true }
      })
      return changed ? next : prev
    })
  }, [autoExpanded])

  const sidebarW = collapsed ? 56 : 220

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  return (
    <div className="flex h-screen bg-[#F6F7F8]">
      {/* ── Sidebar ── */}
      <aside className="fixed top-0 left-0 bottom-0 bg-[#212529] flex flex-col z-50" style={{ width: sidebarW }}>
        <div className="h-12 flex items-center justify-start px-3 shrink-0">
          {collapsed ? (
            <img src="/ziwiAI.jpg" alt="知微" className="w-7 h-7 rounded-sm" />
          ) : (
            <LogoText>
              <span className="text-[11px] opacity-60 font-normal ml-1">(AI)</span>
            </LogoText>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-2 sidebar-scroll">
          {SIDEBAR.map((g) => {
            const active = g.to && path.startsWith(g.to)
            const exp = expanded.has(g.id)
            if (collapsed) return (
              <a key={g.id} href={g.to || g.children?.[0]?.to || '/teacher'} title={g.label}
                className={`flex items-center justify-center py-3 ${active ? 'text-white bg-[#1F2C3D]' : 'text-white/50 hover:text-white hover:bg-white/[0.06]'}`}>
                {g.icon}
              </a>
            )
            return (
              <div key={g.id}>
                {!g.children ? (
                  <a href={g.to!}
                    className={`flex items-center px-4 py-2.5 gap-3 text-[13px] ${active ? 'text-white bg-[#1F2C3D] border-l-[3px] border-[#1A3A6B]' : 'text-white/65 hover:text-white hover:bg-white/[0.06]'}`}>
                    {g.icon}<span>{g.label}</span>
                  </a>
                ) : (
                  <>
                    <button onClick={() => toggle(g.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 gap-3 text-[13px] text-white/65 hover:text-white hover:bg-white/[0.06]">
                      <span className="flex items-center gap-3">{g.icon}<span>{g.label}</span></span>
                      {exp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {exp && g.children.map((c) => (
                      <a key={c.to} href={c.to}
                        className={`flex items-center px-4 py-2 pl-11 gap-2 text-[13px] ${path.startsWith(c.to) ? 'text-white bg-[#1F2C3D] border-l-[3px] border-[#1A3A6B]' : 'text-white/65 hover:text-white hover:bg-white/[0.06]'}`}>
                        {c.icon}<span>{c.label}</span>
                      </a>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </nav>
        {!collapsed && (
          <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/40">知微网 | 版权所有</div>
        )}
      </aside>

      {/* ── Main ── */}
      <div style={{ marginLeft: sidebarW, flex: 1, minWidth: 0 }}>
        {/* Header */}
        <header className="h-12 bg-white border-b border-[#E7E7EB] flex items-center pr-5 justify-between sticky top-0 z-40" style={{ paddingLeft: 0 }}>
          <div className="flex items-center gap-2">
            <button onClick={() => setCollapsed(!collapsed)} className="text-[#9A9A9A] hover:text-[#353535] px-2.5 h-12 flex items-center justify-center" title={collapsed ? '展开侧边栏' : '收起侧边栏'}>
              <PanelLeft size={16} style={{ transform: collapsed ? 'rotate(180deg)' : undefined }} />
            </button>
            {path === '/settings' ? (
              <span className="text-[13px] text-[#9A9A9A]">个人中心 - 系统设置</span>
            ) : (
              <>
                <span className="text-[13px] text-[#353535]">{user?.school_name || '成都市金牛区第一小学'}</span>
                <div className="flex items-center gap-1 ml-3 text-[13px] bg-white border border-[#E7E7EB] rounded-[3px] px-2.5 py-1 cursor-pointer hover:border-[#02A7F0]">
                  <span>语文 · 四年级 (1班)</span>
                  <span className="text-[#9A9A9A] text-xs ml-1">▾</span>
                </div>
              </>
            )}
          </div>
          <HeaderRight variant="light" />
        </header>

        {/* Content */}
        <main className="p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
