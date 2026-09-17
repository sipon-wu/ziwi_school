// 逐页 E2E 抓图对比：两份同内容、不同风格的 PPT 草稿（A=国风 / B=科技）
// 1) 逐页截图存盘（供人看）
// 2) 页面内审计：内容溢出 / 越界 / 空卡 / 标题对比度
// 3) 真实像素 diff：把截图交回浏览器解码成 48x27 灰度向量，Node 里算平均绝对差
// 用法：A=<id> B=<id> node qa/e2e_ppt_style_compare.cjs
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const A = process.env.A
const B = process.env.B
const OUT = process.env.OUT || path.join(__dirname, 'e2e_ppt_compare')
const MAXP = parseInt(process.env.MAXP || '20', 10)

/* ── 页面内审计 ── */
const AUDIT = () => {
  const cands = [...document.querySelectorAll('div')]
    .filter(d => (d.getAttribute('style') || '').includes('aspect-ratio'))
    .sort((x, y) => y.clientWidth - x.clientWidth)
  const root = cands[0]
  if (!root) return { err: 'no-canvas' }
  const R = root.getBoundingClientRect()
  const res = { w: Math.round(R.width), overflow: 0, outOfBounds: 0, emptyCards: 0, title: null, overSamples: [], oobSamples: [], emptySamples: [], isCover: !!root.querySelector('h2') }

  const inCanvas = (b) => b.left >= R.left - 3 && b.top >= R.top - 3 && b.right <= R.right + 3 && b.bottom <= R.bottom + 3

  root.querySelectorAll('div,span,p').forEach(e => {
    const txt = (e.innerText || '').trim()
    const st = getComputedStyle(e)
    const b = e.getBoundingClientRect()
    if (b.width < 10 || b.height < 8) return
    // 溢出：自身内容超出自身盒子
    if (txt && (e.scrollHeight - e.clientHeight > 3 || e.scrollWidth - e.clientWidth > 3)) {
      res.overflow++
      if (res.overSamples.length < 3) res.overSamples.push(`${Math.round(b.width)}x${Math.round(b.height)} ${JSON.stringify(txt.slice(0, 24))}`)
    }
    // 越界：可见内容块跑出画布
    if (txt && !inCanvas(b)) {
      res.outOfBounds++
      if (res.oobSamples.length < 3) res.oobSamples.push(`${JSON.stringify(txt.slice(0, 24))}`)
    }
    // 空卡：有边框/底色但无文字
    const hasBg = st.backgroundColor && st.backgroundColor !== 'rgba(0, 0, 0, 0)'
    const hasBorder = st.borderLeftWidth !== '0px' || st.borderTopWidth !== '0px' || st.borderWidth !== '0px'
    const area = (b.width * b.height) / (R.width * R.height)
    // 只把"有边框的卡片"算作空卡：主色标题带是纯背景无边框，属合法装饰（勿误报）
    if (!txt && hasBorder && area > 0.03 && e.children.length <= 2) {
      res.emptyCards++
      if (res.emptySamples.length < 3) res.emptySamples.push(`${Math.round((b.left - R.left) / R.width * 100)},${Math.round((b.top - R.top) / R.height * 100)},${Math.round(b.width / R.width * 100)}x${Math.round(b.height / R.height * 100)} ${(e.className || '').toString().slice(0, 40)}`)
    }
  })

  // 标题：画布内最大字号的文本元素
  let best = null, bestFs = 0
  root.querySelectorAll('span,p,div').forEach(e => {
    if (e.children.length) return
    const t = (e.textContent || '').trim()
    if (!t || t.length > 40) return
    const fs = parseFloat(getComputedStyle(e).fontSize) || 0
    if (fs > bestFs) { bestFs = fs; best = e }
  })
  if (best) {
    const b = best.getBoundingClientRect()
    res.title = {
      text: (best.textContent || '').trim().slice(0, 20),
      fs: Math.round(bestFs),
      color: getComputedStyle(best).color,
      // 归一化到画布，供取样背景
      cx: (b.left - R.left) / R.width, cy: (b.top - R.top) / R.height,
      cw: b.width / R.width, ch: b.height / R.height,
    }
  }
  // ── 字号层级检查（不变量：小标题档 > 正文档；页面标题 > 两者）──
  // 渲染端已按语义给每行打 data-fs-role="h3|body"，这里直接按角色断言，
  // 而不是拿"最大字号元素当标题"（那种弱断言恒真，是假绿）。
  const h3 = [], bd = []
  root.querySelectorAll('[data-fs-role]').forEach(e => {
    const fs = parseFloat(getComputedStyle(e).fontSize) || 0
    if (!fs) return
    ;(e.getAttribute('data-fs-role') === 'h3' ? h3 : bd).push(fs)
  })
  let tFs = 0, tTxt = ''
  root.querySelectorAll('span,p,div').forEach(e => {
    if (e.children.length) return
    const tx = (e.textContent || '').trim()
    if (!tx) return
    let p = e, deco = false
    for (let k = 0; k < 6 && p; k++) { if (getComputedStyle(p).pointerEvents === 'none') { deco = true; break } p = p.parentElement }
    if (deco) return
    const b = e.getBoundingClientRect()
    if ((b.top - R.top) / R.height >= 0.22) return
    const fs = parseFloat(getComputedStyle(e).fontSize) || 0
    if (fs > tFs) { tFs = fs; tTxt = tx.slice(0, 14) }
  })
  const maxB = bd.length ? Math.max(...bd) : 0
  const minH = h3.length ? Math.min(...h3) : 0
  res.hierarchy = {
    titleFs: Math.round(tFs), titleTxt: tTxt,
    bodyMax: Math.round(maxB), h3Min: Math.round(minH), nH3: h3.length, nBody: bd.length,
    // 关键不变量：正文档上限 < 小标题档下限；且页面标题大于两者
    ok: (maxB && minH) ? (maxB < minH && tFs > minH) : null,
  }
  return res
}

