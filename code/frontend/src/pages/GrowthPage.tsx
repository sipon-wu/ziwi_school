import { useState, useEffect } from 'react'
import { ArrowUp, ArrowDown, Clock, CheckCircle2, BookOpen, AlertCircle, ChevronDown, ChevronUp, Users, TrendingUp, Star, Target } from 'lucide-react'
import { useTeaching } from '../lib/TeachingContext'
import { careAPI } from '../lib/api'
import { useToast } from '../components/Toast'
import AppLayout from '../components/AppLayout'

const GRADE_MAP: Record<number, string> = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级', 7: '七年级', 8: '八年级', 9: '九年级' }

const NAMES = ['张小明', '李小红', '王大力', '陈小花', '刘小月', '赵大鹏', '孙小飞', '周小红', '吴小华', '郑小丽',
  '钱小强', '冯小美', '褚小刚', '蒋小芳', '沈小龙', '韩小凤', '杨小虎', '朱小燕', '秦小雷', '许小兰',
  '何小军', '吕小琴', '施小杰', '张小婷', '孔小龙', '曹小娟', '严小伟', '华小敏', '金小勇', '魏小霞',
  '陶小宇', '姜小雪', '戚小涛', '谢小玲', '邹小波', '苏小静', '潘小峰', '葛小雨', '范小宁', '彭小慧',
  '鲁小松', '韦小云', '昌小亮', '马小红', '苗小光', '花小玉', '方小俊', '俞小佳']

const STUDENTS = Array.from({ length: 48 }, (_, i) => ({
  id: `s${i + 1}`,
  studentNo: `202400${String(i + 1).padStart(2, '0')}`,
  name: NAMES[i],
  gender: i % 2 === 0 ? '男' : '女',
  birthMonth: `${2012 + Math.floor(i / 8)}-${String(3 + (i % 9)).padStart(2, '0')}`,
  score: 60 + Math.floor(Math.random() * 36),
  trend: Math.floor(Math.random() * 20) - 8,
}))

type TimelineItem = { period: string; label: string; score: number; punctuality: number; completion: number; accuracy: number; coverage: number; handwriting: string }

const TIMELINE: TimelineItem[] = [
  { period: '2月', label: '开学摸底', score: 72, punctuality: 85, completion: 100, accuracy: 68, coverage: 42, handwriting: '-' },
  { period: '3月', label: '第一单元', score: 76, punctuality: 88, completion: 95, accuracy: 72, coverage: 56, handwriting: '-' },
  { period: '4月', label: '期中', score: 80, punctuality: 90, completion: 100, accuracy: 76, coverage: 70, handwriting: '-' },
  { period: '5月', label: '第三单元', score: 84, punctuality: 92, completion: 90, accuracy: 80, coverage: 78, handwriting: '-' },
  { period: '6月', label: '期末', score: 88, punctuality: 96, completion: 100, accuracy: 86, coverage: 88, handwriting: '-' },
]

const CLASS_SLICES = [
  { period: '2月', label: '开学摸底', avg: 65, above80: 5, above60: 28, below60: 20, top3: ['张小明', '李小红', '刘小月'], bottom3: ['赵大鹏', '孙小飞', '钱小强'] },
  { period: '3月', label: '第一单元', avg: 70, above80: 10, above60: 32, below60: 16, top3: ['张小明', '刘小月', '陈小花'], bottom3: ['赵大鹏', '孙小飞', '冯小美'] },
  { period: '4月', label: '期中', avg: 74, above80: 14, above60: 35, below60: 13, top3: ['张小明', '刘小月', '周小红'], bottom3: ['赵大鹏', '钱小强', '冯小美'] },
  { period: '5月', label: '第三单元', avg: 78, above80: 18, above60: 38, below60: 10, top3: ['张小明', '周小红', '李小红'], bottom3: ['赵大鹏', '苗小光', '冯小美'] },
  { period: '6月', label: '期末', avg: 80, above80: 22, above60: 40, below60: 8, top3: ['张小明', '刘小月', '周小红'], bottom3: ['赵大鹏', '钱小强', '苗小光'] },
]

