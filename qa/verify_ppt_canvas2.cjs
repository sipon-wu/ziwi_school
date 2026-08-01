const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const A = []
const assert = (c, m) => { A.push((c?'PASS ':'FAIL ')+m); if(!c) process.exitCode=1 }
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
  page.on('pageerror', e => errs.push(e.message))
  await page.goto(BASE, { waitUntil:'domcontentloaded' })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), tok)
  await page.goto(`${BASE}/courseware/ppt/${cwId}/edit`, { waitUntil:'networkidle' })
  await page.waitForTimeout(2000)

  // ① 加文本框（自动选中）→ 富文本工具出现
  await page.locator('button:has-text("+ 文本框")').first().click()
  await page.waitForTimeout(400)
  const fontSel = await page.locator('select[title="字体"]').first().isVisible().catch(()=>false)
  const italicBtn = await page.locator('button[title="斜体"]').first().isVisible().catch(()=>false)
  const underlineBtn = await page.locator('button[title="下划线"]').first().isVisible().catch(()=>false)
  const lineHeightSel = await page.locator('select[title="行距"]').first().isVisible().catch(()=>false)
  assert(fontSel && italicBtn && underlineBtn && lineHeightSel, `① 选中文本框出现富文本工具 (font=${fontSel},I=${italicBtn},U=${underlineBtn},行距=${lineHeightSel})`)

  // ② 加形状（自动选中）→ 形状选择器 + 扩充形状
  await page.locator('button:has-text("+ 形状")').first().click()
  await page.waitForTimeout(400)
  const shapeSel = page.locator('select[title="形状"]').first()
  const shapeSelVisible = await shapeSel.isVisible().catch(()=>false)
  assert(shapeSelVisible, '② 形状选择器存在')
  const opts = await shapeSel.locator('option').allTextContents().catch(()=>[])
  assert(opts.some(o=>o.includes('箭头')) && opts.some(o=>o.includes('星形')) && opts.some(o=>o.includes('气泡')) && opts.some(o=>o.includes('圆角')), `② 形状库扩充 (${opts.join('/')})`)

  // ③ 复制/副本/删除按钮（有选中时）
  const copyBtn = await page.locator('button[title*="复制"]').first().isVisible().catch(()=>false)
  const dupBtn = await page.locator('button[title*="副本"]').first().isVisible().catch(()=>false)
  const delBtn = await page.locator('button:has-text("删除")').first().isVisible().catch(()=>false)
  assert(copyBtn && dupBtn && delBtn, `③ 复制/副本/删除按钮存在 (${copyBtn},${dupBtn},${delBtn})`)

  // ④ 撤销/重做：点副本后撤销应可点
  await page.locator('button[title*="副本"]').first().click().catch(()=>{})
  await page.waitForTimeout(300)
  const undoEnabled = await page.locator('button[title*="撤销"]').first().isEnabled().catch(()=>false)
  assert(undoEnabled, '④ 副本操作后撤销按钮可用')

  // ⑤ 点撤销 → 元素数回退（验证撤销栈工作）
  const countBefore = await page.locator('div[style*="cursor: move"]').count().catch(()=>0)
  await page.locator('button[title*="撤销"]').first().click().catch(()=>{})
  await page.waitForTimeout(300)
  const countAfter = await page.locator('div[style*="cursor: move"]').count().catch(()=>0)
  A.push(`撤销前元素=${countBefore} 撤销后=${countAfter}`)
  assert(countAfter < countBefore, `⑤ 撤销后元素数回退 (${countBefore}→${countAfter})`)

  await page.screenshot({ path: 'ppt_canvas_v2.png' })
  assert(errs.length === 0, '无 pageerror (' + errs.join('|') + ')')
  await browser.close()
  console.log(A.join('\n'))
  console.log(process.exitCode ? 'OVERALL: FAIL' : 'OVERALL: PASS')
})().catch(e => { console.log('ERR', e.message); process.exit(1) })
