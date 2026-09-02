/**
 * 课件视觉资产 —— 数据契约
 *
 * 对应《课件视觉资产架构方案.md》的四层模型：
 *   ① 风格 StyleDNA   人类定，快照进课件
 *   ② 结构 StructureSpec  Skills 跟随纲要自选，快照进课件
 *   ③ 装饰 DecorAsset / DecoSpec  资产库引用，快照进课件
 *   ④ 渲染 RendererCapability   确定性代码，不快照
 *
 * 设计纪律：
 *   - 所有新增字段对老数据可选，缺省一律回退现有行为，保证向后兼容
 *   - 白名单校验（与 exportPptx.isValidVisual 同构），非法值静默降级而非抛错
 *   - 本文件是渲染端契约；ai-service（Python）侧按同构 JSON Schema 约束输出
 */

/* ═══════════════════════ 能力分级 ═══════════════════════ */

/**
 * 渲染能力分级：装饰效果对渲染器的要求。
 *   0 基础形状（框/线/圆/三角）—— PPT(pptxgenjs) 与 H5 均可原生表达
 *   1 CSS 效果（blob/波纹/渐变/点阵）—— 仅 H5 完整支持，PPT 降级为 Tier0 近似
 *   2 动画 / 交互 —— 仅 H5
 *
 * PPT 导出必须保持「可编辑的原生对象」而非图片，故 Tier1/2 在 PPT 端一律降级。
 */
export type CapabilityTier = 0 | 1 | 2

/** 渲染器声明自身能力上限，供装饰决策前预判是否需要降级 */
export interface RendererCapability {
  /** ppt / h5 / print ... */
  target: string
  tier: CapabilityTier
}

export const RENDERER_CAPABILITY: Record<string, RendererCapability> = {
  ppt: { target: 'ppt', tier: 0 },
  h5: { target: 'h5', tier: 2 },
}

/**
 * 降级到目标渲染器能表达的等级。
 * 超能力的装饰不会被丢弃，而是退化为最接近的可表达形态，绝不白屏。
 */
export function clampTier(tier: CapabilityTier, cap: RendererCapability): CapabilityTier {
  return (Math.min(tier, cap.tier) as CapabilityTier)
}

/* ═══════════════════════ ① 风格 DNA ═══════════════════════ */

export type Density = 'compact' | 'normal' | 'spacious'

/**
 * 风格快照 —— 生成时刻固化进课件，渲染时**只依赖它**，不再读 template_id。
 *
 * 这是防止「改模板导致历史课件外观全变」的关键：
 * templateId / templateVersion 仅用于追溯与「重新套用」，不参与渲染。
 */
export interface StyleDNA {
  /** 仅追溯用 */
  templateId: string
  /** 仅追溯用 */
  templateVersion: number
  colors: {
    primary: string
    accent?: string
    body: string
    subtle?: string
  }
  font: {
    title: string
    body: string
  }
  density: Density
  /** 该风格允许的装饰母题白名单（空 = 不限制） */
  decorVocab?: string[]
  /**
   * 渲染器最低兼容版本。
   * 渲染器大改时据此做向后兼容映射，避免老课件的装饰参数指向已废弃能力。
   */
  rendererMinVersion?: number
}

/* ═══════════════════════ ③-a 装饰外观（打破框线） ═══════════════════════ */

/**
 * 容器形态 —— 取代「所有组件都是圆角方框」的硬编码。
 * 渲染层按此计算背景/边框/圆角，而非写死 `border + 浅色底`。
 */
export type DecorContainer =
  | 'none'       // 无框，纯文字（短词首选，靠留白与字号取胜）
  | 'underline'  // 下划线（定义、强调）
  | 'leftbar'    // 左侧竖条（引文、要点）
  | 'blob'       // 不规则圆润色块（活泼、低年级）
  | 'ribbon'     // 飘带 / 斜切（荣誉、金句）
  | 'frame'      // 细边框（传统框线，保留）
  | 'dotgrid'    // 点阵背景（科技、数据）
  | 'torn'       // 手撕纸边（趣味、挑战）

export type DecorAccent = 'none' | 'circle-num' | 'badge' | 'underline-mark' | 'corner'
export type DecorConnector = 'none' | 'arrow' | 'dashed' | 'brace' | 'converge'
export type DecorMotif =
  | 'none' | 'balance' | 'ladder' | 'target' | 'funnel' | 'puzzle' | 'axis' | 'mapping' | 'cycle'