const INDICATORS = [
  { key: 'score' as const, label: '综合成绩', unit: '分', icon: BookOpen, color: '#02A7F0' },
  { key: 'punctuality' as const, label: '准时完成度', unit: '%', icon: Clock, color: '#52C41A' },
  { key: 'completion' as const, label: '完成率', unit: '%', icon: CheckCircle2, color: '#1890FF' },
  { key: 'accuracy' as const, label: '综合正确率', unit: '%', icon: AlertCircle, color: '#722ED1' },
  { key: 'coverage' as const, label: '知识覆盖度', unit: '%', icon: BookOpen, color: '#FA8C16' },
  { key: 'handwriting' as const, label: '卷面工整度', unit: '评分', icon: CheckCircle2, color: '#EB2F96' },
]

const WEAKNESSES = [
  { name: '仿写表达', self: 58, classAvg: 76, suggestion: '建议每周完成2次仿写练习，从模仿课文句式开始' },
  { name: '排比句运用', self: 45, classAvg: 68, suggestion: '先掌握排比句结构，再尝试创作' },
  { name: '多角度提问', self: 52, classAvg: 72, suggestion: '用"是什么/为什么/怎么样"三类问题引导思考' },
]

const YOY: Record<number, { lastSemester: number; lastYear: number }> = {
  0: { lastSemester: 0, lastYear: 68 },
  1: { lastSemester: 70, lastYear: 72 },
  2: { lastSemester: 74, lastYear: 76 },
  3: { lastSemester: 78, lastYear: 79 },
  4: { lastSemester: 80, lastYear: 82 },
}

function scoreColor(s: number) { if (s >= 85) return { bg: '#52C41A', tag: '优秀' }; if (s >= 70) return { bg: '#1890FF', tag: '良好' }; if (s >= 60) return { bg: '#FA8C16', tag: '及格' }; return { bg: '#F5222D', tag: '待提升' } }
function ageFromBirthMonth(bm: string) { const [y, m] = bm.split('-').map(Number); const now = new Date(); let age = now.getFullYear() - y; if (now.getMonth() + 1 < m) age--; return age }

