import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Sparkles, Save, BookOpen, Send, X, Target } from 'lucide-react'
import { aiAPI, lessonPlanAPI } from '../lib/api'
import ConfirmDialog from '../components/ConfirmDialog'
import AiPreviewBadge from '../components/AiPreviewBadge'
import { useTeaching } from '../lib/TeachingContext'
import { useKnowledgePicker } from '../hooks/useKnowledgePicker'
import { useKGContext } from '../lib/KnowledgeGraphContext'

export default function LessonPlanEditor() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const teaching = useTeaching()

  // 共享知识点选取器
  const picker = useKnowledgePicker({ autoSelect: true })
  const { setPicker: setKGPicker } = useKGContext()

  // 注册 picker 到 KnowledgePanel
  useEffect(() => {
    setKGPicker(picker as any)
    return () => setKGPicker(null)
  }, [picker])

  // 已保存教案的知识节点 ID（编辑模式回显）
  const [savedKnowledgeIds, setSavedKnowledgeIds] = useState<string[]>([])

  const [subject, setSubject] = useState(teaching.subject)
  const [grade, setGrade] = useState(['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级'][teaching.grade - 1] || '四年级')
  const [lessonTitle, setLessonTitle] = useState('')
  const [textbookUnit, setTextbookUnit] = useState('')
  const [period, setPeriod] = useState(1)
  const [template, setTemplate] = useState('core_literacy')
  const [generating, setGenerating] = useState(false)
  const [content, setContent] = useState('')
  const [planId, setPlanId] = useState<string|null>(id || null)
  const [saving, setSaving] = useState(false)
  const [curriculum, setCurriculum] = useState<any[]>([])
  const [modelVersion, setModelVersion] = useState('')
  // AI 预览态
  const [aiPreview, setAiPreview] = useState(false)
  const [aiConfirmed, setAiConfirmed] = useState(false)
  const [genTime, setGenTime] = useState(0)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)

  // 编辑模式加载已有教案
  useEffect(() => {
    if (!id) return
    setLoadingExisting(true)
    lessonPlanAPI.get(id).then(data => {
      setSubject(data.subject || '语文')
      setGrade(data.grade || '四年级')
      setLessonTitle(data.lesson_title || '')
      setTextbookUnit(data.textbook_unit || '')
      setPeriod(data.period || 1)
      setTemplate(data.format_template || 'core_literacy')
      setContent(data.content || '')
      setPlanId(data.id)
      if (data.curriculum_alignments) {
        try { setCurriculum(JSON.parse(data.curriculum_alignments)) } catch { setCurriculum([]) }
      }
      setModelVersion(data.ai_model_version || '')
      // 回显已保存的知识点
      if (data.knowledge_node_ids) {
        try {
          const ids = JSON.parse(data.knowledge_node_ids)
          if (Array.isArray(ids)) {
            setSavedKnowledgeIds(ids)
            picker.setSelectedIds(ids)
          }
        } catch { /* ignore */ }
      }
    }).catch(() => {
      // 加载失败仍可用空白表单
    }).finally(() => setLoadingExisting(false))
  }, [id])

  // 当前使用的知识点 ID（编辑已有内容时用保存的，新建时用选取器最新的）
  const currentKnowledgeIds = content ? savedKnowledgeIds : picker.selectedIds

  const handleGenerate = async () => {
    if (!lessonTitle.trim()) return
    // 必填校验：自动预选已满足缺省值，但用户主动清空时需拦截
    if (picker.selectedIds.length === 0) {
      alert('请先在知识图谱中选取本课知识点')
      return
    }
    setGenerating(true)
    try {
      const res = await aiAPI.generateLessonPlan({
        subject, grade, lesson_title:lessonTitle, textbook_unit:textbookUnit, period, format_template:template,
        selected_knowledge_ids: picker.selectedIds,
      })
      // 仅设置预览内容，不自动保存（等用户确认后手动保存）
      setContent(res.content); setCurriculum(res.curriculum_alignments||[]); setModelVersion(res.model||'qwen-plus'); setGenTime(res.generation_time_ms||0)
      setPlanId(null) // 确保走新建流程，不误覆盖已有教案
      setAiPreview(true)
      setAiConfirmed(false)
    } catch(e:any) { alert('AI 生成失败: '+(e.message||'未知错误')) }
    setGenerating(false)
  }

  const handleFinalize = async () => {
    if(!planId)return; setSaving(true)
    try {
      await lessonPlanAPI.update(planId, { content, knowledge_node_ids: JSON.stringify(currentKnowledgeIds) })
      await lessonPlanAPI.finalize(planId)
      navigate('/dashboard/lesson-plans')
    } catch(e:any){ alert('定稿失败') }
    setSaving(false)
  }

  const handleSaveDraft = async () => {
    if (!content) return
    setSaving(true)
    try {
      const kIds = picker.selectedIds.length > 0 ? picker.selectedIds : savedKnowledgeIds
      const knowledgeNodeIds = JSON.stringify(kIds)
      if (!planId) {
        // 首次保存：创建教案
        const saved = await lessonPlanAPI.create({
          subject, grade, lesson_title: lessonTitle, textbook_unit: textbookUnit, period,
          content, format_template: template,
          curriculum_alignments: JSON.stringify(curriculum),
          knowledge_node_ids: knowledgeNodeIds,
          ai_generated: true, ai_model_version: modelVersion || 'qwen-plus', generation_time_ms: genTime,
        })
        setPlanId(saved.id)
        setSavedKnowledgeIds(kIds)
      } else {
        await lessonPlanAPI.update(planId, { content, knowledge_node_ids: knowledgeNodeIds })
      }
    } catch (e: any) { alert('保存失败: ' + (e.message || '网络错误')) }
    setSaving(false)
  }

  if (loadingExisting) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#1A3A6B]/20 border-t-[#1A3A6B] rounded-full animate-spin" /></div>
  }

  return (<div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
      <div className="flex items-center gap-3">
        <button onClick={()=>navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18} className="text-gray-500"/></button>
        <div><h1 className="text-lg lg:text-xl font-bold text-gray-900">{isEditing ? '编辑教案' : '新建教案'}</h1><p className="text-xs lg:text-sm text-gray-500 mt-0.5">AI 辅助生成结构化教案，支持课标自动对齐</p></div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleSaveDraft} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"><Save size={16}/>保存草稿</button>
        <button onClick={() => setShowFinalizeConfirm(true)} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-[#1A3A6B] rounded-lg hover:bg-[#2B5DA8] disabled:opacity-50"><Save size={16}/>{saving?'保存中...':'保存'}</button>
      </div>
    </div>

    {/* 已有内容时显示编辑区（编辑模式跳过基本信息表单） */}
    {content ? (
      <AiPreviewBadge
        preview={aiPreview && !aiConfirmed}
        confirmed={aiConfirmed}
        onConfirm={() => setAiConfirmed(true)}
        onEdit={() => setAiConfirmed(true)}
        confirmLabel="确认教案"
        className="mb-0"
      >
        <div className={`bg-white rounded-xl border-0 ${!planId ? '' : ''}`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            <div className="flex items-center gap-3">
              <BookOpen size={18} className="text-[#1A3A6B]"/>
              <span className="font-medium text-gray-900">{lessonTitle}</span>
              {aiPreview && !aiConfirmed ? (
                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-medium flex items-center gap-1">
                  <Sparkles size={10} />AI 预览
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">{modelVersion ? 'AI 生成' : '手动录入'}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">{curriculum.length > 0 && <span>课标对齐: {curriculum.filter((a:any)=>a.aligned).length}/{curriculum.length} 项</span>}</div>
          </div>
          <div className="p-6">
            <textarea value={content} onChange={e=>setContent(e.target.value)}
              className="w-full min-h-[400px] text-sm p-0 border-0 focus:outline-none resize-y font-mono text-gray-800"
              style={{lineHeight:'1.8'}}
            />
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl flex items-center justify-between">
            <div className="text-xs text-gray-400">{genTime > 0 ? `生成耗时: ${genTime}ms | 模型: ${modelVersion||'qwen-plus'}` : ''}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/dashboard/exercises/new', { state: { preSelectedNodes: picker.selectedIds.length > 0 ? picker.selectedIds : savedKnowledgeIds } })} className="px-4 py-2 text-sm text-brand border border-brand/30 rounded-lg hover:bg-brand/5"><Send size={14} className="inline mr-1" />基于此教案出题</button>
              <button onClick={handleGenerate} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-white">重新生成</button>
              {!planId ? (
                <button onClick={handleSaveDraft} disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm bg-[#1A3A6B] text-white rounded-lg hover:bg-[#2B5DA8] shadow-sm disabled:opacity-50"><Save size={15}/>{saving ? '保存中...' : '保存草稿'}</button>
              ) : (
                <button onClick={() => setShowFinalizeConfirm(true)} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-[#1A3A6B] text-white rounded-lg hover:bg-[#2B5DA8] shadow-sm disabled:opacity-50"><Send size={15}/>{saving ? '定稿中...' : '定稿并保存'}</button>
              )}
            </div>
          </div>
        </div>
      </AiPreviewBadge>
    ) : (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">教案基本信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
          <div><label htmlFor="plan-subject" className="block text-sm font-medium text-gray-700 mb-1.5">学科</label><select id="plan-subject" value={subject} onChange={e=>{ const v = e.target.value as '语文'|'数学'|'英语'; setSubject(v); if (!isEditing) teaching.setSubject(v) }} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20"><option>语文</option><option>数学</option><option>英语</option></select></div>
          <div><label htmlFor="plan-grade" className="block text-sm font-medium text-gray-700 mb-1.5">年级</label><select id="plan-grade" value={grade} onChange={e=>{ const v = e.target.value; setGrade(v); if (!isEditing) { const idx = ['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级'].indexOf(v); if (idx >= 0) teaching.setGrade(idx + 1) } }} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20">{['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级'].map(g=><option key={g}>{g}</option>)}</select></div>
          <div><label htmlFor="plan-period" className="block text-sm font-medium text-gray-700 mb-1.5">课时</label><select id="plan-period" value={period} onChange={e=>setPeriod(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20">{[1,2,3,4,5].map(n=><option key={n} value={n}>第{n}课时</option>)}</select></div>
          <div className="md:col-span-2"><label htmlFor="plan-title" className="block text-sm font-medium text-gray-700 mb-1.5">课题名称 <span className="text-red-500">*</span></label><input id="plan-title" type="text" value={lessonTitle} onChange={e=>setLessonTitle(e.target.value)} placeholder="例如：《观潮》第一课时" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20"/></div>
          <div><label htmlFor="plan-unit" className="block text-sm font-medium text-gray-700 mb-1.5">教材单元</label><input id="plan-unit" type="text" value={textbookUnit} onChange={e=>setTextbookUnit(e.target.value)} placeholder="部编版四上第一单元" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20"/></div>
          <div><label htmlFor="plan-template" className="block text-sm font-medium text-gray-700 mb-1.5">教案模板</label><select id="plan-template" value={template} onChange={e=>setTemplate(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3A6B]/20"><option value="core_literacy">核心素养模板</option><option value="3d_objective">三维目标模板</option><option value="unit_teaching">单元教学模板</option></select></div>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-100">
          {/* 关联知识点 — 知识图谱选取 */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Target size={14} className="text-brand"/>关联知识点 <span className="text-red-500 text-xs font-normal">*必选</span>
              </h3>
              <div className="flex items-center gap-2">
                {picker.selectedIds.length > 0 && (
                  <span className="text-[11px] text-gray-400">已选 {picker.selectedIds.length} 个</span>
                )}
                <button
                  onClick={() => teaching.setKnowledgeGraphEnabled(!teaching.knowledgeGraphEnabled)}
                  disabled={!teaching.knowledgeGraphEnabled && false} // always clickable
                  className="flex items-center gap-1 px-3 py-1.5 text-[12px] rounded-lg border border-brand/10 text-brand bg-brand/5 hover:bg-brand/10 transition-colors"
                >
                  <BookOpen size={13}/>
                  {teaching.knowledgeGraphEnabled ? '关闭图谱面板' : '展开知识图谱'}
                </button>
              </div>
            </div>

            {/* 已选考点预览 */}
            {picker.selectedNodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {picker.selectedNodes.map(n => (
                  <span key={n.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-brand/5 text-brand rounded-full border border-brand/10">
                    {n.name}
                    <button onClick={() => picker.setSelectedIds(prev => prev.filter(id => id !== n.id))} className="text-brand/40 hover:text-red-500"><X size={10}/></button>
                  </span>
                ))}
              </div>
            )}

            {picker.selectedIds.length === 0 && (
              <p className="text-[12px] text-gray-400 mb-3">点击"展开知识图谱"在右侧面板选取本课涉及的知识点</p>
            )}
          </div>

          <button onClick={handleGenerate} disabled={!lessonTitle.trim()||generating||picker.selectedIds.length===0} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1A3A6B] to-[#2B5DA8] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 shadow-sm">
            {generating?<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>AI 正在生成教案...</>:<><Sparkles size={18}/>{picker.selectedIds.length===0?'请先选取知识点':'AI 生成教案'}</>}
          </button>
          <span className="ml-3 text-xs text-gray-400">预计 15-30 秒，自动对齐课标</span>
        </div>
      </div>
    )}

    {generating&&<div className="bg-white rounded-xl border border-gray-200 p-8 text-center"><div className="w-12 h-12 mx-auto mb-4 border-4 border-[#1A3A6B]/20 border-t-[#1A3A6B] rounded-full animate-spin"/><p className="text-sm text-gray-500">小微正在生成教案...</p><p className="text-xs text-gray-400 mt-1">正在检索课标要求、匹配知识点</p></div>}

    {/* 定稿确认弹窗 */}
    <ConfirmDialog
      open={showFinalizeConfirm}
      title="确认定稿"
      message="定稿后教案将不可编辑，确认定稿吗？"
      confirmLabel="确认定稿"
      danger
      loading={saving}
      onConfirm={() => { setShowFinalizeConfirm(false); handleFinalize() }}
      onCancel={() => setShowFinalizeConfirm(false)}
    />
  </div>)
}
