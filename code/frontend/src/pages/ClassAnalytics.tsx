import { TrendingUp, Users, FileCheck, Clock, BarChart3, Target } from 'lucide-react'

const KNOWLEDGE_DATA = [
  { name: '分数加减法', mastery: 85, status: 'good' },
  { name: '分数乘除法', mastery: 72, status: 'warning' },
  { name: '分数应用题', mastery: 58, status: 'danger' },
  { name: '小数运算', mastery: 90, status: 'good' },
  { name: '几何图形', mastery: 78, status: 'warning' },
  { name: '单位换算', mastery: 65, status: 'danger' },
]

const STUDENTS = [
  { name: '李明', score: 92, submit_rate: 100, sign_rate: 100, weakness: '—', trend: [88,90,95,92,94,92] },
  { name: '王小红', score: 85, submit_rate: 90, sign_rate: 100, weakness: '分数应用题', trend: [82,85,88,80,85,85] },
  { name: '张伟', score: 72, submit_rate: 80, sign_rate: 60, weakness: '分数乘除法', trend: [75,72,70,68,71,72] },
  { name: '刘洋', score: 88, submit_rate: 100, sign_rate: 100, weakness: '—', trend: [85,88,90,88,87,88] },
  { name: '陈静', score: 78, submit_rate: 100, sign_rate: 80, weakness: '单位换算', trend: [80,82,78,75,79,78] },
]

export default function ClassAnalytics() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">班级学情数据</h1>
          <p className="text-sm text-gray-500 mt-1">全面掌握班级学习情况，精准定位薄弱知识点</p>
        </div>
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
          <option>本周</option><option>本月</option><option>本学期</option>
        </select>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '班级平均分', value: '85分', sub: '较上次↑2分', icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
          { label: '作业完成率', value: '92%', sub: '38/40人按时提交', icon: FileCheck, color: 'bg-green-50 text-green-600' },
          { label: '家长签字率', value: '88%', sub: '35/40人已签', icon: Users, color: 'bg-purple-50 text-purple-600' },
          { label: '平均批阅耗时', value: '2.3天', sub: '较上周↓0.5天', icon: Clock, color: 'bg-orange-50 text-orange-600' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{card.label}</span>
              <div className={`p-1.5 rounded-lg ${card.color}`}><card.icon size={16} /></div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-xs text-gray-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 知识点掌握度 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-[#1A3A6B]" />
            <h3 className="font-semibold text-gray-900">知识点掌握度</h3>
          </div>
          <div className="space-y-3">
            {KNOWLEDGE_DATA.map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{item.name}</span>
                  <span className={`text-sm font-medium ${
                    item.status === 'good' ? 'text-green-600' : item.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                  }`}>{item.mastery}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.status === 'good' ? 'bg-green-500' : item.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${item.mastery}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 学生个体情况 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-[#1A3A6B]" />
            <h3 className="font-semibold text-gray-900">学生个体情况</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs font-medium text-gray-500">姓名</th>
                <th className="text-center py-2 text-xs font-medium text-gray-500">最近得分</th>
                <th className="text-center py-2 text-xs font-medium text-gray-500">提交率</th>
                <th className="text-left py-2 text-xs font-medium text-gray-500">薄弱点</th>
              </tr>
            </thead>
            <tbody>
              {STUDENTS.map((s, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer">
                  <td className="py-2.5 text-sm font-medium text-gray-900">
                    {s.name}
                    {s.score < 75 && <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full" title="重点关注" />}
                  </td>
                  <td className="py-2.5 text-center text-sm">
                    <span className={`font-medium ${s.score >= 85 ? 'text-green-600' : s.score >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {s.score}
                    </span>
                  </td>
                  <td className="py-2.5 text-center text-sm text-gray-500">{s.submit_rate}%</td>
                  <td className="py-2.5 text-sm text-gray-500">{s.weakness}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
