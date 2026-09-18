/**
 * 素材库预览「封面装饰」守卫（2026-09-18 立，补 A3 覆盖缺口）
 *
 * 背景：`Materials.tsx` 的素材库预览此前用 `outlineToSlides(materializeOutline(markdownToOutline(content)), opts)`
 * —— **没传 coverDecor** → 同一份课件在「编辑器/放映」有封面装饰、在「素材库预览」里没有（同一份内容两条渲染路径）。
 * 修复后：`outlineToSlides(..., parseCoverDecor(content))`。本脚本守这条修复不回退：
 *   ① 无装饰：预览里**不出现** data:image 背景（基线）
 *   ② 注入 CW-COVER 后：预览里出现 data:image 背景（装饰生效）
 *   ③ 回滚干净
 */
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')
const { ensurePptFixture, PPT_NAME } = require('./lib/cwFixture.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const enc = s => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64')
const BG = enc('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#FF4D4F"/></svg>')
const stripCW = md => String(md || '').split('\n').filter(l => !/CW-COVER/.test(l)).join('\n')
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
  const fx = await ensurePptFixture()
  must(!!fx.id, 'PPT 基线件就绪', { id: fx.id, created: fx.created, synced: fx.synced })
  // 基线：先确保无装饰
  const orig = await get(`/api/materials/${fx.id}`)
  const clean = stripCW(orig.content)
  if (String(orig.content) !== clean) await fetch(`${B}/api/materials/${fx.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...orig, content: clean }) })

  br = await chromium.launch()
  const errs = []
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto(B + '/login', { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])

  /** 打开素材库里本基线件的「播放」预览，返回 overaly 内是否出现 data:image 背景 */
  const openPreview = async () => {
    await p.goto(B + '/materials', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(2500)
    // 「播放」按钮仅列表视图渲染 → 先切列表视图
    await p.locator('button:has(svg.lucide-list)').first().click().catch(() => {})
    await p.waitForTimeout(800)
    // 只点本基线件那张卡的「播放」（避免误点其他素材）：
    // 从"素材名"叶子节点向上找最近的、含「播放」按钮的卡片容器
    // （此前用 `innerText.includes(name)` 匹配祖先容器 → 会命中整列 → 点到别的素材）
    const clicked = await p.evaluate((name) => {
      const nameEl = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && (e.textContent || '').trim() === name)
      let card = nameEl
      while (card && !(card.querySelectorAll && [...card.querySelectorAll('button')].some(b => (b.innerText || '').includes('播放')))) card = card.parentElement
      const btn = card ? [...card.querySelectorAll('button')].find(b => (b.innerText || '').includes('播放')) : null
      if (!btn) return false
      btn.click(); return true
    }, PPT_NAME)
    if (!clicked) return { clicked: false }
    await p.waitForTimeout(4000)
    const has = await p.evaluate(() => {
      const ov = [...document.querySelectorAll('div')].find(d => String(d.className).includes('fixed inset-0 z-50'))
      if (!ov) return false
      return [...ov.querySelectorAll('div')].some(d => String(getComputedStyle(d).backgroundImage || '').includes('data:image'))
    })
    // 关闭预览，避免影响下一步
    await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('返回编辑')); b && b.click() })
    await p.waitForTimeout(800)
    return { clicked: true, hasDecor: has }
  }

  const before = await openPreview()
  must(before.clicked, '素材库列表里找到基线件的「播放」入口')
  must(before.hasDecor === false, '无装饰时素材库预览不出现装饰背景（基线）', { before })

  // 注入封面装饰
  await fetch(`${B}/api/materials/${fx.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...orig, content: withCW(orig.content, { background: BG }) }) })
  must(/CW-COVER/.test(String((await get(`/api/materials/${fx.id}`)).content)), '封面装饰已注入存档')

  const after = await openPreview()
  must(after.hasDecor === true, '有装饰时素材库预览渲染出装饰背景（parseCoverDecor 生效）', { after })

  // 回滚
  await fetch(`${B}/api/materials/${fx.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...orig, content: clean }) })
  must(!/CW-COVER/.test(String((await get(`/api/materials/${fx.id}`)).content)), '测试注入已回滚')

  must(errs.length === 0, '全程 pageerror = 0', { errs })
  report()
})().catch(async e => {
  console.error('✘ 脚本异常：' + e.message)
  try { if (br) await br.close() } catch { /* ignore */ }
  process.exit(2)
}).finally(async () => { try { if (br) await br.close() } catch { /* ignore */ } })
