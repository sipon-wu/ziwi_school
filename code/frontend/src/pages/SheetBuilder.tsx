import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTeaching } from '../lib/TeachingContext'
import { useKnowledgePicker } from '../hooks/useKnowledgePicker'
import { useKGContext } from '../lib/KnowledgeGraphContext'
import { useToast } from '../components/Toast'
import EditorLayout from '../components/EditorLayout'
import EditorInfoPanel from '../components/EditorInfoPanel'
import KnowledgeGraphTool from '../components/KnowledgeGraphTool'
import { api } from '../lib/api'
import { getXiaoweiContext } from '../lib/xiaoweiContext'
import QuestionNav from '../components/QuestionNav'
import ExamPreview from '../components/ExamPreview'
import type { ExamQuestion, ExamMeta } from '../components/ExamPreview'
import { Sparkles, X, Save, Users, Calendar, Loader2 } from 'lucide-react'

const DIFFICULTIES = ['L1', 'L2', 'L3', 'L4']
const DIFFICULTY_LABELS: Record<string, string> = { L1: '基础', L2: '中等', L3: '进阶', L4: '挑战' }
const QUESTION_TYPES = [
  { id: 'choice', label: '选择题' }, { id: 'fill', label: '填空题' },
  { id: 'calculation', label: '计算题' }, { id: 'judge', label: '判断题' },
  { id: 'match', label: '匹配题' }, { id: 'cloze', label: '完形填空' },
  { id: 'reading', label: '阅读理解' }, { id: 'essay', label: '简答题' },
  { id: 'writing', label: '写作题' },
]
const CLASSES = ['一年级1班', '一年级2班', '二年级1班', '二年级2班', '三年级1班']
const GRADE_NAMES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']

