// 全面视觉检查：插入+截图+分析
const { chromium } = require('playwright')
const fs = require('fs')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

  const lr = await page.request.post('http://school1.ziwi.cn/api/auth/login', { data: { phone: '13800000002', password: 'teacher123' } })
  const { token } = await lr.json()
  await page.goto('http://school1.ziwi.cn/login')
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), token)
  await page.goto('http://school1.ziwi.cn/lesson-plans/lp_681dff3a6a7b/edit?mode=doc', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  // 截图：初始状态
  await page.screenshot({ path: '/tmp/check_00_initial.png', fullPage: true })

  async function insert(templateLabel, wrapType) {
    await page.locator('button[title*="插入数学公式"]').first().click()
    await page.waitForSelector('textarea.font-mono')
    await page.waitForTimeout(300)
    await page.locator(`button:has-text("${templateLabel}")`).first().click()
    await page.waitForTimeout(200)
    const wb = { 'block': '上下环绕（块级）', 'float-left': '四周环绕·左', 'float-right': '四周环绕·右', 'inline': '行内字间（行内）' }[wrapType]
    await page.locator(`button:has-text("${wb}")`).click()
    await page.waitForTimeout(300)
    await page.locator('button:has-text("插入到文档"), button:has-text("保存修改")').first().click()
    await page.waitForTimeout(1000)
  }

  // 逐一插入并截图
  await insert('希腊', 'inline')
  await page.screenshot({ path: '/tmp/check_01_inline.png', fullPage: true })
  await insert('勾股定理', 'float-right')
  await page.screenshot({ path: '/tmp/check_02_float_right.png', fullPage: true })
  await insert('分数', 'float-left')
  await page.screenshot({ path: '/tmp/check_03_all_inserted.png', fullPage: true })

  // 检查所有容器的视觉状态
  const containerAnalysis = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('.formula-box-container'))
    return containers.map((el, i) => {
      const r = el.getBoundingClientRect()
      const wrap = el.getAttribute('data-wrap')
      // 内层 border span
      const innerSpan = el.querySelector('span[class*="border"]')
      const innerRect = innerSpan?.getBoundingClientRect()
      // SVG 图标
      const svgs = el.querySelectorAll('svg')
      const lucideIcons = Array.from(svgs).map(s => s.outerHTML.substring(0, 100))
      // 控制点
      const handles = el.querySelectorAll('span[data-formula-handle]')
      const toolbar = el.querySelector('div[data-formula-handle]')
      return {
        i, wrap,
        pos: { x: Math.round(r.x), y: Math.round(r.y) },
        size: { w: Math.round(r.width), h: Math.round(r.height) },
        // 内层 vs 外层宽度比（1.0=紧贴内容, >1.3=有空白）
        widthRatio: innerRect ? (r.width / innerRect.width).toFixed(2) : 'N/A',
        svgCount: svgs.length,
        handleCount: handles.length,
        hasToolbar: !!toolbar,
        zIndex: getComputedStyle(el).zIndex,
        // 内层是否有 KaTeX
        hasKatex: !!el.querySelector('.katex'),
      }
    })
  })
  console.log('=== 容器分析 ===')
  console.log(JSON.stringify(containerAnalysis, null, 2))

  // 逐一点击选中
  for (const w of ['inline', 'float-right', 'float-left']) {
    const sel = `.formula-box-container[data-wrap="${w}"]`
    const loc = page.locator(sel).first()
    const count = await loc.count()
    if (count === 0) { console.log(`[${w}] MISSING - 未找到`); continue }
    await loc.scrollIntoViewIfNeeded()
    await loc.click({ position: { x: 20, y: 15 } })
    await page.waitForTimeout(400)
    const h = await page.locator(`${sel} span[data-formula-handle]`).count()
    const t = await page.locator(`${sel} div[data-formula-handle]`).count()
    const s = await page.locator(`${sel} svg`).count()
    console.log(`[${w}] handles=${h}(期望8) toolbar=${t}(期望1) svgs=${s}(期望≥2)`)
  }

  // 最终截图 - 选中 float-left 时的视觉状态
  await page.screenshot({ path: '/tmp/check_04_selected_final.png', fullPage: true })

  console.log('=== 错误 ===')
  console.log(errors.length ? errors.join('\n') : '无')
  await browser.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
