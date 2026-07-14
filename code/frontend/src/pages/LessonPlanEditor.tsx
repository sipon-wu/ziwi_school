import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Sparkles, Save, BookOpen, Send, X, Target, Download, ChevronDown, ChevronRight, FileText, Monitor, Search, Plus, Bell, ZoomIn, ZoomOut } from 'lucide-react'
import { aiAPI, lessonPlanAPI, materialAPI } from '../lib/api'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTeaching } from '../lib/TeachingContext'
import { useKnowledgePicker } from '../hooks/useKnowledgePicker'
import { useToast } from '../components/Toast'
import { getXiaoweiContext } from '../lib/xiaoweiContext'
import { buildKnowledgeScope } from '../lib/knowledgeScope'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { useKGContext } from '../lib/KnowledgeGraphContext'
import { exportLessonPlanToDocx, downloadBlob } from '../lib/exportDocx'
import { parseSections, combineSections } from '../lib/parseSections'
import { printLessonPlan } from '../lib/printPdf'
import PresentationMode from '../components/PresentationMode'
import { exportH5Courseware, downloadBlob as h5Download } from '../lib/exportH5'
import ResourcePicker from '../components/ResourcePicker'
import EditorLayout from '../components/EditorLayout'
import KnowledgeGraphTool from '../components/KnowledgeGraphTool'
import MDEditor from '@uiw/react-md-editor'
const safeGetUser = () => { try { return JSON.parse(localStorage.getItem('zhiwei_user') || localStorage.getItem('user') || '{}') || {} } catch { return {} } }

// 从 JWT 解码 school_id（与后端写入素材库的 school_id 一致，避免 user 对象里的 school_id 与素材库不匹配）
const getSchoolId = () => {
  try {
    const t = localStorage.getItem('zhiwei_token') || ''
    const payload = JSON.parse(atob(t.split('.')[1]))
    return payload.school_id || ''
  } catch { return '' }
}

