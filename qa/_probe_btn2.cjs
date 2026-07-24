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
  await p.fill('input[placeholder="请在这里输入标题"]', '按钮')
  await p.locator('button', { hasText: '小微对话' }).first().click()
  await sleep(1500)
  await p.locator('input[placeholder="输入补充需求..."]').fill('简单')
  await p.locator('input[placeholder="输入补充需求..."]').press('Enter')
  await sleep(13000)
  const apply = p.locator('button', { hasText: '应用到当前内容' })
  if (await apply.count() > 0) await apply.first().click()
  for (let i = 0; i < 40; i++) {
    if (await p.evaluate(() => !!document.querySelector('.ProseMirror'))) break
    await sleep(2000)
  }
  // 用 Tailwind 的定位找关闭按钮：左侧固定 180px 宽的导航栏
  // 找到所有 180px 宽的div
  await p.evaluate(() => {
    // 左侧章节导航容器
    const outlinePanel = [...document.querySelectorAll('div')].find(d => d.className && d.className.includes && d.className.includes('w-[180px]') && d.className.includes('border-r'))
    if (outlinePanel) {
      // 头部第一个 button
      const head = outlinePanel.firstElementChild
      const closeBtn = head && head.querySelector('button')
      if (closeBtn) closeBtn.click()
    }
  })
  await sleep(600)
  // 右侧批注/版本容器 220px
  await p.evaluate(() => {
    const histPanel = [...document.querySelectorAll('div')].find(d => d.className && d.className.includes && d.className.includes('w-[220px]') && d.className.includes('border-l'))
    if (histPanel) {
      const head = histPanel.firstElementChild
      const closeBtn = head && head.querySelector('button:last-child')
      if (closeBtn) closeBtn.click()
    }
  })
  await sleep(600)

  const info = await p.evaluate(() => {
    const l = document.querySelector('[title="展开章节导航"]')
    const r = document.querySelector('[title="展开批注/版本历史"]')
    return {
      leftBtn: l ? { cls: l.className, rect: l.getBoundingClientRect(), opacity: getComputedStyle(l).opacity, bg: getComputedStyle(l).backgroundColor } : null,
      rightBtn: r ? { cls: r.className, rect: r.getBoundingClientRect(), opacity: getComputedStyle(r).opacity, bg: getComputedStyle(r).backgroundColor } : null,
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await b.close()
})()
