// 验证编辑器外壳一致性：题单 / 教案 / 出题 / 组卷 / 试卷 / 课件
// 用法：BASE=http://localhost:5173 PHONE=13800000002 PASS=teacher123 node verify_shell_consistency.cjs
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:5173'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const shots = '/tmp/shell_shots'
const fs = require('fs')
fs.mkdirSync(shots, { recursive: true })

;(async () => {
  const b = await chromium.launch()
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
  // 在 Node 侧登录（经 vite 代理到 staging），避免浏览器 about:blank 源跨源 fetch 失败
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const loginJson = await loginRes.json().catch(() => ({}))
  const tok = loginJson.token
  if (!tok) { console.log('LOGIN_FAIL', loginRes.status, JSON.stringify(loginJson).slice(0, 200)); await b.close(); process.exit(1) }
  console.log('TOKEN_OK len=', tok.length)
  await page.addInitScript(t => { if (t) localStorage.setItem('zhiwei_token', t) }, tok)

  const targets = [
    ['assignment', '/assignments/new'],
    ['lessonplan', '/lesson-plans/new'],
    ['exercise', '/exercises/new'],
    ['sheet', '/sheets/new'],
    ['exam', '/exams/new'],
    ['courseware', '/materials'],
  ]
  for (const [name, path] of targets) {
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(1800)
      await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true })
      console.log('SHOT_OK', name)
    } catch (e) {
      console.log('SHOT_ERR', name, e.message)
    }
  }
  await b.close()
  console.log('DONE', shots)
})()
