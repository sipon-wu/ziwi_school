// H5 HD 舞台验证（2026-09-15）：用**同一套渲染器**（esbuild 打包 lib/courseware-h5）把线上 H5 课件
// 重新渲染成 HTML，在 1920×1080（电视/白板）/ 1280×720 / 手机 三种视口下量：
//   ① body.hd 是否开启  ② 舞台盒子的宽高比是否 16:9 且铺满可容区  ③ 页面是否还随内容撑高
// 用法：node verify_h5_stage.cjs（自动打包 renderer）
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const B = 'http://school1.ziwi.cn'
const FE = '/Users/sipon/CodeBuddy/AI教案/code/frontend'
const log = (...a) => console.log(...a)

;(async () => {
  // ① 打包渲染器
  execFileSync('npx', ['esbuild', 'src/lib/courseware-h5/index.ts', '--bundle', '--format=cjs', '--platform=node',
    '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
    '--define:import.meta.env={}', '--outfile=/tmp/h5r.cjs', '--log-level=error'],
    { cwd: FE, stdio: 'inherit' })
  const { markdownToStorybookH5 } = require('/tmp/h5r.cjs')

  // ② 取线上 H5 课件（真实内容 + 配色）
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const mat = await (await fetch(B + '/api/materials/0b2a3d76-9706-46ce-8e4b-d6c715a87c5c', { headers: { Authorization: 'Bearer ' + t } })).json()
  const md = String(mat.content || '')
  // 标题按**应用现在的传法**（课题名，不带素材后缀 `_课件`）
  const html = markdownToStorybookH5(md, { title: '观潮 科技 09-15', subject: '语文', grade: '四年级', colorRoot: mat.color_root || '' })
  const f = '/tmp/h5_stage_test.html'
  fs.writeFileSync(f, html)
  log('已渲染 H5（' + html.length + ' 字节）→ ' + f)
  log('含 HD 运行时 = ' + /cw-h5-hd/.test(html) + ' · 含 body.hd 样式 = ' + /body\.hd\{/.test(html))

  // ③ 三种视口量比例
  const br = await chromium.launch()
  const cases = [
    ['电视/白板 1920×1080', 1920, 1080, ''],
    ['白板 1280×720', 1280, 720, ''],
    ['笔电 1440×900', 1440, 900, ''],
    ['手机 390×844', 390, 844, ''],
    ['强制关 ?hd=0（1920×1080）', 1920, 1080, '?hd=0'],
    ['编辑器画布窗格 700×500（?hd=1）', 700, 500, '?hd=1'],
  ]
  for (const [label, w, h, q] of cases) {
    const p = await br.newPage({ viewport: { width: w, height: h } })
    const errs = []
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
    await p.goto('file://' + f + q, { waitUntil: 'load' })
    await p.waitForTimeout(900)
    const st = await p.evaluate(() => {
      const r = document.querySelector('.story-root').getBoundingClientRect()
      return {
        hd: document.body.classList.contains('hd'),
        box: Math.round(r.width) + 'x' + Math.round(r.height),
        ratio: +(r.width / r.height).toFixed(3),
        scale: getComputedStyle(document.querySelector('.story-root')).transform,
        docH: document.documentElement.scrollHeight,
        winH: window.innerHeight, winW: window.innerWidth,
        head: (document.querySelector('.h-title') || {}).innerText || '',
        cover: ((document.querySelector('.scene.active') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 60),
      }
    })
    const [bw,bh] = st.box.split("x").map(Number);
    const fills = st.ratio > 1.7 && st.ratio < 1.85 && bw <= st.winW + 2 && bh <= st.winH + 2
    log(`${label.padEnd(24)} hd=${String(st.hd).padEnd(5)} 舞台=${st.box.padEnd(10)} 比例=${st.ratio} 页面高=${st.docH}/${st.winH} ${st.hd ? (fills ? '✔ 16:9 不撑高' : '⚠') : '（非 HD：保持自适应）'} 报错=${errs.length}`)
    if (label.startsWith('电视')) {
      log('   顶部标题 = ' + st.head)
      log('   封面文本 = ' + st.cover)
      log('   封面不含 "#" 与 "_课件" = ' + (!/#/.test(st.cover) && !/_课件/.test(st.head + st.cover)))
    }
    await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/h5_stage_' + w + 'x' + h + (q ? '_off' : '') + '.png' })
    await p.close()
  }
  await br.close()
  log('截图 → qa/_shots/h5_stage_*.png')
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
