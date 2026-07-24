const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:5173'
const sleep = ms => new Promise(r => setTimeout(r, ms))
;(async () => {
  const b = await chromium.launch({ headless: true })
  const p = await (await b.newContext({ viewport: { width: 1536, height: 864 } })).newPage()
  p.on('console', m => { if (m.type() === 'error') console.log('CERR:', m.text().slice(0, 200)) })
  p.on('pageerror', e => console.log('PERR:', String(e.message || e).slice(0, 200)))
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await sleep(9000)
  const info = await p.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => i.placeholder || i.type || i.name)
    const btns = Array.from(document.querySelectorAll('button')).map(b => (b.innerText || '').trim()).filter(Boolean).slice(0, 10)
    const t = document.body?.innerText || ''
    return { url: location.href, inputs, btns, bodyHead: t.slice(0, 400), appErr: /Application error|Cannot read/.test(t) }
  })
  console.log(JSON.stringify(info, null, 2))
  await b.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
