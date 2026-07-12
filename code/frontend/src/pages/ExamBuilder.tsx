import { useState, useEffect } from 'react'
import { Plus, X, Sparkles } from 'lucide-react'
import { useTeaching, getQuestionTypes } from '../lib/TeachingContext'
import { useKnowledgePicker } from '../hooks/useKnowledgePicker'
import { useKGContext } from '../lib/KnowledgeGraphContext'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { useToast } from '../components/Toast'
import EditorLayout from '../components/EditorLayout'
import KnowledgeGraphTool from '../components/KnowledgeGraphTool'
import ResourcePicker from '../components/ResourcePicker'

const GRADE_NAMES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']

export default function ExamBuilder() {
  const teaching = useTeaching()
  const { toast } = useToast()
  const gradeName = GRADE_NAMES[teaching.grade - 1] || '四年级'

  const picker = useKnowledgePicker({ autoSelect: true })
  const { setPicker: setKGPicker } = useKGContext()
  useState(() => { setKGPicker(picker as any); return () => setKGPicker(null) })

  const user = (() => { try { return JSON.parse(localStorage.getItem('zhiwei_user') || '{}') || { name: '张真真', school_name: '成都市金牛区第一小学', grade_class: '四年级 (1)班' } } catch { return { name: '张真真', school_name: '成都市金牛区第一小学', grade_class: '四年级 (1)班' } } })()

  // 表单状态
  const [examTitle, setExamTitle] = useState('')
  const [totalScore, setTotalScore] = useState(100)
  const [examDuration, setExamDuration] = useState(40)
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(getQuestionTypes(teaching.subject).map(t => [t.id, 0]))
  )
  // 学科切换时重置题型配比（数学不出现阅读理解，语文不出现计算等）
  useEffect(() => {
    setTypeCounts(Object.fromEntries(getQuestionTypes(teaching.subject).map(t => [t.id, 0])))
  }, [teaching.subject])

  // 选题状态
  const [selectedQuestions, setSelectedQuestions] = useState<any[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  // 退出提醒
  const hasChanges = examTitle.length > 0 || picker.selectedIds.length > 0 || selectedQuestions.length > 0
  useUnsavedChanges(hasChanges)

  // ── AI 智能组卷 ──
  const [generating, setGenerating] = useState(false)
  const handleAiGenerate = async () => {
    if (picker.selectedIds.length === 0) return
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/exam/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('zhiwei_token') || '') },
        body: JSON.stringify({
          subject: teaching.subject, grade: gradeName, semester: teaching.semester,
          difficulty: 'L2', count: Object.values(typeCounts).reduce((a, b) => a + b, 0) || 10,
          purpose: 'midterm', question_types: Object.entries(typeCounts).filter(([, c]) => c > 0).map(([t]) => t),
          selected_knowledge_ids: picker.selectedIds,
          textbook_version: teaching.currentTextbook(),
        }),
      })
      const data = await res.json()
      let questions = data.questions || []
      if (questions.length === 0 && data.content) {
        questions = parseAiExamContent(data.content)
      }
      setSelectedQuestions(questions.map((q: any, i: number) => ({ id: `ai_${Date.now()}_${i}`, ...q })))
      toast(`AI 已生成 ${questions.length} 道题目`, 'success')
    } catch (e: any) { toast('生成失败: ' + (e.message || '网络错误'), 'error') }
    setGenerating(false)
  }

  /** 解析百炼返回的 Markdown 题目（复用出题模块逻辑） */
  const parseAiExamContent = (md: string): any[] => {
    const qs: any[] = []
    let text = md.replace(/^```markdown\s*/, '').replace(/\s*```$/, '')
    const blocks = text.split(/\n(?=## \d+[.．]\s+|[-\*]\s*\*\*题目)/)
    for (const raw of blocks) {
      const block = raw.trim()
      if (!block) continue
      const headingMatch = block.match(/^#{1,3}\s*\d+[.．]\s*(\S+)/)
      const listMatch = block.match(/^[-\*]\s*\*\*题目[一二三四五六七八九十\d]+[：:]\s*(\S+?)\s*\*\*/)
      const qtype = (headingMatch || listMatch)?.[1]?.trim() || 'choice'
      const ansMatch = block.match(/\*\*答案[：:]\*\*\s*[：:]?\s*(.+)/) || block.match(/\*\*答案[：:]\*\*?\s*(.+)/)
      const answer = ansMatch?.[1]?.trim() || ''
      const lines = block.split('\n')
      const bodyLines = lines.filter(l => {
        const t = l.trim()
        return t && !/^#{1,3}\s*\d+[.．]/.test(t) && !/^[-\*]\s*\*\*题目/.test(t) && !/\*\*答案/.test(t) && !/\*\*解析/.test(t)
      })
      qs.push({ type: qtype, content: bodyLines.join('\n').trim() || block.slice(0, 200), answer })
    }
    return qs
  }

  const updateTypeCount = (typeId: string, value: number) => {
    setTypeCounts(prev => ({ ...prev, [typeId]: Math.max(0, value) }))
  }

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
                <span className="text-[#9A9A9A] w-10">班级</span>
                <span className="text-[#353535]">{user?.grade_class || '四年级 (1)班'}</span>
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

        {/* 试卷标题 */}
        <div className="px-5 py-3">
          <label className="block text-[12px] font-medium text-[#353535] mb-2">试卷标题 <span className="text-red-500">*</span></label>
          <input type="text" value={examTitle} onChange={e => setExamTitle(e.target.value)}
            placeholder="如：四年级语文第一单元检测"
            className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]" />
        </div>

        {/* 分数 + 时长 */}
        <div className="px-5 py-3 flex gap-3">
          <div className="flex-1">
            <label className="block text-[12px] text-[#9A9A9A] mb-1.5">总分</label>
            <select value={totalScore} onChange={e => setTotalScore(Number(e.target.value))}
              className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] bg-white">
              {[40, 50, 60, 80, 100, 120, 150].map(n => <option key={n} value={n}>{n} 分</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[12px] text-[#9A9A9A] mb-1.5">考试时长（分钟）</label>
            <input type="number" value={examDuration} onChange={e => setExamDuration(Number(e.target.value))} min={10} max={150}
              className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0]" />
          </div>
        </div>

        {/* 知识点 */}
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#353535]">知识点范围 <span className="text-red-500">*</span></span>
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
            <p className="text-[11px] text-[#9A9A9A]">请在右侧知识图谱中选取本卷考察的知识点范围</p>
          )}
        </div>

        {/* 题型配比 */}
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <label className="block text-[12px] font-medium text-[#353535] mb-2">题型配比</label>
          <div className="space-y-2">
            {getQuestionTypes(teaching.subject).map(t => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="text-[12px] text-[#353535] w-20 shrink-0">{t.label}</span>
                <input type="range" min={0} max={20} value={typeCounts[t.id] || 0}
                  onChange={e => updateTypeCount(t.id, Number(e.target.value))}
                  className="flex-1 h-1.5 bg-[#E7E7EB] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#02A7F0] [&::-webkit-slider-thumb]:rounded-full" />
                <span className="text-[12px] text-[#9A9A9A] w-8 text-right">{typeCounts[t.id] || 0}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#9A9A9A] mt-2">共计 {Object.values(typeCounts).reduce((a, b) => a + b, 0)} 题</p>
        </div>

        {/* 已选题目 */}
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#353535]">已选题目</span>
            <button onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-[#02A7F0] border border-[#02A7F0]/30 rounded-[4px] hover:bg-[#02A7F0]/5">
              <Plus size={12} />引用题目
            </button>
          </div>
          {selectedQuestions.length === 0 ? (
            <p className="text-[11px] text-[#9A9A9A]">点击「引用题目」从个人题库和校本题库中选择题目</p>
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

        {/* AI 智能组卷 */}
        <div className="px-5 py-3">
          <button onClick={handleAiGenerate} disabled={generating || picker.selectedIds.length === 0}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[4px] transition-colors disabled:opacity-50 ${generating ? 'bg-[#4A4A4A] text-white' : 'bg-[#353535] text-white hover:bg-[#1A1A1A]'}`}>
            <Sparkles size={20} className={generating ? 'animate-pulse text-[#02A7F0]' : 'text-[#02A7F0]'} />
            <span className="text-[13px]">{generating ? '正在生成题目...' : (picker.selectedIds.length === 0 ? '请先选取知识点范围' : 'AI 智能组卷')}</span>
          </button>
        </div>
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="px-5 py-3 border-t border-[#F0F0F0] bg-white shrink-0 flex gap-3">
        <button onClick={() => {
          if (!examTitle.trim()) { toast('请填写试卷标题', 'warning'); return }
          const tok = localStorage.getItem('zhiwei_token')
          fetch('/api/exams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
            body: JSON.stringify({
              title: examTitle, subject: teaching.subject, grade: gradeName,
              question_ids: selectedQuestions.map(q => q.id),
              total_score: totalScore, duration: examDuration, status: 'draft',
            }),
          }).then(r => { if (r.ok) toast('已保存为草稿', 'success'); else toast('保存失败', 'error') }).catch(() => toast('网络错误', 'error'))
        }}
          className="flex-1 px-4 py-2.5 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors">
          保存为草稿
        </button>
        <button onClick={() => toast('预览功能开发中', 'warning')}
          className="flex-1 px-4 py-2.5 text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] transition-colors">
          预览
        </button>
        <button onClick={() => toast('发布功能开发中，请先在出题页导出发布', 'warning')}
          className="flex-1 px-4 py-2.5 text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] transition-colors">
          发布
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
      <EditorLayout left={leftPanel} right={rightPanel} subtitle="AI辅助智能组卷，校本题库灵活搭配" />
      <ResourcePicker
        open={pickerOpen}
        mode="questions"
        onClose={() => setPickerOpen(false)}
        onSelect={items => setSelectedQuestions(items)}
        selectedIds={selectedQuestions.map(q => q.id)}
      />
    </>
  )
}
