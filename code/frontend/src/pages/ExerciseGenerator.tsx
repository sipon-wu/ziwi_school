import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Sparkles, Send, RefreshCw, X, Target, BookOpen, Save, Check, AlertTriangle, Edit3 } from 'lucide-react'
import { useTeaching, getRecommendedDefaults } from '../lib/TeachingContext'
import { useKnowledgePicker } from '../hooks/useKnowledgePicker'
import { useKGContext } from '../lib/KnowledgeGraphContext'
import { questionBankAPI, assignmentAPI } from '../lib/api'
import AiPreviewBadge from '../components/AiPreviewBadge'

const PURPOSES = [
  { id: 'classwork', label: '课堂练习', icon: '📝', desc: '当堂巩固', count: [3, 5], difficulty: 'L1', time: '5-8分钟' },
  { id: 'homework', label: '课后作业', icon: '📚', desc: '课后巩固', count: [5, 10], difficulty: 'L1-L2', time: '15-20分钟' },
  { id: 'unit_test', label: '单元检测', icon: '📋', desc: '阶段测评', count: [15, 20], difficulty: 'L1-L2', time: '40分钟' },
  { id: 'monthly', label: '月考', icon: '📅', desc: '月度检测', count: [20, 25], difficulty: 'L1-L3', time: '60分钟' },
  { id: 'midterm', label: '期中考试', icon: '📊', desc: '学期中测评', count: [25, 30], difficulty: 'L1-L3', time: '90分钟' },
  { id: 'final', label: '期末考试', icon: '🏆', desc: '学期末测评', count: [30, 35], difficulty: 'L1-L3', time: '90分钟' },
  { id: 'mock', label: '模拟考试', icon: '🎯', desc: '升学适应', count: [20, 30], difficulty: 'L2-L3', time: '90分钟' },
  { id: 'olympiad', label: '奥数拓展', icon: '🌟', desc: '竞赛预备', count: [10, 15], difficulty: 'L3-L4', time: '40分钟' },
]

const ADVANCED_TYPES = [
  { id: 'judge', label: '判断题', subjects: ['数学', '语文', '英语'] },
  { id: 'match', label: '匹配题', subjects: ['语文', '英语'] },
  { id: 'cloze', label: '完形填空', subjects: ['语文', '英语'] },
  { id: 'reading', label: '阅读理解', subjects: ['语文', '英语'] },
  { id: 'essay', label: '解答题', subjects: ['数学'] },
  { id: 'drawing', label: '作图题', subjects: ['数学'] },
  { id: 'writing', label: '写作题', subjects: ['语文', '英语'] },
]

const SCHOOLS = [
  { id: 'bjsz', name: '北京四中', desc: '重视基础概念，题干简洁' },
  { id: 'rdfz', name: '人大附中', desc: '注重思维深度，常设进阶题' },
  { id: 'shzx', name: '上海中学', desc: '强调应用能力，融合实际' },
  { id: 'hsfz', name: '华南师大附中', desc: '题型多样，基础与拔高并重' },
  { id: 'szzx', name: '深圳中学', desc: '创新题型，跨学科融合' },
  { id: 'nsfz', name: '南京师大附中', desc: '传统文化融合，古文应用' },
]

const GRADE_NAMES = ['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级']

