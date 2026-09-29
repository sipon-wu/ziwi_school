/**
 * RETIRED.md 同步器（维护工具，2026-09-29）—— 把"三处口径"从**单一事实源**重算，防止再次脱节
 *
 * 背景（为什么要写它）：`qa/RETIRED.md` 里有三处必须一致的东西 ——
 *   ① **原文件表**（每个 `_retired_*.cjs` 一行，最后一列 = 接管者，没有就写"无接管"）
 *   ② **覆盖缺口清单**（正文项目符号，只该列"无接管"的那些）
 *   ③ **计数**（标题里的"共 N 个"、文末那句"其余 N 条"）
 * 一开始靠手改：结果收了 8 条缺口后，我把计数从 35 改到 30，却**忘了把已收口的从 ① 和 ② 里划掉** ——
 * 出现"清单说还有缺口，其实早有守卫接管"的**反向脱节**（不是假装有覆盖，而是假装还缺）。
 * 教训：**别手改派生数据**。事实源 = ①"缺口收口记录"表（人工维护，写明覆盖了哪些退役文件）+
 * `_retired_*.cjs` 文件本身；②③ 全部由本脚本重算。
 *
 * 用法：`node qa/sync_retired.cjs`（幂等；跑完 `git diff qa/RETIRED.md` 看一眼再提交）
 */
const fs = require('fs')
const path = require('path')

const QA = __dirname
const MD = path.join(QA, 'RETIRED.md')
const raw = fs.readFileSync(MD, 'utf8')
const lines = raw.split('\n')

/** 退役文件真名集合（`_retired_verify_x.cjs` → `verify_x`） */
const retired = new Set(
  fs.readdirSync(QA).filter(f => f.startsWith('_retired_') && f.endsWith('.cjs'))
    .map(f => f.replace(/^_retired_/, '').replace(/\.cjs$/, '')),
)
/** 已登记守卫（`qa/run_all.cjs`） */
const { GUARDS } = require('./run_all.cjs')
const registered = new Set(GUARDS.map(g => g.name))

/** 从退役文件头部抽"原用途"：优先带 `原用途：` 标签的那行，否则取第一条**非退役声明**的中文注释行
 *  （首版直接取"第一条含中文的注释"，抽到的是 `── 已退役（2026-09-29…` 这类声明，不是用途） */
const purposeOf = (name) => {
  const p = path.join(QA, `_retired_${name}.cjs`)
  if (!fs.existsSync(p)) return '(文件缺失)'
  const clean = fs.readFileSync(p, 'utf8').split('\n').slice(0, 20)
    .map(l => l.replace(/^\s*(\/\/|\/\*\*?|\*)\s?/, '').replace(/\*\/\s*$/, '').trim())
  const tagged = clean.find(s => /^原用途[：:]/.test(s))
  if (tagged) return tagged.replace(/^原用途[：:]\s*/, '').replace(/\|/g, '｜').slice(0, 120)
  for (const s of clean) {
    if (!/[\u4e00-\u9fa5]/.test(s)) continue
    if (/已退役|用法|原用途|退役理由|接管者|复活方式|^===/.test(s)) continue
    return s.replace(/\|/g, '｜').slice(0, 120)
  }
  return '(原文件无头部说明)'
}

/* ── ① 事实源 1：缺口收口记录表（人工写"覆盖了哪些退役文件"）── */
const map = new Map()   // 退役文件 → 接管的守卫
for (const l of lines) {
  if (!/^\| 20\d\d-/.test(l)) continue
  const cells = l.split('|').map(s => s.trim())
  const guardCell = cells[3] || ''
  const filesCell = cells[4] || ''
  const guard = (guardCell.match(/`(verify_[a-z0-9_]+)`/) || [])[1]
  if (!guard) continue
  for (const m of filesCell.matchAll(/`?(verify_[a-z0-9_]+)`?/g)) {
    if (retired.has(m[1])) map.set(m[1], guard)
  }
}

