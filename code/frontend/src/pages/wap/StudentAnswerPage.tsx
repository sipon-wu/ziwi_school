import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Camera, Play, Volume2, Send } from 'lucide-react'

// 模拟题目数据
const EXERCISE_QUESTIONS = [
  { id:'Q1',type:'choice',stem:'3/4 + 1/2 = ?',options:['A. 5/4','B. 1','C. 1/4','D. 3/8'],answer:'A' },
  { id:'Q2',type:'fill',stem:'化简分数 18/24，结果是 ___',answer:'3/4' },
  { id:'Q3',type:'choice',stem:'2/3 ___ 3/5（比较大小）',options:['A. >','B. =','C. <','D. 无法比较'],answer:'A' },
  { id:'Q4',type:'calculation',stem:'小明有 3/4 块蛋糕，吃了 1/3，请列式计算还剩多少。',answer:'' },
  { id:'Q5',type:'fill',stem:'把 0.75 化成分数是 ___',answer:'3/4' },
]

// 写作游戏数据
const WRITING_GAME = {
  title:'My School Day',
  mode:'fill' as const,
  template:'I usually get up at ___ on school days. First, I ___ my teeth and wash my face. Then I have breakfast. My favorite breakfast is ___. School starts at 8:00 AM. My favorite subject is ___ because ___. After school, I like to ___ with my friends.',
  options:[
    ['7:00','7:30','8:00'],
    ['brush','comb','eat'],
    ['milk and bread','rice and eggs','noodles'],
    ['English','Math','Chinese'],
    ['it is fun','the teacher is nice','I like reading'],
    ['play basketball','read books','draw pictures'],
  ],
}

