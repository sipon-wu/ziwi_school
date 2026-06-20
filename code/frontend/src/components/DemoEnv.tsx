import { useState, useEffect } from 'react'
import { Eye, ChevronDown, RotateCcw, X, Sparkles, ArrowRight } from 'lucide-react'

const ROLES = [
  { id: 'teacher', label: '教师视角', desc: '备课/出题/批改' },
  { id: 'principal', label: '校长视角', desc: '全校数据仪表盘' },
  { id: 'director', label: '教务主任', desc: '教案质量/作业完成率' },
  { id: 'parent', label: '家长视角', desc: '孩子作业情况' },
]

const GUIDE_STEPS = [
  { title: '生成一份教案', desc: '点击"教案备课"，输入课题，AI 自动生成结构化教案', target: '' },
  { title: '发布一份作业', desc: '点击"出题组卷"，选择知识点和难度，一键发布到班级', target: '' },
  { title: '查看批阅结果', desc: '点击"批阅管理"，查看 AI 自动批阅的结果', target: '' },
]

export default function DemoEnv() {
  const [role, setRole] = useState('teacher')
  const [showGuide, setShowGuide] = useState(false)
  const [guideStep, setGuideStep] = useState(0)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetPass, setResetPass] = useState('')
  const [showGuideChecked, setShowGuideChecked] = useState(!localStorage.getItem('demo_guide_done'))

  useEffect(() => {
    if (showGuideChecked) setShowGuide(true)
  }, [])

  const closeGuide = () => {
    setShowGuide(false)
    localStorage.setItem('demo_guide_done', '1')
    setShowGuideChecked(false)
  }

  const handleReset = () => {
    if (resetPass === 'reset-demo-data') {
      alert('演示数据已重置，请刷新页面')
      setShowResetModal(false)
      setResetPass('')
    } else {
      alert('密码错误')
    }
  }

  return (
    <>
      {/* 顶部演示横幅 */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          <Eye size={13} />
          <span className="font-medium">演示环境 · 示例学校</span>
          <span className="text-white/60">|
            数据每日 02:00 自动重置
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* 角色切换 */}
          <div className="relative group">
            <button className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded hover:bg-white/20">
              当前: {ROLES.find(r=>r.id===role)?.label}
              <ChevronDown size={11} />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] hidden group-hover:block z-50">
              {ROLES.map(r => (
                <button key={r.id} onClick={() => setRole(r.id)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                    role === r.id ? 'text-[#1A3A6B] font-medium bg-blue-50' : 'text-gray-600'
                  }`}>
                  <div>{r.label}</div>
                  <div className="text-[10px] text-gray-400">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>
          {/* 新手引导 */}
          <button onClick={() => { setGuideStep(0); setShowGuide(true) }}
            className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded hover:bg-white/20">
            <Sparkles size={11} /> 引导
          </button>
          {/* 重置数据 */}
          <button onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded hover:bg-red-400/30">
            <RotateCcw size={11} /> 重置
          </button>
        </div>
      </div>

      {/* 三步引导弹窗 */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-[360px] overflow-hidden">
            <div className="bg-gradient-to-r from-[#1A3A6B] to-[#2B5DA8] px-5 py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Sparkles size={16} /> <span className="font-medium">欢迎体验知微</span></div>
                <button onClick={closeGuide}><X size={16} /></button>
              </div>
            </div>
            <div className="p-5">
              <div className="flex gap-1 mb-4">
                {GUIDE_STEPS.map((_, i) => (
                  <div key={i} className={`flex-1 h-1 rounded-full ${i <= guideStep ? 'bg-[#1A3A6B]' : 'bg-gray-200'}`} />
                ))}
              </div>
              <p className="text-xs text-gray-400 mb-1">步骤 {guideStep+1}/{GUIDE_STEPS.length}</p>
              <h3 className="text-base font-bold text-gray-900 mb-1">{GUIDE_STEPS[guideStep].title}</h3>
              <p className="text-sm text-gray-500 mb-5">{GUIDE_STEPS[guideStep].desc}</p>
              <div className="flex gap-2">
                <button onClick={closeGuide} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg">跳过引导</button>
                {guideStep < GUIDE_STEPS.length - 1 ? (
                  <button onClick={() => setGuideStep(guideStep+1)}
                    className="flex-1 py-2 text-sm bg-[#1A3A6B] text-white rounded-lg flex items-center justify-center gap-1">
                    下一步 <ArrowRight size={14} />
                  </button>
                ) : (
                  <button onClick={closeGuide}
                    className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg">开始体验</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 重置密码弹窗 */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowResetModal(false)}>
          <div className="bg-white rounded-2xl p-6 mx-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">重置演示数据</h3>
            <p className="text-xs text-gray-400 mb-4">所有数据将恢复至初始状态，请输入重置密码</p>
            <input type="password" value={resetPass} onChange={e => setResetPass(e.target.value)}
              placeholder="输入重置密码"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-4"
              onKeyDown={e => e.key === 'Enter' && handleReset()} />
            <div className="flex gap-2">
              <button onClick={() => setShowResetModal(false)} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg">取消</button>
              <button onClick={handleReset} className="flex-1 py-2 text-sm bg-red-500 text-white rounded-lg">确认重置</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
