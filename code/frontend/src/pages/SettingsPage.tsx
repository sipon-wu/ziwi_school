import { useState } from 'react'
import { User, Lock, Bell, Shield, ChevronRight } from 'lucide-react'

export default function SettingsPage() {
  const [name, setName] = useState('张老师')
  const [phone] = useState('138****8888')
  const [grade, setGrade] = useState('四年级')
  const [subject, setSubject] = useState('语文')

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">个人设置</h1>
        <p className="text-sm text-gray-500 mt-1">管理您的个人信息和账号安全</p>
      </div>

      {/* 基本信息 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <User size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">基本信息</span>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">姓名</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">手机号</label>
              <input type="text" value={phone} disabled className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">任教年级</label>
              <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                {['一年级','二年级','三年级','四年级','五年级','六年级'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">任教学科</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                <option>语文</option><option>数学</option><option>英语</option>
              </select>
            </div>
          </div>
          <button className="px-4 py-2 text-sm bg-[#1A3A6B] text-white rounded-lg hover:bg-[#2B5DA8]">保存修改</button>
        </div>
      </div>

      {/* 安全设置 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <Shield size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">安全设置</span>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 cursor-pointer">
            <div className="flex items-center gap-3">
              <Lock size={16} className="text-gray-400" />
              <span className="text-sm text-gray-700">修改密码</span>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </div>
          <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 cursor-pointer">
            <div className="flex items-center gap-3">
              <Bell size={16} className="text-gray-400" />
              <span className="text-sm text-gray-700">通知设置</span>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Shield size={16} className="text-gray-400" />
              <span className="text-sm text-gray-700">两步验证</span>
            </div>
            <span className="text-xs text-gray-400">未开启</span>
          </div>
        </div>
      </div>
    </div>
  )
}
