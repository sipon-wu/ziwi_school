// 刷新存量 H5 课件的派生 HTML（2026-09-15）
// 背景：`h5_html` 是**派生**产物（markdown → markdownToStorybookH5），发布/扫码/投屏用的是它。
// 今天新增的 HD 固定比例舞台只写在渲染器里 —— 存量件必须重新派生一次才会带上。
// 做法：打开课件编辑页（进页会自动重派生）→ 点「保存草稿」落库 → 回读确认 h5_html 已含 `body.hd{`。
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const ITEMS = [
  ['H5·国风', '0b2a3d76-9706-46ce-8e4b-d6c715a87c5c'],
  ['H5·科技', '1dee5b02-273c-4d39-9351-6fefcf6de7e4'],
]

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1560, height: 940 } })
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 160)))
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)

  for (const [label, id] of ITEMS) {
    await p.goto(`${B}/courseware/h5/${id}/edit`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(8000)
    const before = await (await fetch(`${B}/api/materials/${id}`, { headers: { Authorization: 'Bearer ' + t } })).text()
    const hadHd = /body\.hd\{/.test(before)
    await p.locator('button:has-text("保存草稿")').first().click().catch(() => log('  ⚠ 保存草稿按钮不可达'))
    await p.waitForTimeout(6000)
    const after = await (await fetch(`${B}/api/materials/${id}`, { headers: { Authorization: 'Bearer ' + t } })).json()
    const h5 = String(after.h5_html || '')
    log(`${label} 保存前含 HD 舞台=${hadHd} → 保存后 h5_html=${h5.length} 字 含 HD 舞台=${/body\.hd\{/.test(h5)} 含 cw-h5-hd=${/cw-h5-hd/.test(h5)}`)
  }
  await br.close()
  log('DONE')
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
