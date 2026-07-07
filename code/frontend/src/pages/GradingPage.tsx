import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ArrowRight, Check, Send, Award, AlertTriangle } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { api } from '../lib/api'
import { useTeaching } from '../lib/TeachingContext'

interface Submission {
  id: string; student_name: string; student_no: string; submitted_at: string
  status: 'pending' | 'graded'; answers: { qid: string; question: string; student_answer: string; correct_answer: string; ai_score: number; max_score: number }[]
}

const MOCK: Submission[] = [
  { id: 'sub1', student_name: '赵大鹏', student_no: '20240007', submitted_at: '07-07 21:30', status: 'pending', answers: [
    { qid:'q1', question:'《观潮》作者是谁？', student_answer:'赵宗成', correct_answer:'赵宗成', ai_score:10, max_score:10 },
    { qid:'q2', question:'文中"天下奇观"指什么？', student_answer:'钱塘江大潮', correct_answer:'钱塘江大潮', ai_score:10, max_score:10 },
    { qid:'q3', question:'请用自己的话描述潮来时的景象', student_answer:'潮来时声音很大，像打雷一样，白色的浪花铺天盖地', correct_answer:'先闻其声如闷雷，后见白线横贯江面，潮头如城墙推进', ai_score:6, max_score:10 },
  ]},
  { id: 'sub2', student_name: '孙小飞', student_no: '20240008', submitted_at: '07-07 20:15', status: 'pending', answers: [
    { qid:'q1', question:'《观潮》作者是谁？', student_answer:'赵宗成', correct_answer:'赵宗成', ai_score:10, max_score:10 },
    { qid:'q2', question:'文中"天下奇观"指什么？', student_answer:'大潮', correct_answer:'钱塘江大潮', ai_score:5, max_score:10 },
    { qid:'q3', question:'请用自己的话描述潮来时的景象', student_answer:'潮来了，声音很大', correct_answer:'先闻其声如闷雷，后见白线横贯江面', ai_score:3, max_score:10 },
  ]},
  { id: 'sub3', student_name: '钱小强', student_no: '20240011', submitted_at: '07-07 19:45', status: 'graded', answers: [] },
]

