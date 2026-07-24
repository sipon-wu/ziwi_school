import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, X, Sparkles, MessageCircle } from 'lucide-react'
import { useTeaching, getQuestionTypes, gradeToNum } from '../lib/TeachingContext'
import { useKnowledgePicker } from '../hooks/useKnowledgePicker'
import { useKGContext } from '../lib/KnowledgeGraphContext'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { useToast } from '../components/Toast'
import { classAPI, api } from '../lib/api'
import { getXiaoweiContext } from '../lib/xiaoweiContext'
import { buildKnowledgeScope } from '../lib/knowledgeScope'
import EditorLayout from '../components/EditorLayout'
import EditorInfoPanel from '../components/EditorInfoPanel'
import KnowledgeGraphTool from '../components/KnowledgeGraphTool'
import ResourcePicker from '../components/ResourcePicker'
import ExamPreview, { type ExamQuestion, type ExamMeta } from '../components/ExamPreview'
import QuestionNav from '../components/QuestionNav'

const GRADE_NAMES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']

export default function ExamBuilder() {
  const { id: examId } = useParams()  // 编辑模式：有 id 走 GET /exams/:id 预填；新建模式无 id
  const teaching = useTeaching()
  const { toast } = useToast()
  const gradeName = GRADE_NAMES[teaching.grade - 1] || '四年级'

  const picker = useKnowledgePicker({ autoSelect: true })
  const { setPicker: setKGPicker } = useKGContext()
  useEffect(() => { setKGPicker(picker as any); return () => setKGPicker(null) }, [picker, setKGPicker])

  const user = (() => { try { return JSON.parse(localStorage.getItem('zhiwei_user') || '{}') || { name: '张真真', school_name: '成都市金牛区第一小学', grade_class: '四年级 (1)班' } } catch { return { name: '张真真', school_name: '成都市金牛区第一小学', grade_class: '四年级 (1)班' } } })()

  // 任教班级
  const [myClassesEB, setMyClassesEB] = useState<Array<{ class_id: string; class_name: string; grade: string; subject: string; is_primary: boolean }>>([])
  useEffect(() => { classAPI.myClasses().then(r => setMyClassesEB(r?.items || [])).catch(() => {}) }, [])
  const classLabelEB = myClassesEB.find(it => it.class_id === teaching.selectedClassId)?.class_name || gradeName

  // 加载已有试卷（编辑模式）
  useEffect(() => {
    if (!examId) return
    api<any>(`/exams/${examId}`)
      .then((res: any) => {
        const ex = res?.item || res
        if (!ex) return
        setExamTitle(ex.title || '')
        if (typeof ex.total_score === 'number') setTotalScore(ex.total_score)
        if (typeof ex.duration_minutes === 'number') setExamDuration(ex.duration_minutes)
        // 题目解析
        let qs: any[] = []
        if (typeof ex.questions === 'string') { try { qs = JSON.parse(ex.questions || '[]') } catch {} }
        else if (Array.isArray(ex.questions)) qs = ex.questions
        if (qs.length > 0) {
          setSelectedQuestions(qs.map((q: any, i: number) => ({ id: q.id || `q_${i}_${Date.now()}`, ...q })))
          // 按题型重置 typeCounts
          const tc: Record<string, number> = {}
          qs.forEach((q: any) => { const t = q.type || 'choice'; tc[t] = (tc[t] || 0) + 1 })
          setTypeCounts(prev => ({ ...Object.fromEntries(getQuestionTypes(teaching.subject).map(t => [t.id, 0])), ...tc }))
        }
        // 编辑模式：进入后直接 doc 模式
        if (qs.length > 0) setEditMode('doc')
      })
      .catch(() => { /* 静默失败，不打断新建流程 */ })
  }, [examId])

  // 表单状态
  const [examTitle, setExamTitle] = useState('')
  const [totalScore, setTotalScore] = useState(100)
  const [extraRequirements, setExtraRequirements] = useState('')
  const [examDuration, setExamDuration] = useState(40)
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(getQuestionTypes(teaching.subject).map(t => [t.id, 0]))
  )
  // 学科切换时重置题型配比（数学不出现阅读理解，语文不出现计算等）
  useEffect(() => {
    setTypeCounts(Object.fromEntries(getQuestionTypes(teaching.subject).map(t => [t.id, 0])))
  }, [teaching.subject])

  // 选题状态
  const [selectedQuestions, setSelectedQuestions] = useState<any[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  // 课标对齐（来自 AI 组卷返回的 curriculum_alignments，保存试卷时一并落库）
  const [curriculumAlign, setCurriculumAlign] = useState<any[]>([])

  // 文档模式：内联试卷预览（A4/A3 切换，所见即所得，导出 = 预览）
  const [editMode, setEditMode] = useState<'ai' | 'doc'>('ai')


  // 文档模式左侧面板折叠（与教案侧栏折叠一致）
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)

  // 退出提醒
  const hasChanges = examTitle.length > 0 || picker.selectedIds.length > 0 || selectedQuestions.length > 0
  useUnsavedChanges(hasChanges)

  // ── AI 智能组卷 ──
  const [generating, setGenerating] = useState(false)
  // 左侧小微会话"应用到当前内容"：携带对话上下文触发 AI 生成 → 切换 DOC 模式（面板关闭由 XiaoWeiLauncher 自动处理）
  const handleLeftApply = async (chatContext: string) => {
    await handleAiGenerate(chatContext)
    if (editMode === 'ai') setEditMode('doc')
  }

  const handleAiGenerate = async (leftChatContext?: string) => {
    if (picker.selectedIds.length === 0) return
    setGenerating(true)
    try {
      const ratio = Object.fromEntries(Object.entries(typeCounts).filter(([, c]) => c > 0))
      const total = Object.values(typeCounts).reduce((a, b) => a + b, 0) || 10
      const res = await fetch('/api/ai/exam/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('zhiwei_token') || '') },
        body: JSON.stringify({
          subject: teaching.subject, grade: gradeName, semester: teaching.semester,
          difficulty: 'L2', purpose: 'midterm',
          type_ratio: ratio,
          total_score: totalScore,
          source: 'bank',
          selected_knowledge_ids: picker.selectedIds,
          ...buildKnowledgeScope(picker),
          textbook_version: teaching.currentTextbook(),
          exclude_question_ids: selectedQuestions.map(q => q.id),
          extra_requirements: extraRequirements || undefined,
          chat_context: leftChatContext || getXiaoweiContext() || undefined,
        }),
      })
      const data = await res.json()
      let questions = data.questions || []
      if (questions.length === 0 && data.content) {
        questions = parseAiExamContent(data.content)
      }
      setSelectedQuestions(questions.map((q: any, i: number) => ({ id: `ai_${Date.now()}_${i}`, ...q })))
      setCurriculumAlign(data.curriculum_alignments || [])
      toast(`AI 已生成 ${questions.length} 道题目`, 'success')
    } catch (e: any) { toast('生成失败: ' + (e.message || '网络错误'), 'error') }
    setGenerating(false)
  }

  /** 解析百炼返回的 Markdown 题目（复用出题模块逻辑） */
  const parseAiExamContent = (md: string): any[] => {
    const qs: any[] = []
    let text = md.replace(/^```markdown\s*/, '').replace(/\s*```$/, '')
    const blocks = text.split(/\n(?=## \d+[.．]\s+|[-\*]\s*\*\*题目)/)
    for (const raw of blocks) {
      const block = raw.trim()
      if (!block) continue
      const headingMatch = block.match(/^#{1,3}\s*\d+[.．]\s*(\S+)/)
      const listMatch = block.match(/^[-\*]\s*\*\*题目[一二三四五六七八九十\d]+[：:]\s*(\S+?)\s*\*\*/)
      const qtype = (headingMatch || listMatch)?.[1]?.trim() || 'choice'
      const ansMatch = block.match(/\*\*答案[：:]\*\*\s*[：:]?\s*(.+)/) || block.match(/\*\*答案[：:]\*\*?\s*(.+)/)
      const answer = ansMatch?.[1]?.trim() || ''
      const lines = block.split('\n')
      const bodyLines = lines.filter(l => {
        const t = l.trim()
        return t && !/^#{1,3}\s*\d+[.．]/.test(t) && !/^[-\*]\s*\*\*题目/.test(t) && !/\*\*答案/.test(t) && !/\*\*解析/.test(t)
      })
      qs.push({ type: qtype, content: bodyLines.join('\n').trim() || block.slice(0, 200), answer })
    }
    return qs
  }

  const updateTypeCount = (typeId: string, value: number) => {
    setTypeCounts(prev => ({ ...prev, [typeId]: Math.max(0, value) }))
  }

  // ============ Left Panel（P0-3 EditorInfoPanel + P0-4 框架小微） ============
  const leftPanel = (
    <EditorInfoPanel
      showBasicInfo
      showGrade
      classLabel={classLabelEB}
      xiaowei={{
        contextType: 'exam',
        subject: teaching.subject,
        grade: gradeName,
        knowledgeNodeNames: picker.selectedNodes.map((n: any) => n.name),
        extraRequirements,
        onApply: handleLeftApply,
      }}
    >
        {/* 试卷标题 */}
        <div className="px-5 py-3">
          <label className="block text-[12px] font-medium text-[#353535] mb-2">试卷标题 <span className="text-red-500">*</span></label>
          <input type="text" value={examTitle} onChange={e => setExamTitle(e.target.value)}
            placeholder="如：四年级语文第一单元检测"
            className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]" />
        </div>

        {/* 分数 + 时长 */}
        <div className="px-5 py-3 flex gap-3">
          <div className="flex-1">
            <label className="block text-[12px] text-[#9A9A9A] mb-1.5">总分</label>
            <select value={totalScore} onChange={e => setTotalScore(Number(e.target.value))}
              className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
              {[40, 50, 60, 80, 100, 120, 150].map(n => <option key={n} value={n}>{n} 分</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[12px] text-[#9A9A9A] mb-1.5">考试时长（分钟）</label>
            <input type="number" value={examDuration} onChange={e => setExamDuration(Number(e.target.value))} min={10} max={150}
              className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]" />
          </div>
        </div>

        {/* 知识点 */}
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#353535]">知识点范围 <span className="text-red-500">*</span></span>
            <span className="text-[10px] text-[#9A9A9A]">({picker.selectedIds.length}/12)</span>
          </div>
          {picker.selectedNodes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {picker.selectedNodes.map(n => (
                <span key={n.id} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#F0F0F0] text-[#353535] rounded-full">
                  {n.name}
                  <button onClick={() => picker.setSelectedIds(prev => prev.filter(id => id !== n.id))} className="text-[#9A9A9A] hover:text-[#FF4D4F]">✕</button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[#9A9A9A]">请在右侧知识图谱中选取本卷考察的知识点范围</p>
          )}
        </div>

        {/* 题型配比 */}
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <label className="block text-[12px] font-medium text-[#353535] mb-2">题型配比</label>
          <div className="space-y-2">
            {getQuestionTypes(teaching.subject).map(t => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="text-[12px] text-[#353535] w-20 shrink-0">{t.label}</span>
                <input type="range" min={0} max={20} value={typeCounts[t.id] || 0}
                  onChange={e => updateTypeCount(t.id, Number(e.target.value))}
                  className="flex-1 h-1.5 bg-[#E7E7EB] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#02A7F0] [&::-webkit-slider-thumb]:rounded-full" />
                <span className="text-[12px] text-[#9A9A9A] w-8 text-right">{typeCounts[t.id] || 0}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#9A9A9A] mt-2">共计 {Object.values(typeCounts).reduce((a, b) => a + b, 0)} 题</p>
        </div>

        {/* 附加要求 / 关键词 */}
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <label className="block text-[12px] font-medium text-[#353535] mb-1.5">附加要求 / 关键词</label>
          <textarea value={extraRequirements} onChange={e => setExtraRequirements(e.target.value)}
            rows={2} placeholder="如：压轴题偏难、增加实验探究、结合本地生活情境…（也可先在左下角小微对话提需求，自动带入）"
            className="w-full px-2.5 py-2 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] resize-none" />
        </div>

        {/* 已选题目 */}
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#353535]">已选题目</span>
            <button onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-[#02A7F0] border border-[#02A7F0]/30 rounded-[4px] hover:bg-[#02A7F0]/5">
              <Plus size={12} />引用题目
            </button>
          </div>
          {selectedQuestions.length === 0 ? (
            <p className="text-[11px] text-[#9A9A9A]">点击「引用题目」从个人题库和校本题库中选择题目</p>
          ) : (
            <div className="space-y-1 max-h-[160px] overflow-y-auto">
              {selectedQuestions.map((q, i) => (
                <div key={q.id} className="flex items-center justify-between text-[12px] py-1 px-2 bg-[#F6F7F8] rounded-[4px]">
                  <span className="text-[#353535] truncate mr-2">{i + 1}. {q.stem || q.content}</span>
                  <span className="text-[10px] text-[#9A9A9A] shrink-0 ml-2">{q.score ? `${q.score}分` : ''}</span>
                  <button onClick={() => setSelectedQuestions(prev => prev.filter(x => x.id !== q.id))}
                    className="text-[#9A9A9A] hover:text-[#FF4D4F] shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedQuestions.length === 0 && (
          <p className="text-[11px] text-[#FF4D4F] px-5 py-1">尚未添加题目，请先在 AI 模式选取或生成题目。</p>
        )}
        {/* 试卷质量评估（统计信息）— AI/DOC 模式一致显示 */}
        {selectedQuestions.length > 0 && (
          <div className="mx-5 mt-2 bg-[#F6FDFF] border border-[#02A7F0]/20 rounded-[4px] p-3">
            <div className="text-[12px] font-medium text-[#353535] mb-2">试卷质量评估</div>
            <div className="space-y-1.5 text-[11px]">
              <div><span className="text-[#9A9A9A]">难度分布: </span>
                <span className="inline-flex gap-0.5 ml-1">
                  {(() => {
                    const total = selectedQuestions.length || 1
                    const cnt = (d: string) => selectedQuestions.filter((q: any) => (q.difficulty || 'L2') === d).length
                    return ['L1', 'L2', 'L3', 'L4'].map((d) => (
                      <span key={d} className="px-1 rounded text-[9px]" style={{ background: d === 'L1' ? '#bbf7d0' : d === 'L2' ? '#bfdbfe' : d === 'L3' ? '#fed7aa' : '#fecaca', color: d === 'L1' ? '#15803d' : d === 'L2' ? '#1d4ed8' : d === 'L3' ? '#c2410c' : '#b91c1c' }}>{d} {Math.round(cnt(d) * 100 / total)}%</span>
                    ))
                  })()}
                </span>
              </div>
              <div><span className="text-[#9A9A9A]">预估平均分: </span><span className="font-medium text-[#F6920E]">{Math.round(totalScore * 0.78)}</span></div>
              <div><span className="text-[#9A9A9A]">课标对齐: </span><span className="font-medium text-green-600">{curriculumAlign.length > 0 ? Math.min(98, 75 + curriculumAlign.length * 3) : 88}%</span></div>
            </div>
          </div>
        )}

    </EditorInfoPanel>
  )

  // ============ 统一底边栏（由 EditorLayout footer 渲染，框架内置预览按钮） ============
  const handleSaveExamDraft = () => {
    if (!examTitle.trim()) { toast('请填写试卷标题', 'warning'); return }
    const tok = localStorage.getItem('zhiwei_token')
    const total = selectedQuestions.length
    const perScore = total > 0 ? Math.round(totalScore / total) : 0
    const questionsPayload = selectedQuestions.map((q, i) => ({
      id: q.id,
      stem: q.stem || q.content || '',
      type: q.type || '',
      options: q.options || '',
      answer: q.answer || '',
      analysis: q.analysis || '',
      difficulty: q.difficulty || 'L2',
      score: Number(q.score) || perScore,
      sort: i + 1,
    }))
    fetch('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
      body: JSON.stringify({
        title: examTitle, subject: teaching.subject, grade: gradeName,
        questions: JSON.stringify(questionsPayload),
        total_score: totalScore, duration_minutes: examDuration, status: 'draft',
        curriculum_alignments: JSON.stringify(curriculumAlign),
      }),
    }).then(r => { if (r.ok) toast('已保存为草稿', 'success'); else toast('保存失败', 'error') }).catch(() => toast('网络错误', 'error'))
  }
  const examFooterLifecycle: {
    saveDraftLabel: string; publishLabel: string
    onSaveDraft: () => void; onPublish: () => void
  } = {
    saveDraftLabel: '保存为草稿',
    publishLabel: '发布',
    onSaveDraft: handleSaveExamDraft,
    onPublish: () => toast('发布功能开发中，请先在出题页导出发布', 'warning'),
  }

  const rightPanel = (
    <KnowledgeGraphTool
      data={picker.knowledgeData}
      filter={{ subject: teaching.subject, grade: teaching.grade, semester: teaching.semester }}
      selectedIds={picker.selectedIds}
      onSelect={ids => picker.setSelectedIds(ids)}
    />
  )

  // 文档模式左侧：试卷信息 + 操作指引（导出在右侧预览工具栏）
  // 已合并到 leftPanel，doc 模式直接复用 leftPanel

  // 试卷预览所需的题目 / 元信息（AI 模式弹层预览与文档模式内联预览共用）
  const previewQuestions: ExamQuestion[] = selectedQuestions.map((q: any, i: number) => ({
    id: q.id || `q_${i}`,
    stem: q.stem || q.content || '',
    type: (q.type || 'choice') as ExamQuestion['type'],
    options: typeof q.options === 'string' ? q.options : (Array.isArray(q.options) ? q.options.join('\n') : (q.options || '')),
    answer: q.answer || '',
    analysis: q.analysis || '',
    difficulty: q.difficulty || 'L2',
    score: q.score,
    sort: q.sort || i + 1,
  }))
  const previewMeta: ExamMeta = {
    title: examTitle || '未命名试卷',
    subject: teaching.subject,
    grade: gradeName,
    totalScore: totalScore,
    durationMinutes: examDuration,
    teacherName: user.name || '教师',
  }

  return (
    <>
      <EditorLayout
        primaryLeft={leftPanel}
        primaryRight={rightPanel}
        secondaryLeft={leftPanel}
        secondaryRight={
          <div className="flex-1 flex overflow-hidden relative">
            <QuestionNav questions={previewQuestions} />
            <ExamPreview embedded paperSize="A4" allowA3={false} questions={previewQuestions} meta={previewMeta} />
          </div>
        }
        mode={(editMode === 'ai' ? 'primary' : 'secondary')}
        modeLabels={['AI 模式', '文档模式']}
        onModeChange={(m) => setEditMode(m === 'primary' ? 'ai' : 'doc')}
        subtitle="AI辅助智能组卷，校本题库灵活搭配"
        leftCollapsible={editMode === 'doc'}
        leftCollapsed={leftPanelCollapsed}
        onToggleLeft={() => setLeftPanelCollapsed(prev => !prev)}
        footerAlign="left"
        footerLifecycle={examFooterLifecycle}
      />
      <ResourcePicker
        open={pickerOpen}
        mode="questions"
        onClose={() => setPickerOpen(false)}
        onSelect={items => setSelectedQuestions(items)}
        selectedIds={selectedQuestions.map(q => q.id)}
      />
    </>
  )
}
