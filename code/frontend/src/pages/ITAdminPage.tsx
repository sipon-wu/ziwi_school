import { useState, useEffect } from 'react'
import { importAPI, adminAPI } from '../lib/api'
import { SUBJECTS_CN } from '@shared/subjects'
import XiaoWeiChat from '../components/XiaoWeiChat'
// 模板资产域：读取经适配器注册的库模板清单（PPT/H5 同源注册，含来源/计价元数据）
import { listLibraryTemplateIds, getLibraryCostMeta } from '../lib/templateRegistryAdapter'

interface RowResult {
  line: number
  status: 'ok' | 'warn' | 'error'
  message: string
}
interface ImportResult {
  type: string
  total: number
  valid: number
  warnings: number
  invalid: number
  rows: RowResult[]
  batch_id?: string
}

const TYPES = [
  { key: 'classes', label: '班级', tpl: 'classes_template.csv' },
  { key: 'teachers', label: '教师', tpl: 'teachers_template.csv' },
  { key: 'students', label: '学生', tpl: 'students_template.csv' },
  { key: 'relations', label: '任课关系', tpl: 'relations_template.csv' },
]

const TABS = ['数据导入', '角色管理', '教材版本', '学期配置', '模板资产']

const ROLE_OPTIONS = [
  { value: 'teacher', label: '教师' },
  { value: 'head_teacher', label: '班主任' },
  { value: 'research_lead', label: '教研组长' },
  { value: 'registrar', label: '教务员' },
  { value: 'principal', label: '校长' },
  { value: 'it_admin', label: 'IT管理员' },
]

