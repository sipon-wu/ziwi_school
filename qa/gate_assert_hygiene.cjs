/**
 * M7 静态反假绿门（2026-09-27 立 · 1-4）
 *
 * 依据《0911 Skill服务化与验收防伪方案》§5.2 **M7「CI 反假绿门」**：
 *   "静态扫描 `verify_*.cjs`：命中 `if (!env) return`、`process.exit(0)` 早退、静默通过模式 → 告警/失败；
 *    报告强制**三态**，skipped ≠ passed。"
 *
 * 本门不跑网络/浏览器（**秒级**，故可挂 pre-commit），只做静态检查。规则各对应一次真实事故：
 *   R1 `process.exit(0)` —— 显式静默通过（事故：`verify_style_diversity.cjs` 样本为空 → "0 PASS/0 FAIL" → exit 0）
 *   R2 有断言调用（`must(`/`rec(`）**且**有汇总输出（`report()`/`断言`/`PASS /`）
 *   R3 用 `(process.env.X || '').split(',').filter(Boolean)` 取样本却**没**处理零样本 → 循环不执行即"绿"
 *   R4 **条件跳过必须标 SKIP**：按环境变量/数据缺失**提前 return/continue** 的分支，必须显式打印 `SKIP`
 *      （★ 第一版写成"文件中必须出现 SKIP 字样"，把"环境不可用就直接失败"的守卫也误判了 —— 那类行为是对的，
 *       不该罚。运行时那侧的 `skip = fail` 由 `qa/run_all.cjs` 三态判定强制，静态门只管"别偷偷跳过"。）
 *
 * 判定口径（**分级，不假装看不见**）：
 *   · **强制红** = ① `qa/run_all.cjs` 覆盖矩阵里的**关键守卫**（主目标/审计/写权限/库结构所在那几条）
 *               **∪** ② **基线之外的新文件**（基线见 `qa/.legacy_guards.json`）——
 *               否则"新加一个假绿守卫"会被当成存量而漏过（第一版就是这样，属于门自身的洞，已补）。
 *   · **登记（不判红）** = 基线内的**历史守卫**（6–9 月积累，实测 86 个）的问题**逐条计数并打印**，
 *     作为 P2 存量清单待整改 —— 既不让它污染门禁，也不把它藏起来。
 */
const fs = require('fs')
const path = require('path')
const { must, report } = require('./lib/assert.cjs')
const { GUARDS } = require('./run_all.cjs')

const { execFileSync } = require('child_process')

/**
 * `--staged`：连同**暂存区**一起校验（pre-commit 用这个模式）。
 *
 * 为什么必须有：本门原先只读**工作区**文件 → 事故（2026-09-27 实测踩到）：
 * `git add` 一个临时假绿守卫、随后把磁盘上的它删掉再提交 —— 门扫工作区（文件已不在）判绿，
 * 而**暂存区里那份照样被提交进去**。教训：门禁要校验**将被提交的内容**，不是"当前磁盘长什么样"。
 */
