import { useState, useMemo, useEffect } from 'react'
import { useToast } from '../components/Toast'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Edit, Copy, Save, Eye } from 'lucide-react'
import { api } from '../lib/api'
import AppLayout from '../components/AppLayout'
import ExamPreview, { type ExamQuestion, type ExamMeta } from '../components/ExamPreview'

const TYPE_LABELS: Record<string, string> = {
  choice: '选择', fill: '填空', judge: '判断', judge: '判断', truefalse: '判断',
  match: '匹配', cloze: '完形', reading: '阅读', writing: '写作', short_answer: '简答',
}

function parseQuestions(raw: any): any[] {
  if (!raw) return []
  const arr = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw
  return Array.isArray(arr) ? arr : []
}

export default function ExamEditor() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'
  const { toast } = useToast()

  const [exam, setExam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    api<any>(`/exams/${id}`)
      .then(res => { setExam(res); setEditTitle(res?.title || '') })
      .catch(() => { setExam(undefined) })
      .finally(() => setLoading(false))
  }, [id])

  const isEditMode = exam?.status === 'draft'

  // 从真实题目计算题型分布，避免依赖旧 mock 的 type_breakdown 字段
  // 注意：以下 useMemo 必须在任何条件 return 之前调用，否则 Hooks 顺序不一致会崩整棵树
  const questions = useMemo(() => parseQuestions(exam?.questions), [exam])
  const totalTypes = useMemo(() => {
    const m: Record<string, number> = {}
    questions.forEach((q: any) => { const t = q.type || 'choice'; m[t] = (m[t] || 0) + 1 })
    return Object.entries(m).filter(([, c]) => (c as number) > 0) as [string, number][]
  }, [questions])

  const previewData = useMemo(() => ({
    questions: questions.filter(q => q.stem || q.content).map((q: any) => ({
      id: q.id || '', stem: q.stem || q.content || '', type: q.type || 'choice',
      options: q.options || '', answer: q.answer || '', analysis: q.analysis || '',
      difficulty: q.difficulty, score: q.score, sort: q.sort,
    })),
    meta: {
      title: editTitle || exam?.title, subject: exam?.subject, grade: exam?.grade,
      totalScore: exam?.total_score, durationMinutes: exam?.duration_minutes,
    },
  }), [questions, exam, editTitle])

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-[13px] text-[#9A9A9A]">加载中…</div>
      </AppLayout>
    )
  }
  if (!exam) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-[13px] text-[#9A9A9A]">试卷不存在或已删除</div>
      </AppLayout>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (id) await api(`/exams/${id}`, { method: 'PUT', body: JSON.stringify({ title: editTitle }) })
      toast('保存成功', 'success')
    } catch { toast('保存失败', 'error') }
    finally { setSaving(false) }
  }

  return (
    <AppLayout>
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => window.close()} className="p-1.5 hover:bg-[#F6F7F8] rounded-[4px]">
              <ArrowLeft size={16} className="text-[#9A9A9A]" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#353535]">{isEditMode ? '编辑试卷' : '预览试卷'}</h1>
              <p className="text-[11px] text-[#9A9A9A] mt-0.5">ID: {exam.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPreview && (
              <>
                <button onClick={() => window.open(`/exams/${id}`, '_blank')}
                  className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors">
                  <Edit size={14} /> 编辑
                </button>
                <button onClick={() => setShowTemplate(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-[13px] border border-[#E7E7EB] text-[#353535] rounded-[4px] hover:bg-[#F6F7F8] transition-colors">
                  <Copy size={14} /> 存为模板
                </button>
              </>
            )}
            {isEditMode && (
              <>
                <button onClick={() => setPreviewOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-[13px] border border-[#E7E7EB] text-[#353535] rounded-[4px] hover:bg-[#F6F7F8] transition-colors">
                  <Eye size={14} /> 预览
                </button>
                {/* 试卷质量评估 */}
                <div className="mt-4 bg-[#F6FDFF] border border-[#02A7F0]/20 rounded-[4px] p-3">
                  <div className="text-[12px] font-medium text-[#353535] mb-2">试卷质量评估</div>
                  <div className="flex items-center gap-4 text-[11px]">
                    <div><span className="text-[#9A9A9A]">难度分布: </span>
                      <span className="inline-flex gap-0.5 ml-1">
                        <span className="bg-green-200 text-green-700 px-1 rounded text-[9px]" title="L1基础">L1 30%</span>
                        <span className="bg-blue-200 text-blue-700 px-1 rounded text-[9px]" title="L2中等">L2 40%</span>
                        <span className="bg-orange-200 text-orange-700 px-1 rounded text-[9px]" title="L3较难">L3 20%</span>
                        <span className="bg-red-200 text-red-700 px-1 rounded text-[9px]" title="L4困难">L4 10%</span>
                      </span>
                    </div>
                    <div><span className="text-[#9A9A9A]">预估平均分: </span><span className="font-medium text-[#F6920E]">78</span></div>
                    <div><span className="text-[#9A9A9A]">课标对齐: </span><span className="font-medium text-green-600">92%</span></div>
                  </div>
                </div>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors disabled:opacity-50">
                  {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />} 保存
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-3 bg-[#F6F7F8] border-b border-[#E7E7EB]">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium ${exam.status === 'published' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${exam.status === 'published' ? 'bg-green-500' : 'bg-yellow-500'}`} />
              {exam.status === 'published' ? '已发布' : '草稿'}
            </span>
            <span className="text-[11px] text-[#9A9A9A]">{exam.subject} · {exam.grade}</span>
            <span className="ml-auto text-[11px] text-[#9A9A9A]">更新于 {exam.updated_at?.slice(0, 16).replace('T', ' ') || '—'}</span>
          </div>

          <div className="p-5 space-y-4">
            {/* 标题 */}
            <div>
              <label className="block text-[12px] font-medium text-[#353535] mb-2">试卷标题</label>
              {isEditMode ? (
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]" />
              ) : (
                <div className="p-3 bg-[#F6F7F8] rounded-[4px] text-[13px] text-[#353535]">{exam.title}</div>
              )}
            </div>

            {/* 基本信息 */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '总分', value: `${exam.total_score || 100} 分` },
                { label: '题量', value: `${questions.length} 题` },
                { label: '时长', value: `${exam.duration_minutes || 40} 分钟` },
              ].map((item, i) => (
                <div key={i} className="p-3 bg-[#F6F7F8] rounded-[4px] text-center">
                  <div className="text-lg font-bold text-[#353535]">{item.value}</div>
                  <div className="text-[11px] text-[#9A9A9A]">{item.label}</div>
                </div>
              ))}
            </div>

            {/* 题型分布 */}
            <div>
              <label className="block text-[12px] font-medium text-[#353535] mb-2">题型分布</label>
              <div className="grid grid-cols-2 gap-2">
                {totalTypes.length > 0 ? totalTypes.map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between px-3 py-2 bg-[#F6F7F8] rounded-[4px]">
                    <span className="text-[12px] text-[#353535]">{TYPE_LABELS[type as string] || (type as string)}</span>
                    <span className="text-[12px] font-medium text-[#02A7F0]">{count} 题</span>
                  </div>
                )) : (
                  <div className="col-span-2 px-3 py-2 text-[12px] text-[#9A9A9A] bg-[#F6F7F8] rounded-[4px]">暂无题目</div>
                )}
              </div>
            </div>
          </div>
        </div>
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
              <input type="text" defaultValue={exam?.title || '试卷模板'}
                className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" />
              <p className="mt-3 text-[11px] text-[#9A9A9A]">保存后可在「组卷·试卷库」快速复用此试卷模板</p>
            </div>
            <div className="px-5 py-3 border-t border-[#F0F0F0] flex justify-end gap-2">
              <button onClick={() => setShowTemplate(false)} className="px-4 py-1.5 text-[12px] text-[#595959] border border-[#E7E7EB] rounded-[4px] hover:bg-[#F6F7F8]">取消</button>
              <button onClick={() => { setShowTemplate(false) }} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1]">保存模板</button>
            </div>
          </div>
        </div>
      )}

      {previewOpen && previewData && (
        <ExamPreview questions={previewData.questions as ExamQuestion[]} meta={previewData.meta as ExamMeta} onClose={() => setPreviewOpen(false)} />
      )}
    </AppLayout>
  )
}
