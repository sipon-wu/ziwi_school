import { useState, useEffect, useRef, useCallback, type JSX, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Sparkles, Save, BookOpen, Send, X, Target, Download, ChevronDown, ChevronRight, FileText, Search, Plus, Bell, ZoomIn, ZoomOut, Maximize2, Pencil, MessageCircle, CheckCircle2, XCircle } from 'lucide-react'
import { aiAPI, lessonPlanAPI, materialAPI, classAPI, reviewAPI } from '../lib/api'
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
import { exportH5Courseware, downloadBlob as h5Download } from '../lib/exportH5'
import ResourcePicker from '../components/ResourcePicker'
import EditorLayout from '../components/EditorLayout'
import EditorInfoPanel from '../components/EditorInfoPanel'
import { useEditorController } from '../hooks/useEditorController'
import KnowledgeGraphTool from '../components/KnowledgeGraphTool'
import TipTapEditor from '../components/TipTapEditor'
import DocEditorPanel, { renderFullscreenEditor } from '../components/DocEditorPanel'
import { marked } from 'marked'
const safeGetUser = () => { try { return JSON.parse(localStorage.getItem('zhiwei_user') || localStorage.getItem('user') || '{}') || {} } catch { return {} } }

// 把裸 LaTeX（$...$ / $$...$$）转成 TipTap 公式节点占位（由编辑器 FormulaView 运行时渲染 KaTeX）
function latexToFormulaPlaceholders(html: string): string {
  return html
    .replace(/\$\$([\s\S]+?)\$\$/g, '<div data-formula data-latex="$1"></div>')
    .replace(/\$([^$\n]+?)\$/g, '<span data-formula-inline data-latex="$1"></span>')
}

/** 防御：历史/异常数据可能把结构化 JSON 存进 content（契约应为 Markdown/HTML）。
 *  尝试解析教案 JSON（objectives/process 等字段）并转成 Markdown；解析失败返回 null。
 */
function jsonLessonToMarkdown(c: string): string | null {
  if (!c.startsWith('{')) return null
  let j: any
  try { j = JSON.parse(c) } catch { return null }
  if (!j || typeof j !== 'object') return null
  const cnNum = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  const md: string[] = []
  const obj = j.objectives || {}
  if (obj.knowledge || obj.ability || obj.emotion) {
    md.push('## 教学目标')
    if (obj.knowledge) md.push(`- **知识与技能**：${obj.knowledge}`)
    if (obj.ability) md.push(`- **过程与方法**：${obj.ability}`)
    if (obj.emotion) md.push(`- **情感态度与价值观**：${obj.emotion}`)
  }
  if (j.key_points) md.push('', '## 教学重点', String(j.key_points))
  if (j.difficult_points) md.push('', '## 教学难点', String(j.difficult_points))
  if (Array.isArray(j.process) && j.process.length) {
    md.push('', '## 教学过程')
    j.process.forEach((p: any, i: number) => {
      const dur = p?.duration ? `（${p.duration}分钟）` : ''
      md.push('', `### ${cnNum[i] || i + 1}、${p?.phase || `环节${i + 1}`}${dur}`, String(p?.content || ''))
    })
  }
  if (j.homework) md.push('', '## 作业布置', String(j.homework))
  return md.length ? md.join('\n') : null
}

/** 将存储的教案内容转换为 TipTap 可用的 HTML
 *  - 若已经是 HTML（以 < 开头），直接返回
 *  - 若是 Markdown（带 ## / # / 列表 / 引用等），用 marked 转换
 *  - 若是结构化 JSON（历史脏数据），先转 Markdown 再渲染（防御，不显示原始 {}）
 *  - 空字符串返回空段落
 */
