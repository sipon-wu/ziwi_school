const { chromium } = require('playwright')
const BASE = 'http://school1.ziwi.cn'
const TOKEN = process.env.TOKEN || ''
const TARGET = '/lesson-plans/lp_681dff3a6a7b/edit?mode=doc'

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const logs = []
  page.on('console', m => logs.push(`[c.${m.type()}] ${m.text()}`))
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))

  await page.addInitScript((t) => { if (t) localStorage.setItem('zhiwei_token', t) }, TOKEN)
  await page.goto(BASE + TARGET, { waitUntil: 'domcontentloaded' })

  // 等编辑器真正挂载（冷启动可能慢）
  try {
    await page.waitForSelector('.ProseMirror', { timeout: 25000 })
    console.log('ProseMirror mounted OK')
  } catch (e) {
    console.log('ProseMirror NOT mounted in 25s — abort')
    console.log(logs.join('\n'))
    await browser.close(); return
  }

  // 1) 真实点击工具栏"插入数学公式"按钮
  const mathBtn = await page.$('button[title="插入数学公式（图片式容器）"]')
  console.log('math toolbar button found:', !!mathBtn)
  await mathBtn.click()
  await page.waitForTimeout(700)

  const dialog = await page.$('text=插入数学公式')
  console.log('dialog opened:', !!dialog)

  // 2) 真实输入：点模板"希腊"按钮（贴近真实用户的最可靠路径）
  const greekBtn = await page.$('button:has-text("希腊")')
  console.log('template 希腊 button found:', !!greekBtn)
  await greekBtn.click()
  await page.waitForTimeout(400)
  const ta = await page.$('textarea')
  const taVal = await ta.inputValue()
  console.log('textarea value after template:', JSON.stringify(taVal))

  // 3) 真实点击"插入到文档"
  const insertBtn = await page.$('button:has-text("插入到文档")')
  console.log('insert button found:', !!insertBtn)
  await insertBtn.click()
  await page.waitForTimeout(1200)

  // 4) 检查 DOM 是否真的插入了公式
  const wraps = await page.$$eval('.ProseMirror [data-wrap]', els => els.map(e => e.getAttribute('data-wrap'))).catch(() => 'ERR')
  console.log('FORMULA WRAPS IN DOM:', JSON.stringify(wraps))

  const dialogAfter = await page.$('text=插入数学公式')
  console.log('dialog still open after insert:', !!dialogAfter)

  console.log('--- LOGS ---')
  console.log(logs.join('\n'))
  await page.screenshot({ path: '/tmp/repro_real.png' })
  await browser.close()
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1) })