const STAGED = process.argv.includes('--staged')
const stagedGuards = () => {
  if (!STAGED) return []
  try {
    return execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' })
      .split('\n')
      .filter(f => /^qa\/(verify_.*|regression_.*)\.cjs$/.test(f))
      .map(f => f.replace(/^qa\//, ''))
  } catch { return [] }
}
const readStaged = (f) => execFileSync('git', ['show', `:qa/${f}`], { encoding: 'utf8' })

const QA = __dirname
const FILES = fs.readdirSync(QA)
  .filter(f => /^(verify_.*|regression_.*)\.cjs$/.test(f))
  .sort()
/** 基线内的历史守卫（其问题只登记）—— 基线之外的一律强制（防"新加一个假绿守卫"漏过） */
const LEGACY_BASELINE = new Set(
  fs.existsSync(path.join(QA, '.legacy_guards.json'))
    ? JSON.parse(fs.readFileSync(path.join(QA, '.legacy_guards.json'), 'utf8'))
    : []
)
const CRITICAL = new Set(GUARDS.filter(g => g.critical).map(g => g.name + '.cjs'))
const isEnforced = (f) => CRITICAL.has(f) || !LEGACY_BASELINE.has(f)

const RULES = [
  { id: 'R1', test: (s) => /process\.exit\(0\)/.test(s), why: 'process.exit(0)：静默通过（样本为空也会报绿）' },
  { id: 'R2a', test: (s) => !/must\(|rec\(/.test(s), why: '没有断言调用（must/rec）→ 套件不可能失败' },
  { id: 'R2b', test: (s) => !/report\(\)|断言|PASS \/|汇总/.test(s), why: '没有汇总输出 → 结果不可见' },
  {
    id: 'R3',
    test: (s) => /\.split\(','\)\.filter\(Boolean\)/.test(s) && !/length === 0|length ===0|SKIP/.test(s),
    why: "用 env 样本且未处理零样本 → 循环不执行即'绿'（verify_style_diversity 的历史假绿）",
  },
  {
    id: 'R4',
    test: (s) => /process\.env\./.test(s)
      && /if\s*\([^\n{]*process\.env[^\n]*\)[^\n{]*\{?[^}]{0,120}(return|continue|process\.exit)/.test(s)
      && !/SKIP/.test(s),
    why: '按环境变量条件提前跳过（return/continue/exit）却没打印 SKIP → 无法区分"跳过"与"通过"',
  },
]

;(async () => {
  must(FILES.length > 0, `发现守卫文件 ${FILES.length} 个`, { critical: [...CRITICAL], baseline: LEGACY_BASELINE.size })

  const hard = []   // 强制集的问题（判红）
  const legacy = [] // 基线内历史守卫的问题（登记）
  const staged = stagedGuards()
  const scan = [...new Set([...FILES, ...staged])]
  for (const f of scan) {
    // 暂存区有、工作区没有（= 刚被删掉仍留在暂存）→ 即将提交的内容与磁盘不一致，直接判红
    if (staged.includes(f) && !FILES.includes(f)) {
      hard.push(`${f}: 暂存区有但工作区不存在（即将提交的内容不在磁盘上，无法审阅）`)
      continue
    }
    let src
    try { src = staged.includes(f) ? readStaged(f) : fs.readFileSync(path.join(QA, f), 'utf8') } catch { continue }
    const bad = RULES.filter(r => r.test(src)).map(r => `${r.id}(${r.why})`)
    if (!bad.length) continue
    ;(isEnforced(f) ? hard : legacy).push(`${f}: ${bad.join(' ')}`)
  }
  // 基线的"过期"也要看得见：已删除的历史守卫 → 提示可清理（不算问题）
  const baselineGone = [...LEGACY_BASELINE].filter(f => !FILES.includes(f))

  must(CRITICAL.size > 0, '覆盖矩阵里定义了关键守卫（强制红的那批）', { n: CRITICAL.size })
  must(hard.length === 0, '强制集（关键守卫 + 基线外新文件）均无"静默通过"模式（M7 静态门）', { issues: hard })
  if (baselineGone.length) console.log(`   [note] 基线里有 ${baselineGone.length} 个文件已不存在（可从 qa/.legacy_guards.json 移除）`)
  console.log(`   [登记] 历史守卫存量问题：**${legacy.length}** 个文件（P2 待整改，不判红；明细前 5 条）`)
  for (const l of legacy.slice(0, 5)) console.log(`     - ${l.slice(0, 150)}`)

  /* 反向自检：门必须能抓到假绿（否则又是一层假绿） */
  const FAKE = `const S = (process.env.IDS || '').split(',').filter(Boolean)\nfor (const i of S) {}\nconsole.log('0 PASS / 0 FAIL')\nprocess.exit(0)\n`
  const caught = RULES.filter(r => r.test(FAKE)).map(r => r.id)
  must(caught.includes('R1') && caught.includes('R3'),
    '反向自检：把"样本空 → exit 0"的假绿样本丢进规则，必须被 R1/R3 抓到（证明本门不是摆设）', { caught })
  report()
})().catch(e => {
  console.error('✘ 门自身异常：' + e.message)
  process.exitCode = 2
})
