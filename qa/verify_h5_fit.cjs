// H5「整页适配舞台高度」验收（2026-09-15）
// 做法：用**同一渲染器**把线上 H5 课件渲成本地 HTML，在"画布窗格尺寸"的视口里强开 HD，逐页翻并测量：
//   ① 内容高于可用高度时是否已加 .fit 并等比缩放  ② 缩放后是否仍有溢出（scrollHeight > clientHeight）
// 判据：全部页 need <= avail（缩放后），即"整页可见、无滚动"。
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const fs = require('fs')
const B = 'http://school1.ziwi.cn'
const FE = '/Users/sipon/CodeBuddy/AI教案/code/frontend'
const ID = process.argv[2] || '1dee5b02-273c-4d39-9351-6fefcf6de7e4'   // H5·科技
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
  const mat = await (await fetch(`${B}/api/materials/${ID}`, { headers: { Authorization: 'Bearer ' + t } })).json()
  const html = markdownToStorybookH5(String(mat.content || ''), {
    subject: '语文', grade: '四年级', title: (mat.name || '').replace(/_课件$/, ''), colorRoot: mat.color_root || '',
  })
  fs.writeFileSync('/tmp/h5_fit_test.html', html)
  log(`已渲染（${html.length} 字节）· 含 scene-inner=${/scene-inner/.test(html)} · 含 fitToStage=${/fitToStage/.test(html)}`)

  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 900, height: 520 } })
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 140)))
  await p.goto('file:///tmp/h5_fit_test.html?hd=1', { waitUntil: 'load' })
  await p.waitForTimeout(1000)
  const st0 = await p.evaluate(() => {
    const r = document.querySelector('.story-root').getBoundingClientRect()
    return { hd: document.body.classList.contains('hd'), stage: Math.round(r.width) + 'x' + Math.round(r.height), ratio: +(r.width / r.height).toFixed(3) }
  })
  log(`舞台 ${st0.stage} 比例=${st0.ratio} hd=${st0.hd}`)

  const total = await p.evaluate(() => document.querySelectorAll('.scene').length)
  const rows = []
  for (let i = 0; i < total; i++) {
    if (i > 0) { await p.evaluate(() => document.querySelector('.nav-bar .next')?.click()); await p.waitForTimeout(700) }
    const m = await p.evaluate(() => {
      const sc = document.querySelector('.scene.active')
      const inner = sc.querySelector('.scene-inner')
      const cs = getComputedStyle(sc)
      const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
      const avail = sc.clientHeight - pad
      // 适配后**渲染高度**（transform 后 rect 已含缩放）——判"整页是否可见"就该看这个，而不是 scrollHeight
      // （transform 不改布局，scrollHeight 恒为未缩放高度，看那个会永远"溢出"）
      const innerH = inner ? inner.getBoundingClientRect().height : 0
      return {
        title: (sc.querySelector('.scene-title') || {}).innerText || '(无标题)',
        avail: Math.round(avail), innerH: Math.round(innerH),
        fit: sc.classList.contains('fit'),
        fits: innerH <= avail + 2,
      }
    })
    rows.push(m)
    log(`P${String(i + 1).padEnd(2)} ${m.title.slice(0, 12).padEnd(14)} 可用=${m.avail} 内容渲染高=${m.innerH} ${m.fit ? '已等比适配' : '本就不超'} 整页可见=${m.fits}`)
  }
  const bad = rows.filter(r => !r.fits)
  log(`\n仍溢出的页 = ${bad.length}/${rows.length}${bad.length ? ' → ' + bad.map(r => r.title.slice(0, 10)).join(' / ') : ''}`)
  log('结论：' + (bad.length === 0 ? '通过 ✔（整页可见、无滚动）' : '不通过 ✘'))
  await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/h5_fit_pane.png' })
  await br.close()
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
