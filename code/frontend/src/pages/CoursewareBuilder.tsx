import { useState, useEffect } from 'react'
import { Sparkles, Loader2, FileText } from 'lucide-react'
import { useToast } from '../components/Toast'
import { useTeaching } from '../lib/TeachingContext'
import { useKnowledgePicker } from '../hooks/useKnowledgePicker'
import { useKGContext } from '../lib/KnowledgeGraphContext'
import { api, aiAPI, materialAPI, type MaterialItem } from '../lib/api'
import { getXiaoweiContext } from '../lib/xiaoweiContext'
import { buildKnowledgeScope } from '../lib/knowledgeScope'
import { exportLessonPlanToDocx, downloadBlob } from '../lib/exportDocx'
import { printLessonPlan } from '../lib/printPdf'
import { exportCoursewareToPptx, outlineToSlides, outlineToMarkdown, markdownToOutline, pptToOutline } from '../lib/exportPptx'
import type { OutlineSlide } from '../lib/exportPptx'
import EditorLayout from '../components/EditorLayout'
import EditorInfoPanel from '../components/EditorInfoPanel'
import { useEditorController } from '../hooks/useEditorController'
import KnowledgeGraphTool from '../components/KnowledgeGraphTool'
import PptxPreview from '../components/PptxPreview'

const GRADE_NAMES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']
const safeGetUser = () => { try { return JSON.parse(localStorage.getItem('zhiwei_user') || localStorage.getItem('user') || '{}') || {} } catch { return {} } }
const getSchoolId = () => { try { const t = localStorage.getItem('zhiwei_token') || ''; const p = JSON.parse(atob(t.split('.')[1])); return p.school_id || '' } catch { return '' } }

const DRAFT_KEY = 'zhiwei_cw_draft'

/**
 * P4 课件编辑器页（PPT 课件 · H5 预留）：与教案/出题/组卷同一套 EditorLayout 四件套。
 * AI 模式 = 左栏参数 + 右栏知识图谱；文档模式 = 左栏参数 + 右栏可编辑提纲/发散地图/校验；
 * 框架预览 = PPT 放映；footer = 保存草稿(本地) / 发布到素材库(红线校验闸)。
 */
