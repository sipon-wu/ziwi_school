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

  // 加 3 个文本框用于多选/对齐
  for (let i = 0; i < 3; i++) { await page.locator('button:has-text("+ 文本框")').first().click(); await page.waitForTimeout(200) }
  // 点空白取消选中
  await page.mouse.click(640, 700)
  await page.waitForTimeout(200)

  // 框选：从左上拖到右下（画布区域）
  const canvas = await page.locator('div[style*="cursor: move"]').first().boundingBox()
  if (canvas) {
    await page.mouse.move(canvas.x - 30, canvas.y - 30)
    await page.mouse.down()
    await page.mouse.move(canvas.x + 600, canvas.y + 200, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(300)
  }
  // 多选后应对齐按钮出现
  const alignBtn = await page.locator('button[title="左对齐"]').first().isVisible().catch(()=>false)
  A.push('多选后左对齐按钮=' + alignBtn)

  // 键盘删除（先单选一个元素再 Delete）
  const before = await page.locator('div[style*="cursor: move"]').count().catch(()=>0)
  // Shift 点第一个元素确保有选中
  await page.locator('div[style*="cursor: move"]').first().click({ force: true }).catch(()=>{})
  await page.waitForTimeout(200)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(300)
  const after = await page.locator('div[style*="cursor: move"]').count().catch(()=>0)
  A.push(`Delete删除: ${before}→${after}`)

  // Ctrl+Z 撤销
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(300)
  const restored = await page.locator('div[style*="cursor: move"]').count().catch(()=>0)
  A.push(`Ctrl+Z撤销后: ${restored}`)
  assert(restored > after, `Ctrl+Z 撤销恢复元素 (${after}→${restored})`)

  await page.screenshot({ path: 'ppt_canvas_align.png' })
  assert(errs.length === 0, '无 pageerror (' + errs.join('|') + ')')
  await browser.close()
  console.log(A.join('\n'))
  console.log(process.exitCode ? 'OVERALL: FAIL' : 'OVERALL: PASS')
})().catch(e => { console.log('ERR', e.message); process.exit(1) })
