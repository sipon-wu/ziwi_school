// P7 表格现场（第二版：**自证导航**后才截图）2026-09-15
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

  // ① 找缩略图栏：一列很窄、内部有多个等宽按钮的容器
  const rail = await p.evaluate(() => {
    const cands = [...document.querySelectorAll('div')].map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(o => o.r.width > 80 && o.r.width < 260 && o.r.height > 300 && o.r.x < 500)
      .sort((a, b) => b.r.height - a.r.height)
    const el = cands[0]?.e
    if (!el) return { err: 'no rail' }
    const items = [...el.querySelectorAll('button,div[role=button],[class]')].filter(x => {
      const r = x.getBoundingClientRect(); return r.width > 80 && r.width < 220 && r.height > 60 && r.height < 140
    })
    return { count: items.length, box: cands[0].r.x + ',' + cands[0].r.y, first: items.slice(0, 3).map(i => (i.innerText || '').replace(/\s+/g, ' ').slice(0, 16)) }
  })
  log('缩略图栏: ' + JSON.stringify(rail))

  // ② 点第 7 张（按 rail 内等宽项序号）
  const clicked = await p.evaluate(() => {
    const cands = [...document.querySelectorAll('div')].map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(o => o.r.width > 80 && o.r.width < 260 && o.r.height > 300 && o.r.x < 500)
      .sort((a, b) => b.r.height - a.r.height)
    const el = cands[0]?.e
    if (!el) return false
    const items = [...el.querySelectorAll('button,div[role=button]')].filter(x => {
      const r = x.getBoundingClientRect(); return r.width > 80 && r.width < 220 && r.height > 60 && r.height < 140
    })
    const t = items[6]
    if (!t) return false
    t.scrollIntoView({ block: 'center' })
    t.click()
    return true
  })
  log('点第 7 张 = ' + clicked)
  await p.waitForTimeout(2500)

  // ③ 自证：主画布（最大且居中的白色区）里的标题必须包含「跨界桥接」
  const st = await p.evaluate(() => {
    const canv = [...document.querySelectorAll('div')].map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(o => o.r.width > 600 && o.r.height > 380 && o.r.x > 400 && o.r.y > 60 && o.r.y < 200)
      .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0]
    if (!canv) return { err: 'no canvas' }
    const el = canv.e
    const tables = [...el.querySelectorAll('table')]
    return {
      box: Math.round(canv.r.x) + ',' + Math.round(canv.r.y) + ' ' + Math.round(canv.r.width) + 'x' + Math.round(canv.r.height),
      text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
      tables: tables.length,
      rows: tables[0] ? [...tables[0].querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('th,td')].map(c => (c.innerText || '').trim())) : [],
      tableBox: tables[0] ? (r => Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height))(tables[0].getBoundingClientRect()) : '',
    }
  })
  log('画布: ' + JSON.stringify(st, null, 1).slice(0, 900))
  const ok = /跨界桥接/.test(st.text || '')
  log('导航自证（画布含"跨界桥接"）= ' + ok)
  if (ok) {
    const box = (st.box || '0,0 0x0').split(' ')[0].split(',').map(Number)
    const wh = (st.box || '0,0 0x0').split(' ')[1].split('x').map(Number)
    await p.screenshot({ path: S + '/p7_canvas_only.png', clip: { x: box[0], y: box[1], width: wh[0], height: wh[1] } })
    log('已截画布 → ' + S + '/p7_canvas_only.png')
  }
  await p.screenshot({ path: S + '/p7_full.png' })
  await br.close()
  log('DONE')
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
