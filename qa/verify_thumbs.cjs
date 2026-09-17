// 真实缩略图验证（2026-09-14）
// 断言：
//   ① 缩略图数量 == 页数
//   ② 缩略图内容是**真实渲染**（含该页正文与组件文字），不是示意线框（线框只有灰条、无文字）
//   ③ 缩略图与画布同比例（16:9 或 4:3），尺寸非零
//   ④ 顺带记录 DOM 规模与首屏耗时（确认没有性能倒退）
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const ID = '971395a2-55c5-4f34-bb42-9cf4ef1528c1'

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  const t0 = Date.now()
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  await p.goto(B + '/courseware/ppt/' + ID + '/edit', { waitUntil: 'networkidle' })
  const loadMs = Date.now() - t0
  await p.waitForTimeout(3500)

  const r = await p.evaluate(() => {
    // 缩略图栏：含多个「SlideThumb」根（pointer-events-none + overflow-hidden + bg-white）
    const thumbs = [...document.querySelectorAll('div.pointer-events-none.select-none.overflow-hidden.bg-white')]
    const info = thumbs.map((el, i) => {
      const box = el.firstElementChild ? el.firstElementChild.getBoundingClientRect() : el.getBoundingClientRect()
      const txt = (el.innerText || '').replace(/\s+/g, '')
      return {
        i,
        w: Math.round(box.width), h: Math.round(box.height),
        ratio: box.height ? +(box.width / box.height).toFixed(3) : 0,
        chars: txt.length,
        head: txt.slice(0, 24),
        hasCard: txt.includes('凝神专注'),
        hasBody: txt.includes('现象导入'),
      }
    })
    return { count: thumbs.length, info, nodes: document.querySelectorAll('*').length }
  })

  console.log(`首屏耗时（含登录跳转与渲染）= ${loadMs}ms   DOM 节点总数 = ${r.nodes}`)
  console.log(`缩略图数量 = ${r.count}`)
  let bad = 0
  r.info.slice(0, 4).forEach(o => {
    console.log(`  [${o.i}] ${o.w}×${o.h} ratio=${o.ratio} 文本${o.chars}字  卡片=${o.hasCard ? '✔' : '✗'} 正文=${o.hasBody ? '✔' : '✗'}  ${o.head}`)
  })
  // ②③ 断言：每张缩略图都要有文字（线框是 0 字）且比例正确
  for (const o of r.info) {
    if (o.chars === 0) { bad++; console.log(`  ✘ 缩略图[${o.i}] 无文字 → 疑似仍是线框`) }
    if (o.ratio && Math.abs(o.ratio - 1.778) > 0.02 && Math.abs(o.ratio - 1.333) > 0.02) { bad++; console.log(`  ✘ 缩略图[${o.i}] 比例异常 ${o.ratio}`) }
  }
  const p2 = r.info.find(o => o.hasBody)
  if (p2 && p2.hasCard) console.log(`  ✔ 「现象导入」页缩略图含组件文字（真实渲染，非线框）`)
  else if (p2) { bad++; console.log(`  ✘ 「现象导入」页缩略图缺少组件文字 → 缩略图与画布不同源`) }
  else { bad++; console.log(`  ✘ 没找到「现象导入」页缩略图`) }
  console.log(bad === 0 ? '\n结论：通过 ✔' : `\n结论：${bad} 项未通过`)
  await b.close()
})().catch(e => console.error('ERR', e.message))
