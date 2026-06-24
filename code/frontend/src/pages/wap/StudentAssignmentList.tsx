import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ChevronRight, FileText } from 'lucide-react'
import { useApi } from '../../lib/useApi'
import { studentAPI } from '../../lib/api'
import { EmptyState } from '../../components/StateComponents'

interface Assignment {
  id: string; title: string; subject: string; teacher: string
  type: 'exercise'|'composition'|'writing_game'; difficulty: string; questions: number
  due_date: string; submitted: boolean; score?: number
}
const MOCK: Assignment[] = [
  { id:'1',title:'分数加减法练习',subject:'数学',teacher:'李老师',type:'exercise',difficulty:'L2',questions:10,due_date:'2026-06-20',submitted:false },
  { id:'2',title:'《观潮》课后练习',subject:'语文',teacher:'张老师',type:'exercise',difficulty:'L1',questions:8,due_date:'2026-06-19',submitted:false },
  { id:'3',title:'Unit 3 词汇写作',subject:'英语',teacher:'王老师',type:'writing_game',difficulty:'L2',questions:15,due_date:'2026-06-21',submitted:false },
  { id:'4',title:'我的妈妈（作文）',subject:'语文',teacher:'张老师',type:'composition',difficulty:'L2',questions:1,due_date:'2026-06-16',submitted:true,score:85 },
  { id:'5',title:'小数运算练习',subject:'数学',teacher:'李老师',type:'exercise',difficulty:'L1',questions:8,due_date:'2026-06-14',submitted:true,score:92 },
]
const subjectColors: Record<string,string>={ '语文':'bg-blue-100 text-blue-600','数学':'bg-orange-100 text-orange-600','英语':'bg-green-100 text-green-600' }

export default function StudentAssignmentList() {
  const nav=useNavigate(); const [tab,setTab]=useState<'todo'|'done'>('todo')
  const { data: apiData } = useApi(() => studentAPI.listAssignments(), { items: MOCK })
  const allItems = apiData?.items || MOCK
  const list=allItems.filter((a: any)=>tab==='todo'?!a.submitted:a.submitted)
  const getIcon=(t:string)=>t==='composition'?'bg-purple-50 text-purple-500':t==='writing_game'?'bg-green-50 text-green-500':'bg-blue-50 text-blue-500'
  return (
    <>
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 lg:rounded-t-xl">
        <div className="flex">
          {[{k:'todo',l:'待完成'},{k:'done',l:'已完成'}].map(t=>{const c=MOCK.filter(a=>t.k==='todo'?!a.submitted:a.submitted).length
            return <button key={t.k} onClick={()=>setTab(t.k as any)}
              className={`flex-1 py-3 text-sm font-medium relative ${tab===t.k?'text-[#1A3A6B]':'text-gray-400'}`}>
              {t.l}<span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${tab===t.k?'bg-[#1A3A6B]/10':'bg-gray-100'}`}>{c}</span>
              {tab===t.k&&<div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#1A3A6B] rounded-full"/>}
            </button>
          })}
        </div>
      </div>
      <div className="px-3 py-3 space-y-2.5">
        {list.length===0?<EmptyState title={tab==='todo'?'暂无待完成作业':'暂无已完成作业'} description={tab==='todo'?'老师还没有布置新的作业':'还没有提交过作业'}/>
        :list.map(item=>(
          <div key={item.id} onClick={()=>nav(item.submitted?`/student/grading/${item.id}`:`/student/${item.id}`)}
            className="bg-white rounded-xl p-4 border border-gray-100 active:bg-gray-50 shadow-sm">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getIcon(item.type)}`}>
                <FileText size={18}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${subjectColors[item.subject]}`}>{item.subject}</span>
                  <span className="text-[10px] text-gray-400">{item.teacher}</span>
                  {item.submitted&&item.score!==undefined&&<span className={`text-[10px] font-bold ml-auto ${item.score>=85?'text-green-500':'text-yellow-500'}`}>{item.score}分</span>}
                </div>
                <h3 className="text-sm font-medium text-gray-900 truncate">{item.title}</h3>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[11px] text-gray-400">{item.questions}题</span>
                  <span className={`text-[11px] font-medium ${item.difficulty==='L1'?'text-green-500':item.difficulty==='L2'?'text-yellow-500':'text-red-500'}`}>{item.difficulty}</span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-400 ml-auto"><Clock size={11}/>{item.due_date}</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 mt-3 flex-shrink-0"/>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
