import { useEffect, useState } from 'react'
import AppLayout from '../components/AppLayout'
import { facetAPI, notifyError, type FacetVocab } from '../lib/api'
import { useToast } from '../components/Toast'

const TYPES: { k: string; l: string }[] = [
  { k: 'motif', l: '母题' },
  { k: 'medium', l: '媒介' },
  { k: 'category', l: '分类' },
]

export default function FacetAdmin() {
  const { toast } = useToast()
  const [type, setType] = useState('motif')
  const [items, setItems] = useState<FacetVocab[]>([])
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    facetAPI.list(type)
      .then(res => setItems(res.items || []))
      .catch(e => notifyError('词表加载失败', e))
  }
  useEffect(() => { load() }, [type]) // eslint-disable-line

  const add = () => {
    if (!value.trim()) { toast('请填写值', 'warning'); return }
    setBusy(true)
    facetAPI.upsert({ type, value: value.trim(), label: label.trim() || value.trim() })
      .then(() => { toast('已添加', 'success'); setValue(''); setLabel(''); load() })
      .catch(e => notifyError('添加失败', e))
      .finally(() => setBusy(false))
  }

  const remove = (id: string) => {
    facetAPI.remove(id)
      .then(() => { toast('已删除', 'success'); load() })
      .catch(e => notifyError('删除失败', e))
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-[760px] mx-auto">
        <h2 className="text-[18px] font-bold text-[#353535] mb-1">受控词表管理</h2>
        <p className="text-[12px] text-[#9A9A9A] mb-4">运营维护母题/媒介等受控词，教师上传装饰元件与筛选只能选这些词，避免标签污染。</p>

        <div className="flex gap-2 mb-4">
          {TYPES.map(t => (
            <button key={t.k} onClick={() => setType(t.k)}
              className={`px-3 py-1.5 text-[12px] rounded-[4px] ${type === t.k ? 'bg-[#7B61FF] text-white' : 'bg-[#F6F7F8] text-[#6B6B6B]'}`}>
              {t.l}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-4 items-end">
          <div>
            <div className="text-[11px] text-[#9A9A9A] mb-1">值(存储)</div>
            <input value={value} onChange={e => setValue(e.target.value)} placeholder="如 自然" className="px-2 py-1.5 text-[12px] border border-[#E7E7EB] rounded w-[140px]" />
          </div>
          <div>
            <div className="text-[11px] text-[#9A9A9A] mb-1">展示名</div>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="可选，默认同值" className="px-2 py-1.5 text-[12px] border border-[#E7E7EB] rounded w-[140px]" />
          </div>
          <button onClick={add} disabled={busy} className="px-3 py-1.5 text-[12px] text-white bg-[#7B61FF] rounded hover:bg-[#6a4fe0] disabled:opacity-50">添加</button>
        </div>

        <div className="border border-[#F0F0F0] rounded-[8px] divide-y divide-[#F0F0F0]">
          {items.length === 0 && <div className="text-center text-[12px] text-[#9A9A9A] py-8">暂无词项</div>}
          {items.map(it => (
            <div key={it.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <span className="text-[13px] text-[#353535] font-medium">{it.label}</span>
                <span className="text-[11px] text-[#9A9A9A] ml-2">{it.value}</span>
              </div>
              <button onClick={() => remove(it.id)} className="text-[12px] text-[#d93636] hover:underline">删除</button>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
