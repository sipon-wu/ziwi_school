import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Star, User, Building2, Filter, Send, Check, AlertTriangle, BookOpen } from 'lucide-react'
import { questionBankAPI } from '../lib/api'
import { useTeaching } from '../lib/TeachingContext'

const TYPE_LABELS: Record<string, string> = {
  choice: '选择', fill: '填空', calculation: '计算', judge: '判断',
  match: '匹配', cloze: '完形', reading: '阅读', essay: '解答',
  drawing: '作图', writing: '写作',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  L1: '基础', L2: '中等', L3: '进阶', L4: '挑战',
}

const RATING_TAGS = ['适合巩固基础', '适合拔高拓展', '必考题', '创新题型']

type QuestionItem = {
  id: string
  teacher_id: string
  teacher?: { name: string }
  subject: string
  grade: string
  type: string
  difficulty: string
  content: string
  avg_rating: number
  rating_count: number
  usage_count: number
  is_public: boolean
  audit_status: string
  auto_tags: string[]
  knowledge_points: string[]
  created_at: string
}

export default function QuestionBankPage() {
  const navigate = useNavigate()
  const teaching = useTeaching()
  const [tab, setTab] = useState<'personal' | 'school'>('personal')
  const [items, setItems] = useState<QuestionItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showRate, setShowRate] = useState<string | null>(null)
  const [rateScore, setRateScore] = useState(4)
  const [rateTags, setRateTags] = useState<string[]>([])
  const [rateComment, setRateComment] = useState('')
  const [stats, setStats] = useState<any>({})

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const params = { subject: filterSubject, type: filterType, difficulty: filterDifficulty, limit: 50 }
      let res: any
      if (tab === 'personal') {
        res = await questionBankAPI.listPersonal(params)
      } else {
        res = await questionBankAPI.listSchool(params)
      }
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [tab, filterSubject, filterType, filterDifficulty])

  useEffect(() => { fetchQuestions() }, [fetchQuestions])
  useEffect(() => {
    questionBankAPI.stats().then(r => setStats(r.data || {})).catch(() => {})
  }, [])

  const handleSearch = async () => {
    if (!keyword.trim()) { fetchQuestions(); return }
    setLoading(true)
    try {
      const res = await questionBankAPI.search(keyword, tab === 'personal' ? 'personal' : 'all')
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  const handleContribute = async () => {
    if (selectedIds.size === 0) return
    try {
      await questionBankAPI.contribute(Array.from(selectedIds))
      alert('已提交贡献申请，等待教研组长审核')
      setSelectedIds(new Set())
      fetchQuestions()
    } catch (e: any) { alert('贡献失败: ' + (e.message || '')) }
  }

  const handleRate = async (questionId: string) => {
    if (!rateScore) return
    // 评分需要关联真实批阅记录（用过才有资格评）
    // 当前评分功能需在批阅流程打通后启用
    alert('评分功能需要先完成一次批阅。请在批阅管理中对使用过该题目的作业进行评分。')
    return
  }

  const starDisplay = (rating: number, count: number) => (
    <div className="flex items-center gap-0.5">
      <Star size={12} className={rating >= 1 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
      <span className="text-xs text-gray-400 ml-1">{rating > 0 ? rating.toFixed(1) : '-'} {count > 0 && `(${count})`}</span>
    </div>
  )

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">题库管理</h1>
        <p className="text-sm text-gray-500 mt-1">管理个人题目和校本题库资源</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: '个人题目', value: stats.total_personal || 0, icon: User, color: 'bg-blue-50 text-blue-600' },
          { label: '校本题目', value: stats.total_school || 0, icon: Building2, color: 'bg-green-50 text-green-600' },
          { label: '已评分', value: stats.total_rated || 0, icon: Star, color: 'bg-yellow-50 text-yellow-600' },
          { label: '平均评分', value: (stats.avg_rating || 0) > 0 ? (stats.avg_rating || 0).toFixed(1) : '-', icon: Star, color: 'bg-purple-50 text-purple-600' },
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

      {/* Tab 切换 */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => { setTab('personal'); setSelectedIds(new Set()) }}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === 'personal' ? 'bg-white text-brand font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <User size={14} className="inline mr-1.5" />个人题库
        </button>
        <button onClick={() => { setTab('school'); setSelectedIds(new Set()) }}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === 'school' ? 'bg-white text-brand font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Building2 size={14} className="inline mr-1.5" />校本题库
        </button>
      </div>

      {/* 搜索过滤栏 */}
      <div className="flex flex-wrap items-center gap-2 lg:gap-3 bg-white p-3 rounded-xl border border-gray-200">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="搜索题目内容..." value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20" />
        </div>
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">
          <option value="">全部学科</option><option>语文</option><option>数学</option><option>英语</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">
          <option value="">全部题型</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">
          <option value="">全部难度</option>
          {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={handleSearch} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors">
          <Filter size={14} className="inline mr-1" />搜索
        </button>
      </div>

      {/* 批量操作 */}
      {tab === 'personal' && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-brand/5 px-4 py-2.5 rounded-xl border border-brand/10">
          <span className="text-sm text-brand font-medium">已选 {selectedIds.size} 题</span>
          <button onClick={handleContribute}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors">
            <Send size={12} />贡献到校本题库
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600">取消选择</button>
        </div>
      )}

      {/* 题目列表 */}
      <div className="space-y-3">
        {loading && <div className="text-center py-12 text-gray-400 text-sm">加载中...</div>}
        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">{tab === 'personal' ? '个人题库为空，生成题目后保存即可' : '校本题库暂无已审核通过的题目'}</p>
            {tab === 'personal' && (
              <button onClick={() => navigate('/dashboard/exercises/new')}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover">
                <Sparkles size={14} />AI 出题
              </button>
            )}
          </div>
        )}
        {!loading && items.map((q: QuestionItem) => (
          <div key={q.id} className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-relaxed">{q.content}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_LABELS[q.type] ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{TYPE_LABELS[q.type] || q.type}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      q.difficulty === 'L1' ? 'bg-green-50 text-green-600' :
                      q.difficulty === 'L2' ? 'bg-yellow-50 text-yellow-600' :
                      q.difficulty === 'L3' ? 'bg-orange-50 text-orange-600' :
                      'bg-red-50 text-red-600'
                    }`}>{DIFFICULTY_LABELS[q.difficulty] || q.difficulty}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{q.subject} · {q.grade}</span>
                    {q.is_public && <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded">校本</span>}
                    {q.audit_status === 'pending' && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-50 text-yellow-600 rounded">审核中</span>}
                    {Array.isArray(q.auto_tags) && q.auto_tags.map((t: string, i: number) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {starDisplay(q.avg_rating, q.rating_count)}
                  <span className="text-xs text-gray-400">使用 {q.usage_count} 次</span>
                  {q.teacher && <span className="text-xs text-gray-400">{q.teacher.name}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                {tab === 'personal' && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={selectedIds.has(q.id)} onChange={() => toggleSelect(q.id)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-brand focus:ring-brand" />
                    <span className="text-xs text-gray-400">选择</span>
                  </label>
                )}
                <button onClick={() => { setShowRate(q.id); setRateScore(4); setRateTags([]); setRateComment('') }}
                  className="text-xs text-brand hover:underline flex items-center gap-1">
                  <Star size={12} />评分
                </button>
                <button onClick={() => {
                  navigator.clipboard.writeText(q.content)
                }} className="text-xs text-gray-400 hover:text-gray-600">复制题目</button>
              </div>
            </div>
            {/* 评分弹窗 */}
            {showRate === q.id && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">评分</label>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button key={s} onClick={() => setRateScore(s)}
                          className="p-0.5"><Star size={20} className={s <= rateScore ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} /></button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">标签（可选）</label>
                    <div className="flex flex-wrap gap-1.5">
                      {RATING_TAGS.map(t => (
                        <button key={t} onClick={() => setRateTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                          className={`text-[11px] px-2 py-0.5 rounded border ${rateTags.includes(t) ? 'bg-brand/10 text-brand border-brand/30' : 'border-gray-200 text-gray-500'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleRate(q.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-brand text-white rounded-lg hover:bg-brand-hover">
                      <Check size={12} />提交评分
                    </button>
                    <button onClick={() => setShowRate(null)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {total > 50 && (
        <div className="text-center text-xs text-gray-400 py-4">显示 {Math.min(50, items.length)} / {total} 题，使用搜索过滤查看更多</div>
      )}
    </div>
  )
}
