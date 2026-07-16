/**
 * 真实验证：教案正文 Word 导出（含公式 PNG 嵌入）
 * 端到端 UI：登录 → 新建教案 → 输入含公式文本 → 点"导出教案" → 检查下载 docx 含 word/media
 * 结果写入 /tmp/lesson_result.json（避免 stdout 被吞）
 */
const { chromium } = require('playwright')
const fs = require('fs')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const OUT = '/tmp/lesson_result.json'
const log = (o) => fs.writeFileSync(OUT, JSON.stringify(o, null, 2))

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ acceptDownloads: true, ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message)))

  try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await page.fill('input[placeholder="请输入手机号"]', PHONE)
    await page.fill('input[placeholder="请输入密码"]', PASS)
    await page.click('button[type=submit]')
    await page.waitForTimeout(1800)

    await page.goto(BASE + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)

    // 轮询等待 LessonPlanEditor 组件渲染（大 chunk 在 HTTP staging 下加载较慢）
    let rendered = false
    for (let i = 0; i < 25; i++) {
      const t = await page.evaluate(() => (document.body ? document.body.innerText : ''))
      if (t && t.length > 30) { rendered = true; break }
      await page.waitForTimeout(1000)
    }

    const docBtn = page.locator('button', { hasText: '文档模式' })
    if (await docBtn.count() > 0) { await docBtn.first().click(); await page.waitForTimeout(1500) }

    const diag = {
      url: page.url(),
      rendered,
      pmCount: await page.locator('.ProseMirror').count(),
      hasDocBtn: await docBtn.count(),
      bodyText: (await page.evaluate(() => document.body ? document.body.innerText : '')).slice(0, 300),
    }
    fs.writeFileSync('/tmp/lesson_diag.json', JSON.stringify(diag, null, 2))

    const pm = page.locator('.ProseMirror')
    await pm.first().waitFor({ timeout: 10000 })
    await pm.first().click()
    await page.keyboard.type('公式验证 $E=mc^2$ 与化学式 $\\ce{H2O}，块级积分 $$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$')
    await page.waitForTimeout(1000)

    const exportBtn = page.locator('button', { hasText: '导出教案' })
    await exportBtn.first().waitFor({ timeout: 5000 })
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      exportBtn.first().click(),
    ])
    const path = await dl.path()
    const buf = fs.readFileSync(path)
    const txt = buf.toString('latin1')
    log({
      ok: txt.includes('word/media'),
      fileName: dl.suggestedFilename(),
      size: buf.length,
      hasMedia: txt.includes('word/media'),
      pageErrors: errors,
    })
  } catch (e) {
    log({ ok: false, error: String(e), pageErrors: errors })
  } finally {
    await browser.close()
  }
})()
