const { chromium } = require('playwright')
const BASE = 'http://school1.ziwi.cn'
const TOKEN = process.env.TOKEN || ''
const TARGET = '/lesson-plans/lp_681dff3a6a7b/edit?mode=doc'
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const all = []
  page.on('console', m => all.push('[c.' + m.type() + '] ' + m.text()))
  page.on('pageerror', e => all.push('[pageerror] ' + e.message))
  page.on('requestfailed', r => all.push('[reqfail] ' + r.url() + ' ' + (r.failure() && r.failure().errorText)))
  page.on('response', r => { if (r.url().includes('.js') || r.url().includes('chunk')) all.push('[js ' + r.status() + '] ' + r.url().split('/').pop().slice(0, 40)) })
  await page.addInitScript((t) => {
    if (t) localStorage.setItem('zhiwei_token', t)
    window.addEventListener('unhandledrejection', e => { (window.__rej = window.__rej || []).push(String(e.reason)) })
  }, TOKEN)
  await page.goto(BASE + TARGET, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(10000)
  const rootLen = await page.evaluate(() => document.getElementById('root')?.innerHTML.length || 0)
  const rej = await page.evaluate(() => window.__rej || [])
  process.stdout.write('ROOT LEN: ' + rootLen + '\n')
  process.stdout.write('UNHANDLED REJECTIONS: ' + JSON.stringify(rej) + '\n')
  process.stdout.write('--- LOG ---\n')
  all.forEach(l => process.stdout.write(l + '\n'))
  await browser.close()
})().catch(e => { process.stdout.write('ERR ' + e.message + '\n'); process.exit(1) })
