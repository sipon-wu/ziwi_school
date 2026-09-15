/**
 * 小微「换风格 / 换模板」指令 —— **单一事实源**（2026-09-14）。
 *
 * 为什么单独成模块：小微在两处出现 —— 课件编辑器里是 `EditXiaoWeiPanel`（"请补充要求…"入口），
 * 其他页是 `XiaoWeiChat`（AppLayout 全局）。两处必须同一口径：同样的命中规则、同样的回报文案，
 * 否则教师会看到"同一个指令两个答案"。
 *
 * 为什么不让模型做：换模板是**纯确定性**操作（只换风格语汇：配色 / 标题形态 / 底纹 / 装饰，
 * 文字与排版位置一个字不动）。交给模型重新生成 → 内容漂移 + 花 1~3 分钟 + 花钱
 * （实测返修循环还会 4→10→8 反弹）。行业分级里"整页重绘"是最低一级，这正是我们要避开的。
 */
import { STYLE_LABELS, type StyleTag } from './cwTemplate'

/** 风格词 → 风格标签。**必须同时出现"切换动词"才命中**，避免抢生成意图的活。 */
export const STYLE_KEYWORDS: [RegExp, StyleTag][] = [
  [/国风|中国风|中式|古典|水墨|青花/, 'china'],
  [/科技|未来感|赛博|数码|太空/, 'tech'],
  [/清新|自然|绿意|清爽/, 'fresh'],
  [/素净|简约|极简|性冷淡/, 'minimal'],
  [/严谨|学术|学院/, 'academic'],
  [/卡通|童趣|可爱/, 'cartoon'],
  [/扁平/, 'flat'],
  [/沉稳|商务|企业/, 'business'],
]

export interface TemplateIntent {
  hit: boolean
  styleTag?: StyleTag
  label?: string
  /** 真=恢复到上一个风格（revertTemplate） */
  revert?: boolean
}

/**
 * 识别"换风格"意图。
 * 命中条件：**切换动词 + 风格词**（或明确的"换回/撤销上一个风格"）。
 * 只说风格（"做个国风的课件"）属于**生成**意图 → 这里返回 hit:false，不抢它的活。
 */
export function detectTemplateIntent(text: string): TemplateIntent {
  if (/换回|恢复到?上一个|撤销.{0,4}(风格|模板)|上一个(风格|模板)/.test(text)) return { hit: true, revert: true }
  if (!/换|替换|切换|改成|改为|变成|调成/.test(text)) return { hit: false }
  for (const [re, tag] of STYLE_KEYWORDS) {
    if (re.test(text)) return { hit: true, styleTag: tag, label: STYLE_LABELS[tag] }
  }
  // 只说"换个风格"但没指定哪种 → 回可选清单（同样不调模型）
  return /风格|模板|配色|版面/.test(text) ? { hit: true } : { hit: false }
}

/** 事件名：课件编辑器监听它，用与模板库按钮**同一条**确定性路径（applyTemplate / reflowToSkeleton）执行 */
export const SWITCH_STYLE_EVENT = 'zhiwei:switch-style'

/** 强度档：light=只换风格语汇（位置不动）；heavy=重新套版（按新骨架重排位置与尺寸） */
export type SwitchLevel = 'light' | 'heavy'

export interface SwitchImpact {
  /** 会被重排的页数 */
  pages: number
  /** 会被重排的元素数 */
  elements: number
}

/**
 * 派发换风格指令（**同步握手**）。
 *
 * 用 `window` 同步派发：监听者在 dispatch 期间就会把 `handled` / `impact` / `error` 写回，
 * 因此小微能**如实**回报"已切换"、"影响 N 页 / M 个元素"还是"当前不在课件编辑器里" —— 不是猜。
 *
 * `dryRun: true` 时编辑器**只预演不落地**（用于二次确认里报出真实影响范围）。
 */
