// 验证 6 个编辑器页 footer「预览」按钮都走全屏预览层（fixed inset-0 z-50），
// 与教案一致；并截图预览层。控制页：教案/题单；改造页：出题/试卷。
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://localhost:5173'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

const PAGES = [
  { key: 'lessonplan', url: '/lesson-plans/new', name: '教案' },
  { key: 'assignment', url: '/assignments/new', name: '题单' },
  { key: 'exercise', url: '/exercises/new', name: '出题' },
  { key: 'exam', url: '/exams/new', name: '试卷' },
]

;(async () => {
  const b = await chromium.launch()
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const { token } = await loginRes.json().catch(() => ({}))
  if (!token) { console.log('LOGIN_FAIL', loginRes.status); await b.close(); process.exit(1) }
  await page.addInitScript(t => localStorage.setItem('zhiwei_token', t), token)

  let allPass = true
  for (const p of PAGES) {
    await page.goto(BASE + p.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2200)
    // footer 三按钮（含背景色，判断发布按钮是否绿色异类）
    const footerBtns = await page.evaluate(() => {
      const footers = [...document.querySelectorAll('div')].filter(d => /border-t border-\[#F0F0F0\]/.test(d.className) && /flex gap-3/.test(d.className))
      const btns = footers.flatMap(f => [...f.querySelectorAll('button')]).map(x => ({
        text: (x.textContent || '').trim(),
        bg: getComputedStyle(x).backgroundColor,
      }))
      return btns
    })
    const hasThree = footerBtns.length >= 3
    const publishBtn = footerBtns[footerBtns.length - 1]
    const publishBg = publishBtn ? publishBtn.bg : null
    // 发布按钮不绿：绿色为 rgb(21, 168, 95)
    const pubOk = publishBg !== null && !/21,\s*168,\s*95/.test(publishBg)
    // 点 footer「预览」
    let overlayOpen = false, overlayTitle = '', overlayHasContent = false
    try {
      await page.getByRole('button', { name: '预览', exact: true }).click({ timeout: 5000 })
      await page.waitForTimeout(900)
      const ov = await page.evaluate(() => {
        const el = document.querySelector('.fixed.inset-0.z-50')
        if (!el) return null
        const r = el.getBoundingClientRect()
        const t = el.querySelector('span')?.textContent || ''
        const inner = el.querySelector('.flex-1.overflow-auto')?.innerText || ''
        return { title: t, w: Math.round(r.width), h: Math.round(r.height), innerLen: inner.length }
      })
      overlayOpen = !!ov && ov.w > 0 && ov.h > 0
      overlayTitle = ov ? ov.title : ''
      overlayHasContent = !!ov && ov.innerLen > 0
      if (overlayOpen) {
        await page.screenshot({ path: `/tmp/preview_shots/${p.key}_overlay.png` })
        await page.getByRole('button', { name: '返回编辑' }).click({ timeout: 4000 })
        await page.waitForTimeout(500)
      }
    } catch (e) {
      overlayOpen = false
    }

    const pass = hasThree && pubOk && overlayOpen && overlayHasContent
    if (!pass) allPass = false
    console.log(`[${p.name}] footerBtns=${JSON.stringify(footerBtns.map(b => b.text))} publishBg=${publishBg} overlay=${overlayOpen} title="${overlayTitle}" content=${overlayHasContent} => ${pass ? 'PASS' : 'FAIL'}`)
  }

  await b.close()
  console.log(allPass ? 'ALL_PASS' : 'HAS_FAIL')
  process.exit(allPass ? 0 : 1)
})()
