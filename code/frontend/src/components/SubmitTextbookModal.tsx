import { useState } from 'react'
import { teacherPrefAPI } from '../lib/api'

/**
 * V2.6 用户提交教材版本贡献弹窗
 * 教师可在版本选择器找不到所需版本时，通过此弹窗提交新版本（待管理员审核后入库）。
 */
export default function SubmitTextbookModal({ open, onClose, preferredSubject = '' }: { open: boolean; onClose: () => void; preferredSubject?: string }) {
  const XUEDUAN = ['小学', '初中', '高中']
  const GRADES = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']
  const CEBIE = ['上册', '下册', '全一册']
  const [form, setForm] = useState({
    xue_duan: '小学', nian_ji: '', xue_ke: preferredSubject,
    jiao_cai_ming: '', chu_ban_she: '', ban_ben_biao_shi: '', ce_bie: '上册'
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const onSubmit = async () => {
    if (!form.xue_ke.trim()) { setMsg('请填写学科'); return }
    if (!form.jiao_cai_ming.trim()) { setMsg('请填写教材名称'); return }
    if (!form.chu_ban_she.trim()) { setMsg('请填写出版社'); return }
    if (!form.ban_ben_biao_shi.trim()) { setMsg('请填写版本名（如人教版、统编版）'); return }
    setLoading(true)
    setMsg('')
    try {
      await teacherPrefAPI.submitTextbookVersion({
        xue_ke: form.xue_ke.trim(),
        jiao_cai_ming: form.jiao_cai_ming.trim(),
        chu_ban_she: form.chu_ban_she.trim(),
        ban_ben_biao_shi: form.ban_ben_biao_shi.trim(),
        xue_duan: form.xue_duan,
        nian_ji: form.nian_ji,
        ce_bie: form.ce_bie,
      })
      setMsg('提交成功！等待管理员审核，您可在个人设置中选择使用。')
      setTimeout(() => onClose(), 1500)
    } catch (e: any) {
      const body = e.response ? JSON.parse(e.response) : {}
      if (body.code === 'ALREADY_EXISTS') {
        setMsg('该版本已在库中，可直接在下方下拉框选择！')
      } else {
        setMsg('提交失败：' + (body.message || e.message || '未知错误'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="text-[14px] font-medium mb-1">提交新教材版本</div>
        <div className="text-[11px] text-[#9A9A9A] mb-3">
          未在版本列表中找到所需教材？请填写以下信息提交。审核通过后即可在配置中选择使用。
        </div>
        <div className="space-y-2 text-[12px]">
          <div><div className="text-[#9A9A9A] mb-1">学科 <span className="text-[#E0533D]">*</span></div>
            <input value={form.xue_ke} onChange={(e) => setForm({ ...form, xue_ke: e.target.value })}
              placeholder="如：语文、数学、英语" className="border border-[#E7E7EB] rounded px-2 py-1 w-full" /></div>
          <div><div className="text-[#9A9A9A] mb-1">教材全名 <span className="text-[#E0533D]">*</span></div>
            <input value={form.jiao_cai_ming} onChange={(e) => setForm({ ...form, jiao_cai_ming: e.target.value })}
              placeholder="如：义务教育教科书·数学" className="border border-[#E7E7EB] rounded px-2 py-1 w-full" /></div>
          <div><div className="text-[#9A9A9A] mb-1">版本 <span className="text-[#E0533D]">*</span></div>
            <input value={form.ban_ben_biao_shi} onChange={(e) => setForm({ ...form, ban_ben_biao_shi: e.target.value })}
              placeholder="如：人教版、统编版、北师大版" className="border border-[#E7E7EB] rounded px-2 py-1 w-full" /></div>
          <div><div className="text-[#9A9A9A] mb-1">出版社 <span className="text-[#E0533D]">*</span></div>
            <input value={form.chu_ban_she} onChange={(e) => setForm({ ...form, chu_ban_she: e.target.value })}
              placeholder="如：人民教育出版社" className="border border-[#E7E7EB] rounded px-2 py-1 w-full" /></div>
          <div className="flex gap-2">
            <div className="flex-1"><div className="text-[#9A9A9A] mb-1">学段</div>
              <select value={form.xue_duan} onChange={(e) => setForm({ ...form, xue_duan: e.target.value })}
                className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                {XUEDUAN.map((d) => <option key={d} value={d}>{d}</option>)}
              </select></div>
            <div className="flex-1"><div className="text-[#9A9A9A] mb-1">年级</div>
              <select value={form.nian_ji} onChange={(e) => setForm({ ...form, nian_ji: e.target.value })}
                className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                <option value="">不限</option>
                {GRADES.filter(Boolean).map((g) => <option key={g} value={g}>{g}</option>)}
              </select></div>
            <div className="flex-1"><div className="text-[#9A9A9A] mb-1">册别</div>
              <select value={form.ce_bie} onChange={(e) => setForm({ ...form, ce_bie: e.target.value })}
                className="border border-[#E7E7EB] rounded px-2 py-1 w-full">
                {CEBIE.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></div>
          </div>
          {msg && (
            <div className={`text-[12px] ${msg.includes('成功') ? 'text-[#15A85F]' : msg.includes('已在库中') ? 'text-[#02A7F0]' : 'text-[#E0533D]'}`}>
              {msg}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-[13px] border border-[#E7E7EB] rounded">取消</button>
          <button onClick={onSubmit} disabled={loading}
            className="px-3 py-1.5 bg-[#02A7F0] text-white text-[13px] rounded disabled:opacity-50">
            {loading ? '提交中…' : '提交'}
          </button>
        </div>
      </div>
    </div>
  )
}
