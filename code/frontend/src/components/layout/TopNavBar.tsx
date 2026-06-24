import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, LogOut, Settings, BookOpen, CircuitBoard } from 'lucide-react'
import { clearToken, schoolConfigAPI, tokenQuotaAPI } from '@/lib/api'
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
  const [showProvince, setShowProvince] = useState(false)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const teaching = useTeaching()

  // 学校配置（知识图谱总开关）— 初始false避免API返回前闪烁
  const [schoolEnableKG, setSchoolEnableKG] = useState(false)
  // Token 配额
  const [tokenQuota, setTokenQuota] = useState({ used: 0, total: 0, pct: 0, level: 'normal' as string })

  const breadcrumbs = useMemo(() => getBreadcrumbs(pathname), [pathname])

  // 加载学校配置 + 配额
  useEffect(() => {
    schoolConfigAPI.fetch().then((res: any) => {
      if (res?.data?.enable_knowledge_graph !== undefined) {
        setSchoolEnableKG(res.data.enable_knowledge_graph)
      }
    }).catch(() => {})
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

  // 图谱开关切换
  const handleKGToggle = useCallback(() => {
    if (!schoolEnableKG) {
      // 学校未开启 → 弹出申请弹窗
      setShowApplyModal(true)
      return
    }
    teaching.setKnowledgeGraphEnabled(!teaching.knowledgeGraphEnabled)
  }, [schoolEnableKG, teaching])

  // 提交申请
  const handleApplyFeature = useCallback(async () => {
    try {
      await schoolConfigAPI.featureRequest('knowledge_graph')
      setShowApplyModal(false)
      alert('已向校方提交知识图谱功能开启申请，请等待管理员审核')
    } catch {
      alert('申请提交失败，请稍后重试')
    }
  }, [])

  const handleLogout = () => { clearToken(); navigate('/login', { replace: true }) }

  // 省份选择自动匹配教材
  const provinces = Object.keys(PROVINCE_TO_TEXTBOOK_MATH).sort()

  return (
    <header className="h-11 bg-white border-b border-border flex items-center px-4 shrink-0 gap-2">
      {/* 面包屑 */}
      <div className="flex items-center gap-1 text-[12px] shrink-0">
        <span className="text-gray-400">工作台</span>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1"><span className="text-gray-300">/</span><span className={i === breadcrumbs.length - 1 ? 'text-gray-800 font-medium' : 'text-gray-500'}>{crumb}</span></span>
        ))}
      </div>

      {/* 教学配置 */}
      <div className="flex items-center gap-2 ml-auto mr-3">
        {/* 学科 */}
        <select value={teaching.subject} onChange={e => teaching.setSubject(e.target.value as any)} className="text-[12px] border border-border rounded px-2 py-1 bg-white outline-none focus:border-brand">
          <option>语文</option><option>数学</option><option>英语</option>
        </select>

        {/* 年级 + 学期 */}
        <div className="flex items-center text-[12px] text-gray-500 gap-0.5">
          <select value={teaching.grade} onChange={e => teaching.setGrade(Number(e.target.value))} className="border border-border rounded px-1.5 py-1 bg-white outline-none focus:border-brand">
            {[1,2,3,4,5,6,7,8,9].map(g => <option key={g} value={g}>{g}年级</option>)}
          </select>
          <select value={teaching.semester} onChange={e => teaching.setSemester(e.target.value as any)} className="border border-border rounded px-1.5 py-1 bg-white outline-none focus:border-brand">
            <option value="上">上</option><option value="下">下</option>
          </select>
        </div>

        {/* 教材版本 */}
        <div className="relative flex items-center gap-1 text-[12px] text-gray-500">
          <BookOpen size={13} className="text-gray-400" />
          {teaching.subject === '语文' ? (
            <span className="text-gray-400">部编版</span>
          ) : (
            <select value={teaching.textbook_math} onChange={e => teaching.setTextbookMath(e.target.value)} className="border border-border rounded px-1.5 py-1 bg-white outline-none focus:border-brand max-w-[90px]">
              {ALL_MATH_TEXTBOOKS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {/* 省份快速选 */}
          <button onClick={() => setShowProvince(!showProvince)} className="text-[10px] text-brand hover:underline ml-0.5">省</button>
          {showProvince && (
            <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 max-h-[200px] overflow-y-auto z-50 w-[140px]">
              {provinces.map(p => (
                <button key={p} onClick={() => { teaching.setTextbookMath(PROVINCE_TO_TEXTBOOK_MATH[p]); setShowProvince(false) }} className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50">
                  {p} <span className="text-gray-400 text-[10px]">→{PROVINCE_TO_TEXTBOOK_MATH[p]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 知识图谱开关 */}
        <button
          onClick={handleKGToggle}
          disabled={!schoolEnableKG}
          title={schoolEnableKG ? (teaching.knowledgeGraphEnabled ? '已开启知识图谱' : '点击开启知识图谱') : '学校未开启知识图谱，点击申请'}
          className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border transition-colors ${
            teaching.knowledgeGraphEnabled
              ? 'bg-brand/10 text-brand border-brand/30'
              : schoolEnableKG
                ? 'text-gray-400 border-gray-200 hover:border-brand/30'
                : 'text-gray-300 border-gray-200 cursor-not-allowed opacity-60'
          }`}
        >
          <CircuitBoard size={12} />
          <span>图谱</span>
        </button>

        {/* Token 进度环 */}
        {tokenQuota.total > 0 && (
          <div className="relative flex items-center" title={`本月Token: ${tokenQuota.used.toLocaleString()} / ${tokenQuota.total.toLocaleString()}`}>
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
      </div>

      {/* 右侧 */}
      <div className="flex items-center gap-3">
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

      {/* 知识图谱申请弹窗 */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowApplyModal(false)}>
          <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">申请开启知识图谱</h3>
            <p className="text-[13px] text-gray-500 mb-4">贵校尚未开启知识图谱功能。是否向校方管理员提交开启申请？</p>
            <div className="flex gap-2">
              <button onClick={() => setShowApplyModal(false)} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handleApplyFeature} className="flex-1 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover">确认申请</button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
