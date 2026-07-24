// 一次性诊断：抓取 Maximum update depth 的 React 组件栈（通过 console.error 的 args 还原）
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:5173'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

;(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on('console', async (m) => {
    if (m.type() !== 'error') return
    const txt = m.text() || ''
    if (!/Maximum update depth/.test(txt)) return
    console.log('### MAX DEPTH MSG:', txt.slice(0, 200))
    try {
      const args = m.args()
      for (const a of args) {
        const v = await a.jsonValue().catch(() => null)
        const s = (v && (v.stack || v.componentStack || (typeof v === 'string' ? v : JSON.stringify(v)))) || ''
        if (/at |component|useEffect|setState/.test(s)) console.log('--- ARG STACK ---\n' + String(s).slice(0, 2000))
      }
    } catch {}
  })

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const j = await login.json()
  const token = j?.data?.token || j?.token
  await page.goto(BASE)
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), token)
  await page.reload()
  await page.goto(`${BASE}/lesson-plans/new`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(9000)
  await browser.close()
})().catch(e => { console.error('DIAG FATAL', e); process.exit(1) })
