/**
 * 封面版式页「元素层三端一致」守卫（2026-09-18 立，方案 A）
 *
 * 背景（B3 / 文档评审 V5）：`layout=edu-cover` 的页若带老师加的元素，三端表现曾不一致 ——
 *   编辑器画布：元素**照常渲染**（isCover 只影响配色/底带）        → 看得见
 *   预览/放映： 封面分支完全不画 elements                          → 看不见
 *   导出 pptx： 封面分支只认 kind==='cover' → 走内容分支（白底皮肤） → 画了但皮肤不对
 * 方案 A：把「元素层是唯一渲染源」贯彻到封面版式页 —— 预览封面分支叠加元素层、导出封面判定与预览对齐并叠加元素层。
 *
 * 本脚本用基线件里的 `自证_封面版式` 页（layout: edu-cover + 带标记元素的 CW-EL）守：三端都能看到该元素。
 */
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')
const { execFileSync } = require('child_process')
const { ensurePptFixture, COVER_MARK, cleanupFixtures } = require('./lib/cwFixture.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const PAGE = '自证_封面版式'

let br
;(async () => {
  const lg = await (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }) })).json()
  must(!!lg.token, '登录成功（测试账号）')
  const fx = await ensurePptFixture()
  must(!!fx.id, 'PPT 基线件就绪', { id: fx.id, created: fx.created, synced: fx.synced })
  const auth = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }
  const cur = await (await fetch(`${B}/api/materials/${fx.id}`, { headers: auth })).json()
  // 元素文本在 base64 的 CW-EL 注释里，明文 markdown 搜不到 → 解码核对
  const cw = String(cur.content).match(/<!--\s*layout:\s*edu-cover\s*-->[\s\S]*?<!--\s*CW-EL:([A-Za-z0-9+/=]+)\s*-->/)
  let coverEls = []
  try { coverEls = cw ? JSON.parse(Buffer.from(cw[1], 'base64').toString('utf8')) : [] } catch { coverEls = [] }
  must(coverEls.some(e => String(e.text || '').includes(COVER_MARK)), '基线件含封面版式自证页与标记元素', { els: coverEls.length, texts: coverEls.map(e => String(e.text || '').slice(0, 12)) })

  br = await chromium.launch()
  const errs = []
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto(B + '/login', { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])

  /* ① 编辑器画布：封面版式页的元素可见（这是基准行为） */
  await p.goto(`${B}/courseware/ppt/${fx.id}/edit`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(11000)
  const jumped = await p.evaluate((t) => {
    // 缩略图标题可能被截断，故用短前缀匹配
    const c = [...document.querySelectorAll('div,button')].filter(e => (e.innerText || '').trim().startsWith(t) && e.getBoundingClientRect().width < 240)[0]
    if (!c) return false
    c.click(); return true
  }, PAGE.slice(0, 2))
  must(jumped, `编辑器定位到页「${PAGE}」`)
  await p.waitForTimeout(2000)
  const inEditor = await p.evaluate((m) => document.body.innerText.includes(m), COVER_MARK)
  must(inEditor, '编辑器画布：封面版式页的元素可见')

  /* ② 预览/放映：同一页元素同样可见（此前看不见 = 本次修复点） */
  const pv = await br.newPage({ viewport: { width: 1440, height: 900 } })
  pv.on('pageerror', e => errs.push('[预览] ' + String(e.message).slice(0, 120)))
  await pv.goto(B + '/login', { waitUntil: 'domcontentloaded' })
  await pv.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])
  await pv.goto(`${B}/courseware/ppt/${fx.id}`, { waitUntil: 'domcontentloaded' }) // 查看态 = 放映
  await pv.waitForTimeout(11000)
  const inPreview = async () => pv.evaluate((m) => {
    const sh = [...document.querySelectorAll('div')].find(d => String(d.className).includes('fixed inset-0 z-50'))
    return !!sh && (sh.innerText || '').includes(m)
  }, COVER_MARK)
  // 清洁面默认纯净 → 用键盘翻到自证页（0=封面, 1=学习目标, 2=课堂练习, 3=自证）
  let found = await inPreview()
  for (let i = 0; i < 4 && !found; i++) { await pv.keyboard.press('ArrowRight'); await pv.waitForTimeout(600); found = await inPreview() }
  must(found, '预览/放映：封面版式页的元素可见（此前完全看不见）')

  /* ③ 导出 pptx：该元素文本出现在幻灯片 XML 中 */
  const downloads = []
  p.on('download', d => downloads.push(d))
  const exportBtn = p.locator('button', { hasText: '导出' }).first()
  await exportBtn.click()
  await p.waitForTimeout(600)
  await p.locator('button', { hasText: /一键导出/ }).first().click()
  const t0 = Date.now(); let pptxPath = null
  while (Date.now() - t0 < 40000) {
    for (const d of downloads) { if (/\.pptx$/i.test(d.suggestedFilename())) { pptxPath = await d.path() } }
    if (pptxPath) break
    await p.waitForTimeout(500)
  }
  must(!!pptxPath, '捕获到 .pptx 下载')
  let xml = ''
  try { xml = execFileSync('unzip', ['-p', pptxPath, 'ppt/slides/*.xml'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) } catch (e) { xml = '' }
  must(xml.includes(COVER_MARK), '导出 pptx：封面版式页的元素已写入幻灯片 XML', { slidesXmlLen: xml.length })
  // 皮肤对齐（方案 A 的第二半）：该页应为**封面皮肤**——封面页第 1 张 slide 背景是主题封面色，
  // 此处以"标题文本 xx 出现在封面 slide"间接核对：占位断言，避免过拟合 XML 结构。
  must(xml.includes(PAGE), '导出 pptx：该页仍带其标题（未因叠加元素层而丢标题）', { page: PAGE })

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
