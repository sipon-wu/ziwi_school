import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Sparkles, Loader2, FileText, MessageSquare, History, Plus, X, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, Download, Maximize2, Undo2, Redo2, TextCursorInput, Shapes, Image as ImageIcon, ZoomIn } from 'lucide-react'
import { useToast } from '../components/Toast'
import { useTeaching } from '../lib/TeachingContext'
import { useKnowledgePicker } from '../hooks/useKnowledgePicker'
import { useKGContext } from '../lib/KnowledgeGraphContext'
import { api, aiAPI, materialAPI, type MaterialItem } from '../lib/api'
import { getXiaoweiContext } from '../lib/xiaoweiContext'
import { buildKnowledgeScope } from '../lib/knowledgeScope'
import { exportLessonPlanToDocx, downloadBlob } from '../lib/exportDocx'
import { printLessonPlan } from '../lib/printPdf'
import { exportCoursewareToPptx, outlineToSlides, outlineToMarkdown, markdownToOutline, pptToOutline, materializeOutline, extractBullets } from '../lib/exportPptx'
import { exportH5Courseware } from '../lib/exportH5'
import type { OutlineSlide, CwSlide } from '../lib/exportPptx'
import { getTheme, recommendTheme } from '../lib/pptThemes'
import { PPT_TEMPLATES, applyTemplate, revertTemplate, renderTemplateThumb, renderFamilyThumb, basicTemplateForFamily, BASIC_TEMPLATE, COLOR_FAMILIES, STYLE_LABELS, gradeToStage, type StyleTag } from '../lib/cwTemplate'
import EditorLayout from '../components/EditorLayout'
import EditorInfoPanel from '../components/EditorInfoPanel'
import { useEditorController } from '../hooks/useEditorController'
import KnowledgeGraphTool from '../components/KnowledgeGraphTool'
import PptxPreview from '../components/PptxPreview'
import ThemePicker from '../components/ThemePicker'
import { useAnnotations, useVersions } from '../hooks/useAnnotations'

const GRADE_NAMES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']
const safeGetUser = () => { try { return JSON.parse(localStorage.getItem('zhiwei_user') || localStorage.getItem('user') || '{}') || {} } catch { return {} } }
const getSchoolId = () => { try { const t = localStorage.getItem('zhiwei_token') || ''; const p = JSON.parse(atob(t.split('.')[1])); return p.school_id || '' } catch { return '' } }

// 教学课件频道：PPT / H5 / 视频 共用同一编辑器与同一份内容来源（一次创作、多格式交付）
type CwFormat = 'ppt' | 'h5' | 'video'
const CW_CHANNEL: Record<CwFormat, { name: string; chip: string; color: string; scene: string; previewSuffix: string }> = {
  ppt:   { name: 'PPT 课件',    chip: 'PPT',  color: '#722ED1', scene: 'PPT 课件',    previewSuffix: 'PPT 放映' },
  h5:    { name: 'H5 互动课件', chip: 'H5',   color: '#FA8C16', scene: 'H5 互动课件', previewSuffix: 'H5 预览' },
  video: { name: '视频课件',    chip: '视频', color: '#52C41A', scene: '视频课件',    previewSuffix: '分镜预览' },
}

// 视频课件配置（数据位）：本期仅定义与选择，不接入生成/持久化；token 平权后再做深
export interface CwVideoConfig {
  presenter: 'none' | 'avatar' | 'cartoon' | 'real' | 'custom'   // 出镜形象
  style: 'knowledge' | 'experiment' | 'story' | 'sprint' | 'wrong' // 讲解风格
}
const CW_PRESENTERS: { id: CwVideoConfig['presenter']; label: string }[] = [
  { id: 'none', label: '无出镜·纯录屏' },
  { id: 'avatar', label: '平台数字人' },
  { id: 'cartoon', label: '学科卡通' },
  { id: 'real', label: '真人出镜' },
  { id: 'custom', label: '自定义形象' },
]
const CW_STYLES: { id: CwVideoConfig['style']; label: string }[] = [
  { id: 'knowledge', label: '知识科普' },
  { id: 'experiment', label: '实验演示' },
  { id: 'story', label: '故事化情境' },
  { id: 'sprint', label: '考点冲刺' },
  { id: 'wrong', label: '错题精讲' },
]

const DRAFT_KEY_PREFIX = 'zhiwei_cw_draft'
// 草稿按素材 ID 区分：新建时用临时 ID，编辑时用真实 ID，避免新建时加载其他课件的旧草稿
const getDraftKey = (materialId: string) => `${DRAFT_KEY_PREFIX}_${materialId || 'new'}`
const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'el_' + Date.now().toString(36) + Math.random().toString(36).slice(2))

/**
 * P4 课件编辑器页（PPT 课件 · H5 预留）：与教案/出题/组卷同一套 EditorLayout 四件套。
 * AI 模式 = 左栏参数 + 右栏知识图谱；文档模式 = 左栏参数 + 右栏可编辑提纲/发散地图/校验；
 * 框架预览 = PPT 放映；footer = 保存草稿(本地) / 发布到课件库(红线校验闸)。
 */
