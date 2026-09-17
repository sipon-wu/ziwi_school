// 交付自证（2026-09-15）：把 4 份课件按教师入口打开，确认「不白屏 + 页数正常 + 零报错」，
// 并留截图供人工目测对照。判据必须自证：先确认导航到目标页、再断言渲染。
const { chromium } = require('playwright')
const fs = require('fs')
const B = 'http://school1.ziwi.cn'
const S = '/Users/sipon/CodeBuddy/AI教案/qa/_shots/deliver_0915'
fs.mkdirSync(S, { recursive: true })
const log = (...a) => console.log(...a)

const ITEMS = [
  ['PPT·国风', 'ppt', 'a658f5ce-d1a0-40c0-b32f-1fbbdfe6fdb2'],
  ['PPT·科技', 'ppt', 'd36d20bd-7b53-4da4-893f-56c215a329ba'],
  ['H5·国风', 'h5', '0b2a3d76-9706-46ce-8e4b-d6c715a87c5c'],
  ['H5·科技', 'h5', '1dee5b02-273c-4d39-9351-6fefcf6de7e4'],
]

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const br = await chromium.launch()
  const out = []
  for (const [label, fmt, id] of ITEMS) {
    const p = await br.newPage({ viewport: { width: 1560, height: 940 } })
    const errs = []
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)))
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
    const url = `${B}/courseware/${fmt}/${id}/edit`
    await p.goto(B, { waitUntil: 'domcontentloaded' })
    await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
    await p.goto(url, { waitUntil: 'domcontentloaded' })
    let ok = false, info = {}
    for (let i = 0; i < 12; i++) {
      await p.waitForTimeout(2000)
      info = await p.evaluate(() => {
        const body = document.body.innerText || ''
        const tabs = [...document.querySelectorAll('*')].map(e => (e.textContent || '').trim()).find(s => /^页面（\d+）$/.test(s)) || ''
        // PPT：画布节点数；H5：情景页容器数（两种入口都自证"确实渲染出来了"）
        const slides = document.querySelectorAll('[data-cw-slide], .cw-slide, section').length
        return { path: location.pathname, len: body.length, pages: Number(((tabs.match(/(\d+)/) || [])[1]) || 0), slides, head: body.replace(/\s+/g, ' ').slice(0, 70) }
      })
      if (info.path.includes(id) && info.len > 300 && info.slides > 0) { ok = true; break }
    }
    await p.screenshot({ path: `${S}/${label.replace('·', '_')}.png`, fullPage: false })
    log(`${label.padEnd(9)} 打开=${info.path.includes(id) ? 'OK' : '✗'} 文本=${info.len} 页数=${info.pages} 渲染节点=${info.slides} 报错=${errs.length} ${ok ? '✔' : '⚠'}`)
    if (errs.length) errs.slice(0, 2).forEach(e => log('     ' + e))
    out.push({ label, url, ok, pages: info.pages, errs: errs.length })
    await p.close()
  }
  console.log('\n截图目录: ' + S)
  console.log('结论: ' + (out.every(o => o.ok && o.errs === 0) ? '全部通过 ✔' : '有 ⚠，见上'))
  await br.close()
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
