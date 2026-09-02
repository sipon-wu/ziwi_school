import type { CSSProperties } from 'react'
import type { VisualBlock } from '../lib/exportPptx'
import type { DecoSpec } from '../lib/visualAsset/types'

/**
 * 可视化组件渲染层（真课件的知识结构载体）。
 * 与 bullets 文字要点平铺的区别：这里用结构（递进/对比/时间轴/字卡…）表达知识关系，
 * 预览与导出共用同一份组件数据，保证「所见即所得」。
 *
 * 排版规范（对齐 PPT 设计基线，1mm ≈ 2.83pt）：
 *   组件标题  7mm（≈20pt 章节级）｜主文字 5.5mm（≈15pt 正文级）
 *   辅助文字  3.8mm（≈11pt 说明级）｜生字大字 14mm（田字格主体）
 *
 * 【自适应三原则】（修复"文字撑破卡片/卡片重叠"的通用解法）
 *   ① 字号随「内容长度 + 条目数」双向自适应，长文本自动缩小
 *   ② 所有文本块限制行数（clamp），超出省略，绝不撑高容器
 *   ③ 徽标/图标尺寸随条目数缩放，条目多时缩小，避免相互挤压
 */

export interface VisualTheme {
  primary: string   // 主色（#RRGGBB）
  body: string
  subtle: string
  font: string
}

/** 视觉风格：不只换色，而是换整套"视觉语言"（圆角/边框/装饰/留白） */
export type VisualStyle = 'minimal' | 'illustrated' | 'playful' | 'academic'

const hex = (h: string) => (h || '333333').replace('#', '')
/** 楷体（标题/强调，国风韵味） */
const KAI = '"KaiTi","STKaiti",serif'

/** 限制显示行数（不依赖 tailwind line-clamp 插件） */
const clamp = (lines: number): CSSProperties => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
})

/**
 * 字号自适应：按文本长度缩放，长文本自动变小，避免换行撑破卡片。
 * @param base 基准字号(mm) @param text 文本
 */
function fs(text: string | undefined, base: number): number {
  const len = (text || '').length
  if (!len) return base
  const scale = len <= 6 ? 1 : len <= 12 ? 0.9 : len <= 20 ? 0.8 : len <= 32 ? 0.68 : len <= 48 ? 0.58 : 0.5
  return +(base * scale).toFixed(2)
}

/** 风格令牌：把"视觉语言"参数化，各组件统一取用 */
function tokens(style: VisualStyle) {
  switch (style) {
    case 'minimal':
      return { radius: 'rounded-md', bw: 1, padY: 'py-2', deco: false, badge: 0.85, gap: 'gap-2' }
    case 'playful':
      return { radius: 'rounded-2xl', bw: 4, padY: 'py-3', deco: true, badge: 1.15, gap: 'gap-3' }
    case 'academic':
      return { radius: 'rounded-sm', bw: 2, padY: 'py-2', deco: false, badge: 0.9, gap: 'gap-2' }
    default: // illustrated
      return { radius: 'rounded-xl', bw: 3, padY: 'py-2.5', deco: true, badge: 1, gap: 'gap-2.5' }
  }
}

/**
 * 装饰容器样式 —— 打破「所有组件都是圆角方框」的开关。
 *
 * 改造前每个组件都硬编码 `border: Npx solid #p55; background: #p0D`，
 * 于是对比卡、图标卡、流程图、示意图渲染出来是同一种框线版块。
 * 现在容器形态由 deco.container 决定，同一个组件换 container 即换气质。
 *
 * **缺省（undefined / 'frame'）回退到与改造前完全一致的样式**，
 * 保证已生成的课件视觉不受影响。
 */
