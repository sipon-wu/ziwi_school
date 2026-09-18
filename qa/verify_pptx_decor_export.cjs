/**
 * 针对性 e2e：验证「装饰层已进入 pptx 导出件」。
 *
 * 覆盖：注入封面装饰（CW-COVER）→ 在线编辑器打开 → 真实点「一键导出」→
 *       捕获 .pptx 下载 → 解包查 ppt/media 是否含图片（装饰已嵌入）。
 *
 * 规则：复用 qa/lib/assert.cjs；注入在 finally 里回滚。
 */
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')
const { execFileSync } = require('child_process')
const { ensurePptFixture } = require('./lib/cwFixture.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const enc = s => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64')
const BG = enc('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#FF4D4F"/></svg>')
const CORNER = enc('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="30" fill="#1677FF"/></svg>')
const stripCW = md => String(md || '').split('\n').filter(l => !/CW-COVER/.test(l)).join('\n')
const withCW = (md, decor) => {
  const ls = stripCW(md).split('\n')
  let at = ls.length
  for (let i = 0; i < ls.length; i++) if (/^##\s/.test(ls[i])) { at = i; break }
  ls.splice(at, 0, '<!-- CW-COVER:' + Buffer.from(JSON.stringify(decor), 'utf8').toString('base64') + ' -->', '')
  return ls.join('\n')
}
/**
 * 统计 pptx 内**真实图片文件**（2026-09-18 收紧口径）：
 * 此前用 `/ppt\/media\//` 过滤 `unzip -l` 输出，会把**目录项** `ppt/media/` 也算成一张图片 →
 * "只有目录、没有图片"（即装饰根本没嵌入）时会假绿。现只认带扩展名的图片文件。
 */
const countMedia = (p) => {
  try {
    const out = execFileSync('unzip', ['-l', p], { encoding: 'utf8' })
    const names = out.split('\n')
      .map(l => (l.trim().split(/\s+/).pop() || ''))
      .filter(n => /^ppt\/media\/.+\.(png|jpe?g|gif|svg|webp|emf)$/i.test(n))
    return { n: names.length, names }
  } catch (e) { return { n: -1, names: [] } }
}
let br
;(async () => {
  const lg = await (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }) })).json()
  must(!!lg.token, '登录成功（测试账号）')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }
  const get = async p => (await (await fetch(B + p, { headers: H })).json())
  // 基线件随用随建（staging 存量课件已清空，守卫不再依赖既有数据）
  const fx = await ensurePptFixture()
  must(!!fx.id, 'PPT 基线件就绪', { id: fx.id, created: fx.created })
  const ppt = { id: fx.id }
  const orig = await get(`/api/materials/${ppt.id}`)

  const decor = { background: BG, corners: [{ id: 'c1', url: CORNER, name: '角标' }] }
  const newContent = withCW(orig.content, decor)
  await fetch(`${B}/api/materials/${ppt.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...orig, content: newContent }) })
  must(/CW-COVER/.test(String((await get(`/api/materials/${ppt.id}`)).content)), '封面装饰已注入存档（CW-COVER 落盘）')

  br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1560, height: 940 } })
  const downloads = []
  p.on('download', d => downloads.push(d))
  await p.goto(B + '/login', { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])
  await p.goto(`${B}/courseware/ppt/${ppt.id}/edit`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(11000)

  await p.locator('button', { hasText: '导出' }).first().click()
  await p.waitForTimeout(600)
  await p.locator('button', { hasText: /一键导出/ }).first().click()

  const t0 = Date.now(); let pptxPath = null; const fns = []
  while (Date.now() - t0 < 40000) {
    for (const d of downloads) { const fn = d.suggestedFilename(); if (!fns.includes(fn)) fns.push(fn); if (/\.pptx$/i.test(fn) && !pptxPath) pptxPath = await d.path() }
    if (pptxPath) break
    await p.waitForTimeout(500)
  }
  must(!!pptxPath, '捕获到 .pptx 下载', { downloads: fns })
  const m = countMedia(pptxPath)
  console.log('   [ppt/media] ' + JSON.stringify(m.names))
  // 背景衬底 + 角标 = 2 张真实图片（只数带扩展名的文件，目录项不计）
  must(m.n >= 2, 'pptx 内 ppt/media 含 ≥2 张真实图片（背景衬底 + 角标已嵌入）', { mediaFiles: m.n, mediaNames: m.names, downloads: fns })

  await fetch(`${B}/api/materials/${ppt.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...orig, content: stripCW(orig.content) }) })
  must(!/CW-COVER/.test(String((await get(`/api/materials/${ppt.id}`)).content)), '注入已回滚（无 CW-COVER）')
  report()
})().catch(async e => {
  console.error('✘ 脚本异常：' + e.message)
  try { if (br) await br.close() } catch { /* ignore */ }
  process.exit(2)
}).finally(async () => { try { if (br) await br.close() } catch { /* ignore */ } })
