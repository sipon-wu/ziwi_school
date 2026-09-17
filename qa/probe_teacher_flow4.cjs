// 探针④（2026-09-15）：教师真实顺序应是"先选单元 → 图谱出节点 → 选知识点"。
// 验证：选「第一单元」后 ① 图谱是否出节点 ② 搜索'观潮'是否有结果 ③ 点击能否选中（chip 变化）
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
  await p.waitForTimeout(4000)

  const chips = () => p.evaluate(() => [...document.querySelectorAll('*')]
    .filter(e => /^\d+\/\d+$/.test((e.textContent || '').trim())).map(e => e.textContent.trim()))

  // 选单元（第 1 个 select = 单元）
  const unitSel = p.locator('select').first()
  const unitOpts = await unitSel.locator('option').allInnerTexts()
  log('单元选项: ' + unitOpts.join('/'))
  await unitSel.selectOption({ label: '第一单元' })
  log('已选第一单元，等待图谱…')
  await p.waitForTimeout(6000)

  // 图谱内容（SVG 文本 + 空态文案）
  const graph = await p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const texts = [...document.querySelectorAll('svg text')].filter(vis).map(e => (e.textContent || '').trim()).filter(Boolean)
    const empty = /暂无知识点|加载中/.test(document.body.innerText || '')
    const emptyMsg = (document.body.innerText || '').match(/当前筛选条件下暂无知识点|加载中/)?.[0] || ''
    return { svgTexts: [...new Set(texts)].slice(0, 24), empty, emptyMsg }
  })
  log('图谱 SVG 文本(' + graph.svgTexts.length + '): ' + graph.svgTexts.join(' | '))
  log('空态: ' + graph.empty + ' ' + graph.emptyMsg)
  log('chip(选单元后): ' + (await chips()).join(' '))

  // 搜索
  const search = p.locator('input[placeholder="搜索知识点"]').first()
  await search.fill('观潮')
  await p.waitForTimeout(2500)
  const res = await p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const cands = [...document.querySelectorAll('svg text,div,li,span,button')].filter(vis)
      .filter(e => (e.textContent || '').trim().includes('观潮'))
      .map(e => ({ tag: e.tagName.toLowerCase(), n: e.children.length, t: (e.textContent || '').trim().slice(0, 24), cls: String(e.getAttribute('class') || e.className || '').slice(0, 40) }))
    return cands.slice(0, 10)
  })
  log('搜索"观潮"命中: ' + JSON.stringify(res, null, 0))
  if (res.length) {
    const before = await chips()
    try { await p.locator(`text=${'观潮'}`).first().click({ timeout: 5000 }) } catch (e) { log('点击 text=观潮 失败: ' + e.message.slice(0, 60)) }
    await p.waitForTimeout(2500)
    log('点击后 chip: ' + before.join(' ') + ' → ' + (await chips()).join(' '))
  }
  await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/probe4_unit.png' })
  await b.close()
  log('\nPROBE4_DONE')
})().catch(e => { console.error('PROBE4_FAIL:', e.message); process.exit(2) })
