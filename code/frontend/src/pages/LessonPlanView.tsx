import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Download, Printer } from 'lucide-react'
import { lessonPlanAPI, materialAPI, notifyError } from '../lib/api'
import { useToast } from '../components/Toast'
import AppLayout from '../components/AppLayout'
import { exportLessonPlanToDocx, downloadBlob } from '../lib/exportDocx'
import PresentationMode from '../components/PresentationMode'
import LessonPlanContent from '../components/LessonPlanContent'

export default function LessonPlanView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [materialRefs, setMaterialRefs] = useState<string[]>([])
  const [materialMap, setMaterialMap] = useState<Record<string, any>>({})
  const [playCourseware, setPlayCourseware] = useState<{ content: string; title: string } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const [showEditChooser, setShowEditChooser] = useState(false)

  useEffect(() => {
    if (!id) return
    lessonPlanAPI.get(id).then(data => {
      setPlan(data)
      setLoading(false)
    }).catch(() => {
      toast('教案不存在或无权访问', 'error')
      setLoading(false)
    })
  }, [id])

  // 解析已挂载课件并拉取素材库名称
  useEffect(() => {
    if (!plan) return
    let refs: string[] = []
    if (plan.material_refs) {
      try {
        refs = typeof plan.material_refs === 'string' ? JSON.parse(plan.material_refs) : plan.material_refs
        if (!Array.isArray(refs)) refs = []
      } catch { refs = [] }
    }
    setMaterialRefs(refs)
    if (refs.length) {
      materialAPI.list().then(res => {
        const map: Record<string, any> = {}
        ;(res.items || []).forEach((m: any) => { map[m.id] = m })
        setMaterialMap(map)
      }).catch((e) => notifyError('关联素材加载失败', e))
    }
  }, [plan])

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#02A7F0]/20 border-t-[#02A7F0] rounded-full animate-spin" /></div>
      </AppLayout>
    )
  }

  if (!plan) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-[13px] text-[#9A9A9A]">教案不存在或已被删除</div>
      </AppLayout>
    )
  }

  const title = plan.lesson_title || plan.title || '未命名教案'
  const content = plan.content || ''
  const statusLabel = plan.status === 'finalized' ? '已定稿' : plan.status === 'draft' ? '草稿' : '已发布'
  const statusColor = plan.status === 'finalized' ? 'text-green-600 bg-green-50' : plan.status === 'draft' ? 'text-yellow-600 bg-yellow-50' : 'text-blue-600 bg-blue-50'
  const safeName = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').name || '教师' } catch { return '教师' } })()

  const handleExportDocx = async () => {
    if (!content) { toast('教案内容为空，无法导出', 'warning'); return }
    setExporting(true)
    try {
      const blob = await exportLessonPlanToDocx(content, {
        subject: plan.subject, grade: plan.grade, title,
        textbookUnit: plan.unit || undefined,
        period: plan.period || 1, teacher: safeName,
        model: plan.ai_model_version || 'qwen-plus',
      })
      downloadBlob(blob, `${safeName}_${title}_${plan.subject || ''}${plan.grade || ''}.docx`)
      toast('导出成功', 'success')
    } catch { toast('导出失败', 'error') }
    setExporting(false)
  }

  const handlePrint = () => {
    if (!content) { toast('教案内容为空', 'warning'); return }
    const html = printRef.current?.innerHTML || ''
    const w = window.open('', '_blank')
    if (!w) { toast('请允许弹出窗口以使用打印', 'warning'); return }
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;max-width:820px;margin:24px auto;padding:0 24px;color:#353535;line-height:1.85;font-size:15px;}h1,h2,h3{color:#1f1f1f;}ul,ol{padding-left:1.4em;}pre{background:#f6f7f8;padding:10px;border-radius:4px;overflow:auto;}blockquote{border-left:3px solid #02A7F0;margin:0;padding-left:12px;color:#666;}table{border-collapse:collapse;}td,th{border:1px solid #e7e7eb;padding:6px 10px;}</style></head><body><h1>' + title + '</h1><p style="color:#9a9a9a;font-size:13px;">' + (plan.subject || '') + ' · ' + (plan.grade || '') + ' · ' + (plan.unit || '') + '</p>' + html + '</body></html>')
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 350)
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/lesson-plans')} className="p-1.5 hover:bg-[#F6F7F8] rounded-[4px]">
              <ArrowLeft size={16} className="text-[#9A9A9A]" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#353535]">{title}</h1>
              <p className="text-[11px] text-[#9A9A9A] mt-0.5">{plan.subject || ''} · {plan.grade || ''} · {plan.unit || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-2 py-0.5 rounded-[3px] text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
            <button onClick={() => setShowEditChooser(true)} className="px-3 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1]">编辑</button>
            <button onClick={handleExportDocx} disabled={exporting} className="flex items-center gap-1 px-3 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] hover:bg-[#F6F7F8] disabled:opacity-50">
              <Download size={13} />{exporting ? '导出中...' : '导出'}
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1 px-3 py-1.5 text-[12px] border border-[#E7E7EB] rounded-[4px] hover:bg-[#F6F7F8]">
              <Printer size={13} />打印
            </button>
          </div>
        </div>

        {/* 教案正文 */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
          <div className="px-6 py-4 bg-[#F6F7F8] border-b border-[#E7E7EB] flex items-center gap-2">
            <BookOpen size={15} className="text-[#02A7F0]" />
            <span className="text-[13px] font-semibold text-[#353535]">{title}</span>
          </div>
          <div className="px-6 py-5" ref={printRef}>
            <LessonPlanContent content={content} />
          </div>
          <div className="px-6 py-3 border-t border-[#F0F0F0] text-[10px] text-[#9A9A9A] flex justify-between">
            <span>AI 生成 · {plan.ai_model_version || 'qwen-plus'}</span>
            <span>{plan.created_at ? new Date(plan.created_at).toLocaleString('zh-CN') : ''}</span>
          </div>
        </div>

        {/* 信息卡片 */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-4 grid grid-cols-4 gap-4 text-[12px]">
          <div><span className="text-[#9A9A9A]">学科</span><p className="text-[#353535] font-medium">{plan.subject || '-'}</p></div>
          <div><span className="text-[#9A9A9A]">年级</span><p className="text-[#353535] font-medium">{plan.grade || '-'}</p></div>
          <div><span className="text-[#9A9A9A]">单元</span><p className="text-[#353535] font-medium">{plan.unit || '-'}</p></div>
          <div><span className="text-[#9A9A9A]">课时</span><p className="text-[#353535] font-medium">{plan.period || 1} 课时</p></div>
        </div>

        {/* 关联课件 */}
        {materialRefs.length > 0 && (
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-4">
            <h3 className="text-[13px] font-semibold text-[#353535] mb-3 flex items-center gap-2">
              <BookOpen size={14} className="text-[#02A7F0]" />关联课件（{materialRefs.length}）
            </h3>
            <div className="flex flex-wrap gap-2">
              {materialRefs.map(mid => {
                const m = materialMap[mid]
                if (!m) return <span key={mid} className="px-2.5 py-1 text-[11px] bg-[#F0F0F0] text-[#353535] rounded-full">课件</span>
                const isCourseware = m.type === 'courseware' && m.content
                return (
                  <div key={mid} className="inline-flex items-center gap-2 px-2.5 py-1 text-[11px] bg-[#E6F7FF] text-[#0958D9] rounded-full">
                    <span>{m.name || '课件'}</span>
                    {isCourseware && (
                      <button onClick={() => setPlayCourseware({ content: m.content, title: m.name || '课件' })}
                        className="text-[#0958D9] hover:text-[#0288D1] underline">播放</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 播放关联课件 */}
      {playCourseware && (
        <PresentationMode
          content={playCourseware.content} title={playCourseware.title}
          subject={plan.subject} grade={plan.grade}
          teacherName={safeName}
          onClose={() => setPlayCourseware(null)}
        />
      )}

      {/* 编辑模式选择浮层 */}
      {showEditChooser && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowEditChooser(false)}>
          <div className="bg-white rounded-[6px] w-[420px] max-w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#353535] mb-1">选择编辑模式</h3>
            <p className="text-[12px] text-[#9A9A9A] mb-4">当前教案将以哪种方式继续编辑？</p>
            <div className="space-y-2">
              <button onClick={() => navigate(`/lesson-plans/${id}/edit`)}
                className="w-full px-4 py-3 text-left text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0]">
                <div className="font-medium">AI 模式</div>
                <div className="text-[11px] text-[#9A9A9A] mt-0.5">元数据 + 知识图谱 + AI 生成 / 润色</div>
              </button>
              <button onClick={() => window.open(`/lesson-plans/${id}/edit?mode=doc`, '_blank')}
                className="w-full px-4 py-3 text-left text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0]">
                <div className="font-medium">文档模式</div>
                <div className="text-[11px] text-[#9A9A9A] mt-0.5">腾讯文档式自由排版（打字 / 换行 / 格式）</div>
              </button>
            </div>
            <button onClick={() => setShowEditChooser(false)} className="mt-4 w-full px-4 py-2 text-[12px] text-[#9A9A9A] hover:text-[#353535]">取消</button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
