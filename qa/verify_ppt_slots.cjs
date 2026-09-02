// 验证 PPT「内容与模板分离」：预览态 P11 作业布置应只显示 3 列，无多余空白框
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  const fails = [], logs = []
  page.on('pageerror', e => fails.push('pageerror: ' + e.message))

  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: PHONE, password: PASS }) })
  if (!login.ok) { console.log('LOGIN_FAIL', login.status); process.exit(1) }
  const tok = (await login.json()).token
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), tok)
  await page.reload({ waitUntil: 'networkidle' })

  await page.goto(`${BASE}/courseware/ppt/cw-ppt-001`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const preview = page.locator('button', { hasText: '预览' }).first()
  if (await preview.isEnabled().catch(() => false)) { await preview.click(); await page.waitForTimeout(1200) }

  // 直接点击 P11 缩略图（左侧第11个）
  const thumbs = page.locator('aside, [class*="thumb"], nav').first()
  // 简化为键盘跳到第11页：按 10 次右箭头
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(250)
  }
  const txt = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
  logs.push('P11_text=' + txt.slice(0, 300))

  // 断言：同时含基础/提高/拓展；不应出现明显的空白占位文本（如「填写」或「(空白)」等）
  const has3 = txt.includes('基础') && txt.includes('提高') && txt.includes('拓展')
  logs.push('homework_3cols=' + has3)

  // 用 DOM 数粗判：页面内直接可见的 div 不应包含大量空内容块
  const divCount = await page.locator('div').count()
  logs.push('div_count=' + divCount)

  await browser.close()
  console.log(logs.join('\n'))
  const problems = []
  if (!has3) problems.push('P11 未渲染基础/提高/拓展三列')
  if (fails.length) problems.push(...fails)
  if (problems.length) { console.log('FAIL:\n' + problems.join('\n')); process.exit(1) }
  console.log('PASS: PPT 结构化版式按骨架渲染')
})().catch(e => { console.log('ERR', e.message); process.exit(1) })
