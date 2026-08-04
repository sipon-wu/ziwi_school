import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, MonitorPlay, Smartphone, Video, Eye, Pencil } from 'lucide-react'
import { usePagination } from '../lib/useApi'
import { EmptyState } from '../components/StateComponents'
import { materialAPI, openWorkspace } from '../lib/api'
import AppLayout from '../components/AppLayout'

type CoursewareItem = {
  id: string
  name: string
  type: string
  tag?: string
  subject?: string
  grade?: string
  status?: string
  size?: number
  created_at?: string
  updated_at?: string
}

type Channel = 'ppt' | 'h5' | 'video'

const CHANNEL: Record<Channel, {
  title: string
  type: string
  newTo: string
  newLabel: string
  hint: string
  icon: React.ReactNode
  open: (id: string) => string
  openEdit: (id: string) => string
  openLabel: string
  openInline: boolean
}> = {
  ppt: {
    title: 'PPT 课件',
    type: 'courseware',
    newTo: '/courseware/ppt/new',
    newLabel: '新建 PPT 课件',
    hint: '在编辑器中创作，可导出 PPTX / PDF',
    icon: <MonitorPlay size={14} className="text-[#9A9A9A] shrink-0" />,
    open: (id) => `/courseware/ppt/${id}`,
    openEdit: (id) => `/courseware/ppt/${id}/edit`,
    openLabel: '打开',
    openInline: false,
  },
  h5: {
    title: 'H5 互动课件',
    type: 'courseware',
    newTo: '/courseware/h5',
    newLabel: '新建 H5 互动课件',
    hint: '逐页轻量课件，可导出 H5 网页',
    icon: <Smartphone size={14} className="text-[#9A9A9A] shrink-0" />,
    open: (id) => `/courseware/h5/${id}`,
    openEdit: (id) => `/courseware/h5/${id}/edit`,
    openLabel: '打开',
    openInline: false,
  },
  video: {
    title: '视频课件',
    type: 'video',
    newTo: '/materials',
    newLabel: '上传视频素材',
    hint: '上传视频后标记知识点，供 AI 检索引用到教案',
    icon: <Video size={14} className="text-[#9A9A9A] shrink-0" />,
    open: (id) => `/materials?focus=${id}`,
    openEdit: (id) => `/materials?focus=${id}`,
    openLabel: '预览 / 标记',
    openInline: true,
  },
}

const subjectColors: Record<string, string> = {
  '语文': 'bg-blue-50 text-blue-600',
  '数学': 'bg-orange-50 text-orange-600',
  '英语': 'bg-green-50 text-green-600',
}