export default function GradingPage() {
  const teaching = useTeaching()
  const [submissions] = useState<Submission[]>(MOCK)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [graded, setGraded] = useState<Set<string>>(new Set(['sub3']))

  const current = submissions[currentIdx]
  const gradedCount = graded.size
  const totalCount = submissions.length

  const handleScore = (qid: string, val: number) => {
    setScores(prev => ({ ...prev, [qid]: val }))
  }

  const submitGrade = () => {
    if (!current) return
    const newGraded = new Set(graded)
    newGraded.add(current.id)
    setGraded(newGraded)
    if (currentIdx < totalCount - 1) {
      setCurrentIdx(currentIdx + 1)
    }
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && currentIdx > 0) setCurrentIdx(currentIdx - 1)
    if (e.key === 'ArrowRight' && currentIdx < totalCount - 1) setCurrentIdx(currentIdx + 1)
    if (e.key === 'Enter' && !e.shiftKey) submitGrade()
  }, [currentIdx, totalCount])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (totalCount === 0) {
    return <AppLayout><div className="text-center py-16 text-[13px] text-[#9A9A9A]">暂无待批改作业</div></AppLayout>
  }

  return (
    <AppLayout>
      <div className="flex h-full gap-4" style={{ maxHeight: 'calc(100vh - 120px)' }}>
        {/* 左栏: 学生列表 */}
        <div className="w-[220px] bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden flex flex-col shrink-0">
          <div className="px-4 py-2 bg-[#F6F7F8] border-b border-[#E7E7EB] text-[12px] font-medium text-[#353535]">
            学生列表 ({gradedCount}/{totalCount})
          </div>
          <div className="flex-1 overflow-y-auto">
            {submissions.map((s, i) => (
              <button key={s.id} onClick={() => setCurrentIdx(i)}
                className={`w-full text-left px-4 py-2.5 border-b border-[#F0F0F0] text-[12px] hover:bg-[#F9FAFB] transition-colors ${i === currentIdx ? 'bg-[#EBF5FF] border-l-2 border-l-[#02A7F0]' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-[#353535] truncate">{s.student_name}</span>
                  {graded.has(s.id) && <Check size={11} className="text-green-500 shrink-0" />}
                </div>
                <div className="text-[10px] text-[#9A9A9A]">{s.student_no} · {s.submitted_at}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 中栏: 批阅区 */}
        <div className="flex-1 bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden flex flex-col min-w-0">
          <div className="px-4 py-2 bg-[#F6F7F8] border-b border-[#E7E7EB] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => currentIdx > 0 && setCurrentIdx(currentIdx - 1)} disabled={currentIdx <= 0} className="p-1 disabled:opacity-30"><ArrowLeft size={14} /></button>
              <span className="text-[13px] font-medium text-[#353535]">{current?.student_name}</span>
              <span className="text-[10px] text-[#9A9A9A]">{current?.student_no}</span>
              <button onClick={() => currentIdx < totalCount - 1 && setCurrentIdx(currentIdx + 1)} disabled={currentIdx >= totalCount - 1} className="p-1 disabled:opacity-30"><ArrowRight size={14} /></button>
            </div>
            <span className="text-[10px] text-[#9A9A9A]">← → 切换 Enter确认</span>
          </div>

          {/* 进度条 */}
          <div className="h-1 bg-[#F0F0F0]">
            <div className="h-full bg-[#02A7F0] transition-all" style={{ width: `${(gradedCount/totalCount)*100}%` }} />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {current?.answers.length ? current.answers.map((a, i) => {
              const currentScore = scores[a.qid] ?? a.ai_score
              const isLowConfidence = a.ai_score < a.max_score * 0.6
              return (
                <div key={a.qid} className="border border-[#F0F0F0] rounded-[4px] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium text-[#353535]">#{i+1} {a.question}</span>
                    {isLowConfidence && <span className="flex items-center gap-0.5 text-[10px] text-red-500"><AlertTriangle size={10} />低置信度</span>}
                  </div>
                  <div className="space-y-1.5">
                    <div><span className="text-[10px] text-[#9A9A9A]">学生回答：</span><span className="text-[12px] text-[#353535]">{a.student_answer}</span></div>
                    <div><span className="text-[10px] text-[#9A9A9A]">参考答案：</span><span className="text-[12px] text-[#52C41A]">{a.correct_answer}</span></div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#F0F0F0]">
                    <span className="text-[11px] text-[#9A9A9A]">AI预评分 {a.ai_score}/{a.max_score}</span>
                    <div className="flex items-center gap-1">
                      {[0,1,2,3,4,5,6,7,8,9,10].filter(n => n <= a.max_score).map(n => (
                        <button key={n} onClick={() => handleScore(a.qid, n)}
                          className={`w-6 h-6 rounded-full text-[10px] border transition-colors ${currentScore === n ? 'bg-[#02A7F0] text-white border-[#02A7F0]' : 'border-[#E7E7EB] hover:border-[#02A7F0]'}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            }) : <div className="text-center py-8 text-[13px] text-[#9A9A9A]">该学生暂无提交</div>}
          </div>

          <div className="px-4 py-2.5 border-t border-[#E7E7EB] bg-[#F6F7F8] flex justify-end">
            <button onClick={submitGrade} disabled={graded.has(current?.id || '')}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] disabled:opacity-50 disabled:cursor-not-allowed">
              <Send size={13} />{graded.has(current?.id || '') ? '已批阅' : '确认批阅'}
            </button>
          </div>
        </div>

        {/* 右栏: 小微助手 */}
        <div className="w-[280px] bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden flex flex-col shrink-0">
          <div className="px-4 py-2 bg-brand text-white text-[12px] font-medium">
            <Award size={12} className="inline mr-1" />小微批阅助手
          </div>
          <div className="flex-1 p-3 text-[11px] text-[#9A9A9A] space-y-2 overflow-y-auto">
            <p>⏱ 剩余 {totalCount - gradedCount} 人待批阅</p>
            <p>📊 当前进度 {Math.round(gradedCount/totalCount*100)}%</p>
            <p>💡 提示：低置信度的题目已标红，建议重点复核</p>
            <p>⌨️ 快捷键：←→切换学生，Enter确认批阅，Tab切换题目</p>
            {current?.answers.some(a => a.ai_score < a.max_score * 0.6) && (
              <p className="text-red-500">⚠️ 当前学生有低置信度题目，请仔细复核</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
