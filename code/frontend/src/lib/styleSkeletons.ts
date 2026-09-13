/**
 * PPT 风格骨架几何（风格管形 · 2026-09-11）
 *
 * 问题（本次总目标）：PPT 所有模板共用同一份 `EDU_LAYOUT_SKELETONS` 几何，
 * `applyTemplate` 只按**内容**推断版式 → 换模板/换风格 = 只换配色，
 * 于是"出来也是一个头面"。这与 H5 侧修的是同一个病（风格退化成换色）。
 *
 * 做法：给每个风格一组**几何补丁**（占位框的 x/y/w/h 与字号），
 * 套模板时叠加到骨架之上 —— **主题管色、风格管形**，两端同一原则。
 * 只改几何，不改占位键，保证内容绑定与导出契约不变。
 *
 * 数据来源：风格 key 由 `styleRegistry` 统一提供（口径一致）。
 */

import type { LayoutSkeleton, SlideLayout } from './cwTemplate'
import type { StyleKey } from './styleRegistry'

/** 占位框几何补丁（缺省字段保持原值） */
export interface RectPatch {
  x?: number
  y?: number
  w?: number
  h?: number
  /** 字号补丁（风格可放大/收敛字号，观感差异更明显） */
  fontSize?: number
}

/** layout → placeholder key → 补丁 */
export type LayoutPatches = Partial<Record<string, RectPatch>>
export type StyleGeometry = Partial<Record<SlideLayout, LayoutPatches>>

/**
 * 各风格几何（画布百分比）。设计意图：
 *  - china  国风：**居中窄栏 + 大留白**（内容不铺满，x 内收、w 收窄、y 下移）
 *  - tech   科技：**满幅 + 双栏**（边距小、内容饱满、起始更靠上）
 *  - minimal 极简：**极限留白**（比国风更窄、标题小字左对齐）
 *  - academic 严谨：**规整等分**（三栏等宽、标题带左侧条位）
 *  - fresh  清新：**居中 + 中等留白**
 *  - cartoon 卡通：**居中大留白 + 放大字号**
 */
