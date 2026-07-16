const { chromium } = require('playwright')
const fs = require('fs')
const out = []
const w = (s) => { out.push(s); fs.writeFileSync('/tmp/modes_result.txt', out.join('\n')) }
const BASE = 'http://school1.ziwi.cn'
const TOKEN = process.env.TOKEN || ''

async function openAndInsert(page, latex, wrapLabel) {
  await page.click('button[title="插入数学公式（图片式容器）"]')
  await page.waitForTimeout(500)
  const ta = page.locator('div.fixed.inset-0 textarea').first()
  await ta.click()
  await ta.fill(latex)
  await page.waitForTimeout(200)
  await page.click(`div.fixed.inset-0 button:has-text("${wrapLabel}")`)
  await page.waitForTimeout(150)
  await page.click('div.fixed.inset-0 button:has-text("插入到文档")')
  await page.waitForTimeout(600)
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  page.on('pageerror', e => w('[pageerror] ' + e.message))
  await page.addInitScript((t) => { if (t) localStorage.setItem('zhiwei_token', t) }, TOKEN)

  await page.goto(BASE + '/lesson-plans/lp_681dff3a6a7b/edit?mode=doc', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ProseMirror', { timeout: 25000 })
  w('=== existing editor mounted ===')

  await openAndInsert(page, 'x^{2}', '行内字间（行内）')
  let wraps = await page.$$eval('.ProseMirror [data-wrap]', els => els.map(e => e.getAttribute('data-wrap'))).catch(() => 'ERR')
  w('after inline, wraps: ' + JSON.stringify(wraps))
  w('inline katex: ' + await page.$$eval('.ProseMirror [data-wrap="inline"] .katex', e => e.length).catch(() => 'ERR'))

  await openAndInsert(page, '\\frac{a}{b}', '四周环绕·右')
  wraps = await page.$$eval('.ProseMirror [data-wrap]', els => els.map(e => e.getAttribute('data-wrap'))).catch(() => 'ERR')
  w('after float-right, wraps: ' + JSON.stringify(wraps))
  w('float-right katex: ' + await page.$$eval('.ProseMirror [data-wrap="float-right"] .katex', e => e.length).catch(() => 'ERR'))

  await openAndInsert(page, 'a^2+b^2=c^2', '四周环绕·左')
  wraps = await page.$$eval('.ProseMirror [data-wrap]', els => els.map(e => e.getAttribute('data-wrap'))).catch(() => 'ERR')
  w('after float-left, wraps: ' + JSON.stringify(wraps))
  w('float-left katex: ' + await page.$$eval('.ProseMirror [data-wrap="float-left"] .katex', e => e.length).catch(() => 'ERR'))

  await page.screenshot({ path: '/tmp/modes.png' })
  await browser.close()
  w('DONE')
})().catch(e => { w('SCRIPT ERROR: ' + e.message); process.exit(1) })
