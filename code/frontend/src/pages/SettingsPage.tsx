import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { Pencil, Plus, Trash2, Copy, Check, X, Upload } from 'lucide-react'
import { api, adminAPI, classAPI, teacherPrefAPI } from '../lib/api'
import AppLayout from '../components/AppLayout'
import { useTeaching } from '../lib/TeachingContext'

type SubTab = 'account' | 'school' | 'textbook' | 'semester' | 'train' | 'log' | 'library'

export default function SettingsPage() {
  const [subTab, setSubTab] = useState<SubTab>('account')
  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') || {} } catch { return {} } })()
  const licenseStatus = (user.license_status as string) || 'none'
  const isITAdmin = user.role === 'it_admin'

  // 系统设置子页签（V2.5 教材版本配置规格书 §4）：
  //  - 学校版 License 已开通(active) 且非 IT 管理员 → 教师继承学校配置，隐藏教材配置入口
  //  - 个人试用(none/trial) 或 IT 管理员 → 显示教材配置入口，自行维护
  // 顶部下拉仅展示/切换配置结果，不在顶栏配置。
  const SETTING_TABS: { id: SubTab; label: string }[] = [
    { id: 'account', label: '帐号设置' },
    { id: 'school', label: '学校 · 班级' },
    ...(licenseStatus === 'active' && !isITAdmin ? [] : [{ id: 'textbook' as SubTab, label: '教材版本' }]),
    ...(isITAdmin ? [{ id: 'library' as SubTab, label: '版本库维护' }] : []),
    { id: 'semester', label: '学期配置' },
    { id: 'train', label: '训练小微' },
    { id: 'log', label: '日志 · 反馈' },
  ]

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0">
          <h1 className="text-[24px] font-bold text-[#353535]">系统设置</h1>
        </div>
        <div className="flex items-center gap-2.5 mt-4 shrink-0">
          {SETTING_TABS.map((t) => (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className={`px-4 h-[38px] text-[13px] rounded-[5px] transition-colors flex items-center justify-center
                ${subTab === t.id ? 'bg-[#D7D7D7] text-[#000000]' : 'bg-[#F6F7F8] text-[#7F7F7F] hover:text-[#353535]'}`}>{t.label}</button>
          ))}
        </div>

        <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden flex-1 mt-4 min-h-0 flex flex-col">
          {subTab === 'account' && <AccountTab />}
          {subTab === 'school' && <SchoolClassTab />}
          {subTab === 'textbook' && <TextbookTab />}
          {subTab === 'library' && <TextbookLibraryAdmin />}
          {subTab === 'semester' && <SemesterTab />}
          {subTab === 'train' && <div className="flex-1 min-h-0 relative overflow-hidden"><TrainXiaoWeiTab /></div>}
          {subTab === 'log' && <LogFeedbackTab />}
        </div>
      </div>
    </AppLayout>
  )
}

