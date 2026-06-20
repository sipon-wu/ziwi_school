import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = () => {
    if (!phone || !code) return
    setLoading(true)
    // TODO: API call
    setTimeout(() => {
      setLoading(false)
      navigate('/dashboard')
    }, 800)
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#1A3A6B] via-[#2B5DA8] to-[#1E3A5F]">
      <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-12 w-[400px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/ziwiAI.jpg" alt="知微" className="w-12 h-12 rounded-xl mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">知微教学</h1>
          <p className="text-[13px] text-gray-500 mt-1">见微知著，知微教学</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] text-gray-600 mb-1.5">手机号</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
              maxLength={11}
              className="w-full h-10 px-4 border border-[#D0D5DD] rounded-lg text-[14px] outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[13px] text-gray-600 mb-1.5">验证码</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="请输入验证码"
                maxLength={6}
                className="flex-1 h-10 px-4 border border-[#D0D5DD] rounded-lg text-[14px] outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-colors"
              />
              <button
                className="shrink-0 h-10 px-4 text-[13px] text-brand border border-brand rounded-lg hover:bg-brand/5 transition-colors"
                disabled={phone.length !== 11}
              >
                获取验证码
              </button>
            </div>
          </div>
          <button
            onClick={handleLogin}
            disabled={loading || phone.length !== 11 || code.length < 4}
            className="w-full h-10 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white rounded-lg text-[14px] font-medium transition-colors"
          >
            {loading ? '登录中...' : phone.length !== 11 ? '请先输入手机号' : code.length < 4 ? '请输入验证码' : '登录'}
          </button>
        </div>
      </div>
    </div>
  )
}
