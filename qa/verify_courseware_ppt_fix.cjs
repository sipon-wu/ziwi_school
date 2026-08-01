// 验证 PPT 课件列表点击进编辑态（有工具栏+缩略图可收起），而非只读放映页
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  const fails = []
  const logs = []

  page.on('pageerror', e => fails.push('pageerror: ' + e.message))

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  if (!login.ok) { console.log('LOGIN_FAIL', login.status); process.exit(1) }
  const tok = (await login.json()).token
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), tok)
  await page.reload({ waitUntil: 'networkidle' })

  // 进 PPT 课件列表
  await page.goto(`${BASE}/courseware/ppt`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const row = page.locator('table tbody tr').first()
  await row.waitFor({ timeout: 8000 })
  const name = (await row.locator('td').first().innerText()).trim()
  logs.push('clicked=' + name)

  // openWorkspace 用 window.open 新标签 → 捕获 popup
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    row.click(),
  ])
  await popup.waitForLoadState('networkidle')
  await popup.waitForTimeout(1500)
  const url = popup.url()
  const isEdit = url.includes('/edit')
  logs.push('popupUrl=' + url + ' isEdit=' + isEdit)
  if (!isEdit) fails.push('列表点击未进编辑态(:/id/edit)，url=' + url)

  // 不在全屏放映页
  const overlayVisible = await popup.getByText('返回编辑').isVisible().catch(() => false)
  if (overlayVisible) fails.push('进入了全屏放映页(看到"返回编辑")，应默认编辑态')

  // 有编辑工具栏（EditableCanvas 工具条："+ 文本框" 按钮始终可见）
  const hasToolbar = await popup.getByText('+ 文本框', { exact: true }).isVisible().catch(() => false)
  logs.push('toolbar(+文本框)=' + hasToolbar)
  if (!hasToolbar) fails.push('未渲染 PPT 编辑工具栏(无"+ 文本框"按钮)')

  // 缩略图可收起
  const hasCollapse = await popup.getByTitle('收起页列表').isVisible().catch(() => false)
  logs.push('collapseBtn=' + hasCollapse)
  if (!hasCollapse) fails.push('缩略图不可收起(无"收起页列表"按钮)')
  if (hasCollapse) {
    await popup.getByTitle('收起页列表').click()
    await popup.waitForTimeout(400)
    const expanded = await popup.getByText('页面列表 ›').isVisible().catch(() => false)
    logs.push('afterCollapse_expandEntry=' + expanded)
    if (!expanded) fails.push('收起后未出现展开入口')
  }

  await browser.close()
  console.log(logs.join('\n'))
  if (fails.length) { console.log('FAIL:\n' + fails.join('\n')); process.exit(1) }
  console.log('PASS: 列表点击进编辑态+工具栏+缩略图可收起 全部通过')
})().catch(e => { console.log('ERR', e.message); process.exit(1) })
