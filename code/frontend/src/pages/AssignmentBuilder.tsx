import { useState } from 'react'
import { useTeaching } from '../lib/TeachingContext'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import EditorLayout from '../components/EditorLayout'
import KnowledgeGraphTool from '../components/KnowledgeGraphTool'
import { useKnowledgePicker } from '../hooks/useKnowledgePicker'
import { useKGContext } from '../lib/KnowledgeGraphContext'
import ResourcePicker from '../components/ResourcePicker'
import { assignmentAPI } from '../lib/api'
import { useToast } from '../components/Toast'
import { Plus, X, Clock } from 'lucide-react'

const CLASSES = [
  { id: 'c1', name: '四年级 (1)班', grade: '四年级' },
  { id: 'c2', name: '四年级 (2)班', grade: '四年级' },
  { id: 'c3', name: '四年级 (3)班', grade: '四年级' },
]

const GRADE_NAMES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']

export default function AssignmentBuilder() {
  const teaching = useTeaching()
  const { toast } = useToast()
  const gradeName = GRADE_NAMES[teaching.grade - 1] || '四年级'

  const picker = useKnowledgePicker({ autoSelect: true })
  const { setPicker: setKGPicker } = useKGContext()
  useEffect(() => { setKGPicker(picker as any); return () => setKGPicker(null) }, [picker, setKGPicker])

  const user = (() => { try { return JSON.parse(localStorage.getItem('zhiwei_user') || '{}') || { name: '张真真', school_name: '成都市金牛区第一小学' } } catch { return { name: '张真真', school_name: '成都市金牛区第一小学' } } })()

  // 表单
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedQuestions, setSelectedQuestions] = useState<any[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [assignmentDesc, setAssignmentDesc] = useState('')
  const [sharedToGrade, setSharedToGrade] = useState(false)

  // 定时发布
  const [enableSchedule, setEnableSchedule] = useState(false)
  const [scheduleDays, setScheduleDays] = useState<number[]>([])  // 0=周日,1=周一...6=周六
  const [scheduleTime, setScheduleTime] = useState('08:00')
  const [scheduleDate, setScheduleDate] = useState('')  // 自定义一次性日期

  const DAYS = [
    { id: 1, label: '周一' }, { id: 2, label: '周二' }, { id: 3, label: '周三' },
    { id: 4, label: '周四' }, { id: 5, label: '周五' }, { id: 6, label: '周六' }, { id: 0, label: '周日' },
  ]

  const toggleDay = (day: number) => {
    setScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const applyPreset = (preset: 'workday' | 'weekend' | 'all') => {
    if (preset === 'workday') setScheduleDays([1, 2, 3, 4, 5])
    else if (preset === 'weekend') setScheduleDays([6, 0])
    else setScheduleDays([0, 1, 2, 3, 4, 5, 6])
  }

  // 退出提醒
  const hasChanges = assignmentTitle.length > 0 || selectedClass.length > 0 || selectedQuestions.length > 0
  useUnsavedChanges(hasChanges)

  // ── 保存与发布 ──
  const [saving, setSaving] = useState(false)
  const handleSaveDraft = async () => {
    if (!selectedClass || !assignmentTitle.trim()) { toast('请选择班级并填写作业标题', 'warning'); return }
    setSaving(true)
    try {
      await assignmentAPI.create({
        class_id: selectedClass, subject: teaching.subject, title: assignmentTitle, type: 'homework',
        content: assignmentDesc || undefined,
        question_ids: selectedQuestions.map(q => q.id),
        knowledge_node_ids: JSON.stringify(picker.selectedIds),
      })
      toast('作业已保存为草稿', 'success')
    } catch (e: any) { toast('保存失败: ' + (e.message || '网络错误'), 'error') }
    setSaving(false)
  }

  // 生成未来7天的日期选项
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const leftPanel = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {/* 基本信息 */}
        <div className="px-5 py-3">
          <h3 className="text-[13px] font-semibold text-[#353535] mb-3">基本信息</h3>
          <div className="flex gap-4">
            <div className="space-y-2 text-[12px] flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[#9A9A9A] w-10">学科</span>
                <span className="text-[#353535]">{teaching.subject}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#9A9A9A] w-10">年级</span>
                <span className="text-[#353535]">{gradeName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#9A9A9A] w-10">教师</span>
                <span className="text-[#353535]">{user?.name || '张真真'}</span>
              </div>
            </div>
            <div className="w-[80px] h-[100px] bg-[#F6F7F8] rounded-[4px] border border-[#E7E7EB] flex items-center justify-center text-[11px] text-[#9A9A9A] text-center">
              {teaching.currentTextbook()}<br />{gradeName}{teaching.semester === '下' ? '下册' : '上册'}
              {teaching.licenseStatus === 'active'
                ? <span className="text-[#15A85F]"> · 学校统一配置</span>
                : <span className="text-[#9A9A9A]"> · 个人试用</span>}
            </div>
          </div>
        </div>

        {/* 标题 */}
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <label className="block text-[12px] font-medium text-[#353535] mb-2">作业标题 <span className="text-red-500">*</span></label>
          <input type="text" value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)}
            placeholder="如：《观潮》课后阅读练习"
            className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]" />
        </div>

        {/* 班级 */}
        <div className="px-5 py-3">
          <label className="block text-[12px] font-medium text-[#353535] mb-2">班级 <span className="text-red-500">*</span></label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
            <option value="">请选择班级</option>
            {CLASSES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* 已选题目 */}
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#353535]">作业题目</span>
            <button onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-[#02A7F0] border border-[#02A7F0]/30 rounded-[4px] hover:bg-[#02A7F0]/5">
              <Plus size={12} />引用题目
            </button>
          </div>
          {selectedQuestions.length === 0 ? (
            <p className="text-[11px] text-[#9A9A9A]">点击「引用题目」从题库中选择题目</p>
          ) : (
            <div className="space-y-1 max-h-[160px] overflow-y-auto">
              {selectedQuestions.map((q, i) => (
                <div key={q.id} className="flex items-center justify-between text-[12px] py-1 px-2 bg-[#F6F7F8] rounded-[4px]">
                  <span className="text-[#353535] truncate mr-2">{i + 1}. {q.content}</span>
                  <button onClick={() => setSelectedQuestions(prev => prev.filter(x => x.id !== q.id))}
                    className="text-[#9A9A9A] hover:text-[#FF4D4F] shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 作业说明 */}
        <div className="px-5 py-3">
          <label className="block text-[12px] text-[#9A9A9A] mb-2">作业说明（选填）</label>
          <textarea value={assignmentDesc} onChange={e => setAssignmentDesc(e.target.value)}
            rows={3} placeholder="如：请认真阅读文章后完成练习"
            className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] resize-none" />
        </div>

        {/* 分享到同年级 */}
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={sharedToGrade} onChange={e => setSharedToGrade(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#E7E7EB] text-[#02A7F0] focus:ring-[#02A7F0]" />
            <span className="text-[12px] text-[#353535]">其它班可用</span>
            <span className="text-[10px] text-[#9A9A9A]">（仅自己任课班级可见，可随时取消）</span>
          </label>
        </div>

        {/* 定时发布 */}
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input type="checkbox" checked={enableSchedule} onChange={e => setEnableSchedule(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#E7E7EB] text-[#02A7F0] focus:ring-[#02A7F0]" />
            <Clock size={14} className="text-[#9A9A9A]" />
            <span className="text-[12px] font-medium text-[#353535]">定时发布</span>
          </label>
          {enableSchedule && (
            <div className="p-3 bg-[#F6F7F8] rounded-[4px] space-y-3">
              {/* 快速预设 + 时间 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-[#9A9A9A] shrink-0">快捷：</span>
                <button onClick={() => applyPreset('workday')}
                  className="px-2 py-0.5 text-[10px] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] hover:text-[#02A7F0] text-[#9A9A9A]">
                  工作日晚间
                </button>
                <button onClick={() => applyPreset('weekend')}
                  className="px-2 py-0.5 text-[10px] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] hover:text-[#02A7F0] text-[#9A9A9A]">
                  周末
                </button>
                <button onClick={() => applyPreset('all')}
                  className="px-2 py-0.5 text-[10px] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] hover:text-[#02A7F0] text-[#9A9A9A]">
                  每天
                </button>
              </div>

              {/* 星期选择 */}
              <div className="flex gap-1">
                {DAYS.map(d => (
                  <button key={d.id} onClick={() => toggleDay(d.id)}
                    className={`flex-1 py-1.5 text-[11px] rounded-[4px] border transition-colors ${
                      scheduleDays.includes(d.id)
                        ? 'bg-[#02A7F0] text-white border-[#02A7F0]'
                        : 'bg-white text-[#9A9A9A] border-[#E7E7EB] hover:border-[#02A7F0] hover:text-[#02A7F0]'
                    }`}>
                    {d.label}
                  </button>
                ))}
              </div>

              {/* 时间 + 一次性日期 */}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[11px] text-[#9A9A9A] mb-1">发布时间</label>
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] text-[#9A9A9A] mb-1">截止日期（可选）</label>
                  <select value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
                    <option value="">不设置</option>
                    {dateOptions.map(d => (
                      <option key={d} value={d}>{d} {d === dateOptions[0] ? '(今天)' : d === dateOptions[1] ? '(明天)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[10px] text-[#9A9A9A]">
                {scheduleDays.length === 0 ? '请选择要自动发布的星期' :
                  scheduleDays.length === 7 ? '每天' :
                  scheduleDays.filter(d => d > 0 && d < 6).length === scheduleDays.length ? '工作日（周一至周五）' :
                  scheduleDays.filter(d => d === 0 || d === 6).length === scheduleDays.length ? '周末（周六周日）' :
                  `${scheduleDays.sort().map(d => DAYS.find(x => x.id === d)?.label).join('、')}`
                } 在 {scheduleTime} 自动发布
              </p>
            </div>
          )}
        </div>

        {/* 知识点 */}
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#353535] text-[#9A9A9A]">关联知识点（可选）</span>
            <span className="text-[10px] text-[#9A9A9A]">({picker.selectedIds.length}/12)</span>
          </div>
          {picker.selectedNodes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {picker.selectedNodes.map(n => (
                <span key={n.id} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#F0F0F0] text-[#353535] rounded-full">
                  {n.name}
                  <button onClick={() => picker.setSelectedIds(prev => prev.filter(id => id !== n.id))} className="text-[#9A9A9A] hover:text-[#FF4D4F]">✕</button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[#9A9A9A]">可在右侧知识图谱中选取</p>
          )}
        </div>
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="px-5 py-3 border-t border-[#F0F0F0] bg-white shrink-0 flex gap-3">
        <button onClick={handleSaveDraft} disabled={saving}
          className="flex-1 px-4 py-2.5 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors disabled:opacity-50">
          {saving ? '保存中...' : '保存为草稿'}
        </button>
        <button onClick={() => toast('预览功能开发中', 'warning')}
          className="flex-1 px-4 py-2.5 text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] transition-colors">
          预览
        </button>
        <button onClick={async () => {
          if (!selectedClass || !assignmentTitle.trim()) { toast('请先填写标题并选择班级', 'warning'); return }
          try {
            const tok = localStorage.getItem('zhiwei_token')
            const res = await fetch('/api/assignments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
              body: JSON.stringify({
                class_id: selectedClass, subject: teaching.subject, title: assignmentTitle, type: 'homework',
                content: assignmentDesc || undefined,
                question_ids: selectedQuestions.map(q => q.id),
                knowledge_node_ids: JSON.stringify(picker.selectedIds),
              }),
            })
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'HTTP ' + res.status) }
            toast('已发布', 'success')
          } catch (e: any) { toast('发布失败: ' + (e.message || ''), 'error') }
        }}
          className="flex-1 px-4 py-2.5 text-[13px] text-white bg-[#15A85F] rounded-[4px] hover:bg-[#1B8C4F] transition-colors">
          {enableSchedule ? '定时发布' : '立即发布'}
        </button>
      </div>
    </div>
  )

  const rightPanel = (
    <KnowledgeGraphTool
      data={picker.knowledgeData}
      filter={{ subject: teaching.subject, grade: teaching.grade, semester: teaching.semester }}
      selectedIds={picker.selectedIds}
      onSelect={ids => picker.setSelectedIds(ids)}
    />
  )

  return (
    <>
      <EditorLayout mode="primary" primaryLeft={leftPanel} primaryRight={rightPanel} subtitle="定向布置作业，支持定时发布与批阅反馈" />
      <ResourcePicker
        open={pickerOpen}
        mode="questions"
        questionSource="all"
        onClose={() => setPickerOpen(false)}
        onSelect={items => setSelectedQuestions(items)}
        selectedIds={selectedQuestions.map(q => q.id)}
      />
    </>
  )
}