export async function requestStyleSwitch(req: {
  styleTag?: StyleTag; revert?: boolean; level?: SwitchLevel; dryRun?: boolean
}): Promise<{ handled: boolean; error?: string; impact?: SwitchImpact; snapshot?: boolean }> {
  const detail: {
    styleTag?: StyleTag; revert?: boolean; level?: SwitchLevel; dryRun?: boolean
    handled: boolean; error?: string; impact?: SwitchImpact; snapshot?: boolean
    /** 监听者处理完（含异步的版本快照）后调用，用来结束等待 */
    resolve?: () => void
  } = { ...req, revert: !!req.revert, level: req.level || 'light', handled: false }

  // ⚠️ 必须**可等待**：编辑器在执行前要异步存版本快照（POST /versions）。
  // 而 `dispatchEvent` **不会等 await** —— 若照旧"派发完立刻读 handled"，
  // 小微会在快照还没存完时就读到 handled=false，回报"要在编辑器里做"，
  // 可后台其实已经执行了（实测踩到：回复与实际不一致）。
  // 故：细节里带一个 resolve 回调，监听者处理完（含异步收尾）调用它结束等待；
  // 4s 兜底超时，保证没有监听者/监听者异常时小微也不会卡住。
  let done: () => void = () => {}
  const waited = new Promise<void>((res) => { done = res })
  detail.resolve = done
  try {
    window.dispatchEvent(new CustomEvent(SWITCH_STYLE_EVENT, { detail }))
  } catch { /* 派发失败按"未处理"对待，如实回报 */ }
  await Promise.race([waited, new Promise((r) => setTimeout(r, 4000))])
  return { handled: detail.handled, error: detail.error, impact: detail.impact, snapshot: detail.snapshot }
}

// ── 固定话术（两处面板共用同一口径；教师看到的是可预期的话，不是模型自由发挥）──

/** 第一步：请教师选强度档 */
export function styleAskText(label: string): string {
  return `换成「${label}」有两种强度，请回复 **1** 或 **2** 选择：\n`
    + '1）**轻**：只换风格语汇（配色 / 标题形态 / 底纹 / 装饰）—— 文字、字号、每个元素的位置都不动。**零风险，推荐**。\n'
    + '2）**重**：重新套版 —— 除风格语汇外，还会把元素**按新骨架的槽位重排位置与尺寸**（不改文字、字号、配色）。版面会变。'
}

/** 第二步：二次确认 + 风险/开销提示（重档要带上预演出来的真实影响范围） */
export function styleConfirmText(label: string, level: SwitchLevel, r: { handled: boolean; error?: string; impact?: SwitchImpact }): string {
  if (!r.handled) {
    return r.error
      ? `没能预演影响范围：${r.error}。`
      : '换风格要在课件编辑器里做。请先打开一份课件（教学课件 → PPT 课件 → 编辑），再对我说一次。'
  }
  if (level === 'light') {
    return `请确认：「轻 · 只换风格语汇」→ 换成「${label}」。\n`
      + '· 会变：配色 / 标题形态 / 底纹 / 装饰\n'
      + '· 不会变：文字、字号、每个元素的位置与尺寸\n'
      + '· 开销：0 token，即时完成（不调模型、不重新生成内容）\n'
      + '· 可回退：执行前会**自动存一份版本快照**（右侧「版本」栏可一键回到；保存或刷新后依然可用）\n'
      + '确认执行吗？回复 **确认** 执行，或回复 **取消**。'
  }
  const im = r.impact || { pages: 0, elements: 0 }
  return `请确认：「重 · 重新套版」→ 换成「${label}」并按新骨架重排。\n`
    + `· 影响范围（已预演、尚未执行）：**${im.pages} 页 / ${im.elements} 个元素**会被重排位置与尺寸\n`
    + '· 不会变：文字内容、字号、配色\n'
    + '· 风险：早期课件没有"是否手工调整过"的记录，**你以前手工挪过的位置也会被重排**\n'
    + '· 开销：0 token，即时完成（不调模型、不重新生成内容）\n'
    + '· 可回退：执行前会**自动存一份版本快照**（右侧「版本」栏可一键回到；保存或刷新后依然可用）\n'
    + '确认执行吗？回复 **确认** 执行，或回复 **取消**。'
}

