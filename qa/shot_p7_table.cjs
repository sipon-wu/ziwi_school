// 看 P7 到底渲染成什么（2026-09-15）：打开 PPT·科技，切到「跨界桥接①」页，截图 + 数 DOM 里的 table
const { chromium } = require('playwright')
const fs = require('fs')
const B = 'http://school1.ziwi.cn'
const S = '/Users/sipon/CodeBuddy/AI教案/qa/_shots/p7_table'
fs.mkdirSync(S, { recursive: true })
const log = (...a) => console.log(...a)

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1560, height: 940 } })
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 200)))
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  await p.goto(B + '/courseware/ppt/d36d20bd-7b53-4da4-893f-56c215a329ba/edit', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(6000)

  // 缩略图栏里点「跨界桥接①」那一页
  const item = p.locator('button,div,li').filter({ hasText: '跨界桥接①' }).first()
  log('找到缩略图 = ' + (await item.count() > 0))
  if (await item.count()) { await item.click({ timeout: 8000 }).catch(e => log('  点击失败 ' + e.message.slice(0, 60))) }
  await p.waitForTimeout(2500)
  await p.screenshot({ path: S + '/p7_canvas.png' })

  // 数画布里的表格与单元格文本（自证：确认渲染出来的是什么）
  const dom = await p.evaluate(() => {
    const canv = [...document.querySelectorAll('div')]
      .map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(o => o.r.width > 500 && o.r.height > 300)
      .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0]?.e
    if (!canv) return { err: 'no canvas' }
    const tables = [...canv.querySelectorAll('table')]
    return {
      tables: tables.length,
      rows: tables.map(tb => [...tb.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('th,td')].map(c => (c.innerText || '').trim()))),
      svgs: canv.querySelectorAll('svg').length,
      text: (canv.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
    }
  })
  log('画布 DOM: ' + JSON.stringify(dom, null, 1).slice(0, 1400))
  await br.close()
  log('DONE')
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
