import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Star } from 'lucide-react'

const MOCK_DETAIL = {
  plan: { id: '1', title: '《观潮》第一课时', author: '张老师', grade: '四年级', subject: '语文', content: '## 一、教学目标\n### 知识与技能\n- 理解课文的主要内容...' },
  reviews: [
    { reviewer: '李老师', score: 4, comment: '教学目标明确，教学过程设计合理。建议增加更多学生互动环节。', created_at: '2026-06-18 14:00' },
  ]
}

export default function ReviewDetail() {
  const nav = useNavigate()
  const detail = MOCK_DETAIL

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18} className="text-gray-500" /></button>
        <div><h1 className="text-xl font-bold text-gray-900">教案评审</h1><p className="text-sm text-gray-500">{detail.plan.title} · {detail.plan.author}</p></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4"><FileText size={18} className="text-brand" /><span className="font-semibold">{detail.plan.title}</span><span className="text-xs text-gray-400">{detail.plan.grade} · {detail.plan.subject}</span></div>
        <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">{detail.plan.content}</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">评审意见（{detail.reviews.length}）</h3>
        {detail.reviews.map((r, i) => (
          <div key={i} className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
            <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center shrink-0 text-xs font-bold text-brand">{r.reviewer[0]}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">{r.reviewer}</span>
                <div className="flex">{Array.from({ length: 5 }, (_, j) => <Star key={j} size={12} className={j < r.score ? 'text-amber-400 fill-current' : 'text-gray-200'} />)}</div>
                <span className="text-xs text-gray-400 ml-auto">{r.created_at}</span>
              </div>
              <p className="text-sm text-gray-600">{r.comment}</p>
            </div>
          </div>
        ))}

        <div className="mt-6 pt-4 border-t border-gray-100">
          <textarea placeholder="输入你的评审意见..." className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 min-h-[100px] resize-y" />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => <Star key={i} size={18} className="text-gray-200 cursor-pointer hover:text-amber-400" />)}
            </div>
            <button className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover">提交评审</button>
          </div>
        </div>
      </div>
    </div>
  )
}
