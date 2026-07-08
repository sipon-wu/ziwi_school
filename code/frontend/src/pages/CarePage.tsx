import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Check, TrendingUp, TrendingDown, Minus, ChevronRight, Plus, Pencil, X } from 'lucide-react'
import { useTeaching } from '../lib/TeachingContext'
import AppLayout from '../components/AppLayout'

const GRADE_MAP: Record<number, string> = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级', 7: '七年级', 8: '八年级', 9: '九年级' }

type CareStudent = {
  id: string; name: string; studentNo: string; gender: string; grade: number
  enrolledDate: string; removedDate?: string
  status: 'activated' | 'pending' | 'removed'
  planProgress: number; accuracy: number; accuracyTrend: 'up' | 'down' | 'flat'; accuracyChange: number
  focusArea: string
}

const INIT_STUDENTS: CareStudent[] = [
  { id: 's1', name: '赵大鹏', studentNo: '20240007', gender: '男', grade: 4, enrolledDate: '2026-03-01', status: 'activated', planProgress: 73, accuracy: 68, accuracyTrend: 'up', accuracyChange: 6, focusArea: '异分母分数比较是当前薄弱环节，通分步骤需强化' },
  { id: 's2', name: '孙小飞', studentNo: '20240008', gender: '男', grade: 4, enrolledDate: '2026-03-15', status: 'activated', planProgress: 60, accuracy: 55, accuracyTrend: 'up', accuracyChange: 3, focusArea: '排比句运用需从仿写过渡到独立创作' },
  { id: 's3', name: '钱小强', studentNo: '20240011', gender: '男', grade: 4, enrolledDate: '2026-04-10', status: 'activated', planProgress: 40, accuracy: 62, accuracyTrend: 'flat', accuracyChange: 0, focusArea: '成绩处于平台期，首要目标是恢复练习量' },
  { id: 's4', name: '冯小美', studentNo: '20240012', gender: '女', grade: 4, enrolledDate: '2026-04-20', status: 'pending', planProgress: 55, accuracy: 58, accuracyTrend: 'down', accuracyChange: 4, focusArea: '多角度提问能力需加强' },
  { id: 's5', name: '苗小光', studentNo: '20240045', gender: '男', grade: 4, enrolledDate: '2026-05-05', status: 'activated', planProgress: 83, accuracy: 71, accuracyTrend: 'up', accuracyChange: 8, focusArea: '分数混合运算进步显著，建议逐步引入复杂运算' },
  { id: 's6', name: '花小玉', studentNo: '20240046', gender: '女', grade: 4, enrolledDate: '2026-06-01', status: 'pending', planProgress: 65, accuracy: 65, accuracyTrend: 'up', accuracyChange: 2, focusArea: '词语理解有改善迹象，巩固为主' },
  { id: 's7', name: '褚小刚', studentNo: '20240013', gender: '男', grade: 4, enrolledDate: '2026-02-15', removedDate: '2026-06-20', status: 'removed', planProgress: 0, accuracy: 76, accuracyTrend: 'up', accuracyChange: 4, focusArea: '已达标移出，历史记录保留' },
]

function daysSince(date: string) {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (d < 30) return `${d}天`; const m = Math.floor(d / 30); return `${m}个月`
}

function trendEl(t: string, v: number) {
  if (t === 'up') return <span className="flex items-center gap-0.5 text-[10px] text-green-600"><TrendingUp size={11} />+{v}%</span>
  if (t === 'down') return <span className="flex items-center gap-0.5 text-[10px] text-red-500"><TrendingDown size={11} />-{v}%</span>
  return <span className="flex items-center gap-0.5 text-[10px] text-[#9A9A9A]"><Minus size={11} />—</span>
}

