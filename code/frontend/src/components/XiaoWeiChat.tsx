import { useState, useRef, useEffect } from 'react'
import {
  MessageCircle, X, Sparkles, Mic,
  FileText, BookOpen, Target, BarChart3,
  Minimize2, ArrowUp
} from 'lucide-react'
import { aiAPI } from '@/lib/api'

interface Message {
  role: 'user' | 'xiaowei'
  content: string
  suggestions?: string[]
  time?: string
}

// 功能推荐卡片
const FEATURE_CARDS = [
  {
    icon: FileText,
    iconClass: 'text-[#495677]',
    bgClass: 'bg-[#E8ECF4]',
    title: '制作教案',
    desc: 'AI 智能生成',
    prompt: '帮我写一份教案',
  },
  {
    icon: BookOpen,
    iconClass: 'text-[#6D7792]',
    bgClass: 'bg-[#F0EDE8]',
    title: '批改作文',
    desc: '逐句分析点评',
    prompt: '帮我批改一篇作文',
  },
  {
    icon: Target,
    iconClass: 'text-[#5A7A5A]',
    bgClass: 'bg-[#EAF0E8]',
    title: '课堂活动',
    desc: '互动创意方案',
    prompt: '帮我设计一个课堂活动',
  },
  {
    icon: BarChart3,
    iconClass: 'text-[#6D7792]',
    bgClass: 'bg-[#E8E8F0]',
    title: '学情分析',
    desc: '数据可视化',
    prompt: '看看班级学习情况',
  },
]

// 快捷指令
const QUICK_COMMANDS = [
  { label: '教学设计', type: 'primary' as const, prompt: '帮我设计一堂课的教学设计' },
  { label: '出题助手', type: 'outline' as const, prompt: '帮我出几道练习题' },
  { label: '家长沟通', type: 'outline' as const, prompt: '帮我写一段家长沟通话术' },
  { label: '班会方案', type: 'outline' as const, prompt: '帮我设计一个班会方案' },
  { label: '教学反思', type: 'outline' as const, prompt: '帮我做一次教学反思总结' },
]

const AVATAR_SRC = '/xiaowei.png'

