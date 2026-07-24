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
  await p.fill('input[placeholder="请在这里输入标题"]', 'A4宽度验证')
  await p.locator('button', { hasText: '小微对话' }).first().click()
  await sleep(1500)
  await p.locator('input[placeholder="输入补充需求..."]').fill('简短教案')
  await p.locator('input[placeholder="输入补充需求..."]').press('Enter')
  await sleep(13000)
  const apply = p.locator('button', { hasText: '应用到当前内容' })
  if (await apply.count() > 0) await apply.first().click()
  for (let i = 0; i < 40; i++) {
    if (await p.evaluate(() => !!document.querySelector('.ProseMirror'))) { console.error('editor ready at', i*2+'s'); break }
    await sleep(2000)
  }

  // 测 A4 宽度（关右面板时）
  await p.evaluate(() => {
    const span = [...document.querySelectorAll('span')].find(s => s.textContent.includes('章节导航'))
    if (span) span.closest('.flex')?.querySelector('button')?.click()
  })
  await sleep(800)
  // 关右面板：找最右侧的关闭按钮
  await p.evaluate(() => {
    const tabs = [...document.querySelectorAll('div')].find(d => {
      const btns = d.querySelectorAll('button')
      return btns.length >= 2 && [...btns].some(b => b.textContent.includes('批注'))
    })
    if (tabs) {
      const btns = tabs.querySelectorAll('button')
      btns[btns.length-1]?.click()
    }
  })
  await sleep(800)

  const before = await p.evaluate(() => {
    const paper = document.querySelector('.aspect-\\[210\\\/297\\]')
    const lBtn = document.querySelector('[title="展开章节导航"]')
    const rBtn = document.querySelector('[title="展开批注/版本历史"]')
    return {
      paperW: paper ? paper.getBoundingClientRect().width : null,
      leftBtn: lBtn ? { w: lBtn.getBoundingClientRect().width, h: lBtn.getBoundingClientRect().height, cls: lBtn.className.slice(0, 80) } : null,
      rightBtn: rBtn ? { w: rBtn.getBoundingClientRect().width, h: rBtn.getBoundingClientRect().height, cls: rBtn.className.slice(0, 80) } : null,
    }
  })
  console.log('=== 两面板都收起 ===')
  console.log(JSON.stringify(before, null, 2))

  // 重新打开右面板（点右侧恢复按钮）
  if (before.rightBtn) {
    await p.click('[title="展开批注/版本历史"]')
    await sleep(800)
    const after = await p.evaluate(() => {
      const paper = document.querySelector('.aspect-\\[210\\\/297\\]')
      return { paperW: paper ? paper.getBoundingClientRect().width : null }
    })
    console.log('=== 打开右面板后 A4 宽度 ===', after.paperW)
  }
  await b.close()
})()
