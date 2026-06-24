import { useState } from 'react'
import { Shield, Plus, Search, Download, Bell, RefreshCw, TrendingUp, AlertTriangle, Wifi, WifiOff, Settings, Users, Clock, Zap, Activity, Megaphone, FileSearch, ShieldCheck, BarChart3, PieChart } from 'lucide-react'
import { tokenQuotaAPI } from '../lib/api'

const SCHOOLS = [
  { id:'S001',name:'示例小学',contact:'张校长',phone:'138****0001',status:'active',tokens:'85,000/100,000',lastHeartbeat:'2026-06-18 22:00',expiresAt:'2027-06-16' },
  { id:'S002',name:'重庆第一实验小学',contact:'李主任',phone:'138****0002',status:'active',tokens:'3,200/50,000',lastHeartbeat:'2026-06-18 21:55',expiresAt:'2026-12-31' },
  { id:'S003',name:'成都七中初中部',contact:'王老师',phone:'138****0003',status:'expiring',tokens:'800/10,000',lastHeartbeat:'2026-06-18 17:00',expiresAt:'2026-08-15' },
  { id:'S004',name:'深圳南山小学',contact:'陈主任',phone:'138****0004',status:'offline',tokens:'50,000/50,000',lastHeartbeat:'2026-06-16 08:00',expiresAt:'2026-12-31' },
]

const TOKEN_PACKAGES = [
  { name:'体验包',tokens:10000,price:'¥2,980' },
  { name:'基础包',tokens:50000,price:'¥9,800' },
  { name:'标准包',tokens:100000,price:'¥16,800' },
  { name:'专业包',tokens:500000,price:'¥58,000' },
  { name:'企业包',tokens:1000000,price:'¥98,000' },
]

