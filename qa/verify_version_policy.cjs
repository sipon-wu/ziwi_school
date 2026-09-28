// 版本粒度策略单测（2026-09-15）——纯函数，确定性，不依赖浏览器/LLM。
// 覆盖：生成的里程碑语义 · 内容去重 · 点击 2 分钟合并窗 · 自动 5 分钟节流 · 里程碑不参与合并
const { execSync } = require('child_process')
const path = require('path')
// 2026-09-29：改用**标准断言库**（原自定义 `chk()` 只打印 ✔/✘，门禁与 runner 识别不到它的结论，
// 于是这条其实有效的纯函数单测被当成"没有汇总输出"）。改写后：断言条数/失败数统一可见，可纳入 runner。
const { must, report } = require('./lib/assert.cjs')
const FE = path.resolve(__dirname, '../code/frontend')
const OUT = '/tmp/vp_bundle.cjs'

execSync(
  `npx esbuild src/lib/versionPolicy.ts --bundle --format=cjs --platform=node --outfile=${OUT} --log-level=error`,
  { cwd: FE, stdio: 'inherit' },
)
const { decideVersion, CLICK_COALESCE_MS, AUTO_THROTTLE_MS } = require(OUT)

const NOW = Date.parse('2026-09-15T10:00:00+08:00')
const ago = (ms) => new Date(NOW - ms).toISOString()
const snap = (label, msAgo) => ({ kind: 'snapshot', label, created_at: ago(msAgo) })

const chk = (got, want, msg) => must(got === want, msg, { got, want })

console.log(`窗口：点击 ${CLICK_COALESCE_MS / 60000} 分钟 · 自动 ${AUTO_THROTTLE_MS / 60000} 分钟\n`)

// ① 生成 = 里程碑：总是建版（即使内容与上一版完全相同）
chk(decideVersion({ trigger: 'gen', last: snap('保存草稿', 1000), contentSame: true, now: NOW }), 'create',
  '系统生成 → 总是建版（哪怕内容与上一版一致）')

// ② 内容没变 → 不重复建
chk(decideVersion({ trigger: 'click', last: snap('保存草稿', 10 * 60 * 1000), contentSame: true, now: NOW }), 'skip-identical',
  '点击保存 + 内容未变 → 跳过（不重复建）')

// ③ 点击保存：内容有变，但距上一版 30 秒 → 合并（防无意连点）
chk(decideVersion({ trigger: 'click', last: snap('保存草稿', 30 * 1000), contentSame: false, now: NOW }), 'skip-window',
  '点击保存 + 30 秒内再点 → 合并（不建版）')

// ④ 点击保存：距上一版 70 秒（刚过 1 分钟窗口）→ 建版
chk(decideVersion({ trigger: 'click', last: snap('保存草稿', 70 * 1000), contentSame: false, now: NOW }), 'create',
  '点击保存 + 70 秒（> 1 分钟窗口）→ 建版')

// ⑤ 自动保存：距上一版 2 分钟 → 仍在 3 分钟节流窗内 → 不建
chk(decideVersion({ trigger: 'auto', last: snap('保存草稿', 2 * 60 * 1000), contentSame: false, now: NOW }), 'skip-window',
  '自动保存 + 2 分钟（点窗口已过、自动窗口未过）→ 仍节流')

// ⑥ 自动保存：距上一版 4 分钟（刚过 3 分钟窗口）→ 建版
chk(decideVersion({ trigger: 'auto', last: snap('保存草稿', 4 * 60 * 1000), contentSame: false, now: NOW }), 'create',
  '自动保存 + 4 分钟（> 3 分钟窗口）→ 建版')

// ⑦ 里程碑不参与合并：最新版是"换风格前…"时，随后的点击保存照常建版
chk(decideVersion({ trigger: 'click', last: snap('换风格前（重档 → 国风）', 30 * 1000), contentSame: false, now: NOW }), 'create',
  '最新版是里程碑（换风格前）→ 点击保存照常建版（不被吞掉）')

// ⑧ 一条版本都没有 → 建版
chk(decideVersion({ trigger: 'click', last: null, contentSame: false, now: NOW }), 'create', '无任何版本 → 建版')

// ⑨ 最新版是发布版（kind=release）→ 点击保存照常建版
chk(decideVersion({ trigger: 'click', last: { kind: 'release', label: '观潮_课件', created_at: ago(30 * 1000) },
  contentSame: false, now: NOW }), 'create', '最新版是发布版 → 点击保存照常建版')

report()
