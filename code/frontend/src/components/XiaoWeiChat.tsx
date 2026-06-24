import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Sparkles, Mic, MicOff, Camera, Image as ImageIcon,
  FileText, BookOpen, Target, BarChart3,
  Minimize2, ArrowUp, Send
} from 'lucide-react'
import { aiAPI } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface Message {
  role: 'user' | 'xiaowei'
  content: string
  imageUrl?: string
  suggestions?: string[]
  time?: string
}

// 功能推荐卡片
const FEATURE_CARDS = [
  {
    icon: FileText, iconClass: 'text-[#1A3A6B]', bgClass: 'bg-brand/5',
    title: '制作教案', desc: 'AI 智能生成',
    navigateTo: '/dashboard/lesson-plans/new', prompt: '帮我写一份教案',
  },
  {
    icon: BookOpen, iconClass: 'text-[#2B5DA8]', bgClass: 'bg-[#F0EDE8]',
    title: '批改作文', desc: '逐句分析点评',
    navigateTo: '/dashboard/grading', prompt: '帮我批改一篇作文',
  },
  {
    icon: Target, iconClass: 'text-[#1A3A6B]', bgClass: 'bg-[#EAF0E8]',
    title: '课堂活动', desc: '互动创意方案',
    navigateTo: null, prompt: '帮我设计一个课堂活动',
  },
  {
    icon: BarChart3, iconClass: 'text-[#2B5DA8]', bgClass: 'bg-[#E8E8F0]',
    title: '学情分析', desc: '数据可视化',
    navigateTo: '/dashboard/analytics', prompt: '看看班级学习情况',
  },
]

// 快捷指令
const QUICK_COMMANDS = [
  { label: '教学设计', type: 'primary' as const, prompt: '帮我设计一堂课的教学设计', navigateTo: '/dashboard/lesson-plans/new' },
  { label: '出题助手', type: 'outline' as const, prompt: '帮我出几道练习题', navigateTo: '/dashboard/exercises/new' },
  { label: '家长沟通', type: 'outline' as const, prompt: '帮我写一段家长沟通话术', navigateTo: null },
  { label: '班会方案', type: 'outline' as const, prompt: '帮我设计一个班会方案', navigateTo: null },
  { label: '教学反思', type: 'outline' as const, prompt: '帮我做一次教学反思总结', navigateTo: null },
]

const AVATAR_SRC = '/xiaowei.png'

