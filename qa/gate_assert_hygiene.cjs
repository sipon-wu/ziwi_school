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
 *   · **强制红**：`qa/run_all.cjs` 覆盖矩阵里的**关键守卫**（当前主目标/审计/写权限/库结构所在的那几条）必须零问题；
 *   · **登记（不判红）**：其余**历史守卫**（6–9 月积累，实测 90+ 个）的问题**逐条计数并打印**，
 *     作为 P2 存量清单待整改 —— 既不让它污染门禁，也不把它藏起来。
 */
const fs = require('fs')
const path = require('path')
const { must, report } = require('./lib/assert.cjs')
const { GUARDS } = require('./run_all.cjs')

const QA = __dirname
const FILES = fs.readdirSync(QA)
  .filter(f => /^(verify_.*|regression_.*)\.cjs$/.test(f))
  .sort()
const ENFORCED = new Set(GUARDS.filter(g => g.critical).map(g => g.name + '.cjs'))

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
  must(FILES.length > 0, `发现守卫文件 ${FILES.length} 个`, { enforced: [...ENFORCED] })

  const hard = []   // 关键守卫的问题（判红）
  const legacy = [] // 历史守卫的问题（登记）
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(QA, f), 'utf8')
    const bad = RULES.filter(r => r.test(src)).map(r => `${r.id}(${r.why})`)
    if (!bad.length) continue
    ;(ENFORCED.has(f) ? hard : legacy).push(`${f}: ${bad.join(' ')}`)
  }

  must(ENFORCED.size > 0, '覆盖矩阵里定义了关键守卫（强制红的那批）', { n: ENFORCED.size })
  must(hard.length === 0, '关键守卫均无"静默通过"模式（M7 静态门 · 强制）', { issues: hard })
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
