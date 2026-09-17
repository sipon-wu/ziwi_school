// 探针③（2026-09-15）：知识图谱加载完后的"选点"交互 ——
//   ① 图谱何时算加载完（搜索能出结果）  ② 搜索结果/图谱节点的真实 DOM  ③ 点击能否选中  ④ 已选 chip 能否移除
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const log = (...a) => console.log(...a)

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1560, height: 940 } })
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  await p.goto(B + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })

  // ① 等图谱加载：轮询"搜索后是否出现候选"
  const search = p.locator('input[placeholder="搜索知识点"]').first()
  let loaded = false
  for (let i = 0; i < 12; i++) {
    await p.waitForTimeout(3000)
    await search.fill('观潮')
    await p.waitForTimeout(1500)
    const n = await p.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
      return [...document.querySelectorAll('svg text, div, li, span')]
        .filter(e => vis(e) && (e.textContent || '').trim() === '观潮').length
    })
    log(`第 ${i + 1} 次探测（${(i + 1) * 4.5}s）：'观潮' 元素数 = ${n}`)
    if (n > 0) { loaded = true; break }
  }
  log('图谱加载完成 = ' + loaded)
  if (loaded) {
    const dom = await p.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
      const hit = [...document.querySelectorAll('svg text, div, li, span')].filter(e => vis(e) && (e.textContent || '').trim() === '观潮')
      return hit.map(e => ({ tag: e.tagName.toLowerCase(), cls: String(e.getAttribute('class') || e.className || '').slice(0, 50), parentCls: String(e.parentElement?.getAttribute('class') || '').slice(0, 50), x: Math.round(e.getBoundingClientRect().x), y: Math.round(e.getBoundingClientRect().y) }))
    })
    log("'观潮' 元素: " + JSON.stringify(dom, null, 0))
    // ③ 点击第一个
    const box = await p.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
      const e = [...document.querySelectorAll('svg text, div, li, span')].find(x => vis(x) && (x.textContent || '').trim() === '观潮')
      if (!e) return null
      const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    const chipBefore = await p.evaluate(() => [...document.querySelectorAll('*')].filter(e => /^\d+\/\d+$/.test((e.textContent || '').trim())).map(e => e.textContent.trim()))
    if (box) { await p.mouse.click(box.x, box.y); await p.waitForTimeout(2500) }
    const chipAfter = await p.evaluate(() => [...document.querySelectorAll('*')].filter(e => /^\d+\/\d+$/.test((e.textContent || '').trim())).map(e => e.textContent.trim()))
    log('点击前 chip=' + chipBefore.join(' ') + ' → 点击后 chip=' + chipAfter.join(' '))
    // ④ 已选 chips 的 DOM（看能否移除）
    const chips = await p.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
      const hdr = [...document.querySelectorAll('*')].find(e => (e.textContent || '').trim().startsWith('知识点 *') && e.children.length < 4)
      const host = hdr ? hdr.closest('div') : null
      if (!host) return { err: 'no host' }
      return { html: host.innerHTML.slice(0, 700), texts: [...host.querySelectorAll('span,button,div')].filter(vis).map(e => (e.innerText || '').trim()).filter(Boolean).slice(0, 16) }
    })
    log('知识点区 DOM: ' + JSON.stringify(chips, null, 0))
  }
  await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/probe3_graph.png' })
  await b.close()
  log('\nPROBE3_DONE')
})().catch(e => { console.error('PROBE3_FAIL:', e.message); process.exit(2) })
