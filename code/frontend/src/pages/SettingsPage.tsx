import { useState } from 'react'
import { Pencil, Plus, Trash2, Copy, Check, X, Upload } from 'lucide-react'
import AppLayout from '../components/AppLayout'

type SubTab = 'account' | 'school' | 'train' | 'log'

export default function SettingsPage() {
  const [subTab, setSubTab] = useState<SubTab>('account')

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0">
          <h1 className="text-[24px] font-bold text-[#353535]">系统设置</h1>
        </div>
        <div className="flex items-center gap-2.5 mt-4 shrink-0">
          {['帐号设置', '学校 · 班级', '训练小微', '日志 · 反馈'].map((label, i) => {
            const ids: SubTab[] = ['account', 'school', 'train', 'log']
            const id = ids[i]
            return (
              <button key={id} onClick={() => setSubTab(id)}
                className={`px-4 h-[38px] text-[13px] rounded-[5px] transition-colors flex items-center justify-center
                  ${subTab === id ? 'bg-[#D7D7D7] text-[#000000]' : 'bg-[#F6F7F8] text-[#7F7F7F] hover:text-[#353535]'}`}>{label}</button>
            )
          })}
        </div>

        <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden flex-1 mt-4 min-h-0 flex flex-col">
          {subTab === 'account' && <AccountTab />}
          {subTab === 'school' && <SchoolClassTab />}
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
      reader.onload = () => { setAvatarSrc(reader.result as string); setAvatarMsg('头像已更新'); setTimeout(() => setAvatarMsg(''), 2000) }
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
      <div className="px-5 py-3 border-t border-[#F0F0F0] flex items-center gap-2 text-[11px]">
        <button className="text-[#02A7F0] hover:underline">帐号移交</button>
      </div>
    </div>
  )
}

function SchoolClassTab() {
  interface School { id: string; fullName: string; shortName: string; classes: Class[]; status: string }
  interface Class { id: string; grade: string; name: string; subjects: string[]; status: string }

  const INIT: School[] = [
    { id: 's1', fullName: '成都市金牛区第一小学', shortName: '金牛一小', status: 'active', classes: [
      { id: 'c1', grade: '四年级', name: '1班', subjects: ['语文', '数学'], status: 'active' },
      { id: 'c2', grade: '四年级', name: '2班', subjects: ['语文'], status: 'active' },
      { id: 'c3', grade: '四年级', name: '实验班', subjects: ['语文'], status: 'active' },
    ]},
    { id: 's2', fullName: '成都市金牛区第一小学分校', shortName: '金牛一小分校', status: 'active', classes: [] },
  ]

  const [schools, setSchools] = useState<School[]>(INIT)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'addSchool' | 'editSchool' | 'addClass'>('addSchool')
  const [modalSchoolId, setModalSchoolId] = useState<string | null>(null)
  const [formF, setFormF] = useState({ fullName: '', shortName: '' })
  const [formC, setFormC] = useState({ grade: '四年级', name: '', subjects: '语文' })
  const [confirmSave, setConfirmSave] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState<{ schoolId?: string; classId?: string; label: string; count?: number } | null>(null)
  const [editClassTarget, setEditClassTarget] = useState<Class | null>(null)
  const [editSubjects, setEditSubjects] = useState<string[]>([])

  const sc: Record<string, string> = { '语文': 'bg-blue-50 text-blue-600', '数学': 'bg-orange-50 text-orange-600', '英语': 'bg-green-50 text-green-600' }
  const ALL_SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '音乐', '美术', '体育', '信息技术']

  const openModal = (mode: 'addSchool' | 'editSchool' | 'addClass', schoolId?: string) => {
    setModalMode(mode); setModalSchoolId(schoolId || null); setEditClassTarget(null)
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
      setSchools(prev => [...prev, { id: `s${Date.now()}`, fullName: formF.fullName, shortName: formF.shortName || formF.fullName.slice(0, 6), status: 'active', classes: [] }])
      if (!formF.shortName) setFormF(prev => ({ ...prev, shortName: formF.fullName.slice(0, 6) }))
      setModalMode('addClass')
      // After adding, switch to step 2 for class config
      const newSchoolId = `s${Date.now()}`
      setModalSchoolId(newSchoolId)
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

  const startEditClass = (schoolId: string, cls: Class) => {
    setEditClassTarget(cls)
    setEditSubjects([...cls.subjects])
  }

  const toggleEditSubject = (sub: string) => {
    setEditSubjects(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub])
  }

  const saveEditClass = () => {
    if (!editClassTarget || !editSubjects.length) return
    const cls = editClassTarget
    setConfirmSave(true)
  }
  const doSaveEditClass = () => {
    if (!editClassTarget) return
    const cls = editClassTarget
    setSchools(prev => prev.map(s => ({
      ...s, classes: s.classes.map(c => c.id === cls.id ? { ...c, subjects: editSubjects } : c)
    })))
    setEditClassTarget(null)
    setConfirmSave(false)
  }

  // Active only
  const activeSchools = useMemo(() => schools.filter(s => s.status === 'active'), [schools])

  return (
    <div>
      <div className="px-5 py-2 flex justify-end">
        <button onClick={() => openModal('addSchool')} className="text-[11px] text-[#02A7F0] hover:underline flex items-center gap-1"><Plus size={11} />添加学校</button>
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
                    <input value={formF.fullName} onChange={e => setFormF({ ...formF, fullName: e.target.value })}
                      className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" placeholder="成都市金牛区第一小学" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#9A9A9A] mb-1.5">简称</label>
                    <input value={formF.shortName} onChange={e => setFormF({ ...formF, shortName: e.target.value })}
                      className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" placeholder="金牛一小" />
                  </div>
                </div>
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
                    {['一年级','二年级','三年级','四年级','五年级','六年级'].map(g => <option key={g} value={g}>{g}</option>)}
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
                        <div className="flex-1 flex items-center gap-1 flex-wrap">
                          {ALL_SUBJECTS.map(sub => (
                            <button key={sub} onClick={() => toggleEditSubject(sub)}
                              className={`px-2 py-0.5 text-[11px] rounded-[3px] border transition-colors ${editSubjects.includes(sub) ? 'bg-[#02A7F0] text-white border-[#02A7F0]' : 'bg-white text-[#353535] border-[#E7E7EB] hover:border-[#02A7F0]'}`}>{sub}</button>
                          ))}
                          <button onClick={() => doSaveEditClass()} className="ml-1 text-[10px] text-green-600">✓</button>
                          <button onClick={() => setEditClassTarget(null)} className="text-[10px] text-[#9A9A9A]">✕</button>
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
              <button onClick={() => setShowModal(false)} className="px-4 py-1.5 text-[12px] border rounded-[4px]">关闭</button>
              {step === 0 && (
                <button onClick={handleSaveSchool} className="px-4 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px]">
                  {modalMode === 'addSchool' ? '保存并配置班级' : '保存修改'}
                </button>
              )}
              {step === 1 && <span className="text-[11px] text-[#9A9A9A] self-center mr-auto">班级修改即时生效</span>}
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