/**
 * 结构性组件的装饰外观（内容结构由 visualType 承担，这里只管长什么样）。
 * 组合数 8 × 5 × 5 × 9，全部可用 pptxgenjs 原生形状表达。
 */
export interface DecoSpec {
  container?: DecorContainer
  accent?: DecorAccent
  connector?: DecorConnector
  motif?: DecorMotif
  /** 该装饰所需的最低渲染能力，缺省按 0 处理 */
  tier?: CapabilityTier
}

export const DECOR_CONTAINERS: DecorContainer[] =
  ['none', 'underline', 'leftbar', 'blob', 'ribbon', 'frame', 'dotgrid', 'torn']
export const DECOR_ACCENTS: DecorAccent[] =
  ['none', 'circle-num', 'badge', 'underline-mark', 'corner']
export const DECOR_CONNECTORS: DecorConnector[] = ['none', 'arrow', 'dashed', 'brace', 'converge']
export const DECOR_MOTIFS: DecorMotif[] =
  ['none', 'balance', 'ladder', 'target', 'funnel', 'puzzle', 'axis', 'mapping', 'cycle']

/* ═══════════════════════ ③-b 装饰性资产 ═══════════════════════ */

export type DecorForm = 'organic' | 'geometric' | 'linear' | 'texture'
export type DecorDensity = 'single' | 'cluster' | 'scattered' | 'tiled'
export type DecorWeight = 'light' | 'medium' | 'heavy'
export type DecorTone = 'muted' | 'vivid' | 'mono'
export type DecorPlacement = 'corner' | 'edge' | 'background' | 'divider' | 'inline'

/** 资产可调参数 —— 用户能改的维度，也是命中率校准的作用点 */
export interface AssetParam {
  default: number | string | boolean
  /** 数值型参数的取值区间 */
  range?: [number, number]
  /** 枚举型参数的候选值 */
  enum?: (number | string)[]
  /** 展示单位（如 'mm'、'%'），仅用于 UI 提示 */
  unit?: string
}

/**
 * 装饰性资产 —— 树叶、云朵、点线画这类**纯视觉、不承载内容**的元素。
 *
 * 与结构性元件（数轴/天平/对比表）的根本区别：
 *   结构性元件靠 semantic + capacity 匹配；装饰资产靠**视觉特征 + 风格归属**匹配，
 *   没有强语义约束，同一片树叶放在角落或边缘都说得通。
 *
 * `defaultsByStyle` 是命中率的战场：校准的键是 `assetId × styleId`，不是 assetId——
 * 同一片树叶在「森林童趣」里默认 2 朵，在「自然生机」里可能默认 8 朵。
 */
export interface DecorAsset {
  id: string
  name: string
  /**
   * 渲染内容：emoji 或内联 SVG 片段。
   * 保持零外部依赖（不引图片资源），确保导出的 H5 自包含。
   */
  glyph: string
  /** 渲染所需最低能力；超限时按 clampTier 降级 */
  tier: CapabilityTier
  /** 视觉特征（主要描述对象） */
  visual: {
    form: DecorForm
    density: DecorDensity
    weight: DecorWeight
    tone: DecorTone
  }
  /** 归属哪些风格（空 = 通用） */
  styleAffinity: string[]
  /** 可用位置 */
  placement: DecorPlacement[]
  /** 可调参数 */
  params: Record<string, AssetParam>
  /** 按风格分化的默认值，覆盖 params[].default */
  defaultsByStyle?: Record<string, Record<string, number | string | boolean>>
}

/** 取资产在某风格下的参数默认值：风格覆盖优先，否则回落全局默认 */
export function assetDefault(
  asset: DecorAsset,
  styleId: string | undefined,
  param: string,
): number | string | boolean | undefined {
  const byStyle = styleId ? asset.defaultsByStyle?.[styleId] : undefined
  if (byStyle && param in byStyle) return byStyle[param]
  return asset.params[param]?.default
}

/* ═══════════════════════ ② 结构决策 ═══════════════════════ */

