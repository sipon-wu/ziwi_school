// ── 已退役（2026-09-29，用户选「2 清存量守卫」）────────────────────────────
// 原用途：{ key: 'lessonplan', url: '/lesson-plans/new', scene: '教案' },
// 退役理由：**从未登记进 `qa/run_all.cjs` 的守卫清单 ⇒ 不在 runner / 门禁 / CI 里执行** ——
//   它是"历史脚本"而不是"守卫"：没人跑它，就没人知道它的断言是否还成立（本轮之前还实测发现
//   这类文件多数带"静默通过"形状，见 `qa/gate_assert_hygiene.cjs` 的 R1~R4）。留着只会让人误以为这块有覆盖。
// 接管者：**无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单）
// 复活方式：去掉文件名前缀 `_retired_` 即可重新被扫描；要长期有效则**必须登记进 `qa/run_all.cjs`**（写 covers）。
// ──────────────────────────────────────────────────────────────────────
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

const PAGES = [
  { key: 'lessonplan', url: '/lesson-plans/new', scene: '教案' },
  { key: 'exercise',   url: '/exercises/new',   scene: '习题' },
  { key: 'exam',       url: '/exams/new',        scene: '试卷' },
  { key: 'sheet',      url: '/sheets/new',       scene: '题单' },
  { key: 'courseware', url: '/courseware/new',   scene: 'PPT 课件' },
]

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('CONSOLE: ' + m.text()) })

  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const j = await r.json()
  const token = j.token || (j.data && j.data.token)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.evaluate((t) => localStorage.setItem('zhiwei_token', t), token)

  let allPass = true
  for (const p of PAGES) {
    await page.goto(`${BASE}${p.url}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2800)
    const info = await page.evaluate(() => {
      const header = [...document.querySelectorAll('header')].find(h =>
        /bg-\[#212529\]/.test(h.className))
      const headerText = header ? (header.innerText || '').replace(/\s+/g, ' ').trim() : ''
      const btns = [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim())
      const hasAI = btns.some(t => t === 'AI 模式')
      const hasDoc = btns.some(t => t === '文档模式')
      // 收起/展开按钮（框架已移除，应不存在）
      const collapseBtn = [...document.querySelectorAll('button')].some(b =>
        /收起左侧面板|展开左侧面板/.test(b.getAttribute('title') || ''))
      const redirectedToLogin = location.pathname === '/login'
      return { headerText, hasAI, hasDoc, collapseBtn, redirectedToLogin }
    })
    await page.screenshot({ path: `/tmp/fc_${p.key}.png` }).catch(() => {})

    const sceneOk = info.headerText.includes(p.scene)
    const pass = info.hasAI && info.hasDoc && !info.collapseBtn && sceneOk && !info.redirectedToLogin
    if (!pass) allPass = false
    console.log(`[${p.key}] AI=${info.hasAI} Doc=${info.hasDoc} noCollapse=${!info.collapseBtn} scene[${p.scene}]=${sceneOk} login=${info.redirectedToLogin} => ${pass ? 'PASS' : 'FAIL'}`)
    console.log(`    header="${info.headerText.slice(0, 80)}"`)
  }

  console.log('=== errors ===')
  console.log(pageErrors.length ? pageErrors.slice(0, 8).join('\n') : '(none)')
  console.log(allPass ? 'ALL PASS' : 'SOME FAIL')
  await browser.close()
  process.exit(allPass ? 0 : 1)
})().catch(e => { console.error('SCRIPT_FAIL', e); process.exit(1) })
