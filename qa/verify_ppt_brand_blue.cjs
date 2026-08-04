// 真浏览器验证：PPT 课件编辑器 品牌蓝统一 + 导出下拉 + 全屏导出补齐 + 撤销/重做图标
// 用法：BASE=http://school1.ziwi.cn PHONE=13800000002 PASS=teacher123 node verify_ppt_brand_blue.cjs
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const results = []
const record = (a, j, s, d) => { results.push({ a, j, s, d: String(d).slice(0, 240) }); console.log(`[${s}] ${a}/${j} :: ${String(d).slice(0, 200)}`) }

;(async () => {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: PHONE, password: PASS }) })
  const j = await login.json()
  const tok = j.token || (j.data && j.data.token)
  if (!tok) { console.log('LOGIN_FAIL', JSON.stringify(j)); process.exit(1) }

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(e.message))

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), tok)
  await page.goto(BASE + '/courseware/ppt/new', { waitUntil: 'domcontentloaded' })
  await sleep(2800)

  // 渲染健康
  const redirected = /(^|\/)login$/.test(page.url())
  const bodyTxt = await page.evaluate(() => document.body ? document.body.innerText : '')
  const appError = /Application error|Uncaught|is not defined|Cannot read properties/i.test(bodyTxt)
  record('ppt', '渲染', redirected || appError ? 'FAIL' : 'PASS', redirected ? 'redirected=/login' : appError ? 'appError' : 'PPT 编辑器进入正常')

  // 1) 非全屏顶栏「导出」下拉存在（多选导出）
  const exportBtn = await page.locator('button:has-text("导出")').first().isVisible().catch(() => false)
  record('导出', '非全屏下拉按钮', exportBtn ? 'PASS' : 'FAIL', exportBtn ? '找到「导出」下拉' : '未找到「导出」下拉')

  // 展开下拉，检查四个格式复选框 + 一键导出
  await page.locator('button:has-text("导出")').first().click()
  await sleep(500)
  const chkPpt = await page.locator('label:has-text("PPT")').first().isVisible().catch(() => false)
  const chkWord = await page.locator('label:has-text("Word")').first().isVisible().catch(() => false)
  const chkPdf = await page.locator('label:has-text("PDF")').first().isVisible().catch(() => false)
  const chkH5 = await page.locator('label:has-text("H5 互动课件")').first().isVisible().catch(() => false)
  const oneClick = await page.locator('button:has-text("一键导出所选")').first().isVisible().catch(() => false)
  record('导出', '下拉格式齐全', chkPpt && chkWord && chkPdf && chkH5 && oneClick ? 'PASS' : 'FAIL', `PPT=${chkPpt} Word=${chkWord} PDF=${chkPdf} H5=${chkH5} 一键导出=${oneClick}`)

  // 关闭下拉（点外部）
  await page.mouse.click(1200, 100)
  await sleep(300)

  // 2) 画布工具栏「撤销 / 重做」图标按钮（Word 一致）—— 需在有内容的课件编辑态才渲染
  //    新建空态无画布工具栏（合理），故此处改为在有内容课件编辑态验证
  const H = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }
  const mats = await (await fetch(`${BASE}/api/materials?type=courseware`, { headers: H })).json().catch(() => ({}))
  const cwId = (mats.items || [])[0]?.id || (mats.items || [])[0]?.ID
  let undoBtn = false, redoBtn = false
  if (cwId) {
    await page.goto(`${BASE}/courseware/ppt/${cwId}/edit`, { waitUntil: 'domcontentloaded' })
    await sleep(2600)
    undoBtn = await page.locator('button[title*="撤销"]').first().isVisible().catch(() => false)
    redoBtn = await page.locator('button[title*="重做"]').first().isVisible().catch(() => false)
    record('工具栏', '撤销/重做', undoBtn && redoBtn ? 'PASS' : 'FAIL', `撤销=${undoBtn} 重做=${redoBtn} (素材${cwId.slice(0, 8)})`)
  } else {
    record('工具栏', '撤销/重做', 'WARN', '无 courseware 素材，跳过有内容工具栏验证')
  }

  // 3) 品牌蓝：编辑器主操作色应为 #02A7F0，主按钮不再用紫 #722ED1
  //    检查主按钮类（AI生成课件按钮）：bg-[#02A7F0]
  const blueMain = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    return btns.some(b => b.className && typeof b.className === 'string' && b.className.includes('bg-[#02A7F0]'))
  })
  record('品牌蓝', '主按钮用蓝', blueMain ? 'PASS' : 'FAIL', blueMain ? '找到 bg-[#02A7F0] 主按钮' : '未找到品牌蓝主按钮')

  // 检查不应出现紫色主按钮（bg-[#722ED1]）
  const purpleMain = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    return btns.some(b => b.className && typeof b.className === 'string' && b.className.includes('bg-[#722ED1]'))
  })
  record('品牌蓝', '无紫色主按钮', purpleMain ? 'FAIL' : 'PASS', purpleMain ? '仍存在紫色主按钮 bg-[#722ED1]' : '无紫色主按钮')

  // 4) 全屏：导出齐全（PPT/Word/PDF/H5）
  const fsBtn = await page.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(x => /全屏/.test(x.innerText)))
  if (!fsBtn) { record('全屏', '入口', 'FAIL', '未找到「全屏」按钮') }
  else {
    record('全屏', '入口', 'PASS', '找到「全屏」按钮')
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /全屏/.test(x.innerText)); b.click() })
    await sleep(1200)
    const fsOn = await page.evaluate(() => document.body.innerText.includes('退出全屏 (Esc)'))
    record('全屏', '进入', fsOn ? 'PASS' : 'FAIL', fsOn ? '全屏 overlay 出现' : '未进入全屏')
    const expPpt = await page.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(x => /导出 PPT/.test(x.innerText)))
    const expWord = await page.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(x => /导出 Word/.test(x.innerText)))
    const expPdf = await page.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(x => /导出 PDF/.test(x.innerText)))
    const expH5 = await page.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(x => /导出 H5/.test(x.innerText)))
    record('全屏', '导出齐全', expPpt && expWord && expPdf && expH5 ? 'PASS' : 'FAIL', `PPT=${expPpt} Word=${expWord} PDF=${expPdf} H5=${expH5}`)
    // 退出全屏
    await page.keyboard.press('Escape')
    await sleep(600)
  }

  if (pageErrors.length) record('runtime', 'pageerror', 'FAIL', pageErrors.slice(0, 3).join(' | '))
  else record('runtime', 'pageerror', 'PASS', '0 pageerror')

  await browser.close()
  const fail = results.filter(r => r.s === 'FAIL').length
  const warn = results.filter(r => r.s === 'WARN').length
  const pass = results.filter(r => r.s === 'PASS').length
  console.log(`\n==== PPT 品牌蓝验证：${pass} PASS / ${fail} FAIL / ${warn} WARN ====`)
  process.exit(fail > 0 ? 1 : 0)
})().catch(e => { console.log('RUN ERROR', e.message); process.exit(2) })
