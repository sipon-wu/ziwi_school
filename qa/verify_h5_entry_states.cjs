// 按**教师真实入口**验证 H5 两态与右栏（2026-09-15）
// 规则（此前会话确认过）：列表**点条目** → 预览态（/:id）；列表**点右端小笔尖** → 编辑态（/:id/edit）。
// 判据：
//   ① 点条目 → 路由 /courseware/h5/:id（无 /edit）→ 右栏 = 手机扫码查看 + 二维码
//   ② 点笔尖 → 路由 /courseware/h5/:id/edit      → 右栏 = 批注 / 版本（无二维码）
// 两态都在同一次运行内、都从列表页点进去（不直接敲 URL）。
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const NAME = '观潮 国风 09-15'
const log = (...a) => console.log(...a)

const probe = (p) => p.evaluate(() => {
  const body = document.body.innerText || ''
  return {
    path: location.pathname,
    scan: /手机扫码查看/.test(body),
    qr: [...document.querySelectorAll('img')].filter(i => (i.alt || '').includes('扫码')).length,
    ann: /批注/.test(body) && /版本/.test(body),
  }
})

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

  // 列表点击是 window.open（新标签页）→ 必须捕获 popup，否则盯着列表页什么也看不到（上次就是这么错的）
  const openList = async () => {
    await p.goto(B + '/courseware/h5', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(5000)
  }
  const clickAndCatch = async (loc) => {
    const [np] = await Promise.all([p.context().waitForEvent('page', { timeout: 15000 }), loc.click()])
    await np.waitForLoadState('domcontentloaded').catch(() => { })
    await np.waitForTimeout(9000)
    return np
  }
  const row = () => p.locator('tr,div[class*="row"],li').filter({ hasText: NAME }).first()

  // ① 点条目（列表行本身）
  await openList()
  const r1 = row()
  log('列表里找到条目 = ' + (await r1.count() > 0))
  const p1 = await clickAndCatch(r1)
  const s1 = await probe(p1)
  log(`① 点条目 → ${s1.path}`)
  log(`   扫码栏=${s1.scan} 二维码图=${s1.qr} 批注&版本=${s1.ann}`)
  await p1.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/h5_entry_row.png' })
  await p1.close()

  // ② 点右端小笔尖（title="编辑草稿"）
  await openList()
  const pencil = p.locator('button[title="编辑草稿"]').first()
  log('列表里找到笔尖 = ' + (await pencil.count() > 0))
  const p2 = await clickAndCatch(pencil)
  const s2 = await probe(p2)
  log(`② 点笔尖 → ${s2.path}`)
  log(`   扫码栏=${s2.scan} 二维码图=${s2.qr} 批注&版本=${s2.ann}`)
  await p2.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/h5_entry_pencil.png' })
  await p2.close()

  const ok = !/\/edit$/.test(s1.path) && s1.scan && s1.qr > 0
    && /\/edit$/.test(s2.path) && !s2.scan && s2.qr === 0 && s2.ann
  log('\n结论：' + (ok ? '通过 ✔（点条目=预览态→扫码；点笔尖=编辑态→批注/版本）' : '不通过 ✘'))
  await br.close()
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
