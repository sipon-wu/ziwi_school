// 逐页截图 PPT 课件（查看态 /courseware/ppt/:id 自动开预览）
// 通过点击左侧缩略图（文本形如 P1/P2…）逐页切换并截图，避免依赖「下一页」按钮。
// 用法：IDS=id1,id2 node qa/capture_ppt_pages.cjs
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const IDS = (process.env.IDS || '').split(',').filter(Boolean)
const OUT = process.env.OUT || path.join(__dirname, 'shots_ppt_diversified')
const MAXP = parseInt(process.env.MAXP || '16', 10)

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const t = (await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(x => localStorage.setItem('zhiwei_token', x), t)

  for (const id of IDS) {
    await page.goto(`${BASE}/courseware/ppt/${id}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3500)

    // 取课件名（优先面包屑/标题区，回退用 id）
    const name = await page.evaluate(() => {
      const el = document.querySelector('h1,h2,[class*="title"]')
      const s = el && (el.innerText || '').trim()
      return s && s.length < 40 ? s : ''
    })
    const safe = (name || id.slice(0, 8)).replace(/[^\w一-龥]/g, '').slice(0, 16) || id.slice(0, 8)

    // 缩略图数量 = 页数（页码是 <span>P{n}</span>，选择器须含 span）
    const total = await page.evaluate(() => {
      let n = 0
      document.querySelectorAll('span,div,button,li,p').forEach(e => {
        const txt = (e.childElementCount === 0 ? (e.textContent || '') : '').trim()
        if (/^P\d+$/.test(txt)) n++
      })
      return n
    })
    console.log(`${safe} (${id.slice(0, 8)}): 识别到 ${total} 页缩略图`)

    const want = Math.min(total > 0 ? total : MAXP, MAXP)
    for (let i = 1; i <= want; i++) {
      const clicked = await page.evaluate((pn) => {
        const target = [...document.querySelectorAll('span,div,button,li,p')]
          .find(e => e.childElementCount === 0 && (e.textContent || '').trim() === pn)
        if (!target) return false
        // 向上找可点击的祖先
        let el = target
        for (let k = 0; k < 4 && el; k++) {
          el = el.parentElement
          if (el && (el.tagName === 'BUTTON' || (el.onclick != null))) { el.click(); return true }
        }
        target.click(); return true
      }, `P${i}`)
      if (!clicked) { console.log(`  P${i} 缩略图未找到，停止`); break }
      await page.waitForTimeout(600)
      await page.screenshot({ path: path.join(OUT, `${safe}_p${String(i).padStart(2, '0')}.png`) })
    }
    console.log(`  → 已截图 ${want} 页`)
  }
  await browser.close()
  console.log(`DONE 输出目录: ${path.relative(process.cwd(), OUT)}`)
})().catch(e => { console.error('ERR', e); process.exit(2) })
