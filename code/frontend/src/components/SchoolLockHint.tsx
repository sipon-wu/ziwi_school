import { Lock } from 'lucide-react'

// §5.2 家长端功能锁定：个人试用模式（licenseStatus !== 'active'）下，
// 成长关爱 / 家长签字 / 家长端关联 涉及学生与家长个人信息，须锁定不开放。
export default function SchoolLockHint() {
  return (
    <div className="p-10 text-center">
      <Lock size={36} className="mx-auto text-[#C8C8C8] mb-3" />
      <h2 className="text-base font-bold text-[#353535]">该功能在试用模式下不可用</h2>
      <p className="text-[13px] text-[#9A9A9A] mt-2 leading-relaxed">
        「成长关爱 / 家长签字 / 家长端关联」涉及学生与家长个人信息，<br />
        需学校 License 认证后开放。升级学校版即可解锁家校协同功能。
      </p>
    </div>
  )
}
