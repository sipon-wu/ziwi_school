// S4 关卡3：视觉检查（确定性几何版）
//
// 为什么不用视觉模型猜：撑破/溢出/越界/空白页是**可测量的几何事实**，
// 用 DOM 量出来比让模型看图更准、更便宜、可复现。
// 量什么：
//   ① 文本溢出：元素 scrollHeight > clientHeight（文字被容器裁掉）
//   ② 越界：绝对定位块的包围盒超出幻灯片画布
//   ③ 空白页：可见文本 < 5 字
// 另外逐页截图存盘（给人看，也给后续视觉评审留底）。
//
// 用法：
//   IDS=id1,id2 node qa/visual_check.cjs              # 查已有课件
//   GEN=1 node qa/visual_check.cjs                    # 现场生成一份新草稿再查
//   BASE=... STYLE=china SUBJECT=语文 GRADE=四年级 TITLE=观潮 node qa/visual_check.cjs
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const OUT = process.env.OUT || path.join(__dirname, 'shots_visual_check')
const STYLE = process.env.STYLE || 'china'
const SUBJECT = process.env.SUBJECT || '语文'
const GRADE = process.env.GRADE || '四年级'
const TITLE = process.env.TITLE || '观潮'
// 风格 → 代表主题（与前端 styleRegistry 一致，仅用于让渲染端拿到配色）
const THEME = { china: 'zgf-ink-wash', tech: 'te-quantum-blue', fresh: 'fr-mint', minimal: 'min-classic-blue', academic: 'aca-edu-blue', cartoon: 'sp-cartoon' }

const login = async () => (await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
})).json()).token

/** 现场生成一份新草稿，落到素材库，返回 {id, gen} */
const makeDraft = async (token) => {
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const gen = await (await fetch(`${BASE}/api/ai/courseware/generate`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ subject: SUBJECT, grade: GRADE, lesson_title: TITLE, format: 'ppt', style_tag: STYLE }),
  })).json()
  const md = gen.courseware_markdown || ''
  if (!md.trim()) throw new Error('生成结果为空')
  const created = await (await fetch(`${BASE}/api/materials/json`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      name: `【视觉检查】${TITLE}-${STYLE}-${Date.now() % 100000}`,
      type: 'courseware', format: 'ppt', tag: STYLE,
      content: md, status: 'draft',
      grade: GRADE, subject: SUBJECT, theme_id: THEME[STYLE] || 'min-classic-blue',
      color_root: JSON.stringify(gen.style_dna || gen.color_palette || {}),
    }),
  })).json()
  const id = created.id || (created.data && created.data.id) || (created.item && created.item.id)
  if (!id) throw new Error('草稿创建失败：' + JSON.stringify(created).slice(0, 200))
  return { id, gen }
}

