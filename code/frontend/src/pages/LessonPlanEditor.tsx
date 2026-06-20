import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, Save, BookOpen, Send } from 'lucide-react'
import { aiAPI, lessonPlanAPI } from '../lib/api'

export default function LessonPlanEditor() {
  const navigate = useNavigate()
  const [subject, setSubject] = useState('语文')
  const [grade, setGrade] = useState('四年级')
  const [lessonTitle, setLessonTitle] = useState('')
  const [textbookUnit, setTextbookUnit] = useState('')
  const [period, setPeriod] = useState(1)
  const [template, setTemplate] = useState('core_literacy')
  const [generating, setGenerating] = useState(false)
  const [content, setContent] = useState('')
  const [planId, setPlanId] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const [curriculum, setCurriculum] = useState<any[]>([])
  const [modelVersion, setModelVersion] = useState('')
  const [genTime, setGenTime] = useState(0)

  const handleGenerate = async () => {
    if (!lessonTitle.trim()) return
    setGenerating(true)
    try {
      const res = await aiAPI.generateLessonPlan({ subject, grade, lesson_title:lessonTitle, textbook_unit:textbookUnit, period, format_template:template })
      setContent(res.content); setCurriculum(res.curriculum_alignments||[]); setModelVersion(res.model||'qwen-plus'); setGenTime(res.generation_time_ms||0)
      const saved = await lessonPlanAPI.create({ subject, grade, lesson_title:lessonTitle, textbook_unit:textbookUnit, period, content:res.content, format_template:template, curriculum_alignments:JSON.stringify(res.curriculum_alignments||[]), ai_generated:true, ai_model_version:res.model||'qwen-plus', generation_time_ms:res.generation_time_ms })
      setPlanId(saved.id)
    } catch(e:any) { alert('AI 生成失败: '+(e.message||'未知错误')) }
    setGenerating(false)
  }

  const handleFinalize = async () => { if(!planId)return; setSaving(true); try{ await lessonPlanAPI.update(planId,{content}); await lessonPlanAPI.finalize(planId); navigate('/dashboard/lesson-plans') } catch(e:any){ alert('定稿失败') }; setSaving(false) }
  const handleSaveDraft = async () => { if(!planId)return; try{ await lessonPlanAPI.update(planId,{content}) } catch{} }

  return (<div className="space-y-6 max-w-5xl">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={()=>navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18} className="text-gray-500"/></button>
        <div><h1 className="text-xl font-bold text-gray-900">新建教案</h1><p className="text-sm text-gray-500 mt-0.5">AI 辅助生成结构化教案，支持课标自动对齐</p></div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleSaveDraft} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"><Save size={16}/>保存草稿</button>
        <button onClick={handleFinalize} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-[#1A3A6B] rounded-lg hover:bg-[#2B5DA8] disabled:opacity-50"><Save size={16}/>{saving?'保存中...':'保存'}</button>
      </div>
    </div>

    {!content&&<div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">教案基本信息</h2>
      <div className="grid grid-cols-3 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">学科</label><select value={subject} onChange={e=>setSubject(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"><option>语文</option><option>数学</option><option>英语</option></select></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">年级</label><select value={grade} onChange={e=>setGrade(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">{['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级'].map(g=><option key={g}>{g}</option>)}</select></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">课时</label><select value={period} onChange={e=>setPeriod(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">{[1,2,3,4,5].map(n=><option key={n} value={n}>第{n}课时</option>)}</select></div>
        <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1.5">课题名称 <span className="text-red-500">*</span></label><input type="text" value={lessonTitle} onChange={e=>setLessonTitle(e.target.value)} placeholder="例如：《观潮》第一课时" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20"/></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">教材单元</label><input type="text" value={textbookUnit} onChange={e=>setTextbookUnit(e.target.value)} placeholder="部编版四上第一单元" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"/></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">教案模板</label><select value={template} onChange={e=>setTemplate(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"><option value="core_literacy">核心素养模板</option><option value="3d_objective">三维目标模板</option><option value="unit_teaching">单元教学模板</option></select></div>
      </div>
      <div className="mt-6 pt-6 border-t border-gray-100">
        <button onClick={handleGenerate} disabled={!lessonTitle.trim()||generating} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1A3A6B] to-[#2B5DA8] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 shadow-sm">
          {generating?<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>AI 正在生成教案...</>:<><Sparkles size={18}/>AI 生成教案</>}
        </button>
        <span className="ml-3 text-xs text-gray-400">预计 15-30 秒，自动对齐课标</span>
      </div>
    </div>}

    {generating&&<div className="bg-white rounded-xl border border-gray-200 p-8 text-center"><div className="w-12 h-12 mx-auto mb-4 border-4 border-[#1A3A6B]/20 border-t-[#1A3A6B] rounded-full animate-spin"/><p className="text-sm text-gray-500">小微正在生成教案...</p><p className="text-xs text-gray-400 mt-1">正在检索课标要求、匹配知识点</p></div>}

    {content&&!generating&&<div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
        <div className="flex items-center gap-3"><BookOpen size={18} className="text-[#1A3A6B]"/><span className="font-medium text-gray-900">{lessonTitle}</span><span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">AI 生成</span></div>
        <div className="flex items-center gap-2 text-xs text-gray-400"><span>课标对齐: {curriculum.filter((a:any)=>a.aligned).length}/{curriculum.length} 项</span></div>
      </div>
      <div className="p-6"><textarea value={content} onChange={e=>setContent(e.target.value)} className="w-full min-h-[400px] text-sm p-0 border-0 focus:outline-none resize-y font-mono text-gray-800" style={{lineHeight:'1.8'}}/></div>
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl flex items-center justify-between">
        <div className="text-xs text-gray-400">生成耗时: {genTime}ms | 模型: {modelVersion||'qwen-plus'}</div>
        <div className="flex items-center gap-2">
          <button onClick={handleGenerate} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-white">重新生成</button>
          <button onClick={handleFinalize} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-[#1A3A6B] text-white rounded-lg hover:bg-[#2B5DA8] shadow-sm disabled:opacity-50"><Send size={15}/>{saving?'定稿中...':'定稿并保存'}</button>
        </div>
      </div>
    </div>}
  </div>)
}
