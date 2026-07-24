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
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await realLogin(page, '13800000002', 'teacher123')
  await page.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(8000)
  try {
    await page.locator('button', { hasText: '小微对话' }).first().click()
    await sleep(1500)
    const inp = page.locator('input[placeholder="输入补充需求..."]')
    await inp.fill('请出几道基础选择题'); await inp.press('Enter')
    await sleep(13000)
    const apply = page.locator('button', { hasText: '应用到当前内容' })
    if (await apply.count() > 0) await apply.first().click()
  } catch (e) { console.error('FLOW ERR', e.message) }
  await sleep(15000)
  const info = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].map(b => (b.innerText||'').replace(/\s+/g,' ').trim()).filter(Boolean)
    const wordBtns = btns.filter(t => t.includes('Word') || t.includes('学生卷') || t.includes('导出'))
    const cards = document.querySelectorAll('.bg-\\[\\#F6F7F8\\]').length
    const firstCard = document.querySelector('.bg-\\[\\#F6F7F8\\]')
    return {
      totalButtons: btns.length,
      exportRelated: wordBtns,
      cardCount: cards,
      firstCardText: firstCard ? (firstCard.innerText||'').slice(0,120) : null,
      editModeSwitch: btns.filter(t => t.includes('AI 模式') || t.includes('文档模式'))
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await browser.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
