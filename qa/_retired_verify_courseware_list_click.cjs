// ── 已退役（2026-09-29，用户选「2 清存量守卫」）────────────────────────────
// 原用途：(原文件无头部说明)
// 退役理由：**从未登记进 `qa/run_all.cjs` 的守卫清单 ⇒ 不在 runner / 门禁 / CI 里执行** ——
//   它是"历史脚本"而不是"守卫"：没人跑它，就没人知道它的断言是否还成立（本轮之前还实测发现
//   这类文件多数带"静默通过"形状，见 `qa/gate_assert_hygiene.cjs` 的 R1~R4）。留着只会让人误以为这块有覆盖。
// 接管者：**无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单）
// 复活方式：去掉文件名前缀 `_retired_` 即可重新被扫描；要长期有效则**必须登记进 `qa/run_all.cjs`**（写 covers）。
// ──────────────────────────────────────────────────────────────────────
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const A = []
const assert = (c, m) => { A.push((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1 }
;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(e.message))
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ phone: PHONE, password: PASS }) })
  if (!login.ok) { console.log('LOGIN_FAIL', login.status); process.exit(1) }
  const tok = (await login.json()).token
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), tok)
  await page.goto(`${BASE}/courseware/ppt`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const before = page.url()
  A.push('listUrl=' + before)
  if (before.includes('/login')) { console.log('STILL_LOGIN'); await browser.close(); console.log(A.join('\n')); process.exit(1) }
  // 点第一个数据行（tbody tr）
  const firstRow = page.locator('tbody tr').first()
  const rowCount = await page.locator('tbody tr').count()
  A.push('rowCount=' + rowCount)
  await firstRow.click()
  await page.waitForTimeout(1500)
  const after = page.url()
  A.push('afterClickUrl=' + after)
  assert(after.includes('/courseware/ppt/') && after.split('/').filter(Boolean).length >= 5, `列表点击应在当前页跳转到 /courseware/ppt/:id (after=${after})`)
  assert(!after.includes('/login'), '未跳回登录')
  assert(pageErrors.length === 0, '无 pageerror (' + pageErrors.join('|') + ')')
  await browser.close()
  console.log(A.join('\n'))
  console.log(process.exitCode ? 'OVERALL: FAIL' : 'OVERALL: PASS')
})().catch(e => { console.log('ERR', e.message); process.exit(1) })
