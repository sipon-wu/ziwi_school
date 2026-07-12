import { useState, useMemo } from 'react'
import { useToast } from '../components/Toast'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Edit, Copy, Save } from 'lucide-react'
import AppLayout from '../components/AppLayout'

const MOCK_DATA: Record<string, any> = {
  'a1': { id: 'a1', title: '《观潮》课内阅读练习', class_name: '四年级 (1)班', subject: '语文', grade: '四年级', question_count: 3, status: 'published', due_at: '2026-07-06', submissions: 32, total_students: 42, description: '请认真阅读课文后完成相关练习题。', questions: [
    { id: 'q1', type: 'choice', content: '下列选项中描写了钱塘江大潮的是？A.《观潮》 B.《走月亮》 C.《爬山虎的脚》' },
    { id: 'q2', type: 'fill', content: '"宽阔"的反义词是？' },
    { id: 'q4', type: 'reading', content: '阅读《观潮》选段，回答：作者是按什么顺序描写钱塘江大潮的？' },
  ]},
  'a2': { id: 'a2', title: '修辞手法专项训练', class_name: '四年级 (1)班', subject: '语文', grade: '四年级', question_count: 3, status: 'published', due_at: '2026-07-04', submissions: 28, total_students: 42, description: '完成比喻、拟人、排比三种修辞手法的专项练习题。', questions: [
    { id: 's1', type: 'choice', content: '下列哪个词语是拟声词？A. 哗哗 B. 美丽 C. 跑步' },
    { id: 's4', type: 'fill', content: '将下列句子改为排比句：春天来了' },
    { id: 'q1', type: 'choice', content: '下列选项中描写了钱塘江大潮的是？A.《观潮》 B.《走月亮》 C.《爬山虎的脚》' },
  ]},
  'a3': { id: 'a3', title: '第一单元综合检测', class_name: '四年级 (2)班', subject: '语文', grade: '四年级', question_count: 0, status: 'scheduled', scheduled_at: '2026-07-08 08:00', due_at: '2026-07-10', submissions: 0, total_students: 40, description: '第一单元综合检测卷，限时40分钟。', questions: [] },
  'a4': { id: 'a4', title: '自然之美写景练习', class_name: '四年级 (1)班', subject: '语文', grade: '四年级', question_count: 0, status: 'draft', due_at: '', submissions: 0, total_students: 42, description: '', questions: [] },
}

const TYPE_LABELS: Record<string, string> = { choice: '选择', fill: '填空', judge: '判断', match: '匹配', cloze: '完形', reading: '阅读', writing: '写作' }

export default function AssignmentEditor() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'
  const { toast } = useToast()
  const assignment = useMemo(() => (id ? MOCK_DATA[id] : null), [id])

  const [editTitle, setEditTitle] = useState(assignment?.title || '')
  const [saving, setSaving] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)

  if (!assignment) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-[13px] text-[#9A9A9A]">作业不存在或已删除</div>
      </AppLayout>
    )
  }

  const isDraft = assignment.status === 'draft'
  const qCount = assignment.questions?.length || assignment.question_count || 0

  return (
    <AppLayout>
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => window.close()} className="p-1.5 hover:bg-[#F6F7F8] rounded-[4px]">
              <ArrowLeft size={16} className="text-[#9A9A9A]" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#353535]">{isDraft ? '编辑作业' : '作业详情'}</h1>
              <p className="text-[11px] text-[#9A9A9A] mt-0.5">{assignment.class_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPreview && (
              <>
                <button onClick={() => window.open(`/assignments/${id}`, '_blank')}
                  className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors">
                  <Edit size={14} /> 编辑
                </button>
                <button onClick={() => setShowTemplate(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-[13px] border border-[#E7E7EB] text-[#353535] rounded-[4px] hover:bg-[#F6F7F8] transition-colors">
                  <Copy size={14} /> 存为模板
                </button>
              </>
            )}
            {isDraft && (
              <button onClick={async () => {
                setSaving(true)
                try {
                  const tok = localStorage.getItem('zhiwei_token')
                  const res = await fetch('/api/assignments/' + assignment.id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}` },
                    body: JSON.stringify({ title: editTitle, subject: assignment.subject }),
                  })
                  if (!res.ok) throw new Error('HTTP ' + res.status)
                  toast('保存成功', 'success')
                } catch (e: any) { toast('保存失败: ' + (e.message || '网络错误'), 'error') }
                setSaving(false)
              }}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors disabled:opacity-50">
                {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />} 保存
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-3 bg-[#F6F7F8] border-b border-[#E7E7EB]">
            {assignment.status === 'published' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-green-50 text-green-600">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> 已发布
              </span>
            ) : assignment.status === 'scheduled' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-blue-50 text-blue-600">
                定时中 · {assignment.scheduled_at}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-yellow-50 text-yellow-600">
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" /> 草稿
              </span>
            )}
            <span className="ml-auto text-[11px] text-[#9A9A9A]">{assignment.class_name} · {assignment.subject} · {assignment.grade}</span>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[#353535] mb-2">作业标题</label>
              {isDraft ? (
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]" />
              ) : (
                <div className="p-3 bg-[#F6F7F8] rounded-[4px] text-[13px] text-[#353535]">{assignment.title}</div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[#F6F7F8] rounded-[4px] text-center">
                <div className="text-lg font-bold text-[#353535]">{qCount}</div>
                <div className="text-[11px] text-[#9A9A9A]">题目</div>
              </div>
              <div className="p-3 bg-[#F6F7F8] rounded-[4px] text-center">
                <div className="text-lg font-bold text-[#02A7F0]">{assignment.submissions}/{assignment.total_students}</div>
                <div className="text-[11px] text-[#9A9A9A]">已提交</div>
              </div>
              <div className="p-3 bg-[#F6F7F8] rounded-[4px] text-center">
                <div className="text-lg font-bold text-[#353535]">{assignment.due_at || '-'}</div>
                <div className="text-[11px] text-[#9A9A9A]">截止日期</div>
              </div>
            </div>

            {assignment.description && (
              <div>
                <label className="block text-[12px] font-medium text-[#353535] mb-2">作业说明</label>
                <div className="p-3 bg-[#F6F7F8] rounded-[4px] text-[13px] text-[#353535]">{assignment.description}</div>
              </div>
            )}
          </div>
        </div>

        {/* 题目详情 */}
        {assignment.questions?.length > 0 && (
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
            <div className="px-5 py-3 bg-[#F6F7F8] border-b border-[#E7E7EB]">
              <h3 className="text-[13px] font-semibold text-[#353535]">题目详情（共{qCount}题）</h3>
            </div>
            <div className="p-5 space-y-3">
              {assignment.questions.map((q: any, i: number) => (
                <div key={q.id} className="flex items-start gap-3 p-3 bg-[#F6F7F8] rounded-[4px]">
                  <span className="text-sm font-medium text-[#02A7F0] w-5 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#353535] leading-relaxed">{q.content}</p>
                    <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 bg-white rounded text-[#9A9A9A]">
                      {TYPE_LABELS[q.type] || q.type}
                    </span>
                  </div>
                </div>
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
              <input type="text" defaultValue={assignment?.title || '作业模板'}
                className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" />
              <p className="mt-3 text-[11px] text-[#9A9A9A]">保存后可在「作业布置」快速复用此作业模板</p>
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
