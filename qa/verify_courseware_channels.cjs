// 真浏览器验证：教学课件三频道（PPT / H5 / 视频）导航与交互 + 视频配置草稿持久化
// 注意：CoursewareBuilder 是无侧边栏全屏编辑器，三频道在编辑器顶部 segment 互切；
// 侧边栏「教学课件」分组仅用于在 /teacher 等列表页进入各频道入口。
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

  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const j = await r.json()
  const token = j.token || (j.data && j.data.token)
  if (!token) { console.log('LOGIN_FAIL', JSON.stringify(j)); process.exit(1) }

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), token)
  await page.goto(BASE + '/teacher', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  if (page.url().includes('/login')) { console.log('STILL_LOGIN'); process.exit(1) }

  const results = {}
  const ok = (k, v) => { results[k] = v }

  // 1) 侧边栏「教学课件」分组 + 三个子频道入口可见
  ok('NAV_GROUP', await page.locator('text=教学课件').first().isVisible().catch(() => false))
  ok('NAV_PPT', await page.locator('a:has-text("PPT 课件")').first().isVisible().catch(() => false))
  ok('NAV_H5', await page.locator('a:has-text("H5 互动课件")').first().isVisible().catch(() => false))
  ok('NAV_VIDEO', await page.locator('a:has-text("视频课件")').first().isVisible().catch(() => false))

  // 2) PPT 频道：点击侧边栏入口（整页跳转）
  await page.locator('a:has-text("PPT 课件")').first().click()
  await page.waitForTimeout(900)
  ok('PPT_URL', page.url().includes('/courseware/new'))
  ok('PPT_CHIP', await page.locator('button:has-text("PPT 课件")').first().isVisible().catch(() => false))
  ok('PPT_EXPORT', await page.locator('button:has-text("导出 PPT")').first().isVisible().catch(() => false))

  // 3) H5 频道：编辑器顶部 segment 切换（SPA 内，不卸载）
  await page.locator('button:has-text("H5 互动课件")').first().click()
  await page.waitForTimeout(700)
  ok('H5_URL', page.url().includes('/courseware/h5'))
  ok('H5_CHIP', await page.locator('button:has-text("H5 互动课件")').first().isVisible().catch(() => false))
  const h5Btn = page.locator('button:has-text("导出 H5")').first()
  ok('H5_EXPORT_VISIBLE', await h5Btn.isVisible().catch(() => false))
  ok('H5_EXPORT_ENABLED', await h5Btn.isDisabled().then(d => !d).catch(() => false))

  // 4) 视频频道：segment 切换 + 配置面板 + 选择 + 保存草稿后 videoConfig 落入 localStorage
  await page.locator('button:has-text("视频课件")').first().click()
  await page.waitForTimeout(700)
  ok('VIDEO_URL', page.url().includes('/courseware/video'))
  ok('VIDEO_PANEL', await page.locator('text=出镜形象').first().isVisible().catch(() => false))
  ok('VIDEO_STYLE', await page.locator('text=讲解风格').first().isVisible().catch(() => false))
  await page.locator('button:has-text("平台数字人")').first().click()
  await page.waitForTimeout(200)
  await page.locator('button:has-text("实验演示")').first().click()
  await page.waitForTimeout(200)
  await page.locator('button:has-text("保存草稿")').first().click()
  await page.waitForTimeout(600)
  const draft = await page.evaluate(() => localStorage.getItem('zhiwei_cw_draft'))
  let vc = null
  try { vc = JSON.parse(draft).videoConfig } catch {}
  ok('VIDEO_CONFIG_SAVED', !!vc && vc.presenter === 'avatar' && vc.style === 'experiment')

  // 5) 切回 PPT 频道，内容/草稿不应丢失（单路由不卸载）
  await page.locator('button:has-text("PPT 课件")').first().click()
  await page.waitForTimeout(500)
  ok('BACK_PPT_URL', page.url().includes('/courseware/new'))

  const functional = Object.values(results)
  const allFunc = functional.every(v => v === true)
  const pass = allFunc && pageErrors.length === 0

  console.log('RESULTS:', JSON.stringify(results))
  console.log('PAGE_ERRORS:', pageErrors.length ? pageErrors.join(' | ') : 'none')
  console.log('CONSOLE_ERRORS(non-fatal):', consoleErrors.length ? consoleErrors.slice(0, 3).join(' | ') : 'none')
  console.log(pass ? 'PASS' : 'FAIL')
  await browser.close()
  process.exit(pass ? 0 : 1)
})().catch(e => { console.log('SCRIPT_ERR', e.message); process.exit(1) })
