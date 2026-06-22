import { useState, useEffect } from 'react'
import { Eye, ChevronDown, RotateCcw, X, Sparkles, ArrowRight, Shield, Clock } from 'lucide-react'
import api from '../lib/api'

type WorkMode = 'demo' | 'trial' | 'formal'

const MODE_CONFIG: Record<WorkMode, { label: string; color: string; description: string; showReset: boolean; showRoleSwitch: boolean }> = {
  demo:   { label: '演示环境',   color: 'from-amber-500 to-orange-500', description: '数据每日 02:00 自动重置',                       showReset: true,  showRoleSwitch: true },
  trial:  { label: '试用环境',   color: 'from-blue-500 to-cyan-500',    description: '14天免费试用 · 数据保留 · 可申请正式使用',        showReset: false, showRoleSwitch: false },
  formal: { label: '正式环境',   color: 'from-green-500 to-emerald-500', description: '学校正式生产环境',                               showReset: false, showRoleSwitch: false },
}

const ROLES = [
  { id: 'teacher', label: '教师视角', desc: '备课/出题/批改' },
  { id: 'principal', label: '校长视角', desc: '全校数据仪表盘' },
  { id: 'director', label: '教务主任', desc: '教案质量/作业完成率' },
  { id: 'parent', label: '家长视角', desc: '孩子作业情况' },
]

// 演示环境引导 (面向快速体验)
const DEMO_GUIDE = [
  { title: '新建一份AI教案', desc: '进入教案备课页面，输入课题名称，AI 自动生成结构化教案', target: '/dashboard/lesson-plans/new' },
  { title: '体验AI出题', desc: '进入出题组卷，选择知识点和难度，AI 一键生成练习题', target: '/dashboard/exercises/new' },
  { title: '查看批阅结果', desc: '进入批阅管理，查看 AI 自动批阅结果，教师可复核调整', target: '/dashboard/grading' },
]

// 试用环境引导 (面向实际体验)
const TRIAL_GUIDE = [
  { title: '创建学校档案', desc: '填写学校基本信息，选择教材版本，锁定教学配置', target: '/dashboard/settings' },
  { title: '导入真实班级', desc: '添加班级和学生名单，让 AI 了解你的教学环境', target: '/dashboard/settings' },
  { title: '生成第一份教案', desc: '选择当前教学进度，输入课题，体验 AI 教案生成', target: '/dashboard/lesson-plans/new' },
  { title: '布置第一次作业', desc: '基于知识点图谱选择出题范围，发布到指定班级', target: '/dashboard/exercises/new' },
  { title: '查看教学报表', desc: '在班级学情页面查看作业完成率和学生掌握度', target: '/dashboard/analytics' },
]

