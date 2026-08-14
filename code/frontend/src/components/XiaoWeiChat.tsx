import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Sparkles, Mic, MicOff, Camera, Image as ImageIcon,
  FileText, BookOpen, Target, BarChart3,
  Minimize2, ArrowUp, Send,
  Settings, KeyRound, ServerCog, Wrench
} from 'lucide-react'
import { aiAPI, materialAPI, openWorkspace } from '@/lib/api'
import { buildH5Html, mdToH5Slides } from '@/lib/exportH5'
import { markdownToStorybookH5 } from '@/lib/courseware-h5'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useTeaching } from '@/lib/TeachingContext'
import { useToast } from '../components/Toast'
import { pushXiaoweiPrompt } from '@/lib/xiaoweiContext'

interface Message {
  role: 'user' | 'xiaowei'
  content: string
  imageUrl?: string
  suggestions?: string[]
  time?: string
  // 课件产出卡片（小微直接制作的成品，可跳转查看）
  coursewareCard?: { name: string; id: string; format: string }
}

const safeGetUser = () => {
  try { return JSON.parse(localStorage.getItem('zhiwei_user') || localStorage.getItem('user') || '{}') || {} } catch { return {} }
}

// ── 意图识别：操作者是否让小微「直接产出一个 H5 互动课件成品」 ──
// 命中条件：含"课件/互动课件/h5"且含"做/生成/来一个/制作/出/给我/要一个"等动作词
function detectCoursewareIntent(text: string): { hit: boolean; extra: string } {
  const t = text.toLowerCase()
  const isCourseware = /课件|互动课件|h5|白板课件|投屏课件/.test(text)
  const hasAction = /(做|生成|来一个|制作|出|给我|要一个|弄|产|整|搞|交|生成个|来份|来个)/.test(text)
  if (!isCourseware || !hasAction) return { hit: false, extra: '' }
  // 把"英语场景对话/绘图/点读/自动/10分钟"等关键诉求提取为 extra_requirements
  const parts: string[] = []
  if (/英语|english/.test(t)) parts.push('英语')
  if (/场景对话|对话|dialogue|role.?play|情景|口语/.test(t)) parts.push('英语场景对话')
  if (/绘图|画|drawing|白板|黑板|手绘|示意图/.test(t)) parts.push('带绘图（投屏白板现场绘制句型树/对话气泡/简笔画）')
  if (/点读|跟读|read.?along|朗读/.test(t)) parts.push('配点读跟读（句子可点击播音频）')
  if (/自动|播放|自动播放|autoplay/.test(t)) parts.push('自动播放')
  if (/10分钟|十分钟|讲课时长|课时|分钟|minute/.test(t)) parts.push('满足10分钟讲课时长（不少于12页，含热身→对话示范→句型操练→小组活动→巩固→小结作业完整节奏）')
  if (parts.length === 0) parts.push('H5 互动课件（可投屏/扫码，含自动播放与互动）')
  return { hit: true, extra: parts.join('，') }
}

// 从操作者表述中尽量提取课题名/学科/年级
function parseCoursewareMeta(text: string, teaching: { subject: string; grade: string | number }) {
  // 课题名：引号内、或"关于X的"、"X课件"、"X对话"
  let title = ''
  const q = text.match(/[《""]([^《""]+)[》""]/)
  if (q) title = q[1]
  else {
    const m = text.match(/(?:做|生成|来|制作|出|弄|产|整|搞|交|要)(?:一个|一份|个|份)?\s*([^，,。.；;的]+?)(?:的)?\s*(?:课件|互动课件|h5|对话|情景)/i)
    if (m) title = m[1].replace(/^(英语|小学|初中)?/, '').trim()
  }
  if (!title) title = teaching.subject ? `${teaching.subject}互动课件` : '互动课件'
  const subject = /英语|english/.test(text.toLowerCase()) ? '英语' : (teaching.subject || '英语')
  const GRADE_NAMES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']
  let grade = ''
  if (typeof teaching.grade === 'number') grade = GRADE_NAMES[teaching.grade - 1] || ''
  else grade = teaching.grade || ''
  const g = text.match(/(一年级|二年级|三年级|四年级|五年级|六年级|七年级|八年级|九年级|高一|高二|高三)/)
  if (g) grade = g[1]
  return { title, subject, grade }
}

