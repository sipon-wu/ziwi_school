import { useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, AlertTriangle, Check, Edit3 } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { ListSkeleton, EmptyState } from '../components/StateComponents'

const MOCK_GRADING_ITEMS: any[] = [
  { id: '1', student: '李明', assignment: '分数加减法练习', subject: '数学', type: 'exercise', ai_score: 95, confidence: 0.98, status: 'ai_graded', submitted_at: '2026-06-17 08:30', total_questions: 10, correct: 9 },
  { id: '2', student: '王小红', assignment: '分数加减法练习', subject: '数学', type: 'exercise', ai_score: 80, confidence: 0.95, status: 'ai_graded', submitted_at: '2026-06-17 09:00', total_questions: 10, correct: 8 },
  { id: '3', student: '张伟', assignment: '《观潮》课后练习', subject: '语文', type: 'exercise', ai_score: 70, confidence: 0.82, status: 'ai_graded', submitted_at: '2026-06-16 14:00', total_questions: 8, correct: 5 },
  { id: '4', student: '刘洋', assignment: '分数加减法练习', subject: '数学', type: 'exercise', ai_score: null, confidence: null, status: 'pending', submitted_at: '2026-06-17 09:30', total_questions: 10, correct: null },
]

export default function GradingWorkbench() {
  const navigate = useNavigate() // P0-2: 添加导航

  const { data: apiData, loading } = useApi(async () => {
    const res = await fetch('/api/v1/grading',{headers:{Authorization:'Bearer '+localStorage.getItem('zhiwei_token')}})
    return res.json()
  }, { items: MOCK_GRADING_ITEMS })

  if (loading) return <ListSkeleton rows={4} />

  const items = apiData?.items || MOCK_GRADING_ITEMS
  if (items.length === 0) return <EmptyState title="暂无待批阅作业" description="学生们还没有提交新的作业" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">批阅管理</h1>
          <p className="text-sm text-gray-500 mt-1">查看 AI 批阅结果，复核低置信度题目</p>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '待批阅', value: '12', color: 'text-orange-600 bg-orange-50', icon: Clock },
          { label: 'AI已评分', value: '8', color: 'text-blue-600 bg-blue-50', icon: CheckCircle },
          { label: '低置信度', value: '3', color: 'text-red-600 bg-red-50', icon: AlertTriangle },
          { label: '已完成', value: '25', color: 'text-green-600 bg-green-50', icon: Check },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{card.label}</span>
              <div className={`p-1.5 rounded-lg ${card.color}`}><card.icon size={16} /></div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
          </div>
        ))}
      </div>

      {/* 低置信度复核队列 */}
      <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
        <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500" />
          <span className="text-sm font-medium text-red-700">需要教师复核</span>
          <span className="text-xs text-red-400 ml-2">AI 把握不大的批阅结果</span>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-4 p-3 bg-red-50/30 rounded-lg border border-red-100">
            <Edit3 size={16} className="text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">张伟 - 《观潮》课后练习</span>
              <span className="text-xs text-red-500 ml-2">置信度: 82%</span>
            </div>
            <span className="text-xs text-gray-400">AI 得分 70 / 8题中答对5题</span>
            <div className="flex gap-2">
              <button onClick={() => navigate('/dashboard/grading/3')} className="px-3 py-1.5 text-xs bg-[#1A3A6B] text-white rounded-lg hover:bg-[#2B5DA8]">进入批阅</button>
              <button className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">跳过</button>
            </div>
          </div>
        </div>
      </div>

      {/* 批阅列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">学生</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">作业</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">AI评分</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">正确率</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">状态</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.student}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.assignment}</td>
                <td className="px-4 py-3 text-center">
                  {item.ai_score !== null ? (
                    <span className={`text-sm font-bold ${item.ai_score >= 90 ? 'text-green-600' : item.ai_score >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {item.ai_score}分
                    </span>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-center text-sm text-gray-600">
                  {item.correct !== null ? `${item.correct}/${item.total_questions}` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.status === 'ai_graded' && <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded-full">AI已评分</span>}
                  {item.status === 'pending' && <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">待提交</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => item.status === 'ai_graded' && navigate(`/dashboard/grading/${item.id}`)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      item.status === 'ai_graded' ? 'bg-[#1A3A6B] text-white hover:bg-[#2B5DA8]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >批阅</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
