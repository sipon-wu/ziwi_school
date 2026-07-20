import { useState, useEffect } from 'react'
import { Repeat, X, Check } from 'lucide-react'
import { useTeaching, gradeToNum } from '../lib/TeachingContext'
import { classAPI } from '../lib/api'
import AppLayout from '../components/AppLayout'

interface MyClassItem {
  class_id: string
  class_name: string
  grade: string
  subject: string
  is_primary: boolean
}

export default function ClassSwitchPage() {
  const teaching = useTeaching()
  const [showModal, setShowModal] = useState(true)
  const [items, setItems] = useState<MyClassItem[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [switched, setSwitched] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    classAPI.myClasses().then(res => {
      const list = res?.items || []
      setItems(list)
      if (list.length > 0 && teaching.selectedClassId) {
        setSelectedClassId(teaching.selectedClassId)
      } else if (list.length > 0) {
        setSelectedClassId(list[0].class_id)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [teaching.selectedClassId])

  const selected = items.find(it => it.class_id === selectedClassId)
  const isCurrent = selected?.class_id === teaching.selectedClassId

  const handleSwitch = () => {
    if (selected && !isCurrent) {
      teaching.setSubject(selected.subject)
      teaching.setGrade(gradeToNum(selected.grade))
      teaching.selectClass({
        id: selected.class_id,
        label: selected.class_name,
        courseGroupId: '',
        subject: selected.subject as any,
        grade: gradeToNum(selected.grade),
        semester: '下',
        textbook: '',
      })
      setSwitched(true)
      setTimeout(() => setSwitched(false), 2000)
    }
  }

  if (loading) return <AppLayout><div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-[#02A7F0]/20 border-t-[#02A7F0] rounded-full animate-spin" /></div></AppLayout>

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-[#353535]">班级切换</h1>
          <p className="text-[11px] text-[#9A9A9A] mt-0.5">
            切换后，小微以及知识图谱的工作边界都会发生变化。学生、家长、任务、通知、工作记录等全部都会发生变化。
          </p>
          <p className="text-[11px] text-[#9A9A9A] mt-0.5">
            切换时，如工作台有正在编辑的任务，请提醒保存。所有切换均要进行二次确认。
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors flex items-center gap-1.5"
        >
          <Repeat size={15} />打开班级切换
        </button>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-[4px] shadow-2xl w-[480px] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-3 border-b border-[#E7E7EB] flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#353535]">选择任教班级</h3>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-[#F6F7F8] rounded-[4px]">
                  <X size={16} className="text-[#9A9A9A]" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto" style={{ maxHeight: 320 }}>
                {items.length === 0 ? (
                  <p className="text-[12px] text-[#9A9A9A] text-center py-8">暂无可切换班级</p>
                ) : (
                  <div className="space-y-1">
                    {items.map(it => {
                      const isActive = it.class_id === selectedClassId
                      return (
                        <button
                          key={it.class_id}
                          onClick={() => setSelectedClassId(it.class_id)}
                          className={`w-full text-left px-4 py-2.5 rounded-[3px] text-[12px] transition-colors flex items-center gap-2.5
                            ${isActive
                              ? 'bg-[#02A7F0]/10 text-[#02A7F0] border border-[#02A7F0]/20'
                              : 'text-[#353535] hover:bg-[#F9FAFB]'
                            }`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-[#52C41A]' : 'bg-[#E7E7EB]'}`} />
                          {it.subject} · {it.grade} ({it.class_name})
                          {it.is_primary && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 ml-auto">主班级</span>}
                          {isActive && <Check size={12} className="ml-auto text-[#52C41A]" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-[#E7E7EB] flex items-center justify-between">
                <div className="text-[11px] text-[#9A9A9A]">
                  {selected ? (
                    <span>
                      切换至：<span className="font-medium text-[#353535]">{selected.subject} · {selected.grade} ({selected.class_name})</span>
                      {isCurrent && <span className="ml-2 text-[#52C41A]">（当前）</span>}
                    </span>
                  ) : '请选择要切换的班级'}
                </div>
                <button
                  onClick={() => {
                    if (isCurrent) setShowModal(false)
                    else handleSwitch()
                    setShowModal(false)
                  }}
                  className="px-5 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors"
                >
                  {isCurrent ? '关闭' : '确定切换'}
                </button>
              </div>
            </div>
          </div>
        )}

        {switched && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#353535] text-white text-[12px] rounded-[4px] shadow-lg flex items-center gap-1.5">
            <Check size={13} />已切换至 {selected?.subject} · {selected?.grade} ({selected?.class_name})
          </div>
        )}
      </div>
    </AppLayout>
  )
}