// 功能推荐卡片
const FEATURE_CARDS = [
  {
    icon: FileText, iconClass: 'text-[#1A3A6B]', bgClass: 'bg-brand/5',
    title: '制作教案', desc: 'AI 智能生成',
    navigateTo: '/lesson-plans/new', prompt: '帮我写一份教案',
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
  { label: '出题助手', type: 'outline' as const, prompt: '帮我出几道练习题', navigateTo: '/exercises/new' },
  { label: '家长沟通', type: 'outline' as const, prompt: '帮我写一段家长沟通话术', navigateTo: null },
  { label: '班会方案', type: 'outline' as const, prompt: '帮我设计一个班会方案', navigateTo: null },
  { label: '教学反思', type: 'outline' as const, prompt: '帮我做一次教学反思总结', navigateTo: null },
]

// IT 管理员专属功能卡片（不套教师模板）
const IT_FEATURE_CARDS = [
  {
    icon: Settings, iconClass: 'text-[#1A3A6B]', bgClass: 'bg-brand/5',
    title: '版本库维护', desc: '配置教材版本',
    navigateTo: '/settings?tab=textbook', prompt: '怎么维护教材版本库？',
  },
  {
    icon: KeyRound, iconClass: 'text-[#2B5DA8]', bgClass: 'bg-[#F0EDE8]',
    title: '重置密码', desc: '教师/学生账号',
    navigateTo: null, prompt: '怎么重置教师密码？',
  },
  {
    icon: ServerCog, iconClass: 'text-[#1A3A6B]', bgClass: 'bg-[#EAF0E8]',
    title: '系统配置', desc: '学校/校区/班级',
    navigateTo: '/settings', prompt: '怎么配置校区和班级？',
  },
  {
    icon: Wrench, iconClass: 'text-[#2B5DA8]', bgClass: 'bg-[#E8E8F0]',
    title: '故障排查', desc: '登录/AI/接口',
    navigateTo: null, prompt: '老师登录失败怎么排查？',
  },
]

// IT 管理员专属快捷指令
const IT_QUICK_COMMANDS = [
  { label: '版本库维护', type: 'primary' as const, prompt: '怎么配置和维护教材版本库？', navigateTo: '/settings?tab=textbook' },
  { label: '账号导入', type: 'outline' as const, prompt: '怎么批量导入教师和学生账号？', navigateTo: null },
  { label: '重置密码', type: 'outline' as const, prompt: '怎么重置一个教师的登录密码？', navigateTo: null },
  { label: 'License 状态', type: 'outline' as const, prompt: '怎么查看学校 License 状态？', navigateTo: null },
  { label: '故障排查', type: 'outline' as const, prompt: 'AI 服务不可用怎么排查？', navigateTo: null },
]

const AVATAR_SRC = '/xiaowei.png?v=5'

function getTimeString(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function XiaoWeiChat({ embedded }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const teaching = useTeaching()
  const { toast } = useToast()

  const [open, setOpen] = useState(embedded ? true : false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'xiaowei', content: '你好！我是小微助教，很高兴为你服务！\n有什么教学方面的需求可以随时问我 😊', time: getTimeString() },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── 多媒体状态 ──
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  // 权限：null=未请求（按钮可见），true=已授权，false=已拒绝（隐藏按钮）
  // 不主动探测——等用户点击时由浏览器自然触发授权请求
  const [hasMicPerm, setHasMicPerm] = useState<boolean | null>(null)
  const [hasCameraPerm] = useState<boolean | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const role = localStorage.getItem('demo_role') || 'teacher'
  // IT 管理员：本租户操作历史（异步拉取后注入小微上下文）
  const itHistoryRef = useRef<string>('')

  // 自动滚动
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // IT 管理员：进入时拉取本租户操作历史，缓存到 ref 供小微上下文使用
  useEffect(() => {
    if (role !== 'it_admin') return
    const token = localStorage.getItem('zhiwei_token')
    if (!token) return
    fetch('/api/ops/it-history', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (!data?.items?.length) { itHistoryRef.current = ''; return }
        const lines = data.items.map((it: any) => {
          const d = it.details || {}
          const when = (it.created_at || '').slice(0, 10)
          const what = it.resource_type === 'textbook_version'
            ? `教材版本库·${it.action}${d.version_key ? '(' + d.version_key + ')' : ''}`
            : it.resource_type === 'accounts'
              ? `账号导入·${d.type || ''}(${d.count ?? ''}条)`
              : `${it.resource_type}·${it.action}`
          return `- ${when} ${what}`
        })
        itHistoryRef.current = lines.join('\n')
      })
      .catch(() => { itHistoryRef.current = '' })
  }, [role])

  // 获取上下文（知识边界跟随 TeachingContext，切换学科/年级后重新对齐课标锚点）
  const getContext = () => {
    try {
      const raw = localStorage.getItem('zhiwei_user') || localStorage.getItem('user')
      const user = raw ? JSON.parse(raw) : {}
      const role = localStorage.getItem('demo_role') || 'teacher'
      const teacherName = user.name || '老师'
      const roleLabel = role === 'principal' ? '校长' : role === 'director' ? '教务主任' : role === 'it_admin' ? 'IT管理员' : '教师'

    // ── IT 管理员专属上下文：不套教师模板，无学科边界 ──
    if (role === 'it_admin') {
      return {
        teacher_name: teacherName,
        subject: '',
        grade: '',
        role,
        school_name: user.school_name || '达州市通川区第一小学（仿真）',
        knowledge_boundary: 'IT 管理员视角：聚焦平台运维与配置，无学科边界限制。',
        it_history: itHistoryRef.current,
        system_prompt: `你是 IT管理员助教，正在与${teacherName}沟通。请始终用"${teacherName}"或直接用"您"来称呼用户。
你的职责是平台运维与配置引导，包括教材版本库维护、账号与权限（重置密码/批量导入/角色）、系统配置（学校/校区/班级/License）、数据初始化与同步、常见故障排查（登录异常/AI 服务不可用/接口超时）。
请给具体菜单路径与可操作步骤，不要编造不存在的接口或菜单。涉及清除数据、改库、证书/域名等敏感操作，先提醒确认并走审批流程。${itHistoryRef.current ? `\n\n你已知悉该管理员在本租户近期操作记录（用于上下文参考，不要逐条复述）：\n${itHistoryRef.current}` : ''}`,
      }
    }
      // 知识边界跟随 TeachingContext 实时取值（切换学科/年级后上下文同步更新）
      const subject = teaching.subject
      const gradeName = (['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级'])[teaching.grade - 1] || '四年级'
      const textbook = teaching.currentTextbook()
      // 知识边界动态构建（按学科描述核心知识范围，其他学科走通用描述）
      const KB_HINTS: Record<string, string> = {
        '语文': '字词积累、阅读理解、写作表达、古诗文背诵',
        '数学': '数与代数、图形与几何、统计与概率、数学思考',
        '英语': '词汇语法、听说交际、阅读理解、写作表达',
        '物理': '力学、热学、声学、光学、电磁学',
        '化学': '物质结构、化学反应、元素周期、实验探究',
        '生物': '生命现象、生态环保、健康常识、实验探究',
        '历史': '时序观念、史料实证、历史理解、家国情怀',
        '地理': '空间定位、人地关系、区域认知、地理实践',
        '政治': '道德认知、法治意识、国情教育、社会责任',
      }
      const kbHint = KB_HINTS[subject] || '学科核心素养'
      return {
        teacher_name: teacherName, subject, grade: gradeName,
        school_name: user.school_name || '成都市金牛区第一小学',
        textbook_version: textbook,
        knowledge_boundary: `当前聚焦${gradeName}${subject}，知识边界：${kbHint}`,
        teacher_style: user.ai_style || '目标清晰可测，四环节结构，评语先鼓励后建议',
        role,
        system_prompt: `你是${roleLabel}助教，正在与${teacherName}（任教学科：${subject}，年级：${gradeName}）沟通。请始终用"${teacherName}"或直接用"您"来称呼用户，不要臆测或错称用户的姓名。
当前知识边界为${gradeName}${subject}，请确保所有回答和资源推荐严格限制在该学科范围内。
当前平台示例数据（供学情问答参考，不涉及具体老师的隐私归属）：
- 全校8个班级298名学生，全校均分82分
- 四年级1班85分、2班82分；三年级1班78分、2班80分；五年级1班88分、2班83分；六年级1班76分、2班81分
- 作业完成率：四1班92%、四2班88%、三1班85%、三2班90%、五1班95%、五2班87%、六1班82%、六2班89%
- 本月教案总量约70份（由多位老师共同完成）
- Token总量100万/月，当前已用约85万
如果用户用口语问数据，请从以上数据中提取并自然回答。如果问的数据不在以上列表中，如实说明暂无该数据。`,
      }
    } catch { /* ignore */ }
    return { teacher_name: '老师', subject: '语文', grade: '四年级', role: 'teacher', platform_data: '' }
  }

  const sendMessage = async (text: string, imageUrl?: string) => {
    if ((!text.trim() && !imageUrl) || loading) return
    const now = getTimeString()
    const userMsg: Message = { role: 'user', content: text, imageUrl, time: now }
    pushXiaoweiPrompt(text)
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setPreviewImage(null)
    setLoading(true)

    // ── 场景化课件产出：操作者让小微直接做一个 H5 互动课件成品 ──
    const intent = detectCoursewareIntent(text)
    if (intent.hit) {
      const meta = parseCoursewareMeta(text, { subject: teaching.subject, grade: teaching.grade })
      // 进度提示气泡
      const progressMsg: Message = {
        role: 'xiaowei',
        content: `好的，正在为你制作 H5 互动课件《${meta.title}》……（生成中，预计十几秒）`,
        time: getTimeString(),
      }
      setMessages(prev => [...prev, progressMsg])
      try {
        const res = await aiAPI.generateCourseware({
          subject: meta.subject, grade: meta.grade, lesson_title: meta.title,
          content: '', school_id: '', extra_requirements: intent.extra,
          format: 'h5',
        })
        const md = res.courseware_markdown || ''
        if (!md) throw new Error('生成内容为空')
        const teacherName = safeGetUser().name || '教师'
        // 绘本式互动课件：markdown → 结构化 Story → 自包含 H5（点读/跟读/翻页引擎）
        const h5Html = markdownToStorybookH5(md, {
          subject: meta.subject, grade: meta.grade, title: meta.title, teacherName,
          themeId: 'storybook',
        })
        const saveRes = await materialAPI.createJSON({
          name: meta.title,
          type: 'courseware',
          format: 'h5',
          tag: meta.subject,
          content: md,
          h5_html: h5Html,
          status: 'active',
          grade: meta.grade,
          subject: meta.subject,
        })
        const newId = saveRes?.id || saveRes?.data?.id || ''
        setMessages(prev => prev.concat([
          {
            role: 'xiaowei',
            content: `✅ 已为你生成 H5 互动课件《${meta.title}》，已放入「教学课件 → H5 互动课件」列表。\n\n包含：${intent.extra}；支持自动播放、点读跟读、绘图页投屏手绘。点击下方按钮即可查看放映。`,
            coursewareCard: { name: meta.title, id: newId, format: 'h5' },
            time: getTimeString(),
          },
        ]))
      } catch (e: any) {
        console.error('[XW] 课件生成失败:', e)
        setMessages(prev => prev.concat([
          {
            role: 'xiaowei',
            content: `抱歉老师，课件生成失败了：${e?.message || '请稍后重试'}。你也可以改用「教学课件 → H5 互动课件 → 新建」手动生成。`,
            time: getTimeString(),
          },
        ]))
      }
      setLoading(false)
      return
    }

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
        const res = await fetch('/api/ai/chat', {
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
      setHasMicPerm(true) // 用户已授权
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
          const res = await fetch('/api/ai/speech-to-text', { method: 'POST', body: fd })
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
      toast('无法访问麦克风，请在浏览器设置中允许麦克风权限', 'warning')
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
            <button onClick={() => setMinimized(true)} className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors" title="最小化">
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
              {(role === 'it_admin' ? IT_FEATURE_CARDS : FEATURE_CARDS).map((card, i) => (
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
              {(role === 'it_admin' ? IT_QUICK_COMMANDS : QUICK_COMMANDS).map((cmd, i) => (
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
              {m.coursewareCard && (
                <button
                  onClick={() => openWorkspace(`/courseware/h5/${m.coursewareCard!.id}`)}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors"
                >
                  📲 查看 H5 课件《{m.coursewareCard.name}》
                </button>
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

  // 移动端由 BottomNavBar 中间按钮唤起小微，不显示浮动按钮
  if (isMobile) {
    return (
      <>
        {/* 隐藏触发器供 BottomNavBar 点击 */}
        <button data-xiaowei-trigger className="hidden" onClick={() => setOpen(true)} />
        {/* 小微打开时隐藏底部浮标 */}
        {open && <style>{'[data-xiaowei-float]{display:none!important}'}</style>}
        {open && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col animate-slide-up">
            {chatContent}
          </div>
        )}
      </>
    )
  }

  // ── 内嵌模式：直接渲染面板，无浮动按钮 ──
  if (embedded) {
    return (
      <div className="w-full bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ minHeight: 520 }}>
        {chatContent}
      </div>
    )
  }

  return (
    <>
      {/* 浮动按钮（仅桌面端右下角） */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed z-50 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 overflow-hidden xw-chat-btn bottom-6 right-6 w-14 h-14"
        style={{ background: open ? 'linear-gradient(135deg, #1A3A6B, #2B5DA8)' : '#1A3A6B' }}
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

      {/* 对话面板（仅桌面端浮动窗口） */}
      {open && minimized && (
        <div className="fixed bottom-24 right-6 z-50 w-[180px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden cursor-pointer"
          onClick={() => setMinimized(false)}>
          <div className="flex items-center gap-2 px-3 py-2.5"
            style={{ background: 'linear-gradient(135deg, #1A3A6B, #2B5DA8)' }}>
            <img src={AVATAR_SRC} alt="小微" className="w-7 h-7 rounded-full object-cover border border-white/30"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <span className="text-white text-[13px] font-medium">小微</span>
            <span className="ml-auto text-[10px] text-green-300">● 在线</span>
          </div>
        </div>
      )}

      {open && !minimized && (
        <div className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-3rem)] h-[640px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {chatContent}
        </div>
      )}
    </>
  )
}
