import { useState, useMemo } from 'react'
import { useToast } from '../components/Toast'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Edit, Copy, Save } from 'lucide-react'
import { api } from '../lib/api'
import AppLayout from '../components/AppLayout'

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
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors disabled:opacity-50">
                {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />} 保存
              </button>
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
                {totalTypes.map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between px-3 py-2 bg-[#F6F7F8] rounded-[4px]">
                    <span className="text-[12px] text-[#353535]">{TYPE_LABELS[type] || type}</span>
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
    </AppLayout>
  )
}
