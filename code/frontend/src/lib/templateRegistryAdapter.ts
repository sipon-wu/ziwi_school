/**
 * 模板注册中心 → 主链路 适配器（模板资产域 · 唯一翻译点）
 * ─────────────────────────────────────────────────────────────
 * 职责（用户拍板 2026-08-13）：
 *  - 把"风格模板子项目"产出的模板定义 JSON，转成主链路 cwTemplate 的
 *    CwTheme（经 registerTheme 注入）+ CwTemplate（并入 PPT_TEMPLATES）。
 *  - 透传 source / base_cost（CostMeta），供消费层读取（本期不触发计费 UI）。
 *  - 失败隔离：单套模板映射失败时 console.warn + 跳过，绝不抛错中断主链路。
 *
 * 耦合纪律：
 *  - 子项目（风格模板子项目/）独立仓库，永不 import 本文件；
 *  - 本文件是子项目 JSON 与主链路的唯一桥梁；
 *  - 子项目版式骨架不在本侧重写，复用主链路 EDU_LAYOUT_SKELETONS
 *    （子项目管皮肤/配色/语义标签，主链路管版式骨架）。
 */

import { registerTheme } from './pptThemes'
import type { CwTheme } from './pptThemes'
import {
  PPT_TEMPLATES,
  H5_TEMPLATES,
  EDU_LAYOUT_SKELETONS,
} from './cwTemplate'
import type {
  StyleTag,
  TemplateKind,
  CwTemplate,
} from './cwTemplate'
import type { CostMeta, TemplateSource } from './costUnit'
import { asCostUnit } from './costUnit'

// 模板定义 JSON 的最小结构（子项目产出契约）
interface LibTemplateDef {
  templateId: string
  name: string
  category?: string
  version?: string
  tags?: { stage?: string[]; subject?: string[]; lessonType?: string[]; style?: string[] }
  theme?: { colors?: Record<string, string>; fonts?: Record<string, string> }
  fonts?: Record<string, string>
  layouts?: Record<string, unknown>
  // 计费元数据（子项目生成清单时注入；缺失则按官方免费兜底）
  source?: TemplateSource
  base_cost?: number
}

// 子项目 styles 数组 → 主链路 StyleTag 的宽松关键字映射（命中任一即采用）
// 目标枚举限定为 cwTemplate.StyleTag 真值：china|minimal|tech|fresh|academic|cartoon|flat|business|basic
const STYLE_KEYWORD_MAP: Array<[string[], StyleTag]> = [
  [['国风', '中国', '水墨', '古典', '传统'], 'china'],
  [['素净', '极简', '简约', '黑白', '灰'], 'minimal'],
  [['学术', '严谨', '教研', '理性', '沉稳', '知性'], 'academic'],
  [['清新', '自然', '活力', '童趣', '马卡龙', '薄荷', '樱', '柠檬'], 'fresh'],
  [['科技', '未来', '几何', '网格', '冷色', '蓝灰', '赛博'], 'tech'],
  [['暖', '橙', '红金', '暖棕', '焦糖', '典雅', '温润', '活泼'], 'flat'],
  [['卡通', '趣味', '童趣', '动漫'], 'cartoon'],
  [['商务', '沉稳', '专业', '干练'], 'business'],
]

function mapStyleTag(styleArr?: string[]): StyleTag | null {
  if (!styleArr || styleArr.length === 0) return null
  const joined = styleArr.join(' ')
  for (const [keys, tag] of STYLE_KEYWORD_MAP) {
    if (keys.some((k) => joined.includes(k))) return tag
  }
  return null
}

// 跨平台字体映射（子项目用"思源黑体/宋体"等中文名，主链路用稳定字体栈）
function mapFont(titleFont?: string): string {
  const f = (titleFont || '').toLowerCase()
  if (f.includes('宋') || f.includes('song')) return '"宋体", "SimSun", "Microsoft YaHei"'
  if (f.includes('黑') || f.includes('hei')) return '"黑体", "SimHei", "Microsoft YaHei"'
  if (f.includes('楷') || f.includes('kai')) return 'KaiTi, "楷体", "STKaiti", "Microsoft YaHei"'
  return 'Microsoft YaHei'
}

// 按背景/主色亮度推算对比文字色（主色上的文字）
function contrastText(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length < 6) return '#FFFFFF'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  // 相对亮度
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#1A1A1A' : '#FFFFFF'
}