function AccountTab() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') || {} } catch { return {} } })()
  const [userName, setUserName] = useState(user.name || '张真真')
  const [userPhone, setUserPhone] = useState(user.phone || '13800000002')
  const [userEmail, setUserEmail] = useState(user.email || '123456789@qq.com')
  const [userGender, setUserGender] = useState('女')
  const [userRegion, setUserRegion] = useState('中国 四川 成都')
  const [userId] = useState(user.id || 'js_3025510d5cb2')
  const [reviewEnabled, setReviewEnabled] = useState(localStorage.getItem('review_enabled') !== 'false')
  const [avatarErr, setAvatarErr] = useState(false)
  const [avatarSrc, setAvatarSrc] = useState('/avatar.jpg?v=3')
  const [avatarMsg, setAvatarMsg] = useState('')

  // 编辑状态
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [copyMsg, setCopyMsg] = useState('')

  const rows: { key: string; label: string; value: string; type?: string }[] = [
    { key: 'name', label: '名称', value: userName },
    { key: 'gender', label: '姓别', value: userGender },
    { key: 'phone', label: '手机号', value: userPhone },
    { key: 'email', label: '登录邮箱', value: userEmail },
    { key: 'region', label: '地区', value: userRegion },
  ]

  const startEdit = (key: string, val: string) => { setEditingField(key); setEditValue(val) }
  const cancelEdit = () => setEditingField(null)

  const saveEdit = () => {
    const v = editValue.trim()
    if (!v) return
    switch (editingField) {
      case 'name': setUserName(v); break
      case 'gender': setUserGender(v); break
      case 'phone': setUserPhone(v); break
      case 'email': setUserEmail(v); break
      case 'region': setUserRegion(v); break
    }
    setEditingField(null)
    // 调用后端API持久化
    const body: any = {}
    switch (editingField) {
      case 'name': body.name = v; break
      case 'gender': body.gender = v; break
      case 'phone': body.phone = v; break
      case 'email': body.email = v; break
      case 'region': body.region = v; break
    }
    api('/user/profile', { method: 'PUT', body: JSON.stringify(body) }).catch(() => {})
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(userId)
    setCopyMsg('已复制')
    setTimeout(() => setCopyMsg(''), 2000)
  }

  const handleAvatarChange = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      if (file.size > 5 * 1024 * 1024) { setAvatarMsg('图片不能超过5MB'); setTimeout(() => setAvatarMsg(''), 2000); return }
      const reader = new FileReader()
      reader.onload = () => { setAvatarSrc(reader.result as string); setAvatarMsg('头像已更新'); setTimeout(() => setAvatarMsg(''), 2000); api('/user/profile', { method: 'PUT', body: JSON.stringify({ avatar: reader.result as string }) }).catch(() => {}) }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const tooltips: Record<string, string> = {
    name: '您的真实姓名，学生和家长可见',
    gender: '个人性别信息',
    phone: '用于登录和接收重要通知',
    email: '用于找回密码和接收系统消息',
    region: '所在地区，影响教材版本推荐',
  }

  return (
    <div>
      <div className="flex items-center border-b border-[#F0F0F0]">
        <span className="w-[120px] shrink-0 px-5 py-3 text-[12px] text-[#9A9A9A]">头像</span>
        <div className="flex-1 py-3 pr-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-[#E7E7EB] relative group cursor-pointer" onClick={handleAvatarChange}>
            {avatarErr ? (
              <div className="w-full h-full bg-[#02A7F0] flex items-center justify-center text-white text-[15px] font-bold">{userName.charAt(0)}</div>
            ) : (
              <img src={avatarSrc} alt="" className="w-full h-full object-cover" onError={() => setAvatarErr(true)} />
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload size={14} className="text-white" />
            </div>
          </div>
          <button onClick={handleAvatarChange} className="text-[11px] text-[#02A7F0] hover:underline">修改</button>
          {avatarMsg && <span className="text-[11px] text-green-600">{avatarMsg}</span>}
        </div>
      </div>
      {/* 用户ID行 */}
      <div className="flex items-center border-b border-[#F0F0F0]">
        <span className="w-[120px] shrink-0 px-5 py-3 text-[12px] text-[#9A9A9A]">用户ID</span>
        <span className="flex-1 py-3 pr-4 text-[13px] text-[#353535] font-mono text-[11px]">{userId}</span>
        <div className="pr-5 flex items-center gap-3 shrink-0">
          <button onClick={handleCopy} className="text-[11px] text-[#02A7F0] hover:underline flex items-center gap-1"><Copy size={11} />{copyMsg || '复制'}</button>
          <div className="w-[18px] h-[18px] rounded-full border border-[#D0D0D0] flex items-center justify-center text-[9px] text-[#9A9A9A] cursor-help font-medium" title="您的唯一用户标识，用于技术支持排查问题">？</div>
        </div>
      </div>
      {/* 可编辑字段 */}
      {rows.map((r) => (
        <div key={r.key} className="flex items-center border-b border-[#F0F0F0] last:border-0">
          <span className="w-[120px] shrink-0 px-5 py-3 text-[12px] text-[#9A9A9A]">{r.label}</span>
          {editingField === r.key ? (
            <>
              <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                className="flex-1 py-2 px-2 text-[13px] border border-[#02A7F0] rounded-[3px] outline-none mr-2"
                autoFocus onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }} />
              <div className="pr-5 flex items-center gap-2 shrink-0">
                <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded-[3px]" title="保存"><Check size={14} /></button>
                <button onClick={cancelEdit} className="p-1 text-[#9A9A9A] hover:bg-gray-100 rounded-[3px]" title="取消"><X size={14} /></button>
              </div>
            </>
          ) : (
            <>
              <span className="flex-1 py-3 pr-4 text-[13px] text-[#353535]">{r.value}</span>
              <div className="pr-5 flex items-center gap-3 shrink-0">
                <button onClick={() => startEdit(r.key, r.value)} className="text-[11px] text-[#02A7F0] hover:underline">修改</button>
                <div className="w-[18px] h-[18px] rounded-full border border-[#D0D0D0] flex items-center justify-center text-[9px] text-[#9A9A9A] cursor-help font-medium" title={tooltips[r.key] || ''}>？</div>
              </div>
            </>
          )}
        </div>
      ))}
      <div className="px-5 py-3 border-t border-[#F0F0F0] space-y-2.5">
        <div className="flex items-center justify-between">
          <div><div className="text-[12px] font-medium text-[#353535]">教案互审</div><div className="text-[10px] text-[#9A9A9A] mt-0.5">开启后教案送审到教研组长，关闭则直接发布</div></div>
          <button onClick={() => { setReviewEnabled(!reviewEnabled); localStorage.setItem('review_enabled', String(!reviewEnabled)) }}
            className={`w-10 h-5 rounded-full transition-colors relative ${reviewEnabled ? 'bg-[#02A7F0]' : 'bg-[#D0D0D0]'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${reviewEnabled ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
        <button className="text-[#02A7F0] hover:underline text-[11px]">帐号移交</button>
      </div>
    </div>
  )
}

function TextbookTab() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') || {} } catch { return {} } })()
  const licenseStatus = (user.license_status as string) || 'none'
  const isITAdmin = user.role === 'it_admin'
  const teaching = useTeaching()

  // 分派：IT 管理员维护学校级三级配置；个人试用(none/trial)教师维护 per-user 个人偏好。
  // 学校版 License 已开通(active) 且非 IT 管理员 → 教材配置入口已在 SETTING_TABS 隐藏，不会进入本页。
  if (isITAdmin) return <SchoolTextbookConfig />
  return <PersonalTextbookConfig teaching={teaching} />
}

function PersonalTextbookConfig({ teaching }: { teaching: import('../lib/TeachingContext').TeachingCtxValue }) {
  const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']
  const [books, setBooks] = useState<any[]>([])
  const [prefs, setPrefs] = useState<any[]>([])
  const [myClasses, setMyClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ grade: '', class_id: '', subject: '', version_name: '' })

  const loadAll = () =>
    Promise.all([
      adminAPI.listTextbooks().catch(() => ({ items: [] })),
      teacherPrefAPI.list().catch(() => ({ items: [] })),
      classAPI.myClasses().catch(() => ({ items: [] })),
    ]).then(([tb, pf, mc]: any[]) => {
      setBooks(tb.items || [])
      setPrefs(pf.items || [])
      setMyClasses(mc.items || [])
    })

  useEffect(() => { setLoading(true); loadAll().finally(() => setLoading(false)) }, [])

  const subjects = () => Array.from(new Set(books.map((b: any) => b.subject))) as string[]
  const versionOptions = (subject: string) => {
    const m = new Map<string, { publisher: string; version_name: string }>()
    books.filter((b: any) => b.subject === subject).forEach((b: any) =>
      m.set(`${b.publisher}|${b.version_name}`, { publisher: b.publisher, version_name: b.version_name }))
    return Array.from(m.values())
  }
  /** 查找某 (学科, 年级, 班级) 的偏好（年级/班级为空表示不限） */
  const findPref = (subject: string, grade = '', classID = '') =>
    prefs.find((p: any) => p.subject === subject && (p.grade || '') === grade && (p.class_id || '') === classID)

  // 快速设置：仅按学科（年级/班级不限）
  const onChange = async (subject: string, versionName: string) => {
    const opt = versionOptions(subject).find((o) => o.version_name === versionName)
    if (!opt) return
    await teacherPrefAPI.upsert({ subject, grade: '', class_id: '', publisher: opt.publisher, version_name: opt.version_name })
    teaching.setTextbook(subject, opt.version_name) // 即时同步到工作台
    setMsg(`已保存「${subject}」个人教材版本：${opt.version_name}（仅影响您个人产出）`)
    await loadAll()
  }

  // 新增：按 年级/班级/学科 指定
  const onAdd = async () => {
    if (!form.subject) { setMsg('请选择学科'); return }
    const opt = versionOptions(form.subject).find((o) => o.version_name === form.version_name)
    if (!opt) { setMsg('请选择版本'); return }
    await teacherPrefAPI.upsert({ subject: form.subject, grade: form.grade, class_id: form.class_id, publisher: opt.publisher, version_name: opt.version_name })
    setShowAdd(false); setMsg('个人指定已保存（优先级高于学校配置，仅影响您个人产出）')
    await loadAll()
  }
  const onRemove = async (p: any) => {
    await teacherPrefAPI.remove(p.subject, p.grade || '', p.class_id || '')
    setPrefs(prefs.filter((x: any) => !(x.subject === p.subject && (x.grade || '') === (p.grade || '') && (x.class_id || '') === (p.class_id || ''))))
    setMsg('已删除个人指定')
  }

  const tag = (p: any) => {
    const g = p.grade ? p.grade : '全部年级'
    const c = p.class_id ? (myClasses.find((m: any) => m.id === p.class_id)?.name || p.class_id) : '全部班级'
    return `${g} · ${c}`
  }

  return (
    <div className="p-5 overflow-auto">
      <div className="text-[13px] font-medium mb-1">教材版本配置（个人）</div>
      <div className="text-[12px] text-[#9A9A9A] mb-4">
        您可以为「每年级每班每学科」指定教材版本，仅影响您个人的教案生成、出题组卷与知识图谱，并在 PC / 小程序多端自动同步。优先级：个人指定 &gt; 学校配置 &gt; 平台默认。
      </div>
      {loading && <div className="text-[12px] text-[#9A9A9A]">加载中…</div>}
      {!loading && (
        <div className="space-y-5">
          <section>
            <div className="text-[13px] font-medium mb-2">快速设置（按学科，适用全部年级/班级）</div>
            <div className="flex flex-col gap-2">
              {subjects().map((s) => {
                const cur = findPref(s)
                const opts = versionOptions(s)
                return (
                  <div key={s} className="flex items-center gap-2 text-[12px]">
                    <span className="w-12 text-[#353535]">{s}</span>
                    <select value={cur?.version_name || ''}
                      onChange={(e) => onChange(s, e.target.value)}
                      className="border border-[#E7E7EB] rounded px-2 py-1 text-[12px]">
                      <option value="">（沿用平台默认）</option>
                      {opts.map((o) => <option key={o.publisher + '|' + o.version_name} value={o.version_name}>{o.publisher} {o.version_name}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-medium">按年级 / 班级 / 学科 指定</div>
              <button onClick={() => { setForm({ grade: '', class_id: '', subject: subjects()[0] || '', version_name: '' }); setShowAdd(true) }}
                className="px-2 py-1 bg-[#02A7F0] text-white text-[12px] rounded">+ 新增指定</button>
            </div>
            <table className="w-full text-[12px]">
              <thead><tr className="text-left text-[#9A9A9A]"><th className="py-1">范围</th><th>学科</th><th>版本</th><th></th></tr></thead>
              <tbody>
                {prefs.filter((p: any) => (p.grade || p.class_id)).map((p: any) => (
                  <tr key={p.id || (p.subject + p.grade + p.class_id)} className="border-t border-[#F0F0F2]">
                    <td className="py-1">{tag(p)}</td><td>{p.subject}</td><td>{p.publisher} {p.version_name}</td>
                    <td className="text-right"><button onClick={() => onRemove(p)} className="text-[#E0533D] hover:underline">移除</button></td>
                  </tr>
                ))}
                {prefs.filter((p: any) => (p.grade || p.class_id)).length === 0 && <tr><td colSpan={4} className="py-1 text-[#9A9A9A]">暂无年级/班级级指定（可用上方快速设置按学科配置）</td></tr>}
              </tbody>
            </table>
          </section>
        </div>
      )}
      {msg && <div className="mt-3 text-[12px] text-[#02A7F0]">{msg}</div>}

      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded p-5 w-[360px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-medium mb-3">新增个人教材指定</div>
            <div className="space-y-2 text-[12px]">
              <div><div className="text-[#9A9A9A] mb-1">年级（留空=全部）</div>
                <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value, class_id: '' })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                  <option value="">全部年级</option>{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
              <div><div className="text-[#9A9A9A] mb-1">班级（留空=全部）</div>
                <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                  <option value="">全部班级</option>{myClasses.filter((m: any) => !form.grade || m.grade === form.grade).map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
              <div><div className="text-[#9A9A9A] mb-1">学科</div>
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                  {subjects().map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><div className="text-[#9A9A9A] mb-1">教材版本</div>
                <select value={form.version_name} onChange={(e) => setForm({ ...form, version_name: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                  <option value="">请选择</option>{versionOptions(form.subject).map((o) => <option key={o.publisher + '|' + o.version_name} value={o.version_name}>{o.publisher} {o.version_name}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-[13px] border border-[#E7E7EB] rounded">取消</button>
              <button onClick={onAdd} className="px-3 py-1.5 bg-[#15A85F] text-white text-[13px] rounded">确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SchoolTextbookConfig() {
  const [books, setBooks] = useState<any[]>([])
  const [configs, setConfigs] = useState<any[]>([])
  const [myClasses, setMyClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const loadAll = () =>
    Promise.all([
      adminAPI.listTextbooks().catch(() => ({ items: [] })),
      adminAPI.listTextbookConfigs().catch(() => ({ items: [] })),
      classAPI.myClasses().catch(() => ({ items: [] })),
    ]).then(([tb, cf, mc]: any[]) => {
      setBooks(tb.items || [])
      setConfigs(cf.items || [])
      setMyClasses(mc.items || [])
    })

  useEffect(() => { setLoading(true); loadAll().finally(() => setLoading(false)) }, [])

  const subjects = () => Array.from(new Set(books.map((b: any) => b.subject))) as string[]
  const versionOptions = (subject: string) => {
    const m = new Map<string, { publisher: string; version_name: string }>()
    books.filter((b: any) => b.subject === subject).forEach((b: any) =>
      m.set(`${b.publisher}|${b.version_name}`, { publisher: b.publisher, version_name: b.version_name }))
    return Array.from(m.values())
  }
  const schoolCfg = (subject: string) => configs.find((c) => c.config_type === 'school' && c.subject === subject)
  const gradeSubjectCfgs = () => configs.filter((c) => c.config_type === 'grade_subject')
  const classSubjectCfgs = () => configs.filter((c) => c.config_type === 'class_subject')

  const saveSchoolDefault = async (subject: string, versionName: string) => {
    const opt = versionOptions(subject).find((o) => o.version_name === versionName) || versionOptions(subject)[0]
    if (!opt) return
    await adminAPI.upsertTextbookConfig({ config_type: 'school', subject, grade: '', publisher: opt.publisher, version_name: opt.version_name })
    setMsg(`已保存「${subject}」学校默认版本：${opt.version_name}`)
    await loadAll()
  }

  const [showGS, setShowGS] = useState(false)
  const [showCS, setShowCS] = useState(false)
  const [formGS, setFormGS] = useState({ grade: '一年级', subject: '', version_name: '' })
  const [formCS, setFormCS] = useState({ grade: '一年级', class_id: '', subject: '', version_name: '' })

  const openGS = () => { setFormGS({ grade: '一年级', subject: subjects()[0] || '', version_name: '' }); setShowGS(true) }
  const openCS = () => { setFormCS({ grade: '一年级', class_id: '', subject: subjects()[0] || '', version_name: '' }); setShowCS(true) }
  const onGS = async () => {
    const opt = versionOptions(formGS.subject).find((o) => o.version_name === formGS.version_name)
    if (!opt) { setMsg('请选择版本'); return }
    await adminAPI.upsertTextbookConfig({ config_type: 'grade_subject', subject: formGS.subject, grade: formGS.grade, publisher: opt.publisher, version_name: opt.version_name })
    setShowGS(false); setMsg('年级-学科覆盖已保存'); await loadAll()
  }
  const onCS = async () => {
    const opt = versionOptions(formCS.subject).find((o) => o.version_name === formCS.version_name)
    if (!opt) { setMsg('请选择版本'); return }
    await adminAPI.upsertTextbookConfig({ config_type: 'class_subject', subject: formCS.subject, grade: formCS.grade, class_id: formCS.class_id, publisher: opt.publisher, version_name: opt.version_name })
    setShowCS(false); setMsg('班级级覆盖已保存'); await loadAll()
  }
  const onDelete = async (id: string) => { await adminAPI.deleteTextbookConfig(id); setMsg('已删除覆盖配置'); await loadAll() }

  const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']

  return (
    <div className="p-5 overflow-auto">
      <div className="text-[13px] font-medium mb-1">教材版本配置（三级）</div>
      <div className="text-[12px] text-[#9A9A9A] mb-4">
        优先级：班级级 &gt; 年级-学科级 &gt; 学校默认。保存后全校（或对应班级）的教案生成、出题组卷、知识图谱将自动锚定对应版本。此为学校级配置，将作用于本校全部教师。
      </div>
      {loading && <div className="text-[12px] text-[#9A9A9A]">加载中…</div>}
      {!loading && (
        <div className="space-y-6">
          <section>
            <div className="text-[13px] font-medium mb-2">① 学校默认教材版本</div>
            <div className="flex flex-col gap-2">
              {subjects().map((s) => {
                const cur = schoolCfg(s)
                const opts = versionOptions(s)
                return (
                  <div key={s} className="flex items-center gap-2 text-[12px]">
                    <span className="w-12 text-[#353535]">{s}</span>
                    <select value={cur?.version_name || ''}
                      onChange={(e) => saveSchoolDefault(s, e.target.value)}
                      className="border border-[#E7E7EB] rounded px-2 py-1 text-[12px]">
                      <option value="">（沿用平台默认）</option>
                      {opts.map((o) => <option key={o.publisher + '|' + o.version_name} value={o.version_name}>{o.publisher} {o.version_name}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-medium">② 年级-学科覆盖</div>
              <button onClick={openGS} className="px-2 py-1 bg-[#02A7F0] text-white text-[12px] rounded">+ 新增覆盖</button>
            </div>
            <table className="w-full text-[12px]">
              <thead><tr className="text-left text-[#9A9A9A]"><th className="py-1">年级</th><th>学科</th><th>版本</th><th></th></tr></thead>
              <tbody>
                {gradeSubjectCfgs().map((c) => (
                  <tr key={c.id} className="border-t border-[#F0F0F2]">
                    <td className="py-1">{c.grade}</td><td>{c.subject}</td><td>{c.publisher} {c.version_name}</td>
                    <td className="text-right"><button onClick={() => onDelete(c.id)} className="text-[#E0533D] hover:underline">移除</button></td>
                  </tr>
                ))}
                {gradeSubjectCfgs().length === 0 && <tr><td colSpan={4} className="py-1 text-[#9A9A9A]">暂无覆盖</td></tr>}
              </tbody>
            </table>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13px] font-medium">③ 班级级覆盖（精细）</div>
              <button onClick={openCS} className="px-2 py-1 bg-[#02A7F0] text-white text-[12px] rounded">+ 新增覆盖</button>
            </div>
            <table className="w-full text-[12px]">
              <thead><tr className="text-left text-[#9A9A9A]"><th className="py-1">年级</th><th>班级</th><th>学科</th><th>版本</th><th></th></tr></thead>
              <tbody>
                {classSubjectCfgs().map((c) => {
                  const cls = myClasses.find((m: any) => m.id === c.class_id)
                  return (
                    <tr key={c.id} className="border-t border-[#F0F0F2]">
                      <td className="py-1">{c.grade}</td><td>{cls ? cls.name : (c.class_id || '—')}</td><td>{c.subject}</td><td>{c.publisher} {c.version_name}</td>
                      <td className="text-right"><button onClick={() => onDelete(c.id)} className="text-[#E0533D] hover:underline">移除</button></td>
                    </tr>
                  )
                })}
                {classSubjectCfgs().length === 0 && <tr><td colSpan={5} className="py-1 text-[#9A9A9A]">暂无覆盖</td></tr>}
              </tbody>
            </table>
          </section>
        </div>
      )}
      {msg && <div className="mt-3 text-[12px] text-[#02A7F0]">{msg}</div>}

      {showGS && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowGS(false)}>
          <div className="bg-white rounded p-5 w-[340px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-medium mb-3">新增年级-学科覆盖</div>
            <div className="space-y-2 text-[12px]">
              <div><div className="text-[#9A9A9A] mb-1">年级</div>
                <select value={formGS.grade} onChange={(e) => setFormGS({ ...formGS, grade: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
              <div><div className="text-[#9A9A9A] mb-1">学科</div>
                <select value={formGS.subject} onChange={(e) => setFormGS({ ...formGS, subject: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                  {subjects().map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><div className="text-[#9A9A9A] mb-1">教材版本</div>
                <select value={formGS.version_name} onChange={(e) => setFormGS({ ...formGS, version_name: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                  <option value="">请选择</option>{versionOptions(formGS.subject).map((o) => <option key={o.publisher + '|' + o.version_name} value={o.version_name}>{o.publisher} {o.version_name}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowGS(false)} className="px-3 py-1.5 text-[13px] border border-[#E7E7EB] rounded">取消</button>
              <button onClick={onGS} className="px-3 py-1.5 bg-[#15A85F] text-white text-[13px] rounded">确认</button>
            </div>
          </div>
        </div>
      )}

      {showCS && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCS(false)}>
          <div className="bg-white rounded p-5 w-[360px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-medium mb-3">新增班级级覆盖</div>
            <div className="space-y-2 text-[12px]">
              <div><div className="text-[#9A9A9A] mb-1">年级</div>
                <select value={formCS.grade} onChange={(e) => setFormCS({ ...formCS, grade: e.target.value, class_id: '' })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
              <div><div className="text-[#9A9A9A] mb-1">班级</div>
                <select value={formCS.class_id} onChange={(e) => setFormCS({ ...formCS, class_id: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                  <option value="">请选择</option>{myClasses.filter((m: any) => m.grade === formCS.grade).map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
              <div><div className="text-[#9A9A9A] mb-1">学科</div>
                <select value={formCS.subject} onChange={(e) => setFormCS({ ...formCS, subject: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                  {subjects().map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><div className="text-[#9A9A9A] mb-1">教材版本</div>
                <select value={formCS.version_name} onChange={(e) => setFormCS({ ...formCS, version_name: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                  <option value="">请选择</option>{versionOptions(formCS.subject).map((o) => <option key={o.publisher + '|' + o.version_name} value={o.version_name}>{o.publisher} {o.version_name}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCS(false)} className="px-3 py-1.5 text-[13px] border border-[#E7E7EB] rounded">取消</button>
              <button onClick={onCS} className="px-3 py-1.5 bg-[#15A85F] text-white text-[13px] rounded">确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** V2.6 全学科教材版本库维护（IT 管理员）：数据团队提供数据，在此导入/逐条维护 tb_textbook_version */
function TextbookLibraryAdmin() {
  const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']
  const XUEDUAN = ['小学', '初中', '高中']
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ version_key: '', xue_duan: '小学', nian_ji: '一年级', xue_ke: '语文', jiao_cai_ming: '', chu_ban_she: '', ban_ben_biao_shi: '', ce_bie: '上册', mu_lu_url: '' })
  const [importText, setImportText] = useState('')

  const load = () => adminAPI.listTextbookLibrary().then((r: any) => setItems(r.items || [])).finally(() => setLoading(false))
  useEffect(() => { setLoading(true); load() }, [])

  const openNew = () => { setEditId(null); setForm({ version_key: '', xue_duan: '小学', nian_ji: '一年级', xue_ke: '语文', jiao_cai_ming: '', chu_ban_she: '', ban_ben_biao_shi: '', ce_bie: '上册', mu_lu_url: '' }); setShowForm(true) }
  const openEdit = (v: any) => { setEditId(v.id); setForm({ version_key: v.version_key, xue_duan: v.xue_duan || '小学', nian_ji: v.nian_ji || '一年级', xue_ke: v.xue_ke || '语文', jiao_cai_ming: v.jiao_cai_ming || '', chu_ban_she: v.chu_ban_she || '', ban_ben_biao_shi: v.ban_ben_biao_shi || '', ce_bie: v.ce_bie || '上册', mu_lu_url: v.mu_lu_url || '' }); setShowForm(true) }

  const onSave = async () => {
    if (!form.version_key.trim()) { setMsg('version_key 必填'); return }
    const body = { ...form, version_key: form.version_key.trim() }
    if (editId != null) await adminAPI.updateTextbookVersion(editId, body)
    else await adminAPI.createTextbookVersion(body)
    setShowForm(false); setMsg(editId != null ? '已更新版本' : '已新增版本'); await load()
  }
  const onDelete = async (id: number) => { if (!confirm('确认删除该版本记录？')) return; await adminAPI.deleteTextbookVersion(id); setMsg('已删除'); await load() }

  const onImport = async () => {
    let rows: any[]
    try { rows = JSON.parse(importText) } catch { setMsg('JSON 解析失败，请检查格式'); return }
    if (!Array.isArray(rows)) { setMsg('顶层需为数组'); return }
    const n = await adminAPI.importTextbookVersions(rows).then((r: any) => r.count).catch((e: any) => { setMsg('导入失败：' + (e?.message || '')); return 0 })
    if (n) { setShowImport(false); setImportText(''); setMsg(`已导入/更新 ${n} 条版本`); await load() }
  }

  return (
    <div className="p-5 overflow-auto">
      <div className="text-[13px] font-medium mb-1">全学科教材版本库</div>
      <div className="text-[12px] text-[#9A9A9A] mb-3">
        平台权威版本来源，由数据团队提供数据。可在此逐条维护，或粘贴数据团队交付的 JSON 数组批量导入（按 version_key 更新）。
      </div>
      <div className="flex gap-2 mb-3">
        <button onClick={openNew} className="px-2 py-1 bg-[#02A7F0] text-white text-[12px] rounded">+ 新增版本</button>
        <button onClick={() => setShowImport(true)} className="px-2 py-1 border border-[#E7E7EB] text-[12px] rounded">批量导入（数据团队 JSON）</button>
      </div>
      {loading && <div className="text-[12px] text-[#9A9A9A]">加载中…</div>}
      {!loading && (
        <table className="w-full text-[12px]">
          <thead><tr className="text-left text-[#9A9A9A]"><th className="py-1">学段</th><th>年级</th><th>学科</th><th>教材名</th><th>出版社</th><th>版本</th><th>册别</th><th></th></tr></thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id} className="border-t border-[#F0F0F2]">
                <td className="py-1">{v.xue_duan}</td><td>{v.nian_ji}</td><td>{v.xue_ke}</td><td>{v.jiao_cai_ming}</td><td>{v.chu_ban_she}</td><td>{v.ban_ben_biao_shi}</td><td>{v.ce_bie}</td>
                <td className="text-right whitespace-nowrap">
                  <button onClick={() => openEdit(v)} className="text-[#02A7F0] hover:underline mr-2">编辑</button>
                  <button onClick={() => onDelete(v.id)} className="text-[#E0533D] hover:underline">删除</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="py-1 text-[#9A9A9A]">版本库为空</td></tr>}
          </tbody>
        </table>
      )}
      {msg && <div className="mt-3 text-[12px] text-[#02A7F0]">{msg}</div>}

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-medium mb-3">{editId != null ? '编辑版本' : '新增版本'}</div>
            <div className="space-y-2 text-[12px]">
              <Field label="version_key（唯一）"><input value={form.version_key} disabled={editId != null} onChange={(e) => setForm({ ...form, version_key: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full" /></Field>
              <Field label="学段"><Sel v={form.xue_duan} opts={XUEDUAN} onChange={(v) => setForm({ ...form, xue_duan: v })} /></Field>
              <Field label="年级"><Sel v={form.nian_ji} opts={GRADES} onChange={(v) => setForm({ ...form, nian_ji: v })} /></Field>
              <Field label="学科"><input value={form.xue_ke} onChange={(e) => setForm({ ...form, xue_ke: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full" /></Field>
              <Field label="教材名"><input value={form.jiao_cai_ming} onChange={(e) => setForm({ ...form, jiao_cai_ming: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full" /></Field>
              <Field label="出版社"><input value={form.chu_ban_she} onChange={(e) => setForm({ ...form, chu_ban_she: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full" /></Field>
              <Field label="版本标识"><input value={form.ban_ben_biao_shi} onChange={(e) => setForm({ ...form, ban_ben_biao_shi: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full" /></Field>
              <Field label="册别"><input value={form.ce_bie} onChange={(e) => setForm({ ...form, ce_bie: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full" /></Field>
              <Field label="目录URL"><input value={form.mu_lu_url} onChange={(e) => setForm({ ...form, mu_lu_url: e.target.value })} className="border border-[#E7E7EB] rounded px-2 py-1 w-full" /></Field>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-[13px] border border-[#E7E7EB] rounded">取消</button>
              <button onClick={onSave} className="px-3 py-1.5 bg-[#15A85F] text-white text-[13px] rounded">保存</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded p-5 w-[480px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-medium mb-1">批量导入版本库</div>
            <div className="text-[11px] text-[#9A9A9A] mb-2">粘贴 JSON 数组，每条含 version_key / xue_duan / nian_ji / xue_ke / jiao_cai_ming / chu_ban_she / ban_ben_biao_shi / ce_bie / mu_lu_url。按 version_key 更新。</div>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={10} placeholder='[{"version_key":"小学_数学_人教版_一年级_上册","xue_duan":"小学","nian_ji":"一年级","xue_ke":"数学","jiao_cai_ming":"义务教育教科书·数学","chu_ban_she":"人民教育出版社","ban_ben_biao_shi":"人教版","ce_bie":"上册","mu_lu_url":""}]' className="border border-[#E7E7EB] rounded px-2 py-1 w-full text-[11px] font-mono" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowImport(false)} className="px-3 py-1.5 text-[13px] border border-[#E7E7EB] rounded">取消</button>
              <button onClick={onImport} className="px-3 py-1.5 bg-[#15A85F] text-white text-[13px] rounded">导入</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (<div><div className="text-[#9A9A9A] mb-1">{label}</div>{children}</div>)
}
function Sel({ v, opts, onChange }: { v: string; opts: string[]; onChange: (v: string) => void }) {
  return (<select value={v} onChange={(e) => onChange(e.target.value)} className="border border-[#E7E7EB] rounded px-2 py-1 w-full">{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>)
}

/** 学期配置（合并自 IT 管理后台，云上无独立 IT 角色时由任课教师在个人中心维护） */
function SemesterTab() {
  const [semesters, setSemesters] = useState<any[]>([])
  const [semForm, setSemForm] = useState({ name: '', start_date: '', end_date: '' })
  const [semMsg, setSemMsg] = useState('')

  useEffect(() => {
    adminAPI.listSemesters().then((r: any) => setSemesters(r.items || [])).catch(() => setSemesters([]))
  }, [])

  const onCreateSemester = async () => {
    if (!semForm.name || !semForm.start_date || !semForm.end_date) {
      setSemMsg('请填写学期名称与起止日期'); return
    }
    setSemMsg('')
    try {
      await adminAPI.createSemester(semForm)
      setSemForm({ name: '', start_date: '', end_date: '' })
      setSemMsg('学期已创建')
      const r = await adminAPI.listSemesters().catch(() => ({ items: [] }))
      setSemesters(r.items || [])
    } catch (e: any) { setSemMsg(e.message || '创建失败') }
  }

  return (
    <div className="p-5">
      <div className="text-[13px] font-medium mb-1">学期配置</div>
      <div className="text-[12px] text-[#9A9A9A] mb-4">
        当前学校的学期列表。学期为全校级配置，保存后影响全站上下册判断。
      </div>
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
              <td>{s.created_at ? new Date(s.created_at).toLocaleString() : ''}</td>
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
  )
}

/** 年级序号 → 中文年级名（与 TeachingContext.GRADE_NAMES 对应） */
function GRADE_NUM_TO_NAME(n: number): string {
  const NAMES = ['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级']
  return NAMES[n - 1] || ''
}

function SchoolClassTab() {
  interface School { id: string; fullName: string; shortName: string; classes: Class[]; status: string }
  interface Class { id: string; grade: string; name: string; subjects: string[]; status: string }

  const SC_STORAGE_KEY = 'zhiwei_school_classes'

  const INIT: School[] = [
    { id: 's1', fullName: '成都市金牛区第一小学', shortName: '金牛一小', status: 'active', classes: [
      { id: 'c1', grade: '四年级', name: '1班', subjects: ['语文', '数学'], status: 'active' },
      { id: 'c2', grade: '四年级', name: '2班', subjects: ['语文'], status: 'active' },
      { id: 'c3', grade: '四年级', name: '实验班', subjects: ['语文'], status: 'active' },
    ]},
    { id: 's2', fullName: '成都市金牛区第一小学分校', shortName: '金牛一小分校', status: 'active', classes: [] },
  ]

  const loadPersisted = (): School[] => {
    try {
      const raw = localStorage.getItem(SC_STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    } catch {}
    return INIT
  }

  const [schools, setSchools] = useState<School[]>(loadPersisted)
  const persist = useCallback((data: School[]) => {
    try { localStorage.setItem(SC_STORAGE_KEY, JSON.stringify(data)) } catch {}
  }, [])
  // schools 变化自动落盘到 localStorage，防止硬刷新后数据还原（大问题）
  useEffect(() => { persist(schools) }, [schools, persist])
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'addSchool' | 'editSchool' | 'addClass'>('addSchool')
  const [modalSchoolId, setModalSchoolId] = useState<string | null>(null)
  const [formF, setFormF] = useState({ fullName: '', shortName: '' })
  const [lookupResult, setLookupResult] = useState<any>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const lookupTimer = useRef<any>(null)
  const [formC, setFormC] = useState({ grade: '四年级', name: '', subjects: '语文' })
  const [confirmSave, setConfirmSave] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState<{ schoolId?: string; classId?: string; label: string; count?: number } | null>(null)
  const [editClassTarget, setEditClassTarget] = useState<Class | null>(null)
  const [editSubjects, setEditSubjects] = useState<string[]>([])
  const [editVersions, setEditVersions] = useState<Record<string, string>>({})

  // 教材版本库（供班级编辑时选版本）
  const [tvBooks, setTvBooks] = useState<any[]>([])
  const [tvLoading, setTvLoading] = useState(true)
  const [myPrefs, setMyPrefs] = useState<any[]>([])  // 个人已保存的教材版本偏好（用于编辑时回显）
  const versionOpts = useCallback((subject: string, grade?: string) => {
    const m = new Map<string, { publisher: string; version_name: string }>()
    tvBooks.filter((b: any) => {
      if (b.subject !== subject) return false
      // 版本库按年级过滤：有指定年级则精确匹配，无年级的视为通用（适配所有年级）
      if (grade && b.grade && b.grade !== grade) return false
      return true
    }).forEach((b: any) =>
      m.set(`${b.publisher}|${b.version_name}`, { publisher: b.publisher, version_name: b.version_name }))
    return Array.from(m.values())
  }, [tvBooks])
  const loadVersions = async () => {
    try {
      const [tb, pf] = await Promise.all([
        adminAPI.listTextbooks(),
        teacherPrefAPI.list(),
      ])
      setTvBooks(tb.items || [])
      setMyPrefs(pf.items || [])
    } catch {}
    setTvLoading(false)
  }
  useEffect(() => { loadVersions() }, [])

  const sc: Record<string, string> = { '语文': 'bg-blue-50 text-blue-600', '数学': 'bg-orange-50 text-orange-600', '英语': 'bg-green-50 text-green-600' }

  // 按学段划分学科：小学不出现物理/化学/生物/历史/地理；中学才出现。
  const SUBJECTS_BY_LEVEL: Record<'elementary' | 'middle' | 'high', string[]> = {
    elementary: ['语文', '数学', '英语', '政治', '体育', '音乐', '美术', '信息技术'],
    middle: ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '体育', '音乐', '美术', '信息技术'],
    high: ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '体育', '音乐', '美术', '信息技术'],
  }

  function gradeLevel(grade: string): 'elementary' | 'middle' | 'high' {
    if (['七年级', '八年级', '九年级'].includes(grade)) return 'middle'
    return 'elementary'
  }

  function subjectsForGrade(grade: string): string[] {
    return SUBJECTS_BY_LEVEL[gradeLevel(grade)]
  }

  const handleLookup = useCallback((name: string) => {
    if (!name || name.length < 2) { setLookupResult(null); return }
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    lookupTimer.current = setTimeout(async () => {
      setLookupLoading(true)
      try {
        const res = await api<any>(`/schools/lookup?name=${encodeURIComponent(name)}`)
        setLookupResult(res)
      } catch { setLookupResult(null) }
      setLookupLoading(false)
    }, 400)
  }, [])

  const openModal = (mode: 'addSchool' | 'editSchool' | 'addClass', schoolId?: string) => {
    setModalMode(mode); setModalSchoolId(schoolId || null)
    // 不重置 editClassTarget — 由 doSaveEditClass / ✕按钮各自清理，否则 startEditClass 设置的 target 被抹掉导致编辑UI不显示
    if (mode === 'addSchool') { setFormF({ fullName: '', shortName: '' }); setStep(0) }
    if (mode === 'editSchool' && schoolId) {
      const s = schools.find(s => s.id === schoolId)
      if (s) { setFormF({ fullName: s.fullName, shortName: s.shortName }); setStep(0) }
    }
    if (mode === 'addClass' && schoolId) { setFormC({ grade: '四年级', name: '', subjects: '语文' }); setStep(1) }
    setShowModal(true)
  }

  const [step, setStep] = useState(0)

  const handleSaveSchool = () => {
    if (!formF.fullName.trim()) return
    setConfirmSave(true)
  }

  const doSaveSchool = () => {
    if (modalMode === 'addSchool') {
      // 抢答原则：已存在则认领，否则创建
      const existingId = lookupResult?.found ? lookupResult.school.id : null
      const sid = existingId || `s${Date.now()}`
      if (existingId) {
        // 认领：将已存在的学校加入本地列表
        if (!schools.find(s => s.id === existingId)) {
          setSchools(prev => [...prev, { id: existingId, fullName: formF.fullName, shortName: lookupResult.school.short_name || formF.shortName, status: 'active', classes: [] }])
        }
        setModalSchoolId(existingId)
      } else {
        setSchools(prev => [...prev, { id: sid, fullName: formF.fullName, shortName: formF.shortName || formF.fullName.slice(0, 6), status: 'active', classes: [] }])
        setModalSchoolId(sid)
      }
      if (!formF.shortName) setFormF(prev => ({ ...prev, shortName: formF.fullName.slice(0, 6) }))
      setModalMode('addClass')
      setStep(1)
    } else {
      setSchools(prev => prev.map(s => s.id === modalSchoolId ? { ...s, fullName: formF.fullName, shortName: formF.shortName, status: 'active' } : s))
      setShowModal(false)
    }
    setConfirmSave(false)
  }

  const handleAddClass = () => {
    const name = formC.name.trim()
    if (!name) return
    const sid = modalMode === 'addSchool' ? `s${Date.now()}` : (modalSchoolId || '')
    const school = schools.find(s => s.id === sid)
    // For addSchool mode, we need to create the class after school is saved
    setSchools(prev => prev.map(s => {
      if (s.id !== (modalSchoolId || sid)) return s
      if (s.classes.some(c => c.grade === formC.grade && c.name === name)) return s // duplicate
      return { ...s, classes: [...s.classes, { id: `c${Date.now()}`, grade: formC.grade, name, subjects: formC.subjects.split(/[,，]/).filter(Boolean), status: 'active' }] }
    }))
    setFormC({ grade: '四年级', name: '', subjects: '语文' })
  }

  const handleArchiveSchool = () => {
    if (!confirmArchive?.schoolId) return
    setSchools(prev => prev.map(s => s.id === confirmArchive.schoolId ? { ...s, status: 'archived', classes: s.classes.map(c => ({ ...c, status: 'archived' })) } : s))
    setConfirmArchive(null)
  }

  const handleArchiveClass = () => {
    if (!confirmArchive?.classId) return
    setSchools(prev => prev.map(s => ({
      ...s, classes: s.classes.map(c => c.id === confirmArchive.classId ? { ...c, status: 'archived' } : c)
    })))
    setConfirmArchive(null)
  }

  const startEditClass = (_schoolId: string, cls: Class) => {
    setEditClassTarget(cls)
    setEditSubjects([...cls.subjects])
    // 回显已保存的版本偏好
    const initVer: Record<string, string> = {}
    myPrefs.filter((p: any) => (p.grade || '') === cls.grade && (p.class_id || '') === cls.id).forEach((p: any) => {
      if (p.version_name) initVer[p.subject] = p.version_name
    })
    setEditVersions(initVer)
  }

  const toggleEditSubject = (sub: string) => {
    setEditSubjects(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub])
  }

  const _saveEditClass = () => {
    if (!editClassTarget || !editSubjects.length) return
    const _cls = editClassTarget
    setConfirmSave(true)
  }
  const doSaveEditClass = () => {
    if (!editClassTarget) return
    const cls = editClassTarget
    setSchools(prev => prev.map(s => ({
      ...s, classes: s.classes.map(c => c.id === cls.id ? { ...c, subjects: editSubjects } : c)
    })))
    // 同步保存所选学科的教材版本偏好
    const saves: Promise<void>[] = []
    for (const sub of editSubjects) {
      const ver = editVersions[sub]
      if (ver) {
        const opt = versionOpts(sub, cls.grade).find(o => o.version_name === ver)
        if (opt) saves.push(teacherPrefAPI.upsert({ subject: sub, grade: cls.grade, class_id: cls.id, publisher: opt.publisher, version_name: opt.version_name }).then(() => {}))
      }
    }
    // 保存后重新拉取偏好以便下次编辑回显
    Promise.allSettled(saves).finally(() => {
      teacherPrefAPI.list().then(r => setMyPrefs(r.items || [])).catch(() => {})
    })
    setEditClassTarget(null)
    setConfirmSave(false)
  }

  // Active only
  const activeSchools = useMemo(() => schools.filter(s => s.status === 'active'), [schools])

  return (
    <div>
      <div className="px-5 py-2 flex justify-end">
        <div className="flex items-center gap-3">
          <a href="/school_import_template.csv" download className="text-[10px] text-[#9A9A9A] hover:text-[#02A7F0] border border-dashed border-[#D0D0D0] rounded-[3px] px-2 py-1 flex items-center gap-1" title="下载导入模板">📥 模板</a>
          <button onClick={() => openModal('addSchool')} className="text-[11px] text-[#02A7F0] hover:underline flex items-center gap-1"><Plus size={11} />添加学校</button>
        </div>
      </div>

      {activeSchools.map(s => (
        <div key={s.id} className="border-b border-[#F0F0F0] last:border-0">
          <div className="flex items-center px-5 py-3 bg-[#FAFBFC] border-b border-[#F0F0F0]">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#353535]">{s.fullName}</div>
              <div className="text-[10px] text-[#9A9A9A] mt-0.5">简称：{s.shortName} · {s.classes.filter(c => c.status === 'active').length} 个班级</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => openModal('editSchool', s.id)} className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title="编辑学校"><Pencil size={13} /></button>
              <button onClick={() => setConfirmArchive({ schoolId: s.id, label: s.fullName, count: s.classes.filter(c => c.status === 'active').length })} className="p-1.5 text-[#9A9A9A] hover:text-red-500 hover:bg-red-50 rounded-[3px]" title="归档学校"><Trash2 size={13} /></button>
            </div>
          </div>
          {s.classes.filter(c => c.status === 'active').length > 0 ? s.classes.filter(c => c.status === 'active').map(cls => (
            <div key={cls.id} className="flex items-center px-5 py-2.5 pl-10 border-b border-[#F0F0F0] last:border-0 hover:bg-[#F9FAFB]">
              <div className="flex-1 flex items-center gap-3">
                <span className="text-[12px] text-[#353535] font-medium">{cls.grade}（{cls.name}）</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {cls.subjects.map(sub => <span key={sub} className={`px-1.5 py-0.5 rounded-[2px] text-[10px] ${sc[sub] || 'bg-gray-50'}`}>{sub}</span>)}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { setModalSchoolId(s.id); startEditClass(s.id, cls); openModal('addClass', s.id) }} className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title="编辑班级"><Pencil size={12} /></button>
                <button onClick={() => setConfirmArchive({ classId: cls.id, label: `${cls.grade}（${cls.name}）` })} className="p-1.5 text-[#9A9A9A] hover:text-red-500 hover:bg-red-50 rounded-[3px]" title="归档班级"><Trash2 size={12} /></button>
              </div>
            </div>
          )) : <div className="px-10 py-4 text-[11px] text-[#B0B0B0] border-b border-[#F0F0F0]">暂无班级 — 请在弹窗中配置</div>}
        </div>
      ))}

      {/* ===== 统一弹窗 ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-[8px] shadow-2xl w-[700px] max-h-[80vh] flex flex-col z-10" onClick={e => e.stopPropagation()}>
            {/* Header with tabs */}
            <div className="flex items-center border-b border-[#F0F0F0] shrink-0">
              <button onClick={() => setStep(0)} className={`flex-1 text-center py-2.5 text-[13px] font-medium border-b-2 transition-colors ${step === 0 ? 'text-[#02A7F0] border-[#02A7F0]' : 'text-[#9A9A9A] border-transparent'}`}>① 学校信息</button>
              <button onClick={() => { if (modalSchoolId || modalMode === 'addSchool') setStep(1) }} className={`flex-1 text-center py-2.5 text-[13px] font-medium border-b-2 transition-colors ${step === 1 ? 'text-[#02A7F0] border-[#02A7F0]' : 'text-[#9A9A9A] border-transparent'}`}>② 班级配置</button>
              <button onClick={() => setShowModal(false)} className="ml-auto mr-3 text-[#9A9A9A] hover:text-[#353535] p-1"><X size={16} /></button>
            </div>

            {/* Step 1: School info */}
            {step === 0 && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-[#9A9A9A] mb-1.5">学校全称</label>
                    <input value={formF.fullName} onChange={e => { setFormF({ ...formF, fullName: e.target.value }); handleLookup(e.target.value) }}
                      className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" placeholder="输入学校名称，系统自动匹配" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#9A9A9A] mb-1.5">简称</label>
                    <input value={formF.shortName} onChange={e => setFormF({ ...formF, shortName: e.target.value })}
                      className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" placeholder="金牛一小" />
                  </div>
                </div>
                {lookupLoading && (
                  <p className="text-[11px] text-[#9A9A9A] animate-pulse">🔍 正在搜索学校...</p>
                )}
                {lookupResult?.found && modalMode === 'addSchool' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-[4px] px-3 py-2 text-[12px]">
                    ⚠️ 已存在「{lookupResult.school.full_name}」，保存后将认领该校
                  </div>
                )}
                {lookupResult && !lookupResult.found && formF.fullName.length >= 2 && modalMode === 'addSchool' && (
                  <div className="bg-green-50 border border-green-200 rounded-[4px] px-3 py-2 text-[12px]">
                    ✅ 未匹配到同名学校，将创建新学校
                  </div>
                )}
                {modalMode === 'addSchool' && (
                  <p className="text-[11px] text-[#9A9A9A]">💡 保存学校后可在「② 班级配置」中立即添加班级</p>
                )}
              </div>
            )}

            {/* Step 2: Class management */}
            {step === 1 && modalSchoolId && (
              <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-[200px]">
                {/* Add class form */}
                <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-[#F0F0F0]">
                  <select value={formC.grade} onChange={e => setFormC({ ...formC, grade: e.target.value })}
                    className="px-2 py-1.5 text-[13px] border border-[#E7E7EB] rounded-[3px] outline-none">
                    {['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级'].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input placeholder="班级名称" value={formC.name} onChange={e => setFormC({ ...formC, name: e.target.value })}
                    className="px-2.5 py-1.5 text-[13px] border border-[#E7E7EB] rounded-[3px] outline-none focus:border-[#02A7F0] w-[120px]" />
                  <input placeholder="学科如:语文" value={formC.subjects} onChange={e => setFormC({ ...formC, subjects: e.target.value })}
                    className="px-2.5 py-1.5 text-[13px] border border-[#E7E7EB] rounded-[3px] outline-none focus:border-[#02A7F0] w-[140px]" />
                  <button onClick={handleAddClass}
                    className="px-3 py-1.5 text-[11px] text-white bg-[#02A7F0] rounded-[3px] hover:bg-[#0288D1]"><Plus size={10} />添加</button>
                </div>

                {/* Existing classes */}
                {schools.find(s => s.id === modalSchoolId)?.classes.filter(c => c.status === 'active').map(cls => (
                  <div key={cls.id} className="flex items-center border border-[#F0F0F0] rounded-[4px] p-2.5">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[#353535]">{cls.grade}（{cls.name}）</span>
                      {editClassTarget?.id === cls.id ? (
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="flex items-center gap-1 flex-wrap">
                            {subjectsForGrade(cls.grade).map(sub => (
                              <button key={sub} onClick={() => toggleEditSubject(sub)}
                                className={`px-2 py-0.5 text-[11px] rounded-[3px] border transition-colors ${editSubjects.includes(sub) ? 'bg-[#02A7F0] text-white border-[#02A7F0]' : 'bg-white text-[#353535] border-[#E7E7EB] hover:border-[#02A7F0]'}`}>{sub}</button>
                            ))}
                          </div>
                          {editSubjects.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="text-[#9A9A9A]">版本：</span>
                              {tvLoading ? <span className="text-[#9A9A9A]">加载中...</span> : (
                                editSubjects.map(sub => {
                                  const opts = versionOpts(sub, cls.grade)
                                  if (opts.length === 0) return <span key={sub} className="text-[#9A9A9A]">{sub} 无版本库</span>
                                  return <label key={sub} className="flex items-center gap-1">
                                    <span className="text-[#353535] w-10">{sub}</span>
                                    <select value={editVersions[sub] || ''} onChange={e => setEditVersions(prev => ({ ...prev, [sub]: e.target.value }))}
                                      className="px-1.5 py-0.5 border border-[#E7E7EB] rounded-[3px] text-[11px] focus:outline-none focus:border-[#02A7F0]">
                                      <option value="">默认</option>
                                      {opts.map(o => <option key={o.version_name} value={o.version_name}>{o.publisher} {o.version_name}</option>)}
                                    </select>
                                  </label>
                                })
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <button onClick={() => doSaveEditClass()} className="text-[10px] text-green-600">✓ 保存</button>
                            <button onClick={() => setEditClassTarget(null)} className="text-[10px] text-[#9A9A9A]">✕ 取消</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-wrap">
                          {cls.subjects.map(sub => <span key={sub} className={`px-1.5 py-0.5 rounded-[2px] text-[10px] ${sc[sub] || 'bg-gray-50'}`}>{sub}</span>)}
                          <button onClick={() => startEditClass(modalSchoolId, cls)} className="p-0.5 text-[#9A9A9A] hover:text-[#02A7F0]" title="编辑学科"><Pencil size={10} /></button>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setConfirmArchive({ classId: cls.id, label: `${cls.grade}（${cls.name}）` })}
                      className="p-1 text-[#9A9A9A] hover:text-red-500 ml-2" title="归档班级"><Trash2 size={12} /></button>
                  </div>
                )) || <p className="text-[11px] text-[#B0B0B0] text-center py-4">暂无班级，使用上方表单添加</p>}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-3 border-t border-[#F0F0F0] flex justify-end gap-2 shrink-0">
              {step === 0 && (
                <>
                  <button onClick={() => setShowModal(false)} className="px-4 py-1.5 text-[12px] border rounded-[4px]">取消</button>
                  <button onClick={handleSaveSchool} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px]">
                    {modalMode === 'addSchool' ? '保存并配置班级' : '保存修改'}
                  </button>
                </>
              )}
              {step === 1 && editClassTarget && (
                <>
                  <button onClick={() => setEditClassTarget(null)} className="px-4 py-1.5 text-[12px] border rounded-[4px]">取消</button>
                  <button onClick={doSaveEditClass} className="px-4 py-1.5 text-[12px] text-white bg-[#15A85F] rounded-[4px]">保存</button>
                </>
              )}
              {step === 1 && !editClassTarget && (
                <button onClick={() => setShowModal(false)} className="px-4 py-1.5 text-[12px] border rounded-[4px]">关闭</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 保存学校确认 */}
      {confirmSave && step === 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setConfirmSave(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-[6px] shadow-xl w-[360px] z-10" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <p className="text-[13px] text-[#353535] mb-1">确认{modalMode === 'addSchool' ? '添加学校' : '修改学校信息'}？</p>
              <p className="text-[11px] text-[#9A9A9A]">{modalMode === 'addSchool' ? '保存后可立即配置班级' : '名称修改将立即生效'}</p>
            </div>
            <div className="px-5 py-3 border-t border-[#F0F0F0] flex justify-end gap-2">
              <button onClick={() => setConfirmSave(false)} className="px-4 py-1.5 text-[12px] border rounded-[4px]">取消</button>
              <button onClick={doSaveSchool} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px]">确认保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 归档确认 */}
      {confirmArchive && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setConfirmArchive(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-[6px] shadow-xl w-[420px] z-10" onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 text-lg">⚠</span>
                <p className="text-[13px] font-medium text-[#353535]">归档{confirmArchive.schoolId ? '学校' : '班级'}</p>
              </div>
              {confirmArchive.schoolId && (
                <p className="text-[12px] text-[#353535]">将归档「{confirmArchive.label}」及其全部 {confirmArchive.count} 个班级。</p>
              )}
              {confirmArchive.classId && (
                <p className="text-[12px] text-[#353535]">将归档「{confirmArchive.label}」，该班关怀方案将同时停止。</p>
              )}
              <p className="text-[10px] text-[#9A9A9A] mt-2">归档后数据保留、不可恢复。如需再次使用请重新添加。</p>
              <p className="text-[10px] text-red-500 mt-1">⚠ 归档将影响：教案互审、作业收发、成长关爱方案</p>
            </div>
            <div className="px-5 py-3 border-t border-[#F0F0F0] flex justify-end gap-2">
              <button onClick={() => setConfirmArchive(null)} className="px-4 py-1.5 text-[12px] border rounded-[4px]">取消</button>
              <button onClick={() => confirmArchive.schoolId ? handleArchiveSchool() : handleArchiveClass()}
                className="px-4 py-1.5 text-[12px] text-white bg-red-500 rounded-[4px] hover:bg-red-600">确认归档</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑班级保存确认 */}
      {confirmSave && editClassTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setConfirmSave(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-[6px] shadow-xl w-[360px] z-10" onClick={e => e.stopPropagation()}>
            <div className="p-5"><p className="text-[13px] text-[#353535]">确认修改「{editClassTarget.grade}（{editClassTarget.name}）」的学科？</p></div>
            <div className="px-5 py-3 border-t border-[#F0F0F0] flex justify-end gap-2">
              <button onClick={() => setConfirmSave(false)} className="px-4 py-1.5 text-[12px] border rounded-[4px]">取消</button>
              <button onClick={doSaveEditClass} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px]">确认修改</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function TrainXiaoWeiTab() {
  const [step, setStep] = useState(0)
  const [messages, setMessages] = useState<{ from: 'xw' | 'teacher'; text: string; type?: 'upload' | 'paste' | 'summary' | 'confirm' }[]>([])
  const [inputText, setInputText] = useState('')
  const [uploaded, setUploaded] = useState({ lessonPlan: false, comments: false, reflection: false })

  const startTrain = () => {
    setStep(1)
    setMessages([{ from: 'xw', text: '太好了！首先请上传一份您自己写的教案，Word或PDF都可以，我会学习您的结构偏好和语言风格。', type: 'upload' }])
  }

  const handleAction = (type: 'lessonPlan' | 'comments' | 'reflection') => {
    const files: Record<string, string> = { lessonPlan: '张老师_四年级语文_观潮_教案.docx', comments: '学生评语（5条）.txt', reflection: '观潮课后反思.txt' }
    const nextMsgs: Record<string, string> = {
      lessonPlan: '已收到您的教案。这份教案教学目标用了"理解""掌握"等动词，教学过程偏重四环节结构。我会记住这些特点。接下来请贴几条您平时给学生写的评语，3-5条就可以，不用写姓名。',
      comments: '已收到评语。您的评语习惯是先肯定具体表现，再以"如果能…"的方式提出建议。请再贴一份课后反思吧，几百字就可以。',
      reflection: '已收到反思。您偏重关注学生理解情况，改进建议具体可操作。综合评估已完成——',
    }
    setUploaded(prev => ({ ...prev, [type]: true }))
    setMessages(prev => [...prev, { from: 'teacher', text: `📎 ${files[type]} ✅` }, { from: 'xw', text: nextMsgs[type] }])
    const newStep = type === 'lessonPlan' ? 2 : type === 'comments' ? 3 : 4
    setStep(newStep)
    if (type === 'reflection') {
      setTimeout(() => setMessages(prev => [...prev, { from: 'xw', text: `风格置信度 85% · 已比较了解您的风格。以下是您的风格摘要:\n\n📝 教案风格：目标表述清晰可测，四环节结构，过渡语自然衔接\n✏️ 评语风格：先鼓励后建议，语气亲切温和\n📖 反思风格：关注学生表现，改进建议具体可操作\n\n综合判断：语言风格偏亲切温和，教学目标表述清晰可测。`, type: 'summary' }]), 1200)
    }
  }

  return (
    <div className="absolute inset-0 flex justify-center">
      <div className="w-[75%] max-w-[750px] h-full flex flex-col rounded-t-[7px] overflow-hidden relative"
        style={{ background: 'linear-gradient(to bottom, #E5E5E5, #FFFFFF)', boxShadow: '0px 1px 5px rgba(0,0,0,0.35)' }}>

        <div className="overflow-y-auto p-6 pt-10" style={{ height: 'calc(100% - 132px)' }}>
          {step === 0 ? (
            <div className="flex flex-col max-w-[700px] mx-auto">
              <div>
                <div className="w-[63px] h-[63px] rounded-full overflow-hidden border border-[#E7E7EB] shrink-0">
                  <img src="/xiaowei.png" alt="小微" className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjMiIGhlaWdodD0iNjMiIHZpZXdCb3g9IjAgMCA2MyA2MyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMS41IiBjeT0iMzEuNSIgcj0iMzEuNSIgZmlsbD0iI0VDRUNFQyIvPjxwYXRoIGQ9Ik0zMS41IDMzLjVDMzYuMSAzMy41IDM5LjggMjkuOCAzOS44IDI1LjIgMzkuOCAyMC42IDM2LjEgMTYuOCAzMS41IDE2LjggMjYuOSAxNi44IDIzLjIgMjAuNiAyMy4yIDI1LjIgMjMuMiAyOS44IDI2LjkgMzMuNSAzMS41IDMzLjVaIiBmaWxsPSIjOUE5QTlBIi8+PHBhdGggZD0iTTQ2LjcgNDYuN0M0Ni43IDM5LjUgMzkuNyAzMy43IDMxLjUgMzMuNyAyMy4zIDMzLjcgMTYuMyAzOS41IDE2LjMgNDYuN1Y0OC4zSDQ2LjdWNDYuN1oiIGZpbGw9IiM5QTlBOUEiLz48L3N2Zz4=' }} />
                </div>
              </div>
              <p className="mt-7 text-[16px] font-bold text-[#353535] leading-relaxed">Hi，我是小薇。在帮您备课、出题之前，我需要了解一下您的教学风格…&nbsp;&nbsp;&nbsp;<span className="text-[#FF6B6B]">♥♥♥</span></p>
              <p className="mt-[60px] text-[13px] text-[#353535]">初次见面，让我们先互相了解一下吧！</p>
              <div className="mt-4 space-y-4 w-full">
                {['传一份您自己写的教案吧，Word或PDF都可以，我来学习您的备课习惯', '贴几条您给学生写的评语，不用写姓名，我想学学您的表达风格', '随便写一段课后反思，或者贴一份您写过的，让我了解一下您的教学思考'].map((text, i) => (
                  <button key={i} onClick={() => { startTrain(); setTimeout(() => handleAction(['lessonPlan', 'comments', 'reflection'][i] as 'lessonPlan' | 'comments' | 'reflection'), 300) }}
                    className="w-full h-[50px] flex items-center bg-transparent border rounded-[150px] text-left hover:border-[#02A7F0]/40 hover:shadow-sm transition-all group"
                    style={{ borderColor: 'rgba(169, 162, 158, 0.47)' }}>
                    <div className="w-6 h-6 ml-[25px] flex items-center justify-center shrink-0">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M12 5L6 11M12 5L18 11" stroke="#02A7F0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                    <p className="flex-1 text-[13px] text-[#353535] ml-[10px]">{text}</p>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mr-[25px]"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-[700px] mx-auto">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#F0F0F0] flex items-center justify-center shrink-0 overflow-hidden border border-[#E7E7EB] mt-0.5">
                  <img src="/xiaowei.png" alt="" className="w-full h-full object-cover rounded-full"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
                <div className="inline-block max-w-[85%] rounded-[6px] px-3.5 py-2.5 bg-white border border-[#E7E7EB] text-[12px] text-[#353535] leading-relaxed whitespace-pre-line">
                  太好了！首先请上传一份您自己写的教案，Word或PDF都可以，我会学习您的结构偏好和语言风格。
                </div>
              </div>
              {messages.map((m, i) => (
                <div key={i} className={`flex items-start gap-2.5 ${m.from === 'teacher' ? 'flex-row-reverse' : ''}`}>
                  {m.from === 'xw' && (
                    <div className="w-7 h-7 rounded-full bg-[#F0F0F0] flex items-center justify-center shrink-0 overflow-hidden border border-[#E7E7EB] mt-0.5">
                      <img src="/xiaowei.png" alt="" className="w-full h-full object-cover rounded-full"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    </div>
                  )}
                  <div className={`inline-block max-w-[85%] rounded-[6px] px-3.5 py-2.5 text-[12px] leading-relaxed whitespace-pre-line ${m.from === 'xw' ? 'bg-white border border-[#E7E7EB] text-[#353535]' : 'bg-[#02A7F0]/10 text-[#353535]'}`}>
                    {m.text}
                    {m.type === 'summary' && (
                      <div className="mt-2.5 flex gap-2"><button className="px-4 py-1.5 text-[11px] text-white bg-[#02A7F0] rounded-[3px] hover:bg-[#0288D1]">确认，没问题</button><button className="px-4 py-1.5 text-[11px] text-[#595959] border border-[#E7E7EB] rounded-[3px] hover:bg-[#F6F7F8]">修改其中一条</button></div>
                    )}
                    {m.type === 'upload' && !uploaded.lessonPlan && (
                      <button onClick={() => handleAction('lessonPlan')} className="mt-2.5 inline-flex items-center gap-2 px-4 py-2 bg-white border border-dashed border-[#02A7F0] text-[#02A7F0] rounded-[6px] text-[12px] hover:bg-blue-50">📎 上传教案</button>
                    )}
                  </div>
                </div>
              ))}
              {step === 2 && !uploaded.comments && (
                <div className="flex items-start gap-2.5 pl-10">
                  <button onClick={() => handleAction('comments')} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-dashed border-[#02A7F0] text-[#02A7F0] rounded-[6px] text-[12px] hover:bg-blue-50">✏️ 贴几条评语</button>
                </div>
              )}
              {step === 3 && !uploaded.reflection && (
                <div className="flex items-start gap-2.5 pl-10">
                  <button onClick={() => handleAction('reflection')} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-dashed border-[#02A7F0] text-[#02A7F0] rounded-[6px] text-[12px] hover:bg-blue-50">✏️ 写一段反思</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="absolute left-0 right-0 px-5 h-[120px] flex items-center justify-center" style={{ bottom: '12px' }}>
          <div className="w-[730px] h-[50px]">
            <div className="flex items-center gap-3 px-5 h-full border rounded-[48px] bg-white" style={{ borderColor: 'rgba(169, 162, 158, 1)', boxShadow: '0px 1px 5px rgba(0,0,0,0.35)' }}>
              <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder="输入消息…" className="flex-1 text-[13px] text-[#353535] outline-none bg-transparent" />
              <button className="shrink-0 text-[#B0B0B0] hover:text-[#353535] p-1"><svg width="18" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg></button>
              <button className="shrink-0 w-[30px] h-[30px] rounded-full bg-[#9A9A9A] flex items-center justify-center text-white hover:bg-[#02A7F0] transition-colors"><svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="13" y1="2" x2="6" y2="9" /><polygon points="13,2 8,13 6,9 2,6 13,2" /></svg></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LogFeedbackTab() {
  const [uploaded, setUploaded] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState({ type: '功能建议', content: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.txt,.log,.zip'
    input.onchange = () => { if (input.files?.length) { setUploaded(true); setTimeout(() => setUploaded(false), 3000) } }
    input.click()
  }

  const submitFeedback = () => {
    if (!feedback.content.trim()) return
    setSubmitted(true); setShowFeedback(false)
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <div>
      <div className="p-5 space-y-3">
        {/* 上传日志 */}
        <div className="flex items-center justify-between py-3 px-4 border border-[#F0F0F0] rounded-[4px] hover:border-[#E7E7EB]">
          <div><div className="text-[13px] font-medium text-[#353535]">上传日志</div><div className="text-[11px] text-[#9A9A9A] mt-0.5">遇到问题时上传操作日志，帮助技术团队排查问题</div></div>
          <button onClick={handleUpload} className="px-4 py-1.5 text-[12px] text-[#02A7F0] border border-[#02A7F0]/30 rounded-[4px] hover:bg-[#02A7F0]/5 shrink-0 flex items-center gap-1.5">
            <Upload size={12} />{uploaded ? '已上传 ✓' : '选择文件'}
          </button>
        </div>

        {/* 意见反馈 */}
        <div className="flex items-center justify-between py-3 px-4 border border-[#F0F0F0] rounded-[4px] hover:border-[#E7E7EB]">
          <div><div className="text-[13px] font-medium text-[#353535]">意见反馈</div><div className="text-[11px] text-[#9A9A9A] mt-0.5">提交功能建议或使用体验反馈，帮助我们变得更好</div></div>
          <button onClick={() => setShowFeedback(true)} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] shrink-0">
            {submitted ? '已提交 ✓' : '写反馈'}
          </button>
        </div>

        {/* 反馈弹窗 */}
        {showFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowFeedback(false)}>
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative bg-white rounded-[6px] shadow-xl w-[480px] max-w-[90vw] z-10" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-3 border-b border-[#F0F0F0] flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#353535]">意见反馈</span>
                <button onClick={() => setShowFeedback(false)} className="text-[#9A9A9A] hover:text-[#353535]"><X size={16} /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[11px] text-[#9A9A9A] mb-1.5">反馈类型</label>
                  <select value={feedback.type} onChange={e => setFeedback({ ...feedback, type: e.target.value })}
                    className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]">
                    <option>功能建议</option><option>Bug反馈</option><option>使用体验</option><option>其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#9A9A9A] mb-1.5">详细描述</label>
                  <textarea value={feedback.content} onChange={e => setFeedback({ ...feedback, content: e.target.value })}
                    placeholder="请详细描述您的建议或遇到的问题..."
                    className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0] resize-none h-[120px]" />
                </div>
              </div>
              <div className="px-5 py-3 border-t border-[#F0F0F0] flex justify-end gap-2">
                <button onClick={() => setShowFeedback(false)} className="px-4 py-1.5 text-[12px] text-[#595959] border border-[#E7E7EB] rounded-[4px] hover:bg-[#F6F7F8]">取消</button>
                <button onClick={submitFeedback} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1]">提交反馈</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