export default function CarePage() {
  const teaching = useTeaching()
  const navigate = useNavigate()
  const gradeName = GRADE_MAP[teaching.grade] || '四年级'
  const [students, setStudents] = useState<CareStudent[]>(() => {
    const saved = localStorage.getItem('care_edits')
    if (!saved) return INIT_STUDENTS
    try {
      const edits = JSON.parse(saved)
      return INIT_STUDENTS.map(s => {
        if (edits[s.id]) {
          return { ...s, focusArea: edits[s.id].focusArea || s.focusArea,
            plan: { ...(s as any).plan, focusArea: edits[s.id].focusArea || (s as any).plan.focusArea, teacherNote: edits[s.id].teacherNote || (s as any).plan.teacherNote } }
        }
        return s
      }) as CareStudent[]
    } catch { return INIT_STUDENTS }
  })
  const [showAdd, setShowAdd] = useState(false)
  const [editFocus, setEditFocus] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [form, setForm] = useState({ name: '', studentNo: '', gender: '男' })

  const startEditFocus = (id: string, text: string) => { setEditFocus(id); setEditText(text) }
  const saveFocus = () => {
    setStudents(prev => prev.map(s => s.id === editFocus ? { ...s, focusArea: editText } : s))
    setEditFocus(null)
  }

  const handleAdd = () => {
    if (!form.name.trim() || !form.studentNo.trim()) return
    setStudents(prev => [{
      id: `s${Date.now()}`, name: form.name, studentNo: form.studentNo, gender: form.gender,
      grade: 4, enrolledDate: new Date().toISOString().slice(0, 10), status: 'pending' as const,
      planProgress: 0, accuracy: 50, accuracyTrend: 'flat', accuracyChange: 0,
      focusArea: '待评估',
    }, ...prev])
    setShowAdd(false)
    setForm({ name: '', studentNo: '', gender: '男' })
  }

  return (
    <AppLayout>
      <div className="bg-yellow-50 border border-yellow-200 rounded-[4px] px-4 py-2 mb-4 text-[11px] text-[#595959]">
        ⚠️ 已归档班级的关怀方案与评估记录将停止更新
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#353535]">成长关爱</h1>
            <p className="text-[11px] text-[#9A9A9A] mt-0.5">
              {teaching.subject} · {gradeName} · {students.length} 名学生接受个性化关注
            </p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1]">
            <Plus size={13} />添加关怀
          </button>
        </div>

        {/* 添加关怀弹窗 */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowAdd(false)}>
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative bg-white rounded-[6px] shadow-xl w-[400px] max-w-[90vw] z-10" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-3 border-b border-[#F0F0F0] flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#353535]">添加关怀学生</span>
                <button onClick={() => setShowAdd(false)}><X size={16} className="text-[#9A9A9A]" /></button>
              </div>
              <div className="p-5 space-y-3">
                <div><label className="block text-[11px] text-[#9A9A9A] mb-1">姓名</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-[13px] border rounded-[4px] outline-none focus:border-[#02A7F0]" /></div>
                <div><label className="block text-[11px] text-[#9A9A9A] mb-1">学号</label><input value={form.studentNo} onChange={e => setForm({ ...form, studentNo: e.target.value })} className="w-full px-3 py-2 text-[13px] border rounded-[4px] outline-none focus:border-[#02A7F0]" /></div>
                <div><label className="block text-[11px] text-[#9A9A9A] mb-1">性别</label>
                  <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="w-full px-3 py-2 text-[13px] border rounded-[4px] outline-none">
                    <option>男</option><option>女</option>
                  </select>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-[#F0F0F0] flex justify-end gap-2">
                <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 text-[12px] border rounded-[4px]">取消</button>
                <button onClick={handleAdd} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px]">添加</button>
              </div>
            </div>
          </div>
        )}

        {students.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[#E7E7EB] rounded-[4px]">
            <Heart size={32} className="mx-auto text-[#E7E7EB] mb-2" />
            <p className="text-[13px] text-[#9A9A9A]">暂无关爱学生</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
            <div className="px-5 py-2.5 bg-[#F6F7F8] border-b border-[#E7E7EB] flex items-center text-[10px] text-[#9A9A9A]">
              <span className="flex-1 pl-9">学生</span>
              <span className="w-16 text-center">入组</span>
              <span className="w-36 text-center hidden lg:block">方案进度 / 关注点</span>
              <span className="w-16 text-center">正确率</span>
              <span className="w-14" />
            </div>
            <div className="divide-y divide-[#F0F0F0]">
              {students.map(s => (
                <div key={s.id}
                  className={`flex items-center px-5 py-3 hover:bg-[#F9FAFB] transition-colors ${s.status === 'removed' ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/care/${s.id}`)}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${s.status === 'removed' ? 'bg-[#C0C0C0]' : s.accuracy >= 70 ? 'bg-green-400' : s.accuracy >= 60 ? 'bg-[#02A7F0]' : 'bg-orange-400'}`}>{s.name.charAt(0)}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5"><span className="text-[13px] font-medium text-[#353535] truncate">{s.name}</span>{s.status === 'activated' && <Check size={11} className="text-[#C0C0C0]" />}{s.status === 'removed' && <span className="text-[8px] text-[#9A9A9A] bg-[#F0F0F0] px-1 py-0.5 rounded">已移出</span>}</div>
                      <div className="text-[10px] text-[#9A9A9A] truncate">{s.studentNo} · {s.gender}</div>
                    </div>
                  </div>

                  <span className="w-16 text-center text-[11px] text-[#595959]">{daysSince(s.enrolledDate)}</span>

                  <div className="w-36 hidden lg:flex flex-col gap-0.5">
                    {s.status !== 'removed' ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1 bg-[#F0F0F0] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${s.planProgress >= 80 ? 'bg-green-400' : s.planProgress >= 50 ? 'bg-[#02A7F0]' : 'bg-orange-300'}`} style={{ width: `${s.planProgress}%` }} />
                          </div>
                          <span className="text-[10px] text-[#9A9A9A]">{s.planProgress}%</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#9A9A9A]">
                          {editFocus === s.id ? (
                            <div className="flex items-center gap-1 flex-1">
                              <input value={editText} onChange={e => setEditText(e.target.value)} className="flex-1 px-1 py-0.5 border rounded text-[10px] outline-none" autoFocus onKeyDown={e => e.key === 'Enter' && saveFocus()} />
                              <button onClick={saveFocus} className="text-green-600"><Check size={11} /></button>
                              <button onClick={() => setEditFocus(null)} className="text-[#9A9A9A]"><X size={11} /></button>
                            </div>
                          ) : (
                            <>
                              <span className="truncate">{s.focusArea}</span>
                              <button onClick={e => { e.stopPropagation(); startEditFocus(s.id, s.focusArea) }} className="text-[#02A7F0] hover:underline shrink-0"><Pencil size={10} /></button>
                            </>
                          )}
                        </div>
                      </>
                    ) : <span className="text-[10px] text-[#B0B0B0]">已停止</span>}
                  </div>

                  <div className="w-16 text-center">
                    <div className="text-[12px] font-semibold text-[#353535]">{s.accuracy}%</div>
                    {trendEl(s.accuracyTrend, s.accuracyChange)}
                  </div>

                  <button onClick={() => navigate(`/care/${s.id}`)} className="w-14 flex justify-end">
                    <ChevronRight size={14} className="text-[#D0D0D0]" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