function getTimeString(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function XiaoWeiChat() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'xiaowei', content: '你好！我是小微助教，很高兴为你服务！\n有什么教学方面的需求可以随时问我 😊', time: getTimeString() },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── 多媒体状态 ──
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [hasMicPerm, setHasMicPerm] = useState<boolean | null>(null) // null=检测中
  const [hasCameraPerm, setHasCameraPerm] = useState<boolean | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // ── 权限检测（仅移动端主动探测，PC端按需请求）──
  useEffect(() => {
    // PC端不主动请求权限，按钮保持可见（hasMicPerm/hasCameraPerm 保持 null）
    // 用户点击录音/拍照时由浏览器自然触发权限请求
    if (!isMobile) return
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => { stream.getTracks().forEach(t => t.stop()); setHasMicPerm(true) })
        .catch(() => setHasMicPerm(false))
    } else {
      setHasMicPerm(false)
    }
    // 摄像头权限检测（可选）
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => { stream.getTracks().forEach(t => t.stop()); setHasCameraPerm(true) })
        .catch(() => setHasCameraPerm(false))
    } else {
      setHasCameraPerm(false)
    }
  }, [isMobile])

  // 自动滚动
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 获取上下文
  const getContext = () => {
    try {
      const raw = localStorage.getItem('zhiwei_user')
      if (raw) {
        const user = JSON.parse(raw)
        return { teacher_name: user.name || '老师', subject: user.subject || '语文', grade: user.grade || '四年级' }
      }
    } catch { /* ignore */ }
    return { teacher_name: '老师', subject: '语文', grade: '四年级' }
  }

  const sendMessage = async (text: string, imageUrl?: string) => {
    if ((!text.trim() && !imageUrl) || loading) return
    const now = getTimeString()
    const userMsg: Message = { role: 'user', content: text, imageUrl, time: now }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setPreviewImage(null)
    setLoading(true)

    try {
      const ctx = getContext()
      // 构建富文本消息
      let fullMessage = text
      if (imageUrl) {
        fullMessage = `[图片消息] ${text || '请看这张图片'}`
      }
      let data: { reply: string; suggestions: string[] }
      try {
        data = await aiAPI.chat({ message: fullMessage, context: ctx })
      } catch {
        const res = await fetch('/api/v1/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: fullMessage, context: ctx }),
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
        { role: 'xiaowei', content: '抱歉老师，我暂时无法回复，请稍后再试～', time: getTimeString() },
      ])
    }
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input, previewImage || undefined)
    }
  }

  // ── 麦克风录音 ──
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        // 上传音频转文字
        try {
          const fd = new FormData()
          fd.append('audio', blob, 'recording.webm')
          const res = await fetch('/api/v1/ai/speech-to-text', { method: 'POST', body: fd })
          const data = await res.json()
          if (data.text) {
            setInput(prev => prev + data.text)
          } else {
            setInput(prev => prev + '[语音消息]')
          }
        } catch {
          setInput(prev => prev + '[语音识别失败]')
        }
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => {
          const next = t + 1
          if (next >= 60) {
            // 达到 60 秒自动停止
            stopRecording()
          }
          return next
        })
      }, 1000)
    } catch {
      setHasMicPerm(false)
      alert('无法访问麦克风，请在浏览器设置中允许麦克风权限')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
  }, [])

  // 组件卸载清理
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    }
  }, [])

  // ── 拍照 ──
  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPreviewImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── 相册选图 ──
  const handleGalleryPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPreviewImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── 发送图片 ──
  const handleSendImage = async () => {
    if (!previewImage) return
    // 将 base64 上传到服务器获取 URL
    try {
      const blob = await (await fetch(previewImage)).blob()
      const fd = new FormData()
      fd.append('file', blob, `chat-image-${Date.now()}.jpg`)
      const res = await fetch('/api/v1/upload/image', { method: 'POST', body: fd })
      const data = await res.json()
      const imageUrl = data.url || previewImage
      await sendMessage(input || '请看这张图片', imageUrl)
    } catch {
      // 上传失败，直接发送消息（base64作为占位）
      await sendMessage(input || '[图片]', previewImage)
    }
  }

  // 格式化录音时间
  const formatRecordingTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const unread = 0

  // ── 聊天面板内容（桌面端和移动端共用）──
  const chatContent = (
    <>
      {/* Header */}
      <div className="flex items-center px-4 py-3 gap-2.5 h-16 border-b border-[#EEF0F4] shrink-0 bg-gradient-to-r from-brand via-brand to-[#2B5DA8] text-white">
        <img
          src={AVATAR_SRC} alt="小微"
          className="w-10 h-10 rounded-full object-cover bg-white/20 shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="flex-1 flex flex-col gap-px">
          <span className="text-[15px] font-bold leading-tight">小微</span>
          <span className="text-[11px] text-green-300 leading-tight">● 在线</span>
        </div>
        <div className="flex gap-1.5">
          {!isMobile && (
            <button className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors" title="最小化">
              <Minimize2 size={10} color="white" />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center hover:bg-red-500/60 transition-colors" title="关闭"
          >
            <X size={14} color="white" />
          </button>
        </div>
      </div>

      {/* 功能推荐 + 快捷指令 */}
      {messages.length <= 1 && (
        <>
          <div className="bg-[#F5F6F9] px-4 pt-3 pb-2.5 shrink-0">
            <div className="text-xs font-bold text-[#495677] mb-2">
              <Sparkles size={11} className="inline mr-1" />
              功能推荐
            </div>
            <div className="flex gap-2">
              {FEATURE_CARDS.map((card, i) => (
                <button key={i}
                  onClick={() => { if (card.navigateTo) { setOpen(false); navigate(card.navigateTo) } else { sendMessage(card.prompt) } }}
                  className={`flex-1 rounded-[10px] px-2 py-2.5 flex flex-col items-center gap-1 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${card.bgClass}`}
                >
                  <card.icon size={22} className={card.iconClass} />
                  <span className="text-xs font-bold text-[#1A1A2E] leading-tight">{card.title}</span>
                  <span className="text-[10px] text-[#888] leading-tight">{card.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-[#F5F6F9] px-4 pb-3 shrink-0">
            <div className="text-xs font-bold text-[#495677] mb-1.5">⚡ 快捷指令</div>
            <div className="flex gap-1.5 flex-wrap">
              {QUICK_COMMANDS.map((cmd, i) => (
                <button key={i}
                  onClick={() => { if (cmd.navigateTo) { setOpen(false); navigate(cmd.navigateTo) } else { sendMessage(cmd.prompt) } }}
                  className={`h-[44px] w-[88px] rounded-[10px] text-xs flex items-center justify-center whitespace-nowrap transition-all hover:opacity-85 hover:scale-[1.02] active:scale-95 ${
                    cmd.type === 'primary' ? 'bg-brand text-white font-medium' : 'bg-transparent text-[#1A1A2E] border border-[#D6DAE0] hover:bg-[#F0F2F5] hover:border-brand'
                  }`}
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 聊天区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-white">
        {messages.map((m, i) => (
          <div key={i}
            className={`flex gap-2 items-start max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse self-end' : 'self-start'}`}
          >
            {m.role === 'xiaowei' && (
              <img src={AVATAR_SRC} alt="小微"
                className="w-7 h-7 rounded-full object-cover bg-[#E8ECF4] shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ${
                m.role === 'user' ? 'bg-brand text-white' : 'bg-[#F0F2F5] text-[#1A1A2E]'
              }`}>
                {m.imageUrl && (
                  <img src={m.imageUrl} alt="用户上传" className="max-w-[200px] rounded-lg mb-2" />
                )}
                {m.content}
              </div>
              {m.suggestions && m.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {m.suggestions.map((s, j) => (
                    <button key={j} onClick={() => sendMessage(s)}
                      className="text-[11px] px-2.5 py-1 bg-white hover:bg-[#F0F2F5] text-[#495677] rounded-full border border-[#D6DAE0] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {m.time && <span className={`text-[10px] text-[#BBB] ${m.role === 'user' ? 'text-right' : 'text-left'}`}>{m.time}</span>}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 items-start self-start">
            <img src={AVATAR_SRC} alt="小微"
              className="w-7 h-7 rounded-full object-cover bg-[#E8ECF4] shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="bg-[#F0F2F5] rounded-xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#BBB] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#BBB] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#BBB] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 图片预览 */}
      {previewImage && (
        <div className="px-4 pb-2 shrink-0">
          <div className="relative inline-block">
            <img src={previewImage} alt="预览" className="max-h-[120px] rounded-lg border border-gray-200" />
            <button onClick={() => setPreviewImage(null)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* 输入栏（含多媒体按钮） */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[#EEF0F4] shrink-0 bg-white safe-bottom">
        {/* 拍照按钮 */}
        {hasCameraPerm !== false && (
          <>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraCapture} className="hidden" />
            <button onClick={() => cameraInputRef.current?.click()} disabled={loading}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-40"
              title="拍照"
            >
              <Camera size={16} className="text-gray-600" />
            </button>
          </>
        )}

        {/* 相册按钮 */}
        <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleGalleryPick} className="hidden" />
        <button onClick={() => galleryInputRef.current?.click()} disabled={loading}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-40"
          title="从相册选择"
        >
          <ImageIcon size={16} className="text-gray-600" />
        </button>

        {/* 文字输入 */}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? '正在录音...' : previewImage ? '添加描述文字...' : '输入你想了解的内容...'}
          className="flex-1 h-10 border border-[#D6DAE0] rounded-full px-4 text-[13px] text-[#1A1A2E] placeholder-[#AAA] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
          disabled={loading || isRecording}
        />

        {/* 麦克风按钮 */}
        {hasMicPerm !== false && (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading && !isRecording}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
              isRecording
                ? 'bg-red-500 animate-pulse'
                : 'bg-brand hover:opacity-85'
            } disabled:opacity-40`}
            title={isRecording ? '停止录音' : '语音输入'}
          >
            {isRecording ? <MicOff size={16} color="white" /> : <Mic size={16} color="white" />}
          </button>
        )}

        {/* 发送按钮 */}
        {previewImage ? (
          <button onClick={handleSendImage} disabled={loading}
            className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center hover:opacity-85 transition-opacity disabled:opacity-40 shrink-0"
            title="发送图片"
          >
            <Send size={16} color="white" />
          </button>
        ) : (
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full bg-brand flex items-center justify-center hover:opacity-85 transition-opacity disabled:opacity-40 shrink-0"
            title="发送"
          >
            <ArrowUp size={16} color="white" />
          </button>
        )}
      </div>

      {/* 录音状态提示 */}
      {isRecording && (
        <div className="text-center py-1.5 text-[11px] text-red-500 bg-red-50 shrink-0 font-medium">
          ● 录音中 {formatRecordingTime(recordingTime)}
        </div>
      )}

      {/* 品牌标识 */}
      <div className="text-center py-1 text-[9px] text-[#B0B5C0] tracking-widest border-t border-[#EEF0F4] shrink-0">
        知微 ziwi · AI 助教
      </div>
    </>
  )

  return (
    <>
      {/* 浮动按钮（桌面端固定右下角，移动端也显示） */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed z-50 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 overflow-hidden xw-chat-btn ${
          isMobile ? 'bottom-20 right-4 w-12 h-12' : 'bottom-6 right-6 w-14 h-14'
        }`}
        style={{ background: open ? 'linear-gradient(135deg, #1A3A6B, #2B5DA8)' : 'transparent' }}
        title="小微AI助教"
      >
        {open ? (
          <X size={isMobile ? 20 : 22} color="white" />
        ) : (
          <img src={AVATAR_SRC} alt="小微"
            className="w-full h-full rounded-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
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
        isMobile ? (
          /* 移动端全屏面板 */
          <div className="fixed inset-0 z-50 bg-white flex flex-col animate-slide-up">
            {chatContent}
          </div>
        ) : (
          /* 桌面端浮动窗口 */
          <div className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-3rem)] h-[640px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
            {chatContent}
          </div>
        )
      )}
    </>
  )
}
