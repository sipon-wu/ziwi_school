// 一次性诊断：出题页白屏真实错误（不过滤）
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:5173'
const sleep = ms => new Promise(r => setTimeout(r, ms))
;(async () => {
  const b = await chromium.launch({ headless: true })
  const p = await (await b.newContext({ viewport: { width: 1536, height: 864 } })).newPage()
  const all = []
  p.on('console', m => { if (m.type() === 'error') all.push('CERR: ' + m.text().slice(0, 200)) })
  p.on('pageerror', e => all.push('PAGEERR: ' + String(e.message || e).slice(0, 200)))
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }); await sleep(800)
  await p.fill('input[placeholder="请输入手机号"]', '13800000002')
  await p.fill('input[placeholder="请输入密码"]', 'teacher123')
  await p.click('button[type=submit]'); await sleep(1500)
  await p.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' }); await sleep(6000)
  const info = await p.evaluate(() => ({ url: location.href, len: (document.body?.innerText || '').length, rootHtml: (document.getElementById('root')?.innerHTML || '').slice(0, 120) }))
  console.log('INFO', JSON.stringify(info))
  console.log('全部错误(' + all.length + '):')
  all.slice(0, 12).forEach(e => console.log('  ' + e))
  await b.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
