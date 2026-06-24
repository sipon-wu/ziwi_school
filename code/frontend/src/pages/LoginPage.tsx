import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, setToken } from '../lib/api'

const DEPLOY_MODE = import.meta.env.VITE_DEPLOY_MODE || 'saas'
const IS_PRIVATE = DEPLOY_MODE === 'private'

export default function LoginPage() {
  const [mode, setMode] = useState<'code' | 'password'>('password')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // P1-3: 发送验证码
  const handleSendCode = async () => {
    if (phone.length !== 11 || sendingCode || countdown > 0) return
    setSendingCode(true)
    setError('')
    try {
      await authAPI.sendCode(phone)
      setCountdown(60)
      const timer = setInterval(() => setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      }), 1000)
    } catch (e: any) {
      setError(e.message || '发送失败')
    }
    setSendingCode(false)
  }

  // P1-3: 登录处理
  const handleLogin = async () => {
    setError('')
    if (IS_PRIVATE) {
      // 私有部署：用户名+密码
      if (!username) { setError('请输入用户名'); return }
      if (!password) { setError('请输入密码'); return }
    } else {
      // SaaS：手机号+密码 或 手机号+验证码
      if (!phone || phone.length !== 11) { setError('请输入正确的手机号'); return }
      if (mode === 'password' && !password) { setError('请输入密码'); return }
      if (mode === 'code' && code.length < 4) { setError('请输入验证码'); return }
    }

    setLoading(true)
    try {
      let res: any
      if (IS_PRIVATE) {
        res = await authAPI.login(username, password)
      } else if (mode === 'password') {
        res = await authAPI.login(phone, password)
      } else {
        res = await authAPI.codeLogin(phone, code)
      }
      if (res.token) {
        setToken(res.token)
        // 保存用户信息到 localStorage 供小微助手使用
        const user = res.user || {}
        localStorage.setItem('zhiwei_user', JSON.stringify({
          name: user.name || '',
          role: user.role || '',
          school_id: user.school?.id || '',
          school_config: user.school_config || {},
        }))
        // 同步图谱开关到 TeachingContext（localStorage 方式）
        if (user.school_config?.enable_knowledge_graph !== undefined) {
          const teaching = JSON.parse(localStorage.getItem('zhiwei_teaching') || '{}')
          teaching.knowledgeGraphEnabled = user.school_config.enable_knowledge_graph
          localStorage.setItem('zhiwei_teaching', JSON.stringify(teaching))
        }
        navigate('/dashboard')
      } else {
        setError('登录失败，请重试')
      }
    } catch (e: any) {
      setError(e.message || '登录失败，请检查账号密码')
    }
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#1A3A6B] via-[#2B5DA8] to-[#1E3A5F]">
      <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-12 w-[400px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/ziwiAI.jpg" alt="知微" className="w-12 h-12 rounded-xl mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">知微教学</h1>
          <p className="text-[13px] text-gray-500 mt-1">见微知著，知微教学</p>
          {IS_PRIVATE && <span className="text-[11px] text-amber-600 mt-1 bg-amber-50 px-2 py-0.5 rounded">私有部署</span>}
        </div>

        {/* P2: SaaS 模式：登录方式切换；私有模式：仅密码 */}
        {!IS_PRIVATE && (
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              onClick={() => { setMode('password'); setError('') }}
              className={`flex-1 py-1.5 text-[13px] rounded-md font-medium transition-all ${mode === 'password' ? 'bg-white text-brand shadow-sm' : 'text-gray-500'}`}
            >密码登录</button>
            <button
              onClick={() => { setMode('code'); setError('') }}
              className={`flex-1 py-1.5 text-[13px] rounded-md font-medium transition-all ${mode === 'code' ? 'bg-white text-brand shadow-sm' : 'text-gray-500'}`}
            >验证码登录</button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-600">{error}</div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {IS_PRIVATE ? (
            // 私有部署：用户名输入
            <div>
              <label htmlFor="login-username" className="block text-[13px] text-gray-600 mb-1.5">用户名</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                onKeyDown={handleKeyDown}
                className="w-full h-10 px-4 border border-[#D0D5DD] rounded-lg text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
              />
            </div>
          ) : (
            // SaaS：手机号输入
            <div>
              <label htmlFor="login-phone" className="block text-[13px] text-gray-600 mb-1.5">手机号</label>
              <input
                id="login-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号"
                maxLength={11}
                onKeyDown={handleKeyDown}
                className="w-full h-10 px-4 border border-[#D0D5DD] rounded-lg text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
              />
            </div>
          )}

          {mode === 'password' || IS_PRIVATE ? (
            <div>
              <label htmlFor="login-pass" className="block text-[13px] text-gray-600 mb-1.5">密码</label>
              <input
                id="login-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                onKeyDown={handleKeyDown}
                className="w-full h-10 px-4 border border-[#D0D5DD] rounded-lg text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="login-code" className="block text-[13px] text-gray-600 mb-1.5">验证码</label>
              <div className="flex gap-3">
                <input
                  id="login-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入验证码"
                  maxLength={6}
                  onKeyDown={handleKeyDown}
                  className="flex-1 h-10 px-4 border border-[#D0D5DD] rounded-lg text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
                />
                <button
                  onClick={handleSendCode}
                  disabled={phone.length !== 11 || sendingCode || countdown > 0}
                  className="shrink-0 h-10 px-4 text-[13px] text-brand border border-brand rounded-lg hover:bg-brand/5 transition-colors disabled:opacity-40"
                >
                  {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中...' : '获取验证码'}
                </button>
              </div>
            </div>
          )}

          <button
            data-testid="login-submit"
            onClick={handleLogin}
            disabled={loading}
            className="w-full h-10 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white rounded-lg text-[14px] font-medium transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </div>

        {/* 注册入口 — 私有部署隐藏自注册 */}
        {!IS_PRIVATE && (
          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-[13px] text-gray-400">
            <span>还没有账号？<span className="text-brand cursor-pointer hover:underline">申请开通</span></span>
            <span className="text-brand cursor-pointer hover:underline">忘记密码</span>
          </div>
        )}
        {IS_PRIVATE && (
          <div className="mt-5 pt-4 border-t border-gray-100 text-center text-[13px] text-gray-400">
            账号由管理员创建，请联系校方管理员
          </div>
        )}
      </div>
    </div>
  )
}