/* ── ② 重算原文件表：保留人写的接管者文字，只把"无接管"里已被收口的改掉 ── */
const rows = []   // {idx, file, purpose, succ}
let tableStart = -1, tableEnd = -1
lines.forEach((l, i) => {
  if (tableStart < 0 && /^\| # \| 原文件 \| 原用途 \| 接管者 \|/.test(l)) { tableStart = i; return }
  if (tableStart >= 0 && tableEnd < 0 && !/^\|/.test(l)) tableEnd = i
})
if (tableStart < 0) { console.error('✘ 找不到原文件表'); process.exit(2) }
const firstRow = tableStart + 2
const lastRow = tableEnd < 0 ? lines.length : tableEnd
for (let i = firstRow; i < lastRow; i++) {
  const cells = lines[i].split('|')
  if (cells.length < 6) continue
  const file = (cells[2] || '').replace(/`/g, '').trim().replace(/\.cjs$/, '')   // ⚠ trim 必须在剥后缀之前：单元格是 `x.cjs ` 带尾空格，否则一行都认不出来（首版就踩了）
  if (!retired.has(file)) continue
  rows.push({ idx: i, file, purpose: cells[3].trim(), succ: cells[4].trim() })
}
const missing = [...retired].filter(f => !rows.some(r => r.file === f))
const GAP = '**无接管** → **覆盖缺口**（见文末清单；本仓库目前没有自动守卫）'

/* 更新"无接管"里已被接管的行 + **一律刷新"原用途"**（用途的事实源是文件头，手抄会臭：
 *  首版只给"新追加的行"抽用途，于是早期追加的 3 行一直留着 `── 已退役（…）` 当"用途"） */
let changed = 0
for (const r of rows) {
  const want = purposeOf(r.file)
  const taken = map.has(r.file)
  const needSucc = taken && /无接管|覆盖缺口/.test(r.succ)
  const needPurpose = want !== r.purpose && want !== '(文件缺失)'
  if (!needSucc && !needPurpose) continue
  const succ = needSucc ? `\`qa/${map.get(r.file)}.cjs\`（2026-09-29 收口，口径见"缺口收口记录"）` : r.succ
  lines[r.idx] = `| ${(lines[r.idx].split('|')[1] || '').trim()} | \`${r.file}.cjs\` | ${want} | ${succ} |`
  changed++
}
/* 追加表格里还没有的退役文件 */
if (missing.length) {
  const insertAt = rows.length ? Math.max(...rows.map(r => r.idx)) + 1 : firstRow
  const newRows = missing.sort().map((f, k) => `| ${rows.length + k + 1} | \`${f}.cjs\` | ${purposeOf(f)} | ${map.has(f) ? `\`qa/${map.get(f)}.cjs\`（2026-09-29 收口）` : GAP} |`)
  lines.splice(insertAt, 0, ...newRows)
  console.log(`   [表] 追加 ${missing.length} 行：${missing.join(', ')}`)
}

/* ── ③ 重算缺口清单 + 计数 ── */
const finalRows = []
for (let i = firstRow; i < lines.length; i++) {
  const cells = lines[i].split('|')
  if (cells.length < 6) continue
  const file = (cells[2] || '').replace(/`/g, '').trim().replace(/\.cjs$/, '')   // ⚠ trim 必须在剥后缀之前：单元格是 `x.cjs ` 带尾空格，否则一行都认不出来（首版就踩了）
  if (!retired.has(file)) continue
  finalRows.push({ file, purpose: cells[3].trim(), succ: cells[4].trim() })
}
const gaps = finalRows.filter(r => /无接管|覆盖缺口/.test(r.succ))
const taken = finalRows.length - gaps.length

const headIdx = lines.findIndex(l => /^## 覆盖缺口清单/.test(l))
const listEnd = (() => { for (let i = headIdx + 1; i < lines.length; i++) if (/^---\s*$/.test(lines[i])) return i; return lines.length })()
if (headIdx >= 0) {
  const bullets = gaps.map(r => `- \`${r.file}\` — ${r.purpose}`)
  lines.splice(headIdx, listEnd - headIdx,
    `## 覆盖缺口清单（无接管者，共 **${gaps.length}** 个；已收口 **${taken}** 条）`,
    '',
    '这些性质**目前没有自动守卫**。要补，就在 `qa/` 下新写守卫并登记进 `qa/run_all.cjs`（写 covers + critical 视情况）。',
    '**本清单由 `node qa/sync_retired.cjs` 从上面的原文件表派生**（别再手改：手改正是当初"已收口却仍挂在缺口里"的原因）。',
    '',
    ...bullets,
    '',
  )
}
let out = lines.join('\n')
out = out.replace(/(> 其余 \*\*)\d+(\*\* 条缺口仍)/, `$1${gaps.length}$2`)
out = out.replace(/(已收口的 )\d+( 条见上表)/, `$1${taken}$2`)
out = out.replace(/(> 其余 \*\*)\d+(\*\* 条缺口仍)/, `$1${gaps.length}$2`)
out = out.replace(/(已收口的 )\d+( 条见上表)/, `$1${taken}$2`)
fs.writeFileSync(MD, out)
console.log(`✔ 同步完成：退役文件 ${retired.size} 个｜已接管 ${taken}｜**缺口 ${gaps.length}**（表内改 ${changed} 行）`)
if (gaps.length !== finalRows.length - taken) process.exit(1)