export default function CoursewareBuilder() {
  const teaching = useTeaching()
  const { toast } = useToast()
  const gradeName = GRADE_NAMES[teaching.grade - 1] || '四年级'

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
  // workMode 已收口到 useEditorController

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
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
      if (d && (d.title || d.outline?.length)) {
        setGenTitle(d.title || '')
        setCwExtra(d.extra || '')
        setCwMarkdown(d.markdown || '')
        setCwOutline(Array.isArray(d.outline) ? d.outline : [])
        setCwDivergence(Array.isArray(d.divergence) ? d.divergence : [])
        if (d.divergenceLevel) setDivergenceLevel(d.divergenceLevel)
        if (d.outline?.length) ctrl.setWorkMode('doc')
        toast('已恢复上次未发布的课件草稿', 'info')
      }
    } catch { /* 忽略损坏草稿 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const cwOpts = () => ({ subject: teaching.subject, grade: gradeName, title: `${genTitle.trim()}_课件`, teacherName: safeGetUser().name || '教师' })

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
      setCwOutline(markdownToOutline(res.courseware_markdown || ''))
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
      setCwOutline(markdownToOutline(r.trimmed_markdown || cwMarkdown))
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

  // AI 润色提纲（render-ppt：精炼要点 + 讲稿）
  const polishOutline = async () => {
    if (!cwMarkdown) return
    setPolishing(true)
    try {
      const r: any = await aiAPI.renderPptCourseware({ markdown: cwMarkdown, title: `${genTitle.trim()}_课件`, subject: teaching.subject, grade: gradeName })
      const out = pptToOutline(r.ppt_slides || [])
      if (out.length) { setCwOutline(out); toast('提纲已 AI 润色（含讲稿）', 'success') }
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

  // ── footer：保存草稿(本地暂存) / 发布到素材库(红线校验闸) ──
  const handleSaveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        title: genTitle, extra: cwExtra, markdown: cwMarkdown,
        outline: cwOutline, divergence: cwDivergence, divergenceLevel,
      }))
      toast('草稿已暂存本地（发布后自动清除）', 'success')
    } catch { toast('草稿暂存失败', 'error') }
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
      await materialAPI.createJSON({
        name: `${genTitle.trim()}_课件`,
        type: 'courseware',
        tag: `${teaching.subject}${gradeName}`,
        content: outlineToMarkdown(cwOutline, cwOpts()),
      })
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
      toast('课件已发布到素材库', 'success')
    }     catch (e: any) { toast('发布失败: ' + (e.message || ''), 'error') }
    finally { setSavingCw(false) }
  }

  ctrl = useEditorController({ onSaveDraft: handleSaveDraft, onPublish: handlePublish })

  // ── 左栏（AI/DOC 共用，同教案/出题/组卷） ──
  const leftPanel = (
    <EditorInfoPanel
      showBasicInfo
      showGrade
      classLabel={gradeName}
      xiaowei={{
        contextType: 'lesson',
        subject: teaching.subject,
        grade: gradeName,
        knowledgeNodeNames: picker.selectedNodes.map((n: any) => n.name),
        extraRequirements: cwExtra,
        onApply: handleLeftApply,
      }}
    >
      {/* 课题名称 */}
      <div className="px-5 py-3">
        <label className="block text-[12px] font-medium text-[#353535] mb-2">课题名称 <span className="text-red-500">*</span></label>
        <input value={genTitle} onChange={e => setGenTitle(e.target.value)} placeholder="如：光的折射定律"
          className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#722ED1]" />
      </div>

      {/* 参照课件 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-2">参照课件（可选）</label>
        <select value={genBaseId} onChange={e => setGenBaseId(e.target.value)}
          className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#722ED1]">
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
          className="w-full px-2.5 py-2 text-[12px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#722ED1] resize-none" />
      </div>

      {/* 发散度 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-1.5">发散度（受控启发）</label>
        <select value={divergenceLevel} onChange={e => setDivergenceLevel(e.target.value as any)}
          className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#722ED1]">
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
                className="w-full px-2 py-1.5 text-[11px] border border-[#E7E7EB] rounded-[3px] bg-white outline-none focus:border-[#722ED1]">
                <option value="">请选择…</option>
                {(q.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* 生成按钮 */}
      <div className="px-5 py-4 border-t border-[#F0F0F0]">
        <button onClick={() => handleGenCourseware()} disabled={genLoading}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] text-white bg-[#722ED1] rounded-[4px] hover:bg-[#5B23A8] disabled:opacity-50 transition-colors">
          {genLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {genLoading ? 'AI 生成中...' : cwOutline.length > 0 ? '重新生成课件' : 'AI 生成课件'}
        </button>
        {cwSimilar && <p className="text-[10px] text-[#9A9A9A] mt-2">参照相近课件《{cwSimilar.name}》生成的新版本</p>}
      </div>
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

  // ── 右栏 文档模式：可编辑提纲 + 发散地图 + 校验面板 ──
  const rightPanelDoc = (
    <div className="flex-1 overflow-y-auto px-6 py-4 bg-[#FAFAFA]">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button onClick={exportCwPptx} className="px-3 py-1.5 text-[12px] text-white bg-[#722ED1] border border-[#722ED1] rounded-[4px] hover:bg-[#5B23A8]">导出 PPT</button>
        <button onClick={polishOutline} disabled={polishing} className="px-3 py-1.5 text-[12px] text-[#722ED1] border border-[#722ED1] rounded-[4px] hover:bg-[#F7F0FC] disabled:opacity-50">{polishing ? '润色中...' : '✨ AI 润色提纲'}</button>
        <button onClick={exportCwDocx} className="px-3 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:bg-white">导出 Word</button>
        <button onClick={exportCwPdf} className="px-3 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:bg-white">导出 PDF</button>
        <button disabled title="H5 互动课件即将上线"
          className="px-3 py-1.5 text-[12px] text-[#B0B8C4] border border-dashed border-[#D0D0D0] rounded-[4px] cursor-not-allowed flex items-center gap-1">H5 互动课件 <span className="text-[10px] px-1 bg-[#FA8C16] text-white rounded">即将上线</span></button>
      </div>

      <p className="text-[12px] font-medium text-[#353535] mb-2 flex items-center gap-1">
        <FileText size={13} className="text-[#722ED1]" /> PPT 课件提纲（可编辑：标题/要点可改，可调整页面顺序）
      </p>
      <div className="space-y-3">
        {cwOutline.map((s, idx) => (
          <div key={idx} className="border border-[#E7E7EB] rounded-[4px] bg-white p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] text-[#9A9A9A] w-6 shrink-0">P{idx + 1}</span>
              <input value={s.title} onChange={e => setSlideTitle(idx, e.target.value)}
                className="flex-1 px-2 py-1 text-[13px] font-medium border border-[#E7E7EB] rounded-[3px] outline-none focus:border-[#722ED1]" />
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => moveSlide(idx, -1)} disabled={idx === 0} title="上移"
                  className="px-1.5 py-0.5 text-[11px] text-[#353535] border border-[#E7E7EB] rounded hover:bg-[#F6F7F8] disabled:opacity-30">↑</button>
                <button onClick={() => moveSlide(idx, 1)} disabled={idx === cwOutline.length - 1} title="下移"
                  className="px-1.5 py-0.5 text-[11px] text-[#353535] border border-[#E7E7EB] rounded hover:bg-[#F6F7F8] disabled:opacity-30">↓</button>
                <button onClick={() => removeSlide(idx)} title="删除本页"
                  className="px-1.5 py-0.5 text-[11px] text-[#F5222D] border border-[#E7E7EB] rounded hover:bg-[#FFF1F0]">✕</button>
              </div>
            </div>
            <textarea value={s.bullets.join('\n')} onChange={e => setSlideBullets(idx, e.target.value)}
              rows={Math.max(2, s.bullets.length)} placeholder="每条要点一行"
              className="w-full px-2 py-1 text-[12px] border border-[#E7E7EB] rounded-[3px] outline-none focus:border-[#722ED1] resize-y" />
          </div>
        ))}
        {cwOutline.length === 0 && (
          <div className="text-center py-16 bg-white border border-dashed border-[#E7E7EB] rounded-[4px]">
            <Sparkles size={28} className="mx-auto text-[#E7E7EB] mb-3" />
            <p className="text-[13px] text-[#9A9A9A]">暂无课件内容</p>
            <p className="text-[11px] text-[#A3A3A3] mt-1">在左栏填写课题名称后点击「AI 生成课件」</p>
          </div>
        )}
      </div>

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
                <span className={`px-1.5 py-0.5 rounded-[2px] text-white shrink-0 ${d.zone === 'edge' ? 'bg-[#722ED1]' : 'bg-[#02A7F0]'}`}>
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
  )

  return (
    <EditorLayout
      primaryLeft={leftPanel}
      primaryRight={rightPanelAi}
      secondaryLeft={leftPanel}
      secondaryRight={rightPanelDoc}
      mode={ctrl.workMode === 'ai' ? 'primary' : 'secondary'}
      onModeChange={m => ctrl.setWorkMode(m === 'primary' ? 'ai' : 'doc')}
      sceneName="PPT 课件"
      footerAlign="left"
      footerLifecycle={{
        saveDraftLabel: '保存草稿',
        publishLabel: '发布到素材库',
        onSaveDraft: ctrl.saveDraft,
        onPublish: ctrl.publish,
        status: ctrl.status,
        saving: ctrl.saving || savingCw || validating,
      }}
      previewTitle={`${genTitle.trim() || '未命名'}_课件 · PPT 放映`}
      previewSlot={
        cwOutline.length > 0 ? (
          <PptxPreview slides={outlineToSlides(cwOutline, cwOpts())} title={`${genTitle.trim()}_课件`} onClose={() => {}} embedded />
        ) : (
          <div className="h-full flex items-center justify-center text-[13px] text-[#9A9A9A]">课件内容为空，请先生成课件</div>
        )
      }
    />
  )
}
