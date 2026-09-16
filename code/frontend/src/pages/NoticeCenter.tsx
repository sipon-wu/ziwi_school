import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Plus, Sparkles, Save, Send, Eye, Search, Loader2,
  Megaphone, ExternalLink, FileText, AlertTriangle, CheckCircle2, Copy,
} from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { noticeAPI, aiAPI, notifyError } from '../lib/api'
import { showToast as toast } from '../components/Toast'
import { markdownToNoticeH5 } from '../lib/noticeH5'

/* ───────── 宣发场景模板（topic → 中文）───────── */
const NOTICE_TOPICS: { key: string; label: string; desc: string; dept: string }[] = [
  { key: 'drowning', label: '💧 暑期防溺水', desc: '官方『六不一会』致家长书', dept: '德育处' },
  { key: 'back_to_school', label: '🏫 开学啦', desc: '报到安排 + 准备清单 + 给家长的话', dept: '德育处' },
  { key: 'term_end', label: '🌴 放假通知', desc: '假期安排 + 安全提醒 + 作业阅读', dept: '德育处' },
  { key: 'traffic', label: '🚦 交通安全', desc: '一盔一带 + 步行/骑行/乘车', dept: '安全办' },
  { key: 'fire', label: '🧯 消防安全', desc: '不玩火 + 逃生要点 + 119', dept: '安全办' },
  { key: 'parent_meeting', label: '📋 家长会邀请函', desc: '时间地点 + 会议内容 + 回执', dept: '教务处' },
  { key: 'mental_health', label: '💛 心理健康', desc: '理解孩子 + 小贴士 + 求助渠道', dept: '心理辅导室' },
  { key: 'notice', label: '📢 通用通知', desc: '事项说明 + 时间地点 + 联系方式', dept: '德育处' },
]

const CAN_MANAGE = ['head_teacher', 'registrar', 'principal']

function safeMe(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem('user') || '{}') || {} } catch { return {} }
}

interface NoticeItem {
  id: string
  name: string
  type: string
  category?: string
  tag?: string
  content?: string
  h5_html?: string
  status?: string
  owner_name?: string
  user_id?: string
  created_at?: string
  updated_at?: string
}