export default function CoursewareBuilder() {
  const teaching = useTeaching()
  const { toast } = useToast()
  const gradeName = GRADE_NAMES[teaching.grade - 1] || '四年级'
  const { format } = useParams<{ format?: string }>()
  const navigate = useNavigate()
  const { id } = useParams()
  const cwFormat: CwFormat = format === 'h5' ? 'h5' : format === 'video' ? 'video' : 'ppt'
  const channel = CW_CHANNEL[cwFormat]
  const isEditing = !!id
  const [materialId, setMaterialId] = useState<string>(id || '')
  // 缩略图侧栏可收起（腾讯文档范式：左侧页管理可折叠，编辑区最大化）
  const [thumbCollapsed, setThumbCollapsed] = useState(false)
  // 全屏预览（放映态）开关：view 态由框架受控自动开
  const [previewOpen, setPreviewOpen] = useState(false)
  const [cwLoading, setCwLoading] = useState<boolean>(isEditing)
  const [videoConfig, setVideoConfig] = useState<CwVideoConfig>({ presenter: 'none', style: 'knowledge' })

  // eslint-disable-next-line prefer-const
  let ctrl: any

  const picker = useKnowledgePicker({ autoSelect: false })
  const { setPicker: setKGPicker } = useKGContext()
  useEffect(() => { setKGPicker(picker as any); return () => setKGPicker(null) }, [picker, setKGPicker])

  // ── 表单状态 ──
  const [genTitle, setGenTitle] = useState('')
  const [cwExtra, setCwExtra] = useState('')
  const [genBaseId, setGenBaseId] = useState('')
  const [divergenceLevel, setDivergenceLevel] = useState<'conservative' | 'standard' | 'expansive'>('standard')
  const [edgeEnabled, setEdgeEnabled] = useState(false)
  const [edgeCats, setEdgeCats] = useState<Record<string, boolean>>({
    '科学探究精神/价值观': false, '合作与倾听（行为准则）': false, '文化认同与家国情怀': false,
  })
  const [consultQuestions, setConsultQuestions] = useState<any[]>([])
  const [consultAnswers, setConsultAnswers] = useState<Record<string, string>>({})
  const [consultLoading, setConsultLoading] = useState(false)

  // ── 产物状态 ──
  const [genLoading, setGenLoading] = useState(false)
  const [cwMarkdown, setCwMarkdown] = useState('')
  const [cwSimilar, setCwSimilar] = useState<any>(null)
  const [cwOutline, setCwOutline] = useState<OutlineSlide[]>([])
  const [cwDivergence, setCwDivergence] = useState<any[]>([])
  const [removedDivergence, setRemovedDivergence] = useState<Record<string, boolean>>({})
  const [trimming, setTrimming] = useState(false)
  const [validateIssues, setValidateIssues] = useState<any[] | null>(null)
  const [validating, setValidating] = useState(false)
  const [savingCw, setSavingCw] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [docSlide, setDocSlide] = useState(0)
  // 新建课件默认套用「按学科+年级」推荐主题（仅默认，不强制；教师可随时手改，恢复草稿时以草稿为准）
  const [themeId, setThemeId] = useState<string>(() => recommendTheme(teaching.subject, teaching.grade).themeId)
  // workMode 已收口到 useEditorController

  // ── 模板套用（PPT 课件）：从模板库选 → 一键换肤套用、内容不变、可撤销 ──
  const [tplPanelOpen, setTplPanelOpen] = useState(false)
  const [tplStyleFilter, setTplStyleFilter] = useState<StyleTag | ''>('')
  const tplAppliedId = useRef<string | null>(null)
  const tplPrevTheme = useRef<string | null>(null)
  const tplPrevLayouts = useRef<(string | undefined)[] | null>(null)

  // 参照课件下拉数据
  const [materials, setMaterials] = useState<Array<{ id: string; name: string }>>([])
  useEffect(() => {
    api<{ items: MaterialItem[] }>('/materials')
      .then(res => setMaterials((res.items || []).map(m => ({ id: m.id, name: m.name }))))
      .catch(() => {})
  }, [])

  // 本地草稿恢复（保存草稿 = 本地暂存；只有「发布进素材库」才过红线闸）
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(getDraftKey(materialId)) || 'null')
      if (d && (d.title || d.outline?.length)) {
        setGenTitle(d.title || '')
        setCwExtra(d.extra || '')
        setCwMarkdown(d.markdown || '')
        setCwOutline(materializeOutline(Array.isArray(d.outline) ? d.outline : []))
        setCwDivergence(Array.isArray(d.divergence) ? d.divergence : [])
        if (d.divergenceLevel) setDivergenceLevel(d.divergenceLevel)
        if (d.themeId) setThemeId(d.themeId)
        if (d.videoConfig) setVideoConfig(d.videoConfig)
        if (d.outline?.length) ctrl.setWorkMode('doc')
        toast('已恢复上次未发布的课件草稿', 'info')
      }
    } catch { /* 忽略损坏草稿 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 编辑已有课件：从素材库加载内容回填（对齐习题/教案「查看/编辑」由 id 加载）
  useEffect(() => {
    if (!isEditing || !id) return
    setCwLoading(true)
    materialAPI.get(id).then((m: any) => {
      if (!m) return
      setGenTitle((m.name || '').replace(/_课件$/, ''))
      setCwOutline(materializeOutline(markdownToOutline(m.content || '')))
      setCwMarkdown(m.content || '')
      setCwExtra(m.tag || '')
      if (m.grade) setThemeId(recommendTheme(m.subject || teaching.subject, GRADE_NAMES.indexOf(m.grade) + 1 || teaching.grade).themeId)
    }).catch(() => {}).finally(() => setCwLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 课前问诊：进页拉一次
  useEffect(() => {
    if (consultQuestions.length > 0 || consultLoading) return
    setConsultLoading(true)
    const scope = buildKnowledgeScope(picker)
    aiAPI.consultCourseware({
      subject: teaching.subject, grade: gradeName, lesson_title: genTitle.trim(),
      knowledge_points: scope.knowledge_points,
    }).then((r: any) => setConsultQuestions(r.questions || []))
      .catch(() => setConsultQuestions([]))
      .finally(() => setConsultLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 进入任一课件频道默认文档模式：视频频道需文档模式才显示配置面板，PPT/H5 也围绕提纲；用户仍可手动切 AI 选知识点
  useEffect(() => { if (ctrl.workMode !== 'doc') ctrl.setWorkMode('doc') }, [cwFormat, ctrl])

  // 版心比例：16:9（默认，投影标准）或 4:3（传统屏），预览与导出同步
  const [cwAr, setCwAr] = useState<'16/9' | '4/3'>('16/9')

  const cwOpts = () => ({ subject: teaching.subject, grade: gradeName, title: `${genTitle.trim()}_课件`, teacherName: safeGetUser().name || '教师', theme: getTheme(themeId), aspect: cwAr })

  // ── AI 生成课件 ──
  const handleGenCourseware = async (leftChatContext?: string) => {
    if (!genTitle.trim()) { toast('请填写课题名称', 'warning'); return }
    setGenLoading(true)
    try {
      const base = genBaseId ? await materialAPI.get(genBaseId).catch(() => null) : null
      const scope = buildKnowledgeScope(picker)
      const cats = Object.entries(edgeCats).filter(([, v]) => v).map(([k]) => k)
      const consultText = consultQuestions.length
        ? consultQuestions.map((q: any) => `· ${q.question} → ${consultAnswers[q.id] || '（未答）'}`).join('；')
        : ''
      const res = await aiAPI.generateCourseware({
        subject: teaching.subject, grade: gradeName, lesson_title: genTitle.trim(),
        content: (base as any)?.content || '', school_id: getSchoolId(),
        textbook_version: teaching?.currentTextbook?.() || '',
        extra_requirements: cwExtra || undefined,
        chat_context: leftChatContext || getXiaoweiContext() || undefined,
        selected_knowledge_ids: picker.selectedIds,
        knowledge_points: scope.knowledge_points,
        prerequisite_points: scope.prerequisite_points,
        curriculum_codes: scope.curriculum_codes,
        divergence_level: divergenceLevel,
        consult_answers: consultText || undefined,
        edge_enabled: edgeEnabled,
        edge_categories: edgeEnabled ? cats : [],
      })
      setCwMarkdown(res.courseware_markdown || '')
      setCwOutline(materializeOutline(markdownToOutline(res.courseware_markdown || '')))
      setCwDivergence(Array.isArray(res.divergence_map) ? res.divergence_map : [])
      setRemovedDivergence({})
      setCwSimilar(res.similar_material || null)
      setValidateIssues(null)
      ctrl.setWorkMode('doc')
      toast('课件已生成，可在右侧编辑提纲', 'success')
    } catch (e: any) { toast('AI 生成失败: ' + (e.message || '未知错误'), 'error') }
    finally { setGenLoading(false) }
  }

  // 小微「应用到当前内容」
  const handleLeftApply = async (chatContext: string) => { await handleGenCourseware(chatContext) }

  // 发散地图剔除
  const handleTrimCw = async () => {
    const toRemove = cwDivergence.filter(d => removedDivergence[d.content])
    if (!toRemove.length) return
    setTrimming(true)
    try {
      const r: any = await aiAPI.trimCourseware({ markdown: cwMarkdown, remove_items: toRemove })
      setCwMarkdown(r.trimmed_markdown || cwMarkdown)
      setCwOutline(materializeOutline(markdownToOutline(r.trimmed_markdown || cwMarkdown)))
      setCwDivergence(Array.isArray(r.divergence_map) ? r.divergence_map : [])
      setRemovedDivergence({})
      setValidateIssues(null)
      toast(`已剔除 ${toRemove.length} 处发散内容`, 'success')
    } catch (e: any) { toast('剔除失败: ' + (e.message || '未知错误'), 'error') }
    finally { setTrimming(false) }
  }

  // 提纲编辑
  const setSlideTitle = (i: number, v: string) => setCwOutline(arr => arr.map((s, k) => k === i ? { ...s, title: v } : s))
  const setSlideBullets = (i: number, v: string) => setCwOutline(arr => arr.map((s, k) => k === i ? { ...s, bullets: v.split('\n') } : s))
  const moveSlide = (i: number, dir: number) => setCwOutline(arr => {
    const j = i + dir
    if (j < 0 || j >= arr.length) return arr
    const n = arr.slice()
    ;[n[i], n[j]] = [n[j], n[i]]
    return n
  })
  const removeSlide = (i: number) => setCwOutline(arr => arr.filter((_, k) => k !== i))

  // 自由编辑态：页面管理与元素回写
  const addCwPage = () => setCwOutline(arr => [...arr, {
    title: '新页面', bullets: [],
    elements: [{ id: genId(), type: 'text', x: 6, y: 23, w: 88, h: 64, text: '', fontSize: 18, bullet: true }],
  }])
  const deleteCwPage = (i: number) => setCwOutline(arr => (arr.length > 1 ? arr.filter((_, k) => k !== i) : arr))
  const moveCwPage = (i: number, dir: number) => {
    const j = i + dir
    setCwOutline(arr => {
      if (j < 0 || j >= arr.length) return arr
      const n = arr.slice()
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
  }
  const handleDocSlideChange = (index: number, slide: CwSlide) =>
    setCwOutline(arr => arr.map((s, k) => (k === index ? { ...s, title: slide.title, elements: slide.elements } : s)))

  // AI 润色提纲（render-ppt：精炼要点 + 讲稿）
  const polishOutline = async () => {
    if (!cwOutline.length) { toast('请先生成课件', 'warning'); return }
    setPolishing(true)
    try {
      const md = outlineToMarkdown(cwOutline, cwOpts())
      const r: any = await aiAPI.renderPptCourseware({ markdown: md, title: `${genTitle.trim()}_课件`, subject: teaching.subject, grade: gradeName })
      const out = materializeOutline(pptToOutline(r.ppt_slides || []))
      if (out.length) { setCwOutline(out); setCwMarkdown(md); toast('提纲已 AI 润色（含讲稿）', 'success') }
      else toast('润色未返回内容', 'warning')
    } catch (e: any) { toast('润色失败: ' + (e.message || '未知错误'), 'error') }
    finally { setPolishing(false) }
  }

  // 导出
  const exportCwPptx = async () => {
    if (!cwOutline.length) { toast('课件内容为空', 'warning'); return }
    try { await exportCoursewareToPptx(outlineToSlides(cwOutline, cwOpts()), cwOpts()) }
    catch (e: any) { toast('PPT 导出失败: ' + (e.message || '未知错误'), 'error') }
  }
  const exportCwDocx = async () => {
    if (!cwOutline.length) { toast('课件内容为空', 'warning'); return }
    const blob = await exportLessonPlanToDocx(outlineToMarkdown(cwOutline, cwOpts()), { subject: teaching.subject, grade: gradeName, title: `${genTitle.trim()}_课件`, teacher: safeGetUser().name || '教师', model: 'qwen-plus' })
    downloadBlob(blob, `${genTitle.trim()}_${teaching.subject}${gradeName}.docx`)
  }
  const exportCwPdf = () => {
    if (!cwOutline.length) { toast('课件内容为空', 'warning'); return }
    printLessonPlan(outlineToMarkdown(cwOutline, cwOpts()), { subject: teaching.subject, grade: gradeName, title: `${genTitle.trim()}_课件`, teacherName: safeGetUser().name || '教师' })
  }
  // H5 互动课件：用与 PPT 同源的内容构建专用 markdown（首段作封面、其余为内容页），导出为自包含 HTML
  const buildH5Markdown = () => {
    const lines: string[] = [
      `## ${genTitle.trim()}_课件`,
      `> ${teaching.subject} · ${gradeName}${safeGetUser().name ? ' · ' + safeGetUser().name : ''}`,
      '',
    ]
    cwOutline.forEach(s => {
      lines.push(`## ${s.title}`)
      const bs = s.elements && s.elements.length ? extractBullets(s.elements) : s.bullets
      bs.forEach(b => lines.push(`- ${b}`))
      if (s.notes) lines.push('', `> 教师备注：${s.notes}`)
      lines.push('')
    })
    return lines.join('\n')
  }
  const exportCwH5 = () => {
    if (!cwOutline.length) { toast('课件内容为空', 'warning'); return }
    try {
      const blob = exportH5Courseware(buildH5Markdown(), {
        subject: teaching.subject, grade: gradeName, title: `${genTitle.trim()}_课件`,
        teacherName: safeGetUser().name || '教师',
      })
      downloadBlob(blob, `${genTitle.trim()}_${teaching.subject}${gradeName}.html`)
      toast('H5 互动课件已生成并下载', 'success')
    } catch (e: any) { toast('H5 导出失败: ' + (e.message || '未知错误'), 'error') }
  }

  // 多选格式一键导出（下拉菜单）：按勾选依次导出 PPT/Word/PDF/H5
  const exportCwFormats = async (formats: Array<'ppt' | 'docx' | 'pdf' | 'h5'>) => {
    const chosen = formats.filter(f => exportSel[f])
    if (!chosen.length) { toast('请至少勾选一种导出格式', 'warning'); return }
    setExportMenuOpen(false)
    try {
      for (const f of chosen) {
        if (f === 'ppt') await exportCwPptx()
        else if (f === 'docx') await exportCwDocx()
        else if (f === 'pdf') exportCwPdf()
        else exportCwH5()
      }
    } catch { /* 各导出函数已各自 toast */ }
  }

  // ── footer：保存草稿(落库，与习题/教案一致) / 发布到课件库(红线校验闸) ──
  const handleSaveDraft = async () => {
    const payload = {
      name: `${genTitle.trim() || '未命名'}_课件`,
      type: 'courseware',
      tag: `${teaching.subject}${gradeName}`,
      content: outlineToMarkdown(cwOutline, cwOpts()),
      status: 'draft',
      grade: gradeName,
      subject: teaching.subject,
    }
    try {
      // 本地兜底暂存（未发布前可恢复）
      localStorage.setItem(getDraftKey(materialId), JSON.stringify({
        title: genTitle, extra: cwExtra, markdown: cwMarkdown,
        outline: cwOutline, divergence: cwDivergence, divergenceLevel, themeId,
        videoConfig,
      }))
      if (materialId) {
        await materialAPI.update(materialId, payload)
      } else {
        const m: any = await materialAPI.createJSON(payload)
        if (m?.id) setMaterialId(m.id)
      }
      toast('草稿已保存', 'success')
    } catch (e: any) { toast('草稿保存失败: ' + (e.message || ''), 'error') }
  }

  // 必须在 ctrl = useEditorController(...) 之前声明，避免 const 的 TDZ 类型报错
  const handlePublish = async () => {
    if (!genTitle.trim()) { toast('请填写课题名称', 'warning'); return }
    if (!cwOutline.length) { toast('课件内容为空，请先生成课件', 'warning'); return }
    setValidating(true)
    try {
      const r: any = await aiAPI.validateCourseware({
        markdown: cwMarkdown || outlineToMarkdown(cwOutline, cwOpts()), subject: teaching.subject, grade: gradeName,
      })
      if (!r.pass) {
        setValidateIssues(r.issues || [])
        ctrl.setWorkMode('doc')
        toast('发布校验未通过，请按提示修改后再发布', 'warning')
        return
      }
      setValidateIssues(null)
    } catch (e: any) {
      toast('校验失败: ' + (e.message || '未知错误'), 'error')
      return
    } finally { setValidating(false) }
    setSavingCw(true)
    try {
      const payload = {
        name: `${genTitle.trim()}_课件`,
        type: 'courseware',
        tag: `${teaching.subject}${gradeName}`,
        content: outlineToMarkdown(cwOutline, cwOpts()),
        status: 'active',
        grade: gradeName,
        subject: teaching.subject,
      }
      if (materialId) await materialAPI.update(materialId, payload)
      else {
        const m: any = await materialAPI.createJSON(payload)
        if (m?.id) setMaterialId(m.id)
      }
      try { localStorage.removeItem(getDraftKey(materialId)) } catch { /* noop */ }
      toast('课件已发布', 'success')
    }     catch (e: any) { toast('发布失败: ' + (e.message || ''), 'error') }
    finally { setSavingCw(false) }
  }

  ctrl = useEditorController({ onAutoSave: handleSaveDraft, onSaveDraft: handleSaveDraft, onPublish: handlePublish })

  // 批注 / 版本快照：课件按页锚定（page:N，N=当前 docSlide+1）；发布定版后只读禁存/禁恢复
  const cwLocked = ctrl.status === 'active'
  // 新建未保存时用本地草稿 ID 作为批注锚点，保存后自动落到真实 materialId
  const cwAnnTargetId = materialId || getDraftKey(materialId)
  const cwAnn = useAnnotations('material', cwAnnTargetId)
  const cwVer = useVersions('material', cwAnnTargetId, cwLocked)
  const [cwAnnText, setCwAnnText] = useState('')
  const [cwHistoryVisible, setCwHistoryVisible] = useState(true)
  const [cwAnnTab, setCwAnnTab] = useState<'annotations' | 'history'>('annotations')
  // 导出下拉：非全屏顶栏用单一「导出 ▾」下拉，多选格式一键导出（节约版面）
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportSel, setExportSel] = useState<Record<'ppt' | 'docx' | 'pdf' | 'h5', boolean>>({ ppt: true, docx: false, pdf: false, h5: false })
  const exportMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!exportMenuOpen) return
    const onDown = (e: MouseEvent) => { if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [exportMenuOpen])
  // 全屏编辑：隐藏左右栏与发散/校验，最大化画布
  const [cwFullscreen, setCwFullscreen] = useState(false)
  const [cwFsThumb, setCwFsThumb] = useState(true)
