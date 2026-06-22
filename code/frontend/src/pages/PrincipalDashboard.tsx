import { BookOpen, Users, TrendingUp, FileText, CheckCircle, School } from 'lucide-react'

export default function PrincipalDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">校长仪表盘</h1>
        <p className="text-sm text-gray-500 mt-1">全校教学数据概览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '全校教师', value: '28', sub: '在编教师', icon: Users, color: 'text-blue-600 bg-blue-50' },
          { label: '本月教案', value: '156', sub: '较上月↑12%', icon: FileText, color: 'text-green-600 bg-green-50' },
          { label: '教案定稿率', value: '78%', sub: '教学质量指标', icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
          { label: '作业批阅率', value: '92%', sub: '48h内批阅', icon: CheckCircle, color: 'text-orange-600 bg-orange-50' },
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

      <div className="grid grid-cols-2 gap-4">
        {/* 班级教学情况 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2"><School size={16} className="text-brand" />班级教学情况</h3>
          {[
            { grade: '三年级', classes: 4, plans: 45, rate: '82%' },
            { grade: '四年级', classes: 3, plans: 38, rate: '91%' },
            { grade: '五年级', classes: 3, plans: 42, rate: '75%' },
            { grade: '六年级', classes: 2, plans: 31, rate: '88%' },
          ].map((g, i) => (
            <div key={i} className="flex items-center gap-4 py-2.5 border-b border-gray-100 last:border-0">
              <span className="text-sm font-medium text-gray-800 w-16">{g.grade}</span>
              <span className="text-xs text-gray-400">{g.classes}个班</span>
              <span className="text-xs text-gray-600">{g.plans}份教案</span>
              <div className="flex-1"><div className="h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-brand rounded-full" style={{ width: g.rate }} /></div></div>
              <span className="text-xs font-medium text-brand">{g.rate}</span>
            </div>
          ))}
        </div>

        {/* 教师教案排名 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2"><BookOpen size={16} className="text-brand" />教师教案数量排名</h3>
          {[
            { name: '张老师', grade: '四年级语文', count: 12 },
            { name: '李老师', grade: '三年级数学', count: 10 },
            { name: '王老师', grade: '五年级英语', count: 9 },
            { name: '赵老师', grade: '六年级语文', count: 8 },
            { name: '陈老师', grade: '四年级数学', count: 7 },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
              <span className="text-sm text-gray-800 flex-1">{t.name}</span>
              <span className="text-xs text-gray-400">{t.grade}</span>
              <span className="text-sm font-medium text-brand">{t.count}份</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
