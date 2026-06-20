import { Bell } from 'lucide-react'

export default function TopNavBar() {
  return (
    <header className="h-11 bg-white border-b border-border flex items-center px-5 shrink-0">
      <span className="text-[13px] text-gray-500">工作台</span>
      <span className="text-[13px] text-gray-300 mx-2">/</span>
      <span className="text-[13px] text-gray-800 font-medium">首页</span>

      <div className="ml-auto flex items-center gap-4">
        {/* 学科/年级切换 */}
        <select className="text-[13px] border border-border rounded-lg px-3 py-1.5 bg-white text-gray-700 outline-none focus:border-brand">
          <option>三年级 · 语文</option>
          <option>四年级 · 语文</option>
          <option>三年级 · 数学</option>
        </select>

        {/* 通知 */}
        <button className="relative p-1 text-gray-500 hover:text-brand transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[14px] rounded-full bg-[#DC3545] text-white text-[10px] font-medium flex items-center justify-center leading-none">
            3
          </span>
        </button>

        {/* 头像 */}
        <div className="w-7 h-7 rounded-full bg-brand/20 text-brand text-xs font-medium flex items-center justify-center">
          张
        </div>
      </div>
    </header>
  )
}
