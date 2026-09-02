/**
 * 装饰资产库（试点：自然系 —— forest / nature / storybook）
 *
 * 由 H5 侧 STORY_THEMES 的 `deco: string[]`（纯 emoji 数组）升级而来：
 * 旧形态只能循环取用、参数写死；新形态每个 emoji 是一个**参数化资产**，
 * 可按风格取不同默认值，可被用户指令调节（count / scale / opacity）。
 *
 * 默认值校准原则：
 *   forest    约 10 件点缀（原实现为 8 件，略增以覆盖更多资产种类）
 *   nature    约 14 件（满铺型，作为背景肌理）
 *   storybook 约 7 件（童趣简洁，避免喧宾夺主）
 * 这些是**先验值**，后续由用户修改指令的累积反馈校准（见架构方案 S6）。
 *
 * 后续扩展：新增资产按同样结构追加即可，渲染器与查询函数无需改动。
 */

import type { DecorAsset, DecorPlacement, AssetParam } from './types'

/** 通用可调参数：数量 / 缩放 / 透明度 */
const COUNT = (def: number, max = 12): AssetParam => ({ default: def, range: [0, max] })
const SCALE = (def: number): AssetParam => ({ default: def, range: [0.4, 2.5], unit: 'x' })
const OPACITY = (def: number): AssetParam => ({ default: def, range: [0.08, 1] })

/**
 * 试点资产：自然系 8 件。
 * tier=1：依赖透明度与旋转等 CSS 效果，H5 完整支持，PPT 端降级为无透明度的静态文本。
 */
export const DECOR_ASSETS: DecorAsset[] = [
  {
    id: 'leaf-sprig',
    name: '草叶',
    glyph: '🌿',
    tier: 1,
    visual: { form: 'organic', density: 'cluster', weight: 'light', tone: 'muted' },
    styleAffinity: ['forest', 'nature'],
    placement: ['corner', 'edge'],
    params: { count: COUNT(4), scale: SCALE(1), opacity: OPACITY(0.35) },
    defaultsByStyle: {
      forest: { count: 2, opacity: 0.32 },
      nature: { count: 4, opacity: 0.28 },
    },
  },
  {
    id: 'leaf-single',
    name: '叶片',
    glyph: '🍃',
    tier: 1,
    visual: { form: 'organic', density: 'single', weight: 'light', tone: 'muted' },
    styleAffinity: ['forest', 'nature', 'storybook'],
    placement: ['corner', 'edge'],
    params: { count: COUNT(3), scale: SCALE(1), opacity: OPACITY(0.4) },
    defaultsByStyle: {
      forest: { count: 1 },
      nature: { count: 2, opacity: 0.35 },
      storybook: { count: 2 },
    },
  },
  {
    id: 'tree',
    name: '树',
    glyph: '🌳',
    tier: 1,
    visual: { form: 'organic', density: 'single', weight: 'medium', tone: 'muted' },
    styleAffinity: ['forest', 'nature'],
    placement: ['corner', 'edge'],
    params: { count: COUNT(2, 6), scale: SCALE(1), opacity: OPACITY(0.45) },
    defaultsByStyle: {
      forest: { count: 1 },
      nature: { count: 2 },
    },
  },
  {
    id: 'blossom',
    name: '花',
    glyph: '🌸',
    tier: 1,
    visual: { form: 'organic', density: 'cluster', weight: 'light', tone: 'vivid' },
    styleAffinity: ['forest', 'storybook'],
    placement: ['corner', 'edge'],
    params: { count: COUNT(3), scale: SCALE(1), opacity: OPACITY(0.42) },
    defaultsByStyle: {
      forest: { count: 1 },
      storybook: { count: 4, opacity: 0.5 },
    },
  },
  {
    id: 'fallen-leaf',
    name: '落叶',
    glyph: '🍂',
    tier: 1,
    visual: { form: 'organic', density: 'scattered', weight: 'light', tone: 'muted' },
    styleAffinity: ['forest', 'nature'],
    placement: ['corner', 'edge', 'background'],
    params: { count: COUNT(4), scale: SCALE(0.9), opacity: OPACITY(0.3) },
    defaultsByStyle: {
      forest: { count: 2 },
      nature: { count: 3, opacity: 0.25 },
    },
  },
  {
    id: 'sun',
    name: '太阳',
    glyph: '🌞',
    tier: 1,
    visual: { form: 'geometric', density: 'single', weight: 'medium', tone: 'vivid' },
    styleAffinity: ['forest', 'nature', 'storybook'],
    placement: ['corner'],
    params: { count: COUNT(1, 3), scale: SCALE(1.2), opacity: OPACITY(0.55) },
    defaultsByStyle: {
      forest: { count: 1 },
      nature: { count: 1 },
      storybook: { count: 1, scale: 1.4, opacity: 0.6 },
    },
  },
  {
    id: 'ladybug',
    name: '瓢虫',
    glyph: '🐞',
    tier: 1,
    visual: { form: 'organic', density: 'single', weight: 'light', tone: 'vivid' },
    styleAffinity: ['forest', 'nature'],
    placement: ['corner', 'edge'],
    params: { count: COUNT(1, 4), scale: SCALE(0.8), opacity: OPACITY(0.6) },
    defaultsByStyle: {
      forest: { count: 1 },
      nature: { count: 1 },
    },
  },
  {
    id: 'mushroom',
    name: '蘑菇',
    glyph: '🍄',
    tier: 1,
    visual: { form: 'organic', density: 'single', weight: 'light', tone: 'vivid' },
    styleAffinity: ['forest', 'nature'],
    placement: ['corner', 'edge'],
    params: { count: COUNT(1, 4), scale: SCALE(0.9), opacity: OPACITY(0.5) },
    defaultsByStyle: {
      forest: { count: 1 },
      nature: { count: 1 },
    },
  },
]

const BY_ID = new Map(DECOR_ASSETS.map((a) => [a.id, a]))

export function getAsset(id: string): DecorAsset | undefined {
  return BY_ID.get(id)
}

/**
 * 取某风格可用的装饰资产。
 * styleAffinity 为空 = 通用资产，任何风格都可用。
 */
export function getAssetsByStyle(styleId: string | undefined): DecorAsset[] {
  if (!styleId) return DECOR_ASSETS.filter((a) => a.styleAffinity.length === 0)
  return DECOR_ASSETS.filter((a) => a.styleAffinity.length === 0 || a.styleAffinity.includes(styleId))
}

/** 在风格可用集内再按位置过滤 */
export function getAssetsByPlacement(
  styleId: string | undefined,
  placement: DecorPlacement,
): DecorAsset[] {
  return getAssetsByStyle(styleId).filter((a) => a.placement.includes(placement))
}
