import { safeGetUser, type MyClass, type ScopeResolvedPayload, type SimilarMaterial } from '../lib/domain'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Sparkles, Loader2, FileText, MessageSquare, History, Plus, X, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, Download, Maximize2, Undo2, Redo2, TextCursorInput, Shapes, Image as ImageIcon, ZoomIn, Smartphone } from 'lucide-react'
import { useToast } from '../components/Toast'
import {useTeaching, GRADE_NAMES } from '../lib/TeachingContext'
import { useKnowledgePicker } from '../hooks/useKnowledgePicker'
import { useKGContext } from '../lib/KnowledgeGraphContext'
import { api, aiAPI, materialAPI, classAPI, decorAPI, notifyError, type MaterialItem, type DecorItem, type DecorSlots } from '../lib/api'
import { loadDecorCatalog } from '../lib/decorCatalog'
import { getXiaoweiContext } from '../lib/xiaoweiContext'
import { buildKnowledgeScope } from '../lib/knowledgeScope'
import { exportLessonPlanToDocx, downloadBlob } from '../lib/exportDocx'
import { printLessonPlan } from '../lib/printPdf'
import { exportCoursewareToPptx, outlineToSlides, parseCoverDecor, outlineToMarkdown, markdownToOutline, pptToOutline, materializeOutline, extractBullets, isValidComponent, normalizeInteractive, type H5Component } from '../lib/exportPptx'
import { distributeToSlots } from '../lib/cwTemplate'
// 口径统一（2026-09-11）：风格 key 由注册表单一提供（物化默认元素时也要带风格）
import { styleKeyFromThemeId } from '../lib/styleRegistry'
import { decideVersion, type VersionTrigger } from '../lib/versionPolicy'
import { isDebugView } from '../lib/debugFlag'

import { exportH5Courseware, buildH5FromOutline, buildH5Html, renderInteractive, type H5Slide } from '../lib/exportH5'
import { markdownToStorybookH5 } from '../lib/courseware-h5'
import QRCode from 'qrcode'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { OutlineSlide, CwSlide } from '../lib/exportPptx'
import { recommendTheme, resolveTheme } from '../lib/pptThemes'
// 注：revertTemplate / reflowToSkeleton / basicTemplateForFamily 已随模板簇搬到 hooks/useCwTemplate.ts（2026-09-16）
import { PPT_TEMPLATES, H5_TEMPLATES, applyTemplate, renderTemplateThumb, renderFamilyThumb, BASIC_TEMPLATE, COLOR_FAMILIES, STYLE_LABELS, defaultThemeForStyle, gradeToStage, getTemplates, gradeToStageTag, subjectToTag, templateStyleTags, templateColorTags, type StyleTag } from '../lib/cwTemplate'
// 触发模板资产域注册（子项目库模板经适配器并入 PPT_TEMPLATES，副作用导入即可，无需引用）
import { getLibraryCostMeta } from '../lib/templateRegistryAdapter'
import EditorLayout from '../components/EditorLayout'
import EditorInfoPanel from '../components/EditorInfoPanel'
import { useEditorController } from '../hooks/useEditorController'
import { useCwDecor } from '../hooks/useCwDecor'
import { useCwExport } from '../hooks/useCwExport'
import { useCwGenParams } from '../hooks/useCwGenParams'
import { useCwSave } from '../hooks/useCwSave'
import { useCwTemplate } from '../hooks/useCwTemplate'
import { useCwPreview } from '../hooks/useCwPreview'
import { InteractiveForm, interactiveSummary, defaultInteractive } from '../components/CwInteractiveForm'
import { DecorPickerModal } from '../components/DecorPickerModal'
import { CwAnnotationsPanel } from '../components/CwAnnotationsPanel'
import { CwPageList } from '../components/CwPageList'
import { CwLeftPanel } from '../components/CwLeftPanel'
import { CwPreviewPane } from '../components/CwPreviewPane'
import KnowledgeGraphTool from '../components/KnowledgeGraphTool'
// SlideThumb 已随页列表抽出（现由 CwPageList 内部使用）
import PptxPreview, { type DecorSelection } from '../components/PptxPreview'
import { useAnnotations, useVersions } from '../hooks/useAnnotations'
// safeGetUser 已收敛到 lib/domain.ts（此前在 4 个文件各实现一遍，且返回 any）
const getSchoolId = () => { try { const t = localStorage.getItem('zhiwei_token') || ''; const p = JSON.parse(atob(t.split('.')[1])); return p.school_id || '' } catch { return '' } }

// 教学课件频道：PPT / H5 / 视频 共用同一编辑器与同一份内容来源（一次创作、多格式交付）
type CwFormat = 'ppt' | 'h5' | 'video'
const CW_CHANNEL: Record<CwFormat, { name: string; chip: string; color: string; scene: string; previewSuffix: string }> = {
  ppt:   { name: 'PPT 课件',    chip: 'PPT',  color: '#722ED1', scene: 'PPT 课件',    previewSuffix: 'PPT 放映' },
  h5:    { name: 'H5 互动课件', chip: 'H5',   color: '#FA8C16', scene: 'H5 互动课件', previewSuffix: 'H5 预览' },
  video: { name: '视频课件',    chip: '视频', color: '#52C41A', scene: '视频课件',    previewSuffix: '分镜预览' },
}

// ── H5 互动组件：手动挂编辑器（选择器 + 表单）──
const INTERACTIVE_META: { type: H5Component['type']; label: string; icon: string; hint: string }[] = [
  { type: 'reveal', label: '点击揭示', icon: '🔍', hint: '答案翻牌（平日常隐藏，点击显示）' },
  { type: 'quiz', label: '随堂选择题', icon: '✅', hint: '全班即时反馈，点选判对错' },
  { type: 'audio', label: '音频', icon: '🔊', hint: '课文朗读/听力（上传或素材库）' },
  { type: 'video', label: '视频', icon: '🎬', hint: '实验演示/微课' },
  { type: 'gallery', label: '图册', icon: '🖼', hint: '美术/文物/图谱滑动翻看' },
  { type: 'popup', label: '弹层', icon: '📌', hint: '拓展阅读/知识卡' },
  { type: 'readalong', label: '点读', icon: '📖', hint: '英语/拼音：点击文字播音频' },
  { type: 'drawing', label: '绘图', icon: '✏️', hint: '投屏白板：教师现场边讲边画（对话气泡/句型树/简笔画）' },
]

