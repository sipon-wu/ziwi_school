const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function realLogin(page, phone, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[placeholder="请输入手机号"]', phone)
  await page.fill('input[placeholder="请输入密码"]', password)
  await page.click('button[type=submit]')
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await sleep(2500)
}

;(async () => {
  console.error('BOOT')
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const pe = []
  page.on('pageerror', e => pe.push(String(e.message || e)))
  await realLogin(page, '13800000002', 'teacher123')
  console.error('LOGGED')

  await page.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(8000)
  let exOk = false, exDetail = ''
  const t0 = Date.now()
  try {
    await page.locator('button', { hasText: '小微对话' }).first().click()
    await sleep(1500)
    const inp = page.locator('input[placeholder="输入补充需求..."]')
    await inp.fill('请出几道基础选择题'); await inp.press('Enter')
    await sleep(13000)
    const apply = page.locator('button', { hasText: '应用到当前内容' })
    if (await apply.count() > 0) {
      await apply.first().click()
      console.error('clicked apply, waiting up to 90s for render...')
      await page.waitForFunction(() => /学生卷 Word|重新生成|出题失败/.test(document.body.innerText), { timeout: 90000 }).catch(() => {})
      const hasQ = await page.evaluate(() => /学生卷 Word|重新生成/.test(document.body.innerText))
      exOk = hasQ
      exDetail = hasQ ? '题目已渲染' : (await page.evaluate(() => /出题失败/.test(document.body.innerText)) ? 'AI返回错误' : (Math.round((Date.now()-t0)/1000)+'s未渲染'))
    } else { exDetail = '"应用到当前内容"未出现' }
  } catch (e) { exDetail = 'ERR ' + e.message }
  console.log('=== 出题新流程端到端 ===', exOk ? 'PASS' : 'FAIL', '| 耗时', Math.round((Date.now()-t0)/1000)+'s |', exDetail)
  console.log('=== pageerror count=', pe.length, JSON.stringify(pe.slice(0,3)))
  await browser.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
