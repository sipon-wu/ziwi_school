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

  // ── 预览态：批注/版本栏已撤 ──
  await page.goto(`${BASE}/courseware/ppt/${cwId}`, { waitUntil:'networkidle' })
  await page.waitForTimeout(1800)
  const annTabGone = await page.locator('.fixed.inset-0.z-50 button:has-text("批注")').count().catch(()=>0)
  assert(annTabGone === 0, `① 预览态批注/版本栏已撤 (残留=${annTabGone})`)

  // ── 编辑态：属性面板 ──
  await page.goto(`${BASE}/courseware/ppt/${cwId}/edit`, { waitUntil:'networkidle' })
  await page.waitForTimeout(2000)
  // 未选中元素 → 属性面板显示"选中画布元素后"
  const propHint = await page.locator('text=选中画布元素后').first().isVisible().catch(()=>false)
  assert(propHint, '② 未选中时属性面板提示"选中画布元素后"')
  // 加文本框（自动选中）→ 属性面板显示文本样式设置
  await page.locator('button:has-text("+ 文本框")').first().click()
  await page.waitForTimeout(400)
  const propFont = await page.locator('select').filter({ has: page.locator('option:has-text("默认(雅黑)")') }).first().isVisible().catch(()=>false)
  const propPos = await page.locator('text=位置 · 尺寸').first().isVisible().catch(()=>false)
  assert(propFont && propPos, `② 选中文本框属性面板显示字体+位置设置 (font=${propFont},pos=${propPos})`)
  // 收起属性面板 → 半透展开钮
  await page.locator('button[title="收起面板"]').first().click().catch(()=>{})
  await page.waitForTimeout(300)
  const expandBtn = await page.locator('button[title="展开属性面板"]').first().isVisible().catch(()=>false)
  assert(expandBtn, '② 收起属性面板后出现半透展开钮')
  await page.locator('button[title="展开属性面板"]').first().click().catch(()=>{})
  await page.waitForTimeout(300)

  // ── 全屏编辑 ──
  await page.locator('button[title="全屏编辑"]').first().click()
  await page.waitForTimeout(400)
  const fsOverlay = await page.locator('.fixed.inset-0.z-\\[80\\]').count().catch(()=>0)
  const fsExit = await page.locator('button:has-text("退出全屏")').first().isVisible().catch(()=>false)
  assert(fsOverlay >= 1 && fsExit, `③ 点全屏进入全屏编辑 (overlay=${fsOverlay},退出钮=${fsExit})`)
  await page.screenshot({ path: 'ppt_fullscreen.png' })
  // 退出全屏
  await page.locator('button:has-text("完成")').first().click()
  await page.waitForTimeout(400)
  const fsGone = await page.locator('.fixed.inset-0.z-\\[80\\]').count().catch(()=>0)
  assert(fsGone === 0, `③ 点完成退出全屏 (残留=${fsGone})`)

  await page.screenshot({ path: 'ppt_proppanel.png' })
  assert(errs.length === 0, '无 pageerror (' + errs.join('|') + ')')
  await browser.close()
  console.log(A.join('\n'))
  console.log(process.exitCode ? 'OVERALL: FAIL' : 'OVERALL: PASS')
})().catch(e => { console.log('ERR', e.message); process.exit(1) })
