import { useToast } from "../components/Toast"
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Send, RefreshCw, X, Save, Check, AlertTriangle, Download, FileText, Mic, MicOff, Share2, Plus, Image } from 'lucide-react'
import { useTeaching, getRecommendedDefaults, getQuestionTypes, QUESTION_TYPE_LABELS, isTypeAllowed } from '../lib/TeachingContext'
import { useKnowledgePicker } from '../hooks/useKnowledgePicker'
import { useKGContext } from '../lib/KnowledgeGraphContext'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { questionBankAPI, assignmentAPI } from '../lib/api'
import AiPreviewBadge from '../components/AiPreviewBadge'
import { exportExamPaper, exportExamAnswer } from '../lib/exportExamDocx'
import { downloadBlob } from '../lib/exportDocx'
import { printExamPaper } from '../lib/printPdf'
import EditorLayout from '../components/EditorLayout'
import KnowledgeGraphTool from '../components/KnowledgeGraphTool'
import ResourcePicker from '../components/ResourcePicker'

const PURPOSES = [
  { id: 'classwork', label: '课堂练习', icon: '📝', desc: '当堂巩固', count: [3, 5], difficulty: 'L1', time: '5-8分钟' },
  { id: 'homework', label: '课后作业', icon: '📚', desc: '课后巩固', count: [5, 10], difficulty: 'L1-L2', time: '15-20分钟' },
  { id: 'unit_test', label: '单元检测', icon: '📋', desc: '阶段测评', count: [15, 20], difficulty: 'L1-L2', time: '40分钟' },
  { id: 'monthly', label: '月考', icon: '📅', desc: '月度检测', count: [20, 25], difficulty: 'L1-L3', time: '60分钟' },
  { id: 'midterm', label: '期中考试', icon: '📊', desc: '学期中测评', count: [25, 30], difficulty: 'L1-L3', time: '90分钟' },
  { id: 'final', label: '期末考试', icon: '🏆', desc: '学期末测评', count: [30, 35], difficulty: 'L1-L3', time: '90分钟' },
  { id: 'mock', label: '模拟考试', icon: '🎯', desc: '升学适应', count: [20, 30], difficulty: 'L2-L3', time: '90分钟' },
  { id: 'olympiad', label: '奥数拓展', icon: '🌟', desc: '竞赛预备', count: [10, 15], difficulty: 'L3-L4', time: '40分钟' },
]

const SCHOOLS = [
  { id: 'bjsz', name: '北京四中', desc: '重视基础概念，题干简洁' },
  { id: 'rdfz', name: '人大附中', desc: '注重思维深度，常设进阶题' },
  { id: 'shzx', name: '上海中学', desc: '强调应用能力，融合实际' },
  { id: 'hsfz', name: '华南师大附中', desc: '题型多样，基础与拔高并重' },
  { id: 'szzx', name: '深圳中学', desc: '创新题型，跨学科融合' },
  { id: 'nsfz', name: '南京师大附中', desc: '传统文化融合，古文应用' },
]

const GRADE_NAMES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']

