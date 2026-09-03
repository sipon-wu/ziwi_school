import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Search, MonitorPlay, Smartphone, Video, Eye, Pencil, X, Upload, Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { usePagination } from '../lib/useApi'
import { EmptyState } from '../components/StateComponents'
import { materialAPI, openWorkspace } from '../lib/api'
import { markdownToOutline } from '../lib/exportPptx'
import AppLayout from '../components/AppLayout'

type CoursewareItem = {
  id: string
  name: string
  type: string
  format?: string
  category?: string
  /** 归属教师 id（作者标记，列表按 school 共享、user_id 用于"我的"过滤） */
  user_id?: string
  /** 归属教师显示名（后端 ListMaterials 动态附加，展示"谁的课件"） */
  owner_name?: string
  tag?: string
  subject?: string
  grade?: string
  status?: string
  url?: string
  content?: string
  size?: number
  created_at?: string
  updated_at?: string
}

type Channel = 'ppt' | 'h5' | 'video'

const CHANNEL: Record<Channel, {
  title: string
  type: string
  format?: string
  newLabel: string
  hint: string
  icon: React.ReactNode
  open: (id: string) => string
  openEdit: (id: string) => string
  openLabel: string
  isVideo: boolean
}> = {
  ppt: {
    title: 'PPT 课件',
    type: 'courseware',
    format: 'ppt',
    newLabel: '新建 PPT 课件',
    hint: '在编辑器中创作，可导出 PPTX / PDF',
    icon: <MonitorPlay size={14} className="text-[#9A9A9A] shrink-0" />,
    open: (id) => `/courseware/ppt/${id}`,
    openEdit: (id) => `/courseware/ppt/${id}/edit`,
    openLabel: '打开',
    isVideo: false,
  },
  h5: {
    title: 'H5 互动课件',
    type: 'courseware',
    format: 'h5',
    newLabel: '新建 H5 互动课件',
    hint: 'AI 模式按知识点/模板自动生成 H5 课件；文档编辑模式建设中',
    icon: <Smartphone size={14} className="text-[#9A9A9A] shrink-0" />,
    open: (id) => `/courseware/h5/${id}`,
    openEdit: (id) => `/courseware/h5/${id}/edit`,
    openLabel: '打开',
    isVideo: false,
  },
  video: {
    title: '视频课件',
    type: 'courseware',
    format: 'video',
    newLabel: '新建视频课件',
    hint: 'AI 生成视频分镜脚本，在线编辑；也可上传本地教学视频直接播放',
    icon: <Video size={14} className="text-[#9A9A9A] shrink-0" />,
    open: (id) => `/courseware/video/${id}`,
    openEdit: (id) => `/courseware/video/${id}/edit`,
    openLabel: '播放',
    isVideo: true,
  },
}

const subjectColors: Record<string, string> = {
  '语文': 'bg-blue-50 text-blue-600',
  '数学': 'bg-orange-50 text-orange-600',
  '英语': 'bg-green-50 text-green-600',
}

