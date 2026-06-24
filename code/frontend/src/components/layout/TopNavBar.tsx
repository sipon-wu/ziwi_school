import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, LogOut, Settings, BookOpen } from 'lucide-react'
import { clearToken, tokenQuotaAPI } from '@/lib/api'
import { useTeaching, ALL_MATH_TEXTBOOKS, PROVINCE_TO_TEXTBOOK_MATH } from '@/lib/TeachingContext'

function getAvatar(): string {
  return localStorage.getItem('zhiwei_avatar') || ''
}

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': '工作台', '/dashboard/lesson-plans': '教案备课', '/dashboard/lesson-plans/new': '新建教案',
  '/dashboard/exercises': '出题组卷', '/dashboard/exercises/new': '新建出题',
  '/dashboard/compositions': '习作指导', '/dashboard/grading': '批阅管理',
  '/dashboard/analytics': '班级学情', '/dashboard/parent-sign': '家长签字',
  '/dashboard/settings': '个人设置', '/dashboard/admin': '管理后台',
  '/dashboard/reviews': '教案互审', '/dashboard/principal': '校长仪表盘',
}

function getBreadcrumbs(pathname: string): string[] {
  if (BREADCRUMB_MAP[pathname]) return [BREADCRUMB_MAP[pathname]]
  if (pathname.startsWith('/dashboard/grading/')) return ['批阅管理', '批阅详情']
  if (pathname.startsWith('/dashboard/lesson-plans/') && pathname.endsWith('/edit')) return ['教案备课', '编辑教案']
  if (pathname.startsWith('/dashboard/review/')) return ['教案互审', '评审详情']
  return [BREADCRUMB_MAP[pathname] || pathname.replace('/dashboard/', '')]
}