// 互动组件摘要（卡片收起态展示）
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
  // 装饰素材库：进入编辑器即拉取，使模板装饰优先用素材库真实 URL（snapshot 内联 SVG 兜底）
  useEffect(() => { loadDecorCatalog() }, [])

  // ── 生成参数（P0-1：已抽到 hooks/useCwGenParams.ts；返回值沿用原名，调用点零改动）──
  // 课题名称 / 课件风格 / 补充要求 / 参照课件 / 发散边界 / 课前问诊，以及标签云与问诊的拉取动作。
  const genParams = useCwGenParams({ subject: teaching.subject, gradeName, picker })
  const {
    genTitle, setGenTitle, genStyleTag, setGenStyleTag, genStyleProfile, setGenStyleProfile,
    motifTags, cwExtra, setCwExtra, genBaseId, setGenBaseId,
    divergenceLevel, setDivergenceLevel, edgeEnabled, setEdgeEnabled, edgeCats, setEdgeCats,
    consultQuestions, consultAnswers, setConsultAnswers,
  } = genParams

  // ── 产物状态 ──
  const [genLoading, setGenLoading] = useState(false)
  // 生成进度（来自 SSE）：强模型一次生成含重试需 150~200s，无进度时教师会以为卡死。
  // stage 用于按钮上的短文案；message 作 title 悬浮详情（完整合规信息）。
  const [genStage, setGenStage] = useState<{ stage: string; message: string } | null>(null)
  // 生成配方（溯源）：服务端回传的"这次是按什么生成的"（知识面来源 teacher|kg、前置来源、
  // 发散边界 orbit/edge/beyond_band、教材版本、单元、模型）。生成后随草稿落库，
  // 编辑页才能回填「来源」——这是修"左栏与画布脱节"的关键数据。
  const [scopeResolved, setScopeResolved] = useState<ScopeResolvedPayload | null>(null)
  const [cwMarkdown, setCwMarkdown] = useState('')
  const [cwH5Html, setCwH5Html] = useState('')
  const [cwSimilar, setCwSimilar] = useState<SimilarMaterial | null>(null)
  const [cwOutline, setCwOutline] = useState<OutlineSlide[]>([])
  const [cwDivergence, setCwDivergence] = useState<any[]>([])
  const [removedDivergence, setRemovedDivergence] = useState<Record<string, boolean>>({})
  const [trimming, setTrimming] = useState(false)
  const [validateIssues, setValidateIssues] = useState<any[] | null>(null)
  const [validating, setValidating] = useState(false)
  const [h5Qr, setH5Qr] = useState<{ url: string; dataUrl: string } | null>(null)
  // H5 播放/预览态右栏的「扫码分享」二维码（通用 H5 分享样式）
  const [h5ShareQr, setH5ShareQr] = useState<{ url: string; dataUrl: string } | null>(null)
  const [polishing, setPolishing] = useState(false)
  const [genVideo, setGenVideo] = useState(false)
  // （docSlide / deckIdx / goToPage 已随预览簇搬到 hooks/useCwPreview.ts）
  // 当前页互动编辑：选择器 + 表单弹层（手动挂 H5 互动组件）
  const [interactivePickerOpen, setInteractivePickerOpen] = useState(false)
  // 当前页互动组件卡片的"展开编辑"索引（-1=全部收起）
  const [editingItIdx, setEditingItIdx] = useState(-1)
  // 新建课件默认套用「按学科+年级」推荐主题（仅默认，不强制；教师可随时手改，恢复草稿时以草稿为准）
  const [themeId, setThemeId] = useState<string>(() => recommendTheme(teaching.subject, teaching.grade).themeId)
  // 课件专属配色 DNA（Skill 当次生成，存 materials.color_root）；渲染优先用它，theme_id 仅兜底
  const [colorRoot, setColorRoot] = useState<string>('')
  // workMode 已收口到 useEditorController

  // ── 模板套用（P0-1：已抽到 hooks/useCwTemplate.ts；返回值沿用原名，调用点零改动）──
  // 模板库面板与小微「换风格」两条入口共用一份状态与"上次套用前"的存档（用于撤销/换回）。
  // getLocked / getVer / getRefOutline 三者都声明在**本调用点之后**，故一律包成箭头函数惰性取值；
  // 若直接传引用（如 `getRefOutline: loadRefOutline`）会在渲染期求值 → 踩 TDZ 崩溃。
  const {
    tplPanelOpen, setTplPanelOpen, tplStyleTags, setTplStyleTags, tplColorTags, setTplColorTags,
    tplAppliedId, applyTemplateEntry, applyFamilyEntry, undoTemplateApply, noteTemplateApplied,
  } = useCwTemplate({
    cwOutline, setCwOutline, themeId, setThemeId, cwFormat,
    grade: teaching.grade, subject: teaching.subject,
    getLocked: () => cwLocked, getVer: () => cwVer, getRefOutline: () => loadRefOutline(),
  })
  // （「系统生成 → 自动成为一稿草稿」的标记 pendingGenSave 已随保存簇搬到 hooks/useCwSave.ts；
  //   版本粒度规则见 lib/versionPolicy.ts。之所以用"标记 + effect"而非生成函数里直接存：
  //   生成函数里刚 setState 的 themeId/colorRoot 还没生效，会把旧主题写进草稿。）

  // （装饰元件 hook 的调用点已下移到 useCwPreview 之后 —— 它要读 docSlide）

  // （AI 装饰推荐 部分已随装饰簇一并抽到 hooks/useCwDecor.ts）

  // 加载「参照课件」提纲：文档模式套用模板时，若当前为空课件且已选参照，则先把参照内容载入，再套新模板版式
  const loadRefOutline = async (): Promise<OutlineSlide[]> => {
    if (!genBaseId) return []
    try {
      const base: any = await materialAPI.get(genBaseId)
      const md: string = base?.content || ''
      return materializeOutline(markdownToOutline(md), styleKeyFromThemeId(themeId))
    } catch { return [] }
  }

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
        setCwOutline(materializeOutline(Array.isArray(d.outline) ? d.outline : [], styleKeyFromThemeId(d.themeId || themeId)))
        setCwH5Html(d.h5Html || '')
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
      // 先算出"本次生效主题/配色"，再渲染（与生成路径同一原则）
      const effTheme = m.theme_id
        || (m.grade ? recommendTheme(m.subject || teaching.subject, GRADE_NAMES.indexOf(m.grade) + 1 || teaching.grade).themeId : themeId)
      const effColorRoot = m.color_root || ''
      setGenTitle((m.name || '').replace(/_课件$/, ''))
      setCwOutline(materializeOutline(markdownToOutline(m.content || ''), styleKeyFromThemeId(effTheme)))
      setCwMarkdown(m.content || '')
      // 配方回填（溯源，2026-09-13）：编辑页左栏「来源」区块据此显示"这份课件是按什么生成的"。
      // 此前这里什么都不回填 → 左栏退化成空表单 → 与画布上的成品"脱节"。
      try { setScopeResolved(m.gen_params ? JSON.parse(m.gen_params) : null) } catch { setScopeResolved(null) }
      // H5 绘本态：**画布一律本地重渲染**（2026-09-15 改）
      // 此前是"优先用服务端已有的 h5_html"—— 而 h5_html 是**派生缓存**（发布/扫码时服务端直接吐它）。
      // 一旦有缓存，画布就永远显示**旧渲染器**的结果：渲染器升级（如这次 HD 固定比例、整页适配）
      // 在画布上"看不见"，教师会以为没改（本次实测：画布里没有 scene-inner / fitToStage）。
      // 规则：**源数据 = 提纲/正文；渲染器 = 唯一真源**；h5_html 只是给服务端吐页用的快照，
      // 保存/发布时再落一次即可，画布不读它。
      // 修复（2026-09-12）：此前这里用**闭包里的旧 themeId** 渲染，而 setThemeId 在其之后才生效 →
      // 两份不同主题的 H5 草稿会渲染成一模一样（用户实测：国风/科技两版"完全一样"）。
      if (cwFormat === 'h5') {
        if (m.content) {
          // 拆静默（2026-09-13）：此前这里的异常被外层 `.catch(() => {})` 吞掉，
          // 结果是"H5 编辑页一片空白，且没有任何提示"（排查了整轮才定位）。现在显式暴露。
          try {
            const html = markdownToStorybookH5(m.content, {
              subject: m.subject || teaching.subject, grade: m.grade || gradeName,
              // 与课题名同口径剥掉存储后缀（2026-09-15）：素材名是 `课题名_课件`，
              // `_课件` 是存储约定，不该出现在 H5 顶部标题/封面上。
              title: (m.name || '').replace(/_课件$/, ''), teacherName: safeGetUser().name || '',
              themeId: effTheme, colorRoot: effColorRoot,
            })
            // 只在"渲染为空"时打印：这是"H5 编辑页空白"的直接判据（不抛错、只是没内容）
            if (!html) {
              console.error('[H5] markdownToStorybookH5 返回空 → 绘本无法显示。'
                + ' content 长度=' + (m.content || '').length
                + ' 开头=' + JSON.stringify((m.content || '').slice(0, 80)))
              toast('H5 绘本渲染为空（内容可能缺少可识别场景），已降级显示', 'error')
            }
            setCwH5Html(html || '')
          } catch (e: any) {
            console.error('[H5] markdownToStorybookH5 渲染失败（H5 绘本将无法显示）', e)
            toast('H5 绘本渲染失败：' + (e?.message || e), 'error')
          }
        }
      }
      setThemeId(effTheme)
      setColorRoot(effColorRoot)
    }).catch((e) => {
      // 拆静默（2026-09-13）：加载失败必须可见 —— 此前静默吞掉 → "页面空白且无任何线索"
      console.error('[课件加载] materialAPI.get 失败', e)
      toast('课件加载失败：' + (e?.message || e), 'error')
    }).finally(() => setCwLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // （课前问诊的拉取 effect 已随生成参数簇搬到 hooks/useCwGenParams.ts）

  // 进入任一课件频道默认文档模式：视频频道需文档模式才显示配置面板，PPT/H5 也围绕提纲；用户仍可手动切 AI 选知识点。
  // ★ 依赖只留 [cwFormat]：ctrl 每次渲染都是新对象，若放进依赖会导致每次渲染都强制 setWorkMode('doc')，
  //   用户点击「AI 模式」后立刻被此 effect 打回 doc（表现为模式按钮高亮但内容切不过去）。
  useEffect(() => { if (ctrl.workMode !== 'doc') ctrl.setWorkMode('doc') }, [cwFormat]) // eslint-disable-line react-hooks/exhaustive-deps

  // 版心比例：16:9（默认，投影标准）或 4:3（传统屏），预览与导出同步
  const [cwAr, setCwAr] = useState<'16/9' | '4/3'>('16/9')



  // ── 任教班级（班级切换联动）──
  // 准确性修正（2026-09-15）：班级名 ≠ 年级。此前左栏信息卡与封面信息条都拿 gradeName 顶替"班级"，
  // 于是显示成"班级：四年级"（教师看到的是年级值）。这里取教师本人任教班级里"当前选中"的那个，
  // 取不到就留空（信息卡显示"—"、封面信息条不出现该格）。
  const [myClasses, setMyClasses] = useState<MyClass[]>([])
  useEffect(() => { classAPI.myClasses().then(r => setMyClasses(r?.items || [])).catch(e => notifyError('班级列表加载失败', e)) }, [])
  // 选中班级 → 主班级兜底（2026-09-15）：课件编辑器**不在 AppLayout 里**（那层有"首次进入自动选中主班级"），
  // 所以这里必须自己兜底，否则班级永远是空的。规则与 AppLayout 一致：优先当前选中，其次主班级。
  const classLabel = (myClasses.find(it => it.class_id === teaching.selectedClassId)
    || myClasses.find(it => (it as { is_primary?: boolean }).is_primary)
    || myClasses[0])?.class_name || ''

  const cwOpts = () => ({
    subject: teaching.subject, grade: gradeName,
    // 课件标题（= 封面标题 / 每页页脚 / 保存进内容的 `#` 行）**不带 `_课件` 后缀**（2026-09-15）：
    // 素材名带后缀是为了在课件库里区分类型，但它此前一路渗进封面——教师看到封面写着
    // 「观潮 国风 09-15_课件」（H5 封面同样中招）。素材名仍在保存时另行拼接，故此处剥掉；
    // 用 replace 而非只改生成路径，是为了把**已存库的旧课件**打开时也纠正。
    title: genTitle.trim().replace(/_课件$/, ''),
    // 署名只写姓名：空则整段省略（此前回退成字面量"教师"，封面会印出「语文 · 四年级 · 教师」）
    teacherName: safeGetUser().name || '',
    theme: resolveTheme(themeId, colorRoot), aspect: cwAr,
    // 任教班级（2026-09-15 准确性修正）：班级名与年级是两回事，取不到就留空（封面上不出现该格），
    // 绝不拿年级顶替。此前左栏"班级"直接传 gradeName，教师看到"班级：四年级"。
    classLabel,
  })
  // ── 预览 / 放映（P0-1：已抽到 hooks/useCwPreview.ts；返回值沿用原名，调用点零改动）──
  // 必须放在 cwAr / cwOpts **之后**：hook 内的 useMemo 要在渲染期调用 cwOpts()，而 cwOpts() 读 cwAr。
  // 封面装饰（2026-09-17）：封面是渲染时合成的、不在 outline 内，教师给它换的素材存在存档
  // markdown 的 CW-COVER 注释里 → 这里是**唯一取值点**，画布/缩略图/放映/导出都从它取，
  // 避免多处各解析一遍导致口径分叉。（教师手动更换的入口见 ③：画布选中封面替换素材，随后接上。）
  const coverDecor = parseCoverDecor(cwMarkdown)

  const { docSlide, deckIdx, goToPage, cwThumbSlides, previewSlides } = useCwPreview({
    cwOutline, cwOpts,
    subject: teaching.subject, gradeName, title: genTitle, classLabel, themeId, colorRoot, aspect: cwAr,
    coverDecor,
  })

  // ── 装饰元件（P0-1：已抽到 hooks/useCwDecor.ts；返回值沿用原名，调用点零改动）──
  const {
    decorElems, decorScope, decorMedium, selDecor, setSelDecor, decorPickerOpen, setDecorPickerOpen,
    loadDecorElems, replaceDecorAt, aiDecorating, aiDecorSuggestions, fetchAiDecorSuggestions,
    smartMatchDecor, applyDecorSuggestion, applyAllDecorSuggestions,
  } = useCwDecor({
    docSlide, setCwOutline, contentLen: cwOutline.length, cwFormat, genStyleTag, tplAppliedIdRef: tplAppliedId,
  })

  // ── AI 生成课件 ──
  const handleGenCourseware = async (leftChatContext?: string) => {
    if (!genTitle.trim()) { toast('请填写课题名称', 'warning'); return }
    setGenLoading(true)
    setGenStage(null)
    setColorRoot('') // 新生成走 theme_id 兜底，清掉旧课件的 styleDNA
    try {
      const base = genBaseId ? await materialAPI.get(genBaseId).catch(() => null) : null
      const scope = buildKnowledgeScope(picker)
      const cats = Object.entries(edgeCats).filter(([, v]) => v).map(([k]) => k)
      const consultText = consultQuestions.length
        ? consultQuestions.map((q: any) => `· ${q.question} → ${consultAnswers[q.id] || '（未答）'}`).join('；')
        : ''
      const isH5 = cwFormat === 'h5'
      const res = await aiAPI.generateCoursewareStreaming({
        subject: teaching.subject, grade: gradeName, lesson_title: genTitle.trim(),
        content: (base as any)?.content || '', school_id: getSchoolId(),
        textbook_version: teaching?.currentTextbook?.() || '',
        // 教材版本**实体引用**（2026-09-13）：来自知识图谱节点自带的 version_id —— 与后端同源，
        // 可作为真实引用落库；此前只有版本**名称**（字符串），无法回答"按哪个版本解析的"。
        textbook_version_id: ((picker.selectedNodes[0] as any)?.version_id
          || (picker.knowledgeData.find((n: any) => n.version_id) as any)?.version_id || '') as string,
        textbook_unit: (picker.selectedUnit || (picker.selectedNodes[0] as any)?.unit || '') as string,
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
        style_tag: genStyleTag || undefined,
        style_profile: genStyleProfile.trim() || undefined,
        style_mode: genStyleTag ? 'preset' : (genStyleProfile.trim() ? 'free' : 'auto'),
        // 个人风格倾向（调节层）：教师一贯偏好，与小微对话同源（user.ai_style）。
        // 未显式选风格时作为默认倾向；已选风格时仅在不冲突前提下自然体现，不覆盖所选风格。
        teacher_style: (safeGetUser() as any)?.ai_style || undefined,
        format: isH5 ? 'h5' : 'ppt',
      },
      // 实时进度：让教师看到"第 2 次修订中"，而不是对着转圈干等 2~3 分钟
      (stage, message) => setGenStage({ stage, message }))
      // ── 先算出"本轮产物"，再统一落地 ──
      // 修复（2026-09-11）：此前 H5 在算出本轮 themeId/colorRoot 之前渲染，用的还是闭包旧值
      // → 生成后预览/发布仍是旧皮肤（"还是一个头面"的直接成因之一）。
      const md = res.courseware_markdown || ''
      // 生成配方（溯源）：接住服务端回传的 scope_resolved，随草稿一起落库（见 handleSaveDraft）
      // 统一形状：state 存"整个配方对象"（与从 gen_params 反解析出来的形状一致），
      // 避免生成态与加载态两种结构互相嵌套错位。
      setScopeResolved({ scope_resolved: res.scope_resolved ?? null })
      // 实时生成配色快照：后端按 学科/年级/风格 派生 styleDNA，优先于 theme_id 还原专属配色
      const nextColorRoot = res.color_palette ? JSON.stringify(res.color_palette) : ''
      // 风格模板（P1）：AI 生成后自动套用"最匹配模板"（风格+学段+学科多维匹配），无需教师再手动挑
      const styleEcho = (res.style_tag as StyleTag) || genStyleTag
      // 修复：模板须套在"本轮新提纲"上（此前误用旧 state cwOutline，导致模板套错对象）
      // 物化默认元素时带上本轮风格：title-body 等非结构化页此前绕开骨架，换风格完全无变化
      const nextOutlineBase = materializeOutline(markdownToOutline(md), styleEcho || styleKeyFromThemeId(themeId))
      // 多维匹配：风格优先，叠加学段/学科 facet（OR 语义），取首个命中模板自动套用
      const matches = getTemplates(
        cwFormat === 'video' ? 'h5' : cwFormat,
        {
          styles: styleEcho ? [styleEcho] : undefined,
          stages: [gradeToStageTag(teaching.grade)],
          subjects: subjectToTag(teaching.subject) ? [subjectToTag(teaching.subject)!] : undefined,
        },
      )
      const autoTpl = matches[0] || (styleEcho ? PPT_TEMPLATES.find(t => templateStyleTags(t).includes(styleEcho)) : undefined)
      let nextOutline = nextOutlineBase
      let nextThemeId = themeId
      if (autoTpl) {
        const r = applyTemplate(nextOutlineBase, autoTpl, themeId, { stage: gradeToStage(teaching.grade), subject: teaching.subject })
        nextOutline = r.outline
        nextThemeId = r.themeId
        noteTemplateApplied(autoTpl.id, r.prevThemeId, r.prevLayouts)
      }
      if (styleEcho) nextThemeId = defaultThemeForStyle(styleEcho) // 风格强制优先于模板 theme（保持一致）
      // H5 频道：用本轮确定的 nextThemeId/nextColorRoot 渲染（预览/发布均直接使用）
      const nextH5Html = isH5 && md
        ? markdownToStorybookH5(md, {
            subject: teaching.subject, grade: gradeName, title: genTitle.trim(),
            teacherName: safeGetUser().name || '教师', themeId: nextThemeId,
            colorRoot: nextColorRoot,
          })
        : ''
      // 统一落地状态（一次性提交本轮产物）
      setCwMarkdown(md)
      setCwOutline(nextOutline)
      setColorRoot(nextColorRoot)
      setThemeId(nextThemeId)
      setCwH5Html(nextH5Html)
      setCwDivergence(Array.isArray(res.divergence_map) ? res.divergence_map : [])
      setRemovedDivergence({})
      setCwSimilar(res.similar_material || null)
      setValidateIssues(null)
      ctrl.setWorkMode('doc')
      // 标记"本轮是系统生成" → effect 会**自动保存为一稿草稿**并形成 `AI 生成（一稿）` 版本
      pendingGenSave.current = true
      toast('课件已生成并自动套用推荐模板，可在右侧编辑提纲', 'success')
    } catch (e: any) { toast('AI 生成失败: ' + (e.message || '未知错误'), 'error') }
    finally { setGenLoading(false); setGenStage(null) }
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
      setCwOutline(materializeOutline(markdownToOutline(r.trimmed_markdown || cwMarkdown), styleKeyFromThemeId(themeId)))
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
  // 当前页手动挂互动组件（互动态，永久未保存标记）
  const setSlideInteractive = (i: number, it: H5Component | null) => {
    setCwOutline(arr => arr.map((s, k) => k === i ? { ...s, interactive: it } : s))
    ctrl.touch()
  }
  // 当前页写入互动组件数组（可视化拖拽编辑器：每页可多组件、可排序）
  const setSlideInteractives = (i: number, its: H5Component[]) => {
    setCwOutline(arr => arr.map((s, k) => k === i ? { ...s, interactive: its } : s))
    ctrl.touch()
  }
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
  // slideIndex 为 slides（outlineToSlides 含封面，index 0 = 封面）的索引，映射回 cwOutline 需 -1
  const handleDocSlideChange = (slideIndex: number, slide: CwSlide) =>
    setCwOutline(arr => arr.map((s, k) => (k === slideIndex - 1 ? { ...s, title: slide.title, elements: slide.elements, layout: slide.layout, decor: slide.decor ?? null } : s)))

  // AI 润色提纲（render-ppt：精炼要点 + 讲稿）
  const polishOutline = async () => {
    if (!cwOutline.length) { toast('请先生成课件', 'warning'); return }
    setPolishing(true)
    try {
      const md = outlineToMarkdown(cwOutline, cwOpts())
      const r: any = await aiAPI.renderPptCourseware({
        markdown: md, title: `${genTitle.trim()}_课件`, subject: teaching.subject, grade: gradeName,
        style_tag: genStyleTag || undefined,
        theme_id: themeId,
      })
      // 润色只改内容、不改版式：以原 outline 的 layout 为骨架，用润色后的 bullets 重新分发 slots
      const polished = pptToOutline(r.ppt_slides || [])
      const out = materializeOutline(cwOutline.map((s, i) => {
        const p = polished[i]
        if (!p) return s
        const layout = s.layout || 'title-body'
        const slots = layout.startsWith('edu-') ? distributeToSlots(layout as any, p.bullets) : s.slots
        return { ...s, title: p.title, bullets: p.bullets, slots }
      }, styleKeyFromThemeId(r.theme_id || themeId)))
      if (r.theme_id) setThemeId(r.theme_id)
      if (r.color_palette) setColorRoot(JSON.stringify(r.color_palette))
      if (out.length) { setCwOutline(out); setCwMarkdown(md); toast('提纲已 AI 润色（含讲稿）', 'success') }
      else toast('润色未返回内容', 'warning')
    }     catch (e: any) { toast('润色失败: ' + (e.message || '未知错误'), 'error') }
    finally { setPolishing(false) }
  }

  // 视频课件（路径α）：调用 AI 真实生成分镜脚本，写入提纲画布（左栏分镜即视频脚本）
  const genVideoScript = async () => {
    const md = cwOutline.length ? outlineToMarkdown(cwOutline, cwOpts()) : cwMarkdown
    if (!md.trim()) { toast('请先生成课件内容', 'warning'); return }
    setGenVideo(true)
    try {
      const r: any = await aiAPI.generateVideoScript({
        markdown: md, title: genTitle.trim() || '视频课件', subject: teaching.subject, grade: gradeName,
      })
      const shots = r.video_script || []
      if (!shots.length) { toast('分镜未返回内容', 'warning'); return }
      const out: OutlineSlide[] = shots.map((s: any, i: number) => ({
        title: s.title || `镜头${i + 1}`,
        bullets: [
          `🎙 ${s.narration || ''}`,
          `🎬 ${s.visual || ''}`,
          s.duration_s ? `⏱ ${s.duration_s}s` : '',
        ].filter(Boolean),
        notes: s.narration || '',
      }))
      setCwOutline(out); setCwMarkdown(md); ctrl.touch()
      toast(`已生成 ${out.length} 个视频分镜（程序化画面合成待 token 平权）`, 'success')
    } catch (e: any) { toast('生成分镜失败: ' + (e.message || '未知错误'), 'error') }
    finally { setGenVideo(false) }
  }

  // 导出

  const exportCwPptx = async () => {
    if (!cwOutline.length) { toast('课件内容为空', 'warning'); return }
    try { await exportCoursewareToPptx(outlineToSlides(cwOutline, cwOpts(), coverDecor), cwOpts()) }
    catch (e: any) { toast('PPT 导出失败: ' + (e.message || '未知错误'), 'error') }
  }
  const exportCwDocx = async () => {
    if (!cwOutline.length) { toast('课件内容为空', 'warning'); return }
    const blob = await exportLessonPlanToDocx(outlineToMarkdown(cwOutline, cwOpts()), { subject: teaching.subject, grade: gradeName, title: genTitle.trim().replace(/_课件$/, ''), teacher: safeGetUser().name || '', model: 'qwen-plus' })
    downloadBlob(blob, `${genTitle.trim()}_${teaching.subject}${gradeName}.docx`)
  }
  const exportCwPdf = () => {
    if (!cwOutline.length) { toast('课件内容为空', 'warning'); return }
    printLessonPlan(outlineToMarkdown(cwOutline, cwOpts()), { subject: teaching.subject, grade: gradeName, title: genTitle.trim().replace(/_课件$/, ''), teacherName: safeGetUser().name || '' })
  }
  // H5 互动课件：直接消费与 PPT 同源的提纲 OutlideSlide[]，首段作封面、其余为内容页。
  // 手动互动插槽优先：若某页有合法 interactive 用真互动；否则 notes 兜底 reveal；否则纯内容页。
  const buildH5Slides = (): H5Slide[] => {
    if (!cwOutline.length) return []
    return cwOutline.map((s, i) => {
      const bs = s.elements && s.elements.length ? extractBullets(s.elements) : (s.bullets || [])
      const interactiveArr = normalizeInteractive(s.interactive)
      const interactive: H5Component[] | null = interactiveArr.length
        ? interactiveArr
        : (s.notes ? [{ type: 'reveal', prompt: '点击揭示：教师讲解要点', answer: s.notes }] : null)
      return {
        title: s.title,
        points: bs,
        body: '',
        isTitle: i === 0,
        interactive,
        decor: s.decor || null,
      }
    })
  }
  const exportCwH5 = () => {
    if (!cwOutline.length) { toast('课件内容为空', 'warning'); return }
    try {
      const slides = buildH5Slides()
      // 零依赖红线：检测个人素材（user_upload 标记 → 需联网，离线打开失效）
      const haystack = (cwH5Html || '') + '\n' + JSON.stringify(slides) + '\n' + JSON.stringify(cwOutline)
      const hasPersonal = /personal:\/\/|user-upload\/|u-teacher\/assets\/personal/i.test(haystack)
      const blob = exportH5Courseware(slides, {
        subject: teaching.subject, grade: gradeName, title: `${genTitle.trim()}_课件`,
        teacherName: safeGetUser().name || '教师',
        autoPlay: true,
        autoPlayInterval: 8,
        // 个人素材标注：导出 HTML 顶部注入提示（离线打开需联网）
        personalAssetsNote: hasPersonal ? '本课件含个人素材，离线打开需联网加载' : undefined,
      })
      downloadBlob(blob, `${genTitle.trim()}_${teaching.subject}${gradeName}.html`)
      if (hasPersonal) toast('已导出：含个人素材，离线打开需联网', 'warning')
      else toast('H5 互动课件已生成并下载', 'success')
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

  // ── 保存 / 发布（P0-1：已抽到 hooks/useCwSave.ts；返回值沿用原名，调用点零改动）──
  // 保存/发布操作的是"当前文档快照"，故用惰性 getDoc() 取数 —— 顺带打破
  // handleSaveDraft → cwVer → ctrl → handleSaveDraft 的循环依赖（详见 hook 文件头注释）。
  const { savingCw, pendingGenSave, handleSaveDraft, handlePublish } = useCwSave({
    getDoc: () => ({
      genTitle, cwExtra, genStyleTag, genStyleProfile, divergenceLevel, edgeEnabled, edgeCats,
      cwOutline, cwMarkdown, cwH5Html, cwDivergence, scopeResolved, themeId, colorRoot, videoConfig,
      cwFormat, subject: teaching.subject, gradeName, textbookName: teaching.currentTextbook(),
      picker, materialId, draftKey: getDraftKey(materialId), cwOpts,
      cwVer, ctrl,   // 二者声明在本调用点之后 → 靠惰性取值避开 TDZ（只在保存/发布发生时才读）
    }),
    setMaterialId, setValidating, setValidateIssues, setH5Qr,
  })

  ctrl = useEditorController({
    // 触发来源决定版本粒度：点击保存 → 1 分钟合并窗口；自动保存 → 3 分钟节流（见 lib/versionPolicy.ts）
    onAutoSave: () => handleSaveDraft({ trigger: 'auto' }),
    onSaveDraft: () => handleSaveDraft({ trigger: 'click' }),
    onPublish: handlePublish,
  })

  // 批注 / 版本快照：课件按页锚定（page:N，N=当前 docSlide+1）；发布定版后只读禁存/禁恢复
  const cwLocked = ctrl.status === 'active'
  // 新建未保存时用本地草稿 ID 作为批注锚点，保存后自动落到真实 materialId
  const cwAnnTargetId = materialId || getDraftKey(materialId)
  const cwAnn = useAnnotations('material', cwAnnTargetId)
  const cwVer = useVersions('material', cwAnnTargetId, cwLocked)
  // H5 扫码分享：播放/预览态右栏二维码（有 materialId 才生成；未发布时提示先发布）
  useEffect(() => {
    let alive = true
    if (cwFormat !== 'h5' || !materialId) { setH5ShareQr(null); return }
    const url = `${window.location.origin}/api/materials/${materialId}/h5`
    QRCode.toDataURL(url, { width: 220, margin: 1 })
      .then((d: string) => { if (alive) setH5ShareQr({ url, dataUrl: d }) })
      .catch(() => { if (alive) setH5ShareQr(null) })
    return () => { alive = false }
  }, [cwFormat, materialId])
  const [cwHistoryVisible, setCwHistoryVisible] = useState(true)
  // ── 导出下拉（P0-1：已抽到 hooks/useCwExport.ts；返回值沿用原名，调用点零改动）──
  const { exportMenuOpen, setExportMenuOpen, exportSel, setExportSel, exportMenuRef } = useCwExport()
  // 全屏编辑：隐藏左右栏与发散/校验，最大化画布
  const [cwFullscreen, setCwFullscreen] = useState(false)
  // 全屏默认收起批注/版本栏（2026-09-14）：全屏的定位是"精修"，240px 边栏让位给画布
  // （实测：收起后全屏画布由 1120×630 提升到约 1280×720）。退出全屏时还原进入前的状态。
  // 不改共享状态语义 —— 既有的「批注 / 版本」按钮在全屏内照常可展开。
  const histBeforeFs = useRef(true)
  useEffect(() => {
    if (cwFullscreen) { histBeforeFs.current = cwHistoryVisible; setCwHistoryVisible(false) }
    else setCwHistoryVisible(histBeforeFs.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwFullscreen])
  // 全屏默认**收起**缩略图栏（2026-09-14）：全屏的定位是"精修/审阅"，该让位给画布 ——
  // 此前默认展开，170px 被缩略图吃掉，实测全屏画布反而比非全屏小（950 vs 960 宽）。
  const [cwFsThumb, setCwFsThumb] = useState(false)
  // 缩略图数据（2026-09-14）：真实缩略图必须与画布**同源**，否则又变成"缩略图≠画布"。
  // outlineToSlides 会在最前插入封面页 → 索引 = 提纲页 +1。
  // （cwThumbSlides 已随预览簇搬到 hooks/useCwPreview.ts）

  // （小微「换风格 / 恢复上一个风格」指令的接收端已随模板簇搬到 hooks/useCwTemplate.ts）


  // 系统生成 → **自动成为一稿草稿**（产品规则 2026-09-15：生成并显示到屏幕上就该是一稿）。
  // 用 effect 而不是在生成函数里直接存：生成函数里刚 setState 的 themeId/colorRoot 尚未生效，
  // 直接调用会把**旧主题**写进草稿；effect 在状态提交后运行，拿到的是新值。
  useEffect(() => {
    if (!pendingGenSave.current || !cwOutline.length) return
    pendingGenSave.current = false
    void handleSaveDraft({ trigger: 'gen' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwOutline])

  // H5 派生链补齐（2026-09-15）：H5 画布 = `iframe(srcDoc=cwH5Html)`，而这份 HTML 是**派生**的
  // 标题用「课题名」而非素材名（2026-09-15 修）：此前传 `${genTitle}_课件`，`_课件` 是**存储命名约定**，
  // 会印在 H5 顶部标题与封面上（教师看到"观潮 国风 09-15_课件"这种带后缀的标题）。
  // （markdown → markdownToStorybookH5），此前只在「载入 / 生成 / 发布」三处计算 —— 于是
  // **在 H5 模式改大纲 / 换风格 / 回退版本，画布都不刷新**（PPT 不受影响：它直接从 outline 渲染）。
  // 发布侧其实早已知晓这一点（见 handlePublish 注释"不复用可能过期的 cwH5Html"），
  // 这里把同一套重算补到**编辑预览**上，让"版本回退"在 H5 上同样立刻可见。
  const h5DeriveSkippedFirst = useRef(false)
  useEffect(() => {
    if (cwFormat !== 'h5' || !cwOutline.length) return
    // 首次（刚载入/刚生成）跳过：那两处已经算过，避免用 outline 往返覆盖载入路径的结果
    if (!h5DeriveSkippedFirst.current) { h5DeriveSkippedFirst.current = true; return }
    const id = setTimeout(() => {
      try {
        const md = outlineToMarkdown(cwOutline, cwOpts())
        setCwH5Html(markdownToStorybookH5(md, {
          subject: teaching.subject, grade: gradeName, title: genTitle.trim(),
          teacherName: safeGetUser().name || '教师', themeId, colorRoot,
        }) || '')
      } catch (e: any) {
        console.error('[H5] 重渲染失败（沿用上一版画面）', e)
      }
    }, 600)   // 防抖：连续编辑不必每键重算
    return () => clearTimeout(id)
    // 依赖必须含 cwOpts() 的全部输入（2026-09-17 修）：此前漏了学科/年级/课题名/班级/版心，
    // 于是**改课题名或班级后 H5 画布与草稿里的 h5_html 不会重算** —— 手机扫码仍是旧标题/旧署名。
    // 这与 2026-09-15 修 previewSlides 是同一个病：派生点分散在 4 处，当初只补齐了其中几处。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwOutline, cwFormat, themeId, colorRoot, teaching.subject, gradeName, genTitle, classLabel, cwAr])
// 全屏态下批注栏收展与编辑态共用 cwHistoryVisible，避免双状态不一致
  useEffect(() => {
    if (!cwFullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCwFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cwFullscreen])
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
    <CwLeftPanel
      gen={genParams}
      genState={{ loading: genLoading, stage: genStage, similar: cwSimilar, onGenerate: handleGenCourseware }}
      workMode={ctrl.workMode}
      teaching={teaching}
      gradeName={gradeName}
      classLabel={classLabel}
      picker={picker}
      materials={materials}
      scopeResolved={scopeResolved}
      pageCount={cwOutline.length}
      onLeftApply={handleLeftApply}
    />
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
  // H5 互动排序的传感器：**必须在组件顶层调用**（2026-09-15 修白屏）。
  // 此前这两行写在 `{!ctrl.readOnly && cwFormat === 'h5' && (() => { ... })()}` 这个 JSX IIFE 里 ——
  // 查看态不执行、切到编辑态才执行 ⇒ hook 数量在两次渲染间变化 ⇒ React #310
  // （"Rendered more hooks than during the previous render"）→ **整页白屏**
  // （用户实测：H5 列表点入预览，再点「编辑」就空白页）。
  const h5Sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const rightPanelDoc = (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FAFAFA] relative">
      {cwFormat === 'h5' && (
        <div className="shrink-0 px-3 py-2 bg-[#F0FBF4] border-b border-[#B7EBC8] text-[12px] text-[#1A7F48]">
          H5 可视化编辑器已启用：从「+ 互动」拖入组件、拖动卡片排序、点击编辑。改动随课件导出为投屏 H5，手机扫码可交互查看。
        </div>
      )}
      {/* 编辑态文档模式：本页互动挂接（仅编辑态可见；查看态预览只只读渲染，不显示此编辑条） */}
      {!ctrl.readOnly && cwFormat === 'h5' && (() => {
        const curIdx = docSlide
        const comps = normalizeInteractive(cwOutline[curIdx]?.interactive)
        const sensors = h5Sensors   // 顶层已调用（hook 不能在条件/IIFE 里）
        const onDragEnd = (e: DragEndEvent) => {
          const { active, over } = e
          if (over && active.id !== over.id) {
            const oldI = comps.findIndex(c => (c as any).__id === active.id)
            const newI = comps.findIndex(c => (c as any).__id === over.id)
            if (oldI >= 0 && newI >= 0) setSlideInteractives(curIdx, arrayMove(comps, oldI, newI))
          }
        }
        const SortableCard = ({ comp, idx }: { comp: H5Component; idx: number }) => {
          const id = (comp as any).__id || `c${idx}`
          const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
          const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
          const meta = INTERACTIVE_META.find(m => m.type === comp.type)
          return (
            <div ref={setNodeRef} style={style}
              className={`flex items-start gap-2 rounded border border-[#E7E7EB] bg-white p-2 ${editingItIdx === idx ? 'ring-1 ring-[#FA8C16]' : 'hover:border-[#FA8C16]'}`}>
              <button {...attributes} {...listeners} className="cursor-grab text-[#C0C0C0] hover:text-[#FA8C16] select-none mt-0.5" title="拖动排序">⠿</button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[13px]">{meta?.icon}</span>
                  <span className="text-[12px] font-medium text-[#353535]">{meta?.label || comp.type}</span>
                </div>
                {editingItIdx === idx
                  ? <InteractiveForm value={comp} onChange={it => { const n = comps.slice(); n[idx] = it; setSlideInteractives(curIdx, n) }} locked={cwLocked} />
                  : <p className="text-[11px] text-[#9A9A9A] truncate">{interactiveSummary(comp)}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => setEditingItIdx(editingItIdx === idx ? -1 : idx)} className="px-1.5 py-0.5 text-[11px] text-[#02A7F0] border border-[#CFEFFB] rounded hover:bg-[#F0FAFE]">{editingItIdx === idx ? '收起' : '编辑'}</button>
                <button onClick={() => setSlideInteractives(curIdx, comps.filter((_, k) => k !== idx))} className="px-1.5 py-0.5 text-[11px] text-[#E15C5C] border border-[#F6D6D6] rounded hover:bg-[#FDF0F0]">删除</button>
              </div>
            </div>
          )
        }
        return (
          <div className="shrink-0 border-b border-[#E7E7EB] bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-[#353535]">本页互动组件（H5 投屏/扫码生效，可多组件）</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setInteractivePickerOpen(o => !o)} className="px-2.5 py-1 text-[12px] text-white bg-[#FA8C16] rounded hover:bg-[#E67E00]">+ 互动</button>
                {comps.length > 0 && (
                  <button onClick={() => setSlideInteractives(curIdx, [])} className="px-2 py-1 text-[12px] text-[#9A9A9A] border border-[#E7E7EB] rounded hover:bg-[#F6F7F8]">清空</button>
                )}
              </div>
            </div>
            {interactivePickerOpen && (
              <div className="flex flex-wrap gap-2 mb-3 p-2 bg-[#FAFBFC] rounded">
                {INTERACTIVE_META.map(m => (
                  <button key={m.type} title={m.hint} onClick={() => { setSlideInteractives(curIdx, [...comps, { ...defaultInteractive(m.type), __id: `c${Date.now()}-${Math.random().toString(36).slice(2, 6)}` } as any]); setInteractivePickerOpen(false) }}
                    className="flex flex-col items-center w-[88px] p-2 rounded border border-[#E7E7EB] hover:border-[#FA8C16] hover:bg-[#FFF7EF]">
                    <span className="text-[18px]">{m.icon}</span>
                    <span className="text-[11px] text-[#353535] mt-1">{m.label}</span>
                  </button>
                ))}
              </div>
            )}
            {comps.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={comps.map((c, i) => (c as any).__id || `c${i}`)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {comps.map((c, i) => <SortableCard key={(c as any).__id || `c${i}`} comp={c} idx={i} />)}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-[11px] text-[#C0C0C0]">未挂互动。点「+ 互动」选择一种（点击揭示/选择题/音频/视频/图册/弹层/点读），内容将随课件导出为 H5 投屏课件，手机扫码可交互查看。</p>
            )}
          </div>
        )
      })()}
      {/* 顶部统一工具条：非全屏与全屏编辑态复用同一套按钮（含模板库入口），仅容器形态不同 */}
      {renderToolbar(false)}

      {/* 主体三栏：左缩微页 / 中画布 / 右批注，顶端齐平 */}
      <div className="flex-1 flex min-h-0 relative">
        {/* 缩略图页管理（可收起，腾讯文档范式） */}
        {!thumbCollapsed && (
          <CwPageList
            className="w-44 shrink-0 overflow-y-auto border-r border-[#E7E7EB] bg-white p-2 space-y-2"
            slides={cwThumbSlides} deckIdx={deckIdx} onSelect={goToPage}
            theme={resolveTheme(themeId, colorRoot)} aspect={cwAr}
            editable pageCount={cwOutline.length} onMove={moveCwPage} onDelete={deleteCwPage}
          />
        )}
        {thumbCollapsed && (
          <button onClick={() => setThumbCollapsed(false)} title="展开页列表"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-30 w-6 h-14 rounded-r-md bg-[#212529]/85 text-white flex items-center justify-center hover:bg-[#212529] text-[14px] shadow-md">›</button>
        )}

        {/* 中：可编辑画布 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex justify-center">
        {cwFormat === 'video' && (
          <div className="mb-3 rounded-[6px] border border-[#B7EB8F] bg-[#F6FFED] p-3">
            <div className="text-[12px] font-medium text-[#389E0D] mb-2">🎬 视频课件配置（参数预留；点「AI 生成视频分镜」产出语义分镜脚本）</div>
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
            slides={outlineToSlides(cwOutline, cwOpts(), coverDecor)}
            theme={resolveTheme(themeId, colorRoot)}
            // 封面页（整本索引 0）**不可编辑元素**（2026-09-15）：封面文字由左栏字段驱动，
            // 若允许在封面上加文本框/图片，会错落到正文第 1 页（索引映射），故封面只读查看。
            editable={deckIdx !== 0}
            index={deckIdx}
            onIndexChange={(si) => goToPage(si)}
            onSlideChange={handleDocSlideChange}
            aspectRatio={cwAr}
            embedFullscreen={true}
            onSelectDecor={(sel) => setSelDecor(sel)}
            onReplaceDecor={(sel) => { setSelDecor(sel); if (!decorElems.length) loadDecorElems('public'); setDecorPickerOpen(true) }}
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

        {/* 批注 / 版本（已抽为共用组件 CwAnnotationsPanel，编辑态浮层） */}
        {cwHistoryVisible && (
          <CwAnnotationsPanel
            className="absolute right-0 top-0 bottom-0 w-[220px] border-l border-[#E7E7EB] bg-[#FAFBFC] flex flex-col z-20 overflow-hidden shadow-lg"
            onCollapse={() => setCwHistoryVisible(false)}
            cwAnn={cwAnn} cwVer={cwVer} cwAnnTargetId={cwAnnTargetId} cwLocked={cwLocked}
            materialId={materialId} cwOutline={cwOutline} setCwOutline={setCwOutline}
            deckIdx={deckIdx} docSlide={docSlide}
            />
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
  // （previewSlides 已随预览簇搬到 hooks/useCwPreview.ts）
  const previewSlideElems = (() => {
    if (cwFormat === 'h5' && cwH5Html) {
      return (
        <div className="w-full h-full bg-[#F5F5F5] rounded overflow-hidden">
          <iframe
            title="H5 绘本预览"
            srcDoc={cwH5Html}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            // 画布 = 课堂投屏的等比例预览（2026-09-15）：HD 舞台在窄窗格里靠视口宽度判不出来
            // （编辑器画布通常 <1024px），故由父级显式开启，保证"画布看到的比例 = 教室大屏的比例"。
            onLoad={(e) => { try { e.currentTarget.contentWindow?.postMessage({ type: 'cw-h5-hd', on: true }, '*') } catch { /* noop */ } }}
          />
        </div>
      )
    }
    if (previewSlides && previewSlides.length > 0) {
      // 预览/放映按**整本**索引（2026-09-15 修）：outlineToSlides 会在这份课件前自动插入**封面页**（slides[0]）。
      // 此前这里用 `index={docSlide + 1}`，而 docSlide 是 outline（不含封面）的下标 →
      // 索引被顶到 slides[1]，**封面永远到不了**：教师进预览看到的第一页是"学习目标"，
      // 于是反馈"为什么 PPT 没有封面"（导出的 PPTX 里却有 —— 所见 ≠ 所导出）。
      // 改为独立的整本索引 deckIdx（0 = 封面），并同步回 docSlide 供批注/互动等按页逻辑使用。
      return <PptxPreview slides={previewSlides} theme={resolveTheme(themeId, colorRoot)} showPager={false} index={deckIdx}
        onIndexChange={(si) => goToPage(si)} viewMode="single" autoPlay />
    }
    return <div className="text-center py-16 text-[13px] text-[#9A9A9A]">课件内容为空</div>
  })()
  const previewPane = (
    <CwPreviewPane
      cwFormat={cwFormat} cwH5Html={cwH5Html}
      previewSlides={previewSlides} cwOutline={cwOutline}
      deckIdx={deckIdx} onSelect={goToPage}
      buildH5Slides={buildH5Slides}
      slideElems={previewSlideElems}
      showShare={cwFormat === 'h5' && (effectivePreviewOpen || ctrl.readOnly)}
      h5ShareQr={h5ShareQr}
      ann={{ cwAnn, cwVer, cwAnnTargetId, cwLocked, materialId, cwOutline, setCwOutline, deckIdx, docSlide }}
    />
  )

  // 模板库面板（PPT / H5 共用）：抽出为函数，非全屏态与全屏编辑态共用同一份逻辑与状态
  // fixed=true 时用于全屏编辑顶栏（面板 fixed 到屏幕右上），否则 absolute 贴着触发按钮
  function renderTemplatePanel(fixed = false) {
    return (<div className={fixed ? 'relative' : 'relative'}>
      <button onClick={() => setTplPanelOpen(v => !v)} title="模板库"
        className={`px-2.5 py-1.5 text-[12px] border rounded flex items-center gap-1 ${tplPanelOpen || tplAppliedId.current ? 'text-[#02A7F0] border-[#02A7F0] hover:bg-[#E8F7FF]' : 'text-[#353535] border-[#E7E7EB] hover:bg-white'}`}>
        <Shapes size={13} /> 模板{tplAppliedId.current ? '✓' : ''}
      </button>
      {/* 装饰入口已下沉为：选中画布上的装饰元素 → 工具条「替换/删除」按钮 → 打开素材库装饰元件。
          顶部不再保留独立装饰按钮，避免与模板入口并列导致「装饰是另一个模板」的误读。 */}
      {tplPanelOpen && (
        <div className={`${fixed ? 'fixed top-12 right-3 z-[60]' : 'absolute right-0 top-9 z-50'} w-[340px] max-h-[440px] overflow-y-auto bg-white border border-[#E7E7EB] rounded-lg shadow-2xl p-3`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-medium text-[#353535]">课件模板库</span>
            {tplAppliedId.current && (
              <button onClick={undoTemplateApply} className="text-[11px] text-[#F5222D] hover:underline">撤销套用</button>
            )}
          </div>
          {/* ★ 聚类标签：风格/色系可多选（OR 语义），替代互斥分类导航 */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#9A9A9A]">风格（可多选）</span>
              {tplStyleTags.length > 0 && <button onClick={() => setTplStyleTags([])} className="text-[10px] text-[#02A7F0] hover:underline">清空</button>}
            </div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(STYLE_LABELS) as StyleTag[]).filter(s => s !== 'basic').map(s => {
                const on = tplStyleTags.includes(s)
                return (
                  <button key={s} onClick={() => setTplStyleTags(prev => on ? prev.filter(x => x !== s) : [...prev, s])}
                    className={`px-2 py-0.5 rounded-full text-[11px] border ${on ? 'bg-[#02A7F0] text-white border-[#02A7F0]' : 'bg-white text-[#666] border-[#E7E7EB] hover:border-[#02A7F0]'}`}>{STYLE_LABELS[s]}</button>
                )
              })}
            </div>
          </div>
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#9A9A9A]">色系（可多选）</span>
              {tplColorTags.length > 0 && <button onClick={() => setTplColorTags([])} className="text-[10px] text-[#02A7F0] hover:underline">清空</button>}
            </div>
            <div className="flex flex-wrap gap-1">
              {COLOR_FAMILIES.map(f => {
                const on = tplColorTags.includes(f.id)
                return (
                  <button key={f.id} onClick={() => setTplColorTags(prev => on ? prev.filter(x => x !== f.id) : [...prev, f.id])}
                    className={`px-2 py-0.5 rounded-full text-[11px] border flex items-center gap-1 ${on ? 'bg-[#02A7F0] text-white border-[#02A7F0]' : 'bg-white text-[#666] border-[#E7E7EB] hover:border-[#02A7F0]'}`}>
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: f.swatch }} />{f.label}
                  </button>
                )
              })}
            </div>
          </div>
          {/* 模板列表：按聚类标签 OR 过滤（风格与色系各自 OR，组间 AND） */}
          {(function () {
            const pool = cwFormat === 'h5' ? H5_TEMPLATES : PPT_TEMPLATES
            const filtered = pool.filter(t => {
              const styleHit = tplStyleTags.length === 0 || templateStyleTags(t).some(s => tplStyleTags.includes(s))
              const colorHit = tplColorTags.length === 0 || templateColorTags(t).some(c => tplColorTags.includes(c))
              return styleHit && colorHit
            })
            return (
              <div className="grid grid-cols-2 gap-2">
                {filtered.map(t => {
                  const cost = t.id.startsWith('lib-') ? getLibraryCostMeta(t.id.slice(4)) : undefined
                  const costLabel = cost
                    ? (cost.base_cost > 0 ? `· ${cost.base_cost} token` : '· 官方免费')
                    : ''
                  const styleLabels = templateStyleTags(t).map(s => STYLE_LABELS[s]).join('·')
                  return (
                    <button key={t.id} onClick={() => applyTemplateEntry(t, `已套用模板：${t.name}`)} className={`text-left rounded border overflow-hidden ${tplAppliedId.current === t.id ? 'border-[#02A7F0] ring-1 ring-[#02A7F0]' : 'border-[#E7E7EB] hover:border-[#02A7F0]'}`}>
                      <img src={renderTemplateThumb(t)} alt={t.name} className="w-full h-[72px] object-cover bg-[#F2F3F5]" />
                      <div className="p-1.5">
                        <div className="text-[12px] font-medium text-[#353535] truncate">{t.name}</div>
                        <div className="text-[10px] text-[#999] mt-0.5">{styleLabels} · {t.layouts ? Object.keys(t.layouts).length : 0} 版式{costLabel}</div>
                      </div>
                    </button>
                  )
                })}
                {filtered.length === 0 && (
                  <p className="col-span-2 text-[11px] text-[#999] text-center py-4">无匹配模板，试试减少标签或切换「通用结构」</p>
                )}
                {/* 通用结构（结构 × 色系自由组合）始终可见 */}
                {COLOR_FAMILIES.map(f => {
                  const applied = tplAppliedId.current === `basic-${f.id}`
                  return (
                    <button key={`basic-${f.id}`} onClick={() => applyFamilyEntry(f)} className={`text-left rounded border overflow-hidden ${applied ? 'border-[#02A7F0] ring-1 ring-[#02A7F0]' : 'border-[#E7E7EB] hover:border-[#02A7F0]'}`}>
                      <img src={renderFamilyThumb(f)} alt={f.label} className="w-full h-[72px] object-cover bg-[#F2F3F5]" />
                      <div className="p-1.5">
                        <div className="text-[12px] font-medium text-[#353535] truncate">通用 · {f.label}</div>
                        <div className="text-[10px] text-[#999] mt-0.5">结构 × 色系 · {Object.keys(BASIC_TEMPLATE.layouts).length} 版式</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}
    </div>)
  }

  // 装饰入口已下沉到画布选中态（待实现：选中装饰元素 → 工具条「替换/删除」按钮 → 替换弹层打开素材库装饰元件）。
  // 底层能力保留：loadDecorElems / addDecorToCurrentSlide / removeDecorFromCurrentSlide，状态 decorElems / decorScope / decorMedium / decorSlot 待第二步接入。
  // 仅 fullscreen 态把「全屏」按钮替换为「退出全屏」并隐藏增/删页的页列表操作（全屏态无独立页列表栏）。
  // 模板库入口统一走 renderTemplatePanel（同一逻辑 / 同一份状态）。
  function renderToolbar(fullscreen = false) {
    return (<div className={`h-10 shrink-0 flex items-center gap-2 px-3 border-b border-[#EFEFEF] bg-white ${fullscreen ? 'flex-1 min-w-0' : 'w-full'}`}>
      {!fullscreen && (
        <>
          <span className="text-[11px] font-medium text-[#353535]">页面（{cwOutline.length}）</span>
          <button onClick={addCwPage} className="px-1.5 py-0.5 text-[11px] text-[#02A7F0] border border-[#02A7F0] rounded hover:bg-[#E8F7FF]">+ 页</button>
          <button onClick={() => setThumbCollapsed(true)} title="收起页列表" className="px-1 py-0.5 text-[11px] text-[#9A9A9A] hover:text-[#353535]">‹</button>
          <div className="w-px h-4 bg-[#EEE]" />
        </>
      )}
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
        <button onClick={genVideoScript} disabled={genVideo}
          className="px-2.5 py-1 text-[12px] text-[#52C41A] border border-[#52C41A] rounded-[4px] hover:bg-[#F6FFED] disabled:opacity-50 flex items-center gap-1">
          {genVideo ? <><Loader2 size={13} className="animate-spin" /> 生成分镜…</> : '🎬 AI 生成视频分镜'}
        </button>
      )}
      <select value={cwAr} onChange={(e) => setCwAr(e.target.value as '16/9' | '4/3')}
        className="px-2 py-1 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] bg-white hover:bg-[#F7F7F8]" title="版心比例">
        <option value="16/9">16:9</option>
        <option value="4/3">4:3</option>
      </select>
      {!fullscreen && <div className="flex-1" />}
      {/* 批注 / 版本（两种形态一致） */}
      <button onClick={() => setCwHistoryVisible(v => !v)} title="批注 / 版本" className={`px-2.5 py-1 text-[12px] border rounded-[4px] flex items-center gap-1 ${cwHistoryVisible ? 'text-[#02A7F0] border-[#02A7F0] hover:bg-[#E8F7FF]' : 'text-[#353535] border-[#E7E7EB] hover:bg-white'}`}>
        <MessageSquare size={13} /> 批注
      </button>
      {/* 全屏态：此处按钮变为「退出全屏」（外层已放「退出全屏」入口，这里隐藏以免重复）；非全屏态放「全屏编辑」进入 */}
      {fullscreen ? (
        <button onClick={() => setCwFullscreen(false)} title="退出全屏 (Esc)"
          className="px-2.5 py-1 text-[12px] text-[#353535] border border-[#E0E0E0] rounded-[4px] hover:bg-[#F5F5F5] flex items-center gap-1">
          <Maximize2 size={13} /> 退出全屏
        </button>
      ) : (
        <button onClick={() => setCwFullscreen(true)} title="全屏编辑"
          className="px-2.5 py-1 text-[12px] text-[#02A7F0] border border-[#02A7F9] rounded-[4px] hover:bg-[#E6F7FF] flex items-center gap-1">
          <Maximize2 size={13} /> 全屏
        </button>
      )}
      {/* 模板库：两种形态共用同一逻辑与状态。装饰入口已下沉到画布选中态。 */}
      {renderTemplatePanel(fullscreen)}
    </div>)
  }

  // 全屏编辑：最大化画布，隐藏左右栏与发散/校验面板，但顶栏整合左栏关键信息与编辑控件（优先级最高，覆盖查看态/编辑态）
  if (cwFullscreen) {
    const slides = outlineToSlides(cwOutline, cwOpts(), coverDecor)
    return (
      <div className="fixed inset-0 z-50 bg-[#FAFAFA] flex flex-col">
        {/* 顶栏：课题信息（左栏关键信息）+ 统一工具栏（右端：导出/润色/比例/批注/退出全屏/模板库），
            与教案一致——全屏的「退出全屏」按钮只放在右端工具栏内，不在左端重复 */}
        <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-[#EFEFEF] bg-white">
          <div className="min-w-0 flex flex-col leading-tight">
            <span className="text-[13px] text-[#353535] font-medium truncate">{genTitle.trim() || '未命名课件'}</span>
            <span className="text-[10px] text-[#9A9A9A] truncate">{teaching.subject} · {gradeName} · {teaching.semester || '学期'}</span>
          </div>
          <div className="w-px h-5 bg-[#EEE]" />
          {/* 统一工具栏：与非全屏态完全相同的按钮（含模板库入口），fullscreen=true 时「全屏」按钮变为「退出全屏」 */}
          {renderToolbar(true)}
          <div className="flex-1" />
          {/* 全屏特有：显示/隐藏缩略图栏（非全屏态无此概念，其页列表在左栏），与右端工具栏视觉分离、单独置右 */}
          {cwOutline.length > 1 && (
            <button onClick={() => setCwFsThumb(v => !v)} title="显示/隐藏缩略图栏"
              className="px-2.5 py-1.5 text-[12px] text-[#595959] border border-[#E0E0E0] rounded hover:bg-[#F5F5F5]">
              {cwFsThumb ? '隐藏页' : '显示页'}
            </button>
          )}
        </div>
        {/* 主体：缩略图 + 画布 */}
        <div className="flex-1 flex min-h-0">
          {cwFsThumb && cwOutline.length > 1 && (
            <CwPageList
              className="w-[170px] shrink-0 border-r border-[#EFEFEF] bg-[#F7F7F8] overflow-y-auto py-2 px-1.5 space-y-2"
              slides={cwThumbSlides} deckIdx={deckIdx} onSelect={goToPage}
              theme={resolveTheme(themeId, colorRoot)} aspect={cwAr}
              emptyTitle="未命名" titleMax={16}
            />
          )}
          <div className="flex-1 overflow-y-auto p-6 flex justify-center">
            {/* 全屏画布区（2026-09-14 修）：此前 `max-w-[960px]` 把全屏画布**又钉在 960 宽**
                → "全屏编辑=最大化画布"落空（实测全屏 928×522 < 非全屏 960×540）。
                宽度交还给容器，缩放由 PptxPreview 按可用宽高适配。 */}
            <div className="w-full">
              {cwOutline.length > 0 && slides.length > 0 ? (
                // outlineToSlides 在 cwOutline 前自动插入了封面页，编辑画布索引需 +1
                <PptxPreview slides={slides} theme={resolveTheme(themeId, colorRoot)} aspectRatio={cwAr} index={deckIdx} onIndexChange={(si) => goToPage(si)} onSlideChange={handleDocSlideChange} viewMode="scroll" editable={deckIdx !== 0} embedFullscreen={true} onSelectDecor={(sel) => setSelDecor(sel)} onReplaceDecor={(sel) => { setSelDecor(sel); if (!decorElems.length) loadDecorElems('public'); setDecorPickerOpen(true) }} />
              ) : (
                <div className="h-full flex items-center justify-center text-[13px] text-[#9A9A9A]">课件内容为空，请先生成课件</div>
              )}
            </div>
          </div>
          {/* 全屏内批注 / 版本浮层 */}
          {cwHistoryVisible && (
            <CwAnnotationsPanel
              className="relative w-[240px] shrink-0 border-l border-[#E7E7EB] bg-[#FAFBFC] flex flex-col z-20 overflow-hidden shadow-lg"
              onCollapse={() => setCwHistoryVisible(false)}
              cwAnn={cwAnn} cwVer={cwVer} cwAnnTargetId={cwAnnTargetId} cwLocked={cwLocked}
              materialId={materialId} cwOutline={cwOutline} setCwOutline={setCwOutline}
              deckIdx={deckIdx} docSlide={docSlide}
              />
          )}
          {/* 批注栏收起后：悬浮展开按钮（与教案完全一致：右侧垂直居中 w-7 h-12 rounded-l 灰底 ChevronLeft） */}
          {!cwHistoryVisible && (
            <button onClick={() => setCwHistoryVisible(true)} title="展开批注/版本历史"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-12 bg-gray-700/70 hover:bg-gray-800 rounded-l-md flex items-center justify-center text-white z-20 transition-all shadow-md">
              <ChevronLeft size={14} />
            </button>
          )}
        </div>
        {/* 替换装饰面板（与主 return 共用子组件，避免 z-index/return 路径丢失） */}
        <DecorPickerModal
          open={decorPickerOpen}
          onClose={() => setDecorPickerOpen(false)}
          decorElems={decorElems}
          decorScope={decorScope}
          decorMedium={decorMedium}
          onScopeChange={(sc) => loadDecorElems(sc, decorMedium)}
          onMediumChange={(m) => loadDecorElems(decorScope, m)}
          onPick={replaceDecorAt}
          suggestions={aiDecorSuggestions}
          onApplySuggestion={applyDecorSuggestion}
          onApplyAll={applyAllDecorSuggestions}
          onSmartMatch={smartMatchDecor}
          smartMatching={aiDecorating}
        />
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

// ── H5 互动组件：手动挂编辑器（选择器 + 表单）──
  return (
    <>
    <EditorLayout
      primaryLeft={leftPanel}
      primaryRight={rightPanelAi}
      secondaryLeft={leftPanel}
      // 修复（2026-09-13）：H5 编辑态"空白页"的真因 ——
      // 主画布此前**固定用 rightPanelDoc**（PPT 式提纲/画布编辑器），而 H5 绘本只在
      // `previewSlot` 里（且要手动开预览）→ 于是"H5 进编辑"等于用 PPT 编辑器打开一份绘本：
      // 右栏只有骨架/近乎空白，用户报"从预览进编辑是空白页"。
      // H5 有绘本 HTML 时，主画布直接用 previewPane（其内部 `cwFormat==='h5' && cwH5Html` → iframe）。
      secondaryRight={cwFormat === 'h5' && cwH5Html ? previewPane : rightPanelDoc}
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
      // 修复（2026-09-13）：H5 编辑态空白页。
      // `cwOutline` 由 **PPT 的 markdownToOutline** 解析，而 H5 的 Story 内容（`## 封面：… /
      // <!-- layout: scene-transition -->`）解析结果为 **0 页** → 此前条件为假 → 右侧什么都不渲染（空白页）。
      // 而查看态（第 2071 行）`previewSlot={previewPane}` 是**无条件**的，所以"预览正常、进编辑就空白"。
      // 故条件必须把"有 H5 HTML"也算作有内容。
      previewSlot={(cwFormat === 'h5' && cwH5Html) || cwOutline.length > 0 ? previewPane : (
          <div className="h-full flex items-center justify-center text-[13px] text-[#9A9A9A]">课件内容为空，请先生成课件</div>
        )}
    />
    {/* 替换装饰面板：渲染在编辑层最外层（z-90），全屏态与非全屏态都可见。 */}
    <DecorPickerModal
      open={decorPickerOpen}
      onClose={() => setDecorPickerOpen(false)}
      decorElems={decorElems}
      decorScope={decorScope}
      decorMedium={decorMedium}
      onScopeChange={(sc) => loadDecorElems(sc, decorMedium)}
      onMediumChange={(m) => loadDecorElems(decorScope, m)}
      onPick={replaceDecorAt}
    />
    {h5Qr && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setH5Qr(null)}>
        <div className="bg-white rounded-2xl p-6 w-[320px] shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-bold text-[#1A3A6B]">扫码在手机查看</h3>
            <button className="text-[#999] hover:text-[#333]" onClick={() => setH5Qr(null)}><X size={18} /></button>
          </div>
          <img src={h5Qr.dataUrl} alt="二维码" className="w-[240px] h-[240px] mx-auto block" />
          <p className="text-[12px] text-[#888] text-center mt-3 leading-relaxed">
            用手机扫描二维码，即可在浏览器中打开投屏互动课件（点击翻页、点选互动、点击揭示答案）。<br />
            同一链接也可在大屏浏览器直接打开投屏上课。
          </p>
          <a href={h5Qr.url} target="_blank" rel="noreferrer" className="block text-center text-[12px] text-[#2B5DA8] underline mt-2 break-all">{h5Qr.url}</a>
        </div>
      </div>
    )}
    </>
  )
}