export default function CoursewareList({ format = 'ppt' }: { format?: Channel }) {
  const ch = CHANNEL[format] || CHANNEL.ppt
  const [items, setItems] = useState<CoursewareItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [scopeMine, setScopeMine] = useState(false) // 「我的」过滤：只看 user_id === 当前登录账号 的课件
  const [uploading, setUploading] = useState(false)
  const [playing, setPlaying] = useState<CoursewareItem | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 当前登录账号（localStorage user 对象；与后端 /api/materials 返回的 user_id 对齐）
  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('zhiwei_user') || localStorage.getItem('user') || '{}') || {} } catch { return {} }
  }, [])
  const myId: string | undefined = me?.id

  useEffect(() => {
    materialAPI.list().then((res) => {
      const all = (res?.items || []) as CoursewareItem[]
      // 按 type + format 双维度过滤，区分 ppt/h5（同为 courseware）与 video
      // 视频频道同时接受：旧上传视频(type=video) 与 新建分镜课件(type=courseware, format=video)
      // type 缺失兜底（2026-09-03 事故）：批量导入/种子脚本写入的课件可能漏掉 type 字段，
      // 曾导致 sch-0001 的 35 份 PPT 因 type 为空而被下方过滤静默排除，
      // 表现为「PPT 频道永远 0 个课件」且无任何报错。
      // 故 type 为空时回退用 category 判定，避免字段缺失即不可见。
      const isCourseware = (m: CoursewareItem) =>
        m.type === 'courseware' || (!m.type && m.category === 'courseware')
      const filtered = all.filter((m) => {
        if (ch.isVideo) {
          return m.type === 'video' || (isCourseware(m) && m.format === 'video')
        }
        return isCourseware(m) && (m.format || 'ppt') === (ch.format || 'ppt')
      })
      setItems(filtered)
    }).catch(() => setItems([]))
  }, [ch.type, ch.format, ch.isVideo])

  const SUBJECTS = useMemo(() => {
    const s = new Set<string>()
    items.forEach((i) => { const v = i.subject || i.tag; if (v) s.add(v) })
    return Array.from(s)
  }, [items])

  const draftCount = useMemo(() => items.filter((i) => i.status === 'draft').length, [items])

  const filtered = useMemo(() => items.filter((i) => {
    if (scopeMine && myId && i.user_id !== myId) return false
    if (searchTerm && !(i.name || '').includes(searchTerm)) return false
    if (filterSubject && (i.subject || i.tag) !== filterSubject) return false
    return true
  }), [items, searchTerm, filterSubject, scopeMine, myId])

  const { page, totalPages, paginated, goTo } = usePagination(filtered, 8)

  const handleOpen = (i: CoursewareItem) => {
    // 草稿态：进入编辑器修改（同一素材 ID，原地编辑，发布后才转正式）
    if (i.status === 'draft') {
      openWorkspace(ch.open(i.id)) // 草稿：新标签进入编辑器（与新建/放映一致）
      return
    }
    if (ch.isVideo) {
      setPlaying(i) // 视频：内嵌放映（已发布）
      return
    }
    openWorkspace(ch.open(i.id)) // ppt/h5：新标签打开放映态
  }

  const handleNew = () => {
    openWorkspace(ch.open('new')) // 所有频道统一进入编辑器（视频频道含 AI 生成分镜）
  }

  const handleUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const okExt = /\.(mp4|avi|mov|mkv|webm)$/i.test(file.name)
    if (!okExt) { alert('仅支持 mp4/avi/mov/mkv/webm 视频文件'); return }
    setUploading(true)
    try {
      await materialAPI.upload(file, { name: file.name, type: 'video', format: 'video' })
      const res = await materialAPI.list()
      const all = (res?.items || []) as CoursewareItem[]
      setItems(all.filter((m) => m.type === 'video'))
    } catch {
      alert('视频上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <AppLayout>
      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />
      <div className="space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#353535]">{ch.title}</h1>
            <p className="text-[11px] text-[#9A9A9A] mt-0.5">{ch.hint}</p>
          </div>
          <div className="flex items-center gap-2">
            {ch.isVideo && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-[#02A7F0] border border-[#02A7F0] rounded-[4px] hover:bg-blue-50 transition-colors disabled:opacity-60"
              >
                <Upload size={16} /> {uploading ? '上传中...' : '上传视频'}
              </button>
            )}
            <button
              onClick={handleNew}
              disabled={uploading}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] transition-colors disabled:opacity-60"
            >
              <Plus size={16} /> {uploading ? '上传中...' : ch.newLabel}
            </button>
          </div>
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
          {/* 归属范围：全校共享库 vs 只看我的（user_id === 当前账号） */}
          <div className="flex items-center rounded-[4px] border border-[#E7E7EB] overflow-hidden">
            {[{ k: false, l: '全部' }, { k: true, l: '我的' }].map(o => (
              <button key={o.l}
                onClick={() => { setScopeMine(o.k); goTo(1) }}
                className={`px-3 py-2 text-[12px] transition-colors ${scopeMine === o.k ? 'bg-[#02A7F0] text-white' : 'bg-white text-[#353535] hover:bg-[#F6F7F8]'}`}>
                {o.l}
              </button>
            ))}
          </div>
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
            description={ch.isVideo ? `点击右上角「${ch.newLabel}」AI 生成分镜，或「上传视频」本地导入` : `点击右上角「${ch.newLabel}」开始`}
            action={{ label: ch.newLabel, onClick: handleNew }}
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
                        {/* 归属展示：他人作品显示作者名；自己的不显示（减少噪音） */}
                        {i.owner_name && i.user_id !== myId && (
                          <div className="mt-0.5 text-[11px] text-[#9A9A9A]">作者：{i.owner_name}</div>
                        )}
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
                          {i.status === 'draft' ? (
                            <button onClick={(e) => { e.stopPropagation(); openWorkspace(ch.open(i.id)) }} className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title="编辑草稿">
                              <Pencil size={14} />
                            </button>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleOpen(i) }} className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title={ch.openLabel}>
                              {ch.isVideo ? <Video size={14} /> : <Eye size={14} />}
                            </button>
                          )}
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

        {/* 视频播放 modal */}
        {playing && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setPlaying(null)}>
            <div className="bg-white rounded-[6px] overflow-hidden max-w-[860px] w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E7E7EB]">
                <span className="text-[14px] font-medium text-[#353535]">{playing.name}</span>
                <button onClick={() => setPlaying(null)} className="p-1 text-[#9A9A9A] hover:text-[#353535]"><X size={18} /></button>
              </div>
              <div className="aspect-video w-full bg-black flex items-center justify-center">
                {playing.url ? (
                  <video src={playing.url} controls autoPlay className="max-w-full max-h-full w-full h-full object-contain" />
                ) : playing.content ? (
                  <VideoSlideshow content={playing.content} />
                ) : (
                  <div className="text-white/70 text-[13px]">该视频暂无可播放内容</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

/**
 * 视频课件「分镜放映页」（方案 B 闭环）：无真实视频文件时，把发布的分镜脚本（存在 content 里的提纲）
 * 还原为逐镜放映——展示画面描述+旁白，并用 Web Speech API 朗读旁白，支持自动/手动翻页。
 * 分镜 = 过程信息已随发布落入 content；此处只是把内容"放映"出来，零服务器依赖。
 */
function VideoSlideshow({ content }: { content: string }) {
  const shots = useMemo(() => {
    const outline = markdownToOutline(content)
    return outline.map(s => {
      const visual = (s.bullets.find(b => b.includes('🎬')) || '').replace('🎬', '').trim()
      const narr = (s.bullets.find(b => b.includes('🎙')) || '').replace('🎙', '').trim()
      const dur = (s.bullets.find(b => b.includes('⏱')) || '').replace('⏱', '').trim()
      const durSec = parseInt((dur.match(/\d+/) || ['5'])[0], 10) || 5
      return { title: s.title, visual, narration: narr || s.notes || '', durSec }
    }).filter(s => s.visual || s.narration)
  }, [content])

  const [idx, setIdx] = useState(0)
  const [auto, setAuto] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const timerRef = useRef<number | null>(null)

  const stopSpeak = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  const speak = (text: string) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(u)
  }

  const go = (next: number) => {
    stopSpeak()
    setIdx((next + shots.length) % shots.length)
  }

  // 自动放映：每镜停留 durSec 秒后翻下一镜
  useEffect(() => {
    if (!auto || !shots.length) return
    const cur = shots[idx]
    const t = window.setTimeout(() => go(idx + 1), (cur?.durSec || 5) * 1000)
    timerRef.current = t
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current) }
  }, [auto, idx, shots])

  useEffect(() => () => stopSpeak(), [])

  if (!shots.length) {
    return <div className="text-white/70 text-[13px] p-8 text-center">该分镜课件无可放映内容</div>
  }

  const cur = shots[idx]
  return (
    <div className="w-full h-full flex flex-col bg-[#0F172A] text-white">
      {/* 放映区 */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 text-center">
        <div className="text-[12px] text-[#7DD3FC] mb-3">镜头 {idx + 1} / {shots.length}</div>
        <div className="text-[20px] font-bold mb-6">{cur.title}</div>
        {cur.visual && (
          <div className="text-[15px] text-[#E2E8F0] leading-relaxed max-w-[640px] mb-6">
            <span className="text-[#94A3B8] text-[13px]">🎬 画面：</span>{cur.visual}
          </div>
        )}
        {cur.narration && (
          <div className="text-[14px] text-[#CBD5E1] leading-relaxed max-w-[640px]">
            <span className="text-[#94A3B8] text-[13px]">🎙 旁白：</span>{cur.narration}
          </div>
        )}
      </div>
      {/* 控制条 */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 bg-black/40 border-t border-white/10">
        <button onClick={() => go(idx - 1)} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded" title="上一镜"><SkipBack size={18} /></button>
        <button
          onClick={() => { stopSpeak(); speak(cur.narration) }}
          disabled={!cur.narration}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-white bg-[#02A7F0] rounded hover:bg-[#0288D1] disabled:opacity-40"
        >
          {speaking ? <Pause size={15} /> : <Volume2 size={15} />} {speaking ? '停止' : '朗读旁白'}
        </button>
        <button onClick={() => go(idx + 1)} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded" title="下一镜"><SkipForward size={18} /></button>
        <button
          onClick={() => setAuto(a => !a)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded ${auto ? 'bg-[#52C41A] text-white' : 'text-white/80 border border-white/30 hover:bg-white/10'}`}
        >
          {auto ? <Pause size={15} /> : <Play size={15} />} {auto ? '停止放映' : '自动放映'}
        </button>
      </div>
    </div>
  )
}
