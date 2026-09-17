/**
 * 装饰元件领域 hook（P0-1 拆分 God Component 的第一步 · 2026-09-16）
 *
 * 从 `CoursewareBuilder.tsx`（2,576 行 / 61 个 useState）里切出**最内聚**的装饰簇：
 * 状态 = 装饰列表/筛选条件/画布选中项/面板开关/AI 推荐；
 * 动作 = 加载、替换、AI 推荐、单条应用、一键应用。
 *
 * 拆分原则：
 *   1. **对外零侵入**：返回的字段名与原先组件内的命名完全一致，JSX 与其它调用点无需改动。
 *   2. **不做行为变更**：逻辑逐行搬迁，仅把对外部的读取改成入参（`docSlide` / `contentLen` / `cwFormat` / `genStyleTag`）。
 *   3. 写操作一律走传入的 `setCwOutline`（函数式更新），避免陈旧闭包。
 */
import { useState } from 'react'
import { decorAPI, notifyError, type MaterialItem, type DecorItem, type DecorSlots } from '../lib/api'
import { H5_TEMPLATES, PPT_TEMPLATES, STYLE_LABELS, templateColorTags, templateStyleTags } from '../lib/cwTemplate'
import type { OutlineSlide } from '../lib/exportPptx'
import type { DecorSelection } from '../components/PptxPreview'
import { useToast } from '../components/Toast'

export interface UseCwDecorOpts {
  /** 当前正在编辑的正文页下标（封面为整本索引 0，不在 outline 内） */
  docSlide: number
  /** 当前是否停在**封面**页（`deckIdx === 0`）。封面不在 outline 内 → 替换要写到封面装饰里（③） */
  deckIsCover: boolean
  /** 封面装饰写入口（③）：封面素材的真源在 CoursewareBuilder 的 coverDecor 状态 */
  setCoverDecor: React.Dispatch<React.SetStateAction<DecorSlots | null>>
  /** 写提纲（唯一写入口；函数式更新） */
  setCwOutline: React.Dispatch<React.SetStateAction<OutlineSlide[]>>
  /** 提纲长度（`cwOutline.length`） */
  contentLen: number
  cwFormat: 'ppt' | 'h5' | 'video'
  genStyleTag: string
  /** 当前已套用模板 id 的 ref（套版后读取最新值，避免闭包陷阱）；未套模板时为 null */
  tplAppliedIdRef: { current: string | null }
}