export default function ITAdminPage() {
  const [tab, setTab] = useState('数据导入')

  // ── 数据导入 ──
  const [type, setType] = useState('classes')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [history, setHistory] = useState<any[]>([])

  // ── 角色管理 ──
  const [users, setUsers] = useState<any[]>([])
  const [roleLoading, setRoleLoading] = useState(false)
  const [roleMsg, setRoleMsg] = useState('')

  // ── 教材版本 ──
  const [books, setBooks] = useState<any[]>([])
  const [bookSubject, setBookSubject] = useState('')
  const [bookSel, setBookSel] = useState<Record<string, string>>({})
  const [bookLoading, setBookLoading] = useState(false)
  const [bookMsg, setBookMsg] = useState('')

  // ── 学期配置 ──
  const [semesters, setSemesters] = useState<any[]>([])
  const [semForm, setSemForm] = useState({ name: '', start_date: '', end_date: '' })
  const [semMsg, setSemMsg] = useState('')

  // ── 模板资产（运营治理·只读视图，依赖前端适配器注册，不写后端） ──
  // 本期仅呈现已注册库模板（来源/计价/媒介），pending/active 为前端内存预览态，
  // 真实治理（审批流/上下架）待后端模板生命周期 API 落地后接入。
  const [templates, setTemplates] = useState<{
    id: string; medium: 'ppt' | 'h5'; source: string; baseCost: number; name: string; status: 'pending' | 'active'
  }[]>([])
  const [tplMsg, setTplMsg] = useState('')

  useEffect(() => {
    if (tab === '数据导入') loadHistory()
    else if (tab === '角色管理') loadUsers()
    else if (tab === '教材版本') loadBooks()
    else if (tab === '学期配置') loadSemesters()
    else if (tab === '模板资产') loadTemplates()
  }, [tab])

  // ── 模板资产 handlers ──
  function loadTemplates() {
    try {
      const ids = listLibraryTemplateIds()
      const rows = ids.map((id) => {
        const meta = getLibraryCostMeta(id) // { source, base_cost, name }
        const medium: 'ppt' | 'h5' = id.startsWith('h5-') ? 'h5' : 'ppt'
        return {
          id,
          medium,
          source: meta?.source || 'official',
          baseCost: meta?.base_cost ?? 0,
          name: meta?.name || id,
          status: 'active' as 'pending' | 'active', // 前端内存预览态
        }
      })
      setTemplates(rows)
    } catch (e) {
      setTplMsg('读取模板资产失败：' + String(e))
    }
  }
  function toggleTplStatus(id: string) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: t.status === 'active' ? 'pending' : 'active' } : t)),
    )
  }

  // ── 数据导入 handlers ──
  const loadHistory = async () => {
    try {
      const r = await importAPI.history()
      setHistory(r.items || [])
    } catch { /* 忽略 */ }
  }
  const onPreview = async () => {
    if (!file) { setMsg('请先选择 CSV 文件'); return }
    setLoading(true); setMsg(''); setPreview(null)
    try {
      const r = await importAPI.preview(type, file)
      setPreview(r)
    } catch (e: any) { setMsg(e.message || '预校验失败') }
    finally { setLoading(false) }
  }
  const onCommit = async () => {
    if (!file) return
    setLoading(true); setMsg('')
    try {
      const r = await importAPI.commit(type, file)
      setMsg(`导入完成：成功 ${r.valid} 行，跳过/失败 ${r.warnings + r.invalid} 行。批次 ${r.batch_id}`)
      setPreview(null); setFile(null); loadHistory()
    } catch (e: any) { setMsg(e.message || '导入失败') }
    finally { setLoading(false) }
  }
  const onRollback = async (id: string) => {
    if (!confirm('确认回滚该批次？将删除本批次新建的所有数据。')) return
    try {
      await importAPI.rollback(id)
      setMsg('已回滚'); loadHistory()
    } catch (e: any) { setMsg(e.message || '回滚失败') }
  }

  // ── 角色管理 handlers ──
  const loadUsers = async () => {
    setRoleLoading(true)
    try {
      const r = await adminAPI.listUsers()
      setUsers(r.items || [])
    } catch (e: any) { setRoleMsg(e.message || '加载用户失败') }
    finally { setRoleLoading(false) }
  }
  const onSaveRole = async (id: string, role: string) => {
    setRoleMsg('')
    try {
      await adminAPI.updateUserRole(id, role)
      setUsers((us) => us.map((u) => (u.id === id ? { ...u, role } : u)))
      setRoleMsg('角色已保存')
    } catch (e: any) { setRoleMsg(e.message || '保存失败') }
  }

  // ── 教材版本 handlers ──
  const loadBooks = async () => {
    setBookLoading(true)
    try {
      const r = await adminAPI.listTextbooks()
      const items = r.items || []
      setBooks(items)
      const subs = Array.from(new Set(items.map((t: any) => t.subject)))
      if (!bookSubject && subs.length) setBookSubject(subs[0] as string)
    } catch (e: any) { setBookMsg(e.message || '加载教材版本失败') }
    finally { setBookLoading(false) }
  }
  const subjectsOf = () => Array.from(new Set(books.map((t) => t.subject)))
  const gradesOf = (subject: string) =>
    Array.from(new Set(books.filter((t) => t.subject === subject).map((t) => t.grade || '')))
  const versionOptionsOf = (subject: string) => {
    const map = new Map<string, { publisher: string; version_name: string }>()
    books.filter((t) => t.subject === subject).forEach((t) => {
      map.set(`${t.publisher}|${t.version_name}`, { publisher: t.publisher, version_name: t.version_name })
    })
    return Array.from(map.values())
  }
  const currentVersionOf = (subject: string, grade: string) => {
    const school = books.find((t) => t.subject === subject && (t.grade || '') === grade && t.scope === 'school')
    if (school) return school.version_name
    const plat = books.find((t) => t.subject === subject && (t.grade || '') === grade && t.scope === 'platform')
    if (plat) return plat.version_name
    const anyPlat = books.find((t) => t.subject === subject && t.scope === 'platform')
    return anyPlat ? anyPlat.version_name : ''
  }
  const onSaveBooks = async () => {
    setBookMsg('')
    const grades = gradesOf(bookSubject)
    const opts = versionOptionsOf(bookSubject)
    const rows = grades.map((g) => {
      const name = bookSel[g] || currentVersionOf(bookSubject, g)
      const opt = opts.find((o) => o.version_name === name) || opts[0]
      return { subject: bookSubject, grade: g, publisher: opt.publisher, version_name: opt.version_name }
    })
    try {
      await adminAPI.upsertTextbook(rows)
      setBookSel({})
      setBookMsg('教材版本已保存（本校覆盖，仅对本校生效）')
      loadBooks()
    } catch (e: any) { setBookMsg(e.message || '保存失败') }
  }

  // ── 学期配置 handlers ──
  const loadSemesters = async () => {
    try {
      const r = await adminAPI.listSemesters()
      setSemesters(r.items || [])
    } catch (e: any) { setSemMsg(e.message || '加载学期失败') }
  }
  const onCreateSemester = async () => {
    if (!semForm.name || !semForm.start_date || !semForm.end_date) {
      setSemMsg('请填写学期名称与起止日期'); return
    }
    setSemMsg('')
    try {
      await adminAPI.createSemester(semForm)
      setSemForm({ name: '', start_date: '', end_date: '' })
      setSemMsg('学期已创建'); loadSemesters()
    } catch (e: any) { setSemMsg(e.message || '创建失败') }
  }

  const curTpl = TYPES.find((t) => t.key === type)?.tpl

  return (
    <div className="min-h-screen bg-[#F6F7F8]">
      <header className="bg-white border-b border-[#E7E7EB] px-6 py-4">
        <h1 className="text-lg font-semibold text-[#353535]">IT 管理后台</h1>
      </header>
      <div className="flex">
        <nav className="w-44 bg-white border-r border-[#E7E7EB] min-h-[calc(100vh-64px)] p-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`block w-full text-left px-3 py-2 rounded text-[13px] mb-1 ${
                tab === t ? 'bg-[#02A7F0] text-white' : 'text-[#353535] hover:bg-[#F0F0F2]'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
        <main className="flex-1 p-6">
          {tab === '数据导入' && (
            <div>
              <div className="flex gap-2 mb-4">
                {TYPES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => { setType(t.key); setPreview(null); setFile(null) }}
                    className={`px-3 py-1.5 rounded text-[13px] ${
                      type === t.key ? 'bg-[#02A7F0] text-white' : 'bg-white border border-[#E7E7EB] text-[#353535]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="bg-white border border-[#E7E7EB] rounded p-4 mb-4">
                <a href={`/${curTpl}`} className="text-[#02A7F0] text-[13px] underline" download>
                  下载「{TYPES.find((t) => t.key === type)?.label}」导入模板
                </a>
                <div className="mt-3 flex items-center gap-3">
                  <input type="file" accept=".csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null) }} className="text-[13px]" />
                  <button onClick={onPreview} disabled={loading || !file} className="px-3 py-1.5 bg-[#02A7F0] text-white text-[13px] rounded disabled:opacity-50">预校验</button>
                  <button onClick={onCommit} disabled={loading || !file} className="px-3 py-1.5 bg-[#15A85F] text-white text-[13px] rounded disabled:opacity-50">确认导入</button>
                </div>
                {msg && <div className="mt-3 text-[12px] text-[#FF4D4F]">{msg}</div>}
              </div>
              {preview && (
                <div className="bg-white border border-[#E7E7EB] rounded p-4 mb-4">
                  <div className="text-[13px] mb-2">
                    预校验结果：共 {preview.total} 行，有效 {preview.valid}，警告 {preview.warnings}，错误 {preview.invalid}
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-left text-[#9A9A9A]">
                          <th className="py-1">行</th><th>状态</th><th>说明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r, i) => (
                          <tr key={i} className="border-t border-[#F0F0F2]">
                            <td className="py-1">{r.line}</td>
                            <td>{r.status === 'ok' ? '✅' : r.status === 'warn' ? '⚠️' : '❌'}</td>
                            <td>{r.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="bg-white border border-[#E7E7EB] rounded p-4">
                <div className="text-[13px] font-medium mb-2">导入历史</div>
                {history.length === 0 && <div className="text-[12px] text-[#9A9A9A]">暂无导入记录</div>}
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[#9A9A9A]">
                      <th className="py-1">类型</th><th>状态</th><th>总行</th><th>新建</th><th>跳过</th><th>时间</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-t border-[#F0F0F2]">
                        <td className="py-1">{h.type}</td>
                        <td>{h.status === 'committed' ? '已提交' : '已回滚'}</td>
                        <td>{h.total_rows}</td><td>{h.created_rows}</td><td>{h.skipped_rows}</td>
                        <td>{new Date(h.created_at).toLocaleString()}</td>
                        <td>{h.status === 'committed' && (
                          <button onClick={() => onRollback(h.id)} className="text-[#FF4D4F] hover:underline">回滚</button>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === '角色管理' && (
            <div className="bg-white border border-[#E7E7EB] rounded p-4">
              <div className="text-[13px] font-medium mb-2">角色分配（一键初始化）</div>
              <div className="text-[12px] text-[#9A9A9A] mb-3">导入教师时已按模板自动套用角色；此处可手动调整单个用户的校内角色。</div>
              {roleLoading && <div className="text-[12px] text-[#9A9A9A]">加载中…</div>}
              {!roleLoading && users.length === 0 && <div className="text-[12px] text-[#9A9A9A]">暂无用户</div>}
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[#9A9A9A]">
                    <th className="py-1">姓名</th><th>手机号</th><th>当前角色</th><th>调整为</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-[#F0F0F2]">
                      <td className="py-1">{u.name}</td>
                      <td>{u.phone}</td>
                      <td>{ROLE_OPTIONS.find((r) => r.value === u.role)?.label || u.role}</td>
                      <td>
                        <select
                          defaultValue={u.role}
                          onChange={(e) => onSaveRole(u.id, e.target.value)}
                          className="border border-[#E7E7EB] rounded px-2 py-1 text-[12px]"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {roleMsg && <div className="mt-3 text-[12px] text-[#02A7F0]">{roleMsg}</div>}
            </div>
          )}

          {tab === '教材版本' && (
            <div className="bg-white border border-[#E7E7EB] rounded p-4">
              <div className="text-[13px] font-medium mb-2">教材版本（学校自用覆盖）</div>
              <div className="text-[12px] text-[#9A9A9A] mb-3">默认沿用平台统一预置版本；可按年级批量或单格修改，保存后仅对本校生效，不影响公共库。</div>
              {bookLoading && <div className="text-[12px] text-[#9A9A9A]">加载中…</div>}
              {!bookLoading && subjectsOf().length > 0 && (
                <>
                  <div className="flex gap-2 mb-3">
                    {subjectsOf().map((s) => (
                      <button
                        key={s}
                        onClick={() => { setBookSubject(s); setBookSel({}) }}
                        className={`px-3 py-1.5 rounded text-[13px] ${
                          bookSubject === s ? 'bg-[#02A7F0] text-white' : 'bg-white border border-[#E7E7EB] text-[#353535]'
                        }`}
                      >
                        {SUBJECTS_CN[s] || s}
                      </button>
                    ))}
                  </div>
                  <table className="w-full text-[12px] mb-3">
                    <thead>
                      <tr className="text-left text-[#9A9A9A]">
                        <th className="py-1">年级</th><th>当前/选用版本</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradesOf(bookSubject).map((g) => {
                        const cur = currentVersionOf(bookSubject, g)
                        const opts = versionOptionsOf(bookSubject)
                        return (
                          <tr key={g} className="border-t border-[#F0F0F2]">
                            <td className="py-1">{g === '' ? '全校（不分级）' : g}</td>
                            <td>
                              <select
                                value={bookSel[g] || cur}
                                onChange={(e) => setBookSel((s) => ({ ...s, [g]: e.target.value }))}
                                className="border border-[#E7E7EB] rounded px-2 py-1 text-[12px]"
                              >
                                {opts.map((o) => (
                                  <option key={o.publisher + '|' + o.version_name} value={o.version_name}>
                                    {o.publisher} {o.version_name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <button onClick={onSaveBooks} className="px-3 py-1.5 bg-[#15A85F] text-white text-[13px] rounded">保存该学科教材配置</button>
                </>
              )}
              {bookMsg && <div className="mt-3 text-[12px] text-[#02A7F0]">{bookMsg}</div>}
            </div>
          )}

          {tab === '学期配置' && (
            <div className="bg-white border border-[#E7E7EB] rounded p-4">
              <div className="text-[13px] font-medium mb-2">学期配置</div>
              <table className="w-full text-[12px] mb-4">
                <thead>
                  <tr className="text-left text-[#9A9A9A]">
                    <th className="py-1">学期名称</th><th>开始</th><th>结束</th><th>创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {semesters.map((s) => (
                    <tr key={s.id} className="border-t border-[#F0F0F2]">
                      <td className="py-1">{s.name}</td>
                      <td>{s.start_date ? s.start_date.slice(0, 10) : ''}</td>
                      <td>{s.end_date ? s.end_date.slice(0, 10) : ''}</td>
                      <td>{new Date(s.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {semesters.length === 0 && (
                    <tr><td colSpan={4} className="py-2 text-[#9A9A9A]">暂无学期</td></tr>
                  )}
                </tbody>
              </table>
              <div className="flex gap-3 items-end">
                <div>
                  <div className="text-[12px] text-[#9A9A9A] mb-1">学期名称</div>
                  <input value={semForm.name} onChange={(e) => setSemForm({ ...semForm, name: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 text-[13px]" placeholder="如：2026 春季学期" />
                </div>
                <div>
                  <div className="text-[12px] text-[#9A9A9A] mb-1">开始日期</div>
                  <input type="date" value={semForm.start_date} onChange={(e) => setSemForm({ ...semForm, start_date: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 text-[13px]" />
                </div>
                <div>
                  <div className="text-[12px] text-[#9A9A9A] mb-1">结束日期</div>
                  <input type="date" value={semForm.end_date} onChange={(e) => setSemForm({ ...semForm, end_date: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 text-[13px]" />
                </div>
                <button onClick={onCreateSemester} className="px-3 py-1.5 bg-[#15A85F] text-white text-[13px] rounded">创建学期</button>
              </div>
              {semMsg && <div className="mt-3 text-[12px] text-[#02A7F0]">{semMsg}</div>}
            </div>
          )}

          {tab === '模板资产' && (
            <div className="bg-white border border-[#E7E7EB] rounded p-4">
              <div className="text-[13px] font-medium mb-2">模板资产（运营治理）</div>
              <div className="text-[12px] text-[#9A9A9A] mb-3">
                展示经模板注册中心接入的官方/精品模板（PPT 与 H5 同源）。来源与计价由运营维护，本期仅只读呈现；
                pending/active 为前端预览态，真实审批下架流待后端模板生命周期 API 落地后接入。
              </div>
              {tplMsg && <div className="mb-3 text-[12px] text-[#E54545]">{tplMsg}</div>}
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[#9A9A9A]">
                    <th className="py-1">模板</th><th>媒介</th><th>来源</th><th>计价</th><th>状态</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-t border-[#F0F0F2]">
                      <td className="py-1">{t.name} <span className="text-[#B5B5B5]">({t.id})</span></td>
                      <td>{t.medium.toUpperCase()}</td>
                      <td>{t.source === 'official' ? '官方' : t.source}</td>
                      <td>{t.baseCost > 0 ? `${t.baseCost} token` : '免费'}</td>
                      <td>
                        <span className={t.status === 'active' ? 'text-[#15A85F]' : 'text-[#E5A100]'}>
                          {t.status === 'active' ? '已上架' : '待审'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => toggleTplStatus(t.id)}
                          className="border border-[#E7E7EB] rounded px-2 py-0.5 text-[12px] hover:border-[#02A7F0]"
                        >
                          {t.status === 'active' ? '下架' : '上架'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {templates.length === 0 && (
                    <tr><td colSpan={6} className="py-2 text-[#9A9A9A]">未注册任何库模板</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
        <XiaoWeiChat />
      </div>
    </div>
  )
}
