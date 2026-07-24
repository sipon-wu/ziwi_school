import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTeaching } from '../lib/TeachingContext'
import { useKnowledgePicker } from '../hooks/useKnowledgePicker'
import { useToast } from '../components/Toast'
import EditorLayout from '../components/EditorLayout'
import KnowledgeGraphTool from '../components/KnowledgeGraphTool'
import { api } from '../lib/api'
import QuestionNav from '../components/QuestionNav'
import ExamPreview from '../components/ExamPreview'
import type { ExamQuestion, ExamMeta } from '../components/ExamPreview'
import { Sparkles, X, Save, Users, Calendar } from 'lucide-react'

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

export default function SheetBuilder() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = !!id
  const teaching = useTeaching()
  const { toast } = useToast()

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
  const picker = useKnowledgePicker({ autoSelect: true })

  const toggleType = (t: string) => {
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  const handleGenerate = async () => {
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

  // ===== AI 模式左栏：配置 =====
  const aiLeftPanel = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div>
          <h3 className="text-[13px] font-semibold text-[#353535] mb-3">基本信息</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] text-[#9A9A9A] mb-1.5">标题</label>
              <input value={sheetTitle} onChange={e => setSheetTitle(e.target.value)}
                placeholder="如：第三单元课后练习"
                className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]" />
            </div>
            <div>
              <label className="block text-[12px] text-[#9A9A9A] mb-1.5"><Users size={12} className="inline mr-1" />布置班级</label>
              <select value={targetClass} onChange={e => setTargetClass(e.target.value)}
                className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
                <option value="">请选择班级</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-[#9A9A9A] mb-1.5"><Calendar size={12} className="inline mr-1" />截止日期（选填）</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-[13px] font-semibold text-[#353535] mb-3">出题配置</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] text-[#9A9A9A] mb-1.5">难度</label>
              <div className="flex gap-2">
                {DIFFICULTIES.map(d => (
                  <button key={d} onClick={() => setDifficulty(d)}
                    className={`flex-1 px-2.5 py-2 text-[12px] rounded-[4px] transition-colors ${difficulty === d ? 'bg-[#02A7F0] text-white' : 'bg-[#F6F7F8] text-[#353535] hover:bg-[#E8E8E8]'}`}>
                    {DIFFICULTY_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[12px] text-[#9A9A9A] mb-1.5">题量</label>
                <select value={count} onChange={e => setCount(Number(e.target.value))}
                  className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
                  {[3,5,8,10,15,20].map(n => <option key={n} value={n}>{n} 题</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[12px] text-[#9A9A9A] mb-1.5">题型</label>
              <div className="flex flex-wrap gap-1.5">
                {QUESTION_TYPES.map(t => (
                  <button key={t.id} onClick={() => toggleType(t.id)}
                    className={`px-2.5 py-1.5 text-[11px] rounded-full transition-colors ${selectedTypes.includes(t.id) ? 'bg-[#02A7F0]/10 text-[#02A7F0] border border-[#02A7F0]' : 'bg-[#F6F7F8] text-[#353535] border border-transparent hover:border-[#E7E7EB]'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[12px] text-[#9A9A9A] mb-1.5">附加要求</label>
              <textarea value={extraReq} onChange={e => setExtraReq(e.target.value)}
                rows={2} placeholder="如：侧重基础、减少开放性题目…"
                className="w-full px-2.5 py-2 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] resize-none" />
            </div>
          </div>
        </div>

        <button onClick={handleGenerate} disabled={generating || picker.selectedIds.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#353535] text-white rounded-[4px] hover:bg-[#1A1A1A] transition-colors disabled:opacity-50">
          <Sparkles size={18} className="text-[#02A7F0]" />
          <span className="text-[13px]">{generating ? '正在生成题目...' : (picker.selectedIds.length === 0 ? '请先在知识图谱选取知识点' : 'AI 生成题目')}</span>
        </button>
      </div>

      <div className="px-5 py-3 border-t border-[#F0F0F0] bg-white shrink-0 flex gap-3">
        <button onClick={handleSave} disabled={saving || questions.length === 0}
          className="flex-1 px-4 py-2.5 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors disabled:opacity-50">
          <Save size={14} className="inline mr-1" />保存草稿
        </button>
        <button onClick={handlePublish} disabled={saving || questions.length === 0 || published}
          className="flex-1 px-4 py-2.5 text-[13px] text-white bg-[#059669] rounded-[4px] hover:bg-[#047857] transition-colors disabled:opacity-50">
          <Users size={14} className="inline mr-1" />布置到班级
        </button>
      </div>
    </div>
  )

  // ===== 文档模式左栏：只读元数据 + 已选题目列表 =====
  const docLeftPanel = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <h3 className="text-[13px] font-semibold text-[#353535]">{sheetTitle || '练习题'}</h3>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[#9A9A9A]">
            <span>{teaching.subject} · {teaching.grade}</span>
            <span>|</span>
            <span>{DIFFICULTY_LABELS[difficulty]}</span>
            <span>|</span>
            <span>{questions.length} 题</span>
          </div>
          {targetClass && <p className="mt-1 text-[11px] text-[#059669]">布置班级: {targetClass}</p>}
        </div>

        {questions.length > 0 ? (
          <div>
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
          <p className="text-[11px] text-[#9A9A9A]">尚未生成题目，请在 AI 模式生成</p>
        )}
      </div>

      <div className="px-5 py-3 border-t border-[#F0F0F0] bg-white shrink-0 flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 px-4 py-2.5 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] disabled:opacity-50">保存草稿</button>
        <button onClick={handlePublish} disabled={saving || questions.length === 0}
          className="flex-1 px-4 py-2.5 text-[13px] text-white bg-[#059669] rounded-[4px] hover:bg-[#047857] disabled:opacity-50">
          <Users size={14} className="inline mr-1" />布置到班级
        </button>
      </div>
    </div>
  )

  const previewQuestions = useMemo(() => questions, [questions])
  const previewMeta: ExamMeta = useMemo(() => ({
    title: sheetTitle || '练习题',
    subject: teaching.subject,
    grade: String(teaching.grade || ''),
    totalScore: 100,
  }), [sheetTitle, teaching.subject, teaching.grade])

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
      subtitle="AI辅助生成题单，选好知识点直接布置到班级"
      leftCollapsible={editMode === 'secondary'}
      leftCollapsed={leftPanelCollapsed}
      onToggleLeft={() => setLeftPanelCollapsed(prev => !prev)}
    />
  )
}
