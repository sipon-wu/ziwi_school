import { useState } from 'react'
import { Pencil, Plus, Trash2, Copy } from 'lucide-react'
import AppLayout from '../components/AppLayout'

type SubTab = 'account' | 'school' | 'train' | 'log'

export default function SettingsPage() {
  const [subTab, setSubTab] = useState<SubTab>('account')

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-[24px] font-bold text-[#353535]">系统设置</h1>
        </div>

        <div className="flex items-center gap-2.5">
          {['帐号设置', '学校 · 班级', '训练小微', '日志 · 反馈'].map((label, i) => {
            const ids: SubTab[] = ['account', 'school', 'train', 'log']
            const id = ids[i]
            return (
              <button key={id}
                onClick={() => setSubTab(id)}
                className={`px-4 h-[38px] text-[13px] rounded-[5px] transition-colors flex items-center justify-center
                  ${subTab === id ? 'bg-[#D7D7D7] text-[#000000]' : 'bg-[#F6F7F8] text-[#7F7F7F] hover:text-[#353535]'}`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
          {subTab === 'account' && <AccountTab />}
          {subTab === 'school' && <SchoolClassTab />}
          {subTab === 'train' && <TrainXiaoWeiTab />}
          {subTab === 'log' && <LogFeedbackTab />}
        </div>
      </div>
    </AppLayout>
  )
}

function AccountTab() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') || {} } catch { return {} } })()
  const userName = user.name || '张真真'
  const userPhone = user.phone || '13800000002'
  const initial = userName.charAt(0)

  const rows = [
    { label: '用户ID', value: user.id || 'js_dc9d03f944a22b7dcb', action: 'copy' as const },
    { label: '名称', value: userName, action: 'edit' as const },
    { label: '姓别', value: '女', action: 'edit' as const },
    { label: '手机号', value: userPhone, action: 'edit' as const },
    { label: '登录邮箱', value: '123456789@qq.com', action: 'edit' as const },
    { label: '地区', value: '中国 四川 成都', action: 'edit' as const },
  ]

  return (
    <div>
      <div className="flex items-center border-b border-[#F0F0F0]">
        <span className="w-[120px] shrink-0 px-5 py-3 text-[12px] text-[#9A9A9A]">头像</span>
        <div className="flex-1 py-3 pr-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#02A7F0] flex items-center justify-center text-white text-[15px] font-bold">{initial}</div>
          <button className="text-[11px] text-[#02A7F0] hover:underline">修改</button>
        </div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center border-b border-[#F0F0F0] last:border-0">
          <span className="w-[120px] shrink-0 px-5 py-3 text-[12px] text-[#9A9A9A]">{r.label}</span>
          <span className="flex-1 py-3 pr-4 text-[13px] text-[#353535]">{r.value}</span>
          <div className="pr-5 flex items-center gap-3 shrink-0">
            <button className="text-[11px] text-[#02A7F0] hover:underline flex items-center gap-1">
              {r.action === 'copy' && <Copy size={11} />}
              {r.action === 'copy' ? '复制' : '修改'}
            </button>
            <div className="w-[18px] h-[18px] rounded-full border border-[#D0D0D0] flex items-center justify-center text-[9px] text-[#9A9A9A] cursor-help font-medium">？</div>
          </div>
        </div>
      ))}
      <div className="px-5 py-3 border-t border-[#F0F0F0] flex items-center gap-2 text-[11px]">
        <button className="text-[#02A7F0] hover:underline">帐号移交</button>
      </div>
    </div>
  )
}

function SchoolClassTab() {
  const [schools] = useState([
    {
      id: 's1', fullName: '成都市金牛区第一小学', shortName: '金牛一小',
      classes: [
        { id: 'c1', grade: '四年级', name: '1班', subjects: ['语文', '数学'] },
        { id: 'c2', grade: '四年级', name: '2班', subjects: ['语文'] },
        { id: 'c3', grade: '四年级', name: '实验班', subjects: ['语文'] },
      ],
    },
    {
      id: 's2', fullName: '成都市金牛区第一小学分校', shortName: '金牛一小分校',
      classes: [],
    },
  ])

  const subjectColors: Record<string, string> = { '语文': 'bg-blue-50 text-blue-600', '数学': 'bg-orange-50 text-orange-600', '英语': 'bg-green-50 text-green-600' }

  return (
    <div>
      <div className="px-5 py-2 flex justify-end">
        <button className="text-[11px] text-[#02A7F0] hover:underline flex items-center gap-1"><Plus size={11} />添加学校</button>
      </div>
      {schools.map(school => (
        <div key={school.id} className="border-b border-[#F0F0F0] last:border-0">
          <div className="flex items-center px-5 py-3 bg-[#FAFBFC] border-b border-[#F0F0F0]">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#353535]">{school.fullName}</div>
              <div className="text-[10px] text-[#9A9A9A] mt-0.5">简称：{school.shortName}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title="编辑学校"><Pencil size={13} /></button>
              <button className="p-1.5 text-[#9A9A9A] hover:text-red-500 hover:bg-red-50 rounded-[3px]" title="删除学校"><Trash2 size={13} /></button>
              <button className="text-[10px] text-[#02A7F0] hover:underline flex items-center gap-0.5 ml-1"><Plus size={10} />添加班级</button>
            </div>
          </div>
          {school.classes.length > 0 ? (
            school.classes.map(cls => (
              <div key={cls.id} className="flex items-center px-5 py-2.5 pl-10 border-b border-[#F0F0F0] last:border-0 hover:bg-[#F9FAFB]">
                <div className="flex-1 flex items-center gap-3">
                  <span className="text-[12px] text-[#353535]">{cls.grade}（{cls.name}）</span>
                  <div className="flex items-center gap-1">
                    {cls.subjects.map(sub => (
                      <span key={sub} className={`px-1.5 py-0.5 rounded-[2px] text-[10px] ${subjectColors[sub] || 'bg-gray-50'}`}>{sub}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="p-1.5 text-[#9A9A9A] hover:text-[#02A7F0] hover:bg-blue-50 rounded-[3px]" title="编辑班级"><Pencil size={12} /></button>
                  <button className="p-1.5 text-[#9A9A9A] hover:text-red-500 hover:bg-red-50 rounded-[3px]" title="删除班级"><Trash2 size={12} /></button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-10 py-4 text-[11px] text-[#B0B0B0] border-b border-[#F0F0F0]">暂未添加班级</div>
          )}
        </div>
      ))}
    </div>
  )
}

function TrainXiaoWeiTab() {
  const [inputText, setInputText] = useState('')

  return (
    <div className="flex justify-center py-6">
      <div 
        className="w-[800px] rounded-t-[7px] overflow-hidden flex flex-col relative"
        style={{
          background: 'linear-gradient(to bottom, #E5E5E5, #FFFFFF)',
          boxShadow: '0px 1px 5px rgba(0,0,0,0.35)',
        }}
      >
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col max-w-[700px] mx-auto">
            <div>
              <div className="w-[63px] h-[63px] rounded-full overflow-hidden border border-[#E7E7EB] shrink-0">
                <img src="/images/avatar-xiaowei.png" alt="小微" className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjMiIGhlaWdodD0iNjMiIHZpZXdCb3g9IjAgMCA2MyA2MyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMS41IiBjeT0iMzEuNSIgcj0iMzEuNSIgZmlsbD0iI0VDRUNFQyIvPjxwYXRoIGQ9Ik0zMS41IDMzLjVDMzYuMSAzMy41IDM5LjggMjkuOCAzOS44IDI1LjIgMzkuOCAyMC42IDM2LjEgMTYuOCAzMS41IDE2LjggMjYuOSAxNi44IDIzLjIgMjAuNiAyMy4yIDI1LjIgMjMuMiAyOS44IDI2LjkgMzMuNSAzMS41IDMzLjVaIiBmaWxsPSIjOUE5QTlBIi8+PHBhdGggZD0iTTQ2LjcgNDYuN0M0Ni43IDM5LjUgMzkuNyAzMy43IDMxLjUgMzMuNyAyMy4zIDMzLjcgMTYuMyAzOS41IDE2LjMgNDYuN1Y0OC4zSDQ2LjdWNDYuN1oiIGZpbGw9IiM5QTlBOUEiLz48L3N2Zz4=' }} />
              </div>
            </div>
            <p className="mt-7 text-[16px] font-bold text-[#353535] leading-relaxed">
              Hi，我是小薇。在帮您备课、出题之前，我需要了解一下您的教学风格…&nbsp;&nbsp;&nbsp;<span className="text-[#FF6B6B]">♥♥♥</span>
            </p>
            <p className="mt-[60px] text-[13px] text-[#353535]">初次见面，让我们先互相了解一下吧！</p>
            <div className="mt-4 space-y-4 w-full">
              {[
                '传一份您自己写的教案吧，Word或PDF都可以，我来学习您的备课习惯',
                '贴几条您给学生写的评语，不用写姓名，我想学学您的表达风格',
                '随便写一段课后反思，或者贴一份您写过的，让我了解一下您的教学思考',
              ].map((text, i) => (
                <button key={i}
                  className="w-full h-[50px] flex items-center bg-transparent border rounded-[150px] text-left hover:border-[#02A7F0]/40 hover:shadow-sm transition-all group"
                  style={{ borderColor: 'rgba(169, 162, 158, 0.47)' }}
                >
                  <div className="w-6 h-6 ml-[25px] flex items-center justify-center shrink-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5V19M12 5L6 11M12 5L18 11" stroke="#02A7F0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="flex-1 text-[13px] text-[#353535] ml-[10px]">{text}</p>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mr-[25px]">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 h-[120px] border-t border-[#E7E7EB] flex items-center justify-center">
          <div className="w-[730px] h-[50px]">
            <div className="flex items-center gap-3 px-5 h-full border rounded-[48px] bg-white" style={{ borderColor: 'rgba(169, 162, 158, 1)', boxShadow: '0px 1px 5px rgba(0,0,0,0.35)' }}>
              <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder="输入消息…" className="flex-1 text-[13px] text-[#353535] outline-none bg-transparent" />
              <button className="shrink-0 text-[#B0B0B0] hover:text-[#353535] p-1">
                <svg width="18" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <button className="shrink-0 w-[30px] h-[30px] rounded-full bg-[#9A9A9A] flex items-center justify-center text-white hover:bg-[#02A7F0] transition-colors">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="13" y1="2" x2="6" y2="9" />
                  <polygon points="13,2 8,13 6,9 2,6 13,2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LogFeedbackTab() {
  return (
    <div>
      <div className="p-5 space-y-2">
        {[
          { title: '上传日志', desc: '遇到问题时上传操作日志，帮助技术团队排查问题', btn: '上传' },
          { title: '意见反馈', desc: '提交功能建议或使用体验反馈，帮助我们变得更好', btn: '反馈' },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 px-3 border border-[#F0F0F0] rounded-[3px] hover:border-[#E7E7EB]">
            <div>
              <div className="text-[12px] font-medium text-[#353535]">{item.title}</div>
              <div className="text-[10px] text-[#9A9A9A] mt-0.5">{item.desc}</div>
            </div>
            <button className="px-3 py-1 text-[11px] text-[#02A7F0] border border-[#02A7F0]/20 rounded-[3px] hover:bg-[#02A7F0]/5 shrink-0">{item.btn}</button>
          </div>
        ))}
      </div>
    </div>
  )
}