export default function ExerciseGenerator() {
  const navigate = useNavigate()
  const teaching = useTeaching()
  const { toast } = useToast()
  // 共享知识点选取器
  const picker = useKnowledgePicker({ autoSelect: true })
  const { setPicker: setKGPicker } = useKGContext()

  // 注册 picker 到 KnowledgePanel
  useEffect(() => {
    setKGPicker(picker as any)
    return () => setKGPicker(null)
  }, [picker])

  // 从 TeachingContext 读取全局配置
  const gradeName = GRADE_NAMES[teaching.grade - 1] || '四年级'

  // 表单状态
  const [difficulty, setDifficulty] = useState('L2')
  const [count, setCount] = useState(10)
  const [purpose, setPurpose] = useState('classwork')
  const [showPurposeGrid, setShowPurposeGrid] = useState(true)
  // 题型默认随学科变化（语文不出现计算题等不适配题型）
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    () => getQuestionTypes(teaching.subject).slice(0, 3).map((t) => t.id)
  )
  const [selectedSchool, setSelectedSchool] = useState('')
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  // AI 预览态
  const [aiPreview, setAiPreview] = useState(false)
  const [confirmedSet, setConfirmedSet] = useState<Set<number>>(new Set())
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  // 保存/发布
  const [saving, setSaving] = useState(false)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [saveMsg, setSaveMsg] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [selectedClass, setSelectedClass] = useState('')
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [assignmentDescription, setAssignmentDescription] = useState('')
  const [assignmentType, setAssignmentType] = useState('homework')
  const [tier, setTier] = useState<'basic' | 'advanced' | 'challenge'>('basic')
  const [estDuration, setEstDuration] = useState(30)
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [showPublishPanel, setShowPublishPanel] = useState(false)
  const [classes, setClasses] = useState<any[]>([])

  // 口述作业
  const [voiceRecording, setVoiceRecording] = useState(false)
  const [voiceText, setVoiceText] = useState('')

  const user = (() => { try { return JSON.parse(localStorage.getItem('zhiwei_user') || '{}') || { name: '张真真', school_name: '成都市金牛区第一小学', grade_class: '四年级 (1)班' } } catch { return { name: '张真真', school_name: '成都市金牛区第一小学', grade_class: '四年级 (1)班' } } })()

  // 从已选图谱节点派生知识点标签
  const knowledgeLabel = picker.selectedNodes.map((n: any) => n.name).join('、') || ''

  // 素材选择
  const [selectedMaterials, setSelectedMaterials] = useState<any[]>([])
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false)

  // 退出提醒：已选知识点或有生成的题目时拦截
  const hasUnsavedWork = picker.selectedIds.length > 0 || questions.length > 0
  useUnsavedChanges(hasUnsavedWork)

  const startVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { toast('您的浏览器不支持语音识别，请使用Chrome浏览器', 'warning'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.onresult = async (e: any) => {
      const text = e.results[0][0].transcript
      setVoiceText(text)
      try {
        const res = await fetch('/api/ai/homework/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('zhiwei_token') || '') },
          body: JSON.stringify({ text, grade: gradeName }),
        })
        const data = await res.json()
        setAssignmentTitle(data.title || text.slice(0, 20))
        setAssignmentDescription(data.description || text)
        if (data.warnings?.length) toast('📋 合规提醒：' + data.warnings.join('，'), 'warning')
      } catch { setAssignmentTitle(text.slice(0, 20)); setAssignmentDescription(text) }
    }
    recognition.onend = () => setVoiceRecording(false)
    setVoiceRecording(true)
    recognition.start()
  }

  // TeachingContext 学科/年级变更时自动更新推荐缺省值
  useEffect(() => {
    const d = getRecommendedDefaults(teaching)
    setDifficulty(d.difficulty)
    setCount(d.count)
    setPurpose(d.purpose)
    setSelectedTypes(d.defaultTypes)
  }, [teaching.subject, teaching.grade, teaching.textbook_math])

  const handlePurposeChange = (pId: string) => {
    setPurpose(pId)
    setShowPurposeGrid(false)
    const p = PURPOSES.find(x => x.id === pId)
    if (p) { setCount(Math.round((p.count[0] + p.count[1]) / 2)); setDifficulty(p.difficulty.includes('-') ? p.difficulty.split('-')[0] : p.difficulty) }
  }

  const toggleType = (typeId: string) => {
    setSelectedTypes(prev => prev.includes(typeId) ? prev.filter(t => t !== typeId) : [...prev, typeId])
  }

  const handleGenerate = async () => {
    if (picker.selectedIds.length === 0) return
    setGenerating(true)
    setSavedIds([]); setSaveMsg(''); setShowPublishPanel(false)
    try {
      const res = await fetch('/api/ai/exam/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('zhiwei_token') || '') },
        body: JSON.stringify({
          subject: teaching.subject, grade: gradeName, semester: teaching.semester,
          difficulty, count,
          purpose, question_types: selectedTypes,
          school_style: selectedSchool || undefined,
          selected_knowledge_ids: picker.selectedIds,
          textbook_version: teaching.currentTextbook(),
        }),
      })
      const data = await res.json()
      // 净化：AI 可能返回跨学科题型（如语文产出"计算题"），统一归一到本学科允许题型
      const allowed = getQuestionTypes(teaching.subject).map((t) => t.id)
      const raw = data.questions || []
      const norm = raw.map((q: any) =>
        isTypeAllowed(teaching.subject, q.type) ? q : { ...q, type: allowed[0] }
      )
      setQuestions(norm)
      setTotalCount(data.total_questions || 0)
      setAiPreview(true)
      setConfirmedSet(new Set())
      setEditingQuestion(null)
    } catch (e: any) { toast('出题失败: ' + (e.message || '网络错误'), 'error') }
    setGenerating(false)
  }

  const handleSaveToBank = async () => {
    if (questions.length === 0) return
    setSaving(true); setSaveMsg('')
    try {
      const kps = picker.selectedNodes.map((n: any) => n.name)
      const res = await questionBankAPI.save({
        questions: questions.map((q: any) => ({
          type: q.type || 'choice',
          content: q.content,
          difficulty: difficulty,
          knowledge_points: kps,
        })),
        subject: teaching.subject,
        grade: gradeName,
        semester: teaching.semester,
        textbook_version: teaching.textbook_math,
        chapter_unit: teaching.current_unit_name || teaching.current_lesson_name || '',
        source: 'ai_generated',
        source_prompt: `出题: ${knowledgeLabel}, 用途: ${purpose}, 题型: ${selectedTypes.join(',')}`,
      })
      setSavedIds(res.question_ids || [])
      setSaveMsg(`已保存 ${res.count || res.question_ids?.length || 0} 道题目到个人题库`)
    } catch (e: any) {
      toast('保存失败: ' + (e.message || '网络错误'), 'error')
    }
    setSaving(false)
  }

  const handleExportPaper = async () => {
    if (questions.length === 0) return
    try {
      const title = `${knowledgeLabel || '练习'} - ${PURPOSES.find(p => p.id === purpose)?.label || '试卷'}`
      const blob = await exportExamPaper(questions, {
        subject: teaching.subject, grade: gradeName, title, difficulty,
        teacherName: user?.name || '教师', totalScore: 100,
      })
      downloadBlob(blob, `${user?.name || '教师'}_${title}_${teaching.subject}${gradeName}_学生卷.docx`)
    } catch (e: any) { toast('导出失败: ' + e.message, 'error') }
  }

  const handlePrintPaperPdf = () => {
    if (questions.length === 0) return
    printExamPaper(questions, {
      subject: teaching.subject, grade: gradeName,
      title: `${knowledgeLabel || '练习'} - ${PURPOSES.find(p => p.id === purpose)?.label || '试卷'}`,
      difficulty, teacherName: user?.name || '教师',
    })
  }

  const handleExportAnswer = async () => {
    if (questions.length === 0) return
    try {
      const title = `${knowledgeLabel || '练习'} - ${PURPOSES.find(p => p.id === purpose)?.label || '试卷'}`
      const blob = await exportExamAnswer(questions, {
        subject: teaching.subject, grade: gradeName, title, difficulty,
        teacherName: user?.name || '教师', totalScore: 100,
      })
      downloadBlob(blob, `${user?.name || '教师'}_${title}_${teaching.subject}${gradeName}_答案卷.docx`)
    } catch (e: any) { toast('导出失败: ' + e.message, 'error') }
  }

  const handlePublish = async () => {
    if (!selectedClass || !assignmentTitle.trim()) {
      toast('请选择班级和作业标题', 'warning')
      return
    }
    setPublishing(true)
    try {
      const dupRes = await questionBankAPI.checkDuplicate(selectedClass, savedIds)
      if (dupRes.has_duplicate) {
        setDuplicates(Object.values(dupRes.duplicates).flat())
        setPublishing(false)
        return
      }
      await assignmentAPI.create({
        class_id: selectedClass,
        subject: teaching.subject,
        title: assignmentTitle,
        type: assignmentType,
        question_ids: savedIds,
        content: assignmentDescription || undefined,
        tier, estimated_duration: estDuration,
        difficulty_level: difficulty,
        knowledge_node_ids: JSON.stringify(picker.selectedIds),
      })
      toast('作业已发布！', 'success')
      navigate('/exercises')
    } catch (e: any) {
      if (e.message?.includes('已经在该班级布置过') || e.message?.includes('409')) {
        setDuplicates(e.duplicates || [])
      } else {
        toast('发布失败: ' + (e.message || '网络错误'), 'error')
      }
    }
    setPublishing(false)
  }

  useEffect(() => {
    import('../lib/api').then(({ classAPI }) => {
      classAPI.list().then((res: any) => {
        setClasses(res.items || [])
      }).catch(() => { })
    })
  }, [])

  // ============ Left Panel ============
  const leftPanel = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {/* 基本信息 */}
        <div className="px-5 py-3">
          <h3 className="text-[13px] font-semibold text-[#353535] mb-3">基本信息</h3>
          <div className="flex gap-4">
            <div className="space-y-2 text-[12px] flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[#9A9A9A] w-10">学科</span>
                <span className="text-[#353535]">{teaching.subject}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#9A9A9A] w-10">年级</span>
                <span className="text-[#353535]">{gradeName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#9A9A9A] w-10">班级</span>
                <span className="text-[#353535]">{user?.grade_class || '四年级 (1)班'}</span>
              </div>
            </div>
            <div className="w-[80px] h-[100px] bg-[#F6F7F8] rounded-[4px] border border-[#E7E7EB] flex items-center justify-center text-[11px] text-[#9A9A9A] text-center">
              {teaching.currentTextbook()}<br />{gradeName}{teaching.semester === '下' ? '下册' : '上册'}
              {teaching.licenseStatus === 'active'
                ? <span className="text-[#15A85F]"> · 学校统一配置</span>
                : <span className="text-[#9A9A9A]"> · 个人试用</span>}
            </div>
          </div>
          {/* 进度条 */}
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[11px] text-[#9A9A9A]">当前进度</span>
            <div className="flex-1 h-1.5 bg-[#F6F7F8] rounded-full overflow-hidden">
              <div className="h-full bg-[#02A7F0] rounded-full transition-all" style={{ width: teaching.progress_percent + '%' }} />
            </div>
            <span className="text-[11px] text-[#9A9A9A]">{teaching.progress_percent}%</span>
          </div>
        </div>

        {/* 命题用途 */}
        <div className="px-5 py-3 border-b border-[#E7E7EB]">
          <label className="block text-[12px] font-medium text-[#353535] mb-2">命题用途</label>
          {showPurposeGrid ? (
            <div className="grid grid-cols-2 gap-2">
              {PURPOSES.map(p => (
                <button key={p.id} onClick={() => handlePurposeChange(p.id)}
                  className={`text-left p-2.5 rounded-[4px] border transition-all ${purpose === p.id ? 'border-[#02A7F0] bg-[#02A7F0]/5' : 'border-[#E7E7EB] hover:border-[#9A9A9A]'}`}>
                  <div className="text-base mb-0.5">{p.icon}</div>
                  <div className="text-[12px] font-semibold text-[#353535]">{p.label}</div>
                  <div className="text-[10px] text-[#9A9A9A]">{p.desc} · {p.time}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 border-l-[3px] border-[#02A7F0] bg-[#02A7F0]/5 rounded-[4px]">
              <span className="text-base">{PURPOSES.find(p => p.id === purpose)?.icon}</span>
              <span className="text-[12px] font-semibold text-[#353535]">{PURPOSES.find(p => p.id === purpose)?.label}</span>
              <span className="text-[10px] text-[#9A9A9A]">{PURPOSES.find(p => p.id === purpose)?.count[0]}-{PURPOSES.find(p => p.id === purpose)?.count[1]}题 · {PURPOSES.find(p => p.id === purpose)?.difficulty}</span>
              <button onClick={() => setShowPurposeGrid(true)} className="ml-auto text-[11px] text-[#02A7F0] hover:underline">修改</button>
            </div>
          )}
        </div>

        {/* 知识点 */}
        <div className="px-5 py-3 border-b border-[#E7E7EB]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#353535]">知识点 <span className="text-red-500">*</span></span>
            <span className="text-[10px] text-[#9A9A9A]">({picker.selectedIds.length}/12)</span>
          </div>
          {picker.selectedNodes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {picker.selectedNodes.map(n => (
                <span key={n.id} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#F0F0F0] text-[#353535] rounded-full">
                  {n.name}
                  <button onClick={() => picker.setSelectedIds(prev => prev.filter(id => id !== n.id))} className="text-[#9A9A9A] hover:text-[#FF4D4F]">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[#9A9A9A]">请在右侧知识图谱中选取知识点</p>
          )}
        </div>

        {/* 引用素材 */}
        <div className="px-5 py-3 border-b border-[#E7E7EB]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#353535]">引用素材</span>
            <button onClick={() => setMaterialPickerOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-[#02A7F0] border border-[#02A7F0]/30 rounded-[4px] hover:bg-[#02A7F0]/5">
              <Plus size={12} />选择素材
            </button>
          </div>
          {selectedMaterials.length === 0 ? (
            <p className="text-[11px] text-[#9A9A9A]">点击「选择素材」引用图片、文档、音频等教学资源</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedMaterials.map(m => (
                <span key={m.id} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#F0F0F0] text-[#353535] rounded-full">
                  <Image size={12} className="text-[#9A9A9A]" />
                  {m.name}
                  <button onClick={() => setSelectedMaterials(prev => prev.filter(x => x.id !== m.id))}
                    className="text-[#9A9A9A] hover:text-[#FF4D4F]">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 难度 + 题量 */}
        <div className="px-5 py-3 border-b border-[#E7E7EB] flex gap-3">
          <div className="flex-1">
            <label className="block text-[12px] text-[#9A9A9A] mb-1.5">难度</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
              className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
              <option value="L1">L1 - 基础</option>
              <option value="L2">L2 - 中等</option>
              <option value="L3">L3 - 进阶</option>
              <option value="L4">L4 - 挑战</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[12px] text-[#9A9A9A] mb-1.5">题量</label>
            <select value={count} onChange={e => setCount(Number(e.target.value))}
              className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
              {[3, 5, 8, 10, 15, 20, 25, 30, 35].map(n => <option key={n} value={n}>{n} 题</option>)}
            </select>
          </div>
        </div>

        {/* 题型 */}
        <div className="px-5 py-3 border-b border-[#E7E7EB]">
          <label className="block text-[12px] font-medium text-[#353535] mb-2">题型（已选 {selectedTypes.length} 种）</label>
          <div className="flex flex-wrap gap-1.5">
            {getQuestionTypes(teaching.subject).map(t => (
              <button key={t.id} onClick={() => toggleType(t.id)}
                className={`px-2.5 py-1 text-[11px] rounded-[4px] border transition-colors ${selectedTypes.includes(t.id) ? 'bg-[#02A7F0]/10 text-[#02A7F0] border-[#02A7F0]/30' : 'border-[#E7E7EB] text-[#9A9A9A] hover:border-[#9A9A9A]'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 名校风格 */}
        <div className="px-5 py-3 border-b border-[#E7E7EB]">
          <label className="block text-[12px] text-[#9A9A9A] mb-2">名校风格（可选）</label>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSelectedSchool('')}
              className={`px-2 py-1 text-[11px] rounded-[4px] border ${!selectedSchool ? 'bg-[#02A7F0]/10 text-[#02A7F0] border-[#02A7F0]/30' : 'border-[#E7E7EB] text-[#9A9A9A]'}`}>标准</button>
            {SCHOOLS.map(s => (
              <button key={s.id} onClick={() => setSelectedSchool(s.id)}
                className={`px-2 py-1 text-[11px] rounded-[4px] border transition-colors ${selectedSchool === s.id ? 'bg-[#02A7F0]/10 text-[#02A7F0] border-[#02A7F0]/30' : 'border-[#E7E7EB] text-[#9A9A9A] hover:border-[#9A9A9A]'}`}>
                {s.name}
              </button>
            ))}
          </div>
          {selectedSchool && <p className="text-[10px] text-[#9A9A9A] mt-1.5">"{SCHOOLS.find(s => s.id === selectedSchool)?.desc}"</p>}
        </div>

        {/* 生成按钮（初始态） */}
        {questions.length === 0 && (
          <div className="px-5 py-4">
            <button onClick={handleGenerate} disabled={generating || picker.selectedIds.length === 0}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#353535] text-white rounded-[4px] hover:bg-[#1A1A1A] transition-colors disabled:opacity-50">
              <Sparkles size={20} className="text-[#02A7F0] shrink-0" />
              <span className="text-[12px]">有什么需求，支持会话式补充出题要求...</span>
            </button>
          </div>
        )}

        {/* 生成结果 */}
        {questions.length > 0 && !generating && (
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#353535]">
                {knowledgeLabel || '知识图谱选题'} · {difficulty} · {totalCount}题
              </span>
              <button onClick={handleGenerate} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-[#9A9A9A] border border-[#E7E7EB] rounded-[4px] hover:bg-[#F6F7F8]">
                <RefreshCw size={12} />重新生成
              </button>
            </div>

            {questions.map((q: any, i: number) => {
              const isConfirmed = confirmedSet.has(i)
              const isEditing = editingQuestion === i
              return (
                <AiPreviewBadge
                  key={i}
                  preview={aiPreview && !isConfirmed}
                  confirmed={isConfirmed}
                  onConfirm={() => setConfirmedSet(prev => new Set(prev).add(i))}
                  onEdit={() => { setEditingQuestion(i); setEditContent(q.content || '') }}
                  onCancel={() => setQuestions(prev => prev.filter((_: any, idx: number) => idx !== i))}
                >
                  <div
                    className="flex items-start gap-2 p-3 bg-[#F6F7F8] rounded-[4px]"
                    style={{ resize: 'both', overflow: 'auto', minWidth: '200px', minHeight: '60px', maxWidth: '100%' }}
                  >
                    <span className="text-sm font-medium text-[#02A7F0] w-5 shrink-0">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editContent} onChange={e => setEditContent(e.target.value)}
                            className="flex-1 text-[13px] border border-[#E7E7EB] rounded-[4px] px-2 py-1 outline-none focus:border-[#02A7F0]"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                setQuestions(prev => prev.map((q: any, idx: number) => idx === i ? { ...q, content: editContent } : q))
                                setEditingQuestion(null); setConfirmedSet(prev => new Set(prev).add(i))
                              }
                              if (e.key === 'Escape') setEditingQuestion(null)
                            }}
                          />
                          <button onClick={() => {
                            setQuestions(prev => prev.map((q: any, idx: number) => idx === i ? { ...q, content: editContent } : q))
                            setEditingQuestion(null); setConfirmedSet(prev => new Set(prev).add(i))
                          }} className="p-1 text-green-500 hover:bg-green-50 rounded-[4px]">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingQuestion(null)} className="p-1 text-[#9A9A9A] hover:bg-[#F6F7F8] rounded-[4px]">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[13px] text-[#353535]">{q.content}</span>
                      )}
                      {q.type && (
                        <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-[#E7E7EB] rounded text-[#9A9A9A]">
                          {QUESTION_TYPE_LABELS[q.type] || q.type}
                        </span>
                      )}
                    </div>
                  </div>
                </AiPreviewBadge>
              )
            })}

            {/* 操作按钮 */}
            <div className="space-y-3 pt-2 border-t border-[#E7E7EB]">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={handleExportPaper} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-green-300 text-green-700 rounded-[4px] hover:bg-green-50">
                  <Download size={14} />学生卷 Word
                </button>
                <button onClick={handlePrintPaperPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-red-200 text-red-600 rounded-[4px] hover:bg-red-50">
                  <FileText size={14} />学生卷 PDF
                </button>
                <button onClick={handleExportAnswer} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-amber-300 text-amber-700 rounded-[4px] hover:bg-amber-50">
                  <FileText size={14} />答案卷 Word
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={handleSaveToBank} disabled={saving || savedIds.length > 0}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[12px] rounded-[4px] border font-medium transition-all ${
                    savedIds.length > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-[#02A7F0] border-[#02A7F0] hover:bg-[#02A7F0]/5'
                  } disabled:opacity-60`}>
                  {savedIds.length > 0 ? <><Check size={14} />{saveMsg}</> : saving ? <><div className="w-3.5 h-3.5 border-2 border-[#02A7F0]/30 border-t-[#02A7F0] rounded-full animate-spin" />保存中...</> : <><Save size={14} />保存到个人题库</>}
                </button>
                {savedIds.length > 0 && !showPublishPanel && (
                  <button onClick={() => { setShowPublishPanel(true); setAssignmentTitle(knowledgeLabel + ' - ' + PURPOSES.find(p => p.id === purpose)?.label || '') }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#02A7F0] text-white text-[12px] rounded-[4px] hover:bg-[#0288D1] transition-colors">
                    <Send size={14} />保存并布置为作业
                  </button>
                )}
              </div>

              {/* 发布面板 */}
              {showPublishPanel && (
                <div className="space-y-3 p-3 border border-[#E7E7EB] rounded-[4px] bg-[#F6F7F8]">
                  {duplicates.length > 0 && (
                    <div className="flex items-start gap-2 p-2.5 bg-red-50 rounded-[4px] border border-red-200">
                      <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                      <div className="text-[12px] text-red-700">
                        <p className="font-medium">部分题目已在该班级布置过：</p>
                        {duplicates.map((d: any, i: number) => (
                          <p key={i} className="text-[11px] mt-1">· 题目 {i + 1} 已在「{d.assignment_title}」中使用</p>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-[#9A9A9A] mb-1">选择班级</label>
                      <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
                        <option value="">请选择班级</option>
                        {classes.map((c: any) => (<option key={c.id} value={c.id}>{c.name} ({c.grade})</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#9A9A9A] mb-1">作业类型</label>
                      <select value={assignmentType} onChange={e => setAssignmentType(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
                        <option value="homework">课后作业</option>
                        <option value="exercise">课堂练习</option>
                        <option value="exam">单元检测/考试</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#9A9A9A] mb-1">分层</label>
                      <select value={tier} onChange={e => setTier(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
                        <option value="basic">📘 基础（全班必做）</option>
                        <option value="advanced">📙 提高（学有余力选做）</option>
                        <option value="challenge">📕 挑战（尖子生选做）</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#9A9A9A] mb-1">预估时长（分钟）</label>
                      <input type="number" value={estDuration} onChange={e => setEstDuration(Number(e.target.value))} min={5} max={120}
                        className="w-full px-2.5 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] text-[#9A9A9A] mb-1">作业标题</label>
                      <div className="flex gap-2">
                        <input type="text" value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)}
                          placeholder="输入作业标题" className="flex-1 px-2.5 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]" />
                        <button onClick={startVoice} disabled={voiceRecording}
                          className={`px-2.5 py-1.5 rounded-[4px] border text-[12px] flex items-center gap-1 ${voiceRecording ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'border-[#E7E7EB] text-[#9A9A9A] hover:bg-[#F6F7F8]'}`}>
                          {voiceRecording ? <MicOff size={14} /> : <Mic size={14} />}
                        </button>
                      </div>
                      {voiceText && <div className="text-[10px] text-[#9A9A9A] mt-1">识别：{voiceText.slice(0, 60)}{voiceText.length > 60 ? '...' : ''}</div>}
                      <label className="block text-[11px] text-[#9A9A9A] mb-1 mt-2">作业说明（选填）</label>
                      <textarea value={assignmentDescription} onChange={e => setAssignmentDescription(e.target.value)}
                        rows={2} placeholder="如无题库题目，可直接描述作业内容" className="w-full px-2.5 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] resize-none" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handlePublish} disabled={publishing || !selectedClass || !assignmentTitle.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#02A7F0] text-white rounded-[4px] hover:bg-[#0288D1] transition-colors disabled:opacity-50 text-[12px] font-medium">
                      {publishing ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />发布中...</> : <><Check size={14} />确认发布</>}
                    </button>
                    {questions.length > 0 && !selectedClass && (
                      <button onClick={() => {
                        const url = `/s?title=${encodeURIComponent(assignmentTitle || knowledgeLabel || '作业')}&subject=${encodeURIComponent(teaching.subject)}&grade=${encodeURIComponent(gradeName)}&teacher=${encodeURIComponent(user?.name || '教师')}`
                        navigator.clipboard.writeText(window.location.origin + url)
                        toast('分享链接已复制到剪贴板', 'success')
                      }} className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#02A7F0] border border-[#02A7F0]/30 rounded-[4px] hover:bg-[#02A7F0]/5">
                        <Share2 size={14} />分享链接
                      </button>
                    )}
                    <button onClick={() => { setShowPublishPanel(false); setDuplicates([]) }}
                      className="px-3 py-2 text-[12px] text-[#9A9A9A] hover:text-[#353535]">取消</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {generating && (
          <div className="px-5 py-6 text-center">
            <div className="w-10 h-10 mx-auto mb-3 border-4 border-[#02A7F0]/20 border-t-[#02A7F0] rounded-full animate-spin" />
            <p className="text-[13px] text-[#9A9A9A]">小微正在生成{selectedTypes.length}种题型...</p>
          </div>
        )}
      </div>

      {/* Fixed Bottom Buttons — 与教案页一致 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0] bg-white shrink-0 flex gap-3">
        <button onClick={handleSaveToBank}
          className="flex-1 px-4 py-2.5 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors">
          保存为草稿
        </button>
        <button onClick={() => setShowPublishPanel(true)}
          className="flex-1 px-4 py-2.5 text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] transition-colors">
          预览
        </button>
        <button onClick={handlePublish} disabled={publishing || savedIds.length === 0}
          className="flex-1 px-4 py-2.5 text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] disabled:opacity-50 transition-colors">
          发布到题库
        </button>
      </div>
    </div>
  )

  // ============ Right Panel ============
  const rightPanel = (
    <KnowledgeGraphTool
      data={picker.knowledgeData}
      filter={{ subject: teaching.subject, grade: teaching.grade, semester: teaching.semester }}
      selectedIds={picker.selectedIds}
      onSelect={ids => picker.setSelectedIds(ids)}
    />
  )


  return (
    <>
      <EditorLayout left={leftPanel} right={rightPanel} subtitle="AI辅助智能出题，知识图谱驱动精准选题" />
      <ResourcePicker
        open={materialPickerOpen}
        mode="materials"
        onClose={() => setMaterialPickerOpen(false)}
        onSelect={items => setSelectedMaterials(items)}
        selectedIds={selectedMaterials.map(m => m.id)}
      />
    </>
  )
}
