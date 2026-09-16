/**
 * 替换装饰元件弹层（2026-09-16 从 CoursewareBuilder.tsx 移出，抽组件第一步）
 *
 * 原本是页面文件里的**模块级组件**（83 行），全屏态与非全屏态共用（两处调用点）。
 * 它是纯展示 + 回调：所有数据（装饰列表、筛选条件、AI 推荐）都由 props 传入，
 * 唯一依赖是 `MaterialItem` 类型，因此移出时**无需任何行为变更**。
 */
import type { MaterialItem } from '../lib/api'

/** 替换装饰面板：浮层在编辑层最外层（z-90），全屏态与非全屏态共用。
 *  从素材库装饰元件挑一个替换当前选中的装饰图（slot + index）。
 *  顶部「AI 推荐」分组：按模板风格/色系 facet 自动匹配的推荐装饰，可一键应用。
 *  设计意图：装饰是画布上的可编辑元素，替换入口与画布选中态绑定。 */
export function DecorPickerModal({
  open, onClose, decorElems, decorScope, decorMedium, onScopeChange, onMediumChange, onPick,
  suggestions, onApplySuggestion, onApplyAll, onSmartMatch, smartMatching,
}: {
  open: boolean
  onClose: () => void
  decorElems: MaterialItem[]
  decorScope: 'public' | 'mine'
  decorMedium: string
  onScopeChange: (s: 'public' | 'mine') => void
  onMediumChange: (m: string) => void
  onPick: (it: MaterialItem) => void
  suggestions?: MaterialItem[]
  onApplySuggestion?: (it: MaterialItem) => void
  onApplyAll?: () => void
  onSmartMatch?: () => void
  smartMatching?: boolean
}) {
  if (!open) return null
  const hasSuggest = suggestions && suggestions.length > 0
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg w-[520px] max-h-[70vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#F0F0F0] flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[#353535]">替换装饰元件</h3>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#353535] text-[18px] leading-none">×</button>
        </div>
        {/* AI 推荐分组（手动触发：按当前模板风格/色系 facet 匹配，套模板不自动弹） */}
        <div className="px-4 py-2.5 border-b border-[#F0F0F0] bg-[#F8FAFF]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-medium text-[#02A7F0]">✨ AI 智能配饰（按风格匹配素材库）</span>
            <button onClick={onSmartMatch} disabled={smartMatching}
              className="text-[11px] px-2 py-0.5 rounded border border-[#02A7F0] text-[#02A7F0] hover:bg-[#02A7F0] hover:text-white disabled:opacity-50 transition-colors">
              {smartMatching ? '匹配中…' : '智能配饰'}
            </button>
          </div>
          {hasSuggest ? (
            <div className="flex gap-2 flex-wrap">
              {suggestions!.map(it => (
                <button key={it.id} onClick={() => onApplySuggestion?.(it)}
                  className="flex items-center gap-1 px-2 py-1 rounded border border-[#02A7F0]/40 bg-white hover:border-[#02A7F0] transition-colors">
                  {(it.url && /\.(svg|png|jpg|jpeg|gif|webp|data:image)/i.test(it.url)) ? (
                    <img src={it.url} alt={it.name} className="w-6 h-6 object-contain" />
                  ) : <div className="w-6 h-6 rounded bg-[#7B61FF]/10 flex items-center justify-center text-[8px] text-[#7B61FF]">元件</div>}
                  <span className="text-[10px] text-[#353535]">{it.name}</span>
                </button>
              ))}
              <button onClick={onApplyAll} className="self-center text-[11px] text-[#02A7F0] hover:underline ml-1">一键应用到全部内容页</button>
            </div>
          ) : (
            <span className="text-[11px] text-[#9A9A9A]">点击「智能配饰」按当前风格自动匹配装饰元件（可选增强，不覆盖模板内置装饰）</span>
          )}
        </div>
        <div className="px-4 py-2 border-b border-[#F0F0F0] flex items-center gap-2 flex-wrap">
          {(['public', 'mine'] as const).map(s => (
            <button key={s} onClick={() => onScopeChange(s)}
              className={`px-2.5 py-1 text-[12px] rounded ${decorScope === s ? 'bg-[#7B61FF] text-white' : 'bg-[#F6F7F8] text-[#6B6B6B]'}`}>
              {s === 'public' ? '平台公共库' : '我的素材'}
            </button>
          ))}
          <select value={decorMedium} onChange={e => onMediumChange(e.target.value)} className="px-2 py-1 text-[12px] border border-[#E7E7EB] rounded">
            {[{ k: '', l: '全部媒介' }, { k: 'ppt', l: 'PPT' }, { k: 'h5', l: 'H5' }, { k: 'common', l: '通用' }].map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 grid grid-cols-3 gap-3">
          {decorElems.length === 0 && <div className="col-span-3 text-center text-[12px] text-[#9A9A9A] py-8">暂无装饰元件</div>}
          {decorElems.map(it => (
            <button key={it.id} onClick={() => onPick(it)}
              className="border border-[#F0F0F0] rounded-[6px] p-2 hover:border-[#7B61FF] transition-colors text-left">
              <div className="flex items-center gap-1.5 mb-1">
                {(it.url && /\.(svg|png|jpg|jpeg|gif|webp|data:image)/i.test(it.url)) ? (
                  <img src={it.url} alt={it.name} className="w-8 h-8 object-contain rounded bg-[#F6F7F8]" />
                ) : <div className="w-8 h-8 rounded bg-[#7B61FF]/10 text-[#7B61FF] flex items-center justify-center text-[9px]">元件</div>}
                <span className="text-[11px] font-medium text-[#353535] truncate">{it.name}</span>
              </div>
              <span className="text-[9px] text-[#9A9A9A]">{it.applicable || '—'}{it.motif_root ? ` · ${it.motif_root}` : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