export default function CoursewareList({ format = 'ppt' }: { format?: Channel }) {
  const navigate = useNavigate()
  const ch = CHANNEL[format] || CHANNEL.ppt
  const [items, setItems] = useState<CoursewareItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState('')

  useEffect(() => {
    materialAPI.list().then((res) => {
      const all = (res?.items || []) as CoursewareItem[]
      setItems(all.filter((m) => m.type === ch.type))
    }).catch(() => setItems([]))
  }, [ch.type])

  const SUBJECTS = useMemo(() => {
    const s = new Set<string>()
    items.forEach((i) => { const v = i.subject || i.tag; if (v) s.add(v) })
    return Array.from(s)
  }, [items])

  const draftCount = useMemo(() => items.filter((i) => i.status === 'draft').length, [items])

  const filtered = useMemo(() => items.filter((i) => {
    if (searchTerm && !(i.name || '').includes(searchTerm)) return false
    if (filterSubject && (i.subject || i.tag) !== filterSubject) return false
    return true
  }), [items, searchTerm, filterSubject])

  const { page, totalPages, paginated, goTo } = usePagination(filtered, 8)

  const handleOpen = (i: CoursewareItem) => {
    // 列表点击 → 全屏预览（只读放映态 /:id）；预览页"编辑"按钮再进 /:id/edit 编辑态
    const target = ch.openInline ? ch.open(i.id) : ch.open(i.id)
    if (ch.openInline) navigate(target)
    else openWorkspace(target)
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {format === 'h5' && (
          <div className="bg-white border border-dashed border-[#D0D0D0] rounded-[4px] p-10 flex flex-col items-center justify-center text-center">
            <Smartphone size={32} className="text-[#B0B8C4] mb-3" />
            <h2 className="text-[15px] font-medium text-[#353535] mb-1">H5 互动课件编辑器 · 即将上线</h2>
            <p className="text-[12px] text-[#9A9A9A] max-w-[420px]">H5 互动课件模板体系已就绪（风格标签、配色色系、“通用 × 色系”自由组合均与 PPT 同源），
              编辑器交互将于后续版本开放。当前可先用 PPT 课件创作，H5 输出通道预留中。</p>
          </div>
        )}
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#353535]">{ch.title}</h1>
            <p className="text-[11px] text-[#9A9A9A] mt-0.5">{ch.hint}</p>
          </div>
          <button
            onClick={() => { if (ch.openInline) navigate(ch.newTo); else openWorkspace(ch.newTo) }}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors"
          >
            <Plus size={16} /> {ch.newLabel}
          </button>
        </div>

        {/* 搜索 + 筛选 */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 relative min-w-[140px] max-w-[280px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              type="text" placeholder={`搜索${ch.title}名称...`} value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); goTo(1) }}
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]"
            />
          </div>
          <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); goTo(1) }}
            className="px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0] text-[#353535]">
            <option value="">全部学科</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* 统计条 */}
        <div className="flex items-center gap-3 text-[12px] text-[#9A9A9A]">
          <span>共 {filtered.length} 个{format === 'video' ? '视频' : '课件'}</span>
          {draftCount > 0 && <span className="text-[#FA8C16]">草稿 {draftCount}</span>}
        </div>

        {/* 列表 */}
        {filtered.length === 0 ? (
          <EmptyState
            title={`暂无${ch.title}`}
            description={`点击右上角「${ch.newLabel}」开始`}
            action={{ label: ch.newLabel, onClick: () => { if (ch.openInline) navigate(ch.newTo); else openWorkspace(ch.newTo) } }}
          />
        ) : (
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F6F7F8] border-b border-[#E7E7EB]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">名称</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">学科</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden md:table-cell">年级</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">状态</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase hidden lg:table-cell">更新时间</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#9A9A9A] uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {paginated.map((i) => (
                    <tr key={i.id} onClick={() => handleOpen(i)} className="hover:bg-[#F9FAFB] transition-colors cursor-pointer group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {ch.icon}
                          <span className="text-[13px] font-medium text-[#353535]">{i.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-[3px] text-[11px] font-medium ${subjectColors[i.subject || i.tag || ''] || 'bg-gray-50 text-gray-500'}`}>
                          {i.subject || i.tag || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#353535] hidden md:table-cell">
                        {i.grade || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {i.status === 'draft'
                          ? <span className="inline-block px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-orange-50 text-[#FA8C16]">草稿</span>
                          : <span className="inline-block px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-green-50 text-green-600">已发布</span>}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#9A9A9A] hidden lg:table-cell">
                        {i.updated_at ? new Date(i.updated_at).toLocaleString('zh-CN') : (i.created_at ? new Date(i.created_at).toLocaleString('zh-CN') : '-')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); handleOpen(i) }} className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title={ch.openLabel}>
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#F0F0F0] bg-[#F6F7F8]">
                <span className="text-[11px] text-[#9A9A9A]">第 {page}/{totalPages} 页，共 {filtered.length} 条</span>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => goTo(p)} className={`px-3 py-1 text-[12px] rounded-[3px] ${p === page ? 'bg-[#02A7F0] text-white' : 'border border-[#E7E7EB] hover:bg-white text-[#353535]'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
