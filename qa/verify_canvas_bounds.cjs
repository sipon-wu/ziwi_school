/**
 * 课件编辑器画布守卫（2026-09-18 立，对应用户反馈的三个问题）
 *
 * 背景：用户在全屏编辑态反馈——
 *   ① 元件内容溢出画布（课堂练习页 4 元件 x=5/35/65/95、w=30 → 末位 x+w=125% 越界落盘）
 *   ② 「隐藏页」非全屏模式下无、且全屏下位置游离到最右角
 *   ③ 非全屏模式下元件（x=95% 那个）完全看不见
 * 根因：几何写路径无边界钳制；PptxPreview 根节点 min-width:auto 被画布内容撑住、
 *       收缩链断裂 → 非全屏画布(960px)溢出视口被裁且不可滚。
 *
 * 本脚本守三件事：
 *   A. 载入即钳界：注入一个 x=95/w=30 的越界元件，编辑器里渲染必须已收到界内（x≤70）
 *   B. 非全屏画布必须完整落在视口内（右缘 ≤ 视口宽），且所有元件在画布内
 *   C. 「隐藏页/显示页」按钮在非全屏存在且可切换；全屏下收在工具栏组内（不在最右角）
 */
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')
const { ensurePptFixture, cleanupFixtures } = require('./lib/cwFixture.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const PAGE_TITLE = '课堂练习'
const CWEL_RE = /^<!--\s*CW-EL:([A-Za-z0-9+/=]+)\s*-->$/

let br
;(async () => {
  const lg = await (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }) })).json()
  must(!!lg.token, '登录成功（测试账号）')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }
  const get = async p => (await (await fetch(B + p, { headers: H })).json())

  // 基线件随用随建（staging 存量课件已清空，守卫不再依赖既有数据）
  const fx = await ensurePptFixture()
  const ID = fx.id
  must(!!ID, 'PPT 基线件就绪（含课堂练习页 + CW-EL）', { id: ID, created: fx.created })

  const orig = await get(`/api/materials/${ID}`)
  // 注入越界元件：找含 CW-EL 的那页，把首元素强行设成 x=95,w=30（复现用户现场）
  let hit = false
  const injected = String(orig.content || '').split('\n').map(line => {
    const mt = line.match(CWEL_RE)
    if (!mt || hit) return line
    const els = JSON.parse(Buffer.from(mt[1], 'base64').toString('utf8'))
    if (!els.length) return line
    els[0] = { ...els[0], x: 95, w: 30 }
    hit = true
    return `<!-- CW-EL:${Buffer.from(JSON.stringify(els), 'utf8').toString('base64')} -->`
  }).join('\n')
  must(hit, '注入点存在（存档含 CW-EL 页）')
  await fetch(`${B}/api/materials/${ID}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...orig, content: injected }) })

  br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto(B + '/login', { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])
  await p.goto(`${B}/courseware/ppt/${ID}/edit`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(11000)

  const geo = () => p.evaluate(() => {
    const canv = [...document.querySelectorAll('div')].find(d => String(d.className).includes('ring-[#E7E7EB]') && String(d.className).includes('overflow-hidden'))
    const els = [...document.querySelectorAll('div.absolute')].filter(d => d.style.cursor === 'move' || d.style.cursor === 'text')
    const cr = canv ? canv.getBoundingClientRect() : null
    return {
      vw: innerWidth,
      canvas: cr ? { l: Math.round(cr.left), r: Math.round(cr.right) } : null,
      out: cr ? els.filter(e => { const r = e.getBoundingClientRect(); return r.right > cr.right + 1 || r.left < cr.left - 1 }).length : -1,
      elsN: els.length,
      btns: [...document.querySelectorAll('button')].filter(b => ['隐藏页', '显示页'].includes(b.innerText.trim())).map(b => { const r = b.getBoundingClientRect(); return { tx: b.innerText.trim(), x: Math.round(r.x) } }),
      // 左端「收起页列表」控件：非全屏为 ‹ 图标（用户 2026-09-18 定稿），全屏为文字按钮
      icons: [...document.querySelectorAll('button')].filter(b => b.innerText.trim() === '‹').map(b => { const r = b.getBoundingClientRect(); return { tx: '‹', x: Math.round(r.x) } }),
    }
  })

  // 切到含越界元件的那页（按缩略图标题定位）
  const switched = await p.evaluate((t) => {
    const c = [...document.querySelectorAll('div,button')].filter(e => (e.innerText || '').trim().startsWith(t) && e.getBoundingClientRect().width < 220)[0]
    if (!c) return false
    c.click(); return true
  }, PAGE_TITLE)
  must(switched, `定位到页「${PAGE_TITLE}」`)
  await p.waitForTimeout(2000)

  /* A + B：非全屏 —— 画布不溢出视口、元件全在画布内（越界元件已被钳回） */
  const nf = await geo()
  must(!!nf.canvas, '非全屏画布存在')
  must(nf.canvas.r <= nf.vw, '非全屏画布右缘不超出视口（画布自适应生效）', { canvasR: nf.canvas.r, vw: nf.vw })
  must(nf.elsN > 0, '该页渲染出元件', { elsN: nf.elsN })
  must(nf.out === 0, '所有元件都在画布内（越界几何载入即钳界）', { outOfBounds: nf.out })

  /* C1：非全屏左端收起控件（‹ 图标，用户 2026-09-18 定稿）存在、在左、可收起/再展开 */
  must(nf.icons.length >= 1, '非全屏工具栏有左端「收起页列表」‹ 控件', { icons: nf.icons })
  must(nf.icons[0].x < nf.vw / 2, '收起控件位于工具栏左端（与所控左栏同侧）', { x: nf.icons[0].x, half: Math.round(nf.vw / 2) })
  // 收起后：画布区左缘须浮出贴边 › tab（左右对称收放闭环的一部分，此前被误删）
  const leftTab = () => p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '›')
    if (!b) return null
    const r = b.getBoundingClientRect()
    const canv = [...document.querySelectorAll('div')].find(d => String(d.className).includes('ring-[#E7E7EB]') && String(d.className).includes('overflow-hidden'))
    const cr = canv ? canv.getBoundingClientRect() : null
    return { x: Math.round(r.x), vis: r.width > 0 && r.height > 0, leftOfCanvas: cr ? r.x < cr.left : null }
  })
  must(!(await leftTab()), '展开态不显示左缘悬浮 tab')
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '‹'); b && b.click() })
  await p.waitForTimeout(700)
  const lt = await leftTab()
  // `left-0` 相对编辑器画布区（左边还有信息栏），故校验"贴在其区域左缘"而非窗口 x≈0
  must(!!lt && lt.vis && lt.leftOfCanvas === true, '收起后画布区左缘浮出贴边 › 展开 tab（贴边闭环完好）', { tab: lt })
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '›'); b && b.click() })
  await p.waitForTimeout(700)
  const reNf = await geo()
  must(reNf.icons.length >= 1, '再展开后左端 ‹ 控件回归', { icons: reNf.icons })
  must(!(await leftTab()), '重新展开后贴边 tab 消失')

  /* C2：全屏下按钮收在工具栏组内（不再游离最右角） */
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.replace(/\s/g, '') === '全屏'); b && b.click() })
  await p.waitForTimeout(2500)
  const fs = await geo()
  must(fs.btns.length >= 1, '全屏态同样有「隐藏页/显示页」按钮', { btns: fs.btns })
  must(fs.btns[0].x < fs.vw / 2, '全屏按钮收在工具栏组内（非最右角游离）', { x: fs.btns[0].x, half: Math.round(fs.vw / 2) })
  must(fs.out === 0, '全屏态元件同样全在画布内', { out: fs.out })

  must(errs.length === 0, '全程 pageerror = 0', { errs })

  // 回滚注入
  await fetch(`${B}/api/materials/${ID}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...orig, content: orig.content }) })
  const back = await get(`/api/materials/${ID}`)
  must(String(back.content) === String(orig.content), '测试注入已回滚')
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
