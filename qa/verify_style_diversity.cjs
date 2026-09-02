// 课件风格多样化 E2E 专项验证（真浏览器）
// 目的：
//   A) H5 课件「宽/窄视图自适应」——在 1440(投屏) / 768(平板) / 390(手机) 三档宽度下
//      测量 .story-root 与 .scene 的实际尺寸、内边距、字号与是否横向溢出。
//   B) PPT 课件「版式多样性」——逐页抓取页面结构签名，统计一份课件里出现了几种不同版式。
// 用法：BASE=http://school1.ziwi.cn node qa/verify_style_diversity.cjs
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const SHOT_DIR = process.env.SHOT_DIR || path.join(__dirname, 'shots_style_diversity')

const H5_SAMPLES = (process.env.H5_IDS || '').split(',').filter(Boolean)
const PPT_SAMPLES = (process.env.PPT_IDS || '').split(',').filter(Boolean)

const results = []
const rec = (id, ok, detail) => {
  results.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`)
}

;(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(e.message))

  // ── 登录（Node 侧取 token 注入，避开脆弱的 UI 表单）──
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const j = await r.json()
  const token = j.token || (j.data && j.data.token)
  if (!token) { console.log('LOGIN_FAIL', JSON.stringify(j)); process.exit(1) }

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), token)

  // ══════════ A) H5 宽窄自适应 ══════════
  for (const id of H5_SAMPLES) {
    const url = `${BASE}/courseware/h5/${id}`
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    if (page.url().includes('/login')) { rec(`H5-${id.slice(0, 8)}-ENTER`, false, '被重定向到登录页'); continue }

    // H5 预览可能在 iframe 内，统一取「包含 .story-root 的文档」
    const hasStory = async () => page.evaluate(() => {
      if (document.querySelector('.story-root')) return 'main'
      for (const f of document.querySelectorAll('iframe')) {
        try { if (f.contentDocument && f.contentDocument.querySelector('.story-root')) return 'iframe' } catch {}
      }
      return null
    })
    let where = await hasStory()
    if (!where) {
      // 尝试点「预览」
      for (const label of ['预览', 'H5 预览', '播放']) {
        const b = page.locator(`button:has-text("${label}")`).first()
        if (await b.count() > 0 && await b.isVisible().catch(() => false)) {
          await b.click().catch(() => {})
          await page.waitForTimeout(2500)
          where = await hasStory()
          if (where) break
        }
      }
    }
    rec(`H5-${id.slice(0, 8)}-RENDER`, !!where, where ? `H5 渲染于 ${where}` : '未找到 .story-root（可能未进入预览）')
    if (!where) continue

    const measure = () => page.evaluate((w) => {
      const pick = (sel) => {
        if (document.querySelector(sel)) return document.querySelector(sel)
        for (const f of document.querySelectorAll('iframe')) {
          try { const d = f.contentDocument; if (d && d.querySelector(sel)) return d.querySelector(sel) } catch {}
        }
        return null
      }
      const num = (v) => Math.round(parseFloat(v) || 0)
      const root = pick('.story-root')
      const scene = pick('.scene.active') || pick('.scene')
      if (!root) return null
      const cs = getComputedStyle(root)
      const sc = scene ? getComputedStyle(scene) : null
      const docW = (() => {
        for (const f of document.querySelectorAll('iframe')) {
          try { if (f.contentDocument && f.contentDocument.querySelector('.story-root')) return f.contentDocument.documentElement.clientWidth } catch {}
        }
        return document.documentElement.clientWidth
      })()
      return {
        viewport: w,
        docW,
        rootW: root.getBoundingClientRect().width,
        rootMaxW: cs.maxWidth,
        rootOverflowX: root.scrollWidth > root.clientWidth + 1,
        sceneW: scene ? scene.getBoundingClientRect().width : null,
        scenePadLeft: sc ? num(sc.paddingLeft) : null,
        scenePadRight: sc ? num(sc.paddingRight) : null,
        sceneMinH: sc ? num(sc.minHeight) : null,
        titleFont: (() => { const t = (scene || root).querySelector('.scene-title'); return t ? num(getComputedStyle(t).fontSize) : null })(),
        bodyFont: (() => { const t = (scene || root).querySelector('.narration,.bubble-text'); return t ? num(getComputedStyle(t).fontSize) : null })(),
      }
    }, w => w)

    const widths = [1440, 768, 390]
    const rows = []
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 900 })
      await page.waitForTimeout(800)
      const m = await page.evaluate((ww) => {
        const pick = (sel) => {
          if (document.querySelector(sel)) return document.querySelector(sel)
          for (const f of document.querySelectorAll('iframe')) {
            try { const d = f.contentDocument; if (d && d.querySelector(sel)) return d.querySelector(sel) } catch {}
          }
          return null
        }
        const num = (v) => Math.round(parseFloat(v) || 0)
        const root = pick('.story-root')
        const scene = pick('.scene.active') || pick('.scene')
        if (!root) return null
        const cs = getComputedStyle(root)
        const sc = scene ? getComputedStyle(scene) : null
        let docW = document.documentElement.clientWidth
        for (const f of document.querySelectorAll('iframe')) {
          try { if (f.contentDocument && f.contentDocument.querySelector('.story-root')) docW = f.contentDocument.documentElement.clientWidth } catch {}
        }
        return {
          viewport: ww, docW,
          rootW: Math.round(root.getBoundingClientRect().width),
          rootMaxW: cs.maxWidth,
          rootOverflowX: root.scrollWidth > root.clientWidth + 1,
          sceneW: scene ? Math.round(scene.getBoundingClientRect().width) : null,
          scenePadL: sc ? num(sc.paddingLeft) : null,
          scenePadR: sc ? num(sc.paddingRight) : null,
          sceneMinH: sc ? num(sc.minHeight) : null,
          titleFont: (() => { const t = (scene || root).querySelector('.scene-title'); return t ? num(getComputedStyle(t).fontSize) : null })(),
        }
      }, w)
      rows.push(m)
      await page.screenshot({ path: path.join(SHOT_DIR, `h5_${id.slice(0, 8)}_w${w}.png`), fullPage: false })
    }

    console.log(`\n  [H5 ${id.slice(0, 8)}] 三档宽度实测：`)
    console.log('  视口 | 文档宽 | root宽 | root.maxW | scene宽 | 左右内边距 | scene最小高 | 标题字号')
    for (const m of rows) {
      if (!m) continue
      console.log(`  ${String(m.viewport).padStart(4)} | ${String(m.docW).padStart(6)} | ${String(m.rootW).padStart(6)} | ${String(m.rootMaxW).padStart(9)} | ${String(m.sceneW).padStart(7)} | ${String(m.scenePadL).padStart(4)}/${String(m.scenePadR).padEnd(4)} | ${String(m.sceneMinH).padStart(11)} | ${String(m.titleFont).padStart(8)}`)
    }

    // 判定：三档宽度下「布局是否真的变化」
    const valid = rows.filter(Boolean)
    if (valid.length === 3) {
      const pads = new Set(valid.map(v => `${v.scenePadL}/${v.scenePadR}`))
      const fonts = new Set(valid.map(v => v.titleFont))
      const ratio = valid.map(v => (v.sceneW / v.docW).toFixed(3))
      const adaptive = pads.size > 1 || fonts.size > 1
      rec(`H5-${id.slice(0, 8)}-ADAPTIVE`, adaptive,
        adaptive
          ? `有自适应：内边距档=${[...pads].join(',')} 标题字号档=${[...fonts].join(',')}`
          : `无自适应：三档宽度下内边距(${[...pads][0]})与标题字号(${[...fonts][0]})完全相同，仅按 max-width 等比缩放；scene/文档宽比=${ratio.join(' → ')}`)
      const anyOverflow = valid.some(v => v.rootOverflowX)
      rec(`H5-${id.slice(0, 8)}-OVERFLOW`, !anyOverflow,
        anyOverflow ? `存在横向溢出（窄屏内容超出容器）` : `三档宽度均无横向溢出`)
    }
    await page.setViewportSize({ width: 1440, height: 900 })
  }

  // ══════════ B) PPT 版式多样性 ══════════
  for (const id of PPT_SAMPLES) {
    await page.goto(`${BASE}/courseware/ppt/${id}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    if (page.url().includes('/login')) { rec(`PPT-${id.slice(0, 8)}-ENTER`, false, '被重定向到登录页'); continue }

    // 逐页采集「结构签名」：页面内元素的类名集合（忽略具体内容差异）
    const signatures = []
    const MAXPAGES = 20
    for (let i = 0; i < MAXPAGES; i++) {
      const sig = await page.evaluate(() => {
        // 预览画布：优先取含 data-layout / 幻灯片容器
        const cands = Array.from(document.querySelectorAll('[data-layout], .slide, .ppt-slide, [class*="slide"]'))
        if (!cands.length) return null
        const el = cands.find(e => e.getBoundingClientRect().width > 100) || cands[0]
        const cls = (el.className || '').toString()
        const layout = el.getAttribute('data-layout') || (cls.match(/layout-[\w-]+/i) || [null])[0] || null
        // 内部块结构：直接子元素的类名序列
        const kids = Array.from(el.children).map(c => (c.className || '').toString().split(' ')[0]).filter(Boolean)
        return { layout, cls: cls.slice(0, 120), kids: kids.slice(0, 8).join('>') }
      })
      if (!sig) break
      signatures.push(sig)
      await page.screenshot({ path: path.join(SHOT_DIR, `ppt_${id.slice(0, 8)}_p${i}.png`) })
      // 下一页
      const next = page.locator('button:has-text("下一页")').first()
      if (await next.count() === 0 || !(await next.isVisible().catch(() => false))) break
      const disabled = await next.isDisabled().catch(() => true)
      if (disabled) break
      await next.click().catch(() => {})
      await page.waitForTimeout(450)
    }

    if (!signatures.length) {
      rec(`PPT-${id.slice(0, 8)}-PAGES`, false, '未采集到幻灯片页（可能未进入预览/选择器需更新）')
      continue
    }
    const uniq = new Set(signatures.map(s => `${s.layout || '?'} | ${s.kids}`))
    const layouts = signatures.map(s => s.layout).filter(Boolean)
    const uniqLayouts = [...new Set(layouts)]
    console.log(`\n  [PPT ${id.slice(0, 8)}] 共 ${signatures.length} 页，版式标注：${uniqLayouts.join(', ') || '(无 data-layout 属性)'}`)
    console.log(`  去重后结构签名 ${uniq.size} 种：`)
    for (const u of uniq) console.log(`    - ${u}`)
    rec(`PPT-${id.slice(0, 8)}-LAYOUT_DIVERSITY`, uniq.size >= 3,
      `${signatures.length} 页中出现 ${uniq.size} 种不同版式结构（阈值≥3 视为多样化）`)
  }

  await browser.close()

  const fail = results.filter(r => !r.ok)
  console.log(`\n==== 汇总: ${results.length - fail.length} PASS / ${fail.length} FAIL / 共 ${results.length} ====`)
  console.log(`截图目录: ${SHOT_DIR}`)
  if (pageErrors.length) console.log(`页面异常 ${pageErrors.length} 条: ${pageErrors.slice(0, 3).join(' | ')}`)
  process.exit(fail.length ? 1 : 0)
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(2) })
