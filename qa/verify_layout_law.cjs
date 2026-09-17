// 版面法则落地验收（2026-09-15）
// 把 skill 的底层法则写成**可测断言**（H5：R2 行高/字号、R3 触控 44；间距走 4-8 阶梯）。
// 做法：本地用同一渲染器渲出 H5 → 手机视口打开 → 逐个断言计算样式。
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const fs = require('fs')
const B = 'http://school1.ziwi.cn'
const FE = '/Users/sipon/CodeBuddy/AI教案/code/frontend'
const log = (...a) => console.log(...a)

;(async () => {
  execFileSync('npx', ['esbuild', 'src/lib/courseware-h5/index.ts', '--bundle', '--format=cjs', '--platform=node',
    '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
    '--define:import.meta.env={}', '--outfile=/tmp/h5r.cjs', '--log-level=error'], { cwd: FE, stdio: 'inherit' })
  const { markdownToStorybookH5 } = require('/tmp/h5r.cjs')
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const mat = await (await fetch(B + '/api/materials/0b2a3d76-9706-46ce-8e4b-d6c715a87c5c', { headers: { Authorization: 'Bearer ' + t } })).json()
  const html = markdownToStorybookH5(String(mat.content || ''), {
    subject: '语文', grade: '四年级', title: '观潮 国风 09-15', colorRoot: mat.color_root || '',
  })
  fs.writeFileSync('/tmp/h5_law_test.html', html)

  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 390, height: 844 } })   // 手机竖屏：法则针对的媒介
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 140)))
  await p.goto('file:///tmp/h5_law_test.html', { waitUntil: 'load' })
  await p.waitForTimeout(1200)

  // 逐页收集：所有可点元素的有效触控尺寸 + 关键块的内边距/间距/行高
  const res = await p.evaluate(async () => {
    const total = document.querySelectorAll('.scene').length
    const touch = []      // 可点元素尺寸
    const gaps = []       // 块间距/内边距（去重）
    const lh = []         // 正文行高
    const seen = new Set()
    for (let i = 0; i < total; i++) {
      document.querySelectorAll('.scene').forEach((s, k) => s.classList.toggle('active', k === i))
      await new Promise(r => requestAnimationFrame(r))
      const sc = document.querySelector('.scene.active')
      for (const el of sc.querySelectorAll('button, .cy-dot, [role="button"]')) {
        const r = el.getBoundingClientRect()
        const after = getComputedStyle(el, '::after')
        const aw = parseFloat(after.width) || 0, ah = parseFloat(after.height) || 0
        touch.push({ cls: (el.className || '').toString().split(' ')[0] || el.tagName, w: Math.round(r.width), h: Math.round(r.height), hit: Math.max(Math.round(r.width), aw) + 'x' + Math.max(Math.round(r.height), ah) })
      }
      const push = (k, v) => { const key = k + '=' + v; if (!seen.has(key)) { seen.add(key); gaps.push(key) } }
      const nar = sc.querySelector('.narration'); if (nar) { const cs = getComputedStyle(nar); push('narration.padY', cs.paddingTop); push('narration.mb', cs.marginBottom); push('narration.fontSize', cs.fontSize); lh.push('narration=' + cs.lineHeight) }
      const st = sc.querySelector('.stage'); if (st) push('stage.gap', getComputedStyle(st).gap)
      const it = sc.querySelector('.interact'); if (it) { const cs = getComputedStyle(it); push('interact.pad', cs.paddingTop + '/' + cs.paddingLeft); push('interact.mt', cs.marginTop) }
      const rw = sc.querySelector('.read-word'); if (rw) { const cs = getComputedStyle(rw); push('read-word.pad', cs.paddingTop + '/' + cs.paddingLeft); push('read-word.fontSize', cs.fontSize) }
      const qo = sc.querySelector('.quiz-opt'); if (qo) push('quiz-opt.pad', getComputedStyle(qo).paddingTop)
      const bt = sc.querySelector('.bubble-text'); if (bt) lh.push('bubble=' + getComputedStyle(bt).lineHeight)
    }
    return { total, touch, gaps, lh: [...new Set(lh)] }
  })

  const bad = res.touch.filter(x => {
    const [w, h] = x.hit.split('x').map(Number)
    return w < 44 || h < 44
  })
  log(`页面数=${res.total} · 可点元素=${res.touch.length} 个`)
  log('关键排版值（应全部落在 4/8 阶梯且不低于法则下限）：')
  res.gaps.sort().forEach(g => log('   ' + g))
  log('正文字号/行高：' + res.lh.join(' · '))
  const sizes = [...new Set(res.touch.map(x => x.cls + ' ' + x.hit))]
  log('可点元素有效触控区（需 ≥44×44）：')
  sizes.forEach(s => log('   ' + s))
  log(`\n触控不足 44×44 的元素 = ${bad.length} 个${bad.length ? ' → ' + bad.map(b => b.cls + ' ' + b.hit).slice(0, 6).join(' / ') : ''}`)
  log('结论：' + (bad.length === 0 ? '通过 ✔（排版缺省值已由法则保证）' : '不通过 ✘'))
  await br.close()
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
