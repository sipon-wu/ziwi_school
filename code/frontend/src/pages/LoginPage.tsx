import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../lib/api'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password: pwd }),
      })
      setToken(res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      nav('/teacher', { replace: true })
    } catch (ex: any) {
      setErr(ex.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen">
      {/* 左侧品牌区 */}
      <div className="hidden lg:flex flex-col items-center justify-center w-[45%] bg-gradient-to-br from-[#02A7F0] to-[#015A8A] text-white p-12">
        <img src="/ziwiAI.jpg" alt="知微" className="w-20 h-20 rounded-2xl mb-6 border-2 border-white/30" />
        <h1 className="text-3xl font-bold mb-3 tracking-wide">知微教学</h1>
        <p className="text-sm opacity-80 mb-8">AI 驱动的智能教学助手</p>
        <div className="w-full max-w-[380px] aspect-[4/3] rounded-[10px] border border-white/20 overflow-hidden bg-white/5 flex items-center justify-center">
          <span className="text-white/30 text-sm">校园图占位</span>
        </div>
      </div>

      {/* 右侧登录表单 */}
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <form onSubmit={submit} className="w-[360px]">
          <h2 className="text-xl font-semibold text-center text-[#353535] mb-8">欢迎登录</h2>

          {err && <div className="mb-4 p-3 bg-[#FFF2F0] border border-[#FFCCC7] rounded text-xs text-[#FF4D4F]">{err}</div>}

          <div className="mb-4">
            <label className="block text-[13px] text-[#353535] mb-1.5">手机号</label>
            <input
              type="tel" value={phone} maxLength={11}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="请输入手机号" required
              className="w-full px-3 py-2.5 text-[13px] border border-[#E7E7EB] rounded-[3px] outline-none focus:border-[#02A7F0] transition-colors"
            />
          </div>

          <div className="mb-6">
            <label className="block text-[13px] text-[#353535] mb-1.5">密码</label>
            <input
              type="password" value={pwd}
              onChange={e => setPwd(e.target.value)}
              placeholder="请输入密码" required
              className="w-full px-3 py-2.5 text-[13px] border border-[#E7E7EB] rounded-[3px] outline-none focus:border-[#02A7F0] transition-colors"
            />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-[#02A7F0] text-white text-[14px] rounded-[3px] hover:bg-[#0398D8] transition-colors disabled:opacity-50"
          >
            {loading ? '登录中...' : '登 录'}
          </button>

          <div className="flex items-center justify-between mt-4 text-[11px]">
            <span className="text-[#02A7F0] cursor-pointer hover:underline">申请开通</span>
            <span className="text-[#9A9A9A] cursor-pointer hover:text-[#02A7F0]">忘记密码</span>
          </div>

          <p className="mt-8 text-center text-[11px] text-[#A3A3A3]">
            演示：13800000002 / teacher123
          </p>
        </form>
      </div>
    </div>
  );
}
