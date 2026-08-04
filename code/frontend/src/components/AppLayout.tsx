import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import {
  LayoutGrid, BookOpen, FileText, PenTool, Files, Send, Image as ImgIcon,
  ListChecks, BarChart3, Footprints, MessageCircle, PenLine, Heart,
  Repeat, Settings, GitPullRequest, ChevronDown, ChevronRight, PanelLeft, Check,
  MonitorPlay, Smartphone, Video
} from 'lucide-react'
import HeaderRight from './HeaderRight'
import XiaoWeiChat from './XiaoWeiChat'
import { useTeaching, GRADE_NAMES } from '../lib/TeachingContext'
import { classAPI, notifyError } from '../lib/api'

/* ──────── Sidebar ──────── */
type SidebarGroup = { id: string; label: string; icon: ReactNode; to?: string; children?: SidebarChild[] }
type SidebarChild = { label: string; icon: ReactNode; to: string; requireSchool?: boolean; soon?: boolean }

const SIDEBAR: SidebarGroup[] = [
  { id: 'home', label: '首页', icon: <LayoutGrid size={16} />, to: '/teacher' },
  { id: '备课', label: '教学备课', icon: <BookOpen size={16} />, children: [
    { label: '教案草稿箱', icon: <FileText size={14} />, to: '/lesson-plans' },
    { label: '教案发布库', icon: <FileText size={14} />, to: '/published-lessons' },
    { label: '教案互审', icon: <GitPullRequest size={14} />, to: '/review-pool' },
  ]},
  { id: '课件', label: '教学课件', icon: <MonitorPlay size={16} />, children: [
    { label: 'PPT 课件', icon: <MonitorPlay size={14} />, to: '/courseware/ppt' },
    { label: 'H5 互动课件', icon: <Smartphone size={14} />, to: '/courseware/h5', soon: true },
    { label: '视频课件', icon: <Video size={14} />, to: '/courseware/video', soon: true },
  ]},
  { id: '练习', label: '作业练习', icon: <ListChecks size={16} />, children: [
    { label: '出题·题库', icon: <PenTool size={14} />, to: '/exercises' },
    { label: '组卷·试卷库', icon: <Files size={14} />, to: '/exams' },
    { label: '作业布置', icon: <Send size={14} />, to: '/assignments' },
  ]},
  { id: '素材', label: '素材库', icon: <ImgIcon size={16} />, to: '/materials' },
  { id: '数据', label: '教学数据', icon: <BarChart3 size={16} />, children: [
    { label: '学情分析', icon: <BarChart3 size={14} />, to: '/analytics' },
    { label: '成长足迹', icon: <Footprints size={14} />, to: '/growth' },
  ]},
  { id: '沟通', label: '家校沟通', icon: <MessageCircle size={16} />, children: [
    { label: '家长签字', icon: <PenLine size={14} />, to: '/parent-sign', requireSchool: true },
    { label: '成长关爱', icon: <Heart size={14} />, to: '/care', requireSchool: true },
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
  const teaching = useTeaching()
  const [collapsed, setCollapsed] = useState(false)
  const [myClasses, setMyClasses] = useState<Array<{ class_id: string; class_name: string; grade: string; subject: string; is_primary: boolean }>>([])
  const [openCC, setOpenCC] = useState(false)
  const ccRef = useRef<HTMLDivElement>(null)
  const path = window.location.pathname

  const gradeToNum = (g?: string) => { const i = GRADE_NAMES.indexOf(g || ''); return i >= 0 ? i + 1 : 4 }

  // 拉取当前教师任教的「班级-学科」
  useEffect(() => {
    let alive = true
    classAPI.myClasses().then(r => {
      if (!alive) return
      const items = r.items || []
      setMyClasses(items)
      // 首次进入（无选中班级）时，自动选中主班级
      if (items.length > 0 && !teaching.selectedClassId) {
        const primary = items.find(i => i.is_primary) || items[0]
        teaching.setSubject(primary.subject)
        teaching.setGrade(gradeToNum(primary.grade))
        teaching.selectClass(toClassInfo(primary))
      }
    }).catch((e) => notifyError('初始化班级信息失败', e))
    return () => { alive = false }
  }, [])

  // 点击外部关闭下拉
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ccRef.current && !ccRef.current.contains(e.target as Node)) setOpenCC(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const currentCC = myClasses.find(i => i.class_id === teaching.selectedClassId)
  const toClassInfo = (item: { class_id: string; class_name: string; grade: string; subject: string; is_primary: boolean }) => ({
    id: item.class_id, label: item.class_name, courseGroupId: '', subject: item.subject as '语文' | '数学' | '英语', grade: gradeToNum(item.grade), semester: '下' as const, textbook: '',
  })
  const switchCC = (item: { class_id: string; class_name: string; grade: string; subject: string; is_primary: boolean }) => {
    teaching.setSubject(item.subject)
    teaching.setGrade(gradeToNum(item.grade))
    teaching.selectClass(toClassInfo(item))
    setOpenCC(false)
  }

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
    // 持久化：用户主动收起/展开后刷新保持；首次访问默认全部展开
    try {
      const saved = JSON.parse(localStorage.getItem('ziwi_sidebar_expanded') || 'null')
      if (Array.isArray(saved)) return new Set(saved)
    } catch {}
    return new Set(['备课', '练习', '数据', '沟通', '个人', '课件'])
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
    localStorage.setItem('ziwi_sidebar_expanded', JSON.stringify([...next]))
    setExpanded(next)
  }

  return (
    <div className="flex h-screen bg-[#F6F7F8]">
      {/* ── Sidebar ── */}
      <aside className="fixed top-0 left-0 bottom-0 bg-white flex flex-col z-50 border-r border-[#F0F0F0]" style={{ width: sidebarW }}>
        {/* LOGO */}
        <div className="h-12 px-4 flex items-center border-b border-[#F0F0F0]">
          {collapsed ? (
            <div className="flex items-center justify-center">
              <img src="/ziwiAI.jpg" alt="知微" className="w-6 h-6 shrink-0"
                style={{ boxShadow: '0 0 0 1px rgba(128,128,128,0.50)', borderRadius: 6 }} />
            </div>
          ) : (
            <div className="flex items-center gap-[8px]">
              <img src="/ziwiAI.jpg" alt="知微" className="w-6 h-6 shrink-0"
                style={{ boxShadow: '0 0 0 1px rgba(128,128,128,0.50)', borderRadius: 6 }} />
              <span className="text-[13px] font-semibold text-[#353535] leading-none">
                知微教学<span className="text-[11px] opacity-60 font-normal ml-1">(AI)</span>
              </span>
            </div>
          )}
        </div>
        {/* 导航 */}
        <nav className="flex-1 overflow-y-auto p-[8px] sidebar-scroll">
          {SIDEBAR.map((g) => {
            const hasActiveChild = g.children?.some(c => path.startsWith(c.to)) ?? false
            const groupActive = g.to ? path.startsWith(g.to) : hasActiveChild
            const exp = expanded.has(g.id)
            if (collapsed) return (
              <a key={g.id} href={g.to || g.children?.[0]?.to || '/teacher'} title={g.label}
                className="flex items-center justify-center py-3 text-[#353535] hover:bg-[#F6F7F8] rounded-[6px]">
                {g.icon}
              </a>
            )
            return (
              <div key={g.id} className="mt-[2px]">
                {!g.children ? (
                  <a href={g.to!}
                    className={`flex items-center gap-[8px] px-[10px] py-[6px] rounded-[6px] text-[14px] leading-[24px] font-[400] ${groupActive ? 'text-[#02A7F0]' : 'text-[#353535] hover:bg-[#F6F7F8]'}`}>
                    {g.icon}<span>{g.label}</span>
                  </a>
                ) : (
                  <>
                    <button onClick={() => toggle(g.id)}
                      className={`w-full flex items-center gap-[8px] px-[10px] py-[6px] rounded-[6px] text-[14px] leading-[24px] font-[400] ${groupActive ? 'text-[#02A7F0]' : 'text-[#353535] hover:bg-[#F6F7F8]'}`}>
                      {g.icon}<span>{g.label}</span>
                      <span className="ml-auto">{exp
                        ? <ChevronDown size={12} strokeWidth={2} />
                        : <ChevronRight size={12} strokeWidth={2} />}</span>
                    </button>
                    {exp && (
                      <div className="flex flex-col gap-[1px] mt-[2px]">
                        {g.children.map((c) => {
                          const childActive = path.startsWith(c.to)
                          if (c.soon) {
                            return (
                              <span key={c.to}
                                title="即将上线"
                                className="flex items-center gap-[6px] pl-[34px] pr-[12px] py-[4px] text-[14px] leading-[24px] font-[400] text-[#B0B8C4] cursor-not-allowed">
                                {c.icon}<span>{c.label}</span>
                                <span className="ml-auto text-[10px] px-1 bg-[#B0B8C4] text-white rounded">即将上线</span>
                              </span>
                            )
                          }
                          return (
                            <a key={c.to} href={c.to}
                              className={`flex items-center gap-[6px] pl-[34px] pr-[12px] py-[4px] text-[14px] leading-[24px] font-[400] ${childActive ? 'bg-[#02A7F0] text-white rounded-[999px]' : 'text-[#9A9A9A] hover:text-[#353535]'}`}>
                              {c.icon}<span>{c.label}</span>
                            </a>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </nav>
        {!collapsed && (
          <div className="px-4 py-3 border-t border-[#F0F0F0] text-[11px] text-[#9A9A9A]">知微网 | 版权所有</div>
        )}
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-col overflow-hidden" style={{ marginLeft: sidebarW, width: sidebarW ? `calc(100% - ${sidebarW}px)` : undefined, height: '100%' }}>
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
                {myClasses.length > 0 ? (
                  <div className="relative ml-3" ref={ccRef}>
                    <button
                      onClick={() => setOpenCC(o => !o)}
                      className="flex items-center gap-1 text-[13px] bg-white border border-[#E7E7EB] rounded-[3px] px-2.5 py-1 cursor-pointer hover:border-[#02A7F0] transition-colors"
                    >
                      <span className="max-w-[220px] truncate">{teaching.subject} · {GRADE_NAMES[teaching.grade - 1]}{currentCC ? ` (${currentCC.class_name})` : ''}</span>
                      <span className="text-[#9A9A9A] text-xs ml-1">▾</span>
                    </button>
                    {openCC && (
                      <div className="absolute left-0 top-9 z-50 w-56 bg-white border border-[#E7E7EB] rounded-[4px] shadow-lg py-1 max-h-72 overflow-y-auto">
                        {myClasses.map(it => {
                          const active = it.class_id === teaching.selectedClassId
                          return (
                            <button
                              key={it.class_id + it.subject}
                              onClick={() => switchCC(it)}
                              className={`w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 transition-colors ${active ? 'bg-[#02A7F0]/10 text-[#02A7F0]' : 'text-[#353535] hover:bg-[#F9FAFB]'}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-[#52C41A]' : 'bg-[#E7E7EB]'}`} />
                              <span className="flex-1">{it.subject} · {it.grade} · {it.class_name}</span>
                              {it.is_primary && <span className="text-[10px] text-[#9A9A9A]">主</span>}
                              {active && <Check size={12} className="text-[#52C41A]" />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  // 无任教班级的教师（如种子教师）：仍可按学科切换年级浏览内容
                  <div className="relative ml-3 flex items-center gap-1">
                    <span className="text-[13px] text-[#353535]">{teaching.subject} ·</span>
                    <select
                      value={teaching.grade - 1}
                      onChange={e => teaching.setGrade(Number(e.target.value) + 1)}
                      className="text-[13px] bg-white border border-[#E7E7EB] rounded-[3px] px-2 py-1 cursor-pointer hover:border-[#02A7F0] outline-none text-[#353535]"
                      title="切换年级"
                    >
                      {GRADE_NAMES.map((g, i) => <option key={g} value={i}>{g}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
          <HeaderRight variant="light" />
        </header>

        {/* Content */}
        <main className="p-4 flex-1 min-h-0 overflow-y-auto">
          {children}
        </main>

        {/* 小微助手插件 — 个人中心页不显示 */}
        {!path.startsWith('/settings') && <XiaoWeiChat />}
      </div>
    </div>
  )
}
