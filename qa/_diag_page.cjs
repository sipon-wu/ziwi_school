const { chromium } = require('playwright')
const BASE = 'http://school1.ziwi.cn'
const TOKEN = process.env.TOKEN || ''
const TARGET = process.env.TARGET || '/lesson-plans/lp_681dff3a6a7b/edit?mode=doc'
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.addInitScript((t) => { if (t) localStorage.setItem('zhiwei_token', t) }, TOKEN)
  await page.goto(BASE + TARGET, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML || 'NO ROOT')
  console.log('ROOT HTML:\n', rootHtml)
  await browser.close()
})().catch(e => { console.error('ERR', e); process.exit(1) })