export default function NoticeCenter() {
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname
  // 视图：/notices 列表；/notices/new 新建；/notices/:id/edit 编辑
  const isNew = path.endsWith('/new')
  const m = path.match(/^\/notices\/([^/]+)\/edit$/)
  const editId = isNew ? null : (m ? m[1] : null)
  const inEditor = isNew || !!editId

  const me = useMemo(() => safeMe(), [])
  const role: string = me?.role || 'teacher'
  const canManage = CAN_MANAGE.includes(role)
  const schoolName: string = me?.school_name || '本校'
  const teacherName: string = me?.name || me?.username || ''

  /* ── 列表态 ── */
  const [items, setItems] = useState<NoticeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState<NoticeItem | null>(null)

  /* ── 编辑态 ── */
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('drowning')
  const [dept, setDept] = useState('德育处')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState<'none' | 'draft' | 'publish' | 'ai'>('none')
  const [issues, setIssues] = useState<Array<{ level: string; message: string; suggestion?: string }>>([])
  const previewRef = useRef<HTMLIFrameElement>(null)

  const loadList = useCallback(() => {
    setLoading(true)
    noticeAPI.list()
      .then((res) => setItems((res?.items || []).filter((it: NoticeItem) => it.type === 'notice')))
      .catch((e) => notifyError('加载宣发列表失败', e))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!inEditor) loadList()
  }, [inEditor, loadList])

  // 编辑态：拉取已有数据
  useEffect(() => {
    if (!editId) { setName(''); setTopic('drowning'); setDept('德育处'); setContent(''); setIssues([]); return }
    let alive = true
    noticeAPI.get(editId).then((it: NoticeItem) => {
      if (!alive) return
      setName(it.name || '')
      setContent(it.content || '')
      const t = NOTICE_TOPICS.find(x => x.key === it.tag)
      setTopic(it.tag && t ? it.tag : 'notice')
      setDept(t?.dept || '德育处')
    }).catch((e) => notifyError('加载宣发内容失败', e))
    return () => { alive = false }
  }, [editId])

  // 实时预览（防抖 350ms）
  const previewHtml = useMemo(() => {
    if (!inEditor) return ''
    try { return markdownToNoticeH5(content, { title: name, schoolName }) } catch { return '' }
  }, [inEditor, content, name, schoolName])

  useEffect(() => {
    if (!inEditor || !previewRef.current) return
    const timer = setTimeout(() => {
      if (previewRef.current) previewRef.current.srcdoc = previewHtml
    }, 350)
    return () => clearTimeout(timer)
  }, [inEditor, previewHtml])

  /* ── AI 起草 ── */
  const handleAI = async () => {
    if (!name.trim()) { toast('请先填写宣发标题（如：暑假防溺水致家长的一封信）', 'warning'); return }
    setSaving('ai')
    setIssues([])
    try {
      const res = await aiAPI.generateNotice({
        title: name.trim(), topic, school_name: schoolName, department: dept,
        teacher_name: teacherName, extra: '',
      })
      // error 是 unknown（契约用索引签名），此处显式收窄而不是断言
      if (res?.error) { toast(typeof res.error === 'string' ? res.error : '生成失败', 'error'); return }
      if (res?.markdown) {
        setContent(res.markdown)
        setIssues(Array.isArray(res.issues) ? res.issues : [])
        toast('已生成草稿，请在左侧编辑后发布', 'success')
      }
    } catch (e) { notifyError('AI 起草失败', e) }
    finally { setSaving('none') }
  }

  /* ── 保存 / 发布 ── */
  const handleSave = async (status: 'draft' | 'active') => {
    if (!name.trim()) { toast('请填写宣发标题', 'warning'); return }
    setSaving(status === 'draft' ? 'draft' : 'publish')
    setIssues([])
    const h5 = markdownToNoticeH5(content, { title: name.trim(), schoolName })
    const payload = { name: name.trim(), tag: topic, content, h5_html: h5, status }
    try {
      // 发布前先本地预检（kind=notice 专用红线）；不通过则中止发布、停留在编辑
      if (status === 'active') {
        try {
          const v = await aiAPI.validateNotice({ markdown: `${name}\n${content}` })
          const blocks = (v?.issues || []).filter((i: any) => i.level === 'block')
          if (v?.pass === false && blocks.length) {
            setIssues(blocks)
            toast('发布未通过安全审核（安全类条款须用官方口径），请按提示修改', 'warning')
            return
          }
          const warns = (v?.issues || []).filter((i: any) => i.level !== 'block')
          if (warns.length) setIssues(warns)
        } catch {
          toast('审核服务暂不可用，将尝试直接发布（后端仍会强制把关）', 'warning')
        }
      }
      let saved: NoticeItem
      if (editId) saved = await noticeAPI.update(editId, payload)
      else saved = await noticeAPI.create(payload)
      toast(status === 'draft' ? '草稿已保存' : '已发布，全校与家长扫码可见', 'success')
      if (status === 'draft' && !editId && saved?.id) {
        navigate(`/notices/${saved.id}/edit`, { replace: true })
      } else if (status === 'active') {
        navigate('/notices')
        loadList()
      }
    } catch (e: any) {
      const msg = e?.message || '保存失败'
      if (msg.includes('CONTENT_BLOCKED') || msg.includes('安全审核')) {
        setIssues([{ level: 'block', message: '内容未通过安全审核，请修改后再发布' }])
        toast('发布未通过安全审核', 'warning')
      } else { notifyError('保存失败', e) }
    } finally { setSaving('none') }
  }

  /* ── 列表过滤 ── */
  const filtered = useMemo(() => items.filter((i) => {
    if (search && !(i.name || '').includes(search)) return false
    return true
  }), [items, search])

  const tagLabel = (tag?: string) => {
    const t = NOTICE_TOPICS.find(x => x.key === tag)
    return t ? t.label.replace(/^[^\s]+\s/, '') : (tag || '通用通知')
  }
  const copyLink = (id: string) => {
    const url = `${window.location.origin}/api/materials/${id}/h5`
    navigator.clipboard?.writeText(url).then(() => toast('链接已复制，可发到班级群/公众号', 'success')).catch(() => toast('复制失败', 'error'))
  }

  /* ── 渲染：编辑器 ── */
  if (inEditor) {
    return (
      <AppLayout>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate('/notices')}
              className="flex items-center gap-1 text-[13px] text-[#9A9A9A] hover:text-[#02A7F0]">
              <ArrowLeft size={14} /> 返回宣发列表
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => handleSave('draft')} disabled={saving !== 'none'}
                className="flex items-center gap-1.5 border border-[#E7E7EB] bg-white text-[#353535] rounded-[4px] px-3 py-1.5 text-[13px] hover:border-[#02A7F0] disabled:opacity-50">
                {saving === 'draft' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 保存草稿
              </button>
              <button onClick={() => handleSave('active')} disabled={saving !== 'none'}
                className="flex items-center gap-1.5 bg-[#02A7F0] text-white rounded-[4px] px-3 py-1.5 text-[13px] hover:bg-[#0297d8] disabled:opacity-50">
                {saving === 'publish' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 发布
              </button>
            </div>
          </div>

          {issues.length > 0 && (
            <div className="mb-3 rounded-[4px] border px-3 py-2 text-[12px] max-h-36 overflow-y-auto"
              style={{ borderColor: issues.some(i => i.level === 'block') ? '#FF4D4F' : '#FAAD14',
                       background: issues.some(i => i.level === 'block') ? '#FFF1F0' : '#FFFBE6' }}>
              {issues.map((i, idx) => (
                <div key={idx} className="flex gap-1.5 py-0.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5"
                    color={i.level === 'block' ? '#FF4D4F' : '#FAAD14'} />
                  <div>
                    <span>{i.message}</span>
                    {i.suggestion && <div className="text-[#9A9A9A] mt-0.5">建议：{i.suggestion}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0 flex gap-4">
            {/* 左：编辑 */}
            <div className="w-[46%] flex flex-col bg-white border border-[#E7E7EB] rounded-[4px] p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone size={16} className="text-[#02A7F0]" />
                <span className="text-[14px] font-semibold text-[#353535]">{editId ? '编辑宣发' : '新建家校宣发'}</span>
                <span className="text-[11px] text-[#9A9A9A]">全校共用 · 家长扫码阅读</span>
              </div>
              <label className="text-[12px] text-[#9A9A9A] mb-1">宣发标题</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="如：暑假防溺水致家长的一封信"
                className="w-full border border-[#E7E7EB] rounded-[3px] px-3 py-2 text-[14px] outline-none focus:border-[#02A7F0] mb-3" />
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-[12px] text-[#9A9A9A] mb-1 block">场景模板</label>
                  <select value={topic} onChange={e => {
                    const t = NOTICE_TOPICS.find(x => x.key === e.target.value)
                    setTopic(e.target.value)
                    if (t) setDept(t.dept)
                  }}
                    className="w-full border border-[#E7E7EB] rounded-[3px] px-2 py-2 text-[13px] outline-none">
                    {NOTICE_TOPICS.map(t => <option key={t.key} value={t.key}>{t.label} · {t.desc}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[12px] text-[#9A9A9A] mb-1 block">落款部门</label>
                  <input value={dept} onChange={e => setDept(e.target.value)}
                    className="w-full border border-[#E7E7EB] rounded-[3px] px-2 py-2 text-[13px] outline-none" />
                </div>
              </div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] text-[#9A9A9A]">正文（Markdown，语法见右侧提示）</label>
                <button onClick={handleAI} disabled={saving === 'ai'}
                  className="flex items-center gap-1 text-[12px] bg-[#FFF4E0] text-[#D48806] border border-[#FFE7BA] rounded-[3px] px-2.5 py-1 hover:bg-[#FFE9C7] disabled:opacity-60">
                  {saving === 'ai' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  用 AI 按模板起草
                </button>
              </div>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder={'# 暑假防溺水致家长的一封信\n> 某某小学 德育处 2026年9月\n\n## 💙 请您和孩子一起做到\n- 不私自下水游泳\n- 不擅自与他人结伴游泳\n\n> 🔴 提示：生命只有一次……'}
                spellCheck={false}
                className="flex-1 min-h-[320px] w-full border border-[#E7E7EB] rounded-[3px] px-3 py-2 text-[13px] font-mono leading-[1.7] outline-none focus:border-[#02A7F0] resize-none" />
              <div className="mt-2 text-[11px] text-[#9A9A9A] leading-[1.7]">
                <span className="text-[#D48806]">安全类模板（防溺水/交通/消防/心理）由 AI 自动引用官方口径</span>，
                发布时后端红线强制校验；正文 ≤40 字/段、要点 ≤20 字/条，全稿 1.5~3 屏为宜。
              </div>
            </div>
            {/* 右：预览 */}
            <div className="flex-1 min-w-0 flex flex-col bg-white border border-[#E7E7EB] rounded-[4px] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#9A9A9A]">手机预览（竖屏滚动长图）</span>
                {!content.trim() && <span className="text-[11px] text-[#FAAD14]">正文为空</span>}
              </div>
              <iframe ref={previewRef} title="notice-preview"
                className="flex-1 w-full border border-[#E7E7EB] rounded-[4px] bg-[#F6F7F8]"
                style={{ minHeight: 480 }}
                sandbox="allow-same-origin allow-scripts" />
              <div className="mt-2 text-[11px] text-[#9A9A9A] leading-[1.7]">
                支持语法：# 大标题 / &gt; 副题 / ## 板块 / 正文 / - 要点 / &gt; 提示条 / **加粗**。不可用表格、互动组件（那是课件的）。
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  /* ── 渲染：列表 ── */
  return (
    <AppLayout>
      <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[#353535] flex items-center gap-2">
              <Megaphone size={17} className="text-[#02A7F0]" /> 家校宣发
            </h2>
            <p className="text-[12px] text-[#9A9A9A] mt-1">
              防溺水 / 开学季 / 放假通知 / 家长会……全校共用资产（非课件），发布后家长扫码即读。
              {!canManage && <span className="text-[#9A9A9A]">（创建与编辑需班主任 / 校务 / 校长）</span>}
            </p>
          </div>
          {canManage && (
            <button onClick={() => navigate('/notices/new')}
              className="flex items-center gap-1.5 bg-[#02A7F0] text-white rounded-[4px] px-3.5 py-2 text-[13px] hover:bg-[#0297d8]">
              <Plus size={15} /> 新建宣发
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-[#9A9A9A]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索标题"
              className="pl-8 border border-[#E7E7EB] rounded-[3px] px-3 py-1.5 text-[13px] outline-none focus:border-[#02A7F0] w-56" />
          </div>
          <span className="text-[12px] text-[#9A9A9A]">共 {filtered.length} 条</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#9A9A9A]"><Loader2 size={20} className="animate-spin inline" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[#9A9A9A]">
            {search ? '没有匹配的宣发' : '还没有家校宣发。点右上角「新建宣发」，从防溺水 / 开学啦等模板开始。'}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {filtered.map((it) => {
              const isActive = it.status === 'active'
              return (
                <div key={it.id}
                  className="border border-[#E7E7EB] rounded-[4px] p-4 hover:shadow-sm hover:border-[#02A7F0]/40 transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-[#353535] truncate">{it.name}</div>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#9A9A9A]">
                        <span className="px-1.5 py-0.5 bg-[#F6F7F8] rounded-[3px]">{tagLabel(it.tag)}</span>
                        <span className={isActive ? 'text-[#52C41A]' : 'text-[#FAAD14]'}>{isActive ? '已发布' : '草稿'}</span>
                      </div>
                    </div>
                    <FileText size={16} className="text-[#C0C4CC] shrink-0" />
                  </div>
                  <div className="mt-2 text-[11px] text-[#9A9A9A] flex items-center gap-2">
                    <span>{it.owner_name || '—'}</span>
                    <span>·</span>
                    <span>{(it.updated_at || '').slice(0, 10)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-[#F5F5F5]">
                    <button onClick={() => setPreview(it)}
                      className="flex items-center gap-1 text-[12px] text-[#02A7F0] hover:underline px-1">
                      <Eye size={12} /> 预览
                    </button>
                    {isActive && (
                      <button onClick={() => copyLink(it.id)}
                        className="flex items-center gap-1 text-[12px] text-[#9A9A9A] hover:text-[#02A7F0] px-1">
                        <Copy size={12} /> 复制链接
                      </button>
                    )}
                    {canManage && (
                      <button onClick={() => navigate(`/notices/${it.id}/edit`)}
                        className="flex items-center gap-1 text-[12px] text-[#9A9A9A] hover:text-[#02A7F0] px-1 ml-auto">
                        <ExternalLink size={12} /> {isActive ? '编辑' : '继续编辑'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 预览弹层 */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-6"
          onClick={() => setPreview(null)}>
          <div className="bg-white rounded-[6px] w-[400px] max-w-full h-[86vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E7E7EB]">
              <span className="text-[13px] font-medium text-[#353535] truncate">{preview.name}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => copyLink(preview.id)}
                  className="text-[12px] text-[#02A7F0] hover:underline flex items-center gap-1"><Copy size={12} />复制链接</button>
                <button onClick={() => setPreview(null)} className="text-[#9A9A9A] hover:text-[#353535] text-lg leading-none">×</button>
              </div>
            </div>
            <iframe title="notice-preview-modal" className="flex-1 w-full bg-[#F6F7F8]" sandbox="allow-same-origin allow-scripts"
              srcDoc={(() => {
                try {
                  return preview.h5_html && preview.status === 'active'
                    ? preview.h5_html
                    : markdownToNoticeH5(preview.content || '', { title: preview.name, schoolName })
                } catch { return '' }
              })()} />
          </div>
        </div>
      )}
    </AppLayout>
  )
}
