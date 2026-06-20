import { FileImage, Plus, Search } from 'lucide-react'

const MOCK_COMPOSITIONS = [
  { id: '1', title: '我的妈妈', student: '李明', grade: '三年级', status: 'submitted', submitted_at: '2026-06-17 08:30', ai_score: 85, confidence: 0.92 },
  { id: '2', title: '难忘的一天', student: '王小红', grade: '三年级', status: 'ai_graded', submitted_at: '2026-06-16 15:00', ai_score: 78, confidence: 0.85 },
  { id: '3', title: '春天来了', student: '张伟', grade: '三年级', status: 'teacher_confirmed', submitted_at: '2026-06-15 10:00', ai_score: 92, confidence: 0.95 },
  { id: '4', title: '我的理想', student: '刘洋', grade: '三年级', status: 'submitted', submitted_at: '2026-06-17 09:15', ai_score: null, confidence: null },
]

export default function CompositionList() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">习作指导</h1>
          <p className="text-sm text-gray-500 mt-1">学生拍照上传作文，AI 自动批改 + 四维评分</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-[#1A3A6B] text-white rounded-lg hover:bg-[#2B5DA8] shadow-sm">
          <Plus size={18} /> 布置作文
        </button>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="搜索作文..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg" />
        </div>
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          <option>全部状态</option><option>待批阅</option><option>AI已评分</option><option>已确认</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">作文标题</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">学生</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">提交时间</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">AI评分</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">置信度</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {MOCK_COMPOSITIONS.map(item => (
              <tr key={item.id} className="hover:bg-gray-50/50 cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileImage size={16} className="text-blue-400" />
                    <span className="text-sm font-medium text-gray-900">{item.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.student}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.submitted_at}</td>
                <td className="px-4 py-3 text-center">
                  {item.ai_score ? (
                    <span className={`text-sm font-bold ${item.ai_score >= 85 ? 'text-green-600' : item.ai_score >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {item.ai_score}分
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">待评分</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.confidence ? (
                    <span className={`text-xs ${item.confidence >= 0.9 ? 'text-green-500' : 'text-yellow-500'}`}>
                      {(item.confidence * 100).toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.status === 'submitted' && <span className="px-2 py-0.5 text-xs bg-orange-50 text-orange-600 rounded-full">待批阅</span>}
                  {item.status === 'ai_graded' && <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded-full">AI已评分</span>}
                  {item.status === 'teacher_confirmed' && <span className="px-2 py-0.5 text-xs bg-green-50 text-green-600 rounded-full">已确认</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
