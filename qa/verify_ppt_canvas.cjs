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

  // 工具栏新功能存在性
  const undoBtn = await page.locator('button[title*="撤销"]').first().isVisible().catch(()=>false)
  const redoBtn = await page.locator('button[title*="重做"]').first().isVisible().catch(()=>false)
  assert(undoBtn, '撤销按钮存在')
  assert(redoBtn, '重做按钮存在')

  // 选中一个文本框 → 出现富文本工具（字体/斜体/下划线/行距/对齐）
  const textEl = page.locator('div').locator('..').locator('div[style*="cursor: move"]').first()
  // 点画布上第一个文本元素
  await page.locator('.whitespace-pre-wrap').first().click({ force: true }).catch(()=>{})
  await page.waitForTimeout(300)
  const fontSel = await page.locator('select[title="字体"]').first().isVisible().catch(()=>false)
  const italicBtn = await page.locator('button[title="斜体"]').first().isVisible().catch(()=>false)
  const underlineBtn = await page.locator('button[title="下划线"]').first().isVisible().catch(()=>false)
  const lineHeightSel = await page.locator('select[title="行距"]').first().isVisible().catch(()=>false)
  A.push('fontSel='+fontSel+' italic='+italicBtn+' underline='+underlineBtn+' lineHeight='+lineHeightSel)
  assert(fontSel && italicBtn && underlineBtn && lineHeightSel, '选中文本框出现富文本工具（字体/斜体/下划线/行距）')

  // 形状库扩充（先加个形状）
  await page.locator('button:has-text("+ 形状")').first().click().catch(()=>{})
  await page.waitForTimeout(300)
  const shapeSel = await page.locator('select[title="形状"]').first().isVisible().catch(()=>false)
  assert(shapeSel, '形状选择器存在')
  if (shapeSel) {
    const opts = await page.locator('select[title="形状"] option').allTextContents()
    A.push('shapeOpts=' + opts.join(','))
    assert(opts.some(o=>o.includes('箭头')) && opts.some(o=>o.includes('星形')) && opts.some(o=>o.includes('气泡')), `形状库含箭头/星形/气泡 (${opts.join('/')})`)
  }

  // 复制/粘贴按钮（选中形状后）
  const copyBtn = await page.locator('button[title*="复制"]').first().isVisible().catch(()=>false)
  assert(copyBtn, '复制按钮存在（选中元素后）')

  await page.screenshot({ path: 'ppt_canvas_new.png', fullPage: false })
  assert(errs.length === 0, '无 pageerror (' + errs.join('|') + ')')
  await browser.close()
  console.log(A.join('\n'))
  console.log(process.exitCode ? 'OVERALL: FAIL' : 'OVERALL: PASS')
})().catch(e => { console.log('ERR', e.message); process.exit(1) })
