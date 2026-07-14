import { useState, useMemo, useEffect } from 'react'
import { useToast } from '../components/Toast'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Edit, Copy, Save, Eye } from 'lucide-react'
import { api } from '../lib/api'
import AppLayout from '../components/AppLayout'
import ExamPreview, { type ExamQuestion, type ExamMeta } from '../components/ExamPreview'

const TYPE_LABELS: Record<string, string> = {
  choice: '选择', fill: '填空', judge: '判断',
  match: '匹配', cloze: '完形', reading: '阅读', writing: '写作',
}

const MOCK_DATA: Record<string, any> = {
  'e1': { id: 'e1', title: '四年级语文第一单元检测', subject: '语文', grade: '四年级', question_count: 15, total_score: 100, duration: 40, status: 'published', updated_at: '2026-07-03', type_breakdown: { choice: 6, fill: 3, judge: 2, reading: 3, writing: 1 }, knowledge_points: ['边读边想象画面', '感受自然之美', '推荐一个好地方'] },
  'e2': { id: 'e2', title: '四年级语文期中考试卷', subject: '语文', grade: '四年级', question_count: 25, total_score: 100, duration: 60, status: 'published', updated_at: '2026-06-25', type_breakdown: { choice: 8, fill: 5, judge: 4, reading: 5, writing: 3 }, knowledge_points: ['阅读时尝试提问', '从不同角度提问', '连续观察方法', '准确生动表达'] },
  'e3': { id: 'e3', title: '《观潮》课内阅读练习', subject: '语文', grade: '四年级', question_count: 8, total_score: 50, duration: 20, status: 'draft', updated_at: '2026-07-04', type_breakdown: { choice: 3, fill: 2, reading: 2, writing: 1 }, knowledge_points: ['边读边想象画面', '感受自然之美'] },
}

export default function ExamEditor() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'
  const { toast } = useToast()
  const exam = useMemo(() => (id ? MOCK_DATA[id] : null), [id])

  const [editTitle, setEditTitle] = useState(exam?.title || '')
  const [saving, setSaving] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)

  if (!exam) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-[13px] text-[#9A9A9A]">试卷不存在或已删除</div>
      </AppLayout>
    )
  }

  const isEditMode = exam.status === 'draft'

  // 打开试卷预览（走真实 API 获取题目数据）
  const openPreview = async () => {
    try {
      const res = await api<{ questions: string; title: string; subject: string; grade: string; total_score: number; duration_minutes: number }>(`/exams/${id}`)
      const parsed = typeof res.questions === 'string' ? JSON.parse(res.questions || '[]') : (res.questions || [])
      setPreviewData({
        questions: parsed.filter((q: any) => q.stem || q.content).map((q: any) => ({
          id: q.id || '', stem: q.stem || q.content || '', type: q.type || 'choice',
          options: q.options || '', answer: q.answer || '', analysis: q.analysis || '',
          difficulty: q.difficulty, score: q.score, sort: q.sort,
        })),
        meta: { title: editTitle || exam.title, subject: exam.subject, grade: exam.grade, totalScore: exam.total_score, durationMinutes: exam.duration },
      })
      setPreviewOpen(true)
    } catch { /* ignore */ }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (id) {
        await api(`/exams/${id}`, { method: 'PUT', body: JSON.stringify({ title: editTitle }) })
      }
      toast('保存成功', 'success')
    } catch { toast('保存失败', 'error') }
    finally { setSaving(false) }
  }

  const totalTypes = Object.entries(exam.type_breakdown || {})
    .filter(([_, c]) => (c as number) > 0)

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
                <button onClick={openPreview}
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
            <span className="ml-auto text-[11px] text-[#9A9A9A]">更新于 {exam.updated_at}</span>
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
                { label: '总分', value: `${exam.total_score} 分` },
                { label: '题量', value: `${exam.question_count} 题` },
                { label: '时长', value: `${exam.duration || 40} 分钟` },
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
                {(totalTypes as [string, number][]).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between px-3 py-2 bg-[#F6F7F8] rounded-[4px]">
                    <span className="text-[12px] text-[#353535]">{TYPE_LABELS[type as string] || (type as string)}</span>
                    <span className="text-[12px] font-medium text-[#02A7F0]">{count} 题</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 知识点 */}
        {exam.knowledge_points?.length > 0 && (
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-5">
            <h3 className="text-[13px] font-semibold text-[#353535] mb-3">考察知识点</h3>
            <div className="flex flex-wrap gap-2">
              {exam.knowledge_points.map((kp: string, i: number) => (
                <span key={i} className="px-2.5 py-1 text-[11px] bg-[#F6F7F8] text-[#353535] rounded-full">{kp}</span>
              ))}
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
        <ExamPreview questions={previewData.questions} meta={previewData.meta} onClose={() => setPreviewOpen(false)} />
      )}
    </AppLayout>
  )
}
