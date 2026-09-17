/**
 * 渲染出口矩阵（2026-09-17）—— 回答"设计质量怎么把握"
 *
 * 做法：从 `CwSlide` 接口**读出字段清单**（不靠人列），再逐个出口文件统计"该字段是否被引用"。
 * 引用次数 = 0 → 该出口**根本没消费**这个字段 → 就是"改一处漏一处"的候选漏项。
 *
 * 口径与限制（必须说明）：
 *   · "被提及" ≠ "被正确渲染"。本矩阵只能可靠地找出**从未被引用**的字段（漏项）。
 *   · 出口文件是按职责选的；若某出口在别处实现，本矩阵会误报为漏项 —— 需人工确认后再下结论。
 *
 * 用法：node qa/render_matrix.cjs
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

const SRC = p => path.join(ROOT, 'code/frontend/src', p)
const EXITS = [
  { name: '画布/预览', file: SRC('components/PptxPreview.tsx') },
  { name: '缩略图/放映', file: SRC('lib/exportPptx.ts'), note: '同库（outlineToSlides 产数据，PptxPreview 渲染）' },
  { name: 'H5', file: SRC('lib/courseware-h5/renderer.ts') },
  { name: 'H5 数据映射', file: SRC('lib/courseware-h5/mdToStory.ts') },
  { name: '导出 PPTX 数据', file: SRC('lib/exportPptx.ts') },
]

// 1) 从 CwSlide 接口读字段（证据驱动，不手列）
const ep = fs.readFileSync(SRC('lib/exportPptx.ts'), 'utf8')
const iface = ep.match(/export interface CwSlide \{([\s\S]*?)\n\}/)
if (!iface) { console.error('✘ 未找到 CwSlide 接口'); process.exit(1) }
const fields = [...iface[1].matchAll(/^\s{2}(\w+)\??:/gm)].map(m => m[1])
console.log(`CwSlide 字段共 ${fields.length} 个（读自接口定义）：${fields.join(', ')}\n`)

// 2) 导出绘制段的边界（避免把"数据层"的引用误算成"渲染"）
const drawStart = ep.indexOf('export async function exportCoursewareToPptx')
const drawEnd = ep.indexOf('\n}', drawStart)
const drawBody = ep.slice(drawStart, drawEnd)

// 3) 统计
const files = new Map()
for (const e of EXITS) if (!files.has(e.file)) files.set(e.file, fs.readFileSync(e.file, 'utf8'))

const head = ['字段'.padEnd(16), ...EXITS.map(e => e.name.padEnd(12))].join('')
console.log(head)
console.log('-'.repeat(head.length))
const gaps = []
for (const f of fields) {
  const cells = EXITS.map(e => {
    // 导出 PPTX 只统计绘制段；其余统计整文件
    const text = e.name === '导出 PPTX 数据' ? drawBody : files.get(e.file)
    const n = (text.match(new RegExp(`\\.${f}\\b`, 'g')) || []).length
    if (n === 0) gaps.push(`${f} → ${e.name}`)
    return (n === 0 ? '—' : String(n)).padEnd(12)
  })
  console.log(f.padEnd(16) + cells.join(''))
}
console.log('-'.repeat(head.length))
console.log(`\n「—」= 该出口从未引用该字段，共 ${gaps.length} 处待判定：`)
gaps.forEach(g => console.log('  · ' + g))
console.log('\n注：数据层引用（如 outlineToSlides 里的 s.decor 传参）不计入"导出"列，故导出列的 — 表示**绘制段没用它**。')
