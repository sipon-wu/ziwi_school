// 验证 H5 互动课件频道的模板库接入：
// 1) 进入 /courseware/h5/new 后，左栏模板库可见
// 2) 模板面板中出现 H5 清单注册的模板（如「国风·水墨交互」），证明 H5_TEMPLATES 注入成功
// 3) 点击一个 H5 模板套用后不报错、不跳登录（套用逻辑与 PPT 共用 applyTemplate）
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://localhost:5173'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', e => pageErrors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })

  // 登录取 token 后注入 localStorage（与 verify_courseware_channels.cjs 同模式）
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const j = await r.json()
  const token = j.token || (j.data && j.data.token)
  if (!token) { console.log('LOGIN_FAIL', JSON.stringify(j)); process.exit(1) }

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), token)
  await page.goto(BASE + '/courseware/h5/new', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  if (page.url().includes('/login')) { console.log('STILL_LOGIN'); process.exit(1) }

  const results = {}
  // H5 模板面板按钮（标题「模板」的 button）
  const tplBtn = page.locator('button[title="模板库"]')
  results.tplButtonVisible = await tplBtn.isVisible().catch(() => false)
  if (results.tplButtonVisible) {
    await tplBtn.click()
    await page.waitForTimeout(600)
  }
  // H5 清单里注册的模板名应出现在面板中（证明 H5_TEMPLATES 注入）
  const panelText = await page.locator('div.absolute.right-0.top-9').innerText().catch(() => '')
  results.h5TemplateRegistered = panelText.includes('国风·水墨交互') || panelText.includes('科技·蓝色引擎')
  results.panelNotEmpty = panelText.trim().length > 0

  // 套用一个 H5 模板（点第一个可见模板按钮）
  let applied = false
  if (results.tplButtonVisible) {
    const firstTpl = page.locator('div.absolute.right-0.top-9 button:has(img)').first()
    if (await firstTpl.isVisible().catch(() => false)) {
      await firstTpl.click()
      await page.waitForTimeout(800)
      applied = true
    }
  }
  results.templateApplied = applied
  // 套用后不应跳登录、不应有 pageerror
  results.notRedirectedToLogin = !page.url().includes('/login')

  const pass = Object.values(results).every(v => v === true) && pageErrors.length === 0
  console.log('RESULTS:', JSON.stringify(results))
  console.log('PAGE_ERRORS:', pageErrors.length ? pageErrors.join(' | ') : 'none')
  console.log('CONSOLE_ERRORS(non-fatal):', consoleErrors.length ? consoleErrors.slice(0, 3).join(' | ') : 'none')
  console.log(pass ? 'PASS' : 'FAIL')
  await browser.close()
  process.exit(pass ? 0 : 1)
})().catch(e => { console.log('SCRIPT_ERR', e.message); process.exit(1) })