export function useCwDecor({
  docSlide, setCwOutline, contentLen, cwFormat, genStyleTag, tplAppliedIdRef,
  deckIsCover, setCoverDecor,
}: UseCwDecorOpts) {
  // toast 走 Context（与组件内原来的 `useToast()` 一致），保证提示位置/样式统一
  const { toast } = useToast()
  const [decorElems, setDecorElems] = useState<MaterialItem[]>([])
  const [decorScope, setDecorScope] = useState<'public' | 'mine'>('public')
  const [decorMedium, setDecorMedium] = useState('')
  /** 画布上当前选中的装饰（由 PptxPreview 冒泡） */
  const [selDecor, setSelDecor] = useState<DecorSelection | null>(null)
  /** 替换面板开关 */
  const [decorPickerOpen, setDecorPickerOpen] = useState(false)

  const loadDecorElems = (sc: 'public' | 'mine', medium = '') => {
    setDecorScope(sc)
    setDecorMedium(medium)
    decorAPI.list({ scope: sc, medium: medium || undefined, motif: undefined, color: undefined, pageType: undefined })
      .then(res => setDecorElems(res.items || []))
      .catch(e => notifyError('装饰元件加载失败', e))
  }

  /** 纯函数：把「选中槽位/索引」替换为 it —— 封面与内容页共用同一套槽位语义，故抽出复用 */
  const applySlotReplace = (cur: DecorSlots, it: DecorItem, sel: DecorSelection): DecorSlots => {
    if (sel.slot === 'background') return { ...cur, background: it.url || '' }
    const key = sel.slot === 'corner' ? 'corners' : sel.slot
    const list = (cur as Record<string, unknown>)[key] as DecorItem[] || []
    return { ...cur, [key]: list.map((x: DecorItem, j: number) => (j === sel.index ? it : x)) }
  }

  /** 替换当前选中的装饰：把素材库选中的元件写入选中装饰所在的槽位/索引 */
  const replaceDecorAt = (it: MaterialItem) => {
    if (!selDecor) return
    const item: DecorItem = { id: it.id, url: it.url || '', name: it.name }
    // 封面分支（③，2026-09-17）：封面是渲染时合成的、**不在 outline 内** → 写封面装饰状态，
    // 由 CoursewareBuilder 在保存时写回 markdown 的 CW-COVER 注释。内容页仍走原路不变。
    // 判据用「当前是否停在封面页」而非选中项本身：DecorSelection 只有 {slot,index}，
    // 本就没有"哪一页"的标记（也无需扩展）。
    if (deckIsCover) {
      setCoverDecor(cur => applySlotReplace(cur || {}, item, selDecor))
      toast(`已替换封面装饰为「${it.name}」`, 'success')
      setDecorPickerOpen(false)
      return
    }
    const idx = docSlide
    setCwOutline(arr => arr.map((s, i) => (i !== idx ? s : { ...s, decor: applySlotReplace(s.decor || {}, item, selDecor) })))
    toast(`已替换装饰为「${it.name}」`, 'success')
    setDecorPickerOpen(false)
  }

  // ── AI 装饰推荐：套模板后按模板风格/色系 facet 自动匹配装饰元件 ──
  // 推荐结果先存 state，在「替换装饰」面板顶部展示，用户确认后应用（不静默写页面）。
  const [aiDecorating, setAiDecorating] = useState(false)
  const [aiDecorSuggestions, setAiDecorSuggestions] = useState<MaterialItem[]>([])

  /** motif/color 字段值与后端 materials.motif_root / color_root 一致（中文 label，如"国风"/"红金系"） */
  const fetchAiDecorSuggestions = async (
    styleLabels?: string[], colorIds?: string[], excludeNames?: string[], medium?: string,
  ) => {
    const motif = (styleLabels && styleLabels.length ? styleLabels.join(',') : undefined)
    const color = (colorIds && colorIds.length ? colorIds.join(',') : undefined)
    if (!motif && !color) return
    setAiDecorating(true)
    try {
      const res = await decorAPI.list({ scope: 'public', motif, color, medium: medium || undefined })
      const items = (res.items || []).filter(it => !(excludeNames || []).includes(it.name))
      if (!items.length) { toast('暂无更多匹配该风格的装饰元件', 'info'); return }
      setAiDecorSuggestions(items.slice(0, 4))
      toast(`已生成 ${items.slice(0, 4).length} 个 AI 装饰推荐（在装饰面板中查看）`, 'success')
    } catch (e) {
      notifyError('AI 装饰推荐失败', e)
    } finally {
      setAiDecorating(false)
    }
  }

  /** 手动「智能配饰」：按当前已套用模板的风格/色系 + 媒介匹配装饰（B 方案，不自动弹） */
  const smartMatchDecor = () => {
    const pool = cwFormat === 'h5' ? H5_TEMPLATES : PPT_TEMPLATES
    const tpl = pool.find(t => t.id === tplAppliedIdRef.current) || null
    const styleTags = tpl ? templateStyleTags(tpl) : (genStyleTag ? [genStyleTag] : [])
    if (!styleTags.length && !(tpl && templateColorTags(tpl).length)) {
      toast('请先套用模板或选择课件风格', 'info'); return
    }
    fetchAiDecorSuggestions(
      styleTags.map(s => STYLE_LABELS[s as keyof typeof STYLE_LABELS] || s),
      tpl ? templateColorTags(tpl) : undefined,
      tpl ? (tpl.globalDecor || []).map(d => d.name).filter(Boolean) as string[] : undefined,
      cwFormat === 'h5' ? 'h5' : 'ppt',
    )
  }

  /** 应用单个 AI 推荐装饰到当前页的浮动区（若当前页已有浮动装饰则追加） */
  const applyDecorSuggestion = (it: MaterialItem) => {
    const item: DecorItem = { id: it.id, url: it.url || '', name: it.name }
    const appendFloating = (cur: DecorSlots): DecorSlots => ({ ...cur, floating: [...(cur.floating || []), item] })
    // 封面分支（③）：同 replaceDecorAt，封面不在 outline 内
    if (deckIsCover) {
      setCoverDecor(cur => appendFloating(cur || {}))
      toast(`已应用装饰「${it.name}」到封面`, 'success')
      return
    }
    const idx = docSlide
    setCwOutline(arr => arr.map((s, i) => (i !== idx ? s : { ...s, decor: appendFloating(s.decor || {}) })))
    toast(`已应用装饰「${it.name}」到当前页`, 'success')
  }

  /** 一键应用全部推荐：给所有内容页（封面除外）的浮动区追加推荐装饰（轮转） */
  const applyAllDecorSuggestions = () => {
    const picks = aiDecorSuggestions
    if (!picks.length) { toast('暂无 AI 推荐', 'info'); return }
    // ★ 先同步计算应用页数（不能在 setCwOutline 回调里累加，回调异步执行会导致 applied 恒为 0）
    const len = Math.max(0, contentLen - 1)
    if (len === 0) { toast('请先生成课件内容', 'info'); return }
    setCwOutline(arr => arr.map((s, i) => {
      if (i === 0) return s // 封面保持干净
      const it = picks[i % picks.length]
      const item: DecorItem = { id: it.id, url: it.url || '', name: it.name }
      const cur: DecorSlots = s.decor || {}
      const floating = cur.floating || []
      // 仅避免同名重复（同页已有该推荐元件则跳过），其余页一律追加（即使已有模板内置装饰）
      if (floating.some(f => f.name === item.name)) return s
      return { ...s, decor: { ...cur, floating: [...floating, item] } }
    }))
    toast(`已应用 AI 推荐装饰到 ${len} 个内容页（每页按风格轮转）`, 'success')
  }

  return {
    decorElems, decorScope, decorMedium,
    selDecor, setSelDecor, decorPickerOpen, setDecorPickerOpen,
    loadDecorElems, replaceDecorAt,
    aiDecorating, aiDecorSuggestions, fetchAiDecorSuggestions,
    smartMatchDecor, applyDecorSuggestion, applyAllDecorSuggestions,
  }
}
