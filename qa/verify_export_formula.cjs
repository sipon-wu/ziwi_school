/**
 * 真实验证：公式导出一致性（教案+试卷 × Word+PDF）
 * 验证：
 *  - Word：公式经 html-to-image 截图成 PNG 嵌入 docx（检查 word/media）
 *  - PDF：打印窗口注入 KaTeX CSS + 公式渲染为 .katex HTML
 * 实现说明（重要）：
 *  1) 生产包中 exportDocx 是共享 chunk，其命名导出被 Rollup minify 成别名，
 *     exportLessonPlanToDocx 原名在生产包里不存在，无法用 import() 按原名取出。
 *     故教案 Word 段走真实 UI（登录→新建→输公式→点"导出教案"→校验下载 docx 的 word/media）。
 *  2) 试卷 Word / 两 PDF 仍用直接 import() 调用其导出名（exportExamPaper / printLessonPlan /
 *     printExamPaper），但**不再硬编码 chunk 文件名带 hash**——改为运行时从入口 HTML 动态探测
 *     含目标导出名的 chunk，消除"按名 import 生产 chunk"对 minify 导出名/hash 的脆弱依赖。
 *     若某导出名被 minify 掉（字面量消失），探测会返回 null 并明确 FAIL，而非静默假绿。
 * 可覆盖：BASE / PHONE / PASS 均支持环境变量（与仓库约定一致），默认打 staging。
 */
const { chromium } = require('playwright')
const fs = require('fs')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

