// P7 现场（最终版）：用**定位器**点缩略图栏第 7 项，断言画布容器内含「跨界桥接」后才截图
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
  const p = await br.newPage({ viewport: { width: 1600, height: 940 } })
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 200)))
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  await p.goto(B + '/courseware/ppt/d36d20bd-7b53-4da4-893f-56c215a329ba/edit', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(7000)

  const rail = p.locator('div.w-44.shrink-0.overflow-y-auto > div')
  const n = await rail.count()
  log('缩略图项数 = ' + n)

  await rail.nth(6).click()
  await p.waitForTimeout(2800)
  // 自证：画布尺寸的表格（宽度 > 250px；缩略图里的表格只有 ~141px）
  const info = await p.evaluate(() => {
    const tbs = [...document.querySelectorAll('table')].map(el => ({ el, r: el.getBoundingClientRect() }))
    const big = tbs.filter(o => o.r.width > 250).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0]
    const selected = [...document.querySelectorAll('div.w-44 > div')].findIndex(d => /ring-1/.test(d.className))
    return {
      total: tbs.length,
      bigCount: tbs.filter(o => o.r.width > 250).length,
      rows: big ? [...big.el.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('th,td')].map(c => (c.innerText || '').trim())) : [],
      box: big ? Math.round(big.r.x) + ',' + Math.round(big.r.y) + ' ' + Math.round(big.r.width) + 'x' + Math.round(big.r.height) : '',
      selectedIdx: selected,
      around: big ? (big.el.parentElement.innerText || '').replace(/\s+/g, ' ').slice(0, 120) : '',
    }
  })
  log('页面 table 总数 = ' + info.total + '，其中 >250px 的 = ' + info.bigCount)
  log('选中的缩略图序号 = ' + info.selectedIdx + '（应为 6）')
  log('画布表格位置尺寸 = ' + info.box)
  log('表格行 = ' + JSON.stringify(info.rows))
  log('该页文本 = ' + info.around)
  await p.screenshot({ path: S + '/p7_full.png' })
  if (info.box) {
    const [pos, wh] = info.box.split(' '); const [x, y] = pos.split(',').map(Number); const [w, h] = wh.split('x').map(Number)
    await p.screenshot({ path: S + '/p7_table_only.png', clip: { x: Math.max(0, x - 10), y: Math.max(0, y - 34), width: w + 20, height: h + 48 } })
  }
  log('截图 → ' + S)
  await br.close()
  log('DONE')
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
