/**
 * 公式编辑器深度验证 v3（真点击 + 视觉量化）
 * 修复用户反馈的两个核心问题：
 *  1) 行内公式上半截空白 → 量化：container.top 与 katex.top 之差 / container.height 应 < 30%
 *  2) 行内公式首次点不中、没手柄/编辑/删除图标 → 真点击后查 data-formula-handle 子元素数
 */
const { chromium } = require('playwright')
const fs = require('fs')

const BASE = process.env.BASE || 'https://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const OUT = '/tmp/frames_v3'
fs.mkdirSync(OUT, { recursive: true })
const out = []
const w = (s) => { out.push(s); fs.writeFileSync(OUT + '/report.txt', out.join('\n')); console.log(s) }
const shot = async (p, n) => { try { await p.screenshot({ path: OUT + '/' + n }) } catch {}; w('  📸 ' + OUT + '/' + n) }
const api = (path, opts = {}) => fetch(BASE + path, opts).then(r => r.json().catch(() => ({})))

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } })
  const errs = []
  p.on('pageerror', e => errs.push('[pageerror] ' + (e.stack || e.message)))
  p.on('console', m => { if (m.type() === 'error') errs.push('[c.err] ' + m.text()) })

  const login = await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: PHONE, password: PASS }) })
  const token = login.token
  w('=== TOKEN ' + (token ? 'OK' : 'FAIL ' + JSON.stringify(login)) + ' ===')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  await p.addInitScript(t => { if (t) localStorage.setItem('zhiwei_token', t) }, token)

  // 文档结构：先放一块级公式空间，再在文字中放行内公式
  const MD = '# 公式交互验证\n\n在文本中放行内化学式，将一张 2H₂+O₂→2H₂O 纸对折一次。\n\n块级公式独立显示：\n'
  const plan = await api('/api/lesson-plans', { method: 'POST', headers: H, body: JSON.stringify({ title: '公式交互验证', subject: '数学', grade: '八年级', content: MD }) })
  const id = plan.id
  w('=== 新建 id=' + id + ' ===')
  if (!id) { w('FATAL ' + JSON.stringify(plan)); await b.close(); return }

  const formulaBtn = 'button[title="插入数学公式（图片式容器）"]'
  const chemBtn = 'button[title="插入化学式（图片式容器）"]'
  const openPlan = async () => { await p.goto(BASE + '/lesson-plans/' + id + '/edit?mode=doc', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.ProseMirror', { timeout: 30000 }); await p.waitForTimeout(1500) }

  // 量化"上半截空白"：对每个公式测 container 与内部 .katex 的 box，看 katex.top 离 container.top 多远
  // 返回 { latex, wrap, container, katex, topGapPct }  topGapPct = (katex.top - container.top) / container.height
  // 理想值 ≈ 0（katex 紧贴顶部），旧 bug ≈ 0.5（katex 掉到下半截）
  const measureFormula = async (idx) => p.evaluate((i) => {
    const all = document.querySelectorAll('.ProseMirror .formula-box-container')
    const el = all[i]; if (!el) return null
    const cb = el.getBoundingClientRect()
    const katex = el.querySelector('.katex')
    const kb = katex ? katex.getBoundingClientRect() : null
    return {
      latex: el.getAttribute('data-latex'),
      wrap: el.getAttribute('data-wrap'),
      container: { x: cb.x, y: cb.y, w: cb.width, h: cb.height },
      katex: kb ? { x: kb.x, y: kb.y, w: kb.width, h: kb.height } : null,
      topGapPct: kb ? (kb.y - cb.y) / cb.height : null,
      selected: !!el.querySelector('[data-formula-handle]'),
    }
  }, idx).catch(e => 'ERR:' + e.message)

  // 查编辑器中所有公式的"上半截空白"指标
  const measureAll = async () => p.evaluate(() => {
    const all = document.querySelectorAll('.ProseMirror .formula-box-container')
    return Array.from(all).map((el, i) => {
      const cb = el.getBoundingClientRect()
      const katex = el.querySelector('.katex')
      const kb = katex ? katex.getBoundingClientRect() : null
      return {
        i, wrap: el.getAttribute('data-wrap'), latex: el.getAttribute('data-latex'),
        containerH: cb.height, katexH: kb ? kb.height : null,
        topGap: kb ? Math.round(kb.y - cb.y) : null,
        topGapPct: kb ? +((kb.y - cb.y) / cb.height).toFixed(3) : null,
        selected: !!el.querySelector('[data-formula-handle]'),
      }
    })
  })

  await openPlan()

  // ---- 1. 插入行内化学式（点文档中间，把光标放进去，插入行内化学式）----
  w('=== 1) 插入行内化学式 2H2+O2->2H2O ===')
  const p1box = await p.locator('.ProseMirror p').first().boundingBox()
  await p.mouse.click(p1box.x + 80, p1box.y + p1box.height / 2) // 文字中"将一张 "后
  await p.waitForTimeout(300)
  await p.locator(chemBtn).click()
  await p.waitForSelector('textarea.font-mono', { timeout: 8000 })
  await p.locator('textarea.font-mono').click()
  await p.locator('textarea.font-mono').fill('2H_{2} + O_{2} \\rightarrow 2H_{2}O')
  await p.locator('button', { hasText: '行内字间' }).click()
  await p.waitForTimeout(200)
  await p.locator('button', { hasText: '插入到文档' }).click()
  await p.waitForTimeout(1200)

  // ---- 2. 插入块级数学公式（点文档底部空白处，插入块级）----
  w('=== 2) 插入块级数学公式 a^2+b^2=c^2 ===')
  // 滚到底部，点最后一段
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await p.waitForTimeout(300)
  const lastP = p.locator('.ProseMirror p').last()
  const lpbox = await lastP.boundingBox()
  await p.mouse.click(lpbox.x + 20, lpbox.y + lpbox.height / 2)
  await p.waitForTimeout(300)
  await p.locator(formulaBtn).click()
  await p.waitForSelector('textarea.font-mono', { timeout: 8000 })
  await p.locator('textarea.font-mono').click()
  await p.locator('textarea.font-mono').fill('a^{2} + b^{2} = c^{2}')
  await p.locator('button', { hasText: '插入到文档' }).click()
  await p.waitForTimeout(1200)

  await p.evaluate(() => window.scrollTo(0, 0))
  await p.waitForTimeout(300)
  await shot(p, '01_two_formulas.png')
  w('  两个公式均插入后量化指标：')
  w('  ' + JSON.stringify(await measureAll(), null, 2))

  // ---- 3. 关键测试：真点击【行内公式】，检查手柄/编辑/删除图标是否出现 ----
  w('=== 3) 真点击行内化学式，检查手柄/编辑/删除图标 ===')
  // 找到行内公式（wrap=inline）的元素
  const inlineEl = p.locator('.formula-box-container[data-wrap="inline"]').first()
  const inlineBox = await inlineEl.boundingBox()
  // 点击行内公式的几何中心
  await p.mouse.click(inlineBox.x + inlineBox.width / 2, inlineBox.y + inlineBox.height / 2)
  await p.waitForTimeout(800) // 等 React 重渲染
  await shot(p, '02_after_click_inline.png')
  const inlineState = await p.evaluate(() => {
    const el = document.querySelector('.formula-box-container[data-wrap="inline"]')
    if (!el) return 'NO_INLINE'
    const handles = el.querySelectorAll('[data-formula-handle]')
    const editBtn = el.querySelector('button[title="编辑公式"]')
    const delBtn = el.querySelector('button[title="删除该公式"]')
    return { handleCount: handles.length, hasEditBtn: !!editBtn, hasDeleteBtn: !!delBtn }
  })
  w('  点击行内后：' + JSON.stringify(inlineState))

  // ---- 4. 真点击【块级公式】，检查手柄/编辑/删除图标 ----
  w('=== 4) 真点击块级数学公式，检查手柄/编辑/删除图标 ===')
  const blockEl = p.locator('.formula-box-container[data-wrap="block"]').first()
  const blockBox = await blockEl.boundingBox()
  await p.mouse.click(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2)
  await p.waitForTimeout(800)
  await shot(p, '03_after_click_block.png')
  const blockState = await p.evaluate(() => {
    const el = document.querySelector('.formula-box-container[data-wrap="block"]')
    if (!el) return 'NO_BLOCK'
    const handles = el.querySelectorAll('[data-formula-handle]')
    const editBtn = el.querySelector('button[title="编辑公式"]')
    const delBtn = el.querySelector('button[title="删除该公式"]')
    return { handleCount: handles.length, hasEditBtn: !!editBtn, hasDeleteBtn: !!delBtn }
  })
  w('  点击块级后：' + JSON.stringify(blockState))

  // ---- 5. 验证：上半截空白指标（topGapPct）应 < 0.30（行内公式）----
  w('=== 5) 视觉验证：行内公式 topGapPct ===')
  const measures = await measureAll()
  for (const m of measures) {
    if (m.wrap === 'inline') {
      const ok = m.topGapPct !== null && m.topGapPct < 0.30
      w('  行内 [' + m.latex.slice(0, 30) + '] topGap=' + m.topGap + 'px / containerH=' + m.containerH + 'px → topGapPct=' + m.topGapPct + (ok ? ' ✅' : ' ❌ 仍有过大空白'))
    } else if (m.wrap === 'block') {
      w('  块级 [' + m.latex.slice(0, 30) + '] topGapPct=' + m.topGapPct + '（块级不要求贴顶，居中即可）')
    }
  }

  // ---- 6. 点击编辑按钮应打开编辑对话框 ----
  w('=== 6) 点击编辑按钮，验证打开编辑对话框 ===')
  await p.locator('.formula-box-container[data-wrap="inline"]').first().click()
  await p.waitForTimeout(500)
  const editBtnExists = await p.locator('button[title="编辑公式"]').count()
  if (editBtnExists > 0) {
    await p.locator('button[title="编辑公式"]').first().click()
    await p.waitForTimeout(800)
    const dialogOpen = await p.locator('text=编辑数学公式').count() > 0 || await p.locator('textarea.font-mono').count() > 0
    w('  点击行内"编辑公式"按钮后对话框打开=' + dialogOpen + (dialogOpen ? ' ✅' : ' ❌'))
    await shot(p, '04_edit_dialog.png')
    // 关闭
    await p.keyboard.press('Escape').catch(() => {})
    await p.waitForTimeout(300)
  }

  w('=== 错误 ===')
  w(errs.length ? errs.join('\n') : '(无)')
  await api('/api/lesson-plans/' + id, { method: 'DELETE', headers: H }).then(() => w('=== 清理 OK ==='))
  await b.close(); w('DONE')
})().catch(e => { console.error('FATAL', e); process.exit(1) })
