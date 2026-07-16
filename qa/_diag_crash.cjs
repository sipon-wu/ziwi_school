const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', e => { errs.push((e.stack || e.message || String(e))); })
  p.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + (m.text() || '')) })
  await p.addInitScript(t => { if (t) localStorage.setItem('zhiwei_token', t) }, process.env.TOKEN)
  await p.goto('http://school1.ziwi.cn/lesson-plans/lp_681dff3a6a7b/edit?mode=doc', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(8000)
  console.log('=== PAGE ERRORS (' + errs.length + ') ===')
  console.log(errs.slice(0, 3).join('\n----\n'))
  await b.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
