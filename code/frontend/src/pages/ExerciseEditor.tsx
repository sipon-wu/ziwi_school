import { useState, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Edit, Eye, Copy, Save, Check } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { api } from '../lib/api'

const TYPE_LABELS: Record<string, string> = {
  choice: '选择', fill: '填空', calculation: '计算', judge: '判断',
  match: '匹配', cloze: '完形', reading: '阅读', essay: '解答',
  drawing: '作图', writing: '写作',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  L1: '基础', L2: '中等', L3: '进阶', L4: '挑战',
}

const MOCK_DATA: Record<string, any> = {
  'q1': { id: 'q1', content: '下列哪个数是分数？A. 3 B. ½ C. 0.5 D. 5', answer: 'B', subject: '数学', grade: '三年级', type: 'choice', difficulty: 'L1', status: 'published', usage_count: 12, knowledge_points: ['分数的初步认识'], updated_at: '2026-07-04 14:30' },
  'q2': { id: 'q2', content: '一个蛋糕平均分成8份，每份是（  ）/8。', answer: '1', subject: '数学', grade: '三年级', type: 'fill', difficulty: 'L2', status: 'published', usage_count: 8, knowledge_points: ['分数加减法'], updated_at: '2026-07-03 10:15' },
  'q3': { id: 'q3', content: '计算：3/4 + 1/6 = ?', answer: '11/12', subject: '数学', grade: '四年级', type: 'calculation', difficulty: 'L3', status: 'draft', usage_count: 0, knowledge_points: ['分数四则运算'], updated_at: '2026-07-02 16:00' },
  'q4': { id: 'q4', content: '阅读《观潮》选段，回答：作者是按什么顺序描写钱塘江大潮的？', answer: '时间顺序（潮来前→潮来时→潮来后）', subject: '语文', grade: '四年级', type: 'reading', difficulty: 'L2', status: 'published', usage_count: 15, knowledge_points: ['叙述顺序分析'], updated_at: '2026-07-01 09:20' },
  'q5': { id: 'q5', content: '2/5 读作：A. 二分之五 B. 五分之二 C. 五分二 D. 二五', answer: 'B', subject: '数学', grade: '三年级', type: 'choice', difficulty: 'L1', status: 'draft', usage_count: 0, knowledge_points: ['分数的意义'], updated_at: '2026-06-30 11:45' },
  'q6': { id: 'q6', content: '下列词语中，没有错别字的一项是：A. 蜿蜒 B. 蜿蜒 C. 蜿蜒 D. 蜿蜒', answer: 'A', subject: '语文', grade: '四年级', type: 'choice', difficulty: 'L1', status: 'published', usage_count: 6, knowledge_points: ['字形辨析'], updated_at: '2026-06-28 08:00' },
  'q7': { id: 'q7', content: '一个长方形的长是8cm，宽是5cm，面积是多少平方厘米？', answer: '40平方厘米', subject: '数学', grade: '三年级', type: 'calculation', difficulty: 'L1', status: 'draft', usage_count: 0, knowledge_points: ['长方形面积'], updated_at: '2026-06-25 13:30' },
  'q8': { id: 'q8', content: 'There ___ some milk in the glass. A. is B. are C. has D. have', answer: 'A', subject: '英语', grade: '五年级', type: 'choice', difficulty: 'L2', status: 'published', usage_count: 10, knowledge_points: ['There be句型'], updated_at: '2026-06-22 15:00' },
}

export default function ExerciseEditor() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'

  const question = useMemo(() => (id ? MOCK_DATA[id] : null), [id])

  // 编辑模式下的状态
  const [editContent, setEditContent] = useState(question?.content || '')
  const [editAnswer, setEditAnswer] = useState(question?.answer || '')
  const [editType, setEditType] = useState(question?.type || 'choice')
  const [editDifficulty, setEditDifficulty] = useState(question?.difficulty || 'L1')
  const [saving, setSaving] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)

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

  const [saveMsg, setSaveMsg] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      await api(`/exercises/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          stem: editContent, answer: editAnswer,
          question_type: editType, difficulty: editDifficulty,
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
              <label className="block text-[12px] font-medium text-[#353535] mb-2">题目内容</label>
              {isEditMode ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] resize-y"
                />
              ) : (
                <div className="p-3 bg-[#F6F7F8] rounded-[4px]">
                  <p className="text-[13px] text-[#353535] leading-relaxed">{question.content}</p>
                </div>
              )}
            </div>

            {/* 答案 */}
            <div>
              <label className="block text-[12px] font-medium text-[#353535] mb-2">参考答案</label>
              {isEditMode ? (
                <input
                  type="text"
                  value={editAnswer}
                  onChange={e => setEditAnswer(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]"
                />
              ) : (
                <div className="p-3 bg-[#F6F7F8] rounded-[4px]">
                  <p className="text-[13px] text-[#353535]">{question.answer}</p>
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