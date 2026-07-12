import { useState, useMemo, useEffect } from 'react'
import { Search, Upload, Image, FileText, Music, Video, Filter, Star, Download, Copy, Trash2, FolderOpen, Grid3X3, List, TrendingUp, BookOpen, Monitor, Sparkles, X, Loader2 } from 'lucide-react'
import type { JSX } from 'react'
import { useToast } from '../components/Toast'
import AppLayout from '../components/AppLayout'
import PresentationMode from '../components/PresentationMode'
import { api, aiAPI, materialAPI } from '../lib/api'
import { useTeaching } from '../lib/TeachingContext'
import { exportH5Courseware, downloadBlob as h5Download } from '../lib/exportH5'
import { exportLessonPlanToDocx, downloadBlob } from '../lib/exportDocx'
import { printLessonPlan } from '../lib/printPdf'
import { exportCoursewareToPptx } from '../lib/exportPptx'

const safeGetUser = () => { try { return JSON.parse(localStorage.getItem('zhiwei_user') || localStorage.getItem('user') || '{}') || {} } catch { return {} } }
const getSchoolId = () => { try { const t = localStorage.getItem('zhiwei_token') || ''; const p = JSON.parse(atob(t.split('.')[1])); return p.school_id || '' } catch { return '' } }

/* ── 类型 ── */
type MaterialType = 'all' | 'image' | 'doc' | 'audio' | 'video' | 'other' | 'courseware'

const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理']
const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']
type ViewMode = 'grid' | 'list'

interface Material {
  id: string
  name: string
  type: MaterialType
  group: string
  tags: string[]
  stars: number  // 1-5 热度
  usage: number  // 引用次数
  version: string
  size: string
  updatedAt: string
  thumbnail?: string
  shared: boolean
}

/* ── 模拟数据 ── */
const _MOCK_DATA: Material[] = [
  { id: '1', name: '《观潮》课文插图', type: 'image', group: '四上语文', tags: ['插图', '观潮', '自然景观'], stars: 5, usage: 23, version: 'v1.2', size: '2.3MB', updatedAt: '2026-07-02', shared: true },
  { id: '2', name: '《走月亮》朗读音频', type: 'audio', group: '四上语文', tags: ['朗读', '走月亮', '音频'], stars: 4, usage: 18, version: 'v1.0', size: '5.1MB', updatedAt: '2026-06-28', shared: true },
  { id: '3', name: '四则运算练习题', type: 'doc', group: '四下数学', tags: ['练习', '四则运算', '计算'], stars: 4, usage: 31, version: 'v2.1', size: '156KB', updatedAt: '2026-07-04', shared: false },
  { id: '4', name: '三角形分类动画', type: 'video', group: '四下数学', tags: ['动画', '三角形', '几何'], stars: 5, usage: 15, version: 'v1.0', size: '18.7MB', updatedAt: '2026-06-20', shared: true },
  { id: '5', name: '《爬山虎的脚》板书设计', type: 'image', group: '四上语文', tags: ['板书', '爬山虎', '观察'], stars: 3, usage: 9, version: 'v1.1', size: '1.8MB', updatedAt: '2026-06-15', shared: false },
  { id: '6', name: '小数乘法课件片段', type: 'doc', group: '四下数学', tags: ['课件', '小数', '乘法'], stars: 4, usage: 27, version: 'v1.3', size: '320KB', updatedAt: '2026-07-01', shared: true },
  { id: '7', name: '课堂活动：成语接龙', type: 'doc', group: '四上语文', tags: ['活动', '成语', '游戏'], stars: 4, usage: 12, version: 'v1.0', size: '89KB', updatedAt: '2026-06-25', shared: true },
  { id: '8', name: '面积单位换算图表', type: 'image', group: '四下数学', tags: ['图表', '面积', '换算'], stars: 3, usage: 7, version: 'v1.0', size: '980KB', updatedAt: '2026-06-10', shared: false },
]

