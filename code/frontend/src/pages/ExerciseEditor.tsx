import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Edit, Eye, Copy, Save, Check, Code2 } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { api } from '../lib/api'
import FormulaRender, { renderFormulaText } from '../components/FormulaRender'
import 'katex/dist/katex.min.css'

const TYPE_LABELS: Record<string, string> = {
  choice: '选择', fill: '填空', calculation: '计算', judge: '判断',
  match: '匹配', cloze: '完形', reading: '阅读', essay: '解答',
  drawing: '作图', writing: '写作',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  L1: '基础', L2: '中等', L3: '进阶', L4: '挑战',
}

function toArr(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); if (Array.isArray(p)) return p as string[] } catch { /* ignore */ }
  }
  return []
}

export default function ExerciseEditor() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'

  // 从真实 API 按 id 拉取题目（MOCK_DATA 仅 q1–q8，与列表真实 UUID 不匹配，会误报"题目不存在"）
  const [question, setQuestion] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    api(`/exercises/${id}`)
      .then((q: any) => setQuestion(q ? { ...q, knowledge_points: toArr(q.knowledge_points) } : null))
      .catch(() => setQuestion(null))
      .finally(() => setLoading(false))
  }, [id])

  // 编辑模式下的状态
  const [editContent, setEditContent] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editType, setEditType] = useState('choice')
  const [editDifficulty, setEditDifficulty] = useState('L1')
  const [editAnalysis, setEditAnalysis] = useState('')
  const [editScore, setEditScore] = useState(10)
  const [editKnowledge, setEditKnowledge] = useState('')
  const [editDifferentiation, setEditDifferentiation] = useState('0.3')
  const [saving, setSaving] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)
  // 编辑模式：源码/预览切换
  const [showRawContent, setShowRawContent] = useState(false)
  const [showRawAnswer, setShowRawAnswer] = useState(false)

  // 题目加载完成后同步进编辑态
  useEffect(() => {
    if (!question) return
    setEditContent(question.content || '')
    setEditAnswer(question.answer || '')
    setEditType(question.type || 'choice')
    setEditDifficulty(question.difficulty || 'L1')
    setEditAnalysis(question.analysis || question.answer_detail || '')
    setEditScore(question.score || 10)
    setEditKnowledge(Array.isArray(question.knowledge_points) ? question.knowledge_points.join('，') : '')
    setEditDifferentiation(question.differentiation || '0.3')
  }, [question])

  const [saveMsg, setSaveMsg] = useState('')

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-[13px] text-[#9A9A9A]">加载中…</p>
        </div>
      </AppLayout>
    )
  }

  if (!question) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-[13px] text-[#9A9A9A]">题目不存在或已删除</p>
        </div>
      </AppLayout>
    )
  }

  // 草稿 → 直接编辑；已发布 + preview → 预览模式
  const isEditMode = question.status === 'draft' || (!isPreview && question.status === 'published')

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      await api(`/exercises/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          stem: editContent, answer: editAnswer,
          question_type: editType, difficulty: editDifficulty,
          analysis: editAnalysis, score: editScore,
          knowledge_points: editKnowledge, differentiation: editDifferentiation,
        }),
      })
      setSaveMsg('保存成功')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (e: any) {
      setSaveMsg('保存失败: ' + (e.message || '网络错误'))
      setTimeout(() => setSaveMsg(''), 3000)
    } finally { setSaving(false) }
  }

  return (
    <AppLayout>
      <div className="space-y-4 max-w-3xl">
        {/* 保存成功提示 */}
        {saveMsg && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-[4px] shadow-lg text-[13px] animate-pulse">
            <Check size={14} /> {saveMsg}
          </div>
        )}
        {/* 返回 + 标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/exercises')} className="p-1.5 hover:bg-[#F6F7F8] rounded-[4px]">
              <ArrowLeft size={16} className="text-[#9A9A9A]" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#353535]">
                {isEditMode ? '编辑题目' : '预览题目'}
              </h1>
              <p className="text-[11px] text-[#9A9A9A] mt-0.5">题目 ID: {question.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPreview && (
              <>
                <button
                  onClick={() => navigate(`/exercises/${id}`)}
                  className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors"
                >
                  <Edit size={14} /> 编辑
                </button>
                <button
                  onClick={() => setShowTemplate(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-[13px] border border-[#E7E7EB] text-[#353535] rounded-[4px] hover:bg-[#F6F7F8] transition-colors"
                >
                  <Copy size={14} /> 存为模板
                </button>
                </>
              )}
            {isEditMode && (
              <button
                onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors disabled:opacity-50"
              >
                {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 保存中...</> : <><Save size={14} /> 保存</>}
              </button>
            )}
          </div>
        </div>

        {/* 题目卡片 */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
          {/* 状态栏 */}
          <div className="flex items-center gap-4 px-5 py-3 bg-[#F6F7F8] border-b border-[#E7E7EB]">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium ${
              question.status === 'published' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${question.status === 'published' ? 'bg-green-500' : 'bg-yellow-500'}`} />
              {question.status === 'published' ? '已发布' : '草稿'}
            </span>
            <span className="text-[11px] text-[#9A9A9A]">{TYPE_LABELS[question.type] || question.type}</span>
            <span className="text-[11px] text-[#9A9A9A]">{DIFFICULTY_LABELS[question.difficulty] || question.difficulty}</span>
            <span className="text-[11px] text-[#9A9A9A]">{question.subject} · {question.grade}</span>
            <span className="ml-auto text-[11px] text-[#9A9A9A]">更新于 {question.updated_at}</span>
          </div>

          <div className="p-5 space-y-4">
            {/* 题目内容 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] font-medium text-[#353535]">题目内容</label>
                {isEditMode && (
                  <button onClick={() => setShowRawContent(!showRawContent)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${showRawContent ? 'bg-[#02A7F0]/10 border-[#02A7F0] text-[#02A7F0]' : 'border-[#E7E7EB] text-[#9A9A9A]'} hover:border-[#02A7F0]`}
                  >
                    <Code2 size={10} /> {showRawContent ? '预览' : '源码'}
                  </button>
                )}
              </div>
              {isEditMode && showRawContent ? (
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                  rows={4} className="w-full px-3 py-2 text-[13px] font-mono border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] resize-y"
                  placeholder="题干 · 支持 $$LaTeX公式$$ 语法" />
              ) : (
                <div className={`p-3 rounded-[4px] text-[13px] leading-relaxed text-[#353535] min-h-[60px] ${isEditMode ? 'border border-[#E7E7EB] bg-[#FAFBFC]' : 'bg-[#F6F7F8]'}`}>
                  {isEditMode ? (
                    <FormulaRender text={editContent} editable onChange={setEditContent} />
                  ) : (
                    renderFormulaText(question.content || '')
                  )}
                </div>
              )}
            </div>

            {/* 答案 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] font-medium text-[#353535]">参考答案</label>
                {isEditMode && (
                  <button onClick={() => setShowRawAnswer(!showRawAnswer)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${showRawAnswer ? 'bg-[#02A7F0]/10 border-[#02A7F0] text-[#02A7F0]' : 'border-[#E7E7EB] text-[#9A9A9A]'} hover:border-[#02A7F0]`}
                  >
                    <Code2 size={10} /> {showRawAnswer ? '预览' : '源码'}
                  </button>
                )}
              </div>
              {isEditMode && showRawAnswer ? (
                <textarea value={editAnswer} onChange={e => setEditAnswer(e.target.value)}
                  rows={2} className="w-full px-3 py-2 text-[13px] font-mono border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] resize-y"
                  placeholder="答案 · 支持 $$LaTeX公式$$ 语法" />
              ) : (
                <div className={`p-3 rounded-[4px] text-[13px] leading-relaxed text-[#353535] min-h-[36px] ${isEditMode ? 'border border-[#E7E7EB] bg-[#FAFBFC]' : 'bg-[#F6F7F8]'}`}>
                  {isEditMode ? (
                    <FormulaRender text={editAnswer} editable onChange={setEditAnswer} />
                  ) : (
                    renderFormulaText(question.answer || '')
                  )}
                </div>
              )}
            </div>

            {/* 编辑模式下额外字段 */}
            {isEditMode && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] text-[#9A9A9A] mb-1.5">题型</label>
                  <select value={editType} onChange={e => setEditType(e.target.value)}
                    className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-[#9A9A9A] mb-1.5">难度</label>
                  <select value={editDifficulty} onChange={e => setEditDifficulty(e.target.value)}
                    className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
                    {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 知识点标签 */}
        {question.knowledge_points.length > 0 && (
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-5">
            <h3 className="text-[13px] font-semibold text-[#353535] mb-3">关联知识点</h3>
            <div className="flex flex-wrap gap-2">
              {question.knowledge_points.map((kp: string, i: number) => (
                <span key={i} className="px-2.5 py-1 text-[11px] bg-[#F6F7F8] text-[#353535] rounded-full">{kp}</span>
              ))}
            </div>
          </div>
        )}

        {/* 使用统计（发布后的预览） */}
        {isPreview && question.status === 'published' && (
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-5">
            <h3 className="text-[13px] font-semibold text-[#353535] mb-3">使用统计</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-[#F6F7F8] rounded-[4px]">
                <div className="text-2xl font-bold text-[#353535]">{question.usage_count}</div>
                <div className="text-[11px] text-[#9A9A9A] mt-1">使用次数</div>
              </div>
              <div className="text-center p-3 bg-[#F6F7F8] rounded-[4px]">
                <div className="text-2xl font-bold text-[#353535]">-</div>
                <div className="text-[11px] text-[#9A9A9A] mt-1">正确率</div>
              </div>
              <div className="text-center p-3 bg-[#F6F7F8] rounded-[4px]">
                <div className="text-2xl font-bold text-[#353535]">-</div>
                <div className="text-[11px] text-[#9A9A9A] mt-1">平均评分</div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* 存为模板弹层 */}
      {showTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowTemplate(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-[6px] shadow-xl w-[380px] max-w-[90vw] z-10" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-[#F0F0F0] flex items-center gap-2">
              <Copy size={16} className="text-[#02A7F0]" />
              <span className="text-[13px] font-semibold text-[#353535]">存为模板</span>
            </div>
            <div className="p-5">
              <label className="block text-[11px] text-[#9A9A9A] mb-1.5">模板名称</label>
              <input type="text" defaultValue={question?.content?.slice(0, 20) || '题目模板'}
                className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" />
              <p className="mt-3 text-[11px] text-[#9A9A9A]">保存后可在「出题·题库」快速复用此题目模板</p>
            </div>
            <div className="px-5 py-3 border-t border-[#F0F0F0] flex justify-end gap-2">
              <button onClick={() => setShowTemplate(false)} className="px-4 py-1.5 text-[12px] text-[#595959] border border-[#E7E7EB] rounded-[4px] hover:bg-[#F6F7F8]">取消</button>
              <button onClick={() => { setShowTemplate(false) }} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1]">保存模板</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}