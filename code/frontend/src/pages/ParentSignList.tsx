import { CheckCircle, XCircle, Clock, Bell } from 'lucide-react'
import { useApi } from '../lib/useApi'
import { ListSkeleton, EmptyState } from '../components/StateComponents'

const MOCK_SIGNATURES = [
  { id: '1', student: '李明', parent: '李建国', assignment: '分数加减法练习', grade: '85分', submitted_at: '2026-06-17', signed: true, signed_at: '2026-06-17 20:30' },
  { id: '2', student: '王小红', parent: '王芳', assignment: '分数加减法练习', grade: '80分', submitted_at: '2026-06-17', signed: true, signed_at: '2026-06-18 08:15' },
  { id: '3', student: '张伟', parent: '张大华', assignment: '《观潮》课后练习', grade: '70分', submitted_at: '2026-06-16', signed: false, signed_at: null, due: '2026-06-18' },
  { id: '4', student: '刘洋', parent: '刘明', assignment: '分数加减法练习', grade: '88分', submitted_at: '2026-06-17', signed: false, signed_at: null },
]

export default function ParentSignList() {
  const { data: apiData, loading } = useApi(async () => {
    const res = await fetch('/api/v1/parent-signatures',{headers:{Authorization:'Bearer '+localStorage.getItem('zhiwei_token')}})
    return res.json()
  }, { items: MOCK_SIGNATURES })

  if (loading) return <ListSkeleton rows={3} />

  const signatures = apiData?.items || MOCK_SIGNATURES
  if (signatures.length === 0) return <EmptyState title="暂无签字记录" description="还没有需要家长签字的作业" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">家长签字</h1>
          <p className="text-sm text-gray-500 mt-1">追踪家长确认作业情况，逾期自动提醒</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-sm text-[#1A3A6B] border border-[#1A3A6B]/20 rounded-lg hover:bg-blue-50">
          <Bell size={16} /> 全部提醒
        </button>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-green-50"><CheckCircle size={16} className="text-green-600" /></div>
            <span className="text-xs font-medium text-gray-500">已签字</span>
          </div>
          <span className="text-2xl font-bold text-gray-900">{signatures.filter((s: any) => s.signed).length}</span>
          <span className="text-xs text-gray-400 ml-2">份</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-orange-50"><Clock size={16} className="text-orange-600" /></div>
            <span className="text-xs font-medium text-gray-500">待签字</span>
          </div>
          <span className="text-2xl font-bold text-gray-900">{signatures.filter((s: any) => !s.signed).length}</span>
          <span className="text-xs text-gray-400 ml-2">份</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-red-50"><XCircle size={16} className="text-red-600" /></div>
            <span className="text-xs font-medium text-gray-500">逾期未签</span>
          </div>
          <span className="text-2xl font-bold text-red-600">
            {signatures.filter((s: any) => !s.signed && s.due).length}
          </span>
          <span className="text-xs text-gray-400 ml-2">份</span>
        </div>
      </div>

      {/* 签字列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">学生</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">家长</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">作业</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">成绩</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">状态</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {signatures.map((item: any) => (
              <tr key={item.id} className={`hover:bg-gray-50/50 ${!item.signed && (item as any).due ? 'bg-red-50/20' : ''}`}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.student}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{item.parent}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {item.assignment}
                  <span className="ml-2 text-xs text-gray-400">{item.submitted_at}</span>
                </td>
                <td className="px-4 py-3 text-center text-sm">{item.grade}</td>
                <td className="px-4 py-3 text-center">
                  {item.signed ? (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-50 text-green-600 rounded-full">
                      <CheckCircle size={12} /> 已签
                      <span className="text-green-400 ml-1">{item.signed_at}</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-orange-50 text-orange-600 rounded-full">
                      <Clock size={12} /> 待签
                      {(item as any).due && <span className="text-red-500 ml-1">逾期</span>}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button className={`px-3 py-1.5 text-xs rounded-lg ${
                    item.signed ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-[#1A3A6B] text-white hover:bg-[#2B5DA8]'
                  }`} disabled={item.signed}>
                    {item.signed ? '已签' : '提醒签字'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