const GROUP_LIST = ['全部', '四上语文', '四下数学', '未分组']
const TYPE_LIST: { key: MaterialType; label: string; icon: JSX.Element }[] = [
  { key: 'all', label: '全部', icon: <Filter size={13} /> },
  { key: 'image', label: '图片', icon: <Image size={13} /> },
  { key: 'doc', label: '文档', icon: <FileText size={13} /> },
  { key: 'audio', label: '音频', icon: <Music size={13} /> },
  { key: 'video', label: '视频', icon: <Video size={13} /> },
  { key: 'other', label: '其他', icon: <FileText size={13} /> },
  { key: 'courseware', label: '课件', icon: <Monitor size={13} /> },
]

const TYPE_COLORS: Record<string, string> = {
  image: '#1890FF', doc: '#52C41A', audio: '#FA8C16', video: '#F5222D', other: '#9A9A9A', courseware: '#722ED1',
}

export default function Materials() {
  const teaching = useTeaching()
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<MaterialType>('all')
  const [activeGroup, setActiveGroup] = useState('全部')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [showChannel, setShowChannel] = useState(false)
  const [materials, setMaterials] = useState<Material[]>([])

  // 刷新素材库列表
  const refreshMaterials = () => {
    api<{ items: any[] }>('/materials').then(res => {
      setMaterials(res.items.map((m: any) => ({
        id: m.id, name: m.name, type: m.type as MaterialType,
        group: m.tag || '未分组', tags: m.tag ? [m.tag] : [],
        stars: 3, usage: 0, version: 'v1.0', size: m.size,
        updatedAt: m.created_at?.slice(0, 10) || '', shared: false,
      })))
    }).catch(() => {})
  }

  // ── AI 生成课件（在素材库直接创作新课件并入库） ──
  const [showGen, setShowGen] = useState(false)
  const [genSubject, setGenSubject] = useState('')
  const [genGrade, setGenGrade] = useState('')
  const [genTitle, setGenTitle] = useState('')
  const [genBaseId, setGenBaseId] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [cwMarkdown, setCwMarkdown] = useState('')
  const [cwSimilar, setCwSimilar] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [savingCw, setSavingCw] = useState(false)

  useEffect(() => {
    if (showGen) {
      if (!genSubject) setGenSubject(teaching?.subject || '语文')
      if (!genGrade) setGenGrade(GRADES[(teaching?.grade || 4) - 1] || '四年级')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGen])

  const handleGenCourseware = async () => {
    if (!genTitle.trim()) { toast('请填写课题名称', 'warning'); return }
    setGenLoading(true)
    try {
      const base = genBaseId ? await materialAPI.get(genBaseId).catch(() => null) : null
      const res = await aiAPI.generateCourseware({
        subject: genSubject, grade: genGrade, lesson_title: genTitle.trim(),
        content: base?.content || '', school_id: getSchoolId(),
      })
      setCwMarkdown(res.courseware_markdown || '')
      setCwSimilar(res.similar_material || null)
      setShowPreview(true)
    } catch (e: any) { toast('AI 生成失败: ' + (e.message || '未知错误'), 'error') }
    finally { setGenLoading(false) }
  }

  const handleSaveCw = async () => {
    if (!cwMarkdown) return
    setSavingCw(true)
    try {
      await materialAPI.createJSON({
        name: `${genTitle.trim()}_课件`,
        type: 'courseware',
        tag: `${genSubject}${genGrade}`,
        content: cwMarkdown,
      })
      toast('课件已保存到素材库', 'success')
      setShowPreview(false); setShowGen(false)
      refreshMaterials()
    } catch (e: any) { toast('保存失败: ' + (e.message || ''), 'error') }
    finally { setSavingCw(false) }
  }

  // 在线播放 / 阅读 / 预览（复用 PresentationMode 幻灯片播放器）
  const [player, setPlayer] = useState<{ content: string; title: string } | null>(null)
  const openPlay = async (m: Material) => {
    let content = (m as any).content || ''
    if (!content) {
      try { const r: any = await materialAPI.get(m.id); content = r.content || '' } catch { content = '' }
    }
    if (!content) { toast('该课件暂无正文内容，无法播放', 'warning'); return }
    setPlayer({ content, title: m.name })
  }
  const playFromPreview = () => {
    if (!cwMarkdown) { toast('课件内容为空', 'warning'); return }
    setPlayer({ content: cwMarkdown, title: `${genTitle.trim()}_课件` })
  }

  const exportCwH5 = () => {
    const blob = exportH5Courseware(cwMarkdown, { subject: genSubject, grade: genGrade, title: `${genTitle.trim()}_课件`, teacherName: safeGetUser().name || '教师' })
    h5Download(blob, `${genTitle.trim()}_${genSubject}${genGrade}.html`)
  }
  const exportCwDocx = async () => {
    const blob = await exportLessonPlanToDocx(cwMarkdown, { subject: genSubject, grade: genGrade, title: `${genTitle.trim()}_课件`, teacher: safeGetUser().name || '教师', model: 'qwen-plus' })
    downloadBlob(blob, `${genTitle.trim()}_${genSubject}${genGrade}.docx`)
  }
  const exportCwPdf = () => {
    printLessonPlan(cwMarkdown, { subject: genSubject, grade: genGrade, title: `${genTitle.trim()}_课件`, teacherName: safeGetUser().name || '教师' })
  }
  const exportCwPptx = async () => {
    await exportCoursewareToPptx(cwMarkdown, { subject: genSubject, grade: genGrade, title: `${genTitle.trim()}_课件`, teacherName: safeGetUser().name || '教师' })
  }

  useEffect(() => { refreshMaterials() }, [])

  const filtered = useMemo(() => {
    return materials.filter(m => {
      if (activeType !== 'all' && m.type !== activeType) return false
      if (activeGroup !== '全部' && m.group !== activeGroup) return false
      if (search && !m.name.includes(search) && !m.tags.some(t => t.includes(search))) return false
      return true
    })
  }, [search, activeType, activeGroup, materials])

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(m => m.id)))
  }

  const renderHeat = (n: number) => {
    const labels = ['冷', '温', '热', '火', '爆']
    const colors = ['text-gray-400', 'text-blue-500', 'text-orange-500', 'text-red-500', 'text-red-600 font-bold']
    return <span className={`text-[9px] ml-1 ${colors[n-1] || colors[0]}`}>🔥{labels[n-1] || labels[0]}</span>
  }
  const renderStars = (n: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={10} className={i <= n ? 'text-[#FA8C16] fill-[#FA8C16]' : 'text-[#E7E7EB]'} />
      ))}
    </div>
  )

  const handleUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.multiple = true
    input.onchange = async () => {
      if (!input.files?.length) return
      setUploading(true)
      for (const f of Array.from(input.files)) {
        const fd = new FormData()
        fd.append('file', f); fd.append('name', f.name)
        try {
          await api('/materials', { method: 'POST', body: fd })
          toast(`${f.name} 上传成功`, 'success')
        } catch { toast(`${f.name} 上传失败`, 'error') }
      }
      refreshMaterials()
      setUploading(false)
    }
    input.click()
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#353535]">素材库</h1>
            <p className="text-[11px] text-[#9A9A9A] mt-0.5">管理图片、文档、音频、视频等教学素材</p>
          </div>
          <div className="flex items-center gap-2">
            {/* 教辅频道 */}
            <button
              onClick={() => setShowChannel(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[#02A7F0] border border-[#02A7F0] rounded-[4px] hover:bg-[#02A7F0]/5 transition-colors"
            >
              <BookOpen size={14} /> 教辅频道
            </button>
            {/* AI 生成课件 */}
            <button
              onClick={() => setShowGen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-white bg-[#722ED1] rounded-[4px] hover:bg-[#5B23A8] transition-colors"
            >
              <Sparkles size={14} /> AI 生成课件
            </button>
            {/* 上传 */}
            <button onClick={handleUpload} disabled={uploading}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors disabled:opacity-50">
              <Upload size={14} /> {uploading ? '上传中...' : '上传素材'}
            </button>
          </div>
        </div>

        {/* 搜索 + 筛选栏 */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-3 flex items-center gap-4 flex-wrap">
          {/* 搜索 */}
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索素材名称或标签..."
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]"
            />
          </div>

          {/* 类型筛选 */}
          <div className="flex items-center gap-1">
            {TYPE_LIST.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveType(t.key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[12px] rounded-[3px] transition-colors ${activeType === t.key ? 'bg-[#353535] text-white' : 'border border-[#E7E7EB] text-[#353535] hover:border-[#02A7F0]'}`}
              >
                {t.icon}<span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* 分组 */}
          <select
            value={activeGroup}
            onChange={e => setActiveGroup(e.target.value)}
            className="px-2.5 py-2 text-[12px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]"
          >
            {GROUP_LIST.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          {/* 视图切换 */}
          <div className="flex items-center border border-[#E7E7EB] rounded-[4px] overflow-hidden ml-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-[#353535] text-white' : 'text-[#9A9A9A] hover:text-[#353535]'}`}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-[#353535] text-white' : 'text-[#9A9A9A] hover:text-[#353535]'}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {/* 批量操作栏（选中时显示） */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-[#F6F7F8] border border-[#E7E7EB] rounded-[4px]">
            <span className="text-[12px] text-[#353535] font-medium">已选 {selected.size} 项</span>
            <button className="flex items-center gap-1 text-[11px] text-[#02A7F0] hover:text-[#0288D1]"><Download size={13} />下载</button>
            <button className="flex items-center gap-1 text-[11px] text-[#02A7F0] hover:text-[#0288D1]"><Copy size={13} />复制到</button>
            <button className="flex items-center gap-1 text-[11px] text-[#FF4D4F] hover:text-red-600"><Trash2 size={13} />删除</button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-[11px] text-[#9A9A9A] hover:text-[#353535]">取消</button>
          </div>
        )}

        {/* 结果统计 */}
        <div className="flex items-center justify-between text-[12px] text-[#9A9A9A]">
          <span>共 {filtered.length} 个素材</span>
          <button onClick={toggleSelectAll} className="hover:text-[#02A7F0]">
            {selected.size === filtered.length && filtered.length > 0 ? '取消全选' : '全选'}
          </button>
        </div>

        {/* 素材网格/列表 */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[#E7E7EB] rounded-[4px]">
            <FolderOpen size={32} className="mx-auto text-[#E7E7EB] mb-3" />
            <p className="text-[14px] text-[#9A9A9A]">暂无素材</p>
            <p className="text-[11px] text-[#A3A3A3] mt-1">点击"上传素材"开始添加</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* 网格视图 */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map(m => (
              <div
                key={m.id}
                onClick={() => toggleSelect(m.id)}
                className={`bg-white border rounded-[4px] overflow-hidden cursor-pointer transition-all hover:shadow-md group ${
                  selected.has(m.id) ? 'border-[#02A7F0] ring-1 ring-[#02A7F0]' : 'border-[#E7E7EB]'
                }`}
              >
                {/* 缩略图 */}
                <div className="aspect-[4/3] bg-[#F6F7F8] flex items-center justify-center relative">
                  {/* 类型图标 */}
                  <span className="text-3xl opacity-30" style={{ color: TYPE_COLORS[m.type] }}>
                    {m.type === 'image' ? <Image size={40} /> :
                     m.type === 'video' ? <Video size={40} /> :
                     m.type === 'audio' ? <Music size={40} /> :
                     m.type === 'courseware' ? <Monitor size={40} /> :
                     <FileText size={40} />}
                  </span>
                  {/* 类型标签 */}
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] rounded-[2px] text-white" style={{ background: TYPE_COLORS[m.type] }}>
                    {TYPE_LIST.find(t => t.key === m.type)?.label || '其他'}
                  </span>
                  {/* 共享标记 */}
                  {m.shared && (
                    <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded-[2px]">共享</span>
                  )}
                </div>
                {/* 信息 */}
                <div className="p-2.5">
                  <p className="text-[13px] text-[#353535] font-medium truncate mb-1.5">{m.name}</p>
                  <div className="flex items-center justify-between text-[11px] text-[#9A9A9A]">
                    <span>{m.size}</span>
                    <span>{m.group}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {renderStars(m.stars)}{renderHeat(m.stars)}
                    <div className="flex items-center gap-1 text-[10px] text-[#9A9A9A]">
                      <TrendingUp size={10} />{m.usage}
                    </div>
                  </div>
                  {/* 标签 */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {m.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-[#F0F0F0] text-[#353535] rounded-[3px]">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 列表视图 */
          <div className="bg-white border border-[#E7E7EB] rounded-[4px]">
            {filtered.map(m => (
              <div
                key={m.id}
                onClick={() => toggleSelect(m.id)}
                className={`flex items-center gap-4 px-4 py-3 border-b border-[#F0F0F0] last:border-0 cursor-pointer hover:bg-[#F9FAFB] transition-colors ${
                  selected.has(m.id) ? 'bg-blue-50/50' : ''
                }`}
              >
                <input type="checkbox" checked={selected.has(m.id)} readOnly className="shrink-0" />
                <span style={{ color: TYPE_COLORS[m.type] }}>
                  {m.type === 'image' ? <Image size={18} /> :
                   m.type === 'video' ? <Video size={18} /> :
                   m.type === 'audio' ? <Music size={18} /> :
                   m.type === 'courseware' ? <Monitor size={18} /> :
                   <FileText size={18} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#353535] font-medium truncate">{m.name}</span>
                    <span className="text-[10px] px-1 py-0.5 bg-[#F0F0F0] text-[#9A9A9A] rounded-[2px] shrink-0">v{typeof m.version === 'string' ? m.version.replace('v', '') : m.version}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#9A9A9A] mt-0.5">
                    <span>{m.size}</span>
                    <span>·</span>
                    <span>{m.group}</span>
                    <span>·</span>
                    <span>{m.updatedAt}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {renderStars(m.stars)}{renderHeat(m.stars)}
                  <span className="text-[11px] text-[#9A9A9A] flex items-center gap-0.5"><TrendingUp size={10} />{m.usage}</span>
                  {m.type === 'courseware' && (
                    <button onClick={(e) => { e.stopPropagation(); openPlay(m) }}
                      className="flex items-center gap-1 text-[11px] text-[#722ED1] hover:text-[#5B23A8]"><Monitor size={12} />播放</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI 生成课件 · 表单对话框 */}
      {showGen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowGen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-[6px] shadow-xl w-[460px] max-w-[92vw] z-10" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center gap-2">
              <Sparkles size={18} className="text-[#722ED1]" />
              <span className="text-[14px] font-semibold text-[#353535]">AI 生成课件</span>
              <button onClick={() => setShowGen(false)} className="ml-auto p-1 hover:bg-[#F6F7F8] rounded"><X size={16} className="text-[#9A9A9A]" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[11px] text-[#9A9A9A] leading-relaxed">
                AI 会根据课题从素材库找相近课件作为参照生成新版本，支持导出 PPT / HTML / Word / PDF，并可一键保存到素材库。
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[12px] text-[#353535]">学科</span>
                  <select value={genSubject} onChange={e => setGenSubject(e.target.value)}
                    className="mt-1 w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#722ED1]">
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[12px] text-[#353535]">年级</span>
                  <select value={genGrade} onChange={e => setGenGrade(e.target.value)}
                    className="mt-1 w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#722ED1]">
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-[12px] text-[#353535]">课题名称</span>
                <input value={genTitle} onChange={e => setGenTitle(e.target.value)} placeholder="如：光的折射定律"
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#722ED1]" />
              </label>
              <label className="block">
                <span className="text-[12px] text-[#353535]">参照课件（可选）</span>
                <select value={genBaseId} onChange={e => setGenBaseId(e.target.value)}
                  className="mt-1 w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#722ED1]">
                  <option value="">不参照（由 AI 自动匹配相近课件）</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            </div>
            <div className="px-5 py-3 border-t border-[#F0F0F0] flex justify-end gap-2">
              <button onClick={() => setShowGen(false)} className="px-4 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:bg-[#F6F7F8]">取消</button>
              <button onClick={handleGenCourseware} disabled={genLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] text-white bg-[#722ED1] rounded-[4px] hover:bg-[#5B23A8] disabled:opacity-50">
                {genLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {genLoading ? 'AI 生成中...' : '生成课件'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 课件预览 · 导出 / 保存 */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowPreview(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-[6px] shadow-xl w-[640px] max-w-[94vw] h-[82vh] flex flex-col z-10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E7E7EB] shrink-0">
              <div>
                <h3 className="text-[14px] font-semibold text-[#353535]">AI 课件预览</h3>
                {cwSimilar && (
                  <p className="text-[11px] text-[#9A9A9A] mt-0.5">参照相近课件《{cwSimilar.name}》生成的新版本</p>
                )}
              </div>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-[#F6F7F8] rounded"><X size={16} className="text-[#9A9A9A]" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 text-[13px] leading-relaxed whitespace-pre-wrap bg-[#FAFAFA]">
              {cwMarkdown}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#E7E7EB] bg-[#F6F7F8] shrink-0">
              <div className="flex gap-2">
                <button onClick={playFromPreview} className="px-3 py-1.5 text-[12px] text-white bg-[#1A3A6B] border border-[#1A3A6B] rounded-[4px] hover:bg-[#142C52]">播放 / 阅读</button>
                <button onClick={exportCwPptx} className="px-3 py-1.5 text-[12px] text-white bg-[#722ED1] border border-[#722ED1] rounded-[4px] hover:bg-[#5B23A8]">导出 PPT</button>
                <button onClick={exportCwH5} className="px-3 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:bg-white">导出 HTML</button>
                <button onClick={exportCwDocx} className="px-3 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:bg-white">导出 Word</button>
                <button onClick={exportCwPdf} className="px-3 py-1.5 text-[12px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:bg-white">导出 PDF</button>
              </div>
              <button onClick={handleSaveCw} disabled={savingCw}
                className="px-4 py-1.5 text-[12px] text-white bg-[#722ED1] rounded-[4px] hover:bg-[#5B23A8] disabled:opacity-50">
                {savingCw ? '保存中...' : '保存到素材库'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 教辅频道弹层 */}
      {showChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowChannel(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-[6px] shadow-xl w-[400px] max-w-[90vw] z-10" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center gap-2">
              <BookOpen size={18} className="text-[#02A7F0]" />
              <span className="text-[14px] font-semibold text-[#353535]">教辅频道</span>
            </div>
            <div className="p-5 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#02A7F0]/10 flex items-center justify-center text-2xl">📚</div>
              <p className="text-[13px] text-[#353535] font-medium mb-2">教辅频道 · 即将上线</p>
              <p className="text-[11px] text-[#9A9A9A] leading-relaxed">
                教辅频道将聚合优质教辅资源，支持按学科、年级、教材版本精准检索。
                <br />包含同步练习、单元测试、期中期末试卷等教辅资料。
              </p>
            </div>
            <div className="px-5 py-3 border-t border-[#F0F0F0] flex justify-end">
              <button onClick={() => setShowChannel(false)} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1]">知道了</button>
            </div>
          </div>
        </div>
      )}

      {/* 课件在线播放 / 阅读 / 预览 */}
      {player && (
        <PresentationMode
          content={player.content}
          title={player.title}
          subject="课件"
          grade=""
          teacherName={safeGetUser().name || '教师'}
          onClose={() => setPlayer(null)}
        />
      )}
    </AppLayout>
  )
}
