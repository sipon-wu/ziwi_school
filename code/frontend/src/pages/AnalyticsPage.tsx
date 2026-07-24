import { useState, useEffect } from 'react'
import { TrendingUp, Target, AlertTriangle, Star, ArrowUp, ArrowDown, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { useTeaching } from '../lib/TeachingContext'
import { api, notifyError, coverageAPI } from '../lib/api'
import AppLayout from '../components/AppLayout'

const GRADE_MAP: Record<number, string> = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级', 7: '七年级', 8: '八年级', 9: '九年级' }

const PERIODS = [
  { id: 'week', name: '本周' },
  { id: 'month', name: '本月' },
  { id: 'semester', name: '本学期' },
]

const MOCK_OVERVIEW = {
  avg_score: 82.5,
  score_trend: 3.2,
  completion_rate: 88.4,
  completion_trend: 1.8,
  mastery_rate: 76.2,
  mastery_trend: -2.1,
  below_threshold: 8,
  total_students: 42,
}

const MOCK_KNOWLEDGE_POINTS = [
  { name: '边读边想象画面', mastery: 85, avg_score: 88, trend: 5 },
  { name: '感受自然之美', mastery: 78, avg_score: 82, trend: 3 },
  { name: '阅读时尝试提问', mastery: 72, avg_score: 76, trend: -2 },
  { name: '从不同角度提问', mastery: 65, avg_score: 70, trend: -5 },
  { name: '连续观察方法', mastery: 80, avg_score: 84, trend: 8 },
  { name: '准确生动表达', mastery: 58, avg_score: 64, trend: -8 },
  { name: '了解故事起因经过结果', mastery: 90, avg_score: 92, trend: 4 },
  { name: '感受神话神奇想象', mastery: 82, avg_score: 86, trend: 6 },
]

type CoverageItem = {
  node_id: number
  node_key: string
  ming_cheng: string
  level: number
  parent_id: number | null
  total_questions: number
  covered_questions: number
  coverage_rate: number
}

const MOCK_STUDENTS = [
  { id: 's1', name: '张小明', score: 96, trend: 5, mastery: 92, complete: 100 },
  { id: 's2', name: '李小红', score: 88, trend: -2, mastery: 84, complete: 100 },
  { id: 's3', name: '王大力', score: 85, trend: 8, mastery: 78, complete: 90 },
  { id: 's4', name: '陈小花', score: 78, trend: -5, mastery: 72, complete: 85 },
  { id: 's5', name: '刘小月', score: 92, trend: 3, mastery: 88, complete: 100 },
  { id: 's6', name: '赵大鹏', score: 62, trend: -12, mastery: 55, complete: 70 },
  { id: 's7', name: '孙小飞', score: 75, trend: 4, mastery: 68, complete: 80 },
  { id: 's8', name: '周小红', score: 90, trend: 6, mastery: 86, complete: 100 },
]

export default function AnalyticsPage() {
  const teaching = useTeaching()
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const gradeName = GRADE_MAP[teaching.grade] || '四年级'

  const [overview, setOverview] = useState(MOCK_OVERVIEW)
  const [coverage, setCoverage] = useState<CoverageItem[]>([])
  const [coverageOpen, setCoverageOpen] = useState(false)

  useEffect(() => {
    api<{ lesson_plan_count: number; question_count: number; exam_count: number; assignment_count: number; grading_rate: number; avg_score: number }>('/analytics').then(d => {
      setOverview({
        avg_score: d.avg_score > 0 ? Math.round(d.avg_score) : 82,
        score_trend: 3.2, completion_rate: Math.round(d.grading_rate * 100),
        completion_trend: 1.8, mastery_rate: 76, mastery_trend: -2,
        below_threshold: 8, total_students: 42,
      })
    }).catch((e) => notifyError('学情数据加载失败', e))

    // 加载覆盖度
    const subjectName = teaching.subject || '语文'
    const gradeStr = String(teaching.grade || 4)
    coverageAPI.get({ subject: subjectName, grade: gradeStr }).then(d => {
      if (d?.items) setCoverage(d.items)
    }).catch(() => {})
  }, [])

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#353535]">学情分析</h1>
            <p className="text-[11px] text-[#9A9A9A] mt-0.5">{teaching.subject} · {gradeName} · 班级学习数据分析与诊断</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
              {PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* 概览卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: '班级均分', value: `${overview.avg_score}`, unit: '分', trend: overview.score_trend, icon: Target, color: '#02A7F0', bg: '#E8F7FF' },
            { label: '完成率', value: `${overview.completion_rate}`, unit: '%', trend: overview.completion_trend, icon: TrendingUp, color: '#52C41A', bg: '#F0FFE5' },
            { label: '知识点掌握率', value: `${overview.mastery_rate}`, unit: '%', trend: overview.mastery_trend, icon: Star, color: '#FA8C16', bg: '#FFF3E5' },
            { label: '重点关注', value: `${overview.below_threshold}/${overview.total_students}`, unit: '人', icon: AlertTriangle, color: '#F5222D', bg: '#FFF0F0' },
          ].map((card, i) => (
            <div key={i} className="bg-white border border-[#E7E7EB] rounded-[4px] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] text-[#9A9A9A]">{card.label}</span>
                <div className="w-8 h-8 rounded-[4px] flex items-center justify-center" style={{ background: card.bg }}>
                  <card.icon size={16} style={{ color: card.color }} />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#353535]">{card.value}</div>
              {card.trend !== undefined && (
                <div className="flex items-center gap-1 mt-1">
                  {card.trend > 0 ? <ArrowUp size={12} className="text-green-500" /> : <ArrowDown size={12} className="text-red-500" />}
                  <span className={`text-[11px] font-medium ${card.trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {card.trend > 0 ? '+' : ''}{card.trend}%
                  </span>
                  <span className="text-[10px] text-[#9A9A9A]">较上月</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 知识点掌握 + 学生排名 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 知识点掌握度 */}
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
            <div className="px-5 py-3 bg-[#F6F7F8] border-b border-[#E7E7EB] flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[#353535]">知识点掌握度</h3>
              <span className="text-[10px] text-[#9A9A9A]">掌握率 + 趋势</span>
            </div>
            <div className="p-4 space-y-3">
              {MOCK_KNOWLEDGE_POINTS.map(kp => (
                <div key={kp.name} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#353535]">{kp.name}</span>
                    <span className="flex items-center gap-1.5">
                      <span className={`font-medium ${kp.mastery >= 80 ? 'text-green-600' : kp.mastery >= 60 ? 'text-[#FA8C16]' : 'text-red-500'}`}>
                        {kp.mastery}%
                      </span>
                      {kp.trend > 0 ? <ArrowUp size={10} className="text-green-500" /> : <ArrowDown size={10} className="text-red-500" />}
                    </span>
                  </div>
                  <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${kp.mastery}%`,
                      background: kp.mastery >= 80 ? '#52C41A' : kp.mastery >= 60 ? '#FA8C16' : '#F5222D'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 学生排名 */}
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
            <div className="px-5 py-3 bg-[#F6F7F8] border-b border-[#E7E7EB] flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[#353535]">学生表现</h3>
              <span className="text-[10px] text-[#9A9A9A]">均分 · 掌握率 · 完成率</span>
            </div>
            <div className="divide-y divide-[#F0F0F0]">
              {MOCK_STUDENTS.map((s, i) => (
                <div key={s.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-[#F9FAFB]">
                  <span className="text-[12px] text-[#9A9A9A] w-5 text-right">{i + 1}</span>
                  <span className="text-[13px] text-[#353535] flex-1 min-w-0 truncate">{s.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[12px] font-medium ${s.score >= 85 ? 'text-green-600' : s.score >= 70 ? 'text-[#353535]' : 'text-red-500'}`}>
                      {s.score}分
                    </span>
                    {s.trend > 0 ? <ArrowUp size={10} className="text-green-500" /> : <ArrowDown size={10} className="text-red-500" />}
                    <div className="flex items-center gap-1" title="掌握率">
                      <div className="w-12 h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${s.mastery}%`,
                          background: s.mastery >= 80 ? '#52C41A' : s.mastery >= 60 ? '#FA8C16' : '#F5222D'
                        }} />
                      </div>
                      <span className="text-[10px] text-[#9A9A9A]">{s.mastery}%</span>
                    </div>
                    <span className={`text-[10px] ${s.complete >= 90 ? 'text-green-600' : 'text-[#FA8C16]'}`}>
                      {s.complete}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 成绩分布 */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
          <div className="px-5 py-3 bg-[#F6F7F8] border-b border-[#E7E7EB]">
            <h3 className="text-[13px] font-semibold text-[#353535]">成绩分布</h3>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-2 h-40">
              {[
                { range: '0-59', count: 3, color: '#F5222D', label: '不及格' },
                { range: '60-69', count: 5, color: '#FA8C16', label: '及格' },
                { range: '70-79', count: 8, color: '#FAAD14', label: '中等' },
                { range: '80-89', count: 16, color: '#1890FF', label: '良好' },
                { range: '90-100', count: 10, color: '#52C41A', label: '优秀' },
              ].map(b => (
                <div key={b.range} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[12px] font-medium text-[#353535]">{b.count}人</span>
                  <div
                    className="w-full rounded-t-[4px] transition-all"
                    style={{ height: `${(b.count / 20) * 100}px`, background: b.color, opacity: 0.85 }}
                  />
                  <span className="text-[10px] text-[#9A9A9A]">{b.label}</span>
                  <span className="text-[10px] text-[#9A9A9A]">{b.range}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 知识点覆盖度（有据引擎 Phase 0）── */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
          <div className="px-5 py-3 bg-[#F6F7F8] border-b border-[#E7E7EB] flex items-center justify-between cursor-pointer"
            onClick={() => setCoverageOpen(!coverageOpen)}>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-[#353535]">知识点覆盖度</h3>
              <span className="text-[10px] text-[#9A9A9A]">题库·试卷覆盖知识点占比</span>
            </div>
            <button className="flex items-center gap-1 text-[11px] text-[#02A7F0]">
              {coverageOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {coverageOpen ? '收起' : '展开'}
            </button>
          </div>
          {coverageOpen && (
            <div className="p-4">
              {coverage.length === 0 ? (
                <div className="text-center py-6">
                  <BookOpen size={24} className="mx-auto text-[#E7E7EB] mb-2" />
                  <p className="text-[12px] text-[#9A9A9A]">暂无覆盖度数据，请先创建题目并标记知识点</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {coverage.filter(c => c.level <= 2).map(c => {
                    const rate = c.coverage_rate
                    const color = rate >= 80 ? '#52C41A' : rate >= 50 ? '#FA8C16' : '#F5222D'
                    const indent = c.level * 16
                    return (
                      <div key={c.node_id} className="flex items-center gap-2 py-1">
                        <div className="flex-1 min-w-0 flex items-center gap-2" style={{ paddingLeft: indent }}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${rate >= 80 ? 'bg-green-400' : rate >= 50 ? 'bg-orange-400' : 'bg-red-400'}`} />
                          <span className="text-[12px] text-[#353535] truncate">{c.ming_cheng}</span>
                        </div>
                        <div className="flex items-center gap-2 w-48">
                          <div className="flex-1 h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, background: color }} />
                          </div>
                          <span className="text-[11px] font-medium shrink-0" style={{ color }}>{rate}%</span>
                        </div>
                        <span className="text-[10px] text-[#9A9A9A] w-16 text-right shrink-0">{c.covered_questions}/{c.total_questions}题</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
