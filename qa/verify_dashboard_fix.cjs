const { chromium } = require('playwright')

const BASE = 'http://school1.ziwi.cn'
const PHONE = '13800000002'
const PWD = 'teacher123'

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 600 } })
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console:' + m.text()) })

  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PWD }),
  })).json()
  const token = login.token
  if (!token) { console.log('LOGIN_FAIL', JSON.stringify(login)); await browser.close(); return }

  // 注入 token 进 /teacher
  await page.goto(BASE + '/login')
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), token)
  await page.goto(BASE + '/teacher', { waitUntil: 'networkidle' })

  // 1) main 是否可滚动
  const scroll = await page.evaluate(() => {
    const m = document.querySelector('main')
    if (!m) return { hasMain: false }
    const before = m.scrollTop
    m.scrollTop = 99999
    const after = m.scrollTop
    m.scrollTop = 0
    return { hasMain: true, scrollHeight: m.scrollHeight, clientHeight: m.clientHeight, scrolled: after > before }
  })

  // 2) 首页"近期草稿"标题列表 + 学科覆盖
  const recent = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('table tbody tr')]
      .filter(r => r.querySelector('a[href^="/lesson-plans/"]'))
    return rows.map(r => ({
      title: r.querySelector('a[href^="/lesson-plans/"]')?.textContent?.trim(),
      grade: r.children[1]?.textContent?.trim(),
      status: r.children[2]?.textContent?.trim(),
    }))
  })

  // 3) 草稿箱总数 + 第一页学科覆盖
  await page.goto(BASE + '/lesson-plans', { waitUntil: 'networkidle' })
  const draft = await page.evaluate(() => {
    const m = document.body.innerText.match(/共\s*(\d+)\s*份教案/)
    const subjCells = [...document.querySelectorAll('table tbody tr td:nth-child(2)')].map(td => td.textContent.trim())
    return { total: m ? Number(m[1]) : null, pageSubjects: subjCells }
  })

  console.log(JSON.stringify({
    pass: scroll.hasMain && scroll.scrolled && recent.length > 0,
    scroll,
    recentCount: recent.length,
    recent,
    draft,
    pageErrors,
  }, null, 2))
  await browser.close()
})()