export const STYLE_GEOMETRY: Partial<Record<StyleKey, StyleGeometry>> = {
  china: {
    'edu-cover': {
      title: { x: 16, y: 34, w: 68, fontSize: 34 },
      info: { x: 16, y: 52, w: 68 },
    },
    'edu-goal': {
      knowledge: { x: 16, y: 26, w: 21, h: 52 },
      process: { x: 39.5, y: 26, w: 21, h: 52 },
      emotion: { x: 63, y: 26, w: 21, h: 52 },
    },
    'edu-explain': {
      definition: { x: 18, y: 26, w: 64, h: 16 },
      points: { x: 18, y: 48, w: 64, h: 40 },
    },
    'edu-summary': {
      points: { x: 18, y: 26, w: 64, h: 36 },
      mindmap: { x: 18, y: 68, w: 64, h: 18 },
    },
    'content-1col': { title: { x: 18, y: 16, w: 64 }, body: { x: 18, y: 32, w: 64, h: 54 } },
    'content-2col': {
      title: { x: 18, y: 16, w: 64 },
      left: { x: 18, y: 32, w: 30.5, h: 54 },
      right: { x: 51.5, y: 32, w: 30.5, h: 54 },
    },
    'content-grid': { title: { x: 18, y: 16, w: 64 }, items: { x: 18, y: 32, w: 64, h: 54 } },
    'toc': { title: { x: 18, y: 16, w: 64 }, items: { x: 26, y: 32, w: 48, h: 52 } },
    'section': { title: { x: 20, y: 44, w: 60, fontSize: 30 } },
  },

  tech: {
    'edu-cover': {
      title: { x: 5, y: 26, w: 90, fontSize: 38 },
      info: { x: 5, y: 44, w: 90 },
    },
    'edu-goal': {
      knowledge: { x: 4, y: 20, w: 29.5, h: 62 },
      process: { x: 35.2, y: 20, w: 29.5, h: 62 },
      emotion: { x: 66.4, y: 20, w: 29.5, h: 62 },
    },
    'edu-explain': {
      definition: { x: 5, y: 18, w: 90, h: 16 },
      points: { x: 5, y: 38, w: 90, h: 52 },
    },
    'edu-summary': {
      points: { x: 5, y: 18, w: 90, h: 42 },
      mindmap: { x: 5, y: 64, w: 90, h: 26 },
    },
    'content-1col': { title: { x: 5, y: 10, w: 90 }, body: { x: 5, y: 24, w: 90, h: 64 } },
    'content-2col': {
      title: { x: 5, y: 10, w: 90 },
      left: { x: 5, y: 24, w: 43.5, h: 64 },
      right: { x: 51.5, y: 24, w: 43.5, h: 64 },
    },
    'content-grid': { title: { x: 5, y: 10, w: 90 }, items: { x: 5, y: 24, w: 90, h: 64 } },
    'toc': { title: { x: 5, y: 10, w: 90 }, items: { x: 10, y: 26, w: 80, h: 60 } },
    'section': { title: { x: 5, y: 40, w: 90, fontSize: 34 } },
  },

  minimal: {
    'edu-cover': {
      title: { x: 24, y: 38, w: 52, fontSize: 30 },
      info: { x: 24, y: 54, w: 52, fontSize: 15 },
    },
    'edu-goal': {
      knowledge: { x: 24, y: 28, w: 16, h: 48 },
      process: { x: 42, y: 28, w: 16, h: 48 },
      emotion: { x: 60, y: 28, w: 16, h: 48 },
    },
    'edu-explain': {
      definition: { x: 26, y: 30, w: 48, h: 14, fontSize: 16 },
      points: { x: 26, y: 50, w: 48, h: 34 },
    },
    'edu-summary': {
      points: { x: 26, y: 30, w: 48, h: 32 },
      mindmap: { x: 26, y: 68, w: 48, h: 16 },
    },
    'content-1col': { title: { x: 26, y: 20, w: 48, fontSize: 22 }, body: { x: 26, y: 36, w: 48, h: 48 } },
    'content-2col': {
      title: { x: 26, y: 20, w: 48, fontSize: 22 },
      left: { x: 26, y: 36, w: 22.5, h: 48 },
      right: { x: 51.5, y: 36, w: 22.5, h: 48 },
    },
    'content-grid': { title: { x: 26, y: 20, w: 48, fontSize: 22 }, items: { x: 26, y: 36, w: 48, h: 48 } },
    'toc': { title: { x: 26, y: 20, w: 48 }, items: { x: 32, y: 34, w: 36, h: 48 } },
    'section': { title: { x: 26, y: 46, w: 48, fontSize: 28 } },
  },

  academic: {
    'edu-cover': {
      title: { x: 10, y: 32, w: 80, fontSize: 34 },
      info: { x: 10, y: 50, w: 80, fontSize: 16 },
    },
    'edu-goal': {
      knowledge: { x: 6, y: 24, w: 28.3, h: 58 },
      process: { x: 35.8, y: 24, w: 28.3, h: 58 },
      emotion: { x: 65.7, y: 24, w: 28.3, h: 58 },
    },
    'edu-explain': {
      definition: { x: 8, y: 24, w: 84, h: 16 },
      points: { x: 8, y: 46, w: 84, h: 44 },
    },
    'edu-summary': {
      points: { x: 8, y: 24, w: 84, h: 40 },
      mindmap: { x: 8, y: 68, w: 84, h: 20 },
    },
    'content-1col': { title: { x: 10, y: 14, w: 80 }, body: { x: 10, y: 30, w: 80, h: 58 } },
    'content-2col': {
      title: { x: 10, y: 14, w: 80 },
      left: { x: 10, y: 30, w: 38.5, h: 58 },
      right: { x: 51.5, y: 30, w: 38.5, h: 58 },
    },
    'content-grid': { title: { x: 10, y: 14, w: 80 }, items: { x: 10, y: 30, w: 80, h: 58 } },
    'toc': { title: { x: 10, y: 14, w: 80 }, items: { x: 16, y: 30, w: 68, h: 56 } },
    'section': { title: { x: 10, y: 42, w: 80, fontSize: 30 } },
  },

  fresh: {
    'edu-cover': {
      title: { x: 12, y: 32, w: 76, fontSize: 36 },
      info: { x: 12, y: 50, w: 76 },
    },
    'content-1col': { title: { x: 12, y: 14, w: 76 }, body: { x: 12, y: 30, w: 76, h: 58 } },
    'content-2col': {
      title: { x: 12, y: 14, w: 76 },
      left: { x: 12, y: 30, w: 36.5, h: 58 },
      right: { x: 51.5, y: 30, w: 36.5, h: 58 },
    },
    'content-grid': { title: { x: 12, y: 14, w: 76 }, items: { x: 12, y: 30, w: 76, h: 58 } },
    'edu-explain': {
      definition: { x: 12, y: 24, w: 76, h: 16 },
      points: { x: 12, y: 46, w: 76, h: 44 },
    },
    'section': { title: { x: 14, y: 44, w: 72, fontSize: 32 } },
  },

  cartoon: {
    'edu-cover': {
      title: { x: 10, y: 30, w: 80, fontSize: 42 },
      info: { x: 10, y: 50, w: 80, fontSize: 20 },
    },
    'content-1col': { title: { x: 10, y: 12, w: 80, fontSize: 28 }, body: { x: 10, y: 28, w: 80, h: 60 } },
    'content-2col': {
      title: { x: 10, y: 12, w: 80, fontSize: 28 },
      left: { x: 10, y: 28, w: 38, h: 60 },
      right: { x: 52, y: 28, w: 38, h: 60 },
    },
    'content-grid': { title: { x: 10, y: 12, w: 80, fontSize: 28 }, items: { x: 10, y: 28, w: 80, h: 60 } },
    'edu-explain': {
      definition: { x: 10, y: 22, w: 80, h: 16, fontSize: 20 },
      points: { x: 10, y: 44, w: 80, h: 46 },
    },
    'section': { title: { x: 10, y: 40, w: 80, fontSize: 38 } },
  },
}