function decoStyle(deco: DecoSpec | undefined, p: string, style: VisualStyle): CSSProperties {
  const tk = tokens(style)
  switch (deco?.container) {
    // 无框：靠字号与留白取胜，短内容首选（"字密"的解药）
    case 'none':
      return { background: 'transparent', border: 'none' }
    // 下划线：定义、强调
    case 'underline':
      return { background: 'transparent', border: 'none', borderBottom: `${Math.max(2, tk.bw)}px solid #${p}` }
    // 左侧竖条：引文、要点
    case 'leftbar':
      return { background: `#${p}0A`, border: 'none', borderLeft: `${Math.max(3, tk.bw)}px solid #${p}` }
    // 不规则色块：活泼、低年级
    case 'blob':
      return { background: `#${p}1A`, border: 'none', borderRadius: '46% 54% 50% 50% / 52% 46% 54% 48%' }
    // 点阵背景：科技、数据
    case 'dotgrid':
      return { background: `radial-gradient(#${p}2E 1px, transparent 1px)`, backgroundSize: '3.5mm 3.5mm', border: 'none' }
    // 手撕边：趣味、挑战
    case 'torn':
      return { background: `#${p}10`, border: `${Math.max(1, tk.bw - 1)}px dashed #${p}77` }
    case 'frame':
    default:
      return { background: `#${p}0D`, border: `${tk.bw}px solid #${p}55` }
  }
}

/** 组件小标题：章节级，与主色呼应 */
const SectionTitle = ({ text, color, style }: { text: string; color: string; style: VisualStyle }) => (
  <div className="flex-shrink-0 font-bold"
    style={{
      color: `#${color}`, fontFamily: KAI,
      fontSize: `${fs(text, style === 'minimal' ? 6 : 7)}mm`,
      ...clamp(1),
    }}>{text}</div>
)

