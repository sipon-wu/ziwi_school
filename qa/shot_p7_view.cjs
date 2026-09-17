// P7 现场（第三版：走**放映态** /courseware/ppt/:id，翻页到标题含「跨界桥接」才截图）
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
  const p = await br.newPage({ viewport: { width: 1600, height: 900 } })
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 200)))
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  await p.goto(B + '/courseware/ppt/d36d20bd-7b53-4da4-893f-56c215a329ba', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(6000)
  const btns = await p.evaluate(() => [...new Set([...document.querySelectorAll('button')].map(e => (e.innerText || '').trim()).filter(Boolean))].slice(0, 24))
  log('放映页按钮: ' + btns.join(' | '))
  // 翻页直到出现 P7 标题（最多 14 次）
  let ok = false
  for (let i = 0; i < 14; i++) {
    const tx = await p.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '))
    if (/跨界桥接①|跨界桥接1/.test(tx)) { ok = true; break }
    const nx = p.locator('button:has-text("下一页"), button:has-text("下页"), [aria-label*="下一"]').first()
    if (!(await nx.count())) { log('未见"下一页"按钮'); break }
    await nx.click().catch(() => {})
    await p.waitForTimeout(1200)
  }
  log('翻到 P7（含"跨界桥接"）= ' + ok)
  const info = await p.evaluate(() => {
    const tables = [...document.querySelectorAll('table')]
    const big = tables.map(tb => ({ tb, r: tb.getBoundingClientRect() })).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0]
    return {
      tables: tables.length,
      box: big ? Math.round(big.r.x) + ',' + Math.round(big.r.y) + ' ' + Math.round(big.r.width) + 'x' + Math.round(big.r.height) : '',
      rows: big ? [...big.tb.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('th,td')].map(c => (c.innerText || '').trim())) : [],
      body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(-260),
    }
  })
  log('最大的 table: ' + info.tables + ' 个，面积 ' + info.box)
  log('行内容: ' + JSON.stringify(info.rows))
  log('页面尾部文本: ' + info.body)
  await p.screenshot({ path: S + '/view_p7.png' })
  await br.close()
  log('DONE')
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
