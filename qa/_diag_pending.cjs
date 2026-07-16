const { chromium } = require('playwright')
const BASE = 'http://school1.ziwi.cn'
const TOKEN = process.env.TOKEN || ''
const TARGET = '/lesson-plans/lp_681dff3a6a7b/edit?mode=doc'
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const reqs = []
  page.on('request', r => reqs.push({ url: r.url(), method: r.method(), status: 'pending' }))
  page.on('response', r => {
    const i = reqs.find(x => x.url === r.url() && x.status === 'pending')
    if (i) i.status = r.status()
  })
  page.on('requestfailed', r => {
    const i = reqs.find(x => x.url === r.url() && x.status === 'pending')
    if (i) i.status = 'FAILED'
  })
  await page.addInitScript((t) => { if (t) localStorage.setItem('zhiwei_token', t) }, TOKEN)
  await page.goto(BASE + TARGET, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)
  const pending = reqs.filter(r => r.status === 'pending')
  process.stdout.write('TOTAL=' + reqs.length + '\n')
  process.stdout.write('PENDING(' + pending.length + '):\n')
  pending.forEach(r => process.stdout.write('  ' + r.method + ' ' + r.url.slice(0, 120) + '\n'))
  await browser.close()
})().catch(e => { process.stdout.write('ERR ' + e.message + '\n'); process.exit(1) })
