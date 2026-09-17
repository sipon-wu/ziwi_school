// 移动端 H5 版式体检（2026-09-15）：把《琥珀 09-15》H5 在**手机视口**下量清楚
// 量的四件事（都带自证）：
//   ① 横向溢出：documentElement/任意元素的右边界是否超出视口
//   ② 旁白里的 markdown 残留（模型用 `- >` 当装饰，解析后留下 `>`）
//   ③ 点读词卡被 flex 压成"一字一行"（.read-word 宽度 vs 内容）
//   ④ 装饰元素是否压住标题
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const fs = require('fs')
const B = 'http://school1.ziwi.cn'
const FE = '/Users/sipon/CodeBuddy/AI教案/code/frontend'
const ID = process.argv[2] || '28a9baaa-8566-4895-8752-f880b199b5b3'   // H5·琥珀
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
  fs.writeFileSync('/tmp/h5_mobile.html', html)

  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 140)))
  await p.goto('file:///tmp/h5_mobile.html', { waitUntil: 'load' })
  await p.waitForTimeout(1000)

  const total = await p.evaluate(() => document.querySelectorAll('.scene').length)
  log(`场景数=${total} · 视口 390×844`)
  for (let i = 0; i < total; i++) {
    if (i > 0) { await p.evaluate(() => document.querySelector('.nav-bar .next')?.click()); await p.waitForTimeout(500) }
    const d = await p.evaluate(() => {
      const sc = document.querySelector('.scene.active')
      const vw = window.innerWidth
      // ① 横向溢出：找右边界超出视口的元素（排除视口外的装饰）
      const wide = [...sc.querySelectorAll('*')].map(e => ({ e, r: e.getBoundingClientRect() }))
        .filter(o => o.r.right > vw + 1 && o.r.width > 8 && getComputedStyle(o.e).position !== 'fixed')
        .slice(0, 3).map(o => (o.e.className || o.e.tagName) + ' right=' + Math.round(o.r.right))
      const nar = sc.querySelector('.narration')
      const words = [...sc.querySelectorAll('.read-word')].map(e => Math.round(e.getBoundingClientRect().width))
      return {
        title: (sc.querySelector('.scene-title') || {}).innerText || '(无标题)',
        docScrollW: document.documentElement.scrollWidth,
        wide,
        narText: nar ? (nar.innerText || '').replace(/\s+/g, ' ').slice(0, 60) : '',
        narHasGt: nar ? /(^|\s)>|>\s/.test(nar.innerText || '') : false,
        narW: nar ? Math.round(nar.getBoundingClientRect().width) : 0,
        words,
        deco: [...sc.querySelectorAll('.deco')].length,
      }
    })
    log(`P${String(i + 1).padEnd(2)} ${String(d.title).slice(0, 12).padEnd(14)} 横向溢出元素=${d.wide.length}${d.wide.length ? ' [' + d.wide.join(' | ') + ']' : ''} 旁白宽=${d.narW} 含">"=${d.narHasGt} 词卡宽=${JSON.stringify(d.words)}`)
    if (d.narHasGt) log(`     旁白文本：${d.narText}`)
    if (i === 4) await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/h5_mobile_p5.png' })
  }
  await br.close()
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
