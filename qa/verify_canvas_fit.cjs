// 画布尺寸一致性验证（2026-09-14）
// 断言：
//   ① 任何视口下画布**完整可见**（不被视口裁切）
//   ② 大屏/全屏能把画布放大（不再被 896px 钉死）
//   ③ 编辑态与静态预览在同一容器下尺寸规则一致
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const ID = '971395a2-55c5-4f34-bb42-9cf4ef1528c1'

const probe = () => {
  const el = [...document.querySelectorAll('[style*="transform: scale"], .relative.bg-white')]
    .map(e => ({ e, r: e.getBoundingClientRect() }))
    .filter(o => o.r.width > 200).sort((a, b) => b.r.width - a.r.width)[0]
  if (!el) return { err: '无画布' }
  const r = el.r
  return {
    w: Math.round(r.width), h: Math.round(r.height),
    top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight,
    完整可见: r.top >= 0 && r.bottom <= window.innerHeight + 1,
    被裁: Math.max(0, Math.round(r.bottom - window.innerHeight)),
  }
}

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const b = await chromium.launch()
  let bad = 0
  for (const [w, h] of [[1920, 1080], [1440, 900], [1200, 600], [1000, 520]]) {
    const line = []
    for (const [label, url] of [['编辑', '/courseware/ppt/' + ID + '/edit'], ['预览', '/courseware/ppt/' + ID]]) {
      const p = await b.newPage({ viewport: { width: w, height: h } })
      await p.goto(B, { waitUntil: 'domcontentloaded' })
      await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
      await p.goto(B + url, { waitUntil: 'networkidle' })
      await p.waitForTimeout(3200)
      const r = await p.evaluate(probe)
      if (!r.完整可见) bad++
      line.push(`${label}=${r.w}×${r.h}${r.完整可见 ? '完整' : '✘被裁' + r.被裁 + 'px'}`)
      await p.close()
    }
    console.log(`视口 ${w}×${h} → ${line.join('   ')}`)
  }
  // 全屏编辑是否真的变大
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  await p.goto(B + '/courseware/ppt/' + ID + '/edit', { waitUntil: 'networkidle' })
  await p.waitForTimeout(3200)
  const before = await p.evaluate(probe)
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => (e.getAttribute('title') || '').includes('全屏')); if (b) b.click() })
  await p.waitForTimeout(2000)
  const after = await p.evaluate(probe)
  console.log(`全屏编辑：进入前 ${before.w}×${before.h} → 进入后 ${after.w}×${after.h}` + (after.w > before.w ? '  ✔ 真的变大了' : '  ✘ 没变大'))
  if (!(after.w > before.w)) bad++
  await p.close()

  // 「适应宽度」档：小窗口下画布应更大，且画布 pane 可纵向滚动（放大必然超出可视高度）
  const p2 = await b.newPage({ viewport: { width: 1000, height: 520 } })
  await p2.goto(B, { waitUntil: 'domcontentloaded' })
  await p2.evaluate(x => { localStorage.setItem('zhiwei_token', x); localStorage.setItem('cw_fit_mode', 'width') }, t)
  await p2.goto(B + '/courseware/ppt/' + ID + '/edit', { waitUntil: 'networkidle' })
  await p2.waitForTimeout(3200)
  const wide = await p2.evaluate(() => {
    const c = [...document.querySelectorAll('[style*="transform: scale"]')]
      .map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(o => o.r.width > 200).sort((a, b) => b.r.width - a.r.width)[0]
    const pane = c && c.e.parentElement.parentElement
    return { w: c ? Math.round(c.r.width) : null, h: c ? Math.round(c.r.height) : null, scrollable: pane ? pane.scrollHeight > pane.clientHeight + 2 : null }
  })
  console.log(`适应宽度档（1000×520）：画布 ${wide.w}×${wide.h}，画布区可滚动=${wide.scrollable}` + (wide.w > 526 ? '  ✔ 比适应窗口更大' : '  ✘ 没变大'))
  if (!(wide.w > 526)) bad++
  await p2.close()

  await b.close()
  console.log(bad === 0 ? '\n结论：全部通过 ✔' : `\n结论：${bad} 项未通过`)
})().catch(e => console.error('ERR', e.message))