// 全屏态下批注栏收展与编辑态共用 cwHistoryVisible，避免双状态不一致
  useEffect(() => {
    if (!cwFullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCwFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cwFullscreen])
  const addCwAnnotation = () => {
    if (!cwAnnText.trim() || !cwAnnTargetId) return
    cwAnn.add('page', { page: docSlide + 1, pageTitle: cwOutline[docSlide]?.title || '' }, cwAnnText.trim())
    setCwAnnText('')
  }
  const takeCwSnapshot = async () => {
    if (!materialId) return
    const ok = await cwVer.take('课件快照', cwOutline)
    if (!ok) toast('已发布定版或保存失败', 'warning')
  }
  const restoreCwSnapshot = async (versionId: string) => {
    const payload = await cwVer.restore(versionId)
    if (payload == null) { toast('已发布定版，不可回退版本', 'warning'); return }
    if (Array.isArray(payload) && payload.length) { setCwOutline(payload as OutlineSlide[]); toast('已恢复到该版本', 'success') }
  }

  // 查看态：进入查看态即自动打开全屏预览（按 id 重算，兼容同标签内切换不同课件），与组卷一致
  // 直接用 cwOutline 非空判断，不依赖异步 effect，确保数据到位后立即开预览
  const autoPreviewOpen = ctrl?.readOnly && cwOutline.length > 0
  const effectivePreviewOpen = previewOpen || autoPreviewOpen
  // 当 cwOutline 加载完成（首次或切换课件）时自动标记 previewOpen
  useEffect(() => {
    if (autoPreviewOpen && !previewOpen) setPreviewOpen(true)
  }, [autoPreviewOpen, previewOpen])

  // 查看态点「编辑」：关全屏预览 + 原地解锁（replaceState 同步 URL 为 /:id/edit，与组卷一致）
  const editNow = () => { setPreviewOpen(false); ctrl.forceEdit(); ctrl.setWorkMode('doc'); if (id) window.history.replaceState(null, '', `/courseware/${cwFormat}/${id}/edit`) }

  // ── 左栏（AI/DOC 共用，同教案/出题/组卷） ──
  const leftPanel = (
    <EditorInfoPanel
      showBasicInfo
      showGrade
      classLabel={gradeName}
      xiaowei={{
        contextType: 'courseware',
        subject: teaching.subject,
        grade: gradeName,
        knowledgeNodeNames: picker.selectedNodes.map((n: any) => n.name),
        extraRequirements: cwExtra,
        onApply: handleLeftApply,
      }}
    >
      {/* 频道由主导航「教学课件」分组入口分流，进入后不再在左栏切换 */}
      {/* 课题名称 */}
      <div className="px-5 py-3">
        <label className="block text-[12px] font-medium text-[#353535] mb-2">课题名称 <span className="text-red-500">*</span></label>
        <input value={genTitle} onChange={e => setGenTitle(e.target.value)} placeholder="如：光的折射定律"
          className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" />
      </div>

      {/* 参照课件 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-2">参照课件（可选）</label>
        <select value={genBaseId} onChange={e => setGenBaseId(e.target.value)}
          className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0]">
          <option value="">不参照（由 AI 自动匹配相近课件）</option>
          {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* 知识点范围（右侧知识图谱选取） */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-[#353535]">知识点范围（可选）</span>
          <span className="text-[10px] text-[#9A9A9A]">已选 {picker.selectedIds.length} 个</span>
        </div>
        {picker.selectedNodes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {picker.selectedNodes.map((n: any) => (
              <span key={n.id} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#F0F0F0] text-[#353535] rounded-full">
                {n.name}
                <button onClick={() => picker.setSelectedIds(picker.selectedIds.filter((id: string) => id !== n.id))} className="text-[#9A9A9A] hover:text-[#FF4D4F]">✕</button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[#9A9A9A]">可在右侧知识图谱中选取锚点知识点（AI 模式）</p>
        )}
      </div>

      {/* 附加要求 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-1.5">附加要求 / 关键词</label>
        <textarea value={cwExtra} onChange={e => setCwExtra(e.target.value)} rows={2}
          placeholder="如：多放实验图示、加入生活案例、风格活泼…（也可先在左下角小微对话提需求，自动带入）"
          className="w-full px-2.5 py-2 text-[12px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0] resize-none" />
      </div>

      {/* 发散度 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-1.5">发散度（受控启发）</label>
        <select value={divergenceLevel} onChange={e => setDivergenceLevel(e.target.value as any)}
          className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0]">
          <option value="conservative">保守（少量跨界）</option>
          <option value="standard">标准（适度启发）</option>
          <option value="expansive">发散（大开脑洞）</option>
        </select>
        <span className="text-[10px] text-[#9A9A9A] mt-1 block">轨道区可跨界 / 适度超纲，但受 ±1 年级档与课标对齐约束。</span>
      </div>

      {/* 边缘知识 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0] space-y-2">
        <label className="flex items-center gap-2 text-[12px] text-[#353535]">
          <input type="checkbox" checked={edgeEnabled} onChange={e => setEdgeEnabled(e.target.checked)} />
          融入价值观 / 行为 / 情感（边缘知识，靠互动承载）
        </label>
        {edgeEnabled && (
          <div className="pl-5 space-y-1">
            {Object.keys(edgeCats).map(k => (
              <label key={k} className="flex items-center gap-2 text-[11px] text-[#353535]">
                <input type="checkbox" checked={edgeCats[k]} onChange={e => setEdgeCats(s => ({ ...s, [k]: e.target.checked }))} />
                {k}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 课前问诊 */}
      {consultQuestions.length > 0 && (
        <div className="px-5 py-3 border-t border-[#F0F0F0] space-y-2">
          <p className="text-[12px] font-medium text-[#353535]">课前问诊（逐项确认方向）</p>
          {consultQuestions.map((q: any) => (
            <div key={q.id}>
              <p className="text-[11px] text-[#353535] mb-1">{q.question}</p>
              <select value={consultAnswers[q.id] || ''} onChange={e => setConsultAnswers(s => ({ ...s, [q.id]: e.target.value }))}
                className="w-full px-2 py-1.5 text-[11px] border border-[#E7E7EB] rounded-[3px] bg-white outline-none focus:border-[#02A7F0]">
                <option value="">请选择…</option>
                {(q.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* 生成按钮（仅 AI 模式显示；文档模式提纲已生成，无需此按钮） */}
      {ctrl.workMode === 'ai' && (
        <div className="px-5 py-4 border-t border-[#F0F0F0]">
          <button onClick={() => handleGenCourseware()} disabled={genLoading}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0398D8] disabled:opacity-50 transition-colors">
            {genLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {genLoading ? 'AI 生成中...' : cwOutline.length > 0 ? '重新生成课件' : 'AI 生成课件'}
          </button>
          {cwSimilar && <p className="text-[10px] text-[#9A9A9A] mt-2">参照相近课件《{cwSimilar.name}》生成的新版本</p>}
        </div>
      )}
    </EditorInfoPanel>
  )

  // ── 右栏 AI 模式：知识图谱 ──
  const rightPanelAi = (
    <KnowledgeGraphTool
      data={picker.knowledgeData}
      filter={{ subject: teaching.subject, grade: teaching.grade, semester: teaching.semester }}
      selectedIds={picker.selectedIds}
      onSelect={ids => picker.setSelectedIds(ids)}
    />
  )

  // ── 右栏 文档模式：可拖拽编辑画布 + 缩略图页管理 + 发散地图 + 校验面板 ──
  const rightPanelDoc = (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FAFAFA] relative">
      {/* 顶部独立工具条（参照教案编辑布局）：把高频操作统一到顶部，左右栏从其下方开始、顶端齐平不再冲顶 */}
      <div className="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-[#EFEFEF] bg-white">
        {/* 左：缩微页标题与操作 */}
        <span className="text-[11px] font-medium text-[#353535]">页面（{cwOutline.length}）</span>
        <button onClick={addCwPage} className="px-1.5 py-0.5 text-[11px] text-[#02A7F0] border border-[#02A7F0] rounded hover:bg-[#E8F7FF]">+ 页</button>
        <button onClick={() => setThumbCollapsed(true)} title="收起页列表" className="px-1 py-0.5 text-[11px] text-[#9A9A9A] hover:text-[#353535]">‹</button>
        <div className="w-px h-4 bg-[#EEE]" />
        {/* 中：高频操作 */}
        <div className="relative" ref={exportMenuRef}>
          <button onClick={() => setExportMenuOpen(v => !v)} title="导出格式（可多选）"
            className="px-2.5 py-1 text-[12px] text-white bg-[#02A7F0] border border-[#02A7F0] rounded-[4px] hover:bg-[#0398D8] flex items-center gap-1">
            <Download size={13} /> 导出 <ChevronDown size={12} />
          </button>
          {exportMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-[176px] bg-white border border-[#E7E7EB] rounded-[6px] shadow-lg z-30 py-1">
              <p className="px-3 pt-1 pb-0.5 text-[10px] text-[#9A9A9A]">选择导出格式（可多选）</p>
              {(['ppt', 'docx', 'pdf', 'h5'] as const).map(f => (
                <label key={f} className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#353535] hover:bg-[#F6F7F8] cursor-pointer">
                  <input type="checkbox" checked={exportSel[f]} onChange={e => setExportSel(s => ({ ...s, [f]: e.target.checked }))} className="shrink-0" />
                  {f === 'ppt' ? 'PPT' : f === 'docx' ? 'Word' : f === 'pdf' ? 'PDF' : 'H5 互动课件'}
                </label>
              ))}
              <button onClick={() => exportCwFormats(['ppt', 'docx', 'pdf', 'h5'])}
                className="w-full mt-1 px-3 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-b-[6px] hover:bg-[#0398D8]">一键导出所选 ({Object.values(exportSel).filter(Boolean).length})</button>
            </div>
          )}
        </div>
        <button onClick={polishOutline} disabled={polishing} className="px-2.5 py-1 text-[12px] text-[#02A7F0] border border-[#02A7F0] rounded-[4px] hover:bg-[#E8F7FF] disabled:opacity-50">{polishing ? '润色中...' : '✨ AI 润色'}</button>
        {cwFormat === 'video' && (
          <button disabled title="AI 自动生成讲解视频即将上线"
            className="px-2.5 py-1 text-[12px] text-[#B0B8C4] border border-dashed border-[#D0D0D0] rounded-[4px] cursor-not-allowed flex items-center gap-1">🎬 AI 生成视频 <span className="text-[10px] px-1 bg-[#B0B8C4] text-white rounded">即将上线</span></button>
        )}
        <select value={cwAr} onChange={(e) => setCwAr(e.target.value as '16/9' | '4/3')}
          className="px-2 py-1 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] bg-white hover:bg-[#F7F7F8]" title="版心比例">
          <option value="16/9">16:9</option>
          <option value="4/3">4:3</option>
        </select>
        <div className="flex-1" />
        {/* 批注 / 版本（与全屏态一致的功能按钮） */}
        <button onClick={() => setCwHistoryVisible(v => !v)} title="批注 / 版本" className={`px-2.5 py-1 text-[12px] border rounded-[4px] flex items-center gap-1 ${cwHistoryVisible ? 'text-[#02A7F0] border-[#02A7F0] hover:bg-[#E8F7FF]' : 'text-[#353535] border-[#E7E7EB] hover:bg-white'}`}>
          <MessageSquare size={13} /> 批注
        </button>
        {/* 右：全屏 + 主题 */}
        <button onClick={() => setCwFullscreen(true)} title="全屏编辑"
          className="px-2.5 py-1 text-[12px] text-[#02A7F0] border border-[#02A7F0] rounded-[4px] hover:bg-[#E6F7FF] flex items-center gap-1">
          <Maximize2 size={13} /> 全屏
        </button>
        <ThemePicker value={themeId} onChange={setThemeId} />
        {/* 模板库：主流 AI 风格套用（生成后从模板库选 → 一键换肤，内容不变） */}
        <div className="relative">
          <button onClick={() => setTplPanelOpen(v => !v)} title="模板库"
            className={`px-2.5 py-1 text-[12px] border rounded-[4px] flex items-center gap-1 ${tplPanelOpen || tplAppliedId.current ? 'text-[#02A7F0] border-[#02A7F0] hover:bg-[#E8F7FF]' : 'text-[#353535] border-[#E7E7EB] hover:bg-white'}`}>
            <Shapes size={13} /> 模板{tplAppliedId.current ? '✓' : ''}
          </button>
          {tplPanelOpen && (
            <div className="absolute right-0 top-9 z-50 w-[320px] max-h-[420px] overflow-y-auto bg-white border border-[#E7E7EB] rounded-lg shadow-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-medium text-[#353535]">课件模板库</span>
                {tplAppliedId.current && (
                  <button onClick={() => {
                    if (tplPrevTheme.current != null && tplPrevLayouts.current) {
                      const r = revertTemplate(cwOutline, tplPrevTheme.current, tplPrevLayouts.current)
                      setCwOutline(r.outline); setThemeId(r.themeId)
                      tplAppliedId.current = null; tplPrevTheme.current = null; tplPrevLayouts.current = null
                      toast('已撤销模板套用', 'info')
                    }
                  }} className="text-[11px] text-[#F5222D] hover:underline">撤销套用</button>
                )}
              </div>
              {/* 风格筛选（PPT/H5 共用风格标签文案） */}
              <div className="flex flex-wrap gap-1 mb-2">
                <button onClick={() => setTplStyleFilter('')} className={`px-2 py-0.5 rounded text-[11px] ${tplStyleFilter === '' ? 'bg-[#02A7F0] text-white' : 'bg-[#F2F3F5] text-[#666]'}`}>全部</button>
                {(Object.keys(STYLE_LABELS) as StyleTag[]).map(s => (
                  <button key={s} onClick={() => setTplStyleFilter(s)} className={`px-2 py-0.5 rounded text-[11px] ${tplStyleFilter === s ? 'bg-[#02A7F0] text-white' : 'bg-[#F2F3F5] text-[#666]'}`}>{STYLE_LABELS[s]}</button>
                ))}
              </div>
              {tplStyleFilter === 'basic' ? (
                // 「通用」路径：结构固定 + 选色系自由叠加
                <div className="grid grid-cols-2 gap-2">
                  {COLOR_FAMILIES.map(f => {
                    const applied = tplAppliedId.current === `basic-${f.id}`
                    return (
                      <button key={f.id} onClick={() => {
                        const tpl = basicTemplateForFamily(f)
                        const r = applyTemplate(cwOutline, tpl, themeId, { stage: gradeToStage(teaching.grade), subject: teaching.subject })
                        setCwOutline(r.outline); setThemeId(r.themeId)
                        tplAppliedId.current = tpl.id; tplPrevTheme.current = r.prevThemeId; tplPrevLayouts.current = r.prevLayouts
                        setTplPanelOpen(false)
                        toast(`已套用：通用结构 · ${f.label}`, 'success')
                      }} className={`text-left rounded border overflow-hidden ${applied ? 'border-[#02A7F0] ring-1 ring-[#02A7F0]' : 'border-[#E7E7EB] hover:border-[#02A7F0]'}`}>
                        <img src={renderFamilyThumb(f)} alt={f.label} className="w-full h-[72px] object-cover bg-[#F2F3F5]" />
                        <div className="p-1.5">
                          <div className="text-[12px] font-medium text-[#353535] truncate">通用 · {f.label}</div>
                          <div className="text-[10px] text-[#999] mt-0.5">结构 × 色系 · {Object.keys(BASIC_TEMPLATE.layouts).length} 版式</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {PPT_TEMPLATES.filter(t => !tplStyleFilter || t.style === tplStyleFilter).map(t => (
                    <button key={t.id} onClick={() => {
                      const r = applyTemplate(cwOutline, t, themeId, { stage: gradeToStage(teaching.grade), subject: teaching.subject })
                      setCwOutline(r.outline); setThemeId(r.themeId)
                      tplAppliedId.current = t.id; tplPrevTheme.current = r.prevThemeId; tplPrevLayouts.current = r.prevLayouts
                      setTplPanelOpen(false)
                      toast(`已套用模板：${t.name}`, 'success')
                    }} className={`text-left rounded border overflow-hidden ${tplAppliedId.current === t.id ? 'border-[#02A7F0] ring-1 ring-[#02A7F0]' : 'border-[#E7E7EB] hover:border-[#02A7F0]'}`}>
                      <img src={renderTemplateThumb(t)} alt={t.name} className="w-full h-[72px] object-cover bg-[#F2F3F5]" />
                      <div className="p-1.5">
                        <div className="text-[12px] font-medium text-[#353535] truncate">{t.name}</div>
                        <div className="text-[10px] text-[#999] mt-0.5">{STYLE_LABELS[t.style]} · {t.layouts ? Object.keys(t.layouts).length : 0} 版式</div>
                      </div>
                    </button>
                  ))}
                  {PPT_TEMPLATES.filter(t => !tplStyleFilter || t.style === tplStyleFilter).length === 0 && (
                    <p className="col-span-2 text-[11px] text-[#999] text-center py-4">该风格暂无 PPT 模板，后续素材积累后可见</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 主体三栏：左缩微页 / 中画布 / 右批注，顶端齐平 */}
      <div className="flex-1 flex min-h-0 relative">
        {/* 缩略图页管理（可收起，腾讯文档范式） */}
        {!thumbCollapsed && (
          <div className="w-44 shrink-0 overflow-y-auto border-r border-[#E7E7EB] bg-white p-2 space-y-1.5">
            {cwOutline.map((s, idx) => (
              <div key={idx} onClick={() => setDocSlide(idx)}
                className={`group cursor-pointer rounded-[4px] border p-1.5 ${idx === docSlide ? 'border-[#02A7F0] bg-[#E8F7FF]' : 'border-[#E7E7EB] hover:bg-[#F6F7F8]'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#9A9A9A]">P{idx + 1}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button onClick={(e) => { e.stopPropagation(); moveCwPage(idx, -1) }} disabled={idx === 0} className="px-1 text-[10px] text-[#353535] hover:text-[#02A7F0] disabled:opacity-30">↑</button>
                    <button onClick={(e) => { e.stopPropagation(); moveCwPage(idx, 1) }} disabled={idx === cwOutline.length - 1} className="px-1 text-[10px] text-[#353535] hover:text-[#02A7F0] disabled:opacity-30">↓</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteCwPage(idx) }} className="px-1 text-[10px] text-[#F5222D] hover:bg-[#FFF1F0]">✕</button>
                  </div>
                </div>
                <p className="text-[11px] text-[#353535] truncate mt-0.5">{s.title || '（无标题）'}</p>
              </div>
            ))}
          </div>
        )}
        {thumbCollapsed && (
          <button onClick={() => setThumbCollapsed(false)} title="展开页列表"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-30 w-6 h-14 rounded-r-md bg-[#212529]/85 text-white flex items-center justify-center hover:bg-[#212529] text-[14px] shadow-md">›</button>
        )}

        {/* 中：可编辑画布 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex justify-center">
        {cwFormat === 'video' && (
          <div className="mb-3 rounded-[6px] border border-[#B7EB8F] bg-[#F6FFED] p-3">
            <div className="text-[12px] font-medium text-[#389E0D] mb-2">🎬 视频课件配置（AI 生成视频即将上线，先选好参数）</div>
            <div className="mb-2">
              <div className="text-[11px] text-[#595959] mb-1">出镜形象</div>
              <div className="flex flex-wrap gap-2">
                {CW_PRESENTERS.map(p => (
                  <button key={p.id} type="button" onClick={() => { setVideoConfig(v => ({ ...v, presenter: p.id })); ctrl.touch() }}
                    className={`px-2.5 py-1 text-[12px] rounded-full border transition-colors ${videoConfig.presenter === p.id ? 'border-[#52C41A] bg-[#52C41A] text-white' : 'border-[#D9D9D9] text-[#595959] hover:border-[#52C41A]'}`}>{p.label}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#595959] mb-1">讲解风格</div>
              <div className="flex flex-wrap gap-2">
                {CW_STYLES.map(s => (
                  <button key={s.id} type="button" onClick={() => { setVideoConfig(v => ({ ...v, style: s.id })); ctrl.touch() }}
                    className={`px-2.5 py-1 text-[12px] rounded-full border transition-colors ${videoConfig.style === s.id ? 'border-[#52C41A] bg-[#52C41A] text-white' : 'border-[#D9D9D9] text-[#595959] hover:border-[#52C41A]'}`}>{s.label}</button>
                ))}
              </div>
            </div>
            <div className="mt-2 text-[11px] text-[#389E0D]">
              左侧画布即 AI 讲解视频的 <b>分镜脚本</b>，可先以 PPT / H5 形式交付；生成视频待 token 平权后开放。
            </div>
          </div>
        )}

        {cwOutline.length > 0 ? (
          <PptxPreview
            slides={outlineToSlides(cwOutline, cwOpts())}
            theme={getTheme(themeId)}
            editable
            index={docSlide}
            onIndexChange={setDocSlide}
            onSlideChange={handleDocSlideChange}
            aspectRatio={cwAr}
            embedFullscreen={true}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            {/* 版心比例选择：画布空态时选择 16:9 或 4:3 */}
            <div className="inline-flex rounded-full border border-[#E7E7EB] overflow-hidden">
              {(['16/9', '4/3'] as const).map(ratio => (
                <button key={ratio} onClick={() => setCwAr(ratio)}
                  className={`px-4 py-1.5 text-[12px] font-medium transition-colors ${cwAr === ratio ? 'bg-[#02A7F0] text-white' : 'text-[#595959] hover:bg-[#F6F7F8]'}`}>
                  {ratio}
                </button>
              ))}
            </div>
            {/* 画布比例占位卡片 */}
            <div
              className="bg-white border-2 border-dashed border-[#D0D0D0] rounded-[8px] flex flex-col items-center justify-center"
              style={{ width: Math.min(720, cwAr === '16/9' ? 560 : 525), aspectRatio: cwAr === '16/9' ? '16/9' : '4/3', maxWidth: '100%' }}
            >
              <Sparkles size={28} className="text-[#D0D0D0] mb-3" />
              <p className="text-[13px] text-[#9A9A9A]">暂无课件内容</p>
              <p className="text-[11px] text-[#A3A3A3] mt-1">在左栏填写课题名称后点击「AI 生成课件」</p>
            </div>
          </div>
        )}

        {/* 发散地图 */}
        {cwDivergence.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#E7E7EB]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-medium text-[#353535]">🧭 发散地图（勾选要删除的项，可溯源到锚点）</p>
              <button onClick={handleTrimCw} disabled={trimming || !cwDivergence.some(d => removedDivergence[d.content])}
                className="px-2 py-1 text-[11px] text-white bg-[#FA8C16] rounded-[3px] hover:bg-[#E67E00] disabled:opacity-40">
                {trimming ? '剔除中...' : `应用剔除 (${cwDivergence.filter(d => removedDivergence[d.content]).length})`}
              </button>
            </div>
            <div className="space-y-1.5">
              {cwDivergence.map((d: any, i: number) => (
                <label key={i} className={`flex items-start gap-2 text-[11px] leading-snug rounded-[3px] px-1 py-1 ${removedDivergence[d.content] ? 'bg-[#FFF1E6]' : 'hover:bg-[#F6F7F8]'}`}>
                  <input type="checkbox" className="mt-0.5 shrink-0" checked={!removedDivergence[d.content]}
                    onChange={e => setRemovedDivergence(s => ({ ...s, [d.content]: !e.target.checked }))} />
                  <span className={`px-1.5 py-0.5 rounded-[2px] text-white shrink-0 ${d.zone === 'edge' ? 'bg-[#722ED1]' : 'bg-[#9A9A9A]'}`}>
                    {d.zone === 'edge' ? '边缘' : '轨道'}
                  </span>
                  <span className="text-[#353535]">
                    <b>{d.content}</b> → 锚点：{d.anchor}（{d.rationale}）
                    {d.warn ? <span className="text-[#FA8C16]"> ⚠ 疑似超界</span> : ''}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 发布校验未通过 */}
        {validateIssues && validateIssues.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#F5222D]">
            <p className="text-[12px] font-medium text-[#F5222D] mb-2">⛔ 发布校验未通过，请修改后重新发布：</p>
            <ul className="space-y-1.5">
              {validateIssues.map((iss: any, i: number) => (
                <li key={i} className="text-[11px] text-[#353535] leading-snug">
                  · {iss.message} <span className="text-[#9A9A9A]">（建议：{iss.suggestion}）</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

        {/* 批注 / 版本快照（按页锚定；右侧浮层，不挤压画布） */}
        {cwHistoryVisible && (
          <div className="absolute right-0 top-0 bottom-0 w-[220px] border-l border-[#E7E7EB] bg-[#FAFBFC] flex flex-col z-20 overflow-hidden shadow-lg">
            <div className="flex border-b border-[#F0F0F0] shrink-0">
              <button onClick={() => setCwAnnTab('annotations')}
                className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-colors ${cwAnnTab === 'annotations' ? 'border-[#02A7F0] text-[#02A7F0] bg-white' : 'border-transparent text-[#9A9A9A] hover:text-[#595959]'}`}>
                <MessageSquare size={11} className="inline mr-1" />批注
              </button>
              <button onClick={() => setCwAnnTab('history')}
                className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-colors ${cwAnnTab === 'history' ? 'border-[#02A7F0] text-[#02A7F0] bg-white' : 'border-transparent text-[#9A9A9A] hover:text-[#595959]'}`}>
                <History size={11} className="inline mr-1" />版本
              </button>
              <button onClick={() => setCwHistoryVisible(false)} title="收起批注栏" className="px-2 text-[#C0C0C0] hover:text-[#9A9A9A]">
                <ChevronLeft size={12} style={{ transform: 'rotate(180deg)' }} />
              </button>
            </div>

            {cwAnnTab === 'annotations' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-2 border-b border-[#F0F0F0] bg-white shrink-0">
                  <p className="text-[10px] text-[#9A9A9A] mb-1.5">对第 {docSlide + 1} 页写批注：</p>
                  <textarea
                    value={cwAnnText}
                    onChange={e => setCwAnnText(e.target.value)}
                    rows={2}
                    placeholder="输入批注..."
                    className="w-full px-2 py-1 text-[11px] border border-[#E7E7EB] rounded focus:border-[#02A7F0] outline-none resize-none"
                  />
                  <button onClick={addCwAnnotation}
                    disabled={!cwAnnText.trim()}
                    className="w-full mt-1.5 py-1 text-[11px] text-white bg-[#02A7F0] rounded hover:bg-[#0398D8] disabled:opacity-40 flex items-center justify-center gap-1">
                    <Plus size={10} /> 添加批注
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {cwAnn.items.length === 0 ? (
                    <p className="text-[11px] text-[#C0C0C0] text-center py-4">暂无批注</p>
                  ) : (
                    cwAnn.items.map((a: any) => {
                      let pageLabel = ''
                      try { pageLabel = 'P' + (JSON.parse(a.anchor || '{}').page || '?') } catch { /* noop */ }
                      return (
                        <div key={a.id} className="p-2 border-b border-[#F5F5F5] hover:bg-[#F0F2F5]">
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[11px] text-[#1A3A6B] bg-[#E3ECFA] px-1.5 py-0.5 rounded">{pageLabel}</span>
                            <button onClick={() => cwAnn.remove(a.id)} className="text-[#C0C0C0] hover:text-red-400 shrink-0"><X size={10} /></button>
                          </div>
                          <p className="text-[11px] text-[#595959] mt-1 leading-relaxed">{a.comment}</p>
                          <span className="text-[9px] text-[#C0C0C0]">{a.created_at?.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {cwAnnTab === 'history' && (
              <div className="flex-1 overflow-y-auto py-1">
                {cwLocked ? (
                  <p className="text-[10px] text-[#9A9A9A] px-3 py-2">已发布定版，版本仅供查看，不可存/回退</p>
                ) : (
                  <>
                    <button onClick={() => takeCwSnapshot()}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-[#02A7F0] hover:bg-[#F0F2F5] flex items-center gap-1">
                      <Plus size={10} /> 保存当前版本
                    </button>
                    <div className="border-t border-[#F0F0F0] my-1" />
                  </>
                )}
                {cwVer.items.length === 0 ? (
                  <p className="text-[11px] text-[#C0C0C0] px-3 py-2">暂无版本记录</p>
                ) : (
                  cwVer.items.map((s: any) => (
                    <div key={s.id} className="px-3 py-1.5 hover:bg-[#F0F2F5] border-b border-[#F5F5F5]">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#353535]">{s.created_at?.slice(0, 16).replace('T', ' ')}</span>
                        <span className="text-[9px] text-[#C0C0C0]">{s.label}</span>
                      </div>
                      {!cwLocked && (
                        <div className="flex gap-2 mt-0.5">
                          <button onClick={() => restoreCwSnapshot(s.id)} className="text-[10px] text-[#02A7F0] hover:underline flex items-center gap-0.5">
                            <RotateCcw size={9} />恢复
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* 批注栏收起后悬浮展开按钮（与教案完全一致：右侧垂直居中 w-7 h-12 rounded-l 灰底 ChevronLeft） */}
        {!cwHistoryVisible && (
          <button onClick={() => setCwHistoryVisible(true)} title="展开批注/版本历史"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-12 bg-gray-700/70 hover:bg-gray-800 rounded-l-md flex items-center justify-center text-white z-20 transition-all shadow-md">
            <ChevronLeft size={14} />
          </button>
        )}

      </div>
    </div>
  )

  // ── 查看态只读放映内容（左缩略图导航 + 右可滚动放映），view 态 secondaryRight 与全屏 previewSlot 共用 ──
  const previewSlides = useMemo(() => {
    if (cwOutline.length === 0) return null
    try {
      return outlineToSlides(cwOutline, cwOpts())
    } catch (e) {
      console.error('previewSlides: outlineToSlides failed', e)
      return null
    }
  }, [cwOutline])
  const previewSlideElems = previewSlides && previewSlides.length > 0 ? (
    <PptxPreview slides={previewSlides} theme={getTheme(themeId)} showPager={false} index={docSlide} viewMode="single" />
  ) : (
    <div className="text-center py-16 text-[13px] text-[#9A9A9A]">课件内容为空</div>
  )
  const previewPane = (
    <div className="flex-1 flex overflow-hidden bg-[#FAFAFA] h-full">
      {/* 左：只读缩略图页导航 */}
      <div className="w-44 shrink-0 overflow-y-auto border-r border-[#E7E7EB] bg-white p-2 space-y-1.5">
        <div className="px-1 pb-1 text-[11px] font-medium text-[#353535]">页面（{cwOutline.length}）</div>
        {cwOutline.map((s, idx) => (
          <div key={idx} onClick={() => setDocSlide(idx)}
            className={`cursor-pointer rounded-[4px] border p-1.5 ${idx === docSlide ? 'border-[#02A7F0] bg-[#E8F7FF]' : 'border-[#E7E7EB] hover:bg-[#F6F7F8]'}`}>
            <span className="text-[10px] text-[#9A9A9A]">P{idx + 1}</span>
            <p className="text-[11px] text-[#353535] truncate mt-0.5">{s.title || '（无标题）'}</p>
          </div>
        ))}
      </div>
      {/* 中：可滚动只读放映 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mb-3 text-[12px] text-[#9A9A9A]">预览模式（只读）· 第 {docSlide + 1}/{cwOutline.length} 页</div>
        {previewSlideElems}
      </div>
      {/* 右：批注 / 版本（与全屏态一致，预览态下默认展开） */}
      {cwAnnTargetId && (
        <div className="relative w-[260px] shrink-0 border-l border-[#E7E7EB] bg-[#FAFBFC] flex flex-col z-20 overflow-hidden">
          <div className="flex border-b border-[#F0F0F0] shrink-0">
            <button onClick={() => setCwAnnTab('annotations')}
              className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-colors ${cwAnnTab === 'annotations' ? 'border-[#02A7F0] text-[#02A7F0] bg-white' : 'border-transparent text-[#9A9A9A] hover:text-[#595959]'}`}>
              <MessageSquare size={11} className="inline mr-1" />批注
            </button>
            <button onClick={() => setCwAnnTab('history')}
              className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-colors ${cwAnnTab === 'history' ? 'border-[#02A7F0] text-[#02A7F0] bg-white' : 'border-transparent text-[#9A9A9A] hover:text-[#595959]'}`}>
              <History size={11} className="inline mr-1" />版本
            </button>
          </div>
          {cwAnnTab === 'annotations' && (
            <div className="flex-1 overflow-y-auto">
              {cwAnn.items.length === 0 ? (
                <p className="text-[11px] text-[#C0C0C0] text-center py-4">暂无批注</p>
              ) : (
                cwAnn.items.map((a: any) => {
                  let pageLabel = ''
                  try { pageLabel = 'P' + (JSON.parse(a.anchor || '{}').page || '?') } catch { /* noop */ }
                  return (
                    <div key={a.id} className="p-2 border-b border-[#F5F5F5] hover:bg-[#F0F2F5]">
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[11px] text-[#1A3A6B] bg-[#E3ECFA] px-1.5 py-0.5 rounded">{pageLabel}</span>
                      </div>
                      <p className="text-[11px] text-[#595959] mt-1 leading-relaxed">{a.comment}</p>
                      <span className="text-[9px] text-[#C0C0C0]">{a.created_at?.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                  )
                })
              )}
            </div>
          )}
          {cwAnnTab === 'history' && (
            <div className="flex-1 overflow-y-auto py-1">
              {cwLocked ? (
                <p className="text-[10px] text-[#9A9A9A] px-3 py-2">已发布定版，版本仅供查看</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )

  // 全屏编辑：最大化画布，隐藏左右栏与发散/校验面板，但顶栏整合左栏关键信息与编辑控件（优先级最高，覆盖查看态/编辑态）
  if (cwFullscreen) {
    const slides = outlineToSlides(cwOutline, cwOpts())
    return (
      <div className="fixed inset-0 z-50 bg-[#FAFAFA] flex flex-col">
        {/* 顶栏：退出 / 课题信息（左栏关键信息）/ 编辑控件 / 比例 / 显示页 / 导出 */}
        <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-[#EFEFEF] bg-white">
          <button onClick={() => setCwFullscreen(false)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] text-[#353535] border border-[#E0E0E0] rounded hover:bg-[#F5F5F5]">
            <X size={13} /> 退出全屏 (Esc)
          </button>
          <div className="min-w-0 flex flex-col leading-tight">
            <span className="text-[13px] text-[#353535] font-medium truncate">{genTitle.trim() || '未命名课件'}</span>
            <span className="text-[10px] text-[#9A9A9A] truncate">{teaching.subject} · {gradeName} · {teaching.semester || '学期'}</span>
          </div>
          <div className="w-px h-5 bg-[#EEE]" />
          {/* 编辑控件：对照腾讯文档工具栏 */}
          <button onClick={polishOutline} disabled={polishing} title="AI 润色提纲"
            className="px-2 py-1.5 text-[12px] text-[#02A7F0] border border-[#02A7F0] rounded hover:bg-[#E8F7FF] disabled:opacity-50 flex items-center gap-1">
            <Sparkles size={13} /> 润色
          </button>
          <button onClick={addCwPage} title="新增页" className="px-2 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded hover:bg-white flex items-center gap-1">
            <Plus size={13} /> 页
          </button>
          <button onClick={() => deleteCwPage(docSlide)} disabled={cwOutline.length <= 1} title="删除当前页"
            className="px-2 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded hover:bg-white disabled:opacity-40 flex items-center gap-1">
            <X size={13} /> 删
          </button>
          <button onClick={() => setCwHistoryVisible(v => !v)} title="批注 / 版本" className={`px-2 py-1.5 text-[12px] border rounded flex items-center gap-1 ${cwHistoryVisible ? 'text-[#02A7F0] border-[#02A7F0] hover:bg-[#E8F7FF]' : 'text-[#353535] border-[#E7E7EB] hover:bg-white'}`}>
            <MessageSquare size={13} /> 批注
          </button>
          <div className="flex-1" />
          {/* 版心比例切换 */}
          <select value={cwAr} onChange={(e) => setCwAr(e.target.value as '16/9' | '4/3')}
            className="px-2 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded bg-white hover:bg-[#F7F7F8]" title="版心比例">
            <option value="16/9">16:9</option>
            <option value="4/3">4:3</option>
          </select>
          {cwOutline.length > 1 && (
            <button onClick={() => setCwFsThumb(v => !v)} title="显示/隐藏缩略图栏"
              className="px-2.5 py-1.5 text-[12px] text-[#595959] border border-[#E0E0E0] rounded hover:bg-[#F5F5F5]">
              {cwFsThumb ? '隐藏页' : '显示页'}
            </button>
          )}
          {/* 导出（与非全屏态一致的完整格式：PPT/Word/PDF/H5） */}
          <button onClick={exportCwPptx}
            className="px-3 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded hover:bg-[#0398D8]">导出 PPT</button>
          <button onClick={exportCwDocx} title="导出 Word"
            className="px-2.5 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded hover:bg-white">导出 Word</button>
          <button onClick={exportCwPdf} title="导出 PDF"
            className="px-2.5 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded hover:bg-white">导出 PDF</button>
          <button onClick={exportCwH5} title="导出 H5" className={`px-2.5 py-1.5 text-[12px] border rounded ${cwFormat === 'h5' ? 'text-white bg-[#FA8C16] border-[#FA8C16] hover:bg-[#E67E00]' : 'text-[#353535] border-[#E7E7EB] hover:bg-white'}`}>导出 H5</button>
        </div>
        {/* 主体：缩略图 + 画布 */}
        <div className="flex-1 flex min-h-0">
          {cwFsThumb && cwOutline.length > 1 && (
            <div className="w-[170px] shrink-0 border-r border-[#EFEFEF] bg-[#F7F7F8] overflow-y-auto py-2">
              {cwOutline.map((s, i) => (
                <button key={i} onClick={() => setDocSlide(i)}
                  className={`w-full text-left px-2.5 py-2 mb-1 mx-1 rounded text-[11px] leading-snug transition-colors ${i === docSlide ? 'bg-[#02A7F0] text-white' : 'text-[#595959] hover:bg-[#ECECF0]'}`}>
                  <span className="block opacity-60 text-[10px] mb-0.5">P{i + 1}</span>
                  {(s.title || '未命名').slice(0, 16)}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-6 flex justify-center">
            <div className="w-full max-w-[960px]">
              {cwOutline.length > 0 && slides.length > 0 ? (
                <PptxPreview slides={slides} theme={getTheme(themeId)} aspectRatio={cwAr} index={docSlide} viewMode="scroll" editable embedFullscreen={true} />
              ) : (
                <div className="h-full flex items-center justify-center text-[13px] text-[#9A9A9A]">课件内容为空，请先生成课件</div>
              )}
            </div>
          </div>
          {/* 全屏内批注 / 版本浮层 */}
          {cwHistoryVisible && (
            <div className="relative w-[240px] shrink-0 border-l border-[#E7E7EB] bg-[#FAFBFC] flex flex-col z-20 overflow-hidden shadow-lg">
              <div className="flex border-b border-[#F0F0F0] shrink-0">
                <button onClick={() => setCwAnnTab('annotations')}
                  className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-colors ${cwAnnTab === 'annotations' ? 'border-[#02A7F0] text-[#02A7F0] bg-white' : 'border-transparent text-[#9A9A9A] hover:text-[#595959]'}`}>
                  <MessageSquare size={11} className="inline mr-1" />批注
                </button>
                <button onClick={() => setCwAnnTab('history')}
                  className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-colors ${cwAnnTab === 'history' ? 'border-[#02A7F0] text-[#02A7F0] bg-white' : 'border-transparent text-[#9A9A9A] hover:text-[#595959]'}`}>
                  <History size={11} className="inline mr-1" />版本
                </button>
                <button onClick={() => setCwHistoryVisible(false)} title="收起批注栏" className="px-2 text-[#C0C0C0] hover:text-[#9A9A9A]">
                  <ChevronLeft size={12} style={{ transform: 'rotate(180deg)' }} />
                </button>
              </div>
              {cwAnnTab === 'annotations' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-2 border-b border-[#F0F0F0] bg-white shrink-0">
                    <p className="text-[10px] text-[#9A9A9A] mb-1.5">对第 {docSlide + 1} 页写批注：</p>
                    <textarea
                      value={cwAnnText}
                      onChange={e => setCwAnnText(e.target.value)}
                      rows={2}
                      placeholder="输入批注..."
                      className="w-full px-2 py-1 text-[11px] border border-[#E7E7EB] rounded focus:border-[#02A7F0] outline-none resize-none"
                    />
                    <button onClick={addCwAnnotation}
                      disabled={!cwAnnText.trim()}
                      className="w-full mt-1.5 py-1 text-[11px] text-white bg-[#02A7F0] rounded hover:bg-[#0398D8] disabled:opacity-40 flex items-center justify-center gap-1">
                      <Plus size={10} /> 添加批注
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {cwAnn.items.length === 0 ? (
                      <p className="text-[11px] text-[#C0C0C0] text-center py-4">暂无批注</p>
                    ) : (
                      cwAnn.items.map((a: any) => {
                        let pageLabel = ''
                        try { pageLabel = 'P' + (JSON.parse(a.anchor || '{}').page || '?') } catch { /* noop */ }
                        return (
                          <div key={a.id} className="p-2 border-b border-[#F5F5F5] hover:bg-[#F0F2F5]">
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-[11px] text-[#1A3A6B] bg-[#E3ECFA] px-1.5 py-0.5 rounded">{pageLabel}</span>
                              <button onClick={() => cwAnn.remove(a.id)} className="text-[#C0C0C0] hover:text-red-400 shrink-0"><X size={10} /></button>
                            </div>
                            <p className="text-[11px] text-[#595959] mt-1 leading-relaxed">{a.comment}</p>
                            <span className="text-[9px] text-[#C0C0C0]">{a.created_at?.slice(0, 16).replace('T', ' ')}</span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
              {cwAnnTab === 'history' && (
                <div className="flex-1 overflow-y-auto py-1">
                  {cwLocked ? (
                    <p className="text-[10px] text-[#9A9A9A] px-3 py-2">已发布定版，版本仅供查看，不可存/回退</p>
                  ) : (
                    <>
                      <button onClick={() => takeCwSnapshot()}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-[#02A7F0] hover:bg-[#F0F2F5] flex items-center gap-1">
                        <Plus size={10} /> 保存当前版本
                      </button>
                      <div className="border-t border-[#F0F0F0] my-1" />
                    </>
                  )}
                  {cwVer.items.length === 0 ? (
                    <p className="text-[11px] text-[#C0C0C0] px-3 py-2">暂无版本记录</p>
                  ) : (
                    cwVer.items.map((s: any) => (
                      <div key={s.id} className="px-3 py-1.5 hover:bg-[#F0F2F5] border-b border-[#F5F5F5]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-[#353535] truncate">{s.label}</span>
                          {!cwLocked && (
                            <button onClick={() => restoreCwSnapshot(s.id)} title="恢复到此版本"
                              className="text-[#02A7F0] hover:text-[#0E7BC4] shrink-0 flex items-center gap-0.5 text-[10px]">
                              <RotateCcw size={10} /> 回退
                            </button>
                          )}
                        </div>
                        <span className="text-[9px] text-[#C0C0C0]">{s.created_at?.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {/* 批注栏收起后：悬浮展开按钮（与教案完全一致：右侧垂直居中 w-7 h-12 rounded-l 灰底 ChevronLeft） */}
          {!cwHistoryVisible && (
            <button onClick={() => setCwHistoryVisible(true)} title="展开批注/版本历史"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-12 bg-gray-700/70 hover:bg-gray-800 rounded-l-md flex items-center justify-center text-white z-20 transition-all shadow-md">
              <ChevronLeft size={14} />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── 查看态（bare :id）：与组卷同构 —— secondary 锁定 + 自动全屏预览，点「编辑」原地解锁进文档模式 ──
  if (ctrl.readOnly) {
    return (
      <EditorLayout
        sceneName={channel.scene}
        primaryLeft={leftPanel}
        primaryRight={rightPanelAi}
        secondaryLeft={leftPanel}
        secondaryRight={previewPane}
        mode="secondary"
        modeLocked
        modeLockedLabel="只读查看"
        footerAlign="left"
        footerLifecycle={{
          saveDraftLabel: '编辑',
          publishLabel: '返回课件库',
          onSaveDraft: editNow,
          onPublish: () => { window.location.href = '/courseware/' + cwFormat },
        }}
        previewTitle={`${genTitle.trim() || '未命名'}_课件 · ${channel.previewSuffix}`}
        previewSlot={previewPane}
        previewOpen={effectivePreviewOpen}
        onPreviewChange={setPreviewOpen}
        onPreviewEdit={editNow}
      />
    )
  }

  return (
    <EditorLayout
      primaryLeft={leftPanel}
      primaryRight={rightPanelAi}
      secondaryLeft={leftPanel}
      secondaryRight={rightPanelDoc}
      mode={ctrl.workMode === 'ai' ? 'primary' : 'secondary'}
      onModeChange={m => ctrl.setWorkMode(m === 'primary' ? 'ai' : 'doc')}
      sceneName={channel.scene}
      footerAlign="left"
      footerLifecycle={{
        saveDraftLabel: '保存草稿',
        publishLabel: '发布',
        onSaveDraft: ctrl.saveDraft,
        onPublish: ctrl.publish,
        status: ctrl.status,
        saving: ctrl.saving || savingCw || validating,
      }}
      // 编辑态 footer「预览」开全屏放映：先 flush 自动保存草稿，确保最新修改已落库
      previewOpen={previewOpen}
      onPreviewChange={(open) => {
        if (open) { ctrl.flush().then(() => setPreviewOpen(true)) }
        else setPreviewOpen(false)
      }}
      previewSlot={cwOutline.length > 0 ? previewPane : (
          <div className="h-full flex items-center justify-center text-[13px] text-[#9A9A9A]">课件内容为空，请先生成课件</div>
        )}
    />
  )
}
