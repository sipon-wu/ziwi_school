import { useState, useRef, useEffect } from 'react'
import { Send, ChevronDown } from 'lucide-react'
import { aiAPI } from '../lib/api'
import { useToast } from '../components/Toast'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  contextType: 'lesson' | 'exercise' | 'exam'
  subject: string
  grade: string
  knowledgeNodeNames: string[]
  extraRequirements: string
  onApply: (chatContext: string) => void
  onCollapse: () => void
}

const TEACHING_SYSTEM = `你是知微教育平台的小微助教，专注辅助教师完成教学任务。
你只回答与学科教学、课堂设计、习题组卷、教案编写、教育方法等教学相关的问题。
如果用户的问题与教学无关（如闲聊、时事、娱乐、科技、生活等），请礼貌拒绝，引导回到教学话题。
你的回答要简洁、实用、贴合中国中小学教学实际。`

export default function EditXiaoWeiPanel({ contextType, subject, grade, knowledgeNodeNames, extraRequirements, onApply, onCollapse }: Props) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const k = knowledgeNodeNames.length > 0 ? `已选知识点：${knowledgeNodeNames.join('、')}。` : ''
    const e = extraRequirements ? `已有附加要求：${extraRequirements}。` : ''
    const typeLabel = contextType === 'lesson' ? '教案' : contextType === 'exercise' ? '习题' : '试卷'
    const systemText = `${TEACHING_SYSTEM}\n\n当前用户正在编辑一份【${grade}${subject} · ${typeLabel}】。${k}${e}

对话要求：
1. 认真接话——用户问什么就答什么，能引用当前上下文（已选知识点/已有附加要求）就引用，不要给空话
2. 用户表达需求时，简短确认已记录（如"收到，实验环节已记下"）
3. 需求模糊时追问一句澄清（如"您说的'小组合作'是哪个环节里加？"）
4. 当用户已提供足够信息（≥3 条具体要求 或 1 条完整描述），主动问"已收集 X 条要求，是否现在生成？"
5. 不要在对话中直接生成教案/习题/试卷的全文——只引导+确认；全文生成由用户点"应用到当前内容"按钮触发
6. 只谈教学相关内容，拒绝非教学话题`

    setMessages([
      { role: 'assistant', content: `你好，我是小微。当前编辑的是一份${subject} · ${grade}${typeLabel}。${knowledgeNodeNames.length > 0 ? `已选 ${knowledgeNodeNames.length} 个知识点（${knowledgeNodeNames.slice(0, 3).join('、')}${knowledgeNodeNames.length > 3 ? '…' : ''}）。` : ''}${extraRequirements ? `已记录 1 条附加要求。` : ''}\n\n你可以告诉我需要补充或调整哪些方面。` },
    ])
    ;(window as any).__edit_xiaowei_system = systemText
    return () => { delete (window as any).__edit_xiaowei_system }
  }, [contextType, subject, grade])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const systemPrompt = (window as any).__edit_xiaowei_system || ''

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = [...messages, userMsg].slice(-20)
      const fullPrompt = systemPrompt + '\n\n对话历史：\n' + history.map(m => (m.role === 'user' ? '用户' : '小微') + '：' + m.content).join('\n') + '\n\n小微：'
      const res = await aiAPI.chat({ message: fullPrompt, context: { teacher_name: '老师', subject, grade } })
      let reply = ''
      if (typeof res === 'string') reply = res
      else if (res?.reply) reply = res.reply
      else if (res?.data?.reply) reply = res.data.reply
      else reply = '收到了，请继续补充需求～'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e: any) {
      toast('小微回复失败：' + (e.message || '网络错误'), 'error')
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，我暂时无法回复，请稍后重试～' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleApply = () => {
    const ctx = messages.map(m => (m.role === 'user' ? '用户要求' : '小微回复') + '：' + m.content).join('\n')
    onApply(ctx)
  }

  const hasContent = messages.length > 1

  return (
    <div className="flex flex-col bg-white border-t border-[#F0F0F0] h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#F0F0F0] shrink-0">
        <div className="flex items-center gap-1.5">
          <img src="/xiaowei.png" alt="小微" className="w-4 h-4 rounded-full shrink-0" />
          <span className="text-[12px] font-medium text-[#353535]">小微 · 补充需求</span>
        </div>
        <button onClick={onCollapse} className="text-[#9A9A9A] hover:text-[#353535] p-0.5" title="收起">
          <ChevronDown size={14} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-3 py-2 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] px-2.5 py-1.5 text-[11px] leading-relaxed rounded-lg ${
              m.role === 'user'
                ? 'bg-brand text-white rounded-br-[4px]'
                : 'bg-[#F0F0F0] text-[#353535] rounded-bl-[4px]'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[88%] px-2.5 py-1.5 text-[11px] bg-[#F0F0F0] text-[#9A9A9A] rounded-lg rounded-bl-[4px]">
              小微思考中...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[#F0F0F0] shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? '请稍候...' : '输入补充需求...'}
          className="flex-1 h-8 px-3 text-[12px] border border-[#D6DAE0] rounded-full outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 text-[#1A1A2E] placeholder-[#AAA]"
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={!input.trim() || loading}
          className="w-7 h-7 rounded-full bg-brand flex items-center justify-center disabled:opacity-40 shrink-0 hover:opacity-85 transition-opacity">
          <Send size={12} color="white" />
        </button>
        {hasContent && (
          <button onClick={handleApply} disabled={loading}
            className="h-7 px-3 text-[11px] text-white bg-[#02A7F0] rounded-full hover:bg-[#0288D1] disabled:opacity-40 shrink-0 whitespace-nowrap transition-colors">
            应用到当前内容
          </button>
        )}
      </div>
    </div>
  )
}
