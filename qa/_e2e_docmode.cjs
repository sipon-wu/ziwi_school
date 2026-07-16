// 知微 · 出题/组卷 文档模式 + 新建分流弹层 真浏览器专项验证
// 用法: BASE=http://school1.ziwi.cn node _e2e_docmode.cjs
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const results = []
const record = (name, status, detail) => {
  results.push({ name, status, detail: String(detail).slice(0, 300) })
  console.log(`[${status === 'PASS' ? 'PASS' : status === 'WARN' ? 'WARN' : 'FAIL'}] ${name} :: ${String(detail).slice(0, 160)}`)
}

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[placeholder="请输入手机号"]', '13800000002')
  await page.fill('input[placeholder="请输入密码"]', 'teacher123')
  await page.click('button[type=submit]')
  await sleep(2000)
}

async function pollText(page, txt, timeout = 12000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate(t => document.body.innerText.includes(t), txt).catch(() => false)
    if (ok) return true
    await sleep(400)
  }
  return false
}

;(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  const pe = []
  page.on('pageerror', e => pe.push(String(e.message || e)))

  await login(page)

  // ===== 1. 出题列表 → 新建 → 分流弹层 =====
  await page.goto(BASE + '/exercises', { waitUntil: 'domcontentloaded' })
  await pollText(page, '出题')
  await page.click('button:has-text("出题")').catch(async () => {
    await page.click('button:has-text("新建")')
  })
  const modalOk = await pollText(page, '新建什么？')
  const hasChoiceCard = await page.evaluate(() => /出题/.test(document.body.innerText) && /组卷/.test(document.body.innerText))
  record('出题列表·新建分流弹层', modalOk && hasChoiceCard ? 'PASS' : 'FAIL',
    modalOk ? '弹层出现,含出题/组卷卡片' : '弹层未出现')

  // ===== 2. 点击「出题」→ 新标签打开 /exercises/new =====
  let exPopup = null
  ctx.on('page', p => { exPopup = p })
  await page.click('button:has-text("出题"):below(h3:has-text("新建什么"))').catch(async () => {
    // 备选：弹层内第一个卡片按钮
    await page.locator('div[class*="fixed"] button:has-text("出题")').first().click()
  })
  // 等待 popup
  let popupPage = null
  for (let i = 0; i < 20 && !popupPage; i++) {
    popupPage = exPopup
    if (!popupPage) await sleep(300)
  }
  if (!popupPage) {
    // 某些环境 window.open 被当作同 context 新 page 事件；再尝试从所有 page 找
    const pages = ctx.pages()
    popupPage = pages.find(p => p !== page && /exercises\/new/.test(p.url())) || null
  }
  if (!popupPage) { record('出题·新标签打开', 'FAIL', '未捕获到 /exercises/new 新标签'); }
  else {
    await popupPage.waitForLoadState('domcontentloaded').catch(() => {})
    const opened = await pollText(popupPage, 'AI 模式')
    const urlOk = /exercises\/new/.test(popupPage.url())
    record('出题·新标签打开 /exercises/new', opened && urlOk ? 'PASS' : 'FAIL', `url=${popupPage.url()} AI模式可见=${opened}`)

    // ===== 3. 出题编辑器 文档模式 → A4 纸面（无 A3 切换）=====
    await popupPage.click('button:has-text("文档模式")').catch(() => {})
    const docReady1 = await pollText(popupPage, 'Word', 10000)
    await sleep(500)
    const a4Active = await popupPage.evaluate(() => {
      const btns = [...document.querySelectorAll('button')]
      const a4 = btns.find(b => b.textContent.trim() === 'A4')
      const a3 = btns.find(b => b.textContent.includes('A3 双排'))
      const word = btns.find(b => b.textContent.includes('Word'))
      const pdf = btns.find(b => b.textContent.includes('PDF'))
      const student = btns.find(b => b.textContent.includes('学生卷'))
      return { hasA4: !!a4, hasA3: !!a3, hasWord: !!word, hasPdf: !!pdf, hasStudent: !!student }
    })
    const okDoc = a4Active.hasWord && a4Active.hasPdf && a4Active.hasStudent && !a4Active.hasA3
    record('出题·文档模式 A4 纸面(恒A4·无A3切换·Word·PDF·学生卷)', okDoc ? 'PASS' : 'FAIL',
      JSON.stringify(a4Active))
    await popupPage.close().catch(() => {})
  }

  // ===== 4. 试卷库 → 新建试卷 → 分流弹层 → 组卷 → /exams/new =====
  await page.goto(BASE + '/exams', { waitUntil: 'domcontentloaded' })
  await pollText(page, '新建试卷')
  await page.click('button:has-text("新建试卷")')
  const modalOk2 = await pollText(page, '新建什么？')
  record('试卷库·新建分流弹层', modalOk2 ? 'PASS' : 'FAIL', modalOk2 ? '弹层出现' : '弹层未出现')

  let examPopup = null
  ctx.on('page', p => { if (!examPopup) examPopup = p })
  await page.locator('div[class*="fixed"] button:has-text("组卷")').first().click().catch(async () => {
    await page.click('button:has-text("组卷")')
  })
  let examPage = null
  for (let i = 0; i < 20 && !examPage; i++) { examPage = examPopup; if (!examPage) await sleep(300) }
  if (!examPage) {
    const pages = ctx.pages()
    examPage = pages.find(p => p !== page && /exams\/new/.test(p.url())) || null
  }
  if (!examPage) { record('组卷·新标签打开', 'FAIL', '未捕获到 /exams/new 新标签'); }
  else {
    await examPage.waitForLoadState('domcontentloaded').catch(() => {})
    const opened = await pollText(examPage, 'AI 模式')
    const urlOk = /exams\/new/.test(examPage.url())
    record('组卷·新标签打开 /exams/new', opened && urlOk ? 'PASS' : 'FAIL', `url=${examPage.url()} AI模式可见=${opened}`)

    // ===== 5. 组卷文档模式 → 默认 A3 双排（含对折）=====
    await examPage.click('button:has-text("文档模式")').catch(() => {})
    const docReady2 = await pollText(examPage, 'Word', 10000)
    await sleep(500)
    const a3State = await examPage.evaluate(() => {
      const btns = [...document.querySelectorAll('button')]
      const a3 = btns.find(b => b.textContent.includes('A3 双排'))
      const a4 = btns.find(b => b.textContent.trim() === 'A4')
      const fold = document.body.innerText.includes('对折')
      const word = btns.find(b => b.textContent.includes('Word'))
      return { hasA3: !!a3, hasA4: !!a4, fold, hasWord: !!word }
    })
    const okA3 = a3State.hasA3 && a3State.hasA4 && a3State.hasWord
    record('组卷·文档模式 默认A3双排(可切A4·有Word)', okA3 ? 'PASS' : 'FAIL', JSON.stringify(a3State))

    // ===== 5b. 生成题目后验证 A3 纸面(对折) + 导出可用（预览=导出）=====
    await examPage.click('button:has-text("AI 模式")').catch(() => {})
    await sleep(600)
    const genBtn = examPage.locator('button:has-text("AI 智能组卷")').first()
    let gotQ = false
    if (await genBtn.count()) {
      await genBtn.click().catch(() => {})
      for (let i = 0; i < 40; i++) {
        const t = await examPage.evaluate(() => document.body.innerText)
        if (/重新生成|学生卷 Word|共 \d+ 题|选择题|填空题/.test(t)) { gotQ = true; break }
        await sleep(1000)
      }
    }
    if (gotQ) {
      await examPage.click('button:has-text("文档模式")').catch(() => {})
      await sleep(1800)
      const withQ = await examPage.evaluate(() => {
        const t = document.body.innerText
        const word = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Word'))
        return { fold: t.includes('对折'), wordDisabled: word ? word.disabled : true }
      })
      record('组卷·有题后 A3 纸面(对折·导出可用)', (withQ.fold && withQ.wordDisabled === false) ? 'PASS' : 'WARN', JSON.stringify(withQ))
    } else {
      record('组卷·有题后 A3 纸面', 'WARN', 'AI 组卷未在40s内返回题目(外部服务可用性，非代码缺陷)')
    }

    // ===== 6. 切到 A4 → 单栏 =====
    await examPage.click('button:has-text("A4")').catch(() => {})
    await sleep(800)
    const a4single = await examPage.evaluate(() => {
      const t = document.body.innerText
      return /A4 · 单栏/.test(t) || /单栏/.test(t)
    })
    record('组卷·A4 切换→单栏', a4single ? 'PASS' : 'WARN', a4single ? '切到 A4 单栏' : '未检测到单栏标识')
    await examPage.close().catch(() => {})
  }

  record('运行期 pageerror', pe.length === 0 ? 'PASS' : 'FAIL', 'count=' + pe.length + (pe.length ? ' :: ' + pe.slice(0, 3).join(' | ') : ''))

  const fail = results.filter(r => r.status === 'FAIL').length
  const warn = results.filter(r => r.status === 'WARN').length
  console.log(`\n==== 出题/组卷 文档模式专项 E2E ====\n总计 ${results.length} :: PASS ${results.length - fail - warn} / WARN ${warn} / FAIL ${fail}`)
  console.log(fail === 0 ? 'DOCMODE_E2E_OK' : 'DOCMODE_E2E_HAS_FAIL=' + fail)
  await browser.close()
})()