/** 页面内测量：返回本页问题列表 */
const probePage = () => {
  const out = { overflow: [], exceeds: [], outOfBounds: [], blank: false, textLen: 0, scope: '' }
  const vis = (el) => {
    const r = el.getBoundingClientRect()
    const st = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'
  }
  const txtOf = (el) => (el.textContent || '').trim()

  // ── 主画布定位（2026-09-12 修）──
  // 只量**主画布**，不量页面上的其它渲染副本。教训：页面上同时存在
  // ① 主画布（`relative bg-white`，逻辑 960×540）
  // ② 全屏浮层里的**小尺寸副本**（如 `fixed inset-0 z-50` 内的 490×276）
  // 幻灯片内字号是**绝对单位（如 7.5mm）**，在小副本里相对画布被放大约 2 倍 → 必然溢出。
  // 探针若不分主次，就会把这种副本当成幻灯片，**系统性误报**（实测把一份合格课件报成"文字被裁"）。
  const canvases = [...document.querySelectorAll('.relative.bg-white')]
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter((o) => o.r.width > 100)
    .sort((a, b) => b.r.width - a.r.width)
  const root = canvases.length ? canvases[0].e : document.body
  out.scope = canvases.length > 1 ? `主画布 ${Math.round(canvases[0].r.width)}px（另有 ${canvases.length - 1} 个副本已忽略）` : ''

  const blocks = [...root.querySelectorAll('*')].filter(el => {
    const st = el.getAttribute('style') || ''
    return /position\s*:\s*absolute/i.test(getComputedStyle(el).position) || /left\s*:\s*[\d.]+%/.test(st)
  }).filter(vis)
  const rr = root.getBoundingClientRect()

  // ① 文本溢出 + ③ 空白（只在主画布内统计，避免副本重复计数）
  for (const el of root.querySelectorAll('*')) {
    if (!vis(el)) continue
    if (el.childElementCount > 0) continue          // 只看叶子（真正放文字的）
    const t = txtOf(el)
    if (t.length < 2) continue
    out.textLen += t.length
    if (el.scrollHeight > el.clientHeight + 3 && el.clientHeight > 0) {
      out.overflow.push({ text: t.slice(0, 26), scroll: el.scrollHeight, client: el.clientHeight })
    }
  }

  // ② 越界
  for (const b of blocks) {
    const r = b.getBoundingClientRect()
    const over = Math.max(rr.left - r.left, r.right - rr.right, rr.top - r.top, r.bottom - rr.bottom)
    if (over > 2) out.outOfBounds.push({ text: txtOf(b).slice(0, 20), over: Math.round(over) })
  }
  out.blank = out.textLen < 5
  return out
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const token = await login()
  let ids = (process.env.IDS || '').split(',').filter(Boolean)
  let genInfo = null
  if (process.env.GEN === '1') {
    const { id, gen } = await makeDraft(token)
    ids = [id]
    genInfo = gen
    console.log(`新草稿 id=${id}`)
    if (gen.quality_report) console.log(`  关卡1：ERR=${gen.quality_report.error_count} 页数=${gen.quality_report.pages}`)
    if (gen.content_review && gen.content_review.available) console.log(`  关卡2：${JSON.stringify(gen.content_review.scores)} verdict=${gen.content_review.passed ? 'pass' : 'fail'}`)
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(x => localStorage.setItem('zhiwei_token', x), token)

  let totalBad = 0
  for (const id of ids) {
    await page.goto(`${BASE}/courseware/ppt/${id}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3500)
    // 页数 = 出现过的最大 P{n}（页面可能存在两套缩略图 DOM，不能直接计数）
    const total = await page.evaluate(() => {
      let max = 0
      document.querySelectorAll('span,div,button,li,p').forEach(e => {
        const t = (e.childElementCount === 0 ? (e.textContent || '') : '').trim()
        const m = /^P(\d+)$/.exec(t)
        if (m) max = Math.max(max, parseInt(m[1], 10))
      })
      return max
    })
    console.log(`\n课件 ${id.slice(0, 8)}：识别 ${total} 页`)
    for (let i = 1; i <= total; i++) {
      const ok = await page.evaluate((pn) => {
        const t = [...document.querySelectorAll('span,div,button,li,p')]
          .find(e => e.childElementCount === 0 && (e.textContent || '').trim() === pn)
        if (!t) return false
        let el = t
        for (let k = 0; k < 4 && el; k++) {
          el = el.parentElement
          if (el && el.tagName === 'BUTTON') { el.click(); return true }
        }
        t.click(); return true
      }, `P${i}`)
      if (!ok) { console.log(`  P${i} 未找到缩略图，停止`); break }
      await page.waitForTimeout(650)
      await page.screenshot({ path: path.join(OUT, `${id.slice(0, 8)}_p${String(i).padStart(2, '0')}.png`) })
      const r = await page.evaluate(probePage)
      const bad = []
      const warn = []
      if (r.overflow.length) bad.push(`文字被裁×${r.overflow.length}（${r.overflow[0].text}…）`)
      if (r.outOfBounds.length) bad.push(`越界×${r.outOfBounds.length}（超出${Math.max(...r.outOfBounds.map(o => o.over))}px）`)
      if (r.blank) bad.push('空白页')
      if (r.exceeds.length) warn.push(`内容撑出容器×${r.exceeds.length}（需人看是否遮挡）`)
      if (bad.length) { totalBad++; console.log(`  P${i} ✗ ${bad.join(' ')}${warn.length ? ' ⚠ ' + warn.join(' ') : ''}`) }
      else console.log(`  P${i} ${warn.length ? '⚠' : '✓'} 文本${r.textLen}字${warn.length ? ' ' + warn.join(' ') : ''}${i === 1 && r.scope ? `　[${r.scope}]` : ''}`)
    }
  }
  await browser.close()
  console.log(`\n关卡3 小结：${totalBad} 页有问题；截图在 ${path.relative(process.cwd(), OUT)}`)
})().catch(e => { console.error('ERR', e.message); process.exit(2) })