export default function StudentAnswerPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [mode, setMode] = useState<'answer'|'camera'|'game'|'submit'>('answer')
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [gameAnswers, setGameAnswers] = useState<string[]>(Array(WRITING_GAME.options.length).fill(''))
  const [currentQ, setCurrentQ] = useState(0)
  const [showSubmitModal, setShowSubmitModal] = useState(false)

  const isWritingGame = id === '3'

  if (isWritingGame && mode !== 'submit') {
    return <div className="bg-[#F5F5F5] px-4 py-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Play size={16} className="text-green-500"/>
          <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full">英文写作</span>
          <span className="text-[10px] text-gray-400 ml-auto">填空模式</span>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">{WRITING_GAME.title}</h3>
        <p className="text-xs text-gray-400 mb-4">选择合适的单词填入空白处</p>
        <div className="text-sm leading-8 text-gray-700">
          {WRITING_GAME.template.split('___').map((part,i)=>(
            <span key={i}>
              {part}
              {i < WRITING_GAME.options.length && (
                <select
                  value={gameAnswers[i]}
                  onChange={e=>{const n=[...gameAnswers];n[i]=e.target.value;setGameAnswers(n)}}
                  className="mx-0.5 px-2 py-0.5 text-xs border-b-2 border-[#1A3A6B] bg-blue-50 rounded outline-none"
                >
                  <option value="">选词</option>
                  {WRITING_GAME.options[i].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </span>
          ))}
        </div>
        <button className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 text-sm text-blue-600 bg-blue-50 rounded-lg active:bg-blue-100">
          <Volume2 size={15}/> 朗读范文
        </button>
      </div>
      <button onClick={()=>setShowSubmitModal(true)}
        className="mt-6 w-full py-3 bg-[#1A3A6B] text-white rounded-xl flex items-center justify-center gap-2 shadow-md active:bg-[#2B5DA8]">
        <Send size={16}/>提交写作
      </button>
      {showSubmitModal&&<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={()=>setShowSubmitModal(false)}>
        <div className="bg-white rounded-2xl p-6 mx-8 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
          <h3 className="text-base font-semibold text-gray-900 mb-1">确认提交</h3>
          <p className="text-sm text-gray-500 mb-4">提交后不可修改，确定要提交吗？</p>
          <div className="flex gap-3">
            <button onClick={()=>setShowSubmitModal(false)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl">取消</button>
            <button onClick={()=>{setMode('submit');setShowSubmitModal(false)}}
              className="flex-1 py-2.5 text-sm bg-[#1A3A6B] text-white rounded-xl">确认提交</button>
          </div>
        </div>
      </div>}
    </div>
  }

  // 作文模式
  if (mode === 'camera' || mode === 'submit') {
    return <div className="bg-[#F5F5F5] flex items-center justify-center p-6">
      {mode === 'submit' ? (
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-500"/>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">提交成功</h2>
          <p className="text-sm text-gray-500 mb-4">老师正在批阅，请耐心等待</p>
          <button onClick={()=>nav('/student')} className="px-8 py-2.5 bg-[#1A3A6B] text-white rounded-xl text-sm">返回作业列表</button>
        </div>
      ) : (
        <div className="text-center w-full">
          <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Camera size={36} className="text-blue-500"/>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">拍照上传作文</h2>
          <p className="text-sm text-gray-500 mb-2">请确保字迹清晰、光线充足</p>
          <p className="text-xs text-gray-400 mb-6">支持 JPG/PNG，图片小于 10MB</p>
          <button className="w-full py-3 bg-[#1A3A6B] text-white rounded-xl shadow-md active:bg-[#2B5DA8]">拍照</button>
          <button className="w-full mt-3 py-3 border border-gray-200 rounded-xl text-sm text-gray-600">从相册选择</button>
        </div>
      )}
    </div>
  }

  // 普通答题模式
  const q = EXERCISE_QUESTIONS[currentQ]
  const progress = ((currentQ + (answers[q.id] ? 1 : 0)) / EXERCISE_QUESTIONS.length) * 100

  return (
    <div className="bg-[#F5F5F5] pb-24">
      <div className="sticky top-0 bg-white border-b border-gray-100 z-40 px-4 py-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-400">{`${currentQ+1}/${EXERCISE_QUESTIONS.length}题`}</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
            <div className="h-full bg-green-500 rounded-full" style={{width:`${progress}%`}}/>
          </div>
        </div>
      </div>
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <span className="inline-block text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full mb-3">
            {q.type==='choice'?'选择题':q.type==='fill'?'填空题':'计算题'}
          </span>
          <p className="text-base font-medium text-gray-900 mb-4">{q.stem}</p>
          {q.type==='choice'&&<div className="space-y-2">{q.options!.map(o=>(
            <button key={o}
              onClick={()=>setAnswers({...answers,[q.id]:o})}
              className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${
                answers[q.id]===o?'border-[#1A3A6B] bg-blue-50 text-[#1A3A6B] font-medium':'border-gray-100 text-gray-600'
              } active:bg-gray-50`}>
              {o}
            </button>
          ))}</div>}
          {q.type==='fill'&&<input type="text" placeholder="请输入答案..."
            value={answers[q.id]||''}
            onChange={e=>setAnswers({...answers,[q.id]:e.target.value})}
            className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1A3A6B] focus:ring-2 focus:ring-[#1A3A6B]/10"/>}
          {q.type==='calculation'&&<textarea placeholder="请写下计算过程..."
            value={answers[q.id]||''}
            onChange={e=>setAnswers({...answers,[q.id]:e.target.value})}
            className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1A3A6B] focus:ring-2 focus:ring-[#1A3A6B]/10 min-h-[120px] resize-none"/>}
        </div>
      </div>
      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto px-4 flex gap-3">
        <button disabled={currentQ===0}
          onClick={()=>setCurrentQ(currentQ-1)}
          className="px-5 py-2.5 border border-gray-200 rounded-xl bg-white text-sm disabled:opacity-30">上一题</button>
        {currentQ<EXERCISE_QUESTIONS.length-1?(
          <button onClick={()=>setCurrentQ(currentQ+1)}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl bg-white text-sm">下一题</button>
        ):(
          <button onClick={()=>setShowSubmitModal(true)}
            className="flex-1 py-2.5 bg-[#1A3A6B] text-white rounded-xl text-sm shadow-md active:bg-[#2B5DA8] flex items-center justify-center gap-2">
            <Send size={15}/>提交作业
          </button>
        )}
      </div>
      {showSubmitModal&&<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={()=>setShowSubmitModal(false)}>
        <div className="bg-white rounded-2xl p-6 mx-8 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
          <h3 className="text-base font-semibold text-gray-900 mb-1">确认提交</h3>
          <p className="text-sm text-gray-500 mb-4">{`已作答 ${Object.keys(answers).length}/${EXERCISE_QUESTIONS.length} 题，提交后不可修改`}</p>
          <div className="flex gap-3">
            <button onClick={()=>setShowSubmitModal(false)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl">继续作答</button>
            <button onClick={()=>{setMode('submit');setShowSubmitModal(false)}}
              className="flex-1 py-2.5 text-sm bg-[#1A3A6B] text-white rounded-xl">确认提交</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
