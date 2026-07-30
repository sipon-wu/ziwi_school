// 知微前端冒烟脚本：遍历核心路由，捕获 pageerror / console error / 应用崩溃白屏。
// 用法：
//   npm install            (首次，需联网装 playwright)
//   npx playwright install chromium
//   BASE=http://school1.ziwi.cn node smoke.cjs        # 默认即 staging
//   BASE=https://school.ziwi.cn node smoke.cjs        # 可选：生产
// 退出码：0 = 全部 OK；非 0 = 有 FAIL。报告写 ./smoke_report.json。

const { chromium } = require('playwright')
const fs = require('fs')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const USER = process.env.QA_USER || '13800000002'
const PASS = process.env.QA_PASS || 'teacher123'

// 核心路由（与之前 staging 冒烟清单一致）
const routes = [
  '/teacher', '/lesson-plans', '/lesson-plans/new', '/exercises', '/exercises/new',
  '/exams', '/exams/new', '/assignments', '/assignments/new', '/care',
  '/materials', '/analytics', '/grading', '/growth', '/parent-sign',
  '/published-lessons', '/review-pool', '/classes', '/settings', '/it-admin', '/principal',
]

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_EXEC || '/Users/sipon/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-x64/chrome-headless-shell', args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const pageErrors = [], consoleErrors = []
  page.on('pageerror', e => pageErrors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })

  // 稳健登录：Node 侧真实登录 API 拿 token，注入 localStorage（避开 UI 登录 harness 坑），仍为真实浏览器渲染
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: USER, password: PASS }),
  }).catch(() => null)
  const auth = loginRes ? await loginRes.json().catch(() => ({})) : {}
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  if (auth.token) {
    await page.evaluate((a) => {
      localStorage.setItem('zhiwei_token', a.token)
      localStorage.setItem('user', JSON.stringify(a.user || {}))
    }, auth)
  }
  await page.goto(BASE + '/teacher', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(2500)

  const results = []
  for (const r of routes) {
    const beforePE = pageErrors.length, beforeCE = consoleErrors.length
    let status = 'OK', note = ''
    try { await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 25000 }); await page.waitForTimeout(1500) }
    catch (e) { status = 'FAIL'; note = '导航: ' + e.message.split('\n')[0] }
    let appError = false
    try {
      appError = await page.evaluate(() => {
        const t = document.body ? document.body.innerText : ''
        const rootEmpty = document.querySelector('#root') ? document.querySelector('#root').childElementCount === 0 : false
        return /Application error|Uncaught|is not defined|Cannot read/i.test(t) || rootEmpty
      })
    } catch {}
    const pe = pageErrors.slice(beforePE), ce = consoleErrors.slice(beforeCE)
    // 教师账号访问权限管控页时，后端 RBAC 返回 403 属预期拒绝（非缺陷），不记 WARN
    const RBAC_ROUTES = ['/it-admin', '/principal']
    const only403 = ce.length > 0 && ce.every(t => /403|Forbidden/i.test(t))
    if (status !== 'FAIL' && (pe.length > 0 || appError)) status = 'FAIL'
    else if (ce.length > 0 && !(RBAC_ROUTES.includes(r) && only403)) status = 'WARN'
    else if (ce.length > 0) note = 'RBAC 403 预期拒绝(教师访问管控页)'
    results.push({ route: r, status, pe: pe.length, ce: ce.length, ceText: ce.slice(0, 3).join(' || ').slice(0, 300), note: note || (pe.length ? pe[0].slice(0, 120) : '') })
    console.log(`[${status}] ${r}  pe=${pe.length} ce=${ce.length}${pe.length ? '  ' + pe[0].slice(0, 100) : ''}`)
  }
  await browser.close()

  const fails = results.filter(r => r.status === 'FAIL')
  const warns = results.filter(r => r.status === 'WARN')
  const report = { base: BASE, results, fails, warns, summary: { total: results.length, FAIL: fails.length, WARN: warns.length } }
  fs.writeFileSync('./smoke_report.json', JSON.stringify(report, null, 2))
  console.log(`\nSUMMARY: total=${results.length} FAIL=${fails.length} WARN=${warns.length}`)
  console.log(fails.length === 0 ? 'FULL_SMOKE_OK' : 'FULL_SMOKE_FAIL=' + fails.length)
  process.exit(fails.length === 0 ? 0 : 1)
})().catch(e => { console.error('ERR', e); process.exit(1) })
