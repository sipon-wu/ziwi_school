const { chromium } = require('playwright')
const fs = require('fs')
const out = []
const w = (s) => { out.push(s); fs.writeFileSync('/tmp/repro_type_result.txt', out.join('\n')) }
const BASE = 'http://school1.ziwi.cn'
const TOKEN = process.env.TOKEN || ''
const TARGET = '/lesson-plans/lp_681dff3a6a7b/edit?mode=doc'

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  page.on('console', m => w(`[c.${m.type()}] ${m.text()}`))
  page.on('pageerror', e => w(`[pageerror] ${e.message}`))

  await page.addInitScript((t) => { if (t) localStorage.setItem('zhiwei_token', t) }, TOKEN)
  await page.goto(BASE + TARGET, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ProseMirror', { timeout: 25000 })
  w('ProseMirror mounted')

  await page.click('button[title="插入数学公式（图片式容器）"]')
  await page.waitForTimeout(700)
  w('dialog clicked')

  const modalTa = page.locator('div.fixed.inset-0 textarea').first()
  const cnt = await page.locator('div.fixed.inset-0 textarea').count()
  w('modal textarea count: ' + cnt)
  await modalTa.click()
  await modalTa.pressSequentially('a^2 + b^2 = c^2', { delay: 15 })
  await page.waitForTimeout(500)
  const taVal = await modalTa.inputValue()
  w('modal textarea value after type: ' + JSON.stringify(taVal))

  const hasKatex = await page.locator('div.fixed.inset-0 .katex').count()
  w('katex in preview: ' + hasKatex)

  await page.click('div.fixed.inset-0 button:has-text("插入到文档")')
  await page.waitForTimeout(1200)

  const wraps = await page.$$eval('.ProseMirror [data-wrap]', els => els.map(e => e.getAttribute('data-wrap'))).catch(() => 'ERR')
  w('FORMULA WRAPS IN DOM: ' + JSON.stringify(wraps))
  const insertedKatex = await page.$$eval('.ProseMirror [data-wrap="block"] .katex', els => els.length).catch(() => 'ERR')
  w('inserted block formula katex count: ' + insertedKatex)

  await page.screenshot({ path: '/tmp/repro_type.png' })
  await browser.close()
  w('DONE')
})().catch(e => { w('SCRIPT ERROR: ' + e.message + '\n' + e.stack); process.exit(1) })
