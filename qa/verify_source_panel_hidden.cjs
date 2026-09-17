// 验证「来源（生成配方）」面板：**缺省隐藏**，`?debug=1` 才显示（2026-09-15）
// 判定：编辑页正文文本里不含 前置来源/发散边界/生成模型（缺省）；带 ?debug=1 时含（诊断可达）。
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const log = (...a) => console.log(...a)
const KEYS = ['前置来源', '发散边界', '生成模型']

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const ms = (await (await fetch(B + '/api/materials', { headers: { Authorization: 'Bearer ' + t } })).json()).items || []
  const pick = (fmt) => ms.find(x => String(x.format) === fmt && x.status === 'draft' && !/（旧/.test(String(x.name)))
  const targets = [['ppt', pick('ppt')], ['h5', pick('h5')]].filter(([, x]) => x)

  const br = await chromium.launch()
  let ok = true
  for (const [fmt, m] of targets) {
    const ctx = await br.newContext({ viewport: { width: 1560, height: 940 } })
    const p = await ctx.newPage()
    await p.goto(B + '/login', { waitUntil: 'domcontentloaded' })
    await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)

    const check = async (q) => {
      await p.goto(`${B}/courseware/${fmt}/${m.id}/edit${q}`, { waitUntil: 'domcontentloaded' })
      await p.waitForTimeout(7000)
      const txt = await p.evaluate(() => document.body.innerText || '')
      return KEYS.filter(k => txt.includes(k))
    }
    const normal = await check('')
    const dbg = await check('?debug=1')
    await p.goto(`${B}/courseware/${fmt}/${m.id}/edit`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(4000)
    await p.screenshot({ path: `/Users/sipon/CodeBuddy/AI教案/qa/_shots/panel_hidden_${fmt}.png` })
    const pass = normal.length === 0 && dbg.length === KEYS.length
    ok = ok && pass
    log(`${fmt.toUpperCase()} 《${m.name}》`)
    log(`   缺省（教师视角）命中诊断字段：${normal.length === 0 ? '无 ✔' : normal.join('/') + ' ✘'}`)
    log(`   ?debug=1 命中诊断字段：${dbg.length === KEYS.length ? '全部 ✔' : dbg.join('/') + ' ✘'}`)
    await ctx.close()
  }
  log(ok ? '\n结论：缺省隐藏、诊断可达 ✔ 通过' : '\n结论：✘ 未通过')
  await br.close()
  process.exit(ok ? 0 : 2)
})().catch(e => { console.error('FAIL:', e.message); process.exit(3) })
