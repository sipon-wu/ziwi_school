// 知识图谱缺陷修复验证：统计三类错误在 /lesson-plans/new 加载后出现次数
// 期望：Maximum update depth = 0；G6 destroyed / draw 应随循环修复而消失（仅可能剩 StrictMode 单次双挂载，容许 <=2）
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:5173'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

;(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const counts = { depth: 0, destroyed: 0, draw: 0, other: 0 }
  const others = new Set()
  page.on('console', m => {
    if (m.type() !== 'error') return
    const t = m.text() || ''
    if (/Maximum update depth/.test(t)) counts.depth++
    else if (/graph instance has been destroyed/.test(t)) counts.destroyed++
    else if (/reading 'draw'/.test(t)) counts.draw++
    else { counts.other++; if (others.size < 5) others.add(t.slice(0, 140)) }
  })
  page.on('pageerror', e => {
    const t = e.message || ''
    if (/reading 'draw'/.test(t)) counts.draw++
    else { counts.other++; if (others.size < 5) others.add('[pageerror] ' + t.slice(0, 140)) }
  })

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const j = await login.json()
  const token = j?.data?.token || j?.token
  if (!token) { console.log('LOGIN FAIL', JSON.stringify(j).slice(0, 200)); await browser.close(); process.exit(1) }
  await page.goto(BASE)
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), token)
  await page.reload()
  await page.goto(`${BASE}/lesson-plans/new`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(8000)

  console.log('=== 错误计数 ===')
  console.log(JSON.stringify(counts, null, 2))
  if (others.size) { console.log('--- 其他错误(样例) ---'); for (const o of others) console.log(o) }
  const ok = counts.depth === 0 && counts.destroyed <= 2 && counts.draw <= 2
  console.log(ok ? 'RESULT: PASS（知识图谱缺陷已修复）' : 'RESULT: FAIL（仍有未修复错误）')
  await browser.close()
  process.exit(ok ? 0 : 1)
})().catch(e => { console.error('VERIFY FATAL', e); process.exit(2) })
