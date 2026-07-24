import type { ReactNode } from 'react'
import { useTeaching } from '../lib/TeachingContext'
import SchoolLockHint from './SchoolLockHint'

// §5.2 家长端功能锁定：个人试用模式（licenseStatus !== 'active'）下，
// 成长关爱 / 家长签字 / 家长端关联 须锁定不开放。
// 路由级兜底（侧边栏已在 AppLayout 隐藏这两项目录）。
export default function RequireSchoolLicense({ children }: { children: ReactNode }) {
  const teaching = useTeaching()
  if (teaching.licenseStatus !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F7F8]">
        <SchoolLockHint />
      </div>
    )
  }
  return <>{children}</>
}