/* ── 浏览器内解码 PNG → 48x27 灰度向量 ── */
const SIG = async (b64) => {
  const img = new Image()
  img.src = 'data:image/png;base64,' + b64
  await img.decode()
  const W = 48, H = 27
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H)
  const d = g.getImageData(0, 0, W, H).data
  const out = []
  for (let i = 0; i < d.length; i += 4) out.push(Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]))
  return out
}

const toLum = (rgb) => { const m = String(rgb).match(/(\d+)\D+(\d+)\D+(\d+)/); return m ? (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) : null }

const clickPage = (pn) => {
  const t = [...document.querySelectorAll('span,div,button,li,p')]
    .find(e => e.childElementCount === 0 && (e.textContent || '').trim() === pn)
  if (!t) return false
  let el = t
  for (let k = 0; k < 4 && el; k++) { el = el.parentElement; if (el && el.tagName === 'BUTTON') { el.click(); return true } }
  t.click(); return true
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const tok = (await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(x => localStorage.setItem('zhiwei_token', x), tok)

  const data = {}
  for (const [tag, id] of [['A', A], ['B', B]]) {
    await page.goto(`${BASE}/courseware/ppt/${id}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3500)
    const total = await page.evaluate(() => {
      const s = new Set()
      document.querySelectorAll('span,div,button,li,p').forEach(e => {
        const t = (e.textContent || '').trim()
        if (e.childElementCount === 0 && /^P\d+$/.test(t)) s.add(t)
      })
      return s.size
    })
    data[tag] = { id, total, pages: {} }
    console.log(`${tag} 共 ${total} 页`)
    for (let i = 1; i <= Math.min(total || MAXP, MAXP); i++) {
      const ok = await page.evaluate(clickPage, `P${i}`)
      if (!ok) { console.log(`  P${i} 未找到缩略图`); break }
      await page.waitForTimeout(800)
      const audit = await page.evaluate(AUDIT)
      // 只截画布元素
      const el = await page.evaluateHandle(() => [...document.querySelectorAll('div')]
        .filter(d => (d.getAttribute('style') || '').includes('aspect-ratio'))
        .sort((a, b) => b.clientWidth - a.clientWidth)[0])
      const shot = await el.asElement().screenshot()
      fs.writeFileSync(path.join(OUT, `${tag}_p${String(i).padStart(2, '0')}.png`), shot)
      const sig = await page.evaluate(SIG, shot.toString('base64'))
      data[tag].pages[i] = { audit, sig }
    }
  }
  await browser.close()

  /* ── 逐页对比 ── */
  const rows = []
  const maxP = Math.max(...Object.values(data).map(d => Object.keys(d.pages).length))
  for (let i = 1; i <= maxP; i++) {
    const a = data.A.pages[i], b = data.B.pages[i]
    if (!a || !b) { rows.push({ i, note: !a ? 'B 多一页' : 'A 多一页' }); continue }
    let sum = 0
    for (let k = 0; k < a.sig.length; k++) sum += Math.abs(a.sig[k] - b.sig[k])
    const diffPct = (sum / a.sig.length / 255 * 100)
    // 标题对比度：标题色亮度 vs 标题左侧背景像素亮度
    const bgL = (() => {
      const t = a.audit.title || b.audit.title
      if (!t) return null
      const W = 48, H = 27
      // 取样点必须落在标题**旁边**（不能取在文字上，否则量的是文字自身 → 假 0）
      // 右侧越界则退回左侧；两侧都越界则该页不测（返回 null，不当缺陷）
      const y = Math.min(H - 1, Math.max(0, Math.round((t.cy + t.ch * 0.5) * H)))
      const xr = (t.cx + t.cw + 0.03)
      const xl = (t.cx - 0.03)
      const x = xr <= 0.98 ? Math.round(xr * W) : (xl >= 0.02 ? Math.round(xl * W) : -1)
      return x < 0 ? null : a.sig[y * W + x]
    })()
    const fgL = a.audit.title ? toLum(a.audit.title.color) : null
    rows.push({
      i, diffPct,
      aOver: a.audit.overflow, aOob: a.audit.outOfBounds, aEmpty: a.audit.emptyCards,
      bOver: b.audit.overflow, bOob: b.audit.outOfBounds, bEmpty: b.audit.emptyCards,
      titleA: a.audit.title ? `${a.audit.title.text}(${a.audit.title.fs}px)` : '—',
      hierA: a.audit.hierarchy, hierB: b.audit.hierarchy,
      titleB: b.audit.title ? b.audit.title.text : '—',
      // 封面标题色是"onPrimary 压 coverBg"的设计配对，不走底带逻辑，不参与本项检查
      contrast: a.audit.isCover ? null : ((bgL != null && fgL != null) ? Math.round(Math.abs(bgL - fgL)) : null),
      overSamples: [...a.audit.overSamples, ...b.audit.overSamples].slice(0, 3),
      emptySamples: [...(a.audit.emptySamples || []), ...(b.audit.emptySamples || [])].slice(0, 3),
    })
  }

  console.log('\n页 | 像素差异 | A[溢出/越界/空卡] | B[溢出/越界/空卡] | 标题 | 标题对比度')
  console.log('---+---------+------------------+------------------+------+----------')
  for (const r of rows) {
    if (r.note) { console.log(`P${String(r.i).padStart(2)} | ${r.note}`); continue }
    console.log(
      `P${String(r.i).padStart(2)} | ${r.diffPct.toFixed(1).padStart(6)}% | ` +
      `${String(r.aOver).padStart(2)}/${String(r.aOob).padStart(2)}/${String(r.aEmpty).padStart(2)}         | ` +
      `${String(r.bOver).padStart(2)}/${String(r.bOob).padStart(2)}/${String(r.bEmpty).padStart(2)}         | ` +
      `${String(r.titleA).padEnd(16)} | ${r.contrast == null ? '-' : r.contrast}`)
  }

  const same = rows.filter(r => !r.note && r.diffPct < 1.0)
  const bad = rows.filter(r => !r.note && (r.aOver + r.bOver + r.aOob + r.bOob + r.aEmpty + r.bEmpty) > 0)
  const lowContrast = rows.filter(r => !r.note && r.contrast != null && r.contrast < 40)
  console.log(`\n===== 空卡样本（x,y,宽x高 / className）=====`)
  const emptyPages = rows.filter(r => !r.note && (r.aEmpty + r.bEmpty) > 0)
  emptyPages.slice(0, 6).forEach(r => console.log(`  P${r.i} (A${r.aEmpty}/B${r.bEmpty}): ${(r.emptySamples || []).join(' ; ')}`))
  if (!emptyPages.length) console.log('  无')

  console.log(`\n===== 字号层级（标题 vs 正文，倒挂即失败）=====`)
  const hierBad = []
  for (const r of rows) {
    if (r.note) continue
    const hA = r.hierA || {}, hB = r.hierB || {}
    const mark = (h) => (h.ok === null
      ? `n/a(h3:${h.nH3}/body:${h.nBody})`
      : `标题${h.titleFs} > 小标题${h.h3Min} > 正文${h.bodyMax} ${h.ok ? '✔' : '⚠ 倒挂'}`)
    console.log(`  P${String(r.i).padStart(2)}  A: ${mark(hA).padEnd(34)} B: ${mark(hB)}`)
    if (hA.ok === false) hierBad.push(`P${r.i}A`)
    if (hB.ok === false) hierBad.push(`P${r.i}B`)
  }
  if (!hierBad.length) console.log('  → 无倒挂 ✔')

  console.log(`\n===== 汇总 =====`)
  const misaligned = rows.filter(r => !r.note && r.titleA.replace(/\(\d+px\)$/, '') !== r.titleB)
  console.log(`标题不一致（A/B 同页不同小节，说明两版页序不同）：${misaligned.length ? misaligned.map(r => `P${r.i}「${r.titleA}」vs「${r.titleB}」`).join(' | ') : '无'}`)
  console.log(`页面数：A=${data.A.total} B=${data.B.total}  对比 ${rows.filter(r => !r.note).length} 页`)
  console.log(`几乎无差异(<1%)的页：${same.length ? same.map(r => 'P' + r.i).join(',') : '无'}`)
  console.log(`存在溢出/越界/空卡的页：${bad.length ? bad.map(r => 'P' + r.i).join(',') : '无'}`)
  console.log(`标题对比度偏低(<40)的页：${lowContrast.length ? lowContrast.map(r => `P${r.i}(${r.contrast})`).join(',') : '无'}`)
  console.log(`字号倒挂（标题 ≤ 正文）的页：${hierBad.length ? hierBad.join(',') : '无'}`)
  console.log(`截图目录：${path.relative(process.cwd(), OUT)}`)
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ rows, total: { A: data.A.total, B: data.B.total } }, null, 2))
  process.exit(bad.length === 0 && lowContrast.length === 0 ? 0 : 1)
})().catch(e => { console.error('ERR', e); process.exit(2) })
