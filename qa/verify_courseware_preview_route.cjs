// 验证路由：列表 → 全屏预览（只读放映） → 编辑
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

  await page.goto(`${BASE}/courseware/ppt`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const row = page.locator('table tbody tr').first()
  await row.waitFor({ timeout: 8000 })
  const name = (await row.locator('td').first().innerText()).trim()
  logs.push('clicked=' + name)

  // 列表点击 → 应进全屏预览（/:id 不带 /edit，readOnly=true → PreviewOverlay 打开）
  const [popup] = await Promise.all([ context.waitForEvent('page'), row.click() ])
  await popup.waitForLoadState('networkidle')
  await popup.waitForTimeout(1200)
  const url = popup.url()
  logs.push('afterListClick_url=' + url)
  if (url.includes('/edit')) fails.push('列表点击应进预览态(:/id)，但进了 ' + url)

  // 全屏预览：overlay 容器存在 + "编辑"按钮可见
  const overlayCount = await popup.locator('.fixed.inset-0.z-50').count().catch(() => 0)
  logs.push('overlayFixedCount=' + overlayCount)
  if (overlayCount < 1) fails.push('列表点击未进入全屏预览（无 PreviewOverlay 容器）')

  const editBtn = popup.getByRole('button', { name: '编辑' })
  const hasEditBtn = await editBtn.isVisible().catch(() => false)
  logs.push('previewEditBtn(编辑)=' + hasEditBtn)
  if (!hasEditBtn) fails.push('全屏预览无"编辑"按钮（无法进编辑态）')

  // 点"编辑" → 进编辑态（框架 forceEdit 原地解锁：overlay 关闭、工具栏可见；url 不变，与全站 view→edit 一致）
  if (hasEditBtn) {
    await editBtn.click()
    await popup.waitForTimeout(1200)
    const overlayAfter = await popup.locator('.fixed.inset-0.z-50').count().catch(() => 0)
    logs.push('overlayAfterEdit=' + overlayAfter)
    if (overlayAfter >= 1) fails.push('点"编辑"后全屏预览未关闭（未进编辑态）')
    const hasToolbar = await popup.getByText('+ 文本框', { exact: true }).isVisible().catch(() => false)
    logs.push('toolbarInEdit(+文本框)=' + hasToolbar)
    if (!hasToolbar) fails.push('编辑态未渲染工具栏')
    const hasCollapse = await popup.getByTitle('收起页列表').isVisible().catch(() => false)
    logs.push('collapseBtnInEdit=' + hasCollapse)
    if (!hasCollapse) fails.push('编辑态缩略图不可收起')
    // 收起后应有展开入口
    if (hasCollapse) {
      await popup.getByTitle('收起页列表').click()
      await popup.waitForTimeout(300)
      const expanded = await popup.getByText('页面列表 ›').isVisible().catch(() => false)
      logs.push('afterCollapse_expandEntry=' + expanded)
      if (!expanded) fails.push('收起后未出现展开入口')
    }
  }

  await browser.close()
  console.log(logs.join('\n'))
  if (fails.length) { console.log('FAIL:\n' + fails.join('\n')); process.exit(1) }
  console.log('PASS: 列表→全屏预览→编辑 路由链路全部通过')
})().catch(e => { console.log('ERR', e.message); process.exit(1) })