function toCwTheme(def: LibTemplateDef): CwTheme | null {
  const c = def.theme?.colors
  if (!c || !c.primary || !c.background || !c.text) {
    console.warn(`[templateRegistry] 跳过 ${def.templateId}：theme.colors 缺失 primary/background/text`)
    return null
  }
  const primary = c.primary.replace('#', '').length === 6 ? c.primary : '#1A3A6B'
  const background = c.background
  const text = c.text
  const accent = c.accent || c.secondary || primary
  const secondary = c.secondary || accent
  const gradient = Array.isArray(c.gradient) && c.gradient.length >= 2
    ? `linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})`
    : undefined
  const styleTag = mapStyleTag(def.tags?.style) || 'minimal'
  const font = mapFont(def.fonts?.title || def.theme?.fonts?.title)
  return {
    id: `lib-${def.templateId}`,
    name: def.name,
    group: '模板库',
    groupId: 'library',
    primary,
    onPrimary: contrastText(primary),
    coverBg: background,
    coverGradient: gradient,
    lightText: accent,
    footer: secondary,
    body: text,
    subtle: secondary,
    bullet: accent,
    font,
    decor: (['china', 'tech', 'fresh', 'academic', 'minimal'] as const).includes(styleTag as any)
      ? (styleTag as 'china' | 'tech' | 'fresh' | 'academic' | 'minimal')
      : styleTag === 'cartoon' ? 'special'
      : 'gradient',
  }
}

function toCostMeta(def: LibTemplateDef): CostMeta {
  // 子项目未注入计费元数据时，按"官方公共模板、计价为 0"兜底
  return {
    source: def.source || 'official',
    base_cost: asCostUnit(def.base_cost ?? 0),
    name: def.name,
    owner_id: undefined,
    price_plan: null,
  }
}

// ── 运行时注册（副作用，模块加载即执行一次） ──
// 按目标池分别追踪，避免 PPT 注册后置位导致 H5 注册被跳过
const _registeredPools = new Set<'ppt' | 'h5'>()
const _costMetaById = new Map<string, CostMeta>()

export function registerLibraryTemplates(
  defs: LibTemplateDef[],
  target: 'ppt' | 'h5' = 'ppt',
): void {
  if (_registeredPools.has(target)) return
  _registeredPools.add(target)
  const pool = target === 'h5' ? H5_TEMPLATES : PPT_TEMPLATES
  for (const def of defs) {
    try {
      const theme = toCwTheme(def)
      if (!theme) continue // 失败隔离：配色不合法则跳过
      const styleTag = mapStyleTag(def.tags?.style)
      if (!styleTag) {
        console.warn(`[templateRegistry] 跳过 ${def.templateId}：style 无法映射到 StyleTag（${def.tags?.style?.join('/')}）`)
        continue
      }
      registerTheme(theme)
      const tpl: CwTemplate = {
        id: `lib-${def.templateId}`,
        kind: (target === 'h5' ? 'h5' : 'ppt') as TemplateKind,
        name: def.name,
        style: styleTag,
        themeId: theme.id,
        layouts: { ...EDU_LAYOUT_SKELETONS },
        subjects: def.tags?.subject || [],
        grades: (def.tags?.stage || []) as CwTemplate['grades'],
      }
      // 并入主链路模板池（PPT_TEMPLATES / H5_TEMPLATES 均为引用数组，push 生效）
      pool.push(tpl)
      _costMetaById.set(def.templateId, toCostMeta(def))
    } catch (e) {
      console.warn(`[templateRegistry] 跳过 ${def.templateId}：映射异常`, e)
    }
  }
}

// 供消费层（模板选择面板）读取计费元数据，本期只取数不触发计费 UI
export function getLibraryCostMeta(templateId: string): CostMeta | undefined {
  return _costMetaById.get(templateId)
}

// 供运营端/调试查询已注册库模板 id 列表
export function listLibraryTemplateIds(): string[] {
  return Array.from(_costMetaById.keys())
}

// ── 自动注册：子项目产出清单经 deploy.rsync 进 assets，此处静态 import 并注册 ──
// PPT 侧 → PPT_TEMPLATES；H5 侧 → H5_TEMPLATES（同一适配器，仅目标池不同）。
// 若清单不存在/为空，本段静默跳过，主链路降级回内置主题，不影响课件生成。
import pptManifest from '../assets/template-library/template-library.ppt.json'
import h5Manifest from '../assets/template-library/template-library.h5.json'

const _pptTemplates = (pptManifest && Array.isArray((pptManifest as any).templates))
  ? (pptManifest as any).templates as LibTemplateDef[]
  : []
registerLibraryTemplates(_pptTemplates, 'ppt')

const _h5Templates = (h5Manifest && Array.isArray((h5Manifest as any).templates))
  ? (h5Manifest as any).templates as LibTemplateDef[]
  : []
registerLibraryTemplates(_h5Templates, 'h5')
