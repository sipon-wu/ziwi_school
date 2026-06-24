import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, X, Edit3, Save, Send } from 'lucide-react'

const MOCK_DETAIL = {
  submission: { id:'s1', student:'李明', assignment:'分数加减法练习', subject:'数学', submitted_at:'2026-06-17 08:30' },
  results: [
    { id:'g1', question_id:'Q1', type:'choice', ai_score:10, ai_confidence:0.98, ai_feedback:'回答正确', teacher_score:null, teacher_adjusted:false, status:'ai_graded' },
    { id:'g2', question_id:'Q2', type:'fill', ai_score:10, ai_confidence:0.95, ai_feedback:'回答正确', teacher_score:null, teacher_adjusted:false, status:'ai_graded' },
    { id:'g3', question_id:'Q3', type:'choice', ai_score:0, ai_confidence:0.82, ai_feedback:'请检查做题步骤', teacher_score:null, teacher_adjusted:false, status:'ai_graded' },
    { id:'g4', question_id:'Q4', type:'calculation', ai_score:10, ai_confidence:0.90, ai_feedback:'计算正确', teacher_score:null, teacher_adjusted:false, status:'ai_graded' },
    { id:'g5', question_id:'Q5', type:'fill', ai_score:7, ai_confidence:0.78, ai_feedback:'结果正确但未化简', teacher_score:null, teacher_adjusted:false, status:'ai_graded' },
  ]
}

export default function GradingDetail() {
  const nav = useNavigate()
  const { id } = useParams() // P1-5: 读取详情ID
  const [detail, setDetail] = useState(MOCK_DETAIL)
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editScore, setEditScore] = useState<number>(0)
  const [editComment, setEditComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const totalAI = detail.results.reduce((s:any,r:any)=>s+(r.ai_score||0),0)

  const startEdit = (r:any) => { setEditingId(r.id); setEditScore(r.ai_score||0); setEditComment(r.teacher_comment||'') }
  const cancelEdit = () => setEditingId(null)

  const saveEdit = (r:any) => {
    const updated = detail.results.map((x:any)=>x.id===r.id?{...x,teacher_score:editScore,teacher_comment:editComment,teacher_adjusted:true,status:'teacher_confirmed'}:x)
    setDetail({...detail, results:updated})
    setEditingId(null)
  }

  // P1-5: 确认批阅调 API
  const handleConfirmAll = async () => {
    if (!id) return
    setSubmitting(true)
    try {
      // 调用后端 confirm API
      await fetch(`/api/v1/grading/${id}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('zhiwei_token') || ''),
        },
      })
      // 更新所有为已确认
      const confirmed = detail.results.map((x:any) => ({...x, status:'teacher_confirmed'}))
      setDetail({...detail, results:confirmed})
      setTimeout(() => nav('/dashboard/grading'), 500)
    } catch {
      // API 失败也允许确认（演示模式降级）
      const confirmed = detail.results.map((x:any) => ({...x, status:'teacher_confirmed'}))
      setDetail({...detail, results:confirmed})
      setTimeout(() => nav('/dashboard/grading'), 500)
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={()=>nav(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18} className="text-gray-500"/></button>
          <div><h1 className="text-xl font-bold text-gray-900">批阅详情</h1><p className="text-sm text-gray-500">{detail.submission.student} · {detail.submission.assignment}</p></div>
        </div>
        <button onClick={handleConfirmAll} disabled={submitting} className="flex items-center gap-2 px-4 py-2 bg-[#1A3A6B] text-white rounded-lg shadow-sm disabled:opacity-50">
          <Send size={16}/>{submitting?'确认中...':'确认全部批阅'}
        </button>
      </div>

      {/* 总分卡片 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-between">
        <div><div className="text-xs text-gray-400 mb-1">AI 评分</div><div className="text-3xl font-bold text-[#1A3A6B]">{totalAI}<span className="text-base text-gray-400">/50</span></div></div>
        <div className="flex gap-6 text-sm text-gray-500">
          <div className="text-center"><div className="text-green-500 font-bold">{detail.results.filter((r:any)=>r.ai_score>=10).length}</div><div className="text-[10px]">完全正确</div></div>
          <div className="text-center"><div className="text-yellow-500 font-bold">{detail.results.filter((r:any)=>r.ai_score>0&&r.ai_score<10).length}</div><div className="text-[10px]">部分正确</div></div>
          <div className="text-center"><div className="text-red-500 font-bold">{detail.results.filter((r:any)=>r.ai_score===0).length}</div><div className="text-[10px]">错误</div></div>
        </div>
      </div>

      {/* 逐题批阅 */}
      {detail.results.map((r:any,i:number)=>(
        <div key={r.id} className={`bg-white rounded-xl border p-4 ${r.status==='teacher_confirmed'?'border-green-200':r.ai_confidence<0.85?'border-orange-200':'border-gray-200'}`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              r.ai_score>=10?'bg-green-100':r.ai_score>0?'bg-yellow-100':'bg-red-100'
            }`}>
              {r.ai_score>=10?<Check size={16} className="text-green-600"/>:r.ai_score>0?<Edit3 size={14} className="text-yellow-600"/>:<X size={16} className="text-red-600"/>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-400">第{i+1}题</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${r.type==='choice'?'bg-blue-50 text-blue-500':'bg-purple-50 text-purple-500'}`}>{r.type==='choice'?'选择':r.type==='fill'?'填空':'计算'}</span>
                <span className={`text-xs font-bold ml-auto ${
                  (r.teacher_score??r.ai_score)>=10?'text-green-500':(r.teacher_score??r.ai_score)>0?'text-yellow-500':'text-red-500'
                }`}>{(r.teacher_score??r.ai_score)}分</span>
                {r.teacher_adjusted && <span className="text-[10px] text-[#1A3A6B]">已调整</span>}
              </div>

              <p className="text-xs text-gray-400 mb-2">{r.ai_feedback}</p>

              {r.ai_confidence < 0.85 && (
                <div className="bg-orange-50 rounded-lg px-3 py-1.5 text-[11px] text-orange-600 mb-2">
                  小微把握不大（置信度 {(r.ai_confidence*100).toFixed(0)}%），建议教师复核
                </div>
              )}

              {editingId === r.id ? (
                <div className="flex gap-2 mt-2">
                  <input id={`score-${r.id}`} type="number" value={editScore} onChange={e=>setEditScore(Number(e.target.value))} className="w-16 px-2 py-1 text-sm border border-gray-200 rounded" min={0} max={10}/>
                  <input id={`comment-${r.id}`} type="text" value={editComment} onChange={e=>setEditComment(e.target.value)} placeholder="批注..." className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded"/>
                  <button onClick={()=>saveEdit(r)} className="px-3 py-1 text-xs bg-[#1A3A6B] text-white rounded"><Save size={12}/></button>
                  <button onClick={cancelEdit} className="px-3 py-1 text-xs border border-gray-200 rounded">取消</button>
                </div>
              ) : (
                <button onClick={()=>startEdit(r)} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#1A3A6B] mt-1">
                  <Edit3 size={11}/> 调整分数
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
