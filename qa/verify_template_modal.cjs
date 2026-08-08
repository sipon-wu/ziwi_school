// 真浏览器验证：课件模板库统一弹层（按风格 / 按色系 双维度分类，选中即全文换肤套用）
// 流程：登录 → 取已有 PPT 课件 id → 进入编辑 → 打开模板弹层 → 验证维度 tab → 套用风格模板 → 切色系维度 → 套用色系模板
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', e => pageErrors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })

  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const j = await r.json()
  const token = j.token || (j.data && j.data.token)
  if (!token) { console.log('LOGIN_FAIL', JSON.stringify(j)); process.exit(1) }

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(t => { localStorage.setItem('zhiwei_token', t); sessionStorage.setItem('zhiwei_token', t) }, token)

  // 取一个已有 PPT 课件 id（避免空大纲触发 AI 生成）
  let materialId = ''
  try {
    const listRes = await fetch(`${BASE}/api/materials?kind=courseware&format=ppt&page=1&page_size=5`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const listJ = await listRes.json()
    const items = listJ.items || listJ.data?.items || []
    const first = items.find(x => x.format === 'ppt') || items[0]
    materialId = first?.id || ''
  } catch (e) {
    console.log('LIST_ERR', e.message)
  }
  if (!materialId) { console.log('NO_COURSEWARE_ID'); process.exit(1) }

  // 进入编辑页
  await page.goto(`${BASE}/courseware/ppt/${materialId}/edit`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  if (page.url().includes('/login')) { console.log('STILL_LOGIN'); process.exit(1) }

  const results = {}
  const ok = (k, v) => { results[k] = v }

  // 1) 顶部「模板」按钮可见
  const tplBtn = page.locator('button:has-text("模板")').first()
  ok('TPL_BTN', await tplBtn.isVisible().catch(() => false))
  await tplBtn.click()
  await page.waitForTimeout(400)
  ok('TPL_PANEL', await page.locator('text=课件模板库').first().isVisible().catch(() => false))

  // 2) 维度 tab
  ok('DIM_STYLE', await page.locator('button:has-text("按风格")').first().isVisible().catch(() => false))
  ok('DIM_COLOR', await page.locator('button:has-text("按色系")').first().isVisible().catch(() => false))

  // 3) 按风格：筛选 chip「全部」可见，且不含「通用/basic」标签
  const chipRow = page.locator('button:has-text("全部")').first().locator('xpath=ancestor::div[1]')
  const chipText = await chipRow.innerText().catch(() => '')
  ok('NO_BASIC_CHIP', !chipText.includes('通用'))
  ok('STYLE_CHIP_ALL', await page.locator('button:has-text("全部")').first().isVisible().catch(() => false))

  // 4) 点击一个风格模板 → 套用成功（按钮出现 ✓）
  const styleCard = page.locator('button', { hasText: /版式/ }).first()
  ok('STYLE_CARD', await styleCard.isVisible().catch(() => false))
  await styleCard.click()
  await page.waitForTimeout(700)
  ok('STYLE_APPLIED', await page.locator('button:has-text("模板✓")').first().isVisible().catch(() => false))

  // 5) 重新打开，切到「按色系」
  await tplBtn.click()
  await page.waitForTimeout(300)
  await page.locator('button:has-text("按色系")').first().click()
  await page.waitForTimeout(400)
  const colorCard = page.locator('button', { hasText: '通用 ·' }).first()
  ok('COLOR_CARD', await colorCard.isVisible().catch(() => false))

  // 6) 点击一个色系 → 套用
  await colorCard.click()
  await page.waitForTimeout(700)
  ok('COLOR_APPLIED', await page.locator('button:has-text("模板✓")').first().isVisible().catch(() => false))

  const functional = Object.values(results)
  const allFunc = functional.every(v => v === true)
  const pass = allFunc && pageErrors.length === 0

  console.log('RESULTS:', JSON.stringify(results, null, 2))
  console.log('PAGE_ERRORS:', pageErrors.length ? pageErrors.join(' | ') : 'none')
  console.log('CONSOLE_ERRORS(non-fatal):', consoleErrors.length ? consoleErrors.slice(0, 3).join(' | ') : 'none')
  console.log(pass ? 'PASS' : 'FAIL')
  await browser.close()
  process.exit(pass ? 0 : 1)
})().catch(e => { console.log('SCRIPT_ERR', e.message); process.exit(1) })
