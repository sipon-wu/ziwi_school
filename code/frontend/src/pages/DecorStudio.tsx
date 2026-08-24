import { useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout'
import { decorAPI, decorTemplateAPI, facetAPI, notifyError, type DecorItem, type DecorSlots, type MaterialItem, type DecorTemplate } from '../lib/api'
import { useToast } from '../components/Toast'
import { buildH5FromOutline, exportH5Courseware } from '../lib/exportH5'
import type { OutlineSlide } from '../lib/exportPptx'

type SlotKey = keyof DecorSlots

const SLOTS: { key: SlotKey; label: string; hint: string }[] = [
  { key: 'header', label: '页眉', hint: '顶部横幅类装饰' },
  { key: 'footer', label: '页脚', hint: '底部装饰条' },
  { key: 'corners', label: '四角', hint: '角标（最多4个）' },
  { key: 'floating', label: '浮动区', hint: '正文两侧点缀（最多3个）' },
  { key: 'background', label: '背景', hint: '铺满背景图 URL' },
]

const STATUS_LABEL: Record<string, string> = { draft: '草稿', pending: '待审核', approved: '已发布', rejected: '已驳回' }

export default function DecorStudio() {
  const { toast } = useToast()
  const [scope, setScope] = useState<'public' | 'mine'>('public')
  const [medium, setMedium] = useState('')
  const [motif, setMotif] = useState('')
  const [motifs, setMotifs] = useState<{ k: string; l: string }[]>([{ k: '', l: '母题' }])
  const [elements, setElements] = useState<MaterialItem[]>([])
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('未命名装饰模板')
  const [facets, setFacets] = useState('')
  const [slots, setSlots] = useState<DecorSlots>({})
  const [activeSlot, setActiveSlot] = useState<SlotKey>('header')
  const [myTemplates, setMyTemplates] = useState<DecorTemplate[]>([])
  const [saving, setSaving] = useState(false)

  const loadMy = () => {
    decorTemplateAPI.list('mine')
      .then(res => setMyTemplates(res.items || []))
      .catch(e => notifyError('模板加载失败', e))
  }
  useEffect(() => { loadMy() }, []) // eslint-disable-line

  const fetchElements = () => {
    setLoading(true)
    decorAPI.list({ scope, medium: medium || undefined, motif: motif || undefined })
      .then(res => setElements(res.items || []))
      .catch(e => notifyError('元件加载失败', e))
      .finally(() => setLoading(false))
  }
  useEffect(() => { fetchElements() }, [scope]) // eslint-disable-line
  useEffect(() => {
    facetAPI.list('motif')
      .then(res => setMotifs([{ k: '', l: '母题' }, ...(res.items || []).map(f => ({ k: f.value, l: f.label }))]))
      .catch(() => {})
  }, []) // eslint-disable-line

  const addToSlot = (it: MaterialItem) => {
    if (activeSlot === 'background') {
      setSlots(s => ({ ...s, background: it.url }))
      toast('已设为背景', 'success')
      return
    }
    const max = activeSlot === 'corners' ? 4 : activeSlot === 'floating' ? 3 : 99
    setSlots(s => {
      const cur = (s[activeSlot] as DecorItem[] | undefined) || []
      if (cur.length >= max) { toast(`${SLOTS.find(x => x.key === activeSlot)?.label}已达上限`, 'warning'); return s }
      const item: DecorItem = { id: it.id, url: it.url || '', name: it.name }
      return { ...s, [activeSlot]: [...cur, item] }
    })
  }

  const removeFromSlot = (slot: SlotKey, idx: number) => {
    if (slot === 'background') { setSlots(s => ({ ...s, background: undefined })); return }
    setSlots(s => {
      const cur = (s[slot] as DecorItem[] | undefined) || []
      return { ...s, [slot]: cur.filter((_, i) => i !== idx) }
    })
  }

  const save = (submit: boolean) => {
    setSaving(true)
    decorTemplateAPI.save({
      name: name.trim() || '未命名装饰模板',
      slots,
      facets: facets.split(/[,，\s]+/).filter(Boolean),
      submit,
    })
      .then(() => {
        toast(submit ? '已提交运营审核' : '已保存为草稿', 'success')
        loadMy()
      })
      .catch(e => notifyError(submit ? '提交失败' : '保存失败', e))
      .finally(() => setSaving(false))
  }

  const loadTpl = (t: DecorTemplate) => {
    setName(t.name)
    setSlots(t.slots)
    setFacets((t.facets || []).join('，'))
    toast('已载入模板「' + t.name + '」', 'info')
  }

  const preview = () => {
    const slide: OutlineSlide = {
      title: '装饰模板预览',
      bullets: ['这是装饰模板在课件页上的呈现效果', '装饰元件按插槽自动布局，无需手动拖拽'],
      decor: slots,
    }
    const blob = exportH5Courseware(buildH5FromOutline([slide]), {
      subject: '装饰', grade: '', title: name,
      teacherName: '', autoPlay: false, autoPlayInterval: 8,
    })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  const totalCount = Object.values(slots).reduce((n, v) =>
    n + (Array.isArray(v) ? (v as DecorItem[]).length : v ? 1 : 0), 0)

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* 顶栏 */}
        <div className="px-6 py-3 border-b border-[#F0F0F0] flex items-center gap-3 flex-wrap">
          <h2 className="text-[16px] font-bold text-[#353535]">装修工作室 · 装饰组件模板</h2>
          <input value={name} onChange={e => setName(e.target.value)}
            className="px-2 py-1 text-[13px] border border-[#E7E7EB] rounded-[4px] w-[200px]" placeholder="模板名称" />
          <input value={facets} onChange={e => setFacets(e.target.value)}
            className="px-2 py-1 text-[13px] border border-[#E7E7EB] rounded-[4px] w-[200px]" placeholder="facet 标签(逗号分隔)" />
          <button onClick={() => save(false)} disabled={saving} className="px-3 py-1.5 text-[12px] text-white bg-[#7B61FF] rounded-[4px] hover:bg-[#6a4fe0] disabled:opacity-50">保存草稿</button>
          <button onClick={() => save(true)} disabled={saving} className="px-3 py-1.5 text-[12px] text-white bg-[#F5A623] rounded-[4px] hover:bg-[#e0941a] disabled:opacity-50">提交审核</button>
          <button onClick={preview} className="px-3 py-1.5 text-[12px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1]">预览 H5</button>
          <span className="text-[11px] text-[#9A9A9A]">已挂载 {totalCount} 个元件</span>
          {myTemplates.length > 0 && (
            <select onChange={e => { const t = myTemplates.find(x => x.id === e.target.value); if (t) loadTpl(t) }} defaultValue="" className="px-2 py-1.5 text-[11px] border border-[#E7E7EB] rounded">
              <option value="">我的模板（{myTemplates.length}）</option>
              {myTemplates.map(t => <option key={t.id} value={t.id}>{t.name} · {STATUS_LABEL[t.status || ''] || t.status || '草稿'}</option>)}
            </select>
          )}
          <button onClick={fetchElements} className="px-2 py-1.5 text-[11px] text-[#6B6B6B] border border-[#E7E7EB] rounded-[4px] ml-auto">刷新元件库</button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* 左：元件库 */}
          <div className="w-[300px] border-r border-[#F0F0F0] flex flex-col">
            <div className="px-3 py-2 border-b border-[#F0F0F0] flex items-center gap-2 flex-wrap">
              <div className="flex rounded-[4px] overflow-hidden border border-[#E7E7EB]">
                {(['public', 'mine'] as const).map(s => (
                  <button key={s} onClick={() => setScope(s)}
                    className={`px-2 py-1 text-[11px] ${scope === s ? 'bg-[#7B61FF] text-white' : 'text-[#6B6B6B]'}`}>
                    {s === 'public' ? '公共库' : '我的'}
                  </button>
                ))}
              </div>
              <select value={medium} onChange={e => setMedium(e.target.value)} className="px-1 py-1 text-[11px] border border-[#E7E7EB] rounded">
                {[{ k: '', l: '媒介' }, { k: 'ppt', l: 'PPT' }, { k: 'h5', l: 'H5' }, { k: 'common', l: '通用' }].map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
              </select>
              <select value={motif} onChange={e => setMotif(e.target.value)} className="px-1 py-1 text-[11px] border border-[#E7E7EB] rounded">
                {motifs.map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
              </select>
              <button onClick={fetchElements} className="px-2 py-1 text-[11px] text-white bg-[#7B61FF] rounded">筛</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2">
              {loading && <div className="col-span-2 text-center text-[11px] text-[#9A9A9A] py-6">加载中…</div>}
              {!loading && elements.length === 0 && <div className="col-span-2 text-center text-[11px] text-[#9A9A9A] py-6">暂无元件</div>}
              {elements.map(it => (
                <button key={it.id} onClick={() => addToSlot(it)} title={`点击挂到「${SLOTS.find(s => s.key === activeSlot)?.label}」`}
                  className="border border-[#F0F0F0] rounded-[6px] p-2 hover:border-[#7B61FF] transition-colors text-left">
                  <div className="flex items-center gap-1.5 mb-1">
                    {(it.url && /\.(svg|png|jpg|jpeg|gif|webp)$/i.test(it.url)) ? (
                      <img src={it.url} alt={it.name} className="w-8 h-8 object-contain rounded bg-[#F6F7F8]" />
                    ) : <div className="w-8 h-8 rounded bg-[#7B61FF]/10 text-[#7B61FF] flex items-center justify-center text-[9px]">元件</div>}
                    <span className="text-[11px] font-medium text-[#353535] truncate">{it.name}</span>
                  </div>
                  <span className="text-[9px] text-[#9A9A9A]">{it.applicable || '—'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 中：槽位预览 */}
          <div className="flex-1 flex flex-col items-center justify-center bg-[#F6F7F8] p-6 overflow-auto">
            <div className="w-[640px] max-w-full aspect-[16/9] bg-white rounded-[12px] shadow-md relative overflow-hidden border border-[#E7E7EB]">
              {/* 背景 */}
              {slots.background && <div className="absolute inset-0" style={{ backgroundImage: `url(${slots.background})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.18 }} />}
              {/* 页眉 */}
              <div className="absolute top-0 left-0 right-0 h-[18%] flex items-center justify-center gap-2">
                {(slots.header || []).map((it, i) => <img key={i} src={it.url} alt={it.name} className="max-h-[80%] max-w-[40%] object-contain drop-shadow" />)}
              </div>
              {/* 页脚 */}
              <div className="absolute bottom-0 left-0 right-0 h-[18%] flex items-center justify-center gap-2">
                {(slots.footer || []).map((it, i) => <img key={i} src={it.url} alt={it.name} className="max-h-[80%] max-w-[40%] object-contain drop-shadow" />)}
              </div>
              {/* 四角 */}
              {['tl', 'tr', 'bl', 'br'].map((pos, i) => {
                const it = (slots.corners || [])[i]
                const style: React.CSSProperties = pos === 'tl' ? { top: '4%', left: '4%' } : pos === 'tr' ? { top: '4%', right: '4%' } : pos === 'bl' ? { bottom: '4%', left: '4%' } : { bottom: '4%', right: '4%' }
                return it ? <img key={pos} src={it.url} alt={it.name} className="absolute max-w-[14%] max-h-[14%] object-contain drop-shadow" style={style} /> : null
              })}
              {/* 浮动 */}
              {(slots.floating || []).map((it, i) => {
                const style: React.CSSProperties = i === 0 ? { top: '42%', left: '8%' } : i === 1 ? { top: '58%', right: '8%' } : { top: '30%', right: '10%' }
                return <img key={i} src={it.url} alt={it.name} className="absolute max-w-[16%] max-h-[16%] object-contain drop-shadow" style={style} />
              })}
              {/* 中央内容占位 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-[#BBB]">
                  <div className="text-[14px]">课件页内容区</div>
                  <div className="text-[11px] mt-1">装饰按插槽自动布局</div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-[#9A9A9A] mt-3">点击左侧元件 → 挂到当前激活插槽（橙色高亮）。系统自动布局，无需手动拖拽。</p>
          </div>

          {/* 右：插槽选择 + 已挂列表 */}
          <div className="w-[260px] border-l border-[#F0F0F0] flex flex-col">
            <div className="px-3 py-2 border-b border-[#F0F0F0] text-[12px] font-semibold text-[#353535]">装饰插槽</div>
            <div className="p-2 flex flex-col gap-1">
              {SLOTS.map(s => {
                const cnt = s.key === 'background' ? (slots.background ? 1 : 0) : ((slots[s.key] as DecorItem[] | undefined)?.length || 0)
                return (
                  <button key={s.key} onClick={() => setActiveSlot(s.key)}
                    className={`px-3 py-2 text-left rounded-[6px] text-[12px] ${activeSlot === s.key ? 'bg-[#7B61FF] text-white' : 'bg-[#F6F7F8] text-[#353535] hover:bg-[#EFEAFD]'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.label}</span>
                      <span className={`text-[10px] ${activeSlot === s.key ? 'text-white/80' : 'text-[#9A9A9A]'}`}>{cnt}</span>
                    </div>
                    <div className={`text-[10px] ${activeSlot === s.key ? 'text-white/70' : 'text-[#9A9A9A]'}`}>{s.hint}</div>
                  </button>
                )
              })}
            </div>
            <div className="px-3 py-2 border-t border-b border-[#F0F0F0] text-[12px] font-semibold text-[#353535] flex items-center justify-between">
              <span>「{SLOTS.find(s => s.key === activeSlot)?.label}」已挂</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              {activeSlot === 'background' && slots.background && (
                <div className="flex items-center gap-2 text-[11px] p-2 bg-[#F6F7F8] rounded">
                  <span className="truncate flex-1">{slots.background}</span>
                  <button onClick={() => removeFromSlot('background', 0)} className="text-[#d93636]">移除</button>
                </div>
              )}
              {activeSlot !== 'background' && ((slots[activeSlot] as DecorItem[] | undefined) || []).map((it, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] p-2 bg-[#F6F7F8] rounded">
                  <img src={it.url} alt={it.name} className="w-6 h-6 object-contain" />
                  <span className="truncate flex-1">{it.name}</span>
                  <button onClick={() => removeFromSlot(activeSlot, i)} className="text-[#d93636]">移除</button>
                </div>
              ))}
              {activeSlot !== 'background' && ((slots[activeSlot] as DecorItem[] | undefined) || []).length === 0 && (
                <div className="text-[11px] text-[#9A9A9A] text-center py-4">点击左侧元件挂载</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
