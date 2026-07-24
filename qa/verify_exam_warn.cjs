// P3 组卷页 G6 遗留 WARN 消除验证：打开 /exams/new，捕获 console 中的
// "Cannot update a component ... while rendering" / "Maximum update depth" / "graph instance has been destroyed" / "reading 'draw'"
// 目标：确认 G6 修复（useKnowledgePicker useMemo + ExamBuilder 渲染期 setState→useEffect）后该 WARN 已消失。
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const warns = []
  const errors = []
  page.on('console', m => {
    const t = m.text()
    if (m.type() === 'warning' || m.type() === 'error') {
      if (/Cannot update a component|Maximum update depth|graph instance has been destroyed|reading 'draw'|while rendering/i.test(t)) {
        warns.push(`[${m.type()}] ${t}`)
      }
    }
  })
  page.on('pageerror', e => errors.push(String(e)))

  // 登录注入 token
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  const tok = await page.evaluate(async ({ phone, pass }) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password: pass }) })
    const d = await r.json()
    const t = d?.data?.token || d?.token || ''
    if (t) localStorage.setItem('zhiwei_token', t)
    return t
  }, { phone: PHONE, pass: PASS })
  console.log('[DIAG] login token len=', tok.length)

  await page.goto(BASE + '/exams/new', { waitUntil: 'networkidle' })
  await page.waitForTimeout(4500) // 等待知识图谱/小微挂载与可能的循环稳定

  await browser.close()

  console.log('[RESULT] g6-related warnings=', warns.length)
  warns.forEach(w => console.log('   ', w))
  console.log('[RESULT] pageerrors=', errors.length)
  if (warns.length === 0 && errors.length === 0) {
    console.log('PASS 组卷页 G6 遗留 WARN 已消除（0 相关警告/错误）')
  } else {
    console.log('WARN 组卷页仍有 G6 相关警告/错误，需排查')
  }
})().catch(e => { console.error('SCRIPT_ERR', e); process.exit(1) })
