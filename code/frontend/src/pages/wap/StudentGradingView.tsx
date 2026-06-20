import { Check, X, Lightbulb, BarChart3 } from 'lucide-react'

const GRADING_RESULT = {
  total_score: 85,
  questions: [
    { id:'Q1',type:'choice',stem:'3/4 + 1/2 = ?',student_answer:'A. 5/4',correct_answer:'A. 5/4',correct:true,feedback:'回答正确',score:10 },
    { id:'Q2',type:'fill',stem:'化简分数 18/24',student_answer:'3/4',correct_answer:'3/4',correct:true,feedback:'回答正确',score:10 },
    { id:'Q3',type:'choice',stem:'2/3 ___ 3/5',student_answer:'B. =',correct_answer:'A. >',correct:false,feedback:'2/3 = 0.667, 3/5 = 0.6, 所以 2/3 > 3/5',score:0 },
    { id:'Q4',type:'calculation',stem:'小明有 3/4 块蛋糕，吃了 1/3，列式计算',student_answer:'3/4-1/3=9/12-4/12=5/12',correct_answer:'5/12',correct:true,feedback:'计算正确，分步推理清晰',score:10 },
    { id:'Q5',type:'fill',stem:'0.75 化成分数',student_answer:'3/4',correct_answer:'3/4',correct:true,feedback:'回答正确',score:10 },
    { id:'Q6',type:'choice',stem:'5/6 - 1/3 = ?',student_answer:'C. 1/2',correct_answer:'C. 1/2',correct:true,feedback:'回答正确',score:10 },
    { id:'Q7',type:'fill',stem:'7/8 去掉3/8还剩多少',student_answer:'4/8',correct_answer:'1/2',correct:false,feedback:'4/8可化简为1/2',score:2 },
    { id:'Q8',type:'choice',stem:'分数 3/5 的意义',student_answer:'D. 把单位1分成5份取3份',correct_answer:'B. 把单位1平均分成5份取3份',correct:false,feedback:'注意"平均"是关键',score:0 },
  ],
  weakPoints: ['分数化简','分数意义理解'],
}

export default function StudentGradingView() {
  const { total_score, questions, weakPoints } = GRADING_RESULT
  const correct = questions.filter(q=>q.correct).length

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-6">
      {/* 成绩卡片 */}
      <div className="bg-gradient-to-b from-[#1A3A6B] to-[#2B5DA8] px-4 py-8 text-white text-center">
        <p className="text-sm text-white/70 mb-1">你的得分</p>
        <div className="text-5xl font-bold mb-1">{total_score}<span className="text-xl text-white/50">/100</span></div>
        <p className="text-sm text-white/80">{`答对 ${correct}/${questions.length} 题`}</p>
      </div>

      {/* 弱项提示 */}
      {weakPoints.length>0 && (
        <div className="mx-4 mt-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 flex items-start gap-2">
          <Lightbulb size={16} className="text-orange-500 mt-0.5 flex-shrink-0"/>
          <div>
            <p className="text-xs font-medium text-orange-700 mb-1">需要加强的知识点</p>
            <div className="flex flex-wrap gap-1">
              {weakPoints.map((w,i)=><span key={i} className="text-[10px] px-2 py-0.5 bg-white rounded-full text-orange-600 border border-orange-200">{w}</span>)}
            </div>
          </div>
        </div>
      )}

      {/* 逐题批阅 */}
      <div className="mx-4 mt-4 space-y-2.5">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={16} className="text-gray-500"/>
          <span className="text-sm font-medium text-gray-700">逐题解析</span>
        </div>
        {questions.map((q,i)=>(
          <div key={q.id} className={`bg-white rounded-xl p-4 border ${q.correct?'border-green-100':'border-red-100'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                q.correct?'bg-green-100':'bg-red-100'
              }`}>
                {q.correct?<Check size={14} className="text-green-600"/>:<X size={14} className="text-red-600"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-gray-400">{i+1}.</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    q.correct?'bg-green-50 text-green-600':'bg-red-50 text-red-600'
                  }`}>{q.correct?'正确':'错误'}</span>
                  <span className="text-[11px] text-gray-400 ml-auto">{q.score}分</span>
                </div>
                <p className="text-sm text-gray-800 mb-2">{q.stem}</p>
                {!q.correct && (
                  <div className="bg-gray-50 rounded-lg p-2.5 space-y-1.5">
                    {q.student_answer && <p className="text-xs"><span className="text-red-500">你的答案：</span><span className="text-gray-600">{q.student_answer}</span></p>}
                    <p className="text-xs"><span className="text-green-600">正确答案：</span><span className="text-gray-600">{q.correct_answer}</span></p>
                  </div>
                )}
                <p className="text-[11px] text-gray-400 mt-2">{q.feedback}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