export default function ExerciseGenerator() {
  const navigate = useNavigate()
  const location = useLocation()
  const teaching = useTeaching()

  // 联动：从教案传来的预选知识点
  const preSelectedNodes = (location.state as any)?.preSelectedNodes as string[] | undefined

  // 共享知识点选取器
  const picker = useKnowledgePicker({ preSelectedNodes, autoSelect: true })
  const { setPicker: setKGPicker } = useKGContext()

  // 注册 picker 到 KnowledgePanel
  useEffect(() => {
    setKGPicker(picker as any)
    return () => setKGPicker(null)
  }, [picker])

  // 从 TeachingContext 读取全局配置
  const gradeName = GRADE_NAMES[teaching.grade - 1] || '四年级'

  // AI 推荐缺省值（跟随 TeachingContext 自动更新）
  const [knowledgePoint, setKnowledgePoint] = useState(teaching.current_lesson_name || '')
  const [difficulty, setDifficulty] = useState('L2')
  const [count, setCount] = useState(10)
  const [purpose, setPurpose] = useState('classwork')
  const [showPurposeGrid, setShowPurposeGrid] = useState(true)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['choice', 'fill', 'calculation'])
  const [selectedSchool, setSelectedSchool] = useState('')
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  // AI 预览态：生成后需教师确认
  const [aiPreview, setAiPreview] = useState(false)
  const [confirmedSet, setConfirmedSet] = useState<Set<number>>(new Set())
  const [editingQuestion, setEditingQuestion] = useState<number|null>(null)
  const [editContent, setEditContent] = useState('')
  // 保存/发布状态
  const [saving, setSaving] = useState(false)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [saveMsg, setSaveMsg] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [selectedClass, setSelectedClass] = useState('')
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [assignmentType, setAssignmentType] = useState('homework')
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [showPublishPanel, setShowPublishPanel] = useState(false)
  const [classes, setClasses] = useState<any[]>([])

  // TeachingContext 学科/年级变更时自动更新推荐缺省值
  useEffect(() => {
    const d = getRecommendedDefaults(teaching)
    setDifficulty(d.difficulty)
    setCount(d.count)
    setPurpose(d.purpose)
    setSelectedTypes(d.defaultTypes)
    setKnowledgePoint(teaching.current_lesson_name || '')
  }, [teaching.subject, teaching.grade, teaching.textbook_math])

  const handlePurposeChange = (pId: string) => {
    setPurpose(pId)
    setShowPurposeGrid(false) // 选后收起为摘要条
    const p = PURPOSES.find(x => x.id === pId)
    if (p) { setCount(Math.round((p.count[0] + p.count[1]) / 2)); setDifficulty(p.difficulty.includes('-') ? p.difficulty.split('-')[0] : p.difficulty) }
  }

  const toggleType = (typeId: string) => {
    setSelectedTypes(prev => prev.includes(typeId) ? prev.filter(t => t !== typeId) : [...prev, typeId])
  }

  const handleGenerate = async () => {
    if (!knowledgePoint.trim() && picker.selectedIds.length === 0) return
    setGenerating(true)
    setSavedIds([]); setSaveMsg(''); setShowPublishPanel(false)
    try {
      const res = await fetch('/api/v1/ai/exam/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('zhiwei_token') || '') },
        body: JSON.stringify({
          subject: teaching.subject, grade: gradeName, semester: teaching.semester,
          knowledge_point: knowledgePoint || undefined, difficulty, count,
          purpose, question_types: selectedTypes,
          school_style: selectedSchool || undefined,
          selected_knowledge_ids: picker.selectedIds,
          textbook_version: teaching.textbook_math,
        }),
      })
      const data = await res.json()
      setQuestions(data.questions || [])
      setTotalCount(data.total_questions || 0)
      setAiPreview(true)
      setConfirmedSet(new Set())
      setEditingQuestion(null)
    } catch (e: any) { alert('出题失败: ' + (e.message || '网络错误')) }
    setGenerating(false)
  }

  // 保存题目到个人题库
  const handleSaveToBank = async () => {
    if (questions.length === 0) return
    setSaving(true); setSaveMsg('')
    try {
      const kps = picker.selectedNodes.map((n: any) => n.name)
      const res = await questionBankAPI.save({
        questions: questions.map((q: any) => ({
          type: q.type || 'choice',
          content: q.content,
          difficulty: difficulty,
          knowledge_points: kps,
        })),
        subject: teaching.subject,
        grade: gradeName,
        semester: teaching.semester,
        textbook_version: teaching.textbook_math,
        chapter_unit: teaching.current_unit_name || teaching.current_lesson_name || '',
        source: 'ai_generated',
        source_prompt: `出题: ${knowledgePoint}, 用途: ${purpose}, 题型: ${selectedTypes.join(',')}`,
      })
      setSavedIds(res.question_ids || [])
      setSaveMsg(`已保存 ${res.count || res.question_ids?.length || 0} 道题目到个人题库`)
    } catch (e: any) {
      alert('保存失败: ' + (e.message || '网络错误'))
    }
    setSaving(false)
  }

  // 保存并发布作业
  const handlePublish = async () => {
    if (!selectedClass || !assignmentTitle.trim()) {
      alert('请选择班级和作业标题')
      return
    }
    setPublishing(true)
    try {
      // 先查重
      const dupRes = await questionBankAPI.checkDuplicate(selectedClass, savedIds)
      if (dupRes.has_duplicate) {
        setDuplicates(Object.values(dupRes.duplicates).flat())
        setPublishing(false)
        return
      }
      // 创建作业
      await assignmentAPI.create({
        class_id: selectedClass,
        subject: teaching.subject,
        title: assignmentTitle,
        type: assignmentType,
        question_ids: savedIds,
        difficulty_level: difficulty,
        knowledge_node_ids: JSON.stringify(picker.selectedIds),
      })
      alert('作业已发布！')
      navigate('/dashboard/exercises')
    } catch (e: any) {
      if (e.message?.includes('已经在该班级布置过') || e.message?.includes('409')) {
        setDuplicates(e.duplicates || [])
      } else {
        alert('发布失败: ' + (e.message || '网络错误'))
      }
    }
    setPublishing(false)
  }

  // 加载班级列表
  useEffect(() => {
    import('../lib/api').then(({ classAPI }) => {
      classAPI.list().then((res: any) => {
        setClasses(res.items || [])
      }).catch(() => {})
    })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18} className="text-gray-500" /></button>
        <div><h1 className="text-xl font-bold text-gray-900">新建出题</h1><p className="text-sm text-gray-500 mt-0.5">{teaching.textbook_math} · {gradeName}{teaching.semester}学期 · {teaching.current_unit_name || '选择单元'}</p></div>
      </div>

      {/* 教学进度 + 单元选择 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-[13px] font-semibold text-gray-700">当前进度</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand rounded-full transition-all" style={{ width: teaching.progress_percent + '%' }} />
          </div>
          <span className="text-xs text-gray-400">{teaching.progress_percent}%</span>
          {picker.currentUnits.length > 0 && (
            <select value={picker.selectedUnit} onChange={e => picker.handleUnitChange(e.target.value)} className="text-[12px] border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand">
              {picker.currentUnits.map((u: any) => <option key={u.unit} value={u.unit}>{u.unit}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* 命题用途 — 选后收起为摘要条 */}
      <div className="bg-white rounded-xl border border-gray-200">
        {showPurposeGrid ? (
          <div className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">命题用途</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 max-h-[400px] transition-all duration-300">
              {PURPOSES.map(p => (
                <button key={p.id} onClick={() => handlePurposeChange(p.id)}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${purpose === p.id ? 'border-brand bg-brand/5' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="text-lg mb-0.5">{p.icon}</div>
                  <div className="text-[13px] font-semibold text-gray-800">{p.label}</div>
                  <div className="text-[11px] text-gray-400">{p.desc} · {p.time}</div>
                  <div className="text-[10px] text-gray-300 mt-0.5">{p.count[0]}-{p.count[1]}题 · {p.difficulty}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 h-11 border-l-[3px] border-brand bg-brand/5 rounded-xl">
            <span className="text-lg">{PURPOSES.find(p=>p.id===purpose)?.icon}</span>
            <span className="text-[13px] font-semibold text-gray-800">{PURPOSES.find(p=>p.id===purpose)?.label}</span>
            <span className="text-[11px] text-gray-400">
              {PURPOSES.find(p=>p.id===purpose)?.count[0]}-{PURPOSES.find(p=>p.id===purpose)?.count[1]}题 · {PURPOSES.find(p=>p.id===purpose)?.difficulty} · {PURPOSES.find(p=>p.id===purpose)?.time}
            </span>
            <button
              onClick={() => setShowPurposeGrid(true)}
              className="ml-auto text-[11px] text-brand hover:text-brand-hover px-2 py-0.5 rounded hover:bg-brand/10 transition-colors"
            >
              修改
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {questions.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-3 mb-4">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">学科</label><select value={teaching.subject} onChange={e => teaching.setSubject(e.target.value as '语文'|'数学'|'英语')} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20"><option>语文</option><option>数学</option><option>英语</option></select></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">年级</label><select value={gradeName} onChange={e => { const idx = GRADE_NAMES.indexOf(e.target.value); if (idx >= 0) teaching.setGrade(idx + 1) }} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">{GRADE_NAMES.map(g => <option key={g}>{g}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">难度</label><select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20"><option value="L1">L1-基础</option><option value="L2">L2-中等</option><option value="L3">L3-进阶</option><option value="L4">L4-挑战</option></select></div>
                <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">知识点（选填，默认取当前单元）</label><input type="text" value={knowledgePoint} onChange={e => setKnowledgePoint(e.target.value)} placeholder={teaching.current_lesson_name || '如：分数加减法'} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20" /></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">题量</label><select value={count} onChange={e => setCount(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">{[3,5,8,10,15,20,25,30,35].map(n=><option key={n} value={n}>{n}题</option>)}</select></div>
              </div>

              <div className="mb-4"><label className="block text-xs font-medium text-gray-500 mb-2">题型（已选 {selectedTypes.length} 种）</label><div className="flex flex-wrap gap-1.5">
                {[{id:'choice',label:'选择'},{id:'fill',label:'填空'},{id:'calculation',label:'计算'},...ADVANCED_TYPES.filter(t=>t.subjects.includes(teaching.subject))].map(t=>(<button key={t.id} onClick={()=>toggleType(t.id)} className={`px-2.5 py-1 text-[12px] rounded-lg border transition-colors ${selectedTypes.includes(t.id)?'bg-brand/10 text-brand border-brand/30':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{t.label}</button>))}
              </div></div>

              <div className="mb-4"><label className="block text-xs font-medium text-gray-500 mb-2">名校风格（可选）</label><div className="flex flex-wrap gap-1.5">
                <button onClick={()=>setSelectedSchool('')} className={`px-2 py-1 text-[11px] rounded-lg border ${!selectedSchool?'bg-brand/10 text-brand border-brand/30':'border-gray-200 text-gray-400'}`}>标准</button>
                {SCHOOLS.map(s=>(<button key={s.id} onClick={()=>setSelectedSchool(s.id)} className={`px-2 py-1 text-[11px] rounded-lg border transition-colors ${selectedSchool===s.id?'bg-brand/10 text-brand border-brand/30':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{s.name}</button>))}
              </div>{selectedSchool&&<p className="text-[11px] text-gray-400 mt-1.5">"{SCHOOLS.find(s=>s.id===selectedSchool)?.desc}"</p>}</div>

              <button onClick={handleGenerate} disabled={generating||(!knowledgePoint.trim()&&picker.selectedIds.length===0)} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1A3A6B] to-[#2B5DA8] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 shadow-sm">
                {generating?<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>AI 正在出题...</>:<><Sparkles size={18}/>AI 智能出题</>}
              </button>
            </div>
          )}

          {generating&&<div className="bg-white rounded-xl border border-gray-200 p-8 text-center"><div className="w-12 h-12 mx-auto mb-4 border-4 border-[#1A3A6B]/20 border-t-[#1A3A6B] rounded-full animate-spin"/><p className="text-sm text-gray-500">小微正在生成{selectedTypes.length}种题型...</p></div>}

          {questions.length>0&&!generating&&(
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">{knowledgePoint||'知识图谱选题'} · {difficulty} · {totalCount}题</span>
                  <button onClick={handleGenerate} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-white"><RefreshCw size={14}/>重新生成</button>
                </div>
                <div className="p-5 space-y-2.5">
                  {questions.map((q:any, i:number) => {
                    const isConfirmed = confirmedSet.has(i)
                    const isEditing = editingQuestion === i
                    return (
                      <AiPreviewBadge
                        key={i}
                        preview={aiPreview && !isConfirmed}
                        confirmed={isConfirmed}
                        onConfirm={() => {
                          setConfirmedSet(prev => new Set(prev).add(i))
                        }}
                        onEdit={() => {
                          setEditingQuestion(i)
                          setEditContent(q.content || '')
                        }}
                        onCancel={() => {
                          setQuestions(prev => prev.filter((_: any, idx: number) => idx !== i))
                        }}
                      >
                        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium text-brand w-6 shrink-0">{i+1}.</span>
                          <div className="flex-1">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  value={editContent}
                                  onChange={e => setEditContent(e.target.value)}
                                  className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      setQuestions(prev => prev.map((q: any, idx: number) =>
                                        idx === i ? { ...q, content: editContent } : q
                                      ))
                                      setEditingQuestion(null)
                                      setConfirmedSet(prev => new Set(prev).add(i))
                                    }
                                    if (e.key === 'Escape') setEditingQuestion(null)
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    setQuestions(prev => prev.map((q: any, idx: number) =>
                                      idx === i ? { ...q, content: editContent } : q
                                    ))
                                    setEditingQuestion(null)
                                    setConfirmedSet(prev => new Set(prev).add(i))
                                  }}
                                  className="p-1 text-green-500 hover:bg-green-50 rounded"
                                >
                                  <Check size={14} />
                                </button>
                                <button onClick={() => setEditingQuestion(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-800">{q.content}</span>
                            )}
                            {q.type && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-400">
                                {q.type==='choice'?'选择':q.type==='fill'?'填空':q.type==='calculation'?'计算':q.type}
                              </span>
                            )}
                          </div>
                        </div>
                      </AiPreviewBadge>
                    )
                  })}
                </div>
              </div>

              {/* 操作按钮：保存 / 发布 */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={handleSaveToBank} disabled={saving || savedIds.length > 0}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border font-medium transition-all ${
                      savedIds.length > 0
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-white text-brand border-brand hover:bg-brand/5'
                    } disabled:opacity-60`}>
                    {savedIds.length > 0 ? <><Check size={16}/>{saveMsg}</> : saving ? <><div className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin"/>保存中...</> : <><Save size={16}/>保存到个人题库</>}
                  </button>
                  {savedIds.length > 0 && !showPublishPanel && (
                    <button onClick={() => { setShowPublishPanel(true); setAssignmentTitle(knowledgePoint + ' - ' + PURPOSES.find(p=>p.id===purpose)?.label || '') }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#1A3A6B] text-white text-sm rounded-xl hover:bg-[#2B5DA8] transition-colors shadow-sm">
                      <Send size={16}/>保存并布置为作业
                    </button>
                  )}
                </div>

                {/* 发布面板 */}
                {showPublishPanel && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    {duplicates.length > 0 && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                        <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
                        <div className="text-sm text-red-700">
                          <p className="font-medium">部分题目已在该班级布置过：</p>
                          {duplicates.map((d: any, i: number) => (
                            <p key={i} className="text-xs mt-1">· 题目 {(i+1)} 已在「{d.assignment_title}」中使用</p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">选择班级</label>
                        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">
                          <option value="">请选择班级</option>
                          {classes.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">作业类型</label>
                        <select value={assignmentType} onChange={e => setAssignmentType(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20">
                          <option value="homework">课后作业</option>
                          <option value="exercise">课堂练习</option>
                          <option value="exam">单元检测/考试</option>
                          <option value="composition">作文</option>
                          <option value="writing_game">写作游戏</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">作业标题</label>
                        <input type="text" value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)}
                          placeholder="输入作业标题" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handlePublish} disabled={publishing || !selectedClass || !assignmentTitle.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#1A3A6B] text-white rounded-lg hover:bg-[#2B5DA8] transition-colors disabled:opacity-50 text-sm font-medium shadow-sm">
                        {publishing ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>发布中...</> : <><Check size={16}/>确认发布</>}
                      </button>
                      <button onClick={() => { setShowPublishPanel(false); setDuplicates([]) }}
                        className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右侧：已选考点 */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1"><Target size={14} className="text-brand"/>已选考点</h3>{picker.selectedIds.length>0&&<button onClick={()=>picker.setSelectedIds([])} className="text-[11px] text-gray-400 hover:text-red-500">清除</button>}</div>
            {picker.selectedNodes.length===0?<p className="text-xs text-gray-400">点击下方图谱节点选择出题范围</p>:<div className="space-y-1.5 max-h-[200px] overflow-y-auto">{picker.selectedNodes.map(n=>(<div key={n.id} className="flex items-center justify-between text-xs py-1 px-2 bg-brand/5 rounded"><span className="text-gray-700">{n.name}</span><span className="text-[10px] text-gray-400">{n.difficulty}</span></div>))}</div>}
            {picker.selectedIds.length>0&&<button onClick={handleGenerate} disabled={generating} className="mt-3 w-full flex items-center justify-center gap-1 py-2 text-xs bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"><Send size={12}/>用选中考点出题</button>}
          </div>
          <button
            onClick={() => teaching.setKnowledgeGraphEnabled(!teaching.knowledgeGraphEnabled)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm rounded-xl border border-brand/10 text-brand bg-brand/5 hover:bg-brand/10 transition-colors"
          >
            <span className="flex items-center gap-2"><BookOpen size={14}/>知识图谱</span>
            <span className="text-[11px] text-gray-400">{teaching.knowledgeGraphEnabled ? '已开启' : '点击展开'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
