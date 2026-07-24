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
  await p.fill('input[placeholder="请在这里输入标题"]', '定位')
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
  // 关左
  await p.evaluate(() => {
    const outlinePanel = [...document.querySelectorAll('div')].find(d => d.className && d.className.includes && d.className.includes('w-[180px]') && d.className.includes('border-r'))
    outlinePanel?.firstElementChild?.querySelector('button')?.click()
  })
  await sleep(500)
  // 关右
  await p.evaluate(() => {
    const histPanel = [...document.querySelectorAll('div')].find(d => d.className && d.className.includes && d.className.includes('w-[220px]') && d.className.includes('border-l'))
    histPanel?.firstElementChild?.querySelectorAll('button')?.[1]?.click()
  })
  await sleep(600)
  const r = await p.evaluate(() => {
    const l = document.querySelector('[title="展开章节导航"]')
    const rr = document.querySelector('[title="展开批注/版本历史"]')
    // 找编辑区容器的位置
    const editor = [...document.querySelectorAll('div')].find(d => d.className && d.className.includes && d.className.includes('flex-1 flex overflow-hidden'))
    const editorRect = editor ? editor.getBoundingClientRect() : null
    return {
      editor: editorRect,
      leftBtn: l ? { x: l.getBoundingClientRect().x, distFromEditorLeft: l.getBoundingClientRect().x - (editorRect?.x || 0) } : null,
      rightBtn: rr ? { right: rr.getBoundingClientRect().right, distFromEditorRight: (editorRect?.right || 0) - rr.getBoundingClientRect().right } : null,
    }
  })
  console.log(JSON.stringify(r, null, 2))
  await b.close()
})()