export default function LicenseAdmin() {
  const [tab, setTab] = useState<'schools'|'license'|'monitor'|'trial'|'users'|'system'|'announce'|'logs'|'token'|'quota'>('schools')
  const [quotaTeachers, setQuotaTeachers] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [quotaValue, setQuotaValue] = useState(500000)
  const [quotaCustom, setQuotaCustom] = useState(true)
  const [quotaLoading, setQuotaLoading] = useState(false)

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">License 管理后台</h1>
          <p className="text-sm text-gray-500 mt-1">管理学校 License 签发、Token 分销、用量监控</p>
        </div>
      </div>

      {/* Tab */}
      <div className="flex bg-white rounded-xl border border-gray-200 p-1 gap-1 w-fit">
        {[
          { key:'schools',label:'学校管理',icon:Shield },
          { key:'license',label:'License签发',icon:Plus },
          { key:'monitor',label:'用量监控',icon:TrendingUp },
          { key:'trial',label:'试用管理',icon:Settings },
          { key:'users',label:'用户管理',icon:Users },
          { key:'system',label:'系统健康',icon:Activity },
          { key:'announce',label:'平台公告',icon:Megaphone },
          { key:'logs',label:'操作日志',icon:FileSearch },
          { key:'token',label:'Token分析',icon:PieChart },
          { key:'quota',label:'配额管理',icon:TrendingUp },
        ].map(t => (
          <button key={t.key} onClick={()=>setTab(t.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab===t.key ? 'bg-[#1A3A6B] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* 学校管理 */}
      {tab === 'schools' && (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label:'活跃学校',value:'3',icon:Wifi,color:'text-green-600 bg-green-50' },
              { label:'即将到期',value:'1',icon:AlertTriangle,color:'text-yellow-600 bg-yellow-50' },
              { label:'离线学校',value:'1',icon:WifiOff,color:'text-red-600 bg-red-50' },
              { label:'本月新增',value:'2',icon:TrendingUp,color:'text-blue-600 bg-blue-50' },
            ].map((c,i)=>(
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">{c.label}</span>
                  <div className={`p-1.5 rounded-lg ${c.color}`}><c.icon size={16}/></div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{c.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300"/>
                <input placeholder="搜索学校..." className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg" />
              </div>
              <button className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#1A3A6B] text-white rounded-lg"><Plus size={13}/>新建学校</button>
              <button className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg"><Download size={13}/>导出</button>
            </div>
            <table className="w-full">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                {['学校名称','联系人','License状态','剩余Token','最后心跳','到期时间','操作'].map(h=>(
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {SCHOOLS.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.contact}<span className="text-xs text-gray-400 ml-1">{s.phone}</span></td>
                    <td className="px-4 py-3">
                      {s.status==='active' && <span className="px-2 py-0.5 text-[11px] bg-green-50 text-green-600 rounded-full">有效</span>}
                      {s.status==='expiring' && <span className="px-2 py-0.5 text-[11px] bg-yellow-50 text-yellow-600 rounded-full">即将到期</span>}
                      {s.status==='offline' && <span className="px-2 py-0.5 text-[11px] bg-red-50 text-red-600 rounded-full">离线</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.tokens}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.lastHeartbeat}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.expiresAt}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button className="px-2.5 py-1 text-[11px] text-[#1A3A6B] border border-[#1A3A6B]/20 rounded hover:bg-blue-50">签发</button>
                        <button className="px-2.5 py-1 text-[11px] text-gray-500 border border-gray-200 rounded hover:bg-gray-50">详情</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* License签发 */}
      {tab === 'license' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Token 套餐</h3>
            <div className="space-y-3">
              {TOKEN_PACKAGES.map((pkg,i)=>(
                <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-[#1A3A6B]/30 cursor-pointer">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{pkg.name}</div>
                    <div className="text-xs text-gray-400">{pkg.tokens.toLocaleString()} tokens</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#1A3A6B]">{pkg.price}</div>
                    <button className="mt-1 px-3 py-1 text-[11px] bg-[#1A3A6B] text-white rounded-lg">选择</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">签发 License</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">选择学校</label>
                <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  {SCHOOLS.map(s=><option key={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 mb-1 block">购买时长</label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"><option>1年</option><option>3年</option></select>
                </div>
                <div><label className="text-xs text-gray-500 mb-1 block">生效日期</label>
                  <input type="date" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" defaultValue="2026-06-19"/>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg text-xs text-yellow-700">
                <AlertTriangle size={13} /> Token &gt;50,000 需上级审批
              </div>
              <button className="w-full py-2.5 bg-[#1A3A6B] text-white rounded-xl text-sm shadow-sm hover:bg-[#2B5DA8] flex items-center justify-center gap-2">
                <Shield size={15}/> 生成 License 文件
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 试用管理 */}
      {tab === 'trial' && (
        <div className="space-y-6">
          {/* 试用统计 */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label:'正在试用',value:'12',sub:'教师',icon:Users,color:'text-blue-600 bg-blue-50' },
              { label:'已转化',value:'3',sub:'加入学校',icon:TrendingUp,color:'text-green-600 bg-green-50' },
              { label:'即将到期',value:'4',sub:'3天内',icon:Clock,color:'text-yellow-600 bg-yellow-50' },
              { label:'已过期',value:'8',sub:'未转化',icon:AlertTriangle,color:'text-red-600 bg-red-50' },
            ].map((c,i)=>(
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">{c.label}</span>
                  <div className={`p-1.5 rounded-lg ${c.color}`}><c.icon size={16}/></div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{c.value}</div>
                <div className="text-xs text-gray-400 mt-1">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* 试用配置 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"><Settings size={18} className="text-[#1A3A6B]"/>试用参数配置</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">试用开关</label>
                <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <button className="px-3 py-1.5 text-sm rounded-lg bg-[#1A3A6B] text-white font-medium">开启</button>
                  <button className="px-3 py-1.5 text-sm rounded-lg text-gray-400">关闭</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">试用时长（天）</label>
                <input type="number" defaultValue={14} min={1} max={90}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 font-medium"/>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">赠送 Token 额度</label>
                <div className="relative">
                  <input type="number" defaultValue={100000} min={1000} step={10000}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 font-medium"/>
                  <Zap size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"/>
                </div>
              </div>
            </div>
            <button className="px-5 py-2 bg-[#1A3A6B] text-white rounded-lg text-sm shadow-sm hover:bg-[#2B5DA8]">保存配置</button>
          </div>

          {/* 试用教师列表 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">试用教师列表</span>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300"/>
                <input placeholder="搜索教师..." className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-48"/>
              </div>
            </div>
            <table className="w-full">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                {['教师','手机号','学科','剩余天数','Token用量','注册时间','操作'].map(h=>(
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { name:'张明',phone:'136****0001',subject:'语文',days:10,used:3200,quota:100000,date:'06-17',status:'active' },
                  { name:'李华',phone:'137****0002',subject:'数学',days:3,used:45000,quota:50000,date:'06-04',status:'expiring' },
                  { name:'王芳',phone:'138****0003',subject:'英语',days:-2,used:82000,quota:100000,date:'05-20',status:'expired' },
                ].map((t,i)=>(
                  <tr key={i} className={`hover:bg-gray-50/50 ${t.status==='expired'?'text-gray-400':''}`}>
                    <td className="px-4 py-3 text-sm font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-sm">{t.phone}</td>
                    <td className="px-4 py-3 text-sm">{t.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${
                        t.days<=0?'text-red-500':t.days<=3?'text-yellow-500':'text-green-500'
                      }`}>{t.days<=0?'已过期':`${t.days}天`}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#1A3A6B] rounded-full" style={{width:`${(t.used/t.quota)*100}%`}}/>
                        </div>
                        <span className="text-xs text-gray-400">{Math.round(t.used/1000)}k</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{t.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {t.status==='expired'?(
                          <button className="px-2.5 py-1 text-[11px] text-[#1A3A6B] border border-[#1A3A6B]/20 rounded hover:bg-blue-50">延期</button>
                        ):(
                          <button className="px-2.5 py-1 text-[11px] text-orange-600 border border-orange-200 rounded hover:bg-orange-50">终止</button>
                        )}
                        <button className="px-2.5 py-1 text-[11px] text-gray-500 border border-gray-200 rounded hover:bg-gray-50">详情</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 用户管理 */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200">
            <div className="flex-1 relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300"/><input placeholder="搜索用户..." className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg"/></div>
            <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg"><option>全部角色</option><option>教师</option><option>学生</option><option>家长</option></select>
            <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg"><option>全部状态</option><option>正常</option><option>封禁</option></select>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 border-b border-gray-200">{['用户','手机号','角色','所属学校','注册时间','最后登录','操作'].map(h=><th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  {name:'张老师',phone:'136****0001',role:'教师',school:'示例小学',reg:'06-10',login:'1小时前',status:'active'},
                  {name:'李明',phone:'139****1001',role:'学生',school:'示例小学',reg:'06-10',login:'昨天',status:'active'},
                  {name:'李建国',phone:'138****2001',role:'家长',school:'示例小学',reg:'06-10',login:'3天前',status:'active'},
                  {name:'test_user',phone:'150****9999',role:'教师',school:'个人试用',reg:'06-05',login:'15天前',status:'blocked'},
                ].map((u,i)=>(
                  <tr key={i} className={u.status==='blocked'?'bg-red-50/30':''}>
                    <td className="px-4 py-3 text-sm font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.phone}</td>
                    <td className="px-4 py-3 text-sm">{u.role}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.school}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.reg}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.login}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {u.status==='blocked'?<button className="px-2.5 py-1 text-[11px] text-green-600 border border-green-200 rounded hover:bg-green-50">解封</button>:<button className="px-2.5 py-1 text-[11px] text-red-500 border border-red-200 rounded hover:bg-red-50">封禁</button>}
                        <button className="px-2.5 py-1 text-[11px] text-gray-500 border border-gray-200 rounded">详情</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 系统健康 */}
      {tab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[
              {label:'数据库',value:'正常',icon:ShieldCheck,color:'text-green-600 bg-green-50',detail:'pgvector 16'},
              {label:'Redis',value:'正常',icon:Activity,color:'text-green-600 bg-green-50',detail:'7.0-alpine'},
              {label:'API 可用率',value:'99.8%',icon:TrendingUp,color:'text-blue-600 bg-blue-50',detail:'7天内'},
              {label:'错误率',value:'0.12%',icon:AlertTriangle,color:'text-yellow-600 bg-yellow-50',detail:'24h'},
            ].map((c,i)=>(
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-gray-500">{c.label}</span><div className={`p-1.5 rounded-lg ${c.color}`}><c.icon size={16}/></div></div>
                <div className="text-2xl font-bold text-gray-900">{c.value}</div>
                <div className="text-xs text-gray-400 mt-1">{c.detail}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-xs text-gray-500 mb-2">CPU</div><div className="text-lg font-bold">34%</div><div className="w-full h-2 bg-gray-100 rounded-full mt-2"><div className="h-full bg-green-500 rounded-full w-[34%]"/></div></div>
            <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-xs text-gray-500 mb-2">内存</div><div className="text-lg font-bold">62%</div><div className="w-full h-2 bg-gray-100 rounded-full mt-2"><div className="h-full bg-yellow-500 rounded-full w-[62%]"/></div></div>
            <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-xs text-gray-500 mb-2">磁盘</div><div className="text-lg font-bold">45%</div><div className="w-full h-2 bg-gray-100 rounded-full mt-2"><div className="h-full bg-blue-500 rounded-full w-[45%]"/></div></div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3"><span className="text-sm font-medium text-gray-700">API 响应耗时</span><span className="text-xs text-gray-400">P99</span></div>
            <div className="space-y-2">
              {[{name:'教案生成',ms:1800,color:'blue'},{name:'出题',ms:800,color:'green'},{name:'批阅',ms:350,color:'purple'},{name:'登录',ms:120,color:'orange'},{name:'查询列表',ms:85,color:'gray'}].map((api,i)=>(
                <div key={i} className="flex items-center gap-3"><span className="text-xs text-gray-600 w-16">{api.name}</span><div className="flex-1 h-1.5 bg-gray-100 rounded-full"><div className={`h-full rounded-full bg-${api.color}-500`} style={{width:`${Math.min(api.ms/2000*100,100)}%`}}/></div><span className="text-xs text-gray-400 w-12 text-right">{api.ms}ms</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 平台公告 */}
      {tab === 'announce' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">发布公告</h3>
            <div className="space-y-3">
              <input placeholder="公告标题" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"/>
              <textarea placeholder="公告内容..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg h-20 resize-none"/>
              <div className="flex items-center gap-3">
                <select className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"><option>全部用户</option><option>仅教师</option><option>仅家长</option></select>
                <label className="flex items-center gap-1.5 text-sm text-gray-500"><input type="checkbox" className="accent-[#1A3A6B]"/>置顶</label>
                <button className="ml-auto px-5 py-2 bg-[#1A3A6B] text-white rounded-lg text-sm"><Megaphone size={14} className="inline mr-1"/>发布</button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 border-b border-gray-200">{['公告标题','目标','状态','发布时间','操作'].map(h=><th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  {title:'知微教学 v0.2.0 上线通知',content:'新增教案AI生成、出题组卷',target:'全部',pinned:true,date:'06-18'},
                  {title:'暑期备课活动',content:'7-8月使用知微备课获双倍Token',target:'教师',pinned:false,date:'06-16'},
                  {title:'系统维护通知',content:'6月20日 02:00-04:00维护',target:'全部',pinned:false,date:'06-15'},
                ].map((a,i)=>(
                  <tr key={i}><td className="px-4 py-3 text-sm font-medium">{a.pinned && <span className="text-[10px] px-1 py-0.5 bg-[#1A3A6B]/10 text-[#1A3A6B] rounded mr-1">置顶</span>}{a.title}</td><td className="px-4 py-3 text-sm text-gray-500">{a.target}</td><td className="px-4 py-3"><span className="px-2 py-0.5 text-[11px] bg-green-50 text-green-600 rounded-full">已发布</span></td><td className="px-4 py-3 text-sm text-gray-500">{a.date}</td><td className="px-4 py-3"><button className="px-2.5 py-1 text-[11px] text-red-400 border border-red-200 rounded hover:bg-red-50">撤销</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 操作日志 */}
      {tab === 'logs' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <FileSearch size={16} className="text-gray-400"/>
            <span className="text-sm font-medium text-gray-700">管理操作审计日志</span>
            <span className="text-xs text-gray-400 ml-auto">保留 180 天 · 最近 100 条</span>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-200">{['管理员','操作','目标','IP','时间'].map(h=><th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {[
                {admin:'admin',action:'签发 License',target:'示例小学 / 100K tokens',ip:'10.0.1.100',time:'06-19 10:30'},
                {admin:'admin',action:'修改试用配置',target:'试用时长: 14天 → 30天',ip:'10.0.1.100',time:'06-19 09:15'},
                {admin:'admin',action:'封禁用户',target:'test_user (教师)',ip:'10.0.1.100',time:'06-18 16:20'},
                {admin:'admin',action:'发布公告',target:'暑期备课活动',ip:'10.0.1.100',time:'06-18 14:00'},
                {admin:'admin',action:'远程解锁',target:'深圳南山小学 / 已审批',ip:'10.0.1.100',time:'06-18 11:30'},
              ].map((l,i)=>(
                <tr key={i}>
                  <td className="px-4 py-2.5 font-medium">{l.admin}</td>
                  <td className="px-4 py-2.5 text-[#1A3A6B]">{l.action}</td>
                  <td className="px-4 py-2.5 text-gray-500">{l.target}</td>
                  <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{l.ip}</td>
                  <td className="px-4 py-2.5 text-gray-400">{l.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Token 分析 */}
      {tab === 'token' && (
        <div className="space-y-6">
          {/* 模型方总览 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-[#1A3A6B]"/>模型方总览（通义千问 API 消耗）</h3>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {[
                {label:'今日消耗',value:'12.5k',sub:'≈¥0.05',color:'text-blue-600'},
                {label:'本月消耗',value:'452k',sub:'≈¥1.81',color:'text-[#1A3A6B]'},
                {label:'累计消耗',value:'1.2M',sub:'≈¥4.80',color:'text-green-600'},
                {label:'平均响应',value:'850ms',sub:'P99: 2.1s',color:'text-gray-600'},
              ].map((c,i)=>(
                <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                  <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
                  <div className="text-[10px] text-gray-400">{c.sub}</div>
                </div>
              ))}
            </div>
            {/* 按API类型分布 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-2">按 API 类型</div>
                <div className="space-y-2">
                  {[{type:'教案生成',tokens:280000,calls:56,color:'bg-blue-500'},{type:'出题组卷',tokens:95000,calls:89,color:'bg-green-500'},{type:'作文批阅',tokens:52000,calls:23,color:'bg-purple-500'},{type:'小微对话',tokens:25000,calls:112,color:'bg-orange-500'}].map((it,i)=>(
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className={`w-2.5 h-2.5 rounded-full ${it.color} flex-shrink-0`}/>
                      <span className="w-16 text-gray-600">{it.type}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full"><div className={`h-full rounded-full ${it.color}`} style={{width:`${it.tokens/300000*100}%`}}/></div>
                      <span className="text-gray-400">{Math.round(it.tokens/1000)}k/{it.calls}次</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-2">按模型</div>
                <div className="space-y-2">
                  {[{model:'qwen-plus',tokens:320000,pct:71},{model:'qwen-turbo',tokens:85000,pct:19},{model:'qwen-vl-plus',tokens:45000,pct:10}].map((m,i)=>(
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-20 font-mono text-gray-600">{m.model}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-[#1A3A6B] rounded-full" style={{width:`${m.pct}%`}}/></div>
                      <span className="text-gray-400">{Math.round(m.tokens/1000)}k ({m.pct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 租户方排行 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><Users size={16} className="text-[#1A3A6B]"/>租户 Token 消耗排行（本月）</h3>
            <table className="w-full">
              <thead><tr className="bg-gray-50 border-b border-gray-200 text-left">{['排名','学校','本月Token','估算费用','调用次数','占总比'].map(h=><th key={h} className="px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {[
                  {rank:1,school:'示例小学',tokens:185000,cost:'¥0.74',calls:234,pct:'41%'},
                  {rank:2,school:'重庆第一实验小学',tokens:120000,cost:'¥0.48',calls:156,pct:'27%'},
                  {rank:3,school:'个人试用教师',tokens:95000,cost:'¥0.38',calls:142,pct:'21%'},
                  {rank:4,school:'成都七中初中部',tokens:52000,cost:'¥0.21',calls:78,pct:'11%'},
                ].map((t,i)=>(
                  <tr key={i}>
                    <td className="px-4 py-2.5"><span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${i<3?'bg-[#1A3A6B] text-white':'bg-gray-100 text-gray-500'}`}>{t.rank}</span></td>
                    <td className="px-4 py-2.5 font-medium">{t.school}</td>
                    <td className="px-4 py-2.5">{t.tokens.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-gray-500">{t.cost}</td>
                    <td className="px-4 py-2.5 text-gray-500">{t.calls}次</td>
                    <td className="px-4 py-2.5"><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-[#1A3A6B] rounded-full" style={{width:t.pct}}/></div><span className="text-xs text-gray-400">{t.pct}</span></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 30天趋势（简易柱状图） */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><TrendingUp size={16} className="text-[#1A3A6B]"/>近30天 Token 消耗趋势</h3>
              <div className="flex gap-2">
                <select className="px-2 py-1 text-xs border border-gray-200 rounded"><option>全部学校</option></select>
                <select className="px-2 py-1 text-xs border border-gray-200 rounded"><option>30天</option><option>7天</option></select>
              </div>
            </div>
            <div className="flex items-end gap-0.5 h-32">
              {[3,5,4,8,6,7,9,5,12,8,10,15,11,9,14,8,6,7,10,13,9,11,8,7,9,12,10,8,11,9].map((v,i)=>(
                <div key={i} className="flex-1 bg-[#1A3A6B]/10 hover:bg-[#1A3A6B]/30 rounded-t transition-colors cursor-pointer relative group" style={{height:`${v/15*100}%`}}>
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 whitespace-nowrap">{v}k</div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-300">
              <span>30天前</span><span>15天前</span><span>今天</span>
            </div>
          </div>
        </div>
      )}

      {/* 用量监控 */}
      {tab === 'monitor' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label:'本月Token消耗',value:'45,200',sub:'环比 ↑12%',color:'text-[#1A3A6B]' },
              { label:'本月新增学校',value:'2',sub:'累计 4 所',color:'text-green-600' },
              { label:'在线率',value:'75%',sub:'3/4 在线',color:'text-blue-600' },
            ].map((c,i)=>(
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                <div className="text-xs text-gray-400 mt-1">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* 预警 */}
          <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 flex items-center gap-2">
              <Bell size={14} className="text-red-500"/>
              <span className="text-xs font-medium text-red-700">预警通知</span>
            </div>
            <div className="divide-y divide-gray-100">
              {[
                { school:'成都七中初中部',msg:'剩余Token仅 8%，请及时续费',level:'urgent' },
                { school:'示例小学',msg:'License 将于 30 天后到期',level:'warning' },
              ].map((a,i)=>(
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-2 h-2 rounded-full ${a.level==='urgent'?'bg-red-500':'bg-yellow-500'}`}/>
                  <span className="text-xs text-gray-700">{a.school}</span>
                  <span className="text-xs text-gray-400">— {a.msg}</span>
                  <button className="ml-auto text-[11px] text-[#1A3A6B]">处理</button>
                </div>
              ))}
            </div>
          </div>

          {/* 心跳日志 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">最近心跳</h4>
              <button className="flex items-center gap-1 text-xs text-gray-400"><RefreshCw size={12}/>刷新</button>
            </div>
            <div className="space-y-1.5 text-xs text-gray-500">
              {SCHOOLS.map(s=>(
                <div key={s.id} className="flex items-center gap-2">
                  {s.status==='offline'?<WifiOff size={12} className="text-red-400"/>:<Wifi size={12} className="text-green-400"/>}
                  <span>{s.name}</span>
                  <span className="text-gray-300">{s.lastHeartbeat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Token 配额管理 */}
      {tab === 'quota' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">教师配额批量设置</h3>
              <button
                onClick={async () => {
                  try {
                    setQuotaLoading(true)
                    const res = await tokenQuotaAPI.listTeachers()
                    setQuotaTeachers(res?.data || [])
                    setSelectedIds(new Set())
                  } catch { /* ignore */ }
                  setQuotaLoading(false)
                }}
                disabled={quotaLoading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
              >
                <RefreshCw size={12} className={quotaLoading ? 'animate-spin' : ''} />
                {quotaTeachers.length > 0 ? '刷新' : '加载教师'}
              </button>
            </div>

            {quotaTeachers.length > 0 ? (
              <>
                {/* 工具栏 */}
                <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3 bg-gray-50">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input type="checkbox" checked={selectedIds.size === quotaTeachers.length}
                      onChange={e => {
                        if (e.target.checked) setSelectedIds(new Set(quotaTeachers.map((t: any) => t.id)))
                        else setSelectedIds(new Set())
                      }}
                    />
                    全选
                  </label>
                  <span className="text-xs text-gray-400">|</span>
                  <span className="text-xs text-gray-500">配额</span>
                  <input type="number" value={quotaValue} onChange={e => setQuotaValue(Number(e.target.value))}
                    className="w-28 px-2 py-1 text-xs border border-gray-200 rounded" min={0} step={10000}
                  />
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input type="checkbox" checked={quotaCustom} onChange={e => setQuotaCustom(e.target.checked)} />
                    个性化
                  </label>
                  <button
                    onClick={async () => {
                      if (selectedIds.size === 0) { alert('请选择教师'); return }
                      try {
                        await tokenQuotaAPI.batchUpdateQuota(Array.from(selectedIds), quotaValue, quotaCustom)
                        alert(`已更新 ${selectedIds.size} 位教师配额`)
                      } catch { alert('更新失败') }
                    }}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    应用 ({selectedIds.size})
                  </button>
                </div>

                {/* 表格 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium w-8"></th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">姓名</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">学科</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">月配额</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">已消耗</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">使用率</th>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">类型</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {quotaTeachers.map((t: any) => {
                        const pct = t.token_quota_monthly > 0 ? (t.token_used_monthly / t.token_quota_monthly * 100) : 0
                        return (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              <input type="checkbox" checked={selectedIds.has(t.id)}
                                onChange={e => {
                                  const next = new Set(selectedIds)
                                  e.target.checked ? next.add(t.id) : next.delete(t.id)
                                  setSelectedIds(next)
                                }}
                              />
                            </td>
                            <td className="px-4 py-2 text-gray-800">{t.name}</td>
                            <td className="px-4 py-2 text-gray-500">{t.subject || '-'}</td>
                            <td className="px-4 py-2 text-gray-700">{(t.token_quota_monthly || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-gray-700">{(t.token_used_monthly || 0).toLocaleString()}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                <span className={pct >= 90 ? 'text-red-500' : pct >= 80 ? 'text-amber-500' : 'text-gray-400'}>
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.token_quota_custom ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                                {t.token_quota_custom ? '自定义' : '默认'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="px-4 py-12 text-center text-sm text-gray-400">
                点击"加载教师"获取学校教师配额列表
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