export default function LessonPlanEditor() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEditing = Boolean(id)
  const teaching = useTeaching()

  // 共享知识点选取器
  const picker = useKnowledgePicker({ autoSelect: true })
  const { setPicker: setKGPicker } = useKGContext()

  // 注册 picker 到 KnowledgePanel
  useEffect(() => {
    setKGPicker(picker as any)
    return () => setKGPicker(null)
  }, [picker])

  // 已保存教案的知识节点 ID（编辑模式回显）
  const [savedKnowledgeIds, setSavedKnowledgeIds] = useState<string[]>([])

  const [subject, setSubject] = useState(teaching.subject)
  const [grade, setGrade] = useState(['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级'][teaching.grade - 1] || '四年级')
  const [lessonTitle, setLessonTitle] = useState('')
  const [textbookUnit, setTextbookUnit] = useState('')
  const [period, setPeriod] = useState(1)
  const [template, setTemplate] = useState('core_literacy')
  const [generating, setGenerating] = useState(false)
  const [extraRequirements, setExtraRequirements] = useState('')
  const [content, setContent] = useState('')
  const [planId, setPlanId] = useState<string|null>(id || null)
  const [saving, setSaving] = useState(false)
  const [curriculum, setCurriculum] = useState<any[]>([])
  const [modelVersion, setModelVersion] = useState('')
  // AI 预览态
  const [aiPreview, setAiPreview] = useState(false)
  const [aiConfirmed, setAiConfirmed] = useState(false)
  const [genTime, setGenTime] = useState(0)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)
  const [showPresentation, setShowPresentation] = useState(false)
  const [_autoSaveTip, setAutoSaveTip] = useState('')
  const [customTags, setCustomTags] = useState<string[]>(['自定义标签1'])
  const [newTagInput, setNewTagInput] = useState('')

  // 关联课件（material_refs）：作者指定 + AI 决定挂载
  const [materialRefs, setMaterialRefs] = useState<string[]>([])
  const [recommendedMaterials, setRecommendedMaterials] = useState<string[]>([])
  const [showMaterialPicker, setShowMaterialPicker] = useState(false)
  const [materialMap, setMaterialMap] = useState<Record<string, any>>({})
  // 课件生成（AI 润色 + 找相近生成新版本）
  const [coursewareMarkdown, setCoursewareMarkdown] = useState('')
  const [showCourseware, setShowCourseware] = useState(false)
  const [generatingCourseware, setGeneratingCourseware] = useState(false)
  const [coursewareSimilar, setCoursewareSimilar] = useState<any>(null)
  const [savingCourseware, setSavingCourseware] = useState(false)

  // 编辑模式切换：AI 模式（元数据+知识图谱+AI） / 文档模式（腾讯文档式自由排版）
  // 编辑模式：优先以 URL ?mode=doc 进入文档模式；SPA 导航时首帧 searchParams 可能滞后，
  // 故用 effect 跟随 searchParams 变化再同步一次，避免首帧误判为 AI 模式。
  const [editMode, setEditMode] = useState<'ai' | 'doc'>(
    () => (searchParams.get('mode') === 'doc' ? 'doc' : 'ai')
  )
  useEffect(() => {
    setEditMode(searchParams.get('mode') === 'doc' ? 'doc' : 'ai')
  }, [searchParams])
  // AI 润色覆盖确认（仅编辑已有且正文非空时提示，会话内可“不再提示”）
  const [showAiConfirm, setShowAiConfirm] = useState(false)
  const handleAiClick = () => {
    if (!isEditing || !content) { handleGenerate(); return }
    if (sessionStorage.getItem('lp_skip_ai_confirm') === '1') { handleGenerate(); return }
    setShowAiConfirm(true)
  }

  // 拉取素材库，建立 id -> 素材 映射（用于展示已挂载课件名称）
  const loadMaterialsMap = async () => {
    try {
      const res = await materialAPI.list()
      const map: Record<string, any> = {}
      ;(res.items || []).forEach((m: any) => { map[m.id] = m })
      setMaterialMap(map)
    } catch { /* 忽略 */ }
  }
  useEffect(() => { loadMaterialsMap() }, [])

  // 自动保存（30秒，仅新建模式未保存时触发）
  useEffect(() => {
    if (!content || planId || showFinalizeConfirm) return
    const timer = setTimeout(async () => {
      try {
        const kIds = picker.selectedIds.length > 0 ? picker.selectedIds : savedKnowledgeIds
        const saved = await lessonPlanAPI.create({
          subject, grade, title: lessonTitle || '未命名教案', unit: textbookUnit, period,
          content, format_template: template,
          curriculum_alignments: JSON.stringify(curriculum),
          knowledge_node_ids: JSON.stringify(kIds),
          ai_generated: true, ai_model_version: modelVersion || 'qwen-plus', generation_time_ms: genTime,
        })
        setPlanId(saved.id); setSavedKnowledgeIds(kIds); setAutoSaveTip('已自动保存')
        setTimeout(() => setAutoSaveTip(''), 2000)
      } catch { /* 自动保存失败静默 */ }
    }, 30000)
    return () => clearTimeout(timer)
  }, [content])

  // 浏览器关闭/刷新拦截（统一 hook）
  const hasUnsavedChanges = content.length > 0 && !showFinalizeConfirm
  useUnsavedChanges(hasUnsavedChanges)

  // 应用内导航拦截（SideBar Link 点击）
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const pendingNavRef = useRef<{ state: any; title: string; url?: string | null } | null>(null)
  const origPushRef = useRef<typeof window.history.pushState>(window.history.pushState)

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const orig = window.history.pushState.bind(window.history)
    origPushRef.current = orig
    const handler = function (this: History, state: any, title: string, url?: string | URL | null) {
      pendingNavRef.current = { state, title, url: url?.toString() ?? null }
      setShowLeaveDialog(true)
    }
    window.history.pushState = handler as typeof window.history.pushState
    return () => {
      window.history.pushState = orig
      pendingNavRef.current = null
    }
  }, [hasUnsavedChanges])

  const confirmLeave = () => {
    setShowLeaveDialog(false)
    const pending = pendingNavRef.current
    pendingNavRef.current = null
    if (pending) {
      origPushRef.current(pending.state, pending.title, pending.url ?? '')
    }
  }

  const cancelLeave = () => {
    setShowLeaveDialog(false)
    pendingNavRef.current = null
  }

  // 编辑模式加载已有教案
  useEffect(() => {
    if (!id) return
    setLoadingExisting(true)
    lessonPlanAPI.get(id).then(data => {
      setSubject(data.subject || '语文')
      setGrade(data.grade || '四年级')
      setLessonTitle(data.title || data.lesson_title || '')
      setTextbookUnit(data.textbook_unit || '')
      setPeriod(data.period || 1)
      setTemplate(data.format_template || 'core_literacy')
      const c = data.content || ''
      setContent(c === '{}' || c === '""' ? '' : c)
      setPlanId(data.id)
      if (data.curriculum_alignments) {
        try { setCurriculum(JSON.parse(data.curriculum_alignments)) } catch { setCurriculum([]) }
      }
      setModelVersion(data.ai_model_version || '')
      // 回显已挂载课件
      if (data.material_refs) {
        try {
          const refs = typeof data.material_refs === 'string' ? JSON.parse(data.material_refs) : data.material_refs
          if (Array.isArray(refs)) setMaterialRefs(refs)
        } catch { /* ignore */ }
      }
      // 回显已保存的知识点
      if (data.knowledge_node_ids) {
        try {
          const ids = JSON.parse(data.knowledge_node_ids)
          if (Array.isArray(ids)) {
            setSavedKnowledgeIds(ids)
            picker.setSelectedIds(ids)
          }
        } catch { /* ignore */ }
      }
    }).catch(() => {
      // 加载失败仍可用空白表单
    }).finally(() => setLoadingExisting(false))
  }, [id])

  // 当前使用的知识点 ID（编辑已有内容时用保存的，新建时用选取器最新的）
  const currentKnowledgeIds = content ? savedKnowledgeIds : picker.selectedIds

  const handleGenerate = async () => {
    if (!lessonTitle.trim()) { toast('请先填写教案标题', 'warning'); return }
    // 必填校验：自动预选已满足缺省值，但用户主动清空时需拦截
    if (picker.selectedIds.length === 0) {
      toast('请先在知识图谱中选取本课知识点', 'warning')
      return
    }
    setGenerating(true)
    try {
      const res = await aiAPI.generateLessonPlan({
        subject, grade, lesson_title:lessonTitle, textbook_unit:textbookUnit, period, format_template:template,
        selected_knowledge_ids: picker.selectedIds,
        ...buildKnowledgeScope(picker),
        school_id: getSchoolId(),
        textbook_version: teaching.currentTextbook(),
        extra_requirements: extraRequirements || undefined,
        chat_context: getXiaoweiContext() || undefined,
      })
      // 仅设置预览内容，不自动保存（等用户确认后手动保存）
      setContent(res.content); setCurriculum(res.curriculum_alignments||[]); setModelVersion(res.model||'qwen-plus'); setGenTime(res.generation_time_ms||0)
      setPlanId(null) // 确保走新建流程，不误覆盖已有教案
      setAiPreview(true)
      setAiConfirmed(false)
      // AI 决定挂载：生成时一并推荐适宜课件
      if (Array.isArray(res.material_refs) && res.material_refs.length) {
        setMaterialRefs(prev => Array.from(new Set([...prev, ...res.material_refs])))
        setRecommendedMaterials(Array.isArray(res.recommended_materials) ? res.recommended_materials : [])
        toast(`AI 已推荐 ${res.material_refs.length} 个课件，可在左侧「关联课件」中增删`, 'success')
      }
    } catch(e:any) { toast('AI 生成失败: '+(e.message||'未知错误'), 'error') }
    setGenerating(false)
  }

  const handleFinalize = async () => {
    if(!planId)return; setSaving(true)
    try {
      await lessonPlanAPI.update(planId, { content, knowledge_node_ids: JSON.stringify(currentKnowledgeIds), material_refs: JSON.stringify(materialRefs) })
      await lessonPlanAPI.finalize(planId)
      navigate('/lesson-plans')
    } catch(e:any){ toast('定稿失败', 'error') }
    setSaving(false)
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      const kIds = picker.selectedIds.length > 0 ? picker.selectedIds : savedKnowledgeIds
      const knowledgeNodeIds = JSON.stringify(kIds)
      if (!planId) {
        // 首次保存：创建教案（允许仅标题无正文——草稿本就可以只填标题）
        const saved = await lessonPlanAPI.create({
          subject, grade, title: lessonTitle || '未命名教案', unit: textbookUnit, period,
          content, format_template: template,
          curriculum_alignments: JSON.stringify(curriculum),
          knowledge_node_ids: knowledgeNodeIds,
          material_refs: JSON.stringify(materialRefs),
          ai_generated: false,
        })
        setPlanId(saved.id)
        setSavedKnowledgeIds(kIds)
      } else {
        await lessonPlanAPI.update(planId, { content, knowledge_node_ids: knowledgeNodeIds, material_refs: JSON.stringify(materialRefs) })
      }
      toast('已保存为草稿', 'success')
    } catch (e: any) { toast('保存失败: ' + (e.message || '网络错误'), 'error') }
    setSaving(false)
  }

  const handleExportDocx = async () => {
    if (!content) return
    try {
      const teacherName = safeGetUser().name || '教师'
      const blob = await exportLessonPlanToDocx(content, {
        subject, grade, title: lessonTitle || '未命名教案',
        textbookUnit: textbookUnit || undefined,
        period, teacher: teacherName,
        model: modelVersion || 'qwen-plus',
      })
      const filename = `${teacherName}_${lessonTitle || '教案'}_${subject}${grade}.docx`
      downloadBlob(blob, filename)
    } catch (e: any) { toast('导出失败: ' + (e.message || '未知错误'), 'error') }
  }

  const _handleExportH5 = () => {
    if (!content) return
    const blob = exportH5Courseware(content, {
      subject, grade, title: lessonTitle || '未命名教案', teacherName: safeGetUser().name || '教师',
    })
    h5Download(blob, `${lessonTitle||'课件'}_${subject}${grade}.html`)
  }

  const _handlePrintPdf = () => {
    if (!content) return
    printLessonPlan(content, {
      subject, grade, title: lessonTitle || '未命名教案',
      textbookUnit: textbookUnit || undefined,
      teacherName: user?.name || '教师',
    })
  }

  // 课件生成：AI 润色 + 从素材库找相近生成新版本
  const handleGenerateCourseware = async () => {
    if (!content) { toast('请先生成或填写教案正文', 'warning'); return }
    setGeneratingCourseware(true)
    try {
      const res = await aiAPI.generateCourseware({
        subject, grade, lesson_title: lessonTitle || '未命名教案',
        content, school_id: getSchoolId(),
      })
      setCoursewareMarkdown(res.courseware_markdown || '')
      setCoursewareSimilar(res.similar_material || null)
      if (Array.isArray(res.recommended_refs) && res.recommended_refs.length) {
        setMaterialRefs(prev => Array.from(new Set([...prev, ...res.recommended_refs])))
      }
      setShowCourseware(true)
    } catch (e: any) { toast('课件生成失败: ' + (e.message || '未知错误'), 'error') }
    setGeneratingCourseware(false)
  }

  // 保存生成的课件到素材库并挂载到本教案
  const handleSaveCourseware = async () => {
    if (!coursewareMarkdown) return
    if (!planId) { toast('请先保存教案再挂载课件', 'warning'); return }
    setSavingCourseware(true)
    try {
      const mat = await materialAPI.createJSON({
        name: `${lessonTitle || '教案'}_课件`,
        type: 'courseware',
        tag: `${subject}${grade}`,
        content: coursewareMarkdown,
      })
      const newRefs = Array.from(new Set([...materialRefs, mat.id]))
      setMaterialRefs(newRefs)
      await lessonPlanAPI.update(planId, { material_refs: JSON.stringify(newRefs) })
      await loadMaterialsMap()
      toast('课件已保存到素材库并挂载', 'success')
      setShowCourseware(false)
    } catch (e: any) { toast('保存失败: ' + (e.message || '未知错误'), 'error') }
    setSavingCourseware(false)
  }

  // 课件导出（复用现有底座）：HTML / Word / PDF
  const handleExportCoursewareH5 = () => {
    if (!coursewareMarkdown) return
    const blob = exportH5Courseware(coursewareMarkdown, { subject, grade, title: `${lessonTitle || '教案'}_课件`, teacherName: safeGetUser().name || '教师' })
    h5Download(blob, `${lessonTitle || '课件'}_${subject}${grade}.html`)
  }
  const handleExportCoursewareDocx = async () => {
    if (!coursewareMarkdown) return
    const blob = await exportLessonPlanToDocx(coursewareMarkdown, { subject, grade, title: `${lessonTitle || '教案'}_课件`, teacher: safeGetUser().name || '教师', model: 'qwen-plus' })
    downloadBlob(blob, `${lessonTitle || '课件'}_${subject}${grade}.docx`)
  }
  const handleExportCoursewarePdf = () => {
    if (!coursewareMarkdown) return
    printLessonPlan(coursewareMarkdown, { subject, grade, title: `${lessonTitle || '教案'}_课件`, teacherName: safeGetUser().name || '教师' })
  }

  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') || { name: '张真真', school_name: '成都市金牛区第一小学' } } catch { return { name: '张真真', school_name: '成都市金牛区第一小学' } } })()
  const gradeNum = ['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级'].indexOf(grade) + 1

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F6F7F8]">
        <div className="w-8 h-8 border-4 border-[#02A7F0]/20 border-t-[#02A7F0] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
    <EditorLayout
      left={
        <div className="flex flex-col h-full">
          {/* 编辑模式切换 */}
          <div className="px-5 py-3 border-b border-[#F0F0F0] flex items-center gap-3">
            <span className="text-[12px] text-[#9A9A9A]">编辑模式</span>
            <div className="inline-flex rounded-[4px] border border-[#E7E7EB] overflow-hidden">
              <button onClick={() => setEditMode('ai')}
                className={`px-3 py-1.5 text-[12px] ${editMode === 'ai' ? 'bg-[#02A7F0] text-white' : 'bg-white text-[#353535] hover:bg-[#F6F7F8]'}`}>AI 模式</button>
              <button onClick={() => setEditMode('doc')}
                className={`px-3 py-1.5 text-[12px] border-l border-[#E7E7EB] ${editMode === 'doc' ? 'bg-[#02A7F0] text-white' : 'bg-white text-[#353535] hover:bg-[#F6F7F8]'}`}>文档模式</button>
            </div>
            <span className="text-[11px] text-[#9A9A9A]">AI 模式=智能生成 · 文档模式=自由排版</span>
          </div>
          {/* Scrollable form area */}
          <div className="flex-1 overflow-y-auto">
            {/* 基本信息 */}
            <div className="px-5 py-3">
              <h3 className="text-[13px] font-semibold text-[#353535] mb-3">基本信息</h3>
              <div className="flex gap-4">
                <div className="space-y-2 text-[12px] flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[#9A9A9A] w-8">学科</span>
                    <span className="text-[#353535]">{subject}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#9A9A9A] w-8">班级</span>
                    <span className="text-[#353535]">{user?.grade_class || '四年级 (1)班'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#9A9A9A] w-8">校区</span>
                    <span className="text-[#353535]">{user?.school_name || '成都市金牛区第一小学'}</span>
                  </div>
                </div>
                <div className="w-[80px] h-[100px] bg-gray-100 rounded-[4px] border border-[#E7E7EB] flex items-center justify-center text-[11px] text-[#9A9A9A] text-center">
                  人教版<br/>四年级下册
                </div>
              </div>
            </div>

            {/* 标题 */}
            <div className="px-5 py-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] font-medium text-[#353535]">标题 <span className="text-red-500">*</span></label>
                <span className="text-[11px] text-[#9A9A9A]">{lessonTitle.length}/12</span>
              </div>
              <input
                type="text"
                value={lessonTitle}
                onChange={e => setLessonTitle(e.target.value)}
                placeholder="请在这里输入标题"
                className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]"
              />
            </div>

            {/* 单元 + 课时 */}
            <div className="px-5 py-3 flex gap-3">
              <div className="flex-1">
                <label className="block text-[12px] text-[#9A9A9A] mb-1.5">单元</label>
                <select value={textbookUnit} onChange={e => setTextbookUnit(e.target.value)} className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
                  <option value="">请选择</option>
                  {['第一单元','第二单元','第三单元','第四单元','第五单元','第六单元','第七单元','第八单元'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[12px] text-[#9A9A9A] mb-1.5">课时</label>
                <select value={period} onChange={e => setPeriod(Number(e.target.value))} className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>第{n}课时</option>)}
                </select>
              </div>
            </div>

            {editMode === 'ai' && (<>
            {/* 教案模板 */}
            <div className="px-5 py-3">
              <label className="block text-[12px] text-[#9A9A9A] mb-1.5">教案模板</label>
              <select value={template} onChange={e => setTemplate(e.target.value)} className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
                <option value="core_literacy">核心素养模板</option>
                <option value="3d_objective">三维目标模板</option>
                <option value="unit_teaching">单元教学模板</option>
              </select>
            </div>

            {/* 知识点 */}
            <div className="px-5 py-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-medium text-[#353535]">知识点 <span className="text-red-500">*</span></span>
                <span className="text-[11px] text-[#9A9A9A]">({picker.selectedIds.length}/12)</span>
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

            {/* 附加要求 / 关键词 */}
            <div className="px-5 py-3 border-t border-[#F0F0F0]">
              <label className="block text-[12px] font-medium text-[#353535] mb-1.5">附加要求 / 关键词</label>
              <textarea value={extraRequirements} onChange={e => setExtraRequirements(e.target.value)}
                rows={2} placeholder="如：侧重实验探究、融入思政元素、增加小组合作…（也可先在左下角小微对话提需求，自动带入）"
                className="w-full px-2.5 py-2 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] resize-none" />
            </div>

            {/* 课标关联（备注，不污染正文） */}
            {curriculum.length > 0 && (
              <div className="px-5 py-3 border-t border-[#F0F0F0]">
                <span className="text-[12px] font-medium text-[#353535]">课标关联（备注）</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {curriculum.map((c: any, i: number) => (
                    <span key={i} className="px-2 py-0.5 text-[10px] bg-[#F0ECF7] text-[#722ED1] rounded-full">{c.code}{c.text ? ` · ${c.text.slice(0, 12)}` : ''}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 自定义标签 */}
            <div className="px-5 py-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-medium text-[#353535]">自定义标签</span>
                <span className="text-[11px] text-[#9A9A9A]">({customTags.length}/3)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {customTags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#F0F0F0] text-[#353535] rounded-full">
                    {tag}
                    <button onClick={() => setCustomTags(prev => prev.filter((_, idx) => idx !== i))} className="text-[#9A9A9A] hover:text-[#FF4D4F]">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {customTags.length < 3 && (
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newTagInput.trim()) { setCustomTags([...customTags, newTagInput.trim()]); setNewTagInput('') } }}
                    placeholder="+ 请输入"
                    className="w-20 px-2 py-1 text-[11px] border border-dashed border-[#E7E7EB] rounded-full focus:outline-none focus:border-[#02A7F0] text-[#353535]"
                  />
                )}
              </div>
            </div>

            {/* 关联课件：作者从素材库指定 + AI 决定挂载 */}
            <div className="px-5 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-medium text-[#353535]">关联课件</span>
                <button onClick={() => setShowMaterialPicker(true)} className="text-[11px] text-[#02A7F0] hover:underline">+ 从素材库指定</button>
              </div>
              {materialRefs.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {materialRefs.map(mid => {
                    const m = materialMap[mid]
                    return (
                      <span key={mid} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#E6F7FF] text-[#0958D9] rounded-full">
                        {m?.name || '课件'}
                        <button onClick={() => setMaterialRefs(prev => prev.filter(x => x !== mid))} className="text-[#0958D9] hover:text-[#FF4D4F]"><X size={10} /></button>
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[#9A9A9A]">未关联课件。AI 生成教案时会自动推荐，也可手动指定。</p>
              )}
              {recommendedMaterials.length > 0 && (
                <p className="text-[11px] text-[#02A7F0] mt-1.5">AI 推荐：{recommendedMaterials.join('、')}</p>
              )}
            </div>

            {/* AI 生成课件（AI 润色 + 找相近生成新版本，支持 HTML/Word/PDF 导出） */}
            <div className="px-5 py-3">
              <button onClick={handleGenerateCourseware} disabled={generatingCourseware || !content}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#02A7F0] text-white rounded-[4px] hover:bg-[#0288D1] transition-colors disabled:opacity-50">
                <Monitor size={20} className="shrink-0" />
                <span className="text-[13px]">{generatingCourseware ? 'AI 正在生成课件...' : 'AI 生成课件（HTML / Word / PDF）'}</span>
              </button>
            </div>

            {showAiConfirm && (
              <div className="px-5 py-3 bg-[#FFFBE6] border border-[#FFE58F] rounded-[4px] mx-3">
                <p className="text-[12px] text-[#8A6D00] mb-2">当前正文含文档模式或此前的手动编辑，AI 润色将基于现有内容重写并覆盖。确定继续？</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => { if ((document.getElementById('lp-skip') as HTMLInputElement)?.checked) sessionStorage.setItem('lp_skip_ai_confirm', '1'); setShowAiConfirm(false); handleGenerate() }}
                    className="px-3 py-1.5 text-[12px] text-white bg-[#FAAD14] rounded-[4px] hover:bg-[#D48806]">覆盖并重写</button>
                  <button onClick={() => setShowAiConfirm(false)} className="px-3 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0]">取消</button>
                  <label className="flex items-center gap-1 text-[11px] text-[#9A9A9A] ml-1">
                    <input id="lp-skip" type="checkbox" /> 本次不再提示
                  </label>
                </div>
              </div>
            )}
            {/* AI 生成教案（接线 handleGenerate，修复此前空壳按钮导致无法 AI 生成） */}
            <div className="px-5 py-3">
              <button onClick={handleAiClick} disabled={generating || picker.selectedIds.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#353535] text-white rounded-[4px] hover:bg-[#1A1A1A] transition-colors disabled:opacity-50">
                <Sparkles size={20} className="text-[#02A7F0] shrink-0" />
                <span className="text-[13px]">{generating ? '小微正在生成教案...' : (picker.selectedIds.length === 0 ? '请先在知识图谱选取知识点' : (isEditing ? 'AI 润色教案' : 'AI 生成教案'))}</span>
              </button>
            </div>
            </>)}
            {editMode === 'doc' && (
              <div className="px-5 py-3">
                <label className="block text-[13px] font-medium text-[#353535] mb-2">教案正文（文档模式 · 自由排版）</label>
                <MDEditor value={content} onChange={(v) => setContent(v || '')} height={560} preview="live" />
                <p className="text-[11px] text-[#9A9A9A] mt-1.5">文档模式直接编辑正文，支持加粗、标题、列表、表格；保存后预览即腾讯文档式只读呈现。</p>
              </div>
            )}
          </div>

          {/* Fixed Bottom Buttons */}
          <div className="px-5 py-3 border-t border-[#F0F0F0] bg-white shrink-0 flex gap-3">
            <button onClick={handleSaveDraft} className="flex-1 px-4 py-2.5 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors">
              保存为草稿
            </button>
            <button onClick={() => setShowPresentation(true)} className="flex-1 px-4 py-2.5 text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] transition-colors">
              预览
            </button>
            <button onClick={() => setShowFinalizeConfirm(true)} disabled={saving} className="flex-1 px-4 py-2.5 text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] disabled:opacity-50 transition-colors">
              发布
            </button>
          </div>
        </div>
      }
      right={editMode === 'ai' ? (
        <KnowledgeGraphTool
          data={picker.knowledgeData}
          filter={{ subject, grade: gradeNum, semester: teaching.semester }}
          selectedIds={picker.selectedIds}
          onSelect={ids => picker.setSelectedIds(ids)}
        />
      ) : undefined}
    />

    {/* Dialogs */}
      {/* 定稿确认弹窗 */}
      <ConfirmDialog
        open={showFinalizeConfirm}
        title="确认定稿"
        message="定稿后教案将不可编辑，确认定稿吗？"
        confirmLabel="确认定稿"
        danger
        loading={saving}
        onConfirm={() => { setShowFinalizeConfirm(false); handleFinalize() }}
        onCancel={() => setShowFinalizeConfirm(false)}
      />

      {/* 课件投屏模式 */}
      {showPresentation && (
        <PresentationMode
          content={content} title={lessonTitle || '未命名教案'}
          subject={subject} grade={grade}
          teacherName={safeGetUser().name}
          onClose={() => setShowPresentation(false)}
        />
      )}

      {/* AI 课件预览 / 导出 / 挂载 */}
      {showCourseware && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-6" onClick={() => setShowCourseware(false)}>
          <div className="bg-white rounded-[6px] w-[900px] max-w-full max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E7E7EB] shrink-0">
              <div>
                <h3 className="text-[14px] font-semibold text-[#353535]">AI 课件预览</h3>
                {coursewareSimilar && (
                  <p className="text-[11px] text-[#9A9A9A] mt-0.5">参照相近课件《{coursewareSimilar.name}》生成的新版本</p>
                )}
              </div>
              <button onClick={() => setShowCourseware(false)} className="p-1 hover:bg-[#F6F7F8] rounded"><X size={16} className="text-[#9A9A9A]" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 text-[13px] leading-relaxed whitespace-pre-wrap bg-[#FAFAFA]">
              {coursewareMarkdown}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#E7E7EB] bg-[#F6F7F8] shrink-0">
              <div className="flex gap-2">
                <button onClick={handleExportCoursewareH5} className="px-3 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:bg-white">导出 HTML</button>
                <button onClick={handleExportCoursewareDocx} className="px-3 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:bg-white">导出 Word</button>
                <button onClick={handleExportCoursewarePdf} className="px-3 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:bg-white">导出 PDF</button>
              </div>
              <button onClick={handleSaveCourseware} disabled={savingCourseware} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] disabled:opacity-50">
                {savingCourseware ? '保存中...' : '保存到素材库并挂载'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 从素材库指定课件 */}
      <ResourcePicker
        open={showMaterialPicker}
        mode="materials"
        selectedIds={materialRefs}
        onClose={() => setShowMaterialPicker(false)}
        onSelect={(items) => { setMaterialRefs(items.map(i => (i as any).id)); setShowMaterialPicker(false) }}
      />

      {/* 离开确认弹窗（拦截未保存内容） */}
      <ConfirmDialog
        open={showLeaveDialog}
        title="内容未保存"
        message="当前教案尚未保存，确认离开吗？离开后内容将丢失。"
        confirmLabel="确认离开"
        danger
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </>
  )
}
