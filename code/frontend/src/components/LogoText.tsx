import type { ReactNode } from 'react'

/** 全局铁律：ziwiAI.jpg + "知微教学" 严格统一，24px 对齐，suffix 按需传入 */
export default function LogoText({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <img src="/ziwiAI.jpg" alt="知微" className="w-6 h-6 rounded-sm shrink-0" />
      <span className="text-white font-bold text-[15px] leading-none h-6 flex items-center shrink-0">
        知微教学{children}
      </span>
    </div>
  )
}
