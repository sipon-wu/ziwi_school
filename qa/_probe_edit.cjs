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

  // 找一个有草稿状态的试卷
  await p.goto(BASE + '/exams', { waitUntil: 'domcontentloaded' })
  await sleep(3000)
  const examHref = await p.evaluate(() => {
    const a = document.querySelector('a[href*="/exams/"]:not([href$="/new"]):not([href$="/exams"])')
    return a ? a.getAttribute('href') : null
  })
  console.log('exam link:', examHref)
  if (!examHref) { await b.close(); return }
  await p.goto(BASE + examHref, { waitUntil: 'domcontentloaded' })
  await sleep(3000)

  // 检查编辑页有"进入编辑工作台"按钮
  const editBtn = await p.locator('a', { hasText: '进入编辑工作台' }).count()
  console.log('"进入编辑工作台" buttons:', editBtn)
  if (editBtn === 0) { await b.close(); return }

  // 点击跳转到 /exams/:id/edit
  await p.locator('a', { hasText: '进入编辑工作台' }).first().click()
  await sleep(4000)
  console.log('current url:', p.url())

  // 检查 ExamBuilder 元素
  const info = await p.evaluate(() => {
    return {
      hasAiBtn: !!document.querySelector('button:has-text("AI 模式"), button'),
      hasDocBtn: Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('文档模式')),
      hasAiText: Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('AI 模式')),
      hasKnowledgeGraph: !!document.querySelector('[class*="knowledge"], [class*="Knowledge"]'),
      hasExamPreview: !!document.querySelector('.aspect-\\[420\\/297\\]'),
      hasQualityAssess: document.body.innerText.includes('试卷质量评估'),
      hasLeftCollapsible: !!document.querySelector('button[title="展开左侧面板"]'),
      pageHasProseMirror: !!document.querySelector('.ProseMirror'),
    }
  })
  console.log('ExamBuilder check:', JSON.stringify(info, null, 2))
  await p.screenshot({ path: '/tmp/exam_edit_workspace.png' })
  await b.close()
})()
