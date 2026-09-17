// 验证「二维码只属于预览/查看态」（2026-09-15）
// 判据（同一次运行内两态对比，且自证导航到了目标路由）：
//   编辑态 /courseware/h5/:id/edit → 右栏是 批注/版本；**不得**出现「手机扫码查看」与二维码图
//   查看态 /courseware/h5/:id      → 右栏是 手机扫码查看 + 二维码图
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const ID = '0b2a3d76-9706-46ce-8e4b-d6c715a87c5c'   // H5·国风
const log = (...a) => console.log(...a)

const probe = (p) => p.evaluate(() => {
  const body = document.body.innerText || ''
  const qrImg = [...document.querySelectorAll('img')].filter(i => (i.alt || '').includes('扫码'))
  return {
    path: location.pathname,
    hasScanHeader: /手机扫码查看/.test(body),
    hasAnnTab: /批注/.test(body) && /版本/.test(body),
    qrImgs: qrImg.length,
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

  const cases = [
    ['编辑态', `/courseware/h5/${ID}/edit`, 'edit'],
    ['查看态', `/courseware/h5/${ID}`, 'view'],
  ]
  const out = {}
  for (const [label, path, key] of cases) {
    await p.goto(B + path, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(9000)
    const st = await probe(p)
    out[key] = st
    log(`${label} ${st.path}`)
    log(`   手机扫码查看=${st.hasScanHeader} · 二维码图=${st.qrImgs} · 批注&版本=${st.hasAnnTab}`)
    await p.screenshot({ path: `/Users/sipon/CodeBuddy/AI教案/qa/_shots/h5_qr_${key}.png` })
  }
  const ok = !out.edit.hasScanHeader && out.edit.qrImgs === 0 && out.edit.hasAnnTab
    && out.view.hasScanHeader && out.view.qrImgs > 0
  log('\n结论：' + (ok ? '通过 ✔（编辑态=批注/版本，查看态=扫码）' : '不通过 ✘'))
  await br.close()
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