export default function DemoEnv() {
  const [role, setRole] = useState('teacher')
  const [workMode, setWorkMode] = useState<WorkMode>('demo')
  const [showGuide, setShowGuide] = useState(false)
  const [guideStep, setGuideStep] = useState(0)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetPass, setResetPass] = useState('')
  const [showGuideChecked, setShowGuideChecked] = useState(!localStorage.getItem('demo_guide_done'))

  useEffect(() => {
    api.authAPI.me().then((data: any) => {
      if (data?.work_mode) setWorkMode(data.work_mode)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (workMode === 'demo' && showGuideChecked) setTimeout(() => setShowGuide(true), 500)
    // trial 模式也显示引导（首次登录时）
    if (workMode === 'trial' && !localStorage.getItem('trial_guide_done')) setTimeout(() => setShowGuide(true), 500)
  }, [workMode])

  const closeGuide = () => {
    setShowGuide(false)
    if (workMode === 'demo') { localStorage.setItem('demo_guide_done', '1'); setShowGuideChecked(false) }
    if (workMode === 'trial') localStorage.setItem('trial_guide_done', '1')
  }

  const guides = workMode === 'trial' ? TRIAL_GUIDE : DEMO_GUIDE
  const guideTitle = workMode === 'trial' ? '欢迎试用知微' : '欢迎体验知微'

  const handleReset = () => {
    if (resetPass === 'reset-demo-data') {
      alert('演示数据已重置，请刷新页面')
      setShowResetModal(false); setResetPass('')
    } else {
      alert('密码错误')
    }
  }

  return (
    <>
      {/* 模式横幅 */}
      <div className={`bg-gradient-to-r ${MODE_CONFIG[workMode].color} text-white px-4 py-1.5 flex items-center justify-between text-xs shrink-0`}>
        <div className="flex items-center gap-2">
          {workMode === 'demo' ? <Eye size={13} /> : workMode === 'trial' ? <Clock size={13} /> : <Shield size={13} />}
          <span className="font-medium">{MODE_CONFIG[workMode].label}</span>
          <span className="text-white/60">| {MODE_CONFIG[workMode].description}</span>
          {workMode === 'trial' && <span className="text-white/80 text-[10px] ml-1">剩余 14 天</span>}
        </div>
        <div className="flex items-center gap-3">
          {MODE_CONFIG[workMode].showRoleSwitch && (
            <div className="relative group">
              <button className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded hover:bg-white/20">当前: {ROLES.find(r=>r.id===role)?.label}<ChevronDown size={11} /></button>
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] hidden group-hover:block z-50">
                {ROLES.map(r => (
                  <button key={r.id} onClick={() => setRole(r.id)} className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${role===r.id?'text-brand font-medium bg-blue-50':'text-gray-600'}`}>
                    <div>{r.label}</div><div className="text-[10px] text-gray-400">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => { setGuideStep(0); setShowGuide(true) }} className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded hover:bg-white/20"><Sparkles size={11} />引导</button>
          {MODE_CONFIG[workMode].showReset && (
            <button onClick={() => setShowResetModal(true)} className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded hover:bg-red-400/30"><RotateCcw size={11} />重置</button>
          )}
        </div>
      </div>

      {/* 引导弹窗 */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] overflow-hidden">
            <div className="bg-gradient-to-r from-[#1A3A6B] to-[#2B5DA8] px-5 py-4 text-white">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Sparkles size={16} /><span className="font-medium">{guideTitle}</span></div><button onClick={closeGuide}><X size={16} /></button></div>
            </div>
            <div className="p-5">
              <div className="flex gap-1 mb-4">{guides.map((_,i)=>(<div key={i} className={`flex-1 h-1 rounded-full ${i<=guideStep?'bg-brand':'bg-gray-200'}`}/>))}</div>
              <p className="text-xs text-gray-400 mb-1">步骤 {guideStep+1}/{guides.length}</p>
              <h3 className="text-base font-bold text-gray-900 mb-1">{guides[guideStep].title}</h3>
              <p className="text-sm text-gray-500 mb-5">{guides[guideStep].desc}</p>
              <div className="flex gap-2">
                <button onClick={closeGuide} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg">跳过引导</button>
                {guideStep < guides.length-1 ? (
                  <a href={guides[guideStep].target} onClick={() => { if(guideStep<guides.length-1)setGuideStep(guideStep+1) }} className="flex-1 py-2 text-sm bg-brand text-white rounded-lg flex items-center justify-center gap-1 text-center no-underline">下一步 <ArrowRight size={14} /></a>
                ) : (
                  <a href={guides[guideStep].target} onClick={closeGuide} className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg text-center no-underline">开始使用</a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 重置弹窗 */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={()=>setShowResetModal(false)}>
          <div className="bg-white rounded-2xl p-6 mx-8 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">重置演示数据</h3>
            <p className="text-xs text-gray-400 mb-4">所有数据恢复初始状态，请输入重置密码</p>
            <input type="password" value={resetPass} onChange={e=>setResetPass(e.target.value)} placeholder="输入重置密码" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-4" onKeyDown={e=>e.key==='Enter'&&handleReset()}/>
            <div className="flex gap-2"><button onClick={()=>setShowResetModal(false)} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg">取消</button><button onClick={handleReset} className="flex-1 py-2 text-sm bg-red-500 text-white rounded-lg">确认重置</button></div>
          </div>
        </div>
      )}
    </>
  )
}
