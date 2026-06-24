import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, XCircle, Bell, ChevronRight } from 'lucide-react'
import { useApi } from '../../lib/useApi'
import { parentAPI } from '../../lib/api'
import { ListSkeleton } from '../../components/StateComponents'

const MOCK = [
  { id:'1',assignment:'分数加减法练习',subject:'数学',teacher:'李老师',grade:'85分',status:'signed',signedAt:'2026-06-17 20:30',student:'李明' },
  { id:'2',assignment:'《观潮》课后练习',subject:'语文',teacher:'张老师',grade:'70分',status:'unsigned',dueDate:'2026-06-18',student:'李明' },
  { id:'3',assignment:'Unit 3 词汇写作',subject:'英语',teacher:'王老师',grade:'待评分',status:'unsigned',student:'李明' },
  { id:'4',assignment:'小数运算练习',subject:'数学',teacher:'李老师',grade:'92分',status:'signed',signedAt:'2026-06-14 19:15',student:'李明' },
]

const subjectColors: Record<string,string>={ '语文':'bg-blue-100 text-blue-600','数学':'bg-orange-100 text-orange-600','英语':'bg-green-100 text-green-600' }

export default function ParentAssignmentList() {
  const nav = useNavigate()
  const { data: apiData, loading } = useApi(() => parentAPI.listAssignments(), { items: MOCK })

  if (loading) return <ListSkeleton rows={4} />

  const items = apiData?.items || MOCK
  const unsigned = items.filter((a: any)=>a.status==='unsigned')
  const signed = items.filter((a: any)=>a.status==='signed')

  return (
    <div className="bg-[#F5F5F5]">
      {/* 顶部概览 */}
      <div className="bg-white px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-[#1A3A6B]">李</div>
          <div>
            <p className="text-sm font-medium text-gray-900">李明 的作业</p>
            <p className="text-[11px] text-gray-400">三年级2班</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 py-2.5 bg-orange-50 rounded-xl text-center">
            <div className="text-lg font-bold text-orange-500">{unsigned.length}</div>
            <div className="text-[10px] text-gray-400">待签字</div>
          </div>
          <div className="flex-1 py-2.5 bg-green-50 rounded-xl text-center">
            <div className="text-lg font-bold text-green-500">{signed.length}</div>
            <div className="text-[10px] text-gray-400">已签字</div>
          </div>
          {unsigned.length>0&&(
            <button className="flex items-center gap-1.5 px-4 py-2 bg-[#1A3A6B] text-white rounded-xl text-xs font-medium active:bg-[#2B5DA8] shadow-sm">
              <Bell size={13}/>全部提醒
            </button>
          )}
        </div>
      </div>

      {/* 作业列表 */}
      <div className="px-3 py-3 space-y-2.5">
        {MOCK.map(item => {
          const isOverdue = item.status==='unsigned' && item.dueDate && new Date(item.dueDate) < new Date()
          return (
            <div key={item.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  item.status==='signed'?'bg-green-50':isOverdue?'bg-red-50':'bg-orange-50'
                }`}>
                  {item.status==='signed'?<CheckCircle2 size={18} className="text-green-500"/>:
                   isOverdue?<XCircle size={18} className="text-red-400"/>:<Clock size={18} className="text-orange-400"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${subjectColors[item.subject]}`}>{item.subject}</span>
                    <span className="text-[10px] text-gray-400">{item.teacher}·{item.student}</span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 truncate">{item.assignment}</h3>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs font-medium text-gray-500">{item.grade}</span>
                    {item.status==='signed'?(
                      <span className="flex items-center gap-1 text-[11px] text-green-600 ml-auto"><CheckCircle2 size={11}/>{item.signedAt}</span>
                    ):(
                      <span className={`flex items-center gap-1 text-[11px] ml-auto ${isOverdue?'text-red-500':'text-orange-500'}`}>
                        <Clock size={11}/>
                        {isOverdue?'逾期未签':'待签字'}
                      </span>
                    )}
                  </div>
                </div>
                {item.status==='unsigned'?(
                  <button
                    onClick={()=>nav(`/parent/sign/${item.id}`)}
                    className="px-3 py-1.5 bg-[#1A3A6B] text-white rounded-lg text-xs font-medium flex-shrink-0 active:bg-[#2B5DA8] mt-2"
                  >去签字</button>
                ):(
                  <ChevronRight size={15} className="text-gray-300 mt-3 flex-shrink-0"/>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
