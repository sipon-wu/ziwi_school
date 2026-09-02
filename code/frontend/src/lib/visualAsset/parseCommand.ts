/**
 * 修改指令 → 结构化校准信号
 *
 * 用户在小微里说的是人话（"云朵太多了""树叶换小一点"），
 * 这里把它解析成 AssetFeedback，供：
 *   通道 A（同步）当场调整当前课件
 *   通道 B（异步）落入反馈池，累积后校准该资产在该风格下的默认参数
 *
 * 实现选择：**规则引擎优先，不调用 LLM**。
 * 理由：① 指令模式高度集中，规则覆盖率高且零延迟零成本
 *      ② 归因必须可解释——"为什么把默认值从 5 改成 2"要能追溯到具体原话
 *      ③ 规则未命中时返回 null，交由上层决定是否交给 LLM，不做猜测
 */

import type { AssetFeedback, FeedbackOp, FeedbackType } from './types'
import { DECOR_ASSETS } from './presets'

/** 解析所需的上下文，由小微从当前焦点组装；本模块不依赖上层，保持单向依赖 */
export interface CommandContext {
  /** 当前聚焦的资产（用户说"这个"时指代的对象） */
  assetId?: string
  styleId?: string
  renderer?: string
}

/** 参数关键词 → 参数名（按优先级排列，先命中者生效） */
const PARAM_HINTS: Array<[RegExp, string]> = [
  [/太多|太少|太密|太疏|多|少|密|疏|数量|个数|个|朵|片/, 'count'],
  [/太大|太小|大一点|小一点|大|小|尺寸|缩放|变细|变粗/, 'scale'],
  [/淡|浓|透明|明显|清楚|模糊|太亮|太暗/, 'opacity'],
]

/** 操作关键词 → 方向；顺序敏感，disable 必须最先匹配 */
const OP_HINTS: Array<[RegExp, FeedbackOp]> = [
  [/不要|去掉|删掉|移除|别放|取消/, 'disable'],
  [/太多|过密|密|少一点|少一些|减少|减一点|淡一点|小一点|收缩/, 'decrease'],
  [/太少|太疏|多一点|多一些|增加|加一点|浓一点|大一点|放.*大/, 'increase'],
]

/** 审美偏好：只写个人画像，绝不改全局默认值 */
const PREFERENCE_HINTS = /不喜欢|难看|丑|不好看|更喜欢|还是.*好|想要.*感觉/
/** 内容问题：指向教学内容而非资产，不入池 */
const CONTENT_HINTS = /例子|这道题|内容|题目|这句话|这段|讲得|知识点/

/** 资产名/别名 → assetId */
const NAME_TO_ID = new Map<string, string>()
for (const a of DECOR_ASSETS) {
  NAME_TO_ID.set(a.name, a.id)
  NAME_TO_ID.set(a.id, a.id)
}

function matchAsset(text: string, ctx: CommandContext): string | undefined {
  // 1) 文本里直接点名（"云朵太多"）
  for (const [name, id] of NAME_TO_ID) {
    if (text.includes(name)) return id
  }
  // 2) 指代词（"这个太多了"）依赖焦点
  if (/(这个|这些|它|这个元素|这个装饰)/.test(text)) return ctx.assetId
  // 3) 焦点存在且指令明确指向装饰参数，则归因到焦点资产
  const hasDecorParam = PARAM_HINTS.some(([re]) => re.test(text))
  return hasDecorParam ? ctx.assetId : undefined
}

function matchParam(text: string): string | undefined {
  for (const [re, param] of PARAM_HINTS) {
    if (re.test(text)) return param
  }
  return undefined
}

function matchOp(text: string): FeedbackOp | undefined {
  for (const [re, op] of OP_HINTS) {
    if (re.test(text)) return op
  }
  return undefined
}

function classify(text: string): FeedbackType {
  if (CONTENT_HINTS.test(text)) return 'content'
  if (PREFERENCE_HINTS.test(text)) return 'preference'
  return 'defect'
}

/**
 * 解析一条用户指令。
 * @returns 结构化信号；无法归因时返回 null（由上层决定是否交给 LLM）
 */
export function parseDecorCommand(
  raw: string,
  ctx: CommandContext = {},
): AssetFeedback | null {
  const text = (raw || '').trim()
  if (!text) return null

  const assetId = matchAsset(text, ctx)
  if (!assetId) return null

  const op = matchOp(text)
  if (!op) return null

  const param = matchParam(text)
  // 参数未识别时退回 count（"太多了"最常见的落点）；
  // disable 同样落在 count 上，下游统一按「数量归零」处理，无需分支
  const resolvedParam = param ?? 'count'

  // 置信度：点名资产 > 依赖焦点；识别出参数 > 退回 count
  let confidence = 0.9
  if (!(text.includes(assetId) || NAME_TO_ID.has(text))) {
    const named = [...NAME_TO_ID.keys()].some((n) => text.includes(n))
    if (!named) confidence = 0.75
  }
  if (!param) confidence = Math.min(confidence, 0.7)

  return {
    assetId,
    styleId: ctx.styleId,
    param: resolvedParam,
    op,
    type: classify(text),
    confidence,
    renderer: ctx.renderer,
  }
}
