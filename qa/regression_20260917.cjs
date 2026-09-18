/**
 * 覆盖式回归（2026-09-17）—— 覆盖本轮改动面
 *
 * 覆盖：环境健康 / KG 选择器与单元下拉 / H5 封面与页码与衬底 / PPT 编辑器与页数口径 /
 *       封面素材「占位→换→保存→持久化」全流程 / 全程 pageerror 计数
 *
 * 规则（见 qa/断言与证据规范.md）：
 *   · 每条断言都附证据；"全部/没有"类结论必须带分母（allOf）
 *   · 样本达到 limit 时告警（sampled）—— 防止再把"默认页"当全量
 *   · 结束 report()：任一条失败 → 退出码非 0
 *   · 所有注入（CW-COVER / 封面装饰）在 finally 里回滚
 */
const { chromium } = require('playwright')
const { must, notEmpty, allOf, sampled, report } = require('./lib/assert.cjs')
const { execFileSync } = require('child_process')
const { ensurePptFixture, ensureH5Fixture, cleanupFixtures } = require('./lib/cwFixture.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const FE = '/Users/sipon/CodeBuddy/AI教案/code/frontend'
const stripCW = md => String(md || '').split('\n').filter(l => !/CW-COVER/.test(l)).join('\n')
const countPages = md => String(md || '').split('\n').filter(l => /^##\s+/.test(l.trim())).length
const enc = s => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64')
const BG = enc('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#FF4D4F"/></svg>')
const withCW = (md, decor) => {
  const ls = stripCW(md).split('\n')
  let at = ls.length
  for (let i = 0; i < ls.length; i++) if (/^##\s/.test(ls[i])) { at = i; break }
  ls.splice(at, 0, '<!-- CW-COVER:' + Buffer.from(JSON.stringify(decor), 'utf8').toString('base64') + ' -->', '')
  return ls.join('\n')
}
let br
;(async () => {
  const lg = await (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }) })).json()
  must(!!lg.token, '登录成功（测试账号）')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }
  const get = async p => (await (await fetch(B + p, { headers: H })).json())
  // 基线件**随用随建**（staging 存量课件已按用户指令清空，守卫不再依赖既有数据）
  const pptFx = await ensurePptFixture()
  const ppt = { id: pptFx.id }
  must(!!ppt.id, 'PPT 基线件就绪', { id: ppt.id, created: pptFx.created })
  notEmpty(ppt.id, 'PPT 基线件 id')

  /* ── ① 环境健康 ── */
  const h = await get('/api/health')
  must(h.status === 'ok', 'staging /api/health', h)

  /* ── ② KG 选择器默认页（本轮修复点）── */
  const kn = await get('/api/ai/knowledge/nodes?limit=300')
  const nodes = kn.nodes || []
  sampled(nodes, { limit: 300, source: 'GET /api/ai/knowledge/nodes' })
  allOf(nodes, x => !!x.unit && !/^[0-9]+$/.test(x.unit), '默认页节点全为「可读单元」')

  /* ── ③ KG 单元下拉 ── */
  const un = (await get('/api/ai/knowledge/units?limit=500')).units || []
  sampled(un, { limit: 500, source: 'GET /api/ai/knowledge/units' })
  must(un.length > 0, '单元下拉非空', { n: un.length })
  allOf(un, x => !!String(x.unit || '').trim() && !/^[0-9]+$/.test(String(x.unit)), '下拉项全为可读单元名')

  /* ── ④ PPT 编辑器：加载 / 页数口径 / 封面占位 ── */
  const pptOrig = await get(`/api/materials/${ppt.id}`)
  const expectPages = countPages(pptOrig.content)
  must(expectPages > 0, '测试件有内容页', { expectPages })
  await fetch(`${B}/api/materials/${ppt.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...pptOrig, content: stripCW(pptOrig.content) }) })

  br = await chromium.launch()
  let errs = 0
  const p = await br.newPage({ viewport: { width: 1560, height: 940 } })
  p.on('pageerror', e => { errs++; console.log('   [pageerror] ' + String(e.message).slice(0, 130)) })
  await p.goto(B + '/login', { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])
  await p.goto(`${B}/courseware/ppt/${ppt.id}/edit`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(11000)

  const ph = await p.locator('button', { hasText: '点击添加封面素材' }).count()
  must(ph > 0, '无装饰时封面出现「添加封面素材」占位', { n: ph })
  const pageTxt = await p.evaluate(() => (document.body.innerText.match(/页面[（(]\s*(\d+)\s*[）)]/) || [])[0] || '')
  const shown = (pageTxt.match(/(\d+)/) || [])[1]
  must(shown === String(expectPages), `页数口径「${pageTxt || '未找到'}」= 内容页数 ${expectPages}（封面不计入）`, { shown, expectPages })

  /* ── ⑤ 封面素材全流程：占位 → 面板 → 选素材 → 保存 → 持久化 ── */
  await p.locator('button', { hasText: '点击添加封面素材' }).first().click()
  await p.waitForTimeout(2500)
  const cards = p.locator('div.grid-cols-3 button')
  const nCards = await cards.count()
  must(nCards > 0, '替换面板带出素材卡片', { nCards })
  const picked = await p.evaluate(() => { const g = document.querySelector('div.grid-cols-3'); const b = g && g.querySelector('button'); if (!b) return null; const t = (b.innerText || '').split('\n')[0]; b.click(); return t })
  notEmpty(picked, '点中了一张素材卡片', { picked })
  const t0 = Date.now(); let toast = false
  while (Date.now() - t0 < 9000) { if (/已替换封面装饰/.test(await p.evaluate(() => document.body.innerText))) { toast = true; break } await p.waitForTimeout(400) }
  must(toast, '提示「已替换封面装饰」')
  const sv = p.locator('button', { hasText: '保存草稿' }).first()
  if (await sv.count()) await sv.click()
  const t1 = Date.now(); let saved = false
  while (Date.now() - t1 < 12000) { if (/草稿已保存/.test(await p.evaluate(() => document.body.innerText))) { saved = true; break } await p.waitForTimeout(400) }
  must(saved, '提示「草稿已保存」')
  must(/CW-COVER/.test(String((await get(`/api/materials/${ppt.id}`)).content)), '封面装饰已写入存档（CW-COVER 落盘）')

  await p.goto(`${B}/courseware/ppt/${ppt.id}/edit`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(11000)
  const phAfter = await p.locator('button', { hasText: '点击添加封面素材' }).count()
  must(phAfter === 0, '重开后占位消失（装饰已持久化）', { phAfter })
  const blur = await p.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(e => { const b = getComputedStyle(e).backgroundImage || ''; return b.includes('data:image') && b.length > 30 })
    return el ? getComputedStyle(el).filter : null
  })
  // 注：commit 708df77「衬底放弃高斯模糊，只保留半透明 0.18——为导出保真让路」后，屏幕端封面衬底已无 blur。
  // 原断言期望 blur 属陈旧（代码已改），此处改为校验「不再高斯模糊」（与 pptx 导出口径一致）。
  must(!blur || !/blur/.test(blur), '封面衬底已放弃高斯模糊（仅半透明，与导出一致）', { filter: blur })

  /* ── ⑥ H5：封面 / 页码 / 衬底 ── */
  // H5 基线件随用随建；并把 h5_html 快照与内容对齐（新建件快照为空，6a 会白屏）
  const h5Fx = await ensureH5Fixture()
  const H5_ID = h5Fx.id
  must(!!H5_ID, 'H5 基线件就绪', { id: H5_ID, created: h5Fx.created })
  const h5Orig = await get(`/api/materials/${H5_ID}`)
  const h5Clean = stripCW(h5Orig.content)
  execFileSync('npx', ['esbuild', 'src/lib/courseware-h5/index.ts', '--bundle', '--format=cjs', '--platform=node',
    '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
    '--define:import.meta.env={}', '--outfile=/tmp/h5reg.cjs', '--log-level=error'], { cwd: FE, stdio: 'inherit' })
  const { markdownToStorybookH5 } = require('/tmp/h5reg.cjs')
  const h5Render = (md) => markdownToStorybookH5(md, {
    subject: h5Orig.subject || '语文', grade: h5Orig.grade || '四年级',
    title: String(h5Orig.name || '').replace(/_课件$/, ''),
    teacherName: (lg.user && lg.user.name) || '', themeId: h5Orig.theme_id || '', colorRoot: h5Orig.color_root || '',
  })
  await fetch(`${B}/api/materials/${H5_ID}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...h5Orig, content: h5Clean, h5_html: h5Render(h5Clean) }) })
  const p2 = await br.newPage({ viewport: { width: 414, height: 896 } })
  p2.on('pageerror', e => { errs++; console.log('   [pageerror] ' + String(e.message).slice(0, 130)) })
  const h5snap = async () => {
    await p2.goto(`${B}/api/materials/${H5_ID}/h5`, { waitUntil: 'domcontentloaded' })
    await p2.waitForTimeout(3500)
    return p2.evaluate(() => {
      const sc = [...document.querySelectorAll('.scene')]
      const u = document.querySelector('.cover-underlay')
      const cov = document.querySelector('.scene-cover')
      return {
        n: sc.length, firstType: sc.length ? sc[0].getAttribute('data-type') : null,
        pg: (document.querySelector('.pg-info') || {}).innerText,
        underlay: document.querySelectorAll('.cover-underlay').length,
        underlayFilter: u ? getComputedStyle(u).filter : null,
        coverBg: cov ? getComputedStyle(cov).backgroundImage.slice(0, 24) : null,
      }
    })
  }
  // 6a 无装饰：应**没有**衬底层，封面背景回退为主题渐变
  const a = await h5snap()
  must(a.firstType === 'cover', 'H5 首屏是封面', { firstType: a.firstType })
  must(a.n >= 2, 'H5 场景数 ≥ 2', { n: a.n })
  must(String(a.pg).includes('封面'), 'H5 首屏页码显示「封面」', { pg: a.pg })
  must(a.underlay === 0, '无封面装饰时**不生成**衬底层', { underlay: a.underlay })
  must(/gradient/.test(String(a.coverBg)), '无装饰时封面回退主题渐变', { coverBg: a.coverBg })
  await p2.evaluate(() => document.querySelector('.next') && document.querySelector('.next').click())
  await p2.waitForTimeout(600)
  const pg2 = await p2.evaluate(() => (document.querySelector('.pg-info') || {}).innerText)
  must(String(pg2) === `1/${a.n - 1}`, `H5 内容页页码=${pg2}（总数不含封面 ${a.n - 1}）`)

  // 6b 注入封面装饰后：衬底层出现（无模糊，与 PPT 屏幕端一致）
  const h5Md = withCW(h5Orig.content, { background: BG })
  await fetch(`${B}/api/materials/${H5_ID}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...h5Orig, content: h5Md, h5_html: h5Render(h5Md) }) })
  const b = await h5snap()
  must(b.underlay === 1, '有装饰时封面渲染出衬底层', { underlay: b.underlay })
  // 注：同 708df77，H5 衬底也已放弃高斯模糊，仅半透明。原「带高斯模糊」断言陈旧，改为校验无 blur。
  must(!b.underlayFilter || !/blur/.test(String(b.underlayFilter)), 'H5 衬底已放弃高斯模糊（仅半透明，与 PPT 屏幕一致）', { filter: b.underlayFilter })

  must(errs === 0, '全程 pageerror = 0', { errs })

  /* ── ⑦ 发布流程（结果必须明确；库中 status 必须与之一致）── */
  const pubBtn = p.locator('button', { hasText: /发布/ }).first()
  const nPub = await pubBtn.count()
  must(nPub > 0, '找到发布入口按钮', { nPub })
  let pubResult = ''
  if (nPub) {
    await pubBtn.click()
    const t2 = Date.now()
    while (Date.now() - t2 < 45000) {
      const txt = await p.evaluate(() => document.body.innerText)
      if (/课件已发布/.test(txt)) { pubResult = '已发布'; break }
      if (/校验|请填写|未通过|发布失败/.test(txt)) { pubResult = '被校验拦下'; break }
      await p.waitForTimeout(500)
    }
  }
  must(!!pubResult, '发布给出明确结果（不静默）', { pubResult })
  const st = (await get(`/api/materials/${ppt.id}`)).status
  must(pubResult === '已发布' ? st === 'active' : st !== 'active', '库中 status 与发布结果一致', { pubResult, status: st })

  /* ── ⑧ 内容页装饰往返（库层断言，对应 CW-DECOR 修复）── */
  execFileSync('npx', ['esbuild', 'src/lib/exportPptx.ts', '--bundle', '--format=cjs', '--platform=node',
    '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
    '--define:import.meta.env={}', '--outfile=/tmp/epreg.cjs', '--log-level=error'], { cwd: FE, stdio: 'inherit' })
  globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } }
  globalThis.window = globalThis.window || {}
  const EP = require('/tmp/epreg.cjs')
  const dOpts = { subject: '物理', grade: '八年级', title: '往返自证' }
  const dDecor = { background: 'https://x/bg.png', corners: [{ id: 'c', url: 'https://x/c.png', name: '云' }] }
  const dOutline = [{ title: '甲', bullets: ['a'], layout: 'edu-goal', decor: dDecor }, { title: '乙', bullets: ['b'] }]
  const dBack = EP.markdownToOutline(EP.outlineToMarkdown(dOutline, dOpts))
  must(JSON.stringify(dBack[0].decor) === JSON.stringify(dDecor), '内容页装饰随 markdown 往返（CW-DECOR）')
  must(!dBack[1].decor, '无装饰页不产生装饰')
  must(dBack.length === 2 && dBack[0].title === '甲', '往返未污染页数与标题', { pages: dBack.length })
  must(!/CW-DECOR/.test(EP.outlineToMarkdown([{ title: '甲', bullets: ['a'] }], dOpts)), '无装饰文档不写 CW-DECOR（旧文档零变化）')

  /* ── 回滚（含发布测试的 status 还原）── */
  const cur = await get(`/api/materials/${ppt.id}`)
  await fetch(`${B}/api/materials/${ppt.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...cur, content: stripCW(cur.content), ...(cur.status !== 'draft' ? { status: 'draft' } : {}) }) })
  must(!/CW-COVER/.test(String((await get(`/api/materials/${ppt.id}`)).content)), 'PPT 测试注入已回滚')
  must((await get(`/api/materials/${ppt.id}`)).status === 'draft', '发布测试已把 status 还原为 draft')
  const h5Back = markdownToStorybookH5(h5Clean, {
    subject: h5Orig.subject || '英语', grade: h5Orig.grade || '四年级',
    title: String(h5Orig.name || '').replace(/_课件$/, ''),
    teacherName: (lg.user && lg.user.name) || '', themeId: h5Orig.theme_id || '', colorRoot: h5Orig.color_root || '',
  })
  await fetch(`${B}/api/materials/${H5_ID}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...h5Orig, content: h5Clean, h5_html: h5Back }) })
  const h5Final = await get(`/api/materials/${H5_ID}`)
  must(!/CW-COVER/.test(String(h5Final.content)), 'H5 测试注入已回滚')
  must(!/<div class="cover-underlay"/.test(String(h5Final.h5_html)), 'H5 快照已还原（无衬底元素）')
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