function contentToHtml(content: string): string {
  let c = (content || '').trim()
  if (!c) return '<p></p>'
  if (c === '{}' || c === '""' || c === '[]') return '<p></p>'
  // 防御：JSON 脏数据 → Markdown（转换失败则按原文本走 marked，至少不崩）
  if (c.startsWith('{')) {
    const md = jsonLessonToMarkdown(c)
    if (md) c = md
  }
  // 公式统一渲染：裸 $...$ 转成 TipTap 公式节点占位，由 FormulaView 渲染 KaTeX（formula 节点不受影响）
  if (c.startsWith('<')) return latexToFormulaPlaceholders(c)
  try {
    const html = marked.parse(c, { async: false, breaks: true }) as string
    return latexToFormulaPlaceholders(html) || '<p></p>'
  } catch {
    return `<p>${c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
  }
}

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

  // ctrl 引用位前置声明（let 避免 TDZ），实际赋值在 silentSave/handleSaveDraft 之后
  // eslint-disable-next-line prefer-const
  let ctrl: any

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
  // 作品发布状态（active/published=定稿，版本只读禁回退；draft=草稿可回退）
  const [planStatus, setPlanStatus] = useState<'draft' | 'published'>('draft')
  const [saving, setSaving] = useState(false)
  const [curriculum, setCurriculum] = useState<any[]>([])
  const [modelVersion, setModelVersion] = useState('')
  // AI 预览态
  const [aiPreview, setAiPreview] = useState(false)
  const [aiConfirmed, setAiConfirmed] = useState(false)
  const [genTime, setGenTime] = useState(0)
  const [loadingExisting, setLoadingExisting] = useState(!!id) // 有 id=需加载数据，初始就转圈等 API 返回后再渲染
  // 查看态全屏预览受控态：进查看态自动开全屏预览，点「编辑」时关掉
  const [previewOpen, setPreviewOpen] = useState(false)
  // 安全兜底：API 超时不阻塞 UI，8 秒后强制关闭加载态
  useEffect(() => { if (!id || !loadingExisting) return; const t = setTimeout(() => setLoadingExisting(false), 8000); return () => clearTimeout(t) }, [id, loadingExisting])
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)
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
  // 富媒体编辑器全屏
  const [showFullscreenEditor, setShowFullscreenEditor] = useState(false)

  // ── 任教班级（班级切换联动）──
  const [myClasses, setMyClasses] = useState<Array<{ class_id: string; class_name: string; grade: string; subject: string; is_primary: boolean }>>([])
  useEffect(() => { classAPI.myClasses().then(r => setMyClasses(r?.items || [])).catch(() => {}) }, [])
  const classLabel = myClasses.find(it => it.class_id === teaching.selectedClassId)?.class_name || grade

  // workMode 已收口到 useEditorController（统一路由判定，ai/doc 单一套语义）
  // AI 润色覆盖确认（仅编辑已有且正文非空时提示，会话内可“不再提示”）
  const [showAiConfirm, setShowAiConfirm] = useState(false)
  const handleAiClick = () => {
    if (!isEditing || !content) { handleGenerate(); return }
    if (sessionStorage.getItem('lp_skip_ai_confirm') === '1') { handleGenerate(); return }
    setShowAiConfirm(true)
  }

  // 左侧小微会话"应用到当前内容"：携带对话上下文触发 AI 生成 → 切换 DOC 模式展示结果（小微展开由 EditorInfoPanel 内部控制）
  const handleLeftApply = async (chatContext: string) => {
    await handleGenerate(chatContext)
    if (ctrl.workMode === 'ai') handleSwitchToDoc()
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

  // 浏览器关闭/刷新拦截（统一 hook）；锁定查看态为只读、无未保存概念，不拦截
  // 注：ctrl 可能首帧未赋值（let 声明），用 optional chain 防崩
  const hasUnsavedChanges = ctrl ? !ctrl.readOnly && content.length > 0 && !showFinalizeConfirm : false
  useUnsavedChanges(hasUnsavedChanges)

  // 应用内导航拦截（SideBar Link 点击）
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const pendingNavRef = useRef<{ state: any; title: string; url?: string | null } | null>(null)
  const origPushRef = useRef<typeof window.history.pushState>(window.history.pushState)

  useEffect(() => {
    if (!ctrl || ctrl.readOnly || !hasUnsavedChanges) return
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
  }, [hasUnsavedChanges, ctrl?.readOnly])

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
      // 定稿锁定判定：已通过(approved)或互审关闭直接发布(active+none)才只读；
      // 被退回(returned)按方案A保留发布壳但允许重新编辑再送审 → 不锁
      const lockedByStatus = (data.status === 'active' && data.review_status !== 'returned') ||
                             (data.status === 'published') ||
                             (data.review_status === 'approved')
      if (lockedByStatus) setPlanStatus('published')
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

  const handleGenerate = async (leftChatContext?: string) => {
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
        current_content: content || undefined,
      })
      // AI ↔ DOC 反复切换：保留既有内容，AI 新生成追加到末尾
      const hasExisting = content && content.trim().length > 0
      setContent(hasExisting ? content + '\n\n---\n\n' + res.content : res.content); setCurriculum(res.curriculum_alignments||[]); setModelVersion(res.model||'qwen-plus'); setGenTime(res.generation_time_ms||0)
      // 自动命名标题：用户未填时，根据知识点/单元/日期自动生成
      if (!lessonTitle.trim()) {
        const names = picker.selectedNodes.map(n => n.name).filter(Boolean)
        const autoTitle = names.length > 0
          ? `《${names.length <= 2 ? names.join('》《') : names.slice(0, 2).join('》《') + '》等'}》—— ${subject}${grade}`
          : `${subject}${grade} · ${textbookUnit || '教案'} · ${new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}`
        setLessonTitle(autoTitle)
      }
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

  // 切换到文档模式时立即保存草稿（不走 30 秒定时器），保证左侧面板的数据不丢
  const handleSwitchToDoc = async () => {
    if (content && !planId && !showFinalizeConfirm) {
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
      } catch { /* 切换时保存失败静默，文档模式内仍可手动保存 */ }
    }
    ctrl.setWorkMode('doc')
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
      let pid = planId
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
        pid = saved.id
      } else {
        await lessonPlanAPI.update(planId, { content, knowledge_node_ids: knowledgeNodeIds, material_refs: JSON.stringify(materialRefs) })
      }
      toast('已保存为草稿', 'success')
      return pid
    } catch (e: any) { toast('保存失败: ' + (e.message || '网络错误'), 'error'); return null }
    finally { setSaving(false) }
  }

  // 翻译 MDEditor 工具栏 title 为中文（@uiw/react-md-editor 默认英文）—— 已切换 TipTap，移除
  useEffect(() => {
    // TipTap 已内置 WYSIWYG 工具栏，无需额外翻译
  }, [])

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

  // ============ P0-6 生命周期（框架统一 footer + 自动保存状态机）============
  // 注意：hooks 必须在所有条件 return（loadingExisting/ctrl.readOnly）之前调用，
  // 否则预览态(ctrl.readOnly 提前 return)与解锁编辑态 hooks 数量不一致 → React #310 崩溃、编辑器空白。
  const silentSave = useCallback(async () => {
    const kIds = picker.selectedIds.length > 0 ? picker.selectedIds : savedKnowledgeIds
    const knowledgeNodeIds = JSON.stringify(kIds)
    if (!planId) {
      const saved = await lessonPlanAPI.create({
        subject, grade, title: lessonTitle || '未命名教案', unit: textbookUnit, period,
        content, format_template: template,
        curriculum_alignments: JSON.stringify(curriculum),
        knowledge_node_ids: knowledgeNodeIds,
        material_refs: JSON.stringify(materialRefs),
        ai_generated: false,
      })
      setPlanId(saved.id); setSavedKnowledgeIds(kIds)
    } else {
      await lessonPlanAPI.update(planId, { content, knowledge_node_ids: knowledgeNodeIds, material_refs: JSON.stringify(materialRefs) })
    }
  }, [picker, savedKnowledgeIds, planId, subject, grade, lessonTitle, textbookUnit, period, content, template, curriculum, materialRefs])

  ctrl = useEditorController({
    autoSaveDelay: 8000,
    onAutoSave: silentSave,
    onSaveDraft: handleSaveDraft,
    onPublish: () => setShowFinalizeConfirm(true),
  })

  // 查看态：进入查看态即自动打开全屏预览（按 id 重算，兼容同标签内切换不同教案）
  // 评审模式(?review=1)下不自动弹预览，保留顶栏"通过/退回"按钮可点
  useEffect(() => {
    if (ctrl?.readOnly && searchParams.get('review') !== '1') setPreviewOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loadingExisting || !ctrl) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F6F7F8]">
        <div className="w-8 h-8 border-4 border-[#02A7F0]/20 border-t-[#02A7F0] rounded-full animate-spin" />
      </div>
    )
  }

  // 文档模式右侧：TipTap 编辑器（"导出教案"通过 toolbarExtra 注入；"全屏"由 DocEditorPanel 框架内置统一提供）
  const exportToolbarExtra: ReactNode = (
    <>
      <button onClick={handleExportDocx}
        className="flex items-center gap-1 px-2 h-7 text-[11px] rounded text-[#02A7F0] border border-[#02A7F0] hover:bg-[#E8F7FF] transition-colors"
        title="导出教案正文为 Word（公式以图片嵌入）"
      >导出教案</button>
    </>
  )

  const docRightPanel = (
    <DocEditorPanel
      hint="教案正文 · 自由排版（支持 Markdown / 表格 / 列表 / 公式）"
      value={contentToHtml(content)}
      onChange={(v) => setContent(v || '')}
      docTitle={lessonTitle}
      placeholder="开始编写教案正文..."
      toolbarExtra={exportToolbarExtra}
      onFullscreen={() => setShowFullscreenEditor(true)}
      resourceType="lesson_plan"
      resourceId={planId || undefined}
      locked={planStatus === 'published'}
    />
  )

  // 左栏内容（P0-3：EditorInfoPanel 统一容器 + 基本信息卡 + 框架级小微；产品特定表单作为 children）
  const leftPanelContent = (
    <EditorInfoPanel
      showBasicInfo
      classLabel={classLabel}
      xiaowei={{
        contextType: 'lesson',
        subject,
        grade: grade as any,
        knowledgeNodeNames: picker.selectedNodes.map(n => n.name),
        extraRequirements,
        onApply: handleLeftApply,
      }}
    >
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

            {/* 教案模板（AI/DOC 模式一致显示） */}
            <div className="px-5 py-3">
              <label className="block text-[12px] text-[#9A9A9A] mb-1.5">教案模板</label>
              <select value={template} onChange={e => setTemplate(e.target.value)} className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
                <option value="core_literacy">核心素养模板</option>
                <option value="3d_objective">三维目标模板</option>
                <option value="unit_teaching">单元教学模板</option>
              </select>
            </div>
            {/* 知识点（双模式：AI 可删改，DOC 只读） */}
            <div className="px-5 py-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-medium text-[#353535]">知识点 <span className="text-red-500">*</span></span>
                <span className="text-[11px] text-[#9A9A9A]">({picker.selectedIds.length}/12)</span>
              </div>
              {picker.selectedNodes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {picker.selectedNodes.map(n => (
                    <span key={n.id} className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-full ${ctrl.workMode === 'doc' ? 'bg-[#F6F7F8] text-[#353535]' : 'bg-[#F0F0F0] text-[#353535]'}`}>
                      {n.name}
                      {ctrl.workMode === 'ai' && (
                        <button onClick={() => picker.setSelectedIds(prev => prev.filter(id => id !== n.id))} className="text-[#9A9A9A] hover:text-[#FF4D4F]">
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[#9A9A9A]">请在右侧{ctrl.workMode === 'ai' ? '知识图谱' : 'AI 模式'}中选取知识点</p>
              )}
            </div>

            {/* 附加要求 / 关键词（AI/DOC 模式一致显示） */}
            <div className="px-5 py-3 border-t border-[#F0F0F0]">
              <label className="block text-[12px] font-medium text-[#353535] mb-1.5">附加要求 / 关键词</label>
              <textarea value={extraRequirements} onChange={e => setExtraRequirements(e.target.value)}
                rows={2} placeholder="如：侧重实验探究、融入思政元素、增加小组合作…（也可先在左下角小微对话提需求，自动带入）"
                className="w-full px-2.5 py-2 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] resize-none" />
            </div>

            {/* 课标关联（备注，不污染正文） */}
            {curriculum.length > 0 && (
              <div className="px-5 py-3 border-t border-[#F0F0F0]">
                <span className="text-[12px] font-medium text-[#353535]">课标关联 · 仅显示与所选知识点匹配的条目</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(() => {
                    const relCodes = new Set(picker.selectedNodes.map((n: any) => n.curriculum_code).filter(Boolean))
                    return curriculum.map((c: any, i: number) => {
                      const relevant = !relCodes.size || relCodes.has(c.code)
                      return (
                        <span key={i} className={`px-2 py-0.5 text-[10px] rounded-full ${relevant ? 'bg-[#F0ECF7] text-[#722ED1]' : 'bg-gray-100 text-gray-400 line-through'}`}>{c.code}{c.text ? ` · ${c.text.slice(0, 16)}` : ''}</span>
                      )
                    })
                  })()}
                </div>
              </div>
            )}
            {/* 自定义标签（双模式：AI 可编辑，DOC 只读） */}
            <div className="px-5 py-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-medium text-[#353535]">自定义标签</span>
                <span className="text-[11px] text-[#9A9A9A]">({customTags.length}/3)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {customTags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#F0F0F0] text-[#353535] rounded-full">
                    {tag}
                    {ctrl.workMode === 'ai' && (
                      <button onClick={() => setCustomTags(prev => prev.filter((_, idx) => idx !== i))} className="text-[#9A9A9A] hover:text-[#FF4D4F]">
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
                {ctrl.workMode === 'ai' && customTags.length < 3 && (
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

            {/* 关联素材（双模式：AI 可删改 chip，DOC 卡片+超链接） */}
            <div className="px-5 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-medium text-[#353535]">关联素材</span>
                {ctrl.workMode === 'ai' && (
                  <button onClick={() => setShowMaterialPicker(true)} className="text-[11px] text-[#02A7F0] hover:underline">+ 从素材库指定</button>
                )}
              </div>
              {materialRefs.length > 0 ? (
                ctrl.workMode === 'doc' ? (
                  <div className="space-y-2">
                    {materialRefs.map(mid => {
                      const m = materialMap[mid]
                      const type = m?.type || 'doc'
                      const typeLabel: Record<string, string> = { courseware: '课件', video: '视频', audio: '音频', image: '图片', doc: '文档' }
                      const typeIcon: Record<string, string> = { courseware: '📦', video: '🎬', audio: '🎵', image: '🖼️', doc: '📄' }
                      const duration = m?.duration ? (type === 'video' || type === 'audio' ? m.duration : `${m.duration}分钟`) : (type === 'courseware' ? '45分钟' : type === 'video' || type === 'audio' ? '--' : '')
                      const materialUrl = m?.url || m?.id || ''
                      return (
                        <a key={mid} href={materialUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 px-3 py-2.5 bg-[#F9FAFB] border border-[#E7E7EB] rounded-[6px] hover:border-[#02A7F0] hover:bg-[#F0F7FF] transition-colors no-underline">
                          <span className="text-[16px] shrink-0">{typeIcon[type] || '📄'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] text-[#353535] font-medium truncate">{m?.name || '未命名素材'}</span>
                              <span className="text-[10px] px-1.5 py-0.5 bg-[#E7E7EB] text-[#9A9A9A] rounded shrink-0">{typeLabel[type] || type}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {duration && <span className="text-[10px] text-[#9A9A9A]">⏱ {duration}</span>}
                              {m?.tag && <span className="text-[10px] text-[#9A9A9A]">{m.tag}</span>}
                            </div>
                          </div>
                          <span className="text-[11px] text-[#02A7F0] shrink-0">打开 ↗</span>
                        </a>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {materialRefs.map(mid => {
                      const m = materialMap[mid]
                      return (
                        <span key={mid} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#E6F7FF] text-[#0958D9] rounded-full">
                          {m?.name || '素材'}
                          <button onClick={() => setMaterialRefs(prev => prev.filter(x => x !== mid))} className="text-[#0958D9] hover:text-[#FF4D4F]"><X size={10} /></button>
                        </span>
                      )
                    })}
                  </div>
                )
              ) : (
                <p className="text-[11px] text-[#9A9A9A]">未关联素材。AI 生成教案时会自动推荐，也可手动指定。</p>
              )}
              {recommendedMaterials.length > 0 && (
                <p className="text-[11px] text-[#02A7F0] mt-1.5">AI 推荐：{recommendedMaterials.join('、')}</p>
              )}
            </div>

            {ctrl.workMode === 'ai' && showAiConfirm && (
              <div className="px-5 py-3 bg-[#FFFBE6] border border-[#FFE58F] rounded-[4px] mx-3">
                <p className="text-[12px] text-[#8A6D00] mb-2">当前正文含文档模式或此前的手动编辑，AI 润色将基于现有内容重写并覆盖。确定继续？</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => { if ((document.getElementById('lp-skip') as HTMLInputElement)?.checked) sessionStorage.setItem('lp_skip_ai_confirm', '1'); setShowAiConfirm(false); handleGenerate() }}
                    className="px-3 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1]">追加生成</button>
                  <button onClick={() => setShowAiConfirm(false)} className="px-3 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0]">取消</button>
                  <label className="flex items-center gap-1 text-[11px] text-[#9A9A9A] ml-1">
                    <input id="lp-skip" type="checkbox" /> 本次不再提示
                  </label>
                </div>
              </div>
            )}

    </EditorInfoPanel>
  )

  // P0-2 全屏预览承载层：锁定只读版式（文字类）。全屏模式 fullscreen：左右侧栏默认展开，
  // 且以绝对定位覆盖（不平移居中 A4 内容）
  const previewSlot = (
    <TipTapEditor value={contentToHtml(content)} readOnly onChange={() => {}} docTitle={lessonTitle || '未命名教案'} />
  )

  // 锁定查看态：复用编辑器框架布局（与试卷/出题统一 EditorLayout），仅文档区只读居中，
  // 顶栏带 导出教案/打印/编辑 按钮；点「编辑」ctrl.forceEdit 原地解锁进入文档模式。
  if (ctrl.readOnly) {
    const viewHtml = contentToHtml(content)
    const editNow = () => {
      if (planStatus === 'published') { toast('该教案已定版发布，不可编辑', 'warning'); return }
      setPreviewOpen(false); ctrl.forceEdit(); ctrl.setWorkMode('doc'); window.history.replaceState(null, '', `/lesson-plans/${id}/edit`)
    }
    const isReviewMode = searchParams.get('review') === '1'
    const handleReviewDecision = async (decision: 'approve' | 'reject') => {
      if (!id) return
      try {
        await reviewAPI.decide(id, decision, '')
        toast(decision === 'approve' ? '已通过评审' : '已退回', 'success')
        navigate('/review-pool')
      } catch { toast('评审提交失败', 'error') }
    }
    // 评审模式：绕过 EditorLayout(其左栏 466px 固定不可收起，违反"评审仅看作品"的诉求)
    // 自渲染极简布局：顶栏+全屏 TipTapEditor 带批注侧栏(resourceType/resourceId 触发 useAnnotations)。
    // fullscreen=true 让批注面板默认展开；外层 style 隐藏章节导航(评审不需要)，仅保留正文+批注。
    if (isReviewMode) {
      return (
        <div className="h-screen flex flex-col bg-[#F6F7F8]">
          <header className="shrink-0 bg-white border-b border-[#E7E7EB] px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[12px] text-[#9A9A9A] truncate">{lessonTitle || '未命名教案'} · {subject}{grade}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-[3px] bg-[#FFF7E6] text-[#FA8C16] border border-[#FFE7BA] shrink-0">评审模式</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => navigate('/review-pool')}
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] bg-white hover:bg-[#F6F7F8]">
                <ArrowLeft size={13} /> 返回互审池</button>
              <button onClick={() => handleReviewDecision('reject')}
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] bg-[#FA8C16] text-white rounded-[4px] hover:bg-[#d97a0a]">
                <XCircle size={13} /> 退回</button>
              <button onClick={() => handleReviewDecision('approve')}
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] bg-[#52C41A] text-white rounded-[4px] hover:bg-[#49ad14]">
                <CheckCircle2 size={13} /> 通过</button>
            </div>
          </header>
          <div className="flex-1 overflow-hidden relative">
            {/* 评审模式：fullscreen 下 TipTapEditor 默认展开左右侧栏——左侧章节导航(评审者快速定位)+右侧批注。 */}
            <TipTapEditor
              value={viewHtml}
              readOnly
              onChange={() => {}}
              docTitle={lessonTitle || '未命名教案'}
              resourceType="lesson_plan"
              resourceId={id}
              locked
              fullscreen
              annotationAllowWholeDoc
            />
          </div>
        </div>
      )
    }
    const centeredDocInline = (
      <div className="h-full overflow-auto bg-[#F6F7F8] flex justify-center py-10">
        <div className="w-[794px] min-h-[1123px] bg-white shadow-sm">
          <TipTapEditor value={viewHtml} readOnly noPanels onChange={() => {}} docTitle={lessonTitle || '未命名教案'} />
        </div>
      </div>
    )
    const centeredDocFull = (
      <TipTapEditor value={viewHtml} readOnly onChange={() => {}} docTitle={lessonTitle || '未命名教案'} />
    )
    return (
      <EditorLayout
        sceneName="教案"
        primaryLeft={leftPanelContent}
        primaryRight={
          <KnowledgeGraphTool
            data={picker.knowledgeData}
            filter={{ subject, grade: gradeNum, semester: teaching.semester }}
            selectedIds={picker.selectedIds}
            onSelect={ids => picker.setSelectedIds(ids)}
          />
        }
        secondaryLeft={leftPanelContent}
        secondaryRight={
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-2.5 bg-[#F6F7F8] border-b border-[#E7E7EB] shrink-0">
              <span className="text-[12px] text-[#9A9A9A]">{lessonTitle || '未命名教案'} · {subject}{grade}{textbookUnit ? ' · ' + textbookUnit : ''}</span>
              <div className="flex items-center gap-2">
                <button onClick={handleExportDocx}
                  className="flex items-center gap-1 px-3 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] bg-white hover:bg-[#F6F7F8]">
                  <Download size={13} /> 导出教案</button>
                <button onClick={_handlePrintPdf}
                  className="flex items-center gap-1 px-3 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] bg-white hover:bg-[#F6F7F8]">
                  <FileText size={13} /> 打印</button>
                <button onClick={editNow} disabled={planStatus === 'published'}
                  title={planStatus === 'published' ? '该教案已定版发布，不可编辑' : '进入编辑'}
                  className="flex items-center gap-1 px-3 py-1.5 text-[12px] bg-[#02A7F0] text-white rounded-[4px] hover:bg-[#0288D1] disabled:opacity-40 disabled:cursor-not-allowed">
                  <Pencil size={13} /> 编辑</button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">{centeredDocInline}</div>
          </div>
        }
        mode="secondary"
        modeLocked
        modeLockedLabel="只读查看"
        footerAlign="left"
        footerLifecycle={{
          saveDraftLabel: planStatus === 'published' ? '已定版' : '编辑',
          publishLabel: '返回教案库',
          onSaveDraft: editNow,
          onPublish: () => { window.location.href = '/lesson-plans' },
          saveDraftDisabled: planStatus === 'published',
        }}
        previewTitle="教案预览"
        previewSlot={centeredDocFull}
        previewOpen={previewOpen}
        onPreviewChange={setPreviewOpen}
        onPreviewEdit={editNow}
        previewEditDisabled={planStatus === 'published'}
      />
    )
  }

  return (
    <>
    <EditorLayout
      sceneName="教案"
      primaryLeft={leftPanelContent}
      secondaryLeft={leftPanelContent}
      primaryRight={
        <KnowledgeGraphTool
          data={picker.knowledgeData}
          filter={{ subject, grade: gradeNum, semester: teaching.semester }}
          selectedIds={picker.selectedIds}
          onSelect={ids => picker.setSelectedIds(ids)}
        />
      }
      secondaryRight={docRightPanel}
      mode={(ctrl.workMode === 'ai' ? 'primary' : 'secondary')}
      onModeChange={(m) => m === 'secondary' ? handleSwitchToDoc() : ctrl.setWorkMode('ai')}
      footerAlign="left"
      footerLifecycle={{
        saveDraftLabel: '保存为草稿',
        publishLabel: '发布',
        onSaveDraft: ctrl.saveDraft,
        onPublish: ctrl.publish,
        status: ctrl.status,
        saving: ctrl.saving,
      }}
      previewTitle="教案预览"
      previewSlot={previewSlot}
    />

    {/* 富媒体编辑器全屏（A4 纸面，文档模式专属）— 复用共享编辑态全屏覆盖层 */}
    {showFullscreenEditor && renderFullscreenEditor({
      value: contentToHtml(content),
      onChange: (v) => setContent(v || ''),
      docTitle: lessonTitle || '未命名教案',
      readOnly: planStatus === 'published',
      toolbarExtra: (
        <button onClick={handleExportDocx}
          className="flex items-center gap-1 px-2 h-7 text-[11px] rounded text-[#02A7F0] border border-[#02A7F0] hover:bg-[#E8F7FF] transition-colors"
          title="导出教案正文为 Word（公式以图片嵌入）"
        >导出教案</button>
      ),
      onExit: () => setShowFullscreenEditor(false),
    })}

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