export default function SheetBuilder() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = !!id
  const teaching = useTeaching()
  const { toast } = useToast()
  const gradeName = GRADE_NAMES[teaching.grade - 1] || '四年级'

  const picker = useKnowledgePicker({ autoSelect: true })
  const { setPicker: setKGPicker } = useKGContext()
  useMemo(() => { setKGPicker(picker as any); return () => setKGPicker(null) }, [picker, setKGPicker])

  const [editMode, setEditMode] = useState<'primary' | 'secondary'>('primary')
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)

  const [sheetTitle, setSheetTitle] = useState('')
  const [targetClass, setTargetClass] = useState('')
  const [deadline, setDeadline] = useState('')
  const [difficulty, setDifficulty] = useState('L2')
  const [count, setCount] = useState(5)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['choice', 'fill'])
  const [extraReq, setExtraReq] = useState('')
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [saving, setSaving] = useState(false)
  const [published, setPublished] = useState(false)

  const gradeMap: Record<string, number> = { '一年级': 1, '二年级': 2, '三年级': 3, '四年级': 4, '五年级': 5, '六年级': 6 }
  const gradeNum = gradeMap[teaching.grade] || 4

  const toggleType = (t: string) => {
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  const handleGenerate = async (leftChatContext?: string) => {
    if (picker.selectedIds.length === 0) {
      toast('请先在知识图谱选取知识点', 'warning')
      return
    }
    setGenerating(true)
    try {
      const res = await api('/ai/exercises/generate', {
        method: 'POST',
        body: JSON.stringify({
          subject: teaching.subject,
          grade: gradeNum,
          semester: teaching.semester,
          knowledge_ids: picker.selectedIds,
          types: selectedTypes,
          difficulty,
          count,
          extra_requirements: extraReq || undefined,
          chat_context: leftChatContext || getXiaoweiContext() || undefined,
        }),
      })
      if (res?.questions) {
        setQuestions(res.questions.map((q: any, i: number) => ({ ...q, id: `q_${i}` })))
        toast(`已生成 ${res.questions.length} 题`, 'success')
      }
    } catch (e: any) {
      toast('生成失败: ' + (e.message || '网络错误'), 'error')
    }
    setGenerating(false)
  }

  const handleLeftApply = async (chatContext: string) => { await handleGenerate(chatContext) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        title: sheetTitle || `${teaching.subject}${teaching.grade}练习题`,
        subject: teaching.subject,
        grade: teaching.grade,
        target_class: targetClass,
        deadline: deadline || undefined,
        knowledge_ids: picker.selectedIds,
        questions: JSON.stringify(questions.map((q, i) => ({ ...q, sort: i + 1 }))),
        total_count: questions.length,
        status: 'draft',
      }
      const res = id
        ? await api(`/sheets/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await api('/sheets', { method: 'POST', body: JSON.stringify(payload) })
      if (res || !res?.error) toast('保存成功', 'success')
      else toast('保存失败', 'error')
    } catch { toast('网络错误', 'error') }
    setSaving(false)
  }

  const handlePublish = async () => {
    setSaving(true)
    try {
      const payload = {
        title: sheetTitle || `${teaching.subject}${teaching.grade}练习题`,
        subject: teaching.subject,
        grade: teaching.grade,
        target_class: targetClass,
        deadline: deadline || undefined,
        knowledge_ids: picker.selectedIds,
        questions: JSON.stringify(questions.map((q, i) => ({ ...q, sort: i + 1 }))),
        total_count: questions.length,
        status: 'published',
      }
      const res = id
        ? await api(`/sheets/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await api('/sheets', { method: 'POST', body: JSON.stringify(payload) })
      if (res || !res?.error) {
        setPublished(true)
        toast('已布置到班级', 'success')
      } else toast('发布失败', 'error')
    } catch { toast('网络错误', 'error') }
    setSaving(false)
  }

  // ===== AI 模式左栏（P0-3 EditorInfoPanel + P0-4 框架小微 + P0-6 统一 footer） =====
  const aiLeftPanel = (
    <EditorInfoPanel
      showBasicInfo
      showGrade
      classLabel={gradeName}
      xiaowei={{
        contextType: 'sheet',
        subject: teaching.subject,
        grade: gradeName,
        knowledgeNodeNames: picker.selectedNodes.map((n: any) => n.name),
        extraRequirements: extraReq,
        onApply: handleLeftApply,
      }}
    >
      {/* 标题 */}
      <div className="px-5 py-3">
        <label className="block text-[12px] font-medium text-[#353535] mb-2">标题</label>
        <input value={sheetTitle} onChange={e => setSheetTitle(e.target.value)}
          placeholder="如：第三单元课后练习"
          className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#722ED1]" />
      </div>

      {/* 布置班级 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-2">
          <Users size={12} className="inline mr-1" />布置班级
        </label>
        <select value={targetClass} onChange={e => setTargetClass(e.target.value)}
          className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#722ED1] bg-white">
          <option value="">请选择班级</option>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* 截止日期 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-2">
          <Calendar size={12} className="inline mr-1" />截止日期（选填）
        </label>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
          className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#722ED1]" />
      </div>

      {/* 出题配置 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0] space-y-3">
        <h4 className="text-[12px] font-medium text-[#353535]">出题配置</h4>
        <div>
          <label className="block text-[12px] text-[#9A9A9A] mb-1.5">难度</label>
          <div className="flex gap-2">
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`flex-1 px-2.5 py-2 text-[12px] rounded-[4px] transition-colors ${difficulty === d ? 'bg-[#722ED1] text-white' : 'bg-[#F6F7F8] text-[#353535] hover:bg-[#E8E8E8]'}`}>
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[12px] text-[#9A9A9A] mb-1.5">题量</label>
            <select value={count} onChange={e => setCount(Number(e.target.value))}
              className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#722ED1] bg-white">
              {[3,5,8,10,15,20].map(n => <option key={n} value={n}>{n} 题</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[12px] text-[#9A9A9A] mb-1.5">题型</label>
          <div className="flex flex-wrap gap-1.5">
            {QUESTION_TYPES.map(t => (
              <button key={t.id} onClick={() => toggleType(t.id)}
                className={`px-2.5 py-1.5 text-[11px] rounded-full transition-colors ${selectedTypes.includes(t.id) ? 'bg-[#722ED1]/10 text-[#722ED1] border border-[#722ED1]' : 'bg-[#F6F7F8] text-[#353535] border border-transparent hover:border-[#E7E7EB]'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 附加要求 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-1.5">附加要求</label>
        <textarea value={extraReq} onChange={e => setExtraReq(e.target.value)}
          rows={2} placeholder="如：侧重基础、减少开放性题目…（也可先在左下角小微对话提需求，自动带入）"
          className="w-full px-2.5 py-2 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#722ED1] resize-none" />
      </div>

      {/* AI 生成按钮 */}
      <div className="px-5 py-4 border-t border-[#F0F0F0]">
        <button onClick={() => handleGenerate()} disabled={generating || picker.selectedIds.length === 0}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] text-white bg-[#722ED1] rounded-[4px] hover:bg-[#5B23A8] disabled:opacity-50 transition-colors">
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generating ? '正在生成题目...' : (picker.selectedIds.length === 0 ? '请先在知识图谱选取知识点' : (questions.length > 0 ? '重新生成题目' : 'AI 生成题目'))}
        </button>
      </div>
    </EditorInfoPanel>
  )

  // ===== 文档模式左栏（只读元数据 + 已选题目列表） =====
  const docLeftPanel = (
    <EditorInfoPanel
      showBasicInfo={false}
      xiaowei={{
        contextType: 'sheet',
        subject: teaching.subject,
        grade: gradeName,
        knowledgeNodeNames: picker.selectedNodes.map((n: any) => n.name),
        extraRequirements: extraReq,
        onApply: handleLeftApply,
      }}
    >
      <div className="px-5 py-4">
        <h3 className="text-[13px] font-semibold text-[#353535]">{sheetTitle || '练习题'}</h3>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-[#9A9A9A]">
          <span>{teaching.subject} · {gradeName}</span>
          <span>|</span>
          <span>{DIFFICULTY_LABELS[difficulty]}</span>
          <span>|</span>
          <span>{questions.length} 题</span>
        </div>
        {targetClass && <p className="mt-2 text-[11px] text-[#059669]">布置班级: {targetClass}</p>}
        {deadline && <p className="mt-0.5 text-[11px] text-[#9A9A9A]">截止: {deadline}</p>}
      </div>

      {questions.length > 0 ? (
        <div className="px-5 pb-4">
          <span className="text-[12px] font-medium text-[#353535]">已选题目</span>
          <div className="mt-2 space-y-1">
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-2 px-3 py-2 bg-[#F6F7F8] rounded-[4px] text-[12px] text-[#353535]">
                <span className="text-[#9A9A9A]">{i + 1}.</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-white rounded text-[#9A9A9A]">{QUESTION_TYPES.find(t => t.id === q.type)?.label || q.type}</span>
                <span className="truncate">{q.stem || ''}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="px-5 pb-4 text-[11px] text-[#9A9A9A]">尚未生成题目，请在 AI 模式生成</p>
      )}

      {/* 在文档模式底部也放一个「重新生成」按钮，方便回溯 */}
      {questions.length > 0 && (
        <div className="px-5 py-4 border-t border-[#F0F0F0] mt-auto">
          <button onClick={() => { setEditMode('primary'); handleGenerate() }} disabled={generating}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] text-white bg-[#722ED1] rounded-[4px] hover:bg-[#5B23A8] disabled:opacity-50 transition-colors">
            <Sparkles size={14} /> 重新生成题目
          </button>
        </div>
      )}
    </EditorInfoPanel>
  )

  const previewQuestions = useMemo(() => questions, [questions])
  const previewMeta: ExamMeta = useMemo(() => ({
    title: sheetTitle || '练习题',
    subject: teaching.subject,
    grade: String(teaching.grade || ''),
    totalScore: 100,
  }), [sheetTitle, teaching.subject, teaching.grade])

  // ===== P0-6 统一 footer =====
  const sheetFooterLifecycle = {
    saveDraftLabel: '保存草稿',
    publishLabel: published ? '已布置' : '布置到班级',
    onSaveDraft: handleSave,
    onPublish: handlePublish,
    saving: saving,
  }

  return (
    <EditorLayout
      primaryLeft={aiLeftPanel}
      primaryRight={
        <KnowledgeGraphTool
          data={picker.knowledgeData}
          filter={{ subject: teaching.subject, grade: gradeNum, semester: teaching.semester }}
          selectedIds={picker.selectedIds}
          onSelect={ids => picker.setSelectedIds(ids)}
        />
      }
      secondaryLeft={docLeftPanel}
      secondaryRight={
        <div className="flex-1 flex overflow-hidden relative">
          <QuestionNav questions={previewQuestions} />
          <ExamPreview embedded paperSize="A4" allowA3={false} questions={previewQuestions} meta={previewMeta} layout="practice" />
        </div>
      }
      mode={editMode}
      modeLabels={['AI 模式', '文档模式']}
      onModeChange={setEditMode}
      subtitle="AI 辅助生成题单，选好知识点直接布置到班级"
      leftCollapsible={editMode === 'secondary'}
      leftCollapsed={leftPanelCollapsed}
      onToggleLeft={() => setLeftPanelCollapsed(prev => !prev)}
      footerLifecycle={sheetFooterLifecycle}
    />
  )
}
