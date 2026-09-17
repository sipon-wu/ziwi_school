// 真机复验：H5 编辑器画布（iframe 内）逐页量「整页是否可见」，并给 P5 留截图（2026-09-15）
// 判据：适配后**渲染高度** ≤ 舞台可用高度（transform 不改布局，看 scrollHeight 会永远"溢出"）。
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const ID = process.argv[2] || '1dee5b02-273c-4d39-9351-6fefcf6de7e4'   // H5·科技
const log = (...a) => console.log(...a)

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1560, height: 940 } })
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 140)))
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  await p.goto(`${B}/courseware/h5/${ID}/edit`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(9000)

  const fr = p.frames().find(f => f !== p.mainFrame())
  if (!fr) { log('✘ 找不到 H5 iframe，测量无效'); process.exit(2) }
  const stage = await fr.evaluate(() => {
    const r = document.querySelector('.story-root').getBoundingClientRect()
    return { hd: document.body.classList.contains('hd'), w: Math.round(r.width), h: Math.round(r.height), ratio: +(r.width / r.height).toFixed(3) }
  })
  log(`舞台 ${stage.w}x${stage.h} 比例=${stage.ratio} hd=${stage.hd}`)

  const total = await fr.evaluate(() => document.querySelectorAll('.scene').length)
  const rows = []
  for (let i = 0; i < total; i++) {
    if (i > 0) { await fr.evaluate(() => document.querySelector('.nav-bar .next')?.click()); await p.waitForTimeout(800) }
    const m = await fr.evaluate(() => {
      const sc = document.querySelector('.scene.active')
      const inner = sc.querySelector('.scene-inner')
      const cs = getComputedStyle(sc)
      const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
      const avail = sc.clientHeight - pad
      const innerH = inner ? inner.getBoundingClientRect().height : 0
      return {
        title: (sc.querySelector('.scene-title') || {}).innerText || '(无标题)',
        avail: Math.round(avail), innerH: Math.round(innerH),
        fit: sc.classList.contains('fit'), fits: innerH <= avail + 2,
      }
    })
    rows.push(m)
    log(`P${String(i + 1).padEnd(2)} ${m.title.slice(0, 14).padEnd(16)} 可用=${m.avail} 渲染高=${m.innerH} ${m.fit ? '已适配' : '未超'} 整页可见=${m.fits}`)
    if (i === 4) await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/h5_p5_fit.png' })
  }
  const bad = rows.filter(r => !r.fits)
  log(`\n整页不可见（仍被截/需滚动）的页 = ${bad.length}/${rows.length}${bad.length ? ' → ' + bad.map(r => r.title.slice(0, 10)).join(' / ') : ''}`)
  log('结论：' + (bad.length === 0 ? '通过 ✔' : '不通过 ✘'))
  await br.close()
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
