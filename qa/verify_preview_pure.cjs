/**
 * 放映态「一键纯净」守卫（2026-09-18 立）
 *
 * 背景：用户反馈 PPT 全屏播放（预览态）没有一键纯净版 —— 实测确认：
 *   `CwPreviewPane` 三栏硬编码常显（左 w-44 目录 + 中放映 + 右 w-[260px] 批注/扫码），
 *   左右都不可收起，更无"左右侧同时隐藏"。
 * 主流（飞书/Google Slides/腾讯文档，官方文档）：放映态零侧栏 + 控制条按需浮现且静止自动淡出 + Esc 退出、←→/空格 翻页。
 *
 * 用户拍板（2026-09-18）：
 *   ① 放映态**默认纯净**（进来自动隐藏左右侧，可一键退出还原）
 *   ② 纯净时**顶部标题栏也自动淡出**，鼠标移动即浮现
 *
 * 本脚本守：默认纯净 · 左右同时隐藏 · 标题栏随静止淡出/移动浮现 · 控制条翻页 · Esc 还原 · 无 pageerror。
 */
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')
const { execFileSync } = require('child_process')
const { ensurePptFixture, ensureH5Fixture, cleanupFixtures } = require('./lib/cwFixture.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const FE = process.env.FE || '/Users/sipon/CodeBuddy/AI教案/code/frontend'

let br
;(async () => {
  const lg = await (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }) })).json()
  must(!!lg.token, '登录成功（测试账号）')
  // 基线件随用随建（staging 存量课件已清空，守卫不再依赖既有数据）
  const fx = await ensurePptFixture()
  const ID = fx.id
  must(!!ID, 'PPT 基线件就绪', { id: ID, created: fx.created })

  br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto(B + '/login', { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])
  // 查看态（bare :id）= 自动进入全屏预览/放映
  await p.goto(`${B}/courseware/ppt/${ID}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(11000)

  // 只在放映 pane 根节点内探测：整页别处（被遮住的编辑布局）也有 w-44 / w-[260px]，全域探测会假命中
  // 只在放映 pane（外壳内那份）探测：查看态下页面同时挂着背景布局那份实例，全域探测会量错对象
  const snap = () => p.evaluate(() => {
    const shell = [...document.querySelectorAll('div')].find(d => String(d.className).includes('fixed inset-0 z-50'))
    const root = shell ? [...shell.querySelectorAll('div')].find(d => String(d.className).includes('overflow-hidden bg-[#FAFAFA]')) : null
    const inRoot = (cls) => root ? [...root.querySelectorAll('div')].some(d => String(d.className).includes(cls) && d.getBoundingClientRect().width > 0) : false
    const btn = (tx) => root ? [...root.querySelectorAll('button')].find(b => b.innerText.trim() === tx) : undefined
    const hud = root ? [...root.querySelectorAll('div')].find(d => /退出纯净/.test(d.innerText || '') && String(d.className).includes('rounded-full')) : null
    const bar = shell ? shell.querySelector(':scope > div') : null
    return {
      左目录: inRoot('w-44'),
      右面板: inRoot('w-[260px]'),
      进入纯净按钮: !!btn('⛶ 纯净放映'),
      退出纯净按钮: !!btn('退出纯净'),
      控制条可见: !!hud && hud.getBoundingClientRect().width > 0 && getComputedStyle(hud).opacity !== '0',
      页码: hud ? (hud.innerText.match(/(封面|\d+\/\d+)/) || [])[0] : null,
      深底: inRoot('bg-[#0F1115]'),
      标题栏透明度: bar ? getComputedStyle(bar).opacity : null,
      标题栏可点: bar ? getComputedStyle(bar).pointerEvents : null,
    }
  })

  const wake = async () => { await p.mouse.move(700, 500); await p.waitForTimeout(500) }

  /* ① 默认纯净：进入即左右侧同时隐藏 */
  await wake()
  const enter = await snap()
  must(enter.退出纯净按钮, '进入放映即为纯净态（按钮显示"退出纯净"）', { enter })
  must(!enter.左目录 && !enter.右面板, '默认纯净：左右侧**同时**隐藏（无需手动操作）', { 左: enter.左目录, 右: enter.右面板 })
  must(enter.深底, '纯净态画布居中于深底（投屏更干净）')
  must(enter.控制条可见, '纯净态浮出控制条（页码/退出纯净）', { 页码: enter.页码 })

  /* ② 标题栏：鼠标静止 3s 自动淡出；移动即浮现 */
  must(enter.标题栏透明度 === '1', '唤醒后标题栏可见（鼠标移动即浮现）', { op: enter.标题栏透明度 })
  await p.waitForTimeout(3600)
  const idle = await snap()
  must(!idle.控制条可见, '鼠标静止 3s 后悬浮控制条自动淡出', { 控制条可见: idle.控制条可见 })
  must(idle.标题栏透明度 === '0', '鼠标静止 3s 后标题栏自动淡出', { op: idle.标题栏透明度, bar: idle.标题栏可点 })
  must(idle.标题栏可点 === 'none', '淡出后标题栏不可误点（pointer-events:none）', { pe: idle.标题栏可点 })
  await wake()
  must((await snap()).标题栏透明度 === '1', '移动鼠标后标题栏恢复可见')

  /* ③ ←→ 翻页（主流快捷键） */
  const page0 = (await snap()).页码
  await p.keyboard.press('ArrowRight')
  await wake()
  const afterRight = await snap()
  must(afterRight.页码 !== page0, '→ 键翻到下一页', { from: page0, to: afterRight.页码 })
  await p.keyboard.press('ArrowLeft')
  await wake()
  must((await snap()).页码 === page0, '← 键翻回上一页', { expect: page0 })

  /* ④ 一键退出纯净 → 左右栏还原；再进入 → 左右栏隐藏 */
  await p.evaluate(() => { const sh = [...document.querySelectorAll('div')].find(d => String(d.className).includes('fixed inset-0 z-50')); const b = sh && [...sh.querySelectorAll('button')].find(b => b.innerText.trim() === '退出纯净'); b && b.click() })
  await wake()
  const off = await snap()
  must(!off.退出纯净按钮 && off.左目录 && off.右面板, '一键退出纯净后左右栏还原', { 左: off.左目录, 右: off.右面板 })
  must(off.标题栏透明度 === '1', '非纯净态标题栏常显')
  await p.evaluate(() => { const sh = [...document.querySelectorAll('div')].find(d => String(d.className).includes('fixed inset-0 z-50')); const b = sh && [...sh.querySelectorAll('button')].find(b => b.innerText.trim() === '⛶ 纯净放映'); b && b.click() })
  await wake()
  const on = await snap()
  must(!on.左目录 && !on.右面板, '再次进入纯净：左右侧再次同时隐藏', { 左: on.左目录, 右: on.右面板 })

  /* ⑤ Esc 退出纯净 → 还原 */
  await p.keyboard.press('Escape')
  await wake()
  const esc = await snap()
  must(esc.左目录 && esc.右面板, 'Esc 退出纯净后左右栏还原', { 左: esc.左目录, 右: esc.右面板 })

  /* ⑥ H5 查看态：用户复核「也可纯净」—— 同样默认纯净；点「退出纯净」后扫码分享栏浮现 */
  const h5Fx = await ensureH5Fixture()
  must(!!h5Fx.id, 'H5 基线件就绪', { id: h5Fx.id, created: h5Fx.created })
  const h5Cur = await (await fetch(`${B}/api/materials/${h5Fx.id}`, { headers: { Authorization: 'Bearer ' + lg.token } })).json()
  if (!h5Cur.h5_html) {
    execFileSync('npx', ['esbuild', 'src/lib/courseware-h5/index.ts', '--bundle', '--format=cjs', '--platform=node',
      '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
      '--define:import.meta.env={}', '--outfile=/tmp/h5pure.cjs', '--log-level=error'], { cwd: FE, stdio: 'inherit' })
    const { markdownToStorybookH5 } = require('/tmp/h5pure.cjs')
    const html = markdownToStorybookH5(String(h5Cur.content || ''), { subject: h5Cur.subject || '语文', grade: h5Cur.grade || '四年级', title: String(h5Cur.name || '').replace(/_课件$/, '') })
    await fetch(`${B}/api/materials/${h5Fx.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }, body: JSON.stringify({ ...h5Cur, h5_html: html }) })
  }
  const pH5 = await br.newPage({ viewport: { width: 1440, height: 900 } })
  pH5.on('pageerror', e => errs.push('[h5] ' + String(e.message).slice(0, 110)))
  await pH5.goto(B + '/login', { waitUntil: 'domcontentloaded' })
  await pH5.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])
  await pH5.goto(`${B}/courseware/h5/${h5Fx.id}`, { waitUntil: 'domcontentloaded' })
  await pH5.waitForTimeout(9000)
  const h5Snap = () => pH5.evaluate(() => {
    const sh = [...document.querySelectorAll('div')].find(d => String(d.className).includes('fixed inset-0 z-50'))
    const txt = sh ? (sh.innerText || '') : ''
    return { 扫码栏: /手机扫码查看/.test(txt), 退出纯净按钮: !!sh && [...sh.querySelectorAll('button')].some(b => b.innerText.trim() === '退出纯净'), 纯净入口: !!sh && [...sh.querySelectorAll('button')].some(b => b.innerText.trim() === '⛶ 纯净放映') }
  })
  await pH5.mouse.move(700, 500); await pH5.waitForTimeout(500)
  const h5On = await h5Snap()
  must(h5On.退出纯净按钮 && !h5On.扫码栏, 'H5 查看态同样默认纯净（扫码栏隐藏）', { h5On })
  await pH5.evaluate(() => { const sh = [...document.querySelectorAll('div')].find(d => String(d.className).includes('fixed inset-0 z-50')); const b = sh && [...sh.querySelectorAll('button')].find(b => b.innerText.trim() === '退出纯净'); b && b.click() })
  await pH5.mouse.move(700, 500); await pH5.waitForTimeout(700)
  must((await h5Snap()).扫码栏, 'H5 退出纯净后扫码分享栏浮现（扫码仍可用）')

  must(errs.length === 0, '全程 pageerror = 0', { errs })
  report()
})().catch(async e => {
  console.error('✘ 脚本异常：' + e.message)
  try { if (br) await br.close() } catch { /* ignore */ }
  process.exit(2)
}).finally(async () => {
  try { if (br) await br.close() } catch { /* ignore */ }
  // 跑完清残留（2026-09-18）：删掉自建的 __E2E基线_* 件（后端已提供 DELETE 接口）
  try { const r = await cleanupFixtures(); if (r && r.length) console.log('   [cleanup] ' + JSON.stringify(r)) } catch { /* ignore */ }
})
