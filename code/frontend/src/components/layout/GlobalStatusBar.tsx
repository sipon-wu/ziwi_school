import { useState, useEffect } from 'react'
import { Zap, Bell } from 'lucide-react'
import { tokenQuotaAPI } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface QuotaState {
  used: number
  total: number
  pct: number
  level: 'normal' | 'warning' | 'danger' | 'blocked'
}

const LEVEL_STYLES: Record<string, string> = {
  normal: 'text-blue-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
  blocked: 'text-red-500',
}

export default function GlobalStatusBar() {
  const isMobile = useIsMobile()
  const [quota, setQuota] = useState<QuotaState>({ used: 0, total: 0, pct: 0, level: 'normal' })

  useEffect(() => {
    tokenQuotaAPI.myQuota().then((res: any) => {
      if (res?.data) {
        setQuota({
          used: res.data.used_monthly || 0,
          total: res.data.quota_monthly || 0,
          pct: res.data.usage_pct || 0,
          level: res.data.level || 'normal',
        })
      }
    }).catch(() => {})
  }, [])

  // 仅 >=lg 显示
  if (isMobile) return null

  return (
    <div className="hidden lg:flex items-center justify-between h-7 px-4 bg-[#0F1D35] text-[11px] text-white/70 shrink-0 select-none">
      {/* 左侧：系统状态 */}
      <div className="flex items-center gap-4">
        {/* Token 用量 */}
        {quota.total > 0 && (
          <div className="flex items-center gap-1.5" title={`本月Token: ${quota.used.toLocaleString()} / ${quota.total.toLocaleString()}`}>
            <Zap size={11} className={LEVEL_STYLES[quota.level]} />
            <span>Token</span>
            <span className={`font-medium ${LEVEL_STYLES[quota.level]}`}>{Math.round(quota.pct)}%</span>
          </div>
        )}
        <span className="text-white/20">|</span>
        <span>v0.5-beta</span>
      </div>

      {/* 右侧：用户信息 */}
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-1 hover:text-white transition-colors" title="通知中心">
          <Bell size={11} />
          <span>3 条</span>
        </button>
        <span className="text-white/20">|</span>
        <span>张老师</span>
        <span className="text-white/20">|</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400">在线</span>
      </div>
    </div>
  )
}
