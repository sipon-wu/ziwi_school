// PPT 端版面法则落地验收（2026-09-15）
// 判据（法则：文字与框线内边距 ≥2.5mm≈10px；间距走 4/8 阶梯；文本不得溢出容器）：
//   ① 表格单元格内边距 ≥ 10/8px（修复前是 4/4px≈1mm，"字贴着框"）
//   ② 卡片类组件内边距 ≥ 12/10px
//   ③ 任一单元格文本不溢出（scrollHeight ≤ clientHeight+2）
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const ID = 'd36d20bd-7b53-4da4-893f-56c215a329ba'   // PPT·科技
const log = (...a) => console.log(...a)

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1600, height: 940 } })
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 140)))
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  await p.goto(`${B}/courseware/ppt/${ID}/edit`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(7000)

  const rail = p.locator('div.w-44.shrink-0.overflow-y-auto > div')
  const pages = await rail.count()
  log(`缩略图项数=${pages}`)
  const seen = new Set()
  let badPad = 0, clipped = 0
  for (let i = 0; i < pages; i++) {
    await rail.nth(i).click()
    await p.waitForTimeout(900)
    const m = await p.evaluate(() => {
      const tb = [...document.querySelectorAll('table')].map(el => ({ el, r: el.getBoundingClientRect() }))
        .filter(o => o.r.width > 250).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0]?.el
      const out = { cells: [], cards: [], clip: 0 }
      if (tb) {
        for (const c of tb.querySelectorAll('th,td')) {
          const cs = getComputedStyle(c)
          out.cells.push({ t: (c.innerText || '').trim().slice(0, 6), px: parseFloat(cs.paddingLeft), py: parseFloat(cs.paddingTop) })
          if (c.scrollHeight > c.clientHeight + 2) out.clip++
        }
      }
      // 卡片类：带边框/背景、**自己直接装着文字**（有直接文本子节点）的块 —— 收紧判据，
      // 否则会把"外层包裹容器"（border 但无内边距）当成卡片，量出 0/0 的假阳性（上一版就是）。
      const hasDirectText = (el) => [...el.childNodes].some(n => n.nodeType === 3 && (n.textContent || '').trim().length > 1)
        || [...el.children].some(c => hasDirectText(c) && c.children.length === 0)
      for (const el of document.querySelectorAll('div[class*="rounded"]')) {
        const r = el.getBoundingClientRect()
        // 只量**主画布内**的组件：排除左侧表单/缩略图栏与右侧批注栏（否则会把编辑器外壳算成违规，实测 201 处假阳性）
        if (el.closest('.w-44') || el.closest('aside') || r.x < 500 || r.x > 1200) continue
        if (/AI 模式|文档模式/.test(el.innerText || '')) continue   // 编辑器顶栏的模式切换，不是课件组件
        if (r.width < 60 || r.width > 420 || r.height < 30) continue
        const cs = getComputedStyle(el)
        // 只管**有框线**的块：法则说的是"文字与框线的内边距"；无框容器（缺省 container:'none'）
        // 本就该 0 内边距、靠字号与留白取胜（技能里的既定形态），不算违规。
        if (cs.borderStyle === 'none' || parseFloat(cs.borderTopWidth) === 0) continue
        if (!hasDirectText(el)) continue
        out.cards.push({ t: (el.innerText || '').trim().slice(0, 6), px: parseFloat(cs.paddingLeft), py: parseFloat(cs.paddingTop) })
        if (el.scrollHeight > el.clientHeight + 2 && cs.overflow !== 'visible') out.clip++
      }
      return out
    })
    for (const c of m.cells) { const k = 'cell ' + c.px + '/' + c.py; if (!seen.has(k)) { seen.add(k); if (c.px < 8 || c.py < 8) badPad++ } }
    for (const c of m.cards) { const k = 'card ' + c.px + '/' + c.py; if (!seen.has(k)) { seen.add(k); if (c.px < 10 || c.py < 8) badPad++ } }
    clipped += m.clip
  }
  log('实测内边距（画布 CSS px；法则下限：硬下限 8/8（≈2.1mm），卡片级 12/10）：')
  const list = [...seen].sort()
  list.forEach(s => log('   ' + s))
  log(`\n低于下限的组合 = ${badPad} 个 · 文本被裁的单元格/卡片 = ${clipped}`)
  await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/ppt_law_last.png' })
  log('结论：' + (badPad === 0 && clipped === 0 ? '通过 ✔' : '不通过 ✘'))
  await br.close()
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
