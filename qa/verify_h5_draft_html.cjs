// 验证「H5 草稿也落派生 HTML」（2026-09-15）
// 判据：打开 H5 课件编辑页 → 保存草稿 → 素材的 h5_html 非空，且含 HD 舞台与固定比例运行时代码。
// 只动这一份（H5·国风），保存前后都读一次，同一次运行内对比。
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const ID = '0b2a3d76-9706-46ce-8e4b-d6c715a87c5c'   // H5·国风（观潮 国风 09-15）
const log = (...a) => console.log(...a)

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const get = async () => (await (await fetch(`${B}/api/materials/${ID}`, { headers: { Authorization: 'Bearer ' + t } })).json())
  const before = await get()
  log(`保存前：正文 ${String(before.content || '').length} 字 · h5_html ${String(before.h5_html || '').length} 字`)

  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1560, height: 940 } })
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 160)))
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  await p.goto(`${B}/courseware/h5/${ID}/edit`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(9000)
  await p.locator('button:has-text("保存草稿")').first().click().catch(() => log('  ⚠ 保存按钮不可达'))
  await p.waitForTimeout(7000)
  const after = await get()
  const h5 = String(after.h5_html || '')
  log(`保存后：正文 ${String(after.content || '').length} 字 · h5_html ${h5.length} 字`)
  log(`  h5_html 含 HD 固定比例舞台 = ${/body\.hd\{/.test(h5)} · 含父级开关 = ${/cw-h5-hd/.test(h5)} · 含 16:9 缩放 = ${/--hd-s/.test(h5)}`)
  log(`  正文未变 = ${String(before.content) === String(after.content)}`)
  await br.close()
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