/**
 * 结构决策快照 —— 结构一旦落地就固化。
 *
 * `locked` 是保护教师劳动的关键：教师把 3 列改成 2 列后，
 * 重新打开课件不能被 AI 按内容条数重算回去。
 */
export interface StructureSpec {
  layout: string
  visualType?: string
  /** 推导依据（纲要特征），用于后续「纲要特征 → 结构」的命中率归因 */
  derivedFrom?: string
  /** true = 教师手动调整过，禁止 AI 重算 */
  locked?: boolean
  /** 该结构的装饰外观 */
  deco?: DecoSpec
}

/* ═══════════════════════ 校准信号 ═══════════════════════ */

export type FeedbackType =
  /** 通病：指向资产通用属性 + 多人复现 → 参与全局校准 */
  | 'defect'
  /** 偏好：个人审美 → 只写个人画像，绝不改全局 */
  | 'preference'
  /** 个案：指向内容而非资产 → 只改当前，不入池 */
  | 'content'

export type FeedbackOp = 'increase' | 'decrease' | 'set' | 'disable'

/**
 * 用户修改指令的结构化结果。
 *
 * 隐私护栏：本表**禁止自由文本字段**——
 * 可记录「刻度 8→5」这类结构差异，不可记录教师写的具体内容或对话原文。
 */
export interface AssetFeedback {
  assetId: string
  /** 归属风格，用于 assetId × styleId 维度的校准 */
  styleId?: string
  /** 被调整的参数名（如 'count'、'scale'） */
  param?: string
  op: FeedbackOp
  value?: number | string
  /** 反馈分类，决定流向：全局池 / 个人画像 / 丢弃 */
  type: FeedbackType
  /** 归因置信度 0~1；低置信度只记录不自动校准 */
  confidence: number
  /** 渲染端，用于区分 PPT 与 H5 的不同边界 */
  renderer?: string
}

/* ═══════════════════════ 校验（白名单 + 静默降级） ═══════════════════════ */

const inList = <T>(v: unknown, list: readonly T[]): v is T => list.includes(v as T)

/** 校验并清洗 DecoSpec：非法字段剔除，绝不抛错中断渲染 */
export function sanitizeDecoSpec(raw: unknown): DecoSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const d = raw as Record<string, unknown>
  const out: DecoSpec = {}
  if (inList(d.container, DECOR_CONTAINERS)) out.container = d.container
  if (inList(d.accent, DECOR_ACCENTS)) out.accent = d.accent
  if (inList(d.connector, DECOR_CONNECTORS)) out.connector = d.connector
  if (inList(d.motif, DECOR_MOTIFS)) out.motif = d.motif
  if (typeof d.tier === 'number' && d.tier >= 0 && d.tier <= 2) out.tier = d.tier as CapabilityTier
  return Object.keys(out).length ? out : undefined
}

/** 校验装饰资产参数值是否越界，越界则夹取到边界 */
export function clampParam(p: AssetParam, v: number): number {
  if (p.range) return Math.min(p.range[1], Math.max(p.range[0], v))
  return v
}

/** 反馈分类是否应进入全局校准池（仅通病参与） */
export function shouldCalibrate(f: AssetFeedback, minConfidence = 0.6): boolean {
  return f.type === 'defect' && f.confidence >= minConfidence
}

/**
 * 对装饰资产的引用（AI 输出 / 用户修改指令的结构化结果）。
 * 只声明"用哪个资产、覆盖哪些参数"，具体绘制由渲染器完成。
 */
export interface AssetRef {
  assetId: string
  /** 覆盖该风格下的默认值；键须是资产 params 中声明过的参数名 */
  params?: Record<string, number | string | boolean>
}

/** 取引用最终生效的参数值：用户覆盖 > 风格默认 > 全局默认 */
export function resolveAssetParams(
  asset: DecorAsset,
  styleId: string | undefined,
  ref?: AssetRef,
): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {}
  for (const key of Object.keys(asset.params)) {
    const v = assetDefault(asset, styleId, key)
    if (v !== undefined) out[key] = v
  }
  if (ref?.params) {
    for (const [key, val] of Object.entries(ref.params)) {
      // 只接受资产声明过的参数，避免脏数据注入渲染
      if (!(key in asset.params)) continue
      const p = asset.params[key]
      out[key] = typeof val === 'number' ? clampParam(p, val) : val
    }
  }
  return out
}