export default function GrowthPage() {
  const teaching = useTeaching()
  const toast = useToast()
  const gradeName = GRADE_MAP[teaching.grade] || '四年级'
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAllStudents, setShowAllStudents] = useState(false)
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set())
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [activeNode, setActiveNode] = useState(TIMELINE.length - 1)
  const [classPeriodIdx, setClassPeriodIdx] = useState(CLASS_SLICES.length - 1)
  const [showCompare, setShowCompare] = useState(false)
  const [compareIdx, setCompareIdx] = useState(0)
  const [showYoY, setShowYoY] = useState(false)

  const total = STUDENTS.length
  const student = STUDENTS.find(s => s.id === selectedId)
  const node = TIMELINE[activeNode]
  const compareNode = TIMELINE[compareIdx]
  const classSlice = CLASS_SLICES[classPeriodIdx]

  // ── 从后端加载成长关爱学生列表 ──
  useEffect(() => {
    careAPI.list().then(data => {
      if (data?.items?.length > 0) {
        setWatchlist(new Set(data.items.map((item: any) => item.student_id || item.id)))
      }
    }).catch(() => {
      // 后端不可用时，watchlist 保持本地空状态
    })
  }, [])

  const toggleWatch = async (id: string) => {
    const inWatch = watchlist.has(id)
    // 乐观更新
    setWatchlist(prev => {
      const next = new Set(prev)
      if (inWatch) { next.delete(id) } else { next.add(id) }
      return next
    })
    // 异步同步后端
    try {
      if (inWatch) {
        // 移除关怀——需要先查 student_id 对应的 care record id
        const data = await careAPI.list()
        const match = data?.items?.find((i: any) => i.student_id === id || i.id === id)
        if (match) await careAPI.remove(match.id)
      } else {
        await careAPI.add({ student_id: id, focus_area: '待评估' })
      }
    } catch {
      toast?.show?.('同步失败，请重试', 'warning')
      // 回滚：恢复原状态
      setWatchlist(prev => {
        const next = new Set(prev)
        if (inWatch) { next.add(id) } else { next.delete(id) }
        return next
      })
    }
  }
  const watchlistStudents = STUDENTS.filter(s => watchlist.has(s.id))
  const displayStudents = showWatchlist ? watchlistStudents : STUDENTS

  // ── TimeNode 渲染 ──
  const renderTimeNodes = (items: any[], activeIdx: number, setFn: (i: number) => void) => (
    <div className="relative">
      <div className="absolute top-[18px] left-5 right-5 h-[2px] bg-[#E7E7EB]" />
      <div className="flex justify-between relative">
        {items.map((t, i) => {
          const color = scoreColor(t.avg ?? t.score)
          const isActive = activeIdx === i
          return (
            <button key={i} onClick={() => setFn(i)} className="flex flex-col items-center gap-2 group" style={{ zIndex: isActive ? 10 : 1 }}>
              <div className="transition-all duration-200" style={{ width: isActive ? 16 : 12, height: isActive ? 16 : 12, borderRadius: '50%', background: isActive ? color.bg : '#E7E7EB', border: isActive ? `2px solid ${color.bg}` : '2px solid #E7E7EB', boxShadow: isActive ? `0 0 0 4px ${color.bg}20` : 'none', marginTop: isActive ? '2px' : '4px' }} />
              <div className={`text-center transition-all ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                <div className="text-[10px] text-[#9A9A9A]">{t.label}</div>
                <div className={`text-[12px] font-bold ${isActive ? '' : 'text-[#9A9A9A]'}`} style={isActive ? { color: color.bg } : {}}>{t.avg ?? t.score}</div>
                <div className="text-[10px] text-[#9A9A9A]">{t.period}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderIndicatorCards = (data: TimelineItem) => (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
      {INDICATORS.map(ind => {
        const val = data[ind.key]
        const available = ind.key !== 'handwriting'
        const yoyData = showYoY && ind.key === 'score' ? YOY[activeNode] : null
        return (
          <div key={ind.key} className="p-2.5 bg-white rounded-[4px] border border-[#E7E7EB] text-center">
            <ind.icon size={14} style={{ color: ind.color, margin: '0 auto 4px' }} />
            <div className="text-[10px] text-[#9A9A9A] mb-0.5">{ind.label}</div>
            <div className="text-base font-bold" style={{ color: available ? '#353535' : '#C0C0C0' }}>{available ? (typeof val === 'number' ? val : val) : '—'}</div>
            <div className="text-[9px] text-[#9A9A9A]">{ind.unit}</div>
            {yoyData && (
              <div className="mt-1 pt-1 border-t border-[#F0F0F0] text-[9px]">
                <div><span className="text-[#9A9A9A]">上学期：</span><span className={yoyData.lastSemester > (val as number) ? 'text-red-500' : 'text-green-600'}>{yoyData.lastSemester}</span></div>
                <div><span className="text-[#9A9A9A]">去年：</span><span className={yoyData.lastYear > (val as number) ? 'text-red-500' : 'text-green-600'}>{yoyData.lastYear} {yoyData.lastYear > (val as number) ? '↓' : '↑'}{Math.abs(yoyData.lastYear - (val as number))}</span></div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-[#353535]">成长足迹</h1>
          <p className="text-[11px] text-[#9A9A9A] mt-0.5">{teaching.subject} · {gradeName} · {total}人</p>
        </div>

        {!selectedId ? (
          /* ══════ 班级综览 ══════ */
          <>
            <div className="bg-white border border-[#E7E7EB] rounded-[4px] px-6 pt-4 pb-3">
              <div className="text-[11px] text-[#9A9A9A] mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#02A7F0]" />班级足迹 · 点击节点切换时间切片
                <span className="ml-auto text-[10px]">{CLASS_SLICES[0].period} → {CLASS_SLICES[CLASS_SLICES.length - 1].period} · 均分 {CLASS_SLICES[CLASS_SLICES.length - 1].avg > CLASS_SLICES[0].avg ? '↑' : '↓'}{Math.abs(CLASS_SLICES[CLASS_SLICES.length - 1].avg - CLASS_SLICES[0].avg)}</span>
              </div>
              {renderTimeNodes(CLASS_SLICES, classPeriodIdx, setClassPeriodIdx)}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: '班级均分', value: classSlice.avg, unit: '分', icon: Target, color: '#02A7F0', bg: '#E8F7FF' },
                { label: '优秀(≥85)', value: classSlice.above80, unit: '人', icon: Star, color: '#52C41A', bg: '#F0FFE5' },
                { label: '及格(≥60)', value: classSlice.above60, unit: '人', icon: Users, color: '#1890FF', bg: '#E8F0FF' },
                { label: '待关注(<60)', value: classSlice.below60, unit: '人', icon: AlertCircle, color: '#F5222D', bg: '#FFF0F0' },
                { label: '切片区间', value: `${classSlice.period}·${classSlice.label}`, unit: '', icon: TrendingUp, color: '#722ED1', bg: '#F5F0FF' },
              ].map((c, i) => (
                <div key={i} className="bg-white border border-[#E7E7EB] rounded-[4px] p-4">
                  <div className="flex items-center justify-between mb-2"><span className="text-[12px] text-[#9A9A9A]">{c.label}</span><div className="w-8 h-8 rounded-[4px] flex items-center justify-center" style={{ background: c.bg }}><c.icon size={15} style={{ color: c.color }} /></div></div>
                  <div className="text-2xl font-bold text-[#353535]">{c.value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
                <div className="px-5 py-3 bg-[#F6F7F8] border-b border-[#E7E7EB]"><h3 className="text-[13px] font-semibold text-[#353535]">成绩分布 · {classSlice.period}</h3></div>
                <div className="p-5">
                  <div className="flex items-end gap-2 h-36">
                    {[{ range: '<60', count: classSlice.below60, color: '#F5222D', label: '待提升' }, { range: '60-69', count: Math.max(0, classSlice.above60 - classSlice.above80 - Math.floor(total * 0.15)), color: '#FA8C16', label: '及格' }, { range: '70-79', count: Math.floor(total * 0.15), color: '#FAAD14', label: '中等' }, { range: '80-89', count: Math.max(0, classSlice.above80 - Math.floor(total * 0.1)), color: '#1890FF', label: '良好' }, { range: '90+', count: Math.min(classSlice.above80, Math.floor(total * 0.1)), color: '#52C41A', label: '优秀' }].map(b => (
                      <div key={b.range} className="flex-1 flex flex-col items-center gap-1.5">
                        <span className="text-[12px] font-medium text-[#353535]">{b.count}人</span>
                        <div className="w-full rounded-t-[4px]" style={{ height: `${(Math.max(1, b.count) / total) * 96}px`, background: b.color, opacity: 0.8 }} />
                        <span className="text-[10px] text-[#9A9A9A]">{b.label}</span><span className="text-[10px] text-[#9A9A9A]">{b.range}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
                <div className="px-5 py-3 bg-[#F6F7F8] border-b border-[#E7E7EB]"><h3 className="text-[13px] font-semibold text-[#353535]">首尾学生 · {classSlice.period}</h3></div>
                <div className="p-4 space-y-3">
                  <div><span className="text-[11px] text-green-600 font-medium flex items-center gap-1 mb-2"><TrendingUp size={12} /> 表现突出</span><div className="flex flex-wrap gap-1.5">{classSlice.top3.map(n => <span key={n} className="px-2.5 py-1 text-[11px] bg-green-50 text-green-700 rounded-full border border-green-100">{n}</span>)}</div></div>
                  <div><span className="text-[11px] text-red-500 font-medium flex items-center gap-1 mb-2"><AlertCircle size={12} /> 需重点关注</span><div className="flex flex-wrap gap-1.5">{classSlice.bottom3.map(n => <span key={n} className="px-2.5 py-1 text-[11px] bg-red-50 text-red-600 rounded-full border border-red-100">{n}</span>)}</div></div>
                  <div className="text-[11px] text-[#9A9A9A] pt-1 border-t border-[#F0F0F0]">从{CLASS_SLICES[0].period}到{CLASS_SLICES[CLASS_SLICES.length - 1].period}，待关注学生从<b>{CLASS_SLICES[0].below60}</b>人降至<b>{CLASS_SLICES[CLASS_SLICES.length - 1].below60}</b>人</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[12px] text-[#9A9A9A]">点击下方查看每位学生的详细成长记录</span>
              <div className="flex items-center gap-0.5 bg-[#F0F0F0] rounded-[4px] p-0.5">
                <button onClick={() => setShowWatchlist(false)} className={`px-3 py-1 text-[11px] rounded-[3px] transition-colors ${!showWatchlist ? 'bg-white text-[#353535] shadow-sm' : 'text-[#9A9A9A] hover:text-[#353535]'}`}>全部 <span className="ml-0.5 text-[10px]">({total})</span></button>
                <button onClick={() => setShowWatchlist(true)} className={`px-3 py-1 text-[11px] rounded-[3px] transition-colors flex items-center gap-1 ${showWatchlist ? 'bg-white text-[#353535] shadow-sm' : 'text-[#9A9A9A] hover:text-[#353535]'}`}><Star size={11} className={showWatchlist ? 'text-[#FAAD14] fill-[#FAAD14]' : ''} />成长关爱 {watchlist.size > 0 && <span className="text-[10px]">({watchlist.size})</span>}</button>
              </div>
            </div>
            {displayStudents.length === 0 ? (
              <div className="text-center py-8 text-[13px] text-[#9A9A9A] bg-white border border-[#E7E7EB] rounded-[4px]">暂无成长关爱学生，点击卡片右上角 <Star size={11} className="inline text-[#FAAD14] fill-[#FAAD14]" /> 添加</div>
            ) : (
              <>
                <div className="grid grid-cols-5 lg:grid-cols-5 gap-2">
                  {displayStudents.slice(0, showAllStudents ? displayStudents.length : 10).map(s => (
                    <button key={s.id} onClick={() => setSelectedId(s.id)} className="relative flex flex-col items-center gap-0.5 p-2.5 pt-3 bg-white border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] transition-colors group">
                      <span className="absolute top-1 left-1.5 text-[8px] text-[#B0B0B0] truncate">{s.studentNo}</span>
                      <button onClick={e => { e.stopPropagation(); toggleWatch(s.id) }} className={`absolute top-1 right-1 transition-opacity ${watchlist.has(s.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} title={watchlist.has(s.id) ? '移出成长关爱' : '加入成长关爱'}>
                        <Star size={11} className={watchlist.has(s.id) ? 'text-[#FAAD14] fill-[#FAAD14]' : 'text-[#C0C0C0]'} />
                      </button>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold ${s.score >= 80 ? 'bg-green-100 text-green-700' : s.score >= 60 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>{s.name.charAt(0)}</div>
                      <span className="text-[10px] text-[#353535] truncate max-w-full">{s.name}</span>
                      <span className={`text-[10px] font-medium ${s.score >= 80 ? 'text-green-600' : s.score >= 60 ? 'text-[#353535]' : 'text-red-500'}`}>{s.score}分</span>
                    </button>
                  ))}
                </div>
                {displayStudents.length > 10 && (
                  !showAllStudents ? (
                    <button onClick={() => setShowAllStudents(true)} className="w-full py-2.5 text-[13px] text-[#02A7F0] border border-[#02A7F0]/20 rounded-[4px] hover:bg-[#02A7F0]/5">查看全部 {displayStudents.length} 名学生</button>
                  ) : (
                    <button onClick={() => setShowAllStudents(false)} className="w-full py-2.5 text-[13px] text-[#9A9A9A] border border-[#E7E7EB] rounded-[4px] hover:bg-[#F6F7F8]">收起</button>
                  )
                )}
              </>
            )}
          </>
        ) : (
          /* ══════ 单生足迹 ══════ */
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedId(null)} className="text-[11px] text-[#02A7F0] hover:underline">← 返回班级综览</button>
                <div className="w-9 h-9 bg-[#02A7F0] rounded-full flex items-center justify-center text-white font-bold text-sm">{student?.name?.charAt(0)}</div>
                <div>
                  <span className="text-[14px] font-bold text-[#353535]">{student?.name}</span>
                  <span className="text-[10px] text-[#9A9A9A] ml-2">{student?.studentNo} · {student?.gender} · {student ? ageFromBirthMonth(student.birthMonth) : ''}岁</span>
                  <span className="text-[10px] text-[#02A7F0] ml-3 bg-[#02A7F0]/5 px-2 py-0.5 rounded">班级第{Math.floor(Math.random() * 10) + 1}名</span>
                </div>
              </div>
              <div className="flex gap-1">
                {[{ id: 'month', label: '月' }].map(g => <button key={g.id} className="px-3 py-1.5 text-[11px] rounded-[4px] bg-[#02A7F0] text-white">{g.label}</button>)}
                <span className="w-px bg-[#E7E7EB] mx-0.5" />
                <button onClick={() => setShowYoY(!showYoY)} className={`px-3 py-1.5 text-[11px] rounded-[4px] transition-colors ${showYoY ? 'bg-[#353535] text-white' : 'border border-[#E7E7EB] text-[#9A9A9A] hover:text-[#353535]'}`}>同比</button>
              </div>
            </div>

            <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden mt-4">
              <div className="px-6 pt-8 pb-4">{renderTimeNodes(TIMELINE, activeNode, setActiveNode)}
                <div className="mt-4 flex items-center gap-2 text-[12px] text-[#9A9A9A] justify-center flex-wrap">
                  {TIMELINE[TIMELINE.length - 1].score > TIMELINE[0].score ? <span className="flex items-center gap-1 text-green-600"><ArrowUp size={14} /> 进步 +{TIMELINE[TIMELINE.length - 1].score - TIMELINE[0].score}分</span> : <span className="flex items-center gap-1 text-red-500"><ArrowDown size={14} /> 退步 {TIMELINE[0].score - TIMELINE[TIMELINE.length - 1].score}分</span>}
                  <span>· {TIMELINE[0].period} → {TIMELINE[TIMELINE.length - 1].period}</span>
                  <span className="text-[#E7E7EB]">|</span>
                  <span>班级均分 {CLASS_SLICES.map(s => s.avg).join('→')}</span>
                </div>
              </div>
              <div className="border-t border-[#E7E7EB] bg-[#F9FAFB] px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: scoreColor(node.score).bg }} />
                    <span className="text-[13px] font-semibold text-[#353535]">{node.period} · {node.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: scoreColor(node.score).bg + '20', color: scoreColor(node.score).bg }}>{scoreColor(node.score).tag}</span>
                  </div>
                  <button onClick={() => setShowCompare(!showCompare)} className="flex items-center gap-1 text-[11px] text-[#02A7F0] hover:underline">{showCompare ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{showCompare ? '收起对比' : '对比其他节点'}</button>
                </div>
                {renderIndicatorCards(node)}
                {showCompare && (
                  <div className="mt-3 pt-3 border-t border-[#E7E7EB]">
                    <div className="text-[11px] text-[#9A9A9A] mb-2">选择对比节点：</div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {TIMELINE.filter((_, i) => i !== activeNode).map((t, i) => {
                        const realIdx = i >= activeNode ? i + 1 : i
                        return <button key={t.period} onClick={() => setCompareIdx(realIdx)} className={`px-2.5 py-1 text-[11px] rounded-[4px] border transition-colors ${compareIdx === realIdx ? 'border-[#02A7F0] bg-[#02A7F0]/5 text-[#02A7F0]' : 'border-[#E7E7EB] text-[#9A9A9A] hover:text-[#353535]'}`}>{t.period} · {t.score}分</button>
                      })}
                    </div>
                    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                      {INDICATORS.filter(i => i.key !== 'handwriting').map(ind => {
                        const curVal = node[ind.key] as number
                        const cmpVal = compareNode[ind.key] as number
                        const diff = typeof curVal === 'number' && typeof cmpVal === 'number' ? curVal - cmpVal : 0
                        return <div key={ind.key} className="p-2.5 bg-white rounded-[4px] border border-[#E7E7EB] text-center"><div className="text-[10px] text-[#9A9A9A] mb-1">{ind.label}</div><div className="text-[11px] text-[#353535] font-medium">{cmpVal} → {curVal}</div><span className={`text-[10px] font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-[#9A9A9A]'}`}>{diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : '—'}</span></div>
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden mt-4">
              <div className="px-5 py-3 bg-[#F6F7F8] border-b border-[#E7E7EB]"><h3 className="text-[13px] font-semibold text-[#353535]">薄弱知识点诊断</h3></div>
              <div className="p-4 space-y-2">
                {WEAKNESSES.map((kp, i) => {
                  const gap = kp.classAvg - kp.self
                  return (
                    <div key={i} className="p-3 bg-orange-50/50 border border-orange-100 rounded-[4px]">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2"><AlertCircle size={14} className="text-orange-500" /><span className="text-[12px] font-medium text-[#353535]">{kp.name}</span></div>
                        <span className="text-[11px] text-[#9A9A9A]">班级均分 <b className="text-[#353535]">{kp.classAvg}</b> · 差距 <b className="text-red-500">{gap}分</b></span>
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] text-[#9A9A9A]">本人</span><div className="flex-1 h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden"><div className="h-full bg-orange-400 rounded-full" style={{ width: `${kp.self}%` }} /></div>
                        <span className="text-[10px] font-medium text-orange-600">{kp.self}</span>
                        <span className="text-[10px] text-[#9A9A9A]">班级</span><div className="flex-1 h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${kp.classAvg}%` }} /></div>
                        <span className="text-[10px] font-medium text-blue-600">{kp.classAvg}</span>
                      </div>
                      <p className="text-[11px] text-[#9A9A9A]">💡 {kp.suggestion}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

    </AppLayout>
  )
}
