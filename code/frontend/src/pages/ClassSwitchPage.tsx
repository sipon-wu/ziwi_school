import { useState } from 'react'
import { Repeat, X, Check } from 'lucide-react'
import { useTeaching } from '../lib/TeachingContext'
import AppLayout from '../components/AppLayout'

interface Campus {
  id: string
  name: string
  label: string
  classes: { id: string; label: string; grade: number; subject: string }[]
}

const MOCK_CAMPUSES: Campus[] = [
  {
    id: 'c1', name: '金牛一小', label: '金牛一小',
    classes: [
      { id: 'cl1', label: '语文 · 四年级（1班）', grade: 4, subject: '语文' },
      { id: 'cl2', label: '语文 · 四年级（2班）', grade: 4, subject: '语文' },
      { id: 'cl3', label: '语文 · 四年级（实验班）', grade: 4, subject: '语文' },
    ],
  },
  {
    id: 'c2', name: '金牛一小分校', label: '金牛一小分校',
    classes: [],
  },
]

export default function ClassSwitchPage() {
  const teaching = useTeaching()
  const [showModal, setShowModal] = useState(true)
  const [selectedCampus, setSelectedCampus] = useState(MOCK_CAMPUSES[0].id)
  const [selectedClass, setSelectedClass] = useState('cl1')
  const [switched, setSwitched] = useState(false)

  const campus = MOCK_CAMPUSES.find(c => c.id === selectedCampus)
  const cls = campus?.classes.find(c => c.id === selectedClass)
  const isCurrent = cls?.subject === teaching.subject && cls?.grade === teaching.grade

  const handleSwitch = () => {
    if (cls && !isCurrent) {
      teaching.setSubject(cls.subject)
      teaching.setGrade(cls.grade)
      setSwitched(true)
      setTimeout(() => setSwitched(false), 2000)
    }
  }

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

        {/* 弹层 */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-[4px] shadow-2xl w-[520px] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              {/* 弹层头部 */}
              <div className="px-5 py-3 border-b border-[#E7E7EB] flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#353535]">班级切换</h3>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-[#F6F7F8] rounded-[4px]">
                  <X size={16} className="text-[#9A9A9A]" />
                </button>
              </div>

              <div className="flex" style={{ height: 320 }}>
                {/* 左侧：学校 */}
                <div className="w-36 border-r border-[#E7E7EB] bg-[#F9FAFB] py-2">
                  {MOCK_CAMPUSES.map(c => {
                    const isActive = c.id === selectedCampus
                    const hasActive = c.classes.some(cl => cl.id === selectedClass)
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCampus(c.id)
                          if (c.classes.length > 0) {
                            setSelectedClass(c.classes[0].id)
                          }
                        }}
                        className={`w-full text-left px-4 py-2.5 text-[12px] transition-colors ${isActive ? 'bg-white text-[#353535] font-medium border-l-2 border-[#02A7F0]' : 'text-[#595959] hover:bg-white/60'}`}
                      >
                        {c.name}
                        {hasActive && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[#52C41A] inline-block align-middle" />}
                      </button>
                    )
                  })}
                </div>

                {/* 右侧：班级 */}
                <div className="flex-1 p-4 overflow-y-auto">
                  <div className="space-y-1">
                    {campus?.classes.map(cl => {
                      const isActive = cl.id === selectedClass
                      return (
                        <button
                          key={cl.id}
                          onClick={() => setSelectedClass(cl.id)}
                          className={`w-full text-left px-4 py-2.5 rounded-[3px] text-[12px] transition-colors flex items-center gap-2.5
                            ${isActive
                              ? 'bg-[#02A7F0]/10 text-[#02A7F0] border border-[#02A7F0]/20'
                              : 'text-[#353535] hover:bg-[#F9FAFB]'
                            }`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-[#52C41A]' : 'bg-[#E7E7EB]'}`} />
                          {cl.label}
                          {isActive && <Check size={12} className="ml-auto text-[#52C41A]" />}
                        </button>
                      )
                    }) || (
                      <p className="text-[12px] text-[#9A9A9A] text-center py-8">该校区暂无可切换班级</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 底部确认 */}
              <div className="px-5 py-3 border-t border-[#E7E7EB] flex items-center justify-between">
                <div className="text-[11px] text-[#9A9A9A]">
                  {cls ? (
                    <span>
                      切换至：<span className="font-medium text-[#353535]">{campus?.name} · {cls.label}</span>
                      {isCurrent && <span className="ml-2 text-[#52C41A]">（当前）</span>}
                    </span>
                  ) : '请选择要切换的班级'}
                </div>
                <button
                  onClick={() => {
                    if (isCurrent) {
                      setShowModal(false)
                    } else {
                      handleSwitch()
                      setShowModal(false)
                    }
                  }}
                  className="px-5 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors"
                >
                  {isCurrent ? '关闭' : '确定切换'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 切换成功提示 */}
        {switched && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#353535] text-white text-[12px] rounded-[4px] shadow-lg flex items-center gap-1.5">
            <Check size={13} />已切换至 {campus?.name} · {cls?.label}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
