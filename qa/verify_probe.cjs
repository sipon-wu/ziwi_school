const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
;(async () => {
  const login = await fetch(`${BASE}/api/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({phone:PHONE,password:PASS}) })
  const tok = (await login.json()).token
  const H = { Authorization:'Bearer '+tok, 'Content-Type':'application/json' }
  const mats = await (await fetch(`${BASE}/api/materials?type=courseware`, { headers:H })).json().catch(()=>({}))
  const cwId = (mats.items||[])[0]?.id || (mats.items||[])[0]?.ID
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport:{width:1280,height:900} })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR:'+e.message))
  page.on('console', m => { if (m.type()==='error') errs.push('CONSOLE:'+m.text()) })
  await page.goto(BASE, { waitUntil:'domcontentloaded' })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), tok)
  await page.goto(`${BASE}/courseware/ppt/${cwId}/edit`, { waitUntil:'networkidle' })
  await page.waitForTimeout(2000)
  // 画布元素初始数
  const before = await page.evaluate(() => document.querySelectorAll('div[style*="cursor: move"]').length)
  console.log('元素初始=', before)
  // 点 +文本框
  const btn = page.locator('button:has-text("+ 文本框")').first()
  const btnVisible = await btn.isVisible().catch(()=>false)
  console.log('+文本框按钮可见=', btnVisible)
  await btn.click().catch(e => console.log('click err', e.message))
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => document.querySelectorAll('div[style*="cursor: move"]').length)
  console.log('点后元素=', after)
  console.log('errors=', errs.slice(0,5).join(' | ') || 'none')
  await browser.close()
})().catch(e => { console.log('ERR', e.message); process.exit(1) })
