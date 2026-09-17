// 两条目测件的**几何/状态证据**（2026-09-15）
//   ① PPT·科技 P7：表格单元格的坐标（证明"列对齐"，不靠肉眼读截图）
//   ② H5 画布：编辑器 iframe 内 body.hd 是否开启、舞台是否 16:9（证明"画布=课堂投屏比例"）
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const log = (...a) => console.log(...a)

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1600, height: 940 }, deviceScaleFactor: 2 })
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 160)))
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)

  // ① P7 表格
  await p.goto(B + '/courseware/ppt/d36d20bd-7b53-4da4-893f-56c215a329ba/edit', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(7000)
  await p.locator('div.w-44.shrink-0.overflow-y-auto > div').nth(6).click()
  await p.waitForTimeout(2500)
  const tb = await p.evaluate(() => {
    const t0 = [...document.querySelectorAll('table')].map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(o => o.r.width > 250).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0]
    if (!t0) return { err: 'no canvas table' }
    const trs = [...t0.el.querySelectorAll('tr')]
    const grid = trs.map(tr => [...tr.querySelectorAll('th,td')].map(c => {
      const r = c.getBoundingClientRect()
      return { t: (c.innerText || '').trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }
    }))
    return { box: Math.round(t0.r.width) + 'x' + Math.round(t0.r.height), grid }
  })
  log('① P7 表格 ' + tb.box)
  ;(tb.grid || []).forEach((row, i) => log('   行' + i + ': ' + row.map(c => `[${c.t || '空'}] x=${c.x} w=${c.w}`).join('  ')))
  const aligned = (tb.grid || []).length > 1 && tb.grid[1][1].x > tb.grid[1][0].x && tb.grid[1][2].x > tb.grid[1][1].x
  log('   列是否从左到右递增（对齐）= ' + aligned)
  await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/p7_table/p7_hidpi.png' })

  // ② H5 画布
  await p.goto(B + '/courseware/h5/0b2a3d76-9706-46ce-8e4b-d6c715a87c5c/edit', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(9000)
  const fr = p.frames().find(f => /srcdoc/.test(f.url()) || f !== p.mainFrame())
  let st = { err: '未找到 H5 iframe' }
  if (fr) {
    st = await fr.evaluate(() => {
      const r = document.querySelector('.story-root')?.getBoundingClientRect()
      return {
        hd: document.body.classList.contains('hd'),
        stage: r ? Math.round(r.width) + 'x' + Math.round(r.height) : 'n/a',
        ratio: r ? +(r.width / r.height).toFixed(3) : 0,
        docH: document.documentElement.scrollHeight, win: window.innerHeight,
        title: (document.querySelector('.h-title') || {}).innerText || '',
        cover: ((document.querySelector('.scene.active') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 50),
      }
    })
  }
  log('② H5 画布: ' + JSON.stringify(st))
  await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/h5_canvas_hd.png' })
  await br.close()
  log('DONE')
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
