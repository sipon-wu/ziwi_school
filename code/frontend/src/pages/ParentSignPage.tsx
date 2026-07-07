import { useState } from 'react'
import { PenLine, FileText, CheckCircle2, Clock, MessageCircle, Send, TrendingUp } from 'lucide-react'
import { useTeaching } from '../lib/TeachingContext'
import AppLayout from '../components/AppLayout'

const GRADE_MAP: Record<number, string> = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级', 7: '七年级', 8: '八年级', 9: '九年级' }

type SignRecord = {
  id: string
  title: string        // 作业/通知名称
  date: string
  type: '作业' | '周报' | '通知'
  total: number
  signed: number
  replies: number      // 家长回复数
  lastUrgeDate?: string
}

const MOCK_DATA: SignRecord[] = [
  { id: 'r1', title: '第四单元分数比较练习', date: '2026-07-06', type: '作业', total: 48, signed: 42, replies: 8 },
  { id: 'r2', title: '排比句仿写与课文摘抄', date: '2026-07-05', type: '作业', total: 48, signed: 38, replies: 5, lastUrgeDate: '2026-07-06' },
  { id: 'r3', title: '第三单元综合测试', date: '2026-07-04', type: '作业', total: 48, signed: 45, replies: 12 },
  { id: 'r4', title: '本周学情周报（第27周）', date: '2026-07-05', type: '周报', total: 48, signed: 31, replies: 3, lastUrgeDate: '2026-07-06' },
  { id: 'r5', title: '期末考试安排通知', date: '2026-07-08', type: '通知', total: 48, signed: 20, replies: 1 },
]

export default function ParentSignPage() {
  const teaching = useTeaching()
  const gradeName = GRADE_MAP[teaching.grade] || '四年级'
  const [filterType, setFilterType] = useState<'all' | '作业' | '周报' | '通知'>('all')

  const filtered = filterType === 'all' ? MOCK_DATA : MOCK_DATA.filter(r => r.type === filterType)

  const totalSigned = MOCK_DATA.reduce((s, r) => s + r.signed, 0)
  const totalUnsigned = MOCK_DATA.reduce((s, r) => s + r.total - r.signed, 0)
  const totalReplies = MOCK_DATA.reduce((s, r) => s + r.replies, 0)

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-[#353535]">家长签字</h1>
          <p className="text-[11px] text-[#9A9A9A] mt-0.5">
            {teaching.subject} · {gradeName} · 家长确认后更新签字统计 · 自愿原则，不强制
          </p>
        </div>

        {/* 概览卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: '待签总计', value: totalUnsigned, unit: '人次', icon: PenLine, color: '#FA8C16', bg: '#FFF7E6' },
            { label: '已签总计', value: totalSigned, unit: '人次', icon: CheckCircle2, color: '#52C41A', bg: '#F0FFE5' },
            { label: '家长回复', value: totalReplies, unit: '条', icon: MessageCircle, color: '#02A7F0', bg: '#E8F7FF' },
            { label: '本周完成率', value: MOCK_DATA[0] ? Math.round(MOCK_DATA[0].signed / MOCK_DATA[0].total * 100) : 0, unit: '%', icon: TrendingUp, color: '#722ED1', bg: '#F5F0FF' },
          ].map((c, i) => (
            <div key={i} className="bg-white border border-[#E7E7EB] rounded-[4px] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#9A9A9A]">{c.label}</span>
                <div className="w-8 h-8 rounded-[4px] flex items-center justify-center" style={{ background: c.bg }}><c.icon size={15} style={{ color: c.color }} /></div>
              </div>
              <div className="text-2xl font-bold text-[#353535]">{c.value}<span className="text-[13px] font-normal text-[#9A9A9A] ml-1">{c.unit}</span></div>
            </div>
          ))}
        </div>

        {/* 类型筛选 */}
        <div className="flex items-center gap-0.5 bg-[#F0F0F0] rounded-[4px] p-0.5 w-fit">
          {[
            { id: 'all' as const, label: `全部（${MOCK_DATA.length}）` },
            { id: '作业' as const, label: '作业' },
            { id: '周报' as const, label: '周报' },
            { id: '通知' as const, label: '通知' },
          ].map(t => (
            <button key={t.id} onClick={() => setFilterType(t.id)}
              className={`px-3 py-1 text-[11px] rounded-[3px] transition-colors ${filterType === t.id ? 'bg-white text-[#353535] shadow-sm' : 'text-[#9A9A9A] hover:text-[#353535]'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 签字列表 */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
          <div className="px-5 py-2.5 bg-[#F6F7F8] border-b border-[#E7E7EB] flex items-center text-[10px] text-[#9A9A9A]">
            <span className="flex-1">内容</span>
            <span className="w-12 text-center">日期</span>
            <span className="w-16 text-center">已签</span>
            <span className="w-16 text-center">未签</span>
            <span className="w-12 text-center">回复</span>
            <span className="w-16" />
          </div>
          <div className="divide-y divide-[#F0F0F0]">
            {filtered.map(r => {
              const unsigned = r.total - r.signed
              return (
                <div key={r.id} className="flex items-center px-5 py-3 hover:bg-[#F9FAFB] transition-colors">
                  {/* 内容信息 */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className={`w-7 h-7 rounded-[4px] flex items-center justify-center ${r.type === '作业' ? 'bg-[#E8F7FF] text-[#02A7F0]' : r.type === '周报' ? 'bg-[#F5F0FF] text-[#722ED1]' : 'bg-[#F0FFE5] text-[#52C41A]'}`}>
                      <FileText size={13} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-medium text-[#353535] truncate">{r.title}</span>
                        <span className={`text-[8px] px-1 py-0.5 rounded ${r.type === '作业' ? 'bg-[#E8F7FF] text-[#02A7F0]' : r.type === '周报' ? 'bg-[#F5F0FF] text-[#722ED1]' : 'bg-[#F0FFE5] text-[#52C41A]'}`}>{r.type}</span>
                      </div>
                    </div>
                  </div>

                  <span className="w-12 text-center text-[11px] text-[#9A9A9A]">{r.date.slice(5)}</span>

                  {/* 已签 */}
                  <span className="w-16 text-center text-[12px] font-medium text-green-600">{r.signed}<span className="text-[10px] font-normal">/{r.total}</span></span>

                  {/* 未签 */}
                  <span className={`w-16 text-center text-[12px] font-medium ${unsigned > 10 ? 'text-orange-500' : 'text-[#9A9A9A]'}`}>{unsigned}</span>

                  {/* 回复 */}
                  <span className="w-12 text-center text-[11px] text-[#9A9A9A]">{r.replies > 0 ? r.replies : '—'}</span>

                  {/* 催办按钮 */}
                  <span className="w-16 text-right">
                    {unsigned > 0 && (
                      <button className="inline-flex items-center gap-1 text-[10px] text-[#02A7F0] hover:text-[#0288D1] hover:underline">
                        <Send size={10} />
                        催办
                        {r.lastUrgeDate && <span className="text-[9px] text-[#9A9A9A]">{r.lastUrgeDate.slice(5)} 已催</span>}
                      </button>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 底部原则提示 */}
        <div className="bg-[#F9FAFB] border border-[#E7E7EB] rounded-[4px] p-3 flex items-center gap-2 text-[10px] text-[#9A9A9A]">
          <PenLine size={12} />
          <span>自愿原则：家长可签可不签，系统不做强制要求。催办仅发送红点提醒至家长小程序，不承载消息内容。</span>
        </div>
      </div>
    </AppLayout>
  )
}