/* ─────────────────────────── 递进图 ─────────────────────────── */
function Sequence({ v, t, style }: { v: Extract<VisualBlock, { type: 'sequence' }>; t: VisualTheme; style: VisualStyle }) {
  const p = hex(t.primary)
  const body = hex(t.body)
  const n = v.items.length || 1
  const tk = tokens(style)
  // 条目越多，字号与徽标越小（③ 尺寸随条目数自适应）
  const labelFs = n <= 3 ? 5 : n <= 4 ? 4.4 : 3.8
  const hintFs = n <= 3 ? 3.5 : 3
  const badgeMm = 4.5 * tk.badge * (n <= 3 ? 1 : 0.85)
  return (
    <div className={`flex h-full w-full flex-col ${tk.gap}`}>
      {v.title && <SectionTitle text={v.title} color={p} style={style} />}
      <div className="flex min-h-0 flex-1 items-stretch gap-1.5">
        {v.items.map((it, i) => {
          const isLast = i === n - 1
          return (
            <div key={i} className="flex min-w-0 flex-1 items-center gap-1.5">
              <div className={`flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden text-center ${tk.radius} ${tk.padY} px-1.5`}
                style={{ background: isLast ? `#${p}30` : `#${p}0D`, border: `${tk.bw}px solid ${isLast ? `#${p}` : `#${p}66`}` }}>
                <div className="mb-0.5 flex shrink-0 items-center justify-center rounded-full"
                  style={{ width: `${badgeMm}mm`, height: `${badgeMm}mm`, background: isLast ? `#${p}` : `#${p}33`, color: isLast ? '#FFFFFF' : `#${p}`, fontSize: `${badgeMm * 0.62}mm`, fontWeight: 700, lineHeight: 1 }}>
                  {i + 1}
                </div>
                <div className="w-full font-bold leading-tight"
                  style={{ color: isLast ? `#${p}` : `#${body}`, fontFamily: KAI, fontSize: `${fs(it.label, labelFs)}mm`, ...clamp(2) }}>
                  {it.label}
                </div>
                {it.hint && (
                  <div className="mt-0.5 w-full leading-tight"
                    style={{ color: `#${hex(t.subtle)}`, fontSize: `${fs(it.hint, hintFs)}mm`, ...clamp(2) }}>
                    {it.hint}
                  </div>
                )}
              </div>
              {i < n - 1 && <div className="shrink-0 font-bold" style={{ color: `#${p}`, fontSize: `${4.5 * tk.badge}mm` }}>→</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────── 对比表 ─────────────────────────── */
function CompareTable({ v, t, style }: { v: Extract<VisualBlock, { type: 'compare-table' }>; t: VisualTheme; style: VisualStyle }) {
  const p = hex(t.primary)
  const nc = v.cols.length || 1
  const nr = v.rows.length || 1
  // 单元格字号随「列数 + 行数 + 单元格文本长度」自适应
  const cellFs = nc >= 4 ? 3.2 : nc === 3 ? 3.8 : 4.4
  const rowFs = nr >= 4 ? 3.6 : 4.4
  const maxCell = Math.max(1, ...v.rows.map((r) => Math.max(...(r.cells || []).map((c) => (c || '').length))))
  const shrink = maxCell > 24 ? 0.72 : maxCell > 14 ? 0.85 : 1
  return (
    <div className="flex h-full w-full flex-col gap-2">
      {v.title && <SectionTitle text={v.title} color={p} style={style} />}
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg" style={{ border: `2px solid #${p}55` }}>
        <table className="h-full w-full table-fixed border-collapse">
          <thead>
            <tr style={{ background: `#${p}26` }}>
              <th className="w-[16%] px-1 py-1" style={{ border: `1px solid #${p}44` }} />
              {v.cols.map((c, i) => (
                <th key={i} className="px-1 py-1 font-bold"
                  style={{ border: `1px solid #${p}44`, color: `#${p}`, fontFamily: KAI, fontSize: `${fs(c, cellFs)}mm` }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {v.rows.map((r, i) => (
              <tr key={i}>
                <td className="px-1 py-1 font-bold"
                  style={{ border: `1px solid #${p}44`, background: `#${p}14`, color: `#${p}`, fontFamily: KAI, fontSize: `${fs(r.label, rowFs)}mm`, ...clamp(2) }}>
                  {r.label}
                </td>
                {v.cols.map((_, j) => (
                  <td key={j} className="px-1 py-1 align-middle"
                    style={{ border: `1px solid #${p}44`, color: `#${hex(t.body)}`, fontSize: `${fs(r.cells?.[j], cellFs * shrink)}mm`, ...clamp(3) }}>
                    {r.cells?.[j] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─────────────────────────── 时间轴 ─────────────────────────── */
function Timeline({ v, t, style }: { v: Extract<VisualBlock, { type: 'timeline' }>; t: VisualTheme; style: VisualStyle }) {
  const p = hex(t.primary)
  const body = hex(t.body)
  const n = v.nodes.length || 1
  const tk = tokens(style)
  const segPct = 100 / n
  const highlight = n === 3 ? 1 : n - 1
  // 徽标尺寸随节点数缩小：节点多时若不缩小，会超出分配高度而相互重叠
  const badgeMm = (n <= 3 ? 17 : n === 4 ? 14 : 11.5) * tk.badge
  const labelFs = n <= 3 ? 8 : n === 4 ? 6.5 : 5.5
  const descFs = n <= 3 ? 6 : n === 4 ? 5 : 4.2
  return (
    <div className={`flex h-full w-full flex-col ${tk.gap}`}>
      {v.title && <SectionTitle text={v.title} color={p} style={style} />}
      <div className="relative min-h-0 flex-1">
        <div className="absolute w-[5px] rounded-full"
          style={{ left: `${badgeMm / 2 - 2.5}mm`, top: `${segPct / 2}%`, bottom: `${segPct / 2}%`, background: `linear-gradient(180deg, #${p}22 0%, #${p}99 50%, #${p}22 100%)` }} />
        {v.nodes.map((nd, i) => {
          const isHi = i === highlight
          return (
            <div key={i} className="absolute left-0 right-0 z-10 flex items-center gap-3"
              style={{ top: `${i * segPct}%`, height: `${segPct}%` }}>
              <div className="flex shrink-0 items-center justify-center rounded-full font-bold"
                style={{
                  width: `${badgeMm}mm`, height: `${badgeMm}mm`,
                  background: isHi ? `#${p}` : '#FFFFFF', border: `${tk.bw}px solid #${p}`,
                  color: isHi ? '#FFFFFF' : `#${p}`, fontSize: `${badgeMm * 0.5}mm`, fontFamily: KAI,
                  boxShadow: isHi && tk.deco ? `0 0 0 2mm #${p}1F` : 'none',
                }}>
                {['一', '二', '三', '四', '五', '六'][i] || i + 1}
              </div>
              <div className={`flex min-w-0 flex-1 flex-col justify-center overflow-hidden px-3 py-2 ${tk.radius}`}
                style={{ background: isHi ? `#${p}` : `#${p}0D`, border: `${tk.bw}px solid ${isHi ? `#${p}` : `#${p}66`}` }}>
                <div className="font-bold leading-tight"
                  style={{ color: isHi ? '#FFFFFF' : `#${p}`, fontSize: `${fs(nd.label, labelFs)}mm`, fontFamily: KAI, ...clamp(1) }}>
                  {nd.label}
                </div>
                {nd.desc && (
                  <div className="mt-1 leading-tight"
                    style={{ color: isHi ? 'rgba(255,255,255,0.92)' : `#${body}`, fontSize: `${fs(nd.desc, descFs)}mm`, ...clamp(2) }}>
                    {nd.desc}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────── 生字卡（田字格） ─────────────────────────── */
function CharCard({ v, t, style }: { v: Extract<VisualBlock, { type: 'char-card' }>; t: VisualTheme; style: VisualStyle }) {
  const p = hex(t.primary)
  const body = hex(t.body)
  const n = v.chars.length || 1
  const rowsN = n > 10 ? 3 : n > 5 ? 2 : 1
  const cols = Math.max(1, Math.ceil(n / rowsN))
  // 格子越多，字号越小（田字格主体随之缩放，避免溢出虚线框）
  const charFs = rowsN >= 3 ? 9 : rowsN === 2 ? 11 : n <= 4 ? 16 : 13
  const pyFs = rowsN >= 3 ? 3.4 : rowsN === 2 ? 3.8 : 5
  const wordFs = rowsN >= 3 ? 3.2 : rowsN === 2 ? 3.6 : 4.5
  return (
    <div className="flex h-full w-full flex-col gap-2">
      {v.title && <SectionTitle text={v.title} color={p} style={style} />}
      <div className="grid min-h-0 flex-1 gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gridTemplateRows: `repeat(${rowsN}, minmax(0,1fr))` }}>
        {v.chars.map((c, i) => (
          <div key={i} className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl py-1"
            style={{ border: `2px solid #${p}77`, background: `#${p}0A` }}>
            {/* 田字格十字参考线（十字实线，比虚线更像田字格） */}
            {style !== 'minimal' && (
              <>
                <div className="pointer-events-none absolute left-[12%] right-[12%] top-1/2" style={{ height: 1, background: `#${p}22` }} />
                <div className="pointer-events-none absolute bottom-[10%] top-[10%] left-1/2" style={{ width: 1, background: `#${p}22` }} />
              </>
            )}
            <div className="font-bold leading-none" style={{ color: `#${body}`, fontSize: `${charFs}mm`, fontFamily: KAI }}>{c.char}</div>
            {c.pinyin && <div className="mt-0.5 font-bold leading-tight" style={{ color: `#${p}`, fontSize: `${pyFs}mm`, ...clamp(1) }}>{c.pinyin}</div>}
            {c.word && <div className="leading-tight" style={{ color: `#${hex(t.subtle)}`, fontSize: `${wordFs}mm`, ...clamp(1) }}>{c.word}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── 对比卡 ─────────────────────────── */
function CompareCard({ v, t, style }: { v: Extract<VisualBlock, { type: 'compare-card' }>; t: VisualTheme; style: VisualStyle }) {
  const p = hex(t.primary)
  const body = hex(t.body)
  const n = v.pairs.length || 1
  const tk = tokens(style)
  const sideFs = n >= 4 ? 4 : n === 3 ? 4.6 : 5.2
  return (
    <div className={`flex h-full w-full flex-col ${tk.gap}`}>
      {v.title && <SectionTitle text={v.title} color={p} style={style} />}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
        {v.pairs.map((pr, i) => (
          <div key={i} className="flex min-w-0 items-stretch gap-2">
            {pr.label && (
              <div className="flex w-[14%] shrink-0 items-center justify-center rounded-xl font-bold"
                style={{ background: `#${p}`, color: '#FFFFFF', fontFamily: KAI, fontSize: `${fs(pr.label, sideFs)}mm`, ...clamp(2) }}>{pr.label}</div>
            )}
            <div className={`flex min-w-0 flex-1 items-center justify-center px-2 py-2 text-center font-bold ${tk.radius}`}
              style={{ border: `${tk.bw}px solid #${p}66`, background: `#${p}0D`, color: `#${body}`, fontSize: `${fs(pr.left, sideFs)}mm`, ...clamp(3) }}>{pr.left}</div>
            <div className="flex shrink-0 items-center font-bold" style={{ color: `#${p}`, fontSize: `${3.8 * tk.badge}mm` }}>VS</div>
            <div className={`flex min-w-0 flex-1 items-center justify-center px-2 py-2 text-center font-bold ${tk.radius}`}
              style={{ border: `${tk.bw}px solid #${p}66`, background: `#${p}0D`, color: `#${body}`, fontSize: `${fs(pr.right, sideFs)}mm`, ...clamp(3) }}>{pr.right}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── 金句大字 ─────────────────────────── */
function Quote({ v, t, style }: { v: Extract<VisualBlock, { type: 'quote' }>; t: VisualTheme; style: VisualStyle }) {
  const p = hex(t.primary)
  const body = hex(t.body)
  const len = (v.text || '').length
  const base = len <= 20 ? 8.5 : len <= 40 ? 7.5 : len <= 70 ? 6.5 : len <= 120 ? 5.5 : 4.6
  const lines = len <= 40 ? 3 : len <= 70 ? 4 : 6
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4">
      {style !== 'minimal' && <div className="font-bold" style={{ color: `#${p}55`, fontSize: '10mm', fontFamily: KAI, lineHeight: 1 }}>“</div>}
      <div className="text-center leading-relaxed"
        style={{ color: `#${body}`, fontSize: `${base}mm`, fontFamily: KAI, fontWeight: 700, borderLeft: `6px solid #${p}`, borderRight: `6px solid #${p}`, padding: '0 4%', ...clamp(lines) }}>
        {v.text}
      </div>
      {v.from && <div className="self-end" style={{ color: `#${hex(t.subtle)}`, fontSize: '4mm', ...clamp(1) }}>—— {v.from}</div>}
    </div>
  )
}

/* ─────────────────────────── 示意图（中心辐射） ─────────────────────────── */
function Diagram({ v, t, style }: { v: Extract<VisualBlock, { type: 'diagram' }>; t: VisualTheme; style: VisualStyle }) {
  const p = hex(t.primary)
  const body = hex(t.body)
  const n = v.branches.length || 1
  const tk = tokens(style)
  const cols = n <= 4 ? 2 : 3
  return (
    <div className={`flex h-full w-full flex-col ${tk.gap}`}>
      {v.title && <SectionTitle text={v.title} color={p} style={style} />}
      {/* 中心主题 */}
      <div className="flex shrink-0 justify-center">
        <div className={`px-5 py-2 text-center font-bold ${tk.radius}`}
          style={{ background: `#${p}`, color: '#FFFFFF', fontFamily: KAI, fontSize: `${fs(v.center, 6.5)}mm`, ...clamp(2), maxWidth: '70%' }}>
          {v.center}
        </div>
      </div>
      {/* 分支网格 */}
      <div className="grid min-h-0 flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {v.branches.map((b, i) => (
          <div key={i} className={`flex min-w-0 flex-col items-center justify-center overflow-hidden px-2 py-2 text-center ${tk.radius}`}
            style={{ border: `${tk.bw}px solid #${p}55`, background: `#${p}0D` }}>
            <div className="font-bold leading-tight" style={{ color: `#${p}`, fontSize: `${fs(b.label, 4.8)}mm`, ...clamp(2) }}>{b.label}</div>
            {b.desc && <div className="mt-1 leading-tight" style={{ color: `#${body}`, fontSize: `${fs(b.desc, 3.6)}mm`, ...clamp(2) }}>{b.desc}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── 图标卡（并列要点） ─────────────────────────── */
function IconCard({ v, t, style }: { v: Extract<VisualBlock, { type: 'icon-card' }>; t: VisualTheme; style: VisualStyle }) {
  const p = hex(t.primary)
  const body = hex(t.body)
  const n = v.items.length || 1
  const tk = tokens(style)
  const deco = v.deco
  // 无框模式省掉了边框与内边距占用的空间，字号可显著放大——这正是"字密"的解药
  const bare = deco?.container === 'none'
  const labelFs = bare ? (n <= 3 ? 7 : 6) : 5
  const descFs = bare ? (n <= 3 ? 4.6 : 4.2) : 3.6
  const showNum = deco?.accent === 'circle-num'
  const badgeMm = (n <= 3 ? 9 : 7) * tk.badge
  const cols = n <= 3 ? n : n <= 6 ? 3 : 4
  return (
    <div className={`flex h-full w-full flex-col ${tk.gap}`}>
      {v.title && <SectionTitle text={v.title} color={p} style={style} />}
      <div className="grid min-h-0 flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {v.items.map((it, i) => (
          <div key={i} className={`flex min-w-0 flex-col items-center justify-center overflow-hidden text-center ${tk.radius} ${bare ? 'px-1 py-1' : 'px-2 py-2'}`}
            style={decoStyle(deco, p, style)}>
            {showNum ? (
              <div className="mb-1 flex shrink-0 items-center justify-center rounded-full font-bold"
                style={{ width: `${badgeMm}mm`, height: `${badgeMm}mm`, background: `#${p}`, color: '#FFFFFF', fontSize: `${badgeMm * 0.55}mm`, lineHeight: 1 }}>
                {i + 1}
              </div>
            ) : (it.icon && <div style={{ fontSize: `${(n <= 3 ? 11 : 8) * tk.badge}mm`, lineHeight: 1.1 }}>{it.icon}</div>)}
            <div className="mt-1 font-bold leading-tight" style={{ color: `#${p}`, fontFamily: KAI, fontSize: `${fs(it.label, labelFs)}mm`, ...clamp(bare ? 3 : 2) }}>{it.label}</div>
            {it.desc && <div className="mt-0.5 leading-tight" style={{ color: `#${body}`, fontSize: `${fs(it.desc, descFs)}mm`, ...clamp(bare ? 4 : 3) }}>{it.desc}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── 结构图（层级） ─────────────────────────── */
function Structure({ v, t, style }: { v: Extract<VisualBlock, { type: 'structure' }>; t: VisualTheme; style: VisualStyle }) {
  const p = hex(t.primary)
  const tk = tokens(style)
  return (
    <div className={`flex h-full w-full flex-col ${tk.gap}`}>
      {v.title && <SectionTitle text={v.title} color={p} style={style} />}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
        {v.levels.map((lv, i) => (
          <div key={i} className="flex items-stretch gap-2" style={{ marginLeft: `${i * 4}%` }}>
            <div className="flex w-[22%] shrink-0 items-center justify-center rounded-xl font-bold"
              style={{ background: i === 0 ? `#${p}` : `#${p}26`, color: i === 0 ? '#FFFFFF' : `#${p}`, fontFamily: KAI, fontSize: `${fs(lv.label, 4.6)}mm`, ...clamp(2) }}>
              {lv.label}
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {lv.children.map((c, j) => (
                <div key={j} className="rounded-lg px-2 py-1"
                  style={{ border: `1px solid #${p}55`, background: `#${p}0A`, color: `#${hex(t.body)}`, fontSize: `${fs(c, 3.8)}mm`, ...clamp(2) }}>
                  {c}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── 流程图 ─────────────────────────── */
function Flow({ v, t, style }: { v: Extract<VisualBlock, { type: 'flow' }>; t: VisualTheme; style: VisualStyle }) {
  const p = hex(t.primary)
  const body = hex(t.body)
  const n = v.steps.length || 1
  const tk = tokens(style)
  const wrap = n > 4 // 步骤多时换行两行，避免横向挤爆
  const rows = wrap ? 2 : 1
  return (
    <div className={`flex h-full w-full flex-col ${tk.gap}`}>
      {v.title && <SectionTitle text={v.title} color={p} style={style} />}
      <div className="grid min-h-0 flex-1 gap-2" style={{ gridTemplateRows: `repeat(${rows}, minmax(0,1fr))`, gridTemplateColumns: `repeat(${Math.ceil(n / rows)}, minmax(0,1fr))` }}>
        {v.steps.map((s, i) => (
          <div key={i} className="flex min-w-0 items-center gap-1">
            <div className={`flex min-w-0 flex-1 flex-col justify-center overflow-hidden px-2 py-2 text-center ${tk.radius}`}
              style={{ border: `${tk.bw}px solid #${p}66`, background: `#${p}0D` }}>
              <div className="font-bold leading-tight" style={{ color: `#${p}`, fontFamily: KAI, fontSize: `${fs(s.label, n > 6 ? 3.6 : 4.4)}mm`, ...clamp(2) }}>{s.label}</div>
              {s.desc && <div className="mt-0.5 leading-tight" style={{ color: `#${body}`, fontSize: `${fs(s.desc, 3.2)}mm`, ...clamp(2) }}>{s.desc}</div>}
            </div>
            {i < n - 1 && <div className="shrink-0 font-bold" style={{ color: `#${p}`, fontSize: `${4 * tk.badge}mm` }}>→</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── 标注文本 ─────────────────────────── */
function Annotate({ v, t, style }: { v: Extract<VisualBlock, { type: 'annotate' }>; t: VisualTheme; style: VisualStyle }) {
  const p = hex(t.primary)
  const body = hex(t.body)
  const len = (v.text || '').length
  const base = len <= 60 ? 5.2 : len <= 120 ? 4.6 : 4
  const lines = len <= 60 ? 4 : len <= 120 ? 6 : 8
  const marks = (v.marks || []).filter((m) => typeof m === 'string' && m)
  // 把标注词在正文中高亮：按出现顺序切分，避免 replace 只命中首次
  const parts: { text: string; hit: boolean }[] = []
  if (marks.length) {
    let rest = v.text || ''
    let guard = 0
    while (rest && guard++ < 40) {
      let best = -1
      let bestLen = 0
      for (const m of marks) {
        const idx = rest.indexOf(m)
        if (idx >= 0 && (best === -1 || idx < best)) { best = idx; bestLen = m.length }
      }
      if (best === -1) break
      if (best > 0) parts.push({ text: rest.slice(0, best), hit: false })
      parts.push({ text: rest.slice(best, best + bestLen), hit: true })
      rest = rest.slice(best + bestLen)
    }
    if (rest) parts.push({ text: rest, hit: false })
  }
  return (
    <div className="flex h-full w-full flex-col gap-2">
      {v.title && <SectionTitle text={v.title} color={p} style={style} />}
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg px-4 py-3 leading-relaxed"
        style={{ border: `${style === 'minimal' ? 1 : 2}px solid #${p}44`, background: `#${p}08`, color: `#${body}`, fontSize: `${base}mm`, ...clamp(lines) }}>
        {parts.length ? parts.map((pt, i) => (
          pt.hit
            ? <span key={i} style={{ background: `#${p}33`, color: `#${p}`, fontWeight: 700, borderRadius: 2, padding: '0 1mm' }}>{pt.text}</span>
            : <span key={i}>{pt.text}</span>
        )) : (v.text || '')}
      </div>
      {!!marks.length && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {marks.map((m, i) => (
            <span key={i} className="rounded px-2 py-0.5" style={{ background: `#${p}1A`, color: `#${p}`, fontSize: '3.4mm', ...clamp(1) }}>{m}</span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── 分发入口 ─────────────────────────── */
export function VisualBlockView({ block, theme, style = 'illustrated' }: { block: VisualBlock; theme: VisualTheme; style?: VisualStyle }) {
  switch (block.type) {
    case 'sequence': return <Sequence v={block} t={theme} style={style} />
    case 'compare-table': return <CompareTable v={block} t={theme} style={style} />
    case 'timeline': return <Timeline v={block} t={theme} style={style} />
    case 'char-card': return <CharCard v={block} t={theme} style={style} />
    case 'compare-card': return <CompareCard v={block} t={theme} style={style} />
    case 'quote': return <Quote v={block} t={theme} style={style} />
    case 'diagram': return <Diagram v={block} t={theme} style={style} />
    case 'icon-card': return <IconCard v={block} t={theme} style={style} />
    case 'structure': return <Structure v={block} t={theme} style={style} />
    case 'flow': return <Flow v={block} t={theme} style={style} />
    case 'annotate': return <Annotate v={block} t={theme} style={style} />
    default: return null
  }
}
