import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, Send, RefreshCw, X } from 'lucide-react'
import { aiAPI } from '../lib/api'

// P0-4: 模拟班级列表（后期从API获取）
const MOCK_CLASSES = [
  { id: 'class-1', name: '三年级1班', grade: '三年级' },
  { id: 'class-2', name: '三年级2班', grade: '三年级' },
  { id: 'class-3', name: '四年级1班', grade: '四年级' },
  { id: 'class-4', name: '四年级2班', grade: '四年级' },
]

export default function ExerciseGenerator() {
  const navigate = useNavigate()
  const [subject, setSubject] = useState('数学')
  const [grade, setGrade] = useState('四年级')
  const [knowledgePoint, setKnowledgePoint] = useState('')
  const [difficulty, setDifficulty] = useState('L2')
  const [count, setCount] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)

  // P0-4: 发布作业弹窗状态
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState('')
  const [deadline, setDeadline] = useState('')
  const [publishing, setPublishing] = useState(false)

  const handleGenerate = async () => {
    if (!knowledgePoint.trim()) return
    setGenerating(true)
    try {
      const res = await aiAPI.generateExam({ subject, knowledge_point: knowledgePoint, grade, difficulty, count })
      setQuestions(res.questions || [])
      setTotalCount(res.total_questions || 0)
    } catch (e: any) {
      alert('出题失败: ' + (e.message || '网络错误'))
    }
    setGenerating(false)
  }

  // P0-4: 发布作业
  const handlePublish = async () => {
    if (!selectedClass) { alert('请选择目标班级'); return }
    setPublishing(true)
    try {
      // 调用作业创建API
      await fetch('/api/v1/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('zhiwei_token') || ''),
        },
        body: JSON.stringify({
          title: `${knowledgePoint} · ${difficulty}`,
          subject,
          grade,
          class_id: selectedClass,
          type: 'exercise',
          questions: JSON.stringify(questions),
          deadline: deadline || undefined,
        }),
      })
      setShowPublishModal(false)
      alert('作业已发布！')
      navigate('/dashboard/exercises')
    } catch (e: any) {
      alert('发布失败: ' + (e.message || '网络错误'))
    }
    setPublishing(false)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">新建出题</h1>
          <p className="text-sm text-gray-500 mt-0.5">输入知识点，AI 自动生成练习题</p>
        </div>
      </div>

      {questions.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label htmlFor="exam-subject" className="block text-sm font-medium text-gray-700 mb-1.5">学科</label>
              <select id="exam-subject" value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20">
                <option>语文</option><option>数学</option><option>英语</option>
              </select>
            </div>
            <div>
              <label htmlFor="exam-grade" className="block text-sm font-medium text-gray-700 mb-1.5">年级</label>
              <select id="exam-grade" value={grade} onChange={e => setGrade(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20">
                {['三年级','四年级','五年级','六年级'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="exam-diff" className="block text-sm font-medium text-gray-700 mb-1.5">难度级别</label>
              <select id="exam-diff" value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20">
                <option value="L1">L1 - 基础</option><option value="L2">L2 - 中等</option><option value="L3">L3 - 提高</option>
              </select>
            </div>
            <div className="col-span-2">
              <label htmlFor="exam-point" className="block text-sm font-medium text-gray-700 mb-1.5">知识点 <span className="text-red-500">*</span></label>
              <input id="exam-point" type="text" value={knowledgePoint} onChange={e => setKnowledgePoint(e.target.value)} placeholder="例如：分数加减法" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20" />
            </div>
            <div>
              <label htmlFor="exam-count" className="block text-sm font-medium text-gray-700 mb-1.5">题量</label>
              <select id="exam-count" value={count} onChange={e => setCount(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20">
                {[5,10,15,20].map(n => <option key={n} value={n}>{n} 道题</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!knowledgePoint.trim() || generating}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1A3A6B] to-[#2B5DA8] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 shadow-sm"
          >
            {generating ? (
              <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />AI 正在出题...</>
            ) : (
              <><Sparkles size={18} /> AI 智能出题</>
            )}
          </button>
        </div>
      )}

      {generating && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-[#1A3A6B]/20 border-t-[#1A3A6B] rounded-full animate-spin" />
          <p className="text-sm text-gray-500">小微正在生成练习题...</p>
        </div>
      )}

      {questions.length > 0 && !generating && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl flex items-center justify-between">
            <span className="font-medium text-gray-900">{knowledgePoint} · {difficulty} · {totalCount}题</span>
            <div className="flex items-center gap-2">
              <button onClick={handleGenerate} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-white">
                <RefreshCw size={14} /> 重新生成
              </button>
              <button onClick={() => setShowPublishModal(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#1A3A6B] text-white rounded-lg hover:bg-[#2B5DA8]">
                <Send size={14} /> 发布作业
              </button>
            </div>
          </div>
          <div className="p-6 space-y-3">
            {questions.map((q:any, i:number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-[#1A3A6B] w-6 flex-shrink-0">{i+1}.</span>
                <div className="flex-1">
                  <span className="text-sm text-gray-800">{q.content}</span>
                  {q.type && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-400">{q.type==='choice'?'选择':q.type==='fill'?'填空':'计算'}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* P0-4: 发布作业弹窗 */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowPublishModal(false)}>
          <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">发布作业</h3>
              <button onClick={() => setShowPublishModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} className="text-gray-400"/></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">作业标题</label>
                <div className="px-3 py-2 text-sm bg-gray-50 rounded-lg text-gray-700">{knowledgePoint} · {difficulty} · {totalCount}题</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">目标班级 <span className="text-red-500">*</span></label>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20">
                  <option value="">请选择班级</option>
                  {MOCK_CLASSES.filter(c => c.grade === grade).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">截止日期（可选）</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20" />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowPublishModal(false)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handlePublish} disabled={!selectedClass || publishing}
                className="flex-1 py-2.5 text-sm bg-[#1A3A6B] text-white rounded-lg hover:bg-[#2B5DA8] disabled:opacity-50 flex items-center justify-center gap-2">
                {publishing ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> 发布中...</> : <><Send size={14}/> 确认发布</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