function getTimeString(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function XiaoWeiChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'xiaowei',
      content: '你好！我是小微助教，很高兴为你服务！\n有什么教学方面的需求可以随时问我 😊',
      time: getTimeString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 从 localStorage 读取教师信息构建上下文
  const getContext = () => {
    try {
      const raw = localStorage.getItem('zhiwei_user')
      if (raw) {
        const user = JSON.parse(raw)
        return {
          teacher_name: user.name || '老师',
          subject: user.subject || '语文',
          grade: user.grade || '四年级',
        }
      }
    } catch { /* ignore */ }
    return { teacher_name: '老师', subject: '语文', grade: '四年级' }
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    const now = getTimeString()
    const userMsg: Message = { role: 'user', content: text, time: now }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const ctx = getContext()
      let data: { reply: string; suggestions: string[] }
      try {
        data = await aiAPI.chat({ message: text, context: ctx })
      } catch {
        // fallback: 直接 fetch（演示模式无 token 时也可用）
        const res = await fetch('/api/v1/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, context: ctx }),
        })
        data = await res.json()
      }
      setMessages(prev => [
        ...prev,
        { role: 'xiaowei', content: data.reply, suggestions: data.suggestions, time: getTimeString() },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'xiaowei',
          content: '抱歉老师，我暂时无法回复，请稍后再试～',
          time: getTimeString(),
        },
      ])
    }
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const unread = 0

  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 overflow-hidden"
        style={{ background: open ? 'linear-gradient(135deg, #1A3A6B, #2B5DA8)' : 'transparent' }}
        title="小微AI助教"
      >
        {open ? (
          <X size={22} color="white" />
        ) : (
          <img
            src={AVATAR_SRC}
            alt="小微"
            className="w-full h-full rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        )}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {/* 对话面板 */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-3rem)] h-[640px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* ── Header ── */}
          <div className="flex items-center px-4 py-3 gap-2.5 h-16 border-b border-[#EEF0F4] shrink-0">
            <img
              src={AVATAR_SRC}
              alt="小微"
              className="w-10 h-10 rounded-full object-cover bg-[#E8ECF4] shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            <div className="flex-1 flex flex-col gap-px">
              <span className="text-[15px] font-bold text-[#1A1A2E] leading-tight">小微</span>
              <span className="text-[11px] text-[#52C41A] leading-tight">● 在线</span>
            </div>
            <div className="flex gap-1.5">
              <button
                className="w-6 h-6 rounded-md bg-[#F0F0F0] flex items-center justify-center hover:bg-[#E0E0E0] transition-colors"
                title="最小化"
              >
                <Minimize2 size={10} color="#666" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-md bg-[#F0F0F0] flex items-center justify-center hover:bg-[#FFE0E0] hover:text-[#E02020] transition-colors"
                title="关闭"
              >
                <X size={14} color="#666" />
              </button>
            </div>
          </div>

          {/* ── 功能推荐 ── */}
          <div className="bg-[#F5F6F9] px-4 pt-3 pb-2.5 shrink-0">
            <div className="text-xs font-bold text-[#495677] mb-2">
              <Sparkles size={11} className="inline mr-1" />
              功能推荐
            </div>
            <div className="flex gap-2">
              {FEATURE_CARDS.map((card, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(card.prompt)}
                  className={`flex-1 rounded-[10px] px-2 py-2.5 flex flex-col items-center gap-1 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${card.bgClass}`}
                >
                  <card.icon size={22} className={card.iconClass} />
                  <span className="text-xs font-bold text-[#1A1A2E] leading-tight">{card.title}</span>
                  <span className="text-[10px] text-[#888] leading-tight">{card.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── 快捷指令 ── */}
          <div className="bg-[#F5F6F9] px-4 pb-3 shrink-0">
            <div className="text-xs font-bold text-[#495677] mb-1.5">
              ⚡ 快捷指令
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {QUICK_COMMANDS.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(cmd.prompt)}
                  className={`h-[44px] w-[88px] rounded-[10px] text-xs flex items-center justify-center whitespace-nowrap transition-all hover:opacity-85 hover:scale-[1.02] ${
                    cmd.type === 'primary'
                      ? 'bg-[#495677] text-white font-medium'
                      : 'bg-transparent text-[#1A1A2E] border border-[#D6DAE0] hover:bg-[#F0F2F5] hover:border-[#495677]'
                  }`}
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── 聊天区域 ── */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-white">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 items-start max-w-[340px] ${
                  m.role === 'user' ? 'flex-row-reverse self-end' : 'self-start'
                }`}
              >
                {/* 头像 */}
                {m.role === 'xiaowei' && (
                  <img
                    src={AVATAR_SRC}
                    alt="小微"
                    className="w-7 h-7 rounded-full object-cover bg-[#E8ECF4] shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                )}
                {/* 消息内容 */}
                <div className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#495677] text-white'
                        : 'bg-[#F0F2F5] text-[#1A1A2E]'
                    }`}
                  >
                    {m.content}
                  </div>
                  {/* 建议快捷回复 */}
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {m.suggestions.map((s, j) => (
                        <button
                          key={j}
                          onClick={() => sendMessage(s)}
                          className="text-[11px] px-2.5 py-1 bg-white hover:bg-[#F0F2F5] text-[#495677] rounded-full border border-[#D6DAE0] transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.time && (
                    <span
                      className={`text-[10px] text-[#BBB] ${
                        m.role === 'user' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {m.time}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Loading 动画 */}
            {loading && (
              <div className="flex gap-2 items-start self-start">
                <img
                  src={AVATAR_SRC}
                  alt="小微"
                  className="w-7 h-7 rounded-full object-cover bg-[#E8ECF4] shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                <div className="bg-[#F0F2F5] rounded-xl px-4 py-3">
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 bg-[#BBB] rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="w-2 h-2 bg-[#BBB] rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="w-2 h-2 bg-[#BBB] rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* ── 输入栏 ── */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-[#EEF0F4] shrink-0 bg-white">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你想了解的内容..."
              className="flex-1 h-10 border border-[#D6DAE0] rounded-full px-4 text-[13px] text-[#1A1A2E] placeholder-[#AAA] outline-none focus:border-[#495677] transition-colors"
              disabled={loading}
            />
            <button
              className="w-10 h-10 rounded-full bg-[#495677] flex items-center justify-center hover:opacity-85 transition-opacity shrink-0"
              title="语音输入"
              disabled={loading}
            >
              <Mic size={16} color="white" />
            </button>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-full bg-[#495677] flex items-center justify-center hover:opacity-85 transition-opacity disabled:opacity-40 shrink-0"
              title="发送"
            >
              <ArrowUp size={16} color="white" />
            </button>
          </div>

          {/* ── 品牌标识 ── */}
          <div className="text-center py-1 text-[9px] text-[#B0B5C0] tracking-widest border-t border-[#EEF0F4] shrink-0">
            知微 ziwi · AI 助教
          </div>
        </div>
      )}
    </>
  )
}
