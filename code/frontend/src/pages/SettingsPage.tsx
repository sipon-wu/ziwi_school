import { useState, useRef, useEffect } from 'react'
import { User, Lock, Bell, Shield, ChevronRight, BookOpen, Save, Camera, PieChart } from 'lucide-react'
import { useTeaching, ALL_MATH_TEXTBOOKS, ALL_ENGLISH_TEXTBOOKS } from '../lib/TeachingContext'
import { tokenQuotaAPI } from '../lib/api'

// 读取已保存头像
function getSavedAvatar(): string {
  return localStorage.getItem('zhiwei_avatar') || ''
}

const GRADE_NAMES = ['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级']

export default function SettingsPage() {
  const teaching = useTeaching()
  const [name, setName] = useState('张老师')
  const [phone] = useState('138****8888')
  const [grade, setGrade] = useState(GRADE_NAMES[teaching.grade - 1] || '四年级')
  const [subject, setSubject] = useState(teaching.subject)
  const [avatar, setAvatar] = useState(getSavedAvatar)
  const fileRef = useRef<HTMLInputElement>(null)

  // P2: 密码修改
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  // P2: 教材版本配置
  const [showTextbook, setShowTextbook] = useState(false)
  const [textbookSubject, setTextbookSubject] = useState(teaching.subject)
  const [textbookVersion, setTextbookVersion] = useState(
    teaching.subject === '英语' ? teaching.textbook_english : teaching.textbook_math
  )

  const [saved, setSaved] = useState(false)

  // Token 配额
  const [quota, setQuota] = useState({ monthly: 0, used: 0, remaining: 0, pct: 0, level: 'normal' as string, custom: false })
  const [breakdown, setBreakdown] = useState<{ api_type: string; tokens: number }[]>([])

  useEffect(() => {
    tokenQuotaAPI.myQuota().then((res: any) => {
      if (res?.data) {
        setQuota({
          monthly: res.data.quota_monthly || 0,
          used: res.data.used_monthly || 0,
          remaining: res.data.remaining || 0,
          pct: res.data.usage_pct || 0,
          level: res.data.level || 'normal',
          custom: res.data.quota_custom || false,
        })
        setBreakdown(res.data.breakdown || [])
      }
    }).catch(() => {})
  }, [])

  // 头像上传
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('头像大小不能超过2MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setAvatar(base64)
      localStorage.setItem('zhiwei_avatar', base64)
      // 触发全局事件通知其他组件更新
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: base64 }))
    }
    reader.readAsDataURL(file)
  }

  // P2: 保存基本信息
  const handleSave = async () => {
    // 同步到全局 TeachingContext
    teaching.setSubject(subject as '语文' | '数学' | '英语')
    const gradeIdx = GRADE_NAMES.indexOf(grade)
    if (gradeIdx >= 0) teaching.setGrade(gradeIdx + 1)
    try {
      await fetch('/api/v1/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('zhiwei_token') || ''),
        },
        body: JSON.stringify({ name, grade, subject, avatar_url: avatar }),
      })
      localStorage.setItem('zhiwei_user', JSON.stringify({ name, grade, subject }))
    } catch { /* 演示模式降级 */ }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleChangePwd = async () => {
    setPwdError('')
    if (!oldPwd || !newPwd || !confirmPwd) { setPwdError('请填写所有字段'); return }
    if (newPwd !== confirmPwd) { setPwdError('两次输入的新密码不一致'); return }
    if (newPwd.length < 6) { setPwdError('新密码至少6位'); return }
    setPwdSaving(true)
    try {
      await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('zhiwei_token') || ''),
        },
        body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
      })
      setShowPwdModal(false)
      setOldPwd(''); setNewPwd(''); setConfirmPwd('')
      alert('密码修改成功')
    } catch {
      setPwdError('密码修改失败，请检查旧密码')
    }
    setPwdSaving(false)
  }

  return (
    <div className="space-y-6">
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
          {/* 头像上传 */}
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
              {avatar ? (
                <img src={avatar} alt="头像" className="w-16 h-16 rounded-full object-cover border-2 border-gray-200" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-brand/20 flex items-center justify-center text-2xl font-bold text-brand border-2 border-gray-200">张</div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={18} className="text-white" />
              </div>
            </div>
            <div>
              <button onClick={() => fileRef.current?.click()} className="text-sm text-brand hover:underline">更换头像</button>
              <p className="text-xs text-gray-400 mt-0.5">支持 JPG/PNG，最大 2MB</p>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
            <div>
              <label htmlFor="settings-name" className="block text-xs font-medium text-gray-500 mb-1">姓名</label>
              <input id="settings-name" type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
            </div>
            <div>
              <label htmlFor="settings-phone" className="block text-xs font-medium text-gray-500 mb-1">手机号</label>
              <input id="settings-phone" type="text" value={phone} disabled className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400" />
            </div>
            <div>
              <label htmlFor="settings-grade" className="block text-xs font-medium text-gray-500 mb-1">任教年级</label>
              <select id="settings-grade" value={grade} onChange={e => setGrade(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand">
                {GRADE_NAMES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="settings-subject" className="block text-xs font-medium text-gray-500 mb-1">任教学科</label>
              <select id="settings-subject" value={subject} onChange={e => setSubject(e.target.value as '语文'|'数学'|'英语')} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand">
                <option>语文</option><option>数学</option><option>英语</option>
              </select>
            </div>
          </div>
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors">
            <Save size={14} /> {saved ? '已保存' : '保存修改'}
          </button>
        </div>
      </div>

      {/* P2: 教材版本配置 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <BookOpen size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">教材版本</span>
        </div>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">{textbookSubject} · {textbookVersion}</span>
              <span className="text-[11px] text-gray-400">（AI 教案生成时将依据此版本课标对齐）</span>
            </div>
            <button onClick={() => setShowTextbook(!showTextbook)} className="text-xs text-brand hover:underline">{showTextbook ? '收起' : '修改'}</button>
          </div>
          {showTextbook && (
            <div className="mt-4 flex gap-3">
              <select value={textbookSubject} onChange={e => { setTextbookSubject(e.target.value as '语文'|'数学'|'英语'); setTextbookVersion(e.target.value === '英语' ? 'PEP' : e.target.value === '语文' ? '部编版' : '人教版') }} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">
                <option>语文</option><option>数学</option><option>英语</option>
              </select>
              <select value={textbookVersion} onChange={e => setTextbookVersion(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">
                {textbookSubject === '语文' && <option>部编版</option>}
                {textbookSubject === '数学' && ALL_MATH_TEXTBOOKS.map(v => <option key={v}>{v}</option>)}
                {textbookSubject === '英语' && ALL_ENGLISH_TEXTBOOKS.map(v => <option key={v}>{v}</option>)}
              </select>
              <button onClick={() => {
                setShowTextbook(false)
                // 同步教材版本到 TeachingContext
                if (textbookSubject === '数学') teaching.setTextbookMath(textbookVersion)
                else if (textbookSubject === '英语') teaching.setTextbookEnglish(textbookVersion)
                alert('教材版本已更新')
              }} className="px-3 py-1.5 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover">确认</button>
            </div>
          )}
        </div>
      </div>

      {/* Token 配额 */}
      {quota.monthly > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <PieChart size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">本月 Token 配额</span>
            {quota.level !== 'normal' && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                quota.level === 'danger' ? 'bg-red-100 text-red-600' : quota.level === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
              }`}>
                {quota.level === 'danger' ? '严重不足' : quota.level === 'warning' ? '即将用尽' : '已用尽'}
              </span>
            )}
          </div>
          <div className="p-6 space-y-4">
            {/* 进度条 */}
            <div>
              <div className="flex justify-between text-[13px] mb-2">
                <span className="text-gray-600">已消耗</span>
                <span className="font-medium">{quota.used.toLocaleString()} / {quota.monthly.toLocaleString()} Token</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  quota.pct >= 90 ? 'bg-red-500' : quota.pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'
                }`} style={{ width: `${Math.min(quota.pct, 100)}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                <span>已用 {quota.pct.toFixed(1)}%</span>
                <span>{quota.custom ? '个性化配额' : '校默认配额'}</span>
              </div>
            </div>

            {/* 分类消耗 */}
            {breakdown.length > 0 && (
              <div>
                <h4 className="text-[12px] font-medium text-gray-600 mb-2">分类消耗</h4>
                <div className="space-y-1.5">
                  {breakdown.map((b, i) => {
                    const nameMap: Record<string, string> = {
                      'lesson-plan': '教案生成', 'exam': '出题组卷', 'grading': '自动批阅', 'chat': '小微对话',
                    }
                    const bPct = quota.monthly > 0 ? (b.tokens / quota.monthly * 100) : 0
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500 w-16 shrink-0">{nameMap[b.api_type] || b.api_type}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand/40 rounded-full" style={{ width: `${Math.min(bPct, 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400">{b.tokens.toLocaleString()}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 安全设置 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <Shield size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">安全设置</span>
        </div>
        <div className="divide-y divide-gray-100">
          <button onClick={() => setShowPwdModal(true)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 text-left">
            <div className="flex items-center gap-3">
              <Lock size={16} className="text-gray-400" />
              <span className="text-sm text-gray-700">修改密码</span>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
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

      {/* 修改密码弹窗 */}
      {showPwdModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowPwdModal(false)}>
          <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-4">修改密码</h3>
            {pwdError && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-600">{pwdError}</div>}
            <div className="space-y-3">
              <div><label htmlFor="pwd-old" className="block text-xs text-gray-500 mb-1">旧密码</label><input id="pwd-old" type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20" /></div>
              <div><label htmlFor="pwd-new" className="block text-xs text-gray-500 mb-1">新密码</label><input id="pwd-new" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20" /></div>
              <div><label htmlFor="pwd-confirm" className="block text-xs text-gray-500 mb-1">确认新密码</label><input id="pwd-confirm" type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20" /></div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowPwdModal(false)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handleChangePwd} disabled={pwdSaving} className="flex-1 py-2.5 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50">{pwdSaving ? '修改中...' : '确认修改'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
