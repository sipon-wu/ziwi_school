const { chromium } = require('playwright')
const BASE = 'http://school1.ziwi.cn'
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const b = await chromium.launch()
  const p = await (await b.newContext()).newPage()
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[placeholder="请输入手机号"]', '13800000002')
  await p.fill('input[placeholder="请输入密码"]', 'teacher123')
  await p.click('button[type=submit]')
  await sleep(3000)
  await p.goto(BASE + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })
  await sleep(6000)
  await p.fill('input[placeholder="请在这里输入标题"]', '按钮验证')
  await p.locator('button', { hasText: '小微对话' }).first().click()
  await sleep(1500)
  await p.locator('input[placeholder="输入补充需求..."]').fill('生成简短教案')
  await p.locator('input[placeholder="输入补充需求..."]').press('Enter')
  await sleep(13000)
  const applyBtn = p.locator('button', { hasText: '应用到当前内容' })
  if (await applyBtn.count() > 0) await applyBtn.first().click()
  // wait for TipTap
  for (let i = 0; i < 40; i++) {
    const ready = await p.evaluate(() => !!document.querySelector('.ProseMirror'))
    if (ready) { console.error('TipTap ready at', i*2+'s'); break }
    await sleep(2000)
  }
  // close left panel: find button inside "章节导航" header
  await p.evaluate(() => {
    const spans = [...document.querySelectorAll('span')].filter(s => s.textContent.includes('章节导航'))
    if (!spans.length) return
    const header = spans[0].closest('.flex.items-center.justify-between')
    if (!header) return
    const btn = header.querySelector('button')
    if (btn) btn.click()
  })
  await sleep(500)
  // close right panel: last button in the tabs row
  await p.evaluate(() => {
    const tabRow = document.querySelector('.flex.border-b.shrink-0')
    if (!tabRow) return
    const btns = tabRow.querySelectorAll('button')
    if (btns.length > 0) btns[btns.length - 1].click()
  })
  await sleep(800)
  const info = await p.evaluate(() => {
    const l = document.querySelector('button[title="展开章节导航"]')
    const r = document.querySelector('button[title="展开批注/版本历史"]')
    return {
      leftExists: !!l,
      rightExists: !!r,
      leftHtml: l ? l.outerHTML.slice(0, 200) : null,
      rightHtml: r ? r.outerHTML.slice(0, 200) : null,
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await b.close()
})()
