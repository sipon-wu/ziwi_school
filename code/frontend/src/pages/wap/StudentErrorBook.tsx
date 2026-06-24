import { useState } from 'react'
import { Search, RotateCcw, ChevronRight, BookOpen } from 'lucide-react'

const ERRORS = [
  { id:'E1',question:'2/3 ___ 3/5（比较大小）',yourAnswer:'B. =',correctAnswer:'A. >',subject:'数学',date:'2026-06-15',reviewed:false },
  { id:'E2',question:'把 7/8 化简后的结果是？',yourAnswer:'4/8',correctAnswer:'1/2',subject:'数学',date:'2026-06-14',reviewed:true },
  { id:'E3',question:'分数 3/5 表示什么意思？',yourAnswer:'D. 把1分成5份取3份',correctAnswer:'B. 平均分成5份取3份',subject:'数学',date:'2026-06-12',reviewed:false },
  { id:'E4',question:'\"观潮\"中作者表达的中心思想',yourAnswer:'赞美大自然',correctAnswer:'赞美大自然的力量和祖国山河',subject:'语文',date:'2026-06-10',reviewed:false },
]

export default function StudentErrorBook() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [selected, setSelected] = useState<string|null>(null)
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set(ERRORS.filter(e=>e.reviewed).map(e=>e.id)))

  const filtered = ERRORS.filter(e=>{
    if(searchTerm&&!e.question.includes(searchTerm)) return false
    if(filterSubject&&e.subject!==filterSubject) return false
    return true
  })

  const toggleReviewed = (id:string)=>{const s=new Set(reviewedIds);s.has(id)?s.delete(id):s.add(id);setReviewedIds(s)}

  if(selected) {
    const e = ERRORS.find(x=>x.id===selected)!
    return (
      <div className="bg-[#F5F5F5] p-4">
        <button onClick={()=>setSelected(null)} className="mb-4 flex items-center gap-1 text-xs text-[#1A3A6B]">← 返回</button>
        <div className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm">
          <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-500 rounded-full mb-2 inline-block">复习模式</span>
          <p className="text-sm font-medium text-gray-900 mb-3">{e.question}</p>
          <div className="space-y-2 mb-4">
            <div className="flex items-start gap-2 p-2.5 bg-red-50 rounded-lg">
              <span className="text-[11px] text-red-500 font-medium">你的答案</span>
              <span className="text-[11px] text-red-700">{e.yourAnswer}</span>
            </div>
            <div className="flex items-start gap-2 p-2.5 bg-green-50 rounded-lg">
              <span className="text-[11px] text-green-600 font-medium">正确答案</span>
              <span className="text-[11px] text-green-700">{e.correctAnswer}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>{toggleReviewed(e.id);setSelected(null)}}
              className={`flex-1 py-2.5 rounded-xl text-sm ${reviewedIds.has(e.id)?'bg-green-50 text-green-600':'bg-[#1A3A6B] text-white'}`}>
              {reviewedIds.has(e.id)?'已掌握 ✓':'标记为已掌握'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#F5F5F5]">
      {/* 顶部统计 */}
      <div className="bg-white px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center py-2 bg-red-50 rounded-xl">
            <div className="text-xl font-bold text-red-500">{filtered.length}</div>
            <div className="text-[10px] text-gray-400">总错题</div>
          </div>
          <div className="flex-1 text-center py-2 bg-yellow-50 rounded-xl">
            <div className="text-xl font-bold text-yellow-500">{filtered.length-reviewedIds.size}</div>
            <div className="text-[10px] text-gray-400">待复习</div>
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 border border-[#1A3A6B] text-[#1A3A6B] rounded-xl text-xs font-medium active:bg-blue-50">
            <RotateCcw size={13}/>全部复习
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300"/>
            <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="搜索错题" className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#1A3A6B]"/>
          </div>
          <select value={filterSubject} onChange={e=>setFilterSubject(e.target.value)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">
            <option value="">全部学科</option><option value="语文">语文</option><option value="数学">数学</option><option value="英语">英语</option>
          </select>
        </div>
      </div>

      {/* 错题列表 */}
      <div className="px-3 py-3 space-y-2">
        {filtered.length===0?(
          <div className="text-center py-20 text-gray-300"><BookOpen size={48} className="mx-auto mb-3 opacity-30"/><p className="text-sm">暂无错题</p></div>
        ):filtered.map(e=>(
          <div key={e.id} onClick={()=>setSelected(e.id)}
            className="bg-white rounded-xl p-4 border border-gray-100 active:bg-gray-50 shadow-sm">
            <div className="flex items-start gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                reviewedIds.has(e.id)?'bg-green-100 text-green-500':'bg-red-100 text-red-500'
              } text-xs font-bold`}>{reviewedIds.has(e.id)?'✓':'!'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{e.question}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    e.subject==='语文'?'bg-blue-50 text-blue-500':'bg-orange-50 text-orange-500'
                  }`}>{e.subject}</span>
                  <span className="text-[10px] text-gray-400">{e.date}</span>
                </div>
              </div>
              <ChevronRight size={15} className="text-gray-300 mt-1 flex-shrink-0"/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