function blobToBase64() { /* placeholder, runs in browser */ }

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({ acceptDownloads: true, ignoreHTTPSErrors: true })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message))

  await page.goto(BASE, { waitUntil: 'networkidle' })

  // 动态探测目标导出所在的 chunk（根治硬编码 hash）：
  // 1) 根 HTML 引用当前入口 index chunk（hash 随 build 变，但始终被 HTML 引用，稳定可解析）；
  // 2) 入口 chunk 的 __vite__mapDeps 内联了所有懒加载 chunk 的真实文件名（注意：文件名不带前导 /）；
  // 3) 从这些文件名里逐个 fetch，精确匹配"导出定义"（` as exportExamPaper` / ` as printLessonPlan`），
  //    避免误命中仅引用字面量的调用方 chunk（如 Materials）。
  // 若导出名被 Rollup minify 掉（字面量消失），探测返回 null → 下方明确 FAIL，不会静默假绿。
  const CHUNKS = await page.evaluate(async () => {
    const html = await (await fetch('/')).text()
    const idx = (html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0]
    if (!idx) return {}
    const indexJs = await (await fetch(idx)).text()
    const assets = [...new Set([...indexJs.matchAll(/assets\/[A-Za-z0-9_-]+\.js/g)].map((m) => '/' + m[0]))]
    const out = {}
    for (const a of assets) {
      let js = ''
      try { js = await (await fetch(a)).text() } catch { continue }
      if (/ as exportExamPaper/.test(js)) out.exportExamDocx = a
      if (/ as printLessonPlan/.test(js)) out.printPdf = a
    }
    return out
  })
  if (!CHUNKS.exportExamDocx || !CHUNKS.printPdf) {
    console.error('FAIL 动态探测找不到导出 chunk，结果=' + JSON.stringify(CHUNKS) +
      '（导出名可能被 Rollup minify，需改为真实 UI 路径）')
    process.exit(1)
  }

  const results = {}

  // 1) 教案 Word 导出（含块级/行内/化学式）—— 走真实 UI（共享 chunk 导出名被 minify，无法直接 import 取出）
  try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await page.fill('input[placeholder="请输入手机号"]', PHONE)
    await page.fill('input[placeholder="请输入密码"]', PASS)
    await page.click('button[type=submit]')
    await page.waitForTimeout(1500)

    await page.goto(BASE + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })
    let rendered = false
    for (let i = 0; i < 25; i++) {
      const t = await page.evaluate(() => (document.body ? document.body.innerText : ''))
      if (t && t.length > 30) { rendered = true; break }
      await page.waitForTimeout(1000)
    }
    const docTab = page.locator('button', { hasText: '文档模式' })
    if (await docTab.count() > 0) { await docTab.first().click(); await page.waitForTimeout(1200) }

    const pm = page.locator('.ProseMirror').first()
    await pm.waitFor({ timeout: 10000 })
    await pm.click()
    await page.keyboard.type('公式验证 $E=mc^2$ 与化学式 $\\ce{H2O}，块级积分 $$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$', { delay: 3 })
    await page.waitForTimeout(800)

    const exportBtn = page.locator('button', { hasText: '导出教案' })
    let hasMedia = false, fileName = '', err = ''
    if (await exportBtn.count() > 0) {
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        exportBtn.first().click(),
      ])
      const fpath = await dl.path()
      fileName = dl.suggestedFilename()
      const buf = fs.readFileSync(fpath)
      hasMedia = buf.toString('latin1').includes('word/media')
    } else { err = '未找到导出教案按钮' }
    results.lessonDocx = { hasMedia, fileName, err, rendered }
  } catch (e) { results.lessonDocx = { error: String(e) } }

  // 2) 试卷 Word 导出（题干/选项含公式）
  try {
    const b64 = await page.evaluate(async (url) => {
      const m = await import(url)
      const blob = await m.exportExamPaper(
        [
          { id: 1, type: 'choice', content: '已知 $E=mc^2$，光速 $c=3\\times10^8$，求能量', options: ['A. $9\\times10^{16}m$', 'B. $3\\times10^8$', 'C. $\\ce{H2O}$', 'D. 0'], answer: 'A', difficulty: '中' },
          { id: 2, type: 'calculation', content: '计算 $\\sqrt{16} + \\frac{1}{2}$', options: [], answer: '4.5', difficulty: '易' },
        ],
        { subject: '物理', grade: '九年级', title: '公式验证试卷', difficulty: '中', teacherName: '测试', totalScore: 100 }
      )
      const buf = await blob.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let bin = ''
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
      return btoa(bin)
    }, CHUNKS.exportExamDocx)
    const txt = Buffer.from(b64, 'base64').toString('latin1')
    results.examDocx = { size: b64.length, hasMedia: txt.includes('word/media'), hasPng: txt.includes('media/image') }
  } catch (e) { results.examDocx = { error: String(e) } }

  // 3) 教案 PDF 打印（popup 窗口检查 KaTeX CSS + 渲染）
  try {
    const popup = await Promise.all([
      page.waitForEvent('popup', { timeout: 8000 }),
      page.evaluate(async (url) => {
        const m = await import(url)
        m.printLessonPlan('# 测试\n公式 $E=mc^2$ 与 $\\ce{H2O}$', { subject: '物理', grade: '九年级', title: 'PDF验证', teacherName: '测试' })
      }, CHUNKS.printPdf),
    ]).then((r) => r[0])
    await popup.waitForTimeout(900)
    const phtml = await popup.content()
    results.lessonPdf = { hasKatexCss: phtml.includes('/katex/katex.min.css'), hasKatex: phtml.includes('class="katex') || phtml.includes('katex-block') }
    await popup.close()
  } catch (e) { results.lessonPdf = { error: String(e) } }

  // 4) 试卷 PDF 打印
  try {
    const popup = await Promise.all([
      page.waitForEvent('popup', { timeout: 8000 }),
      page.evaluate(async (url) => {
        const m = await import(url)
        m.printExamPaper(
          [{ id: 1, type: 'choice', content: '求 $\\ce{H2O}$ 分子量', options: ['A. 18', 'B. 20'], answer: 'A', difficulty: '易' }],
          { subject: '化学', grade: '九年级', title: 'PDF公式验证', difficulty: '易', teacherName: '测试' }
        )
      }, CHUNKS.printPdf),
    ]).then((r) => r[0])
    await popup.waitForTimeout(900)
    const phtml = await popup.content()
    results.examPdf = { hasKatexCss: phtml.includes('/katex/katex.min.css'), hasKatex: phtml.includes('class="katex') || phtml.includes('katex-inline') }
    await popup.close()
  } catch (e) { results.examPdf = { error: String(e) } }

  await browser.close()

  console.log('=== 公式导出真实验证结果 ===')
  console.log(JSON.stringify(results, null, 2))
  console.log('=== 控制台错误 ===')
  console.log(errors.length ? errors.join('\n') : '(无)')

  // 教案 Word 由真实 UI 点击导出校验（共享 chunk 导出名被 minify，无法直接 import 取出）
  const ok =
    results.lessonDocx?.hasMedia &&
    results.examDocx?.hasMedia &&
    results.lessonPdf?.hasKatexCss && results.lessonPdf?.hasKatex &&
    results.examPdf?.hasKatexCss && results.examPdf?.hasKatex
  console.log('\n总判定(教案Word+试卷Word+教案/试卷PDF):', ok ? 'PASS ✅' : 'FAIL ❌')
  process.exit(ok ? 0 : 1)
})()