export default function TopNavBar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(getAvatar)
  const [showContextPopover, setShowContextPopover] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const contextRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const teaching = useTeaching()

  const [tokenQuota, setTokenQuota] = useState({ used: 0, total: 0, pct: 0, level: 'normal' as string })
  const breadcrumbs = useMemo(() => getBreadcrumbs(pathname), [pathname])

  useEffect(() => {
    tokenQuotaAPI.myQuota().then((res: any) => {
      if (res?.data) {
        setTokenQuota({
          used: res.data.used_monthly || 0,
          total: res.data.quota_monthly || 0,
          pct: res.data.usage_pct || 0,
          level: res.data.level || 'normal',
        })
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const h = (e: Event) => setAvatarUrl((e as CustomEvent).detail)
    window.addEventListener('avatar-updated', h)
    return () => window.removeEventListener('avatar-updated', h)
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // 关闭教学上下文弹窗
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) setShowContextPopover(false)
    }
    if (showContextPopover) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showContextPopover])

  const handleLogout = () => { clearToken(); navigate('/login', { replace: true }) }

  const subjectLabel = teaching.subject
  const gradeLabel = `${teaching.grade}年级${teaching.semester}`
  const textbookLabel = teaching.subject === '语文' ? '部编版' : teaching.textbook_math

  return (
    <header className="h-11 bg-white border-b border-border flex items-center px-4 shrink-0 gap-2">
      {/* 面包屑 */}
      <div className="flex items-center gap-1 text-[12px] shrink-0">
        <span className="text-gray-400">工作台</span>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1"><span className="text-gray-300">/</span><span className={i === breadcrumbs.length - 1 ? 'text-gray-800 font-medium' : 'text-gray-500'}>{crumb}</span></span>
        ))}
      </div>

      {/* 教学上下文 — 只读展示 + 点击弹窗快速切换 */}
      <div className="relative ml-auto mr-3" ref={contextRef}>
        <button
          onClick={() => setShowContextPopover(!showContextPopover)}
          className="flex items-center gap-1.5 text-[12px] text-gray-600 hover:text-brand border border-transparent hover:border-brand/20 rounded px-2 py-1 transition-colors cursor-pointer"
          title="点击切换教学配置"
        >
          <BookOpen size={13} className="text-gray-400" />
          <span className="text-gray-700 font-medium">{subjectLabel}</span>
          <span className="text-gray-400">·</span>
          <span>{gradeLabel}</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{textbookLabel}</span>
          <span className="text-[10px] text-gray-300 ml-0.5">▼</span>
        </button>

        {/* 快速切换弹窗 */}
        {showContextPopover && (
          <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 w-[340px]" onClick={e => e.stopPropagation()}>
            <div className="space-y-3">
              {/* 学科 */}
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">学科</label>
                <div className="flex gap-1.5">
                  {(['语文', '数学', '英语'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => { teaching.setSubject(s); setShowContextPopover(false) }}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                        teaching.subject === s ? 'bg-brand/10 text-brand border border-brand/30' : 'bg-gray-50 text-gray-600 border border-transparent hover:border-gray-200'
                      }`}
                    >{s}</button>
                  ))}
                </div>
              </div>

              {/* 年级 + 学期 */}
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">年级 · 学期</label>
                <div className="flex gap-2">
                  <select value={teaching.grade} onChange={e => teaching.setGrade(Number(e.target.value))} className="flex-1 text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand">
                    {[1,2,3,4,5,6,7,8,9].map(g => <option key={g} value={g}>{g}年级</option>)}
                  </select>
                  <select value={teaching.semester} onChange={e => teaching.setSemester(e.target.value as any)} className="w-20 text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand">
                    <option value="上">上学期</option><option value="下">下学期</option>
                  </select>
                </div>
              </div>

              {/* 教材版本（仅数学/英语显示完整选择器） */}
              {teaching.subject !== '语文' && (
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">教材版本</label>
                  <select value={teaching.textbook_math} onChange={e => teaching.setTextbookMath(e.target.value)} className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand">
                    {ALL_MATH_TEXTBOOKS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {Object.keys(PROVINCE_TO_TEXTBOOK_MATH).sort().map(p => (
                      <button key={p} onClick={() => { teaching.setTextbookMath(PROVINCE_TO_TEXTBOOK_MATH[p]); setShowContextPopover(false) }}
                        className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded hover:bg-brand/10 hover:text-brand">{p}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Token 进度环 */}
      {tokenQuota.total > 0 && (
        <div className="relative flex items-center shrink-0" title={`本月Token: ${tokenQuota.used.toLocaleString()} / ${tokenQuota.total.toLocaleString()}`}>
          <svg className="w-5 h-5 -rotate-90" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="#E5E7EB" strokeWidth="3" />
            <circle cx="12" cy="12" r="10" fill="none"
              stroke={tokenQuota.level === 'blocked' ? '#DC2626' : tokenQuota.level === 'danger' ? '#EF4444' : tokenQuota.level === 'warning' ? '#F59E0B' : '#3B82F6'}
              strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${Math.min(tokenQuota.pct, 100) * 0.628} 62.8`}
            />
          </svg>
          <span className={`text-[9px] font-medium ml-0.5 ${
            tokenQuota.level === 'blocked' ? 'text-red-600' : tokenQuota.level === 'danger' ? 'text-red-500' : tokenQuota.level === 'warning' ? 'text-amber-500' : 'text-blue-500'
          }`}>{Math.round(tokenQuota.pct)}%</span>
        </div>
      )}

      {/* 通知 + 头像 */}
      <div className="flex items-center gap-3 shrink-0">
        <button className="relative p-1 text-gray-500 hover:text-brand" title="通知"><Bell className="w-4 h-4" /><span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[12px] rounded-full bg-[#DC3545] text-white text-[9px] font-medium flex items-center justify-center leading-none">3</span></button>
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(!menuOpen)} className="w-6 h-6 rounded-full overflow-hidden hover:ring-2 hover:ring-brand/30 shrink-0">
            {avatarUrl ? <img src={avatarUrl} alt="头像" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-brand/20 text-brand text-[10px] font-medium flex items-center justify-center">张</div>}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <button onClick={() => { setMenuOpen(false); navigate('/dashboard/settings') }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50"><Settings size={13} />设置</button>
              <button onClick={() => { setMenuOpen(false); handleLogout() }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-red-600 hover:bg-red-50"><LogOut size={13} />退出登录</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