/**
 * 把某风格几何补丁应用到**单个版式骨架**。
 * 渲染端（`getSkeleton`）走这个入口——这是"风格管形"真正到达画面的唯一一层，
 * 不能只在 `applyTemplate` 里打补丁（那样数据变了、像素没变，就是假绿）。
 */
export function applyStyleGeometryToLayout(
  sk: LayoutSkeleton | undefined,
  styleKey: StyleKey | '',
  layout: SlideLayout,
): LayoutSkeleton | undefined {
  if (!sk?.placeholders || !styleKey) return sk
  const patch = STYLE_GEOMETRY[styleKey]?.[layout]
  if (!patch) return sk
  return {
    ...sk,
    placeholders: sk.placeholders.map((p) => {
      const pt = patch[p.key]
      if (!pt) return p
      return {
        ...p,
        rect: p.rect ? { ...p.rect, x: pt.x ?? p.rect.x, y: pt.y ?? p.rect.y, w: pt.w ?? p.rect.w, h: pt.h ?? p.rect.h } : p.rect,
        fontSize: pt.fontSize ?? p.fontSize,
      }
    }),
  }
}

/**
 * 「单列文本块」几何（用于教学目标/小结/作业等**铺开成单列**的版式）。
 *
 * 背景：渲染端此前对这三个版式写死了 `left:6% top:21% w:88% h:66%`，
 * 等于绕过了骨架 → 换风格也完全一样（"一个头面"的又一处来源）。
 * 这里按风格给出单列块几何，让这三类页也随风格变。
 */
export const STYLE_SINGLE_COLUMN: Partial<Record<StyleKey, { x: number; y: number; w: number; h: number }>> = {
  china: { x: 18, y: 26, w: 64, h: 56 },
  tech: { x: 5, y: 18, w: 90, h: 70 },
  minimal: { x: 26, y: 32, w: 48, h: 48 },
  academic: { x: 8, y: 22, w: 84, h: 62 },
  fresh: { x: 12, y: 24, w: 76, h: 58 },
  cartoon: { x: 10, y: 22, w: 80, h: 62 },
}

const SINGLE_COLUMN_FALLBACK = { x: 6, y: 21, w: 88, h: 66 }

export function singleColumnRect(styleKey: StyleKey | ''): { x: number; y: number; w: number; h: number } {
  return (styleKey && STYLE_SINGLE_COLUMN[styleKey]) || SINGLE_COLUMN_FALLBACK
}

/**
 * 「两栏正文块」几何：由单列块按列间距等分派生。
 * 用于 `two-col` 这类**非结构化版式**（不走 edu- / content- 骨架），
 * 否则它和 title-body 一样是全局写死的，换风格完全无变化。
 */
export function twoColumnRects(
  styleKey: StyleKey | '',
  gap = 3,
): { left: { x: number; y: number; w: number; h: number }; right: { x: number; y: number; w: number; h: number } } {
  const b = singleColumnRect(styleKey)
  const colW = (b.w - gap) / 2
  return {
    left: { x: b.x, y: b.y, w: colW, h: b.h },
    right: { x: b.x + colW + gap, y: b.y, w: colW, h: b.h },
  }
}

/** 把某风格的几何补丁叠加到骨架上（不改占位键，仅调 rect/字号） */
export function applyStyleGeometry(
  layouts: Record<string, LayoutSkeleton>,
  styleKey: StyleKey | '',
): Record<string, LayoutSkeleton> {
  const geo = styleKey ? STYLE_GEOMETRY[styleKey] : undefined
  if (!geo) return layouts
  const out: Record<string, LayoutSkeleton> = {}
  for (const [layout, sk] of Object.entries(layouts)) {
    const patches = geo[layout as SlideLayout]
    if (!patches || !sk?.placeholders) { out[layout] = sk; continue }
    out[layout] = {
      ...sk,
      placeholders: sk.placeholders.map((p) => {
        const patch = patches[p.key]
        if (!patch) return p
        return {
          ...p,
          rect: p.rect ? { ...p.rect, ...patch } : p.rect,
          fontSize: patch.fontSize ?? p.fontSize,
        }
      }),
    }
  }
  return out
}
