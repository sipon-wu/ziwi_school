// §5.2 家长端功能锁定验证：个人试用模式（licenseStatus !== 'active'）下，
// 侧边栏隐藏「家长签字」「成长关爱」，且直访 /care、/parent-sign 显示锁定提示。
// 纯前端模拟两种 license 态（篡改 localStorage.user.license_status），不改后端。
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))

  // 登录注入 token
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  const tok = await page.evaluate(async ({ phone, pass }) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password: pass }) })
    const d = await r.json()
    const t = d?.data?.token || d?.token || ''
    if (t) localStorage.setItem('zhiwei_token', t)
    return t
  }, { phone: PHONE, pass: PASS })
  console.log('[DIAG] token len=', tok.length)

  const setMode = (status) => page.evaluate((s) => {
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    u.license_status = s
    localStorage.setItem('user', JSON.stringify(u))
    localStorage.setItem('ziwi_sidebar_expanded', JSON.stringify(['备课', '练习', '数据', '沟通', '个人']))
  }, status)

  // ── active 模式：侧边栏应显示两项 ──
  await setMode('active')
  await page.goto(BASE + '/teacher', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const careActive = await page.locator('a:has-text("成长关爱")').count()
  const signActive = await page.locator('a:has-text("家长签字")').count()
  console.log('[ACTIVE] 成长关爱侧栏=', careActive, '家长签字侧栏=', signActive)

  // ── none（试用）模式：侧边栏应隐藏 ──
  await setMode('none')
  await page.goto(BASE + '/teacher', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const careNone = await page.locator('a:has-text("成长关爱")').count()
  const signNone = await page.locator('a:has-text("家长签字")').count()
  console.log('[NONE] 成长关爱侧栏=', careNone, '家长签字侧栏=', signNone)

  // 直访 /care 应锁定
  await page.goto(BASE + '/care', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const careLock = await page.locator('text=该功能在试用模式下不可用').count()
  console.log('[NONE] /care 锁定提示=', careLock)

  // 直访 /parent-sign 应锁定
  await page.goto(BASE + '/parent-sign', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const signLock = await page.locator('text=该功能在试用模式下不可用').count()
  console.log('[NONE] /parent-sign 锁定提示=', signLock)

  const ok = careActive >= 1 && signActive >= 1 && careNone === 0 && signNone === 0 && careLock >= 1 && signLock >= 1 && errs.length === 0
  console.log(ok ? 'PASS §5.2 锁定逻辑全绿' : 'FAIL §5.2 逻辑有误')
  if (errs.length) console.log('pageErrors=', errs)
  await browser.close()
  process.exit(ok ? 0 : 1)
})().catch(e => { console.error('SCRIPT_ERR', e); process.exit(1) })