/** 最终回报（`snapshot` = 执行前**版本快照是否保存成功** —— 决定"可回退"是真承诺还是仅限本次会话）*/
export function styleDoneText(
  label: string, level: SwitchLevel, r: { handled: boolean; error?: string; snapshot?: boolean },
): string {
  if (!r.handled) {
    return r.error
      ? `没能换风格：${r.error}`
      : '换风格要在课件编辑器里做。请先打开一份课件（教学课件 → PPT 课件 → 编辑），再对我说一次。'
  }
  const undo = r.snapshot === false
    // 快照失败时**如实降级承诺**：不装作"随时可回退"
    ? '\n注意：版本快照没存上（未保存的草稿或后端拒绝），所以"换回上一个风格"**只在本次编辑会话内有效**；'
      + '建议先点「保存草稿」再换风格。'
    : `\n执行前已自动存了一份版本快照（右侧「版本」栏可一键回到；保存或刷新后依然可用），也可以直接说"换回上一个风格"。`
  return (level === 'heavy'
    ? `已换成「${label}」风格，并按新骨架重排了元素的位置与尺寸（文字、字号、配色未动）。`
    : `已把当前课件换成「${label}」风格 —— 只换风格语汇（配色 / 标题形态 / 底纹 / 装饰），你的文字和排版位置一个字没动。`)
    + undo
}

export const STYLE_CANCEL_TEXT = '已取消，什么都没有改动。'

/** 无风格词的兜底话术 */
export const STYLE_LIST_TEXT = '想换成哪种风格？可选：国风 / 科技 / 清新 / 素净 / 严谨 / 卡通 / 扁平 / 沉稳 —— 例如"换成国风风格"。'

// ── 多轮流程：纯函数，两处面板共用（避免"一个指令两个答案"）──

export interface StyleFlowState {
  styleTag?: StyleTag
  label?: string
  level?: SwitchLevel
  stage: 'choose' | 'confirm'
}

export type StyleFlowStep =
  | { kind: 'confirmAsk'; level: SwitchLevel }             // 选好档 → 回二次确认（需先预演影响范围）
  | { kind: 'execute'; level: SwitchLevel }                // 确认 → 执行
  | { kind: 'cancelled' }
  | null                                                   // 与流程无关 → 交回正常处理

function detectLevelChoice(text: string): SwitchLevel | null {
  if (/^\s*(1|一|轻|只换风格|不改位置|第一种)\s*$/.test(text) || /轻档|选\s*1/.test(text)) return 'light'
  if (/^\s*(2|二|重|重新套版|重排|第二种)\s*$/.test(text) || /重档|选\s*2|重新排版/.test(text)) return 'heavy'
  return null
}
const CONFIRM_RE = /^\s*(确认|确定|执行|开始|可以|好|是|同意|继续|就这么办)\s*[。.!！]?\s*$/
const CANCEL_RE = /^\s*(取消|算了|不用了|先不|别换|不要|停止)\s*[。.!！]?\s*$/

/**
 * 推进换风格流程一步。
 * 返回 null 表示"与当前流程无关"——调用方应继续走正常处理（新指令 / 模型）。
 * 注意顺序：**先判确认/取消/改档，再判新指令**，否则"确认换成国风"会被当成新指令而重开流程。
 */
export function styleFlowStep(state: StyleFlowState | null, text: string): StyleFlowStep {
  if (!state) return null
  if (state.stage === 'choose') {
    if (CANCEL_RE.test(text)) return { kind: 'cancelled' }
    const lv = detectLevelChoice(text)
    if (lv) return { kind: 'confirmAsk', level: lv }
    return null
  }
  // stage === 'confirm'
  if (CONFIRM_RE.test(text)) return { kind: 'execute', level: state.level || 'light' }
  if (CANCEL_RE.test(text)) return { kind: 'cancelled' }
  const lv = detectLevelChoice(text)
  if (lv) return { kind: 'confirmAsk', level: lv }          // 改主意改档
  return null
}

/** 恢复上一个风格的回报（低风险动作，不做多轮确认） */
export const STYLE_REVERT_DONE = '已恢复到上一个风格（只换风格语汇，你的文字与排版位置没动）。'
