// 真实浏览器全量 QA：AI 课件质量 / 小微对话质量 / 知识图谱质量 + 覆盖留存验证
// 真实 UI 驱动 + 网络拦截捕获真实 AI 产出物做质量评估
// 用法：BASE=http://school1.ziwi.cn node browser_qa.cjs
const { chromium } = require('playwright')
const fs = require('fs')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const shots = __dirname + '/shots'
try { fs.mkdirSync(shots) } catch {}

const results = []
const record = (step, status, detail, extra) => {
  results.push({ step, status, detail: String(detail).slice(0, 500), ...(extra || {}) })
  console.log(`[${status}] ${step} :: ${String(detail).slice(0, 180)}`)
}
const captured = { courseware: null, chat: null }

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console:' + m.text()) })
  // 网络拦截：捕获真实 AI 产出物
  page.on('response', async r => {
    const u = r.url()
    try {
      if (u.includes('/api/ai/courseware/generate')) { captured.courseware = await r.json().catch(() => null) }
      if (u.includes('/api/ai/chat')) { captured.chat = await r.json().catch(() => null) }
    } catch {}
  })

  const waitCapture = async (key, timeout) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) { if (captured[key]) return captured[key]; await sleep(1000) }
    return null
  }

  try {
    // 登录：Node 取 token 注入 localStorage
    let token = null
    for (let i = 0; i < 6 && !token; i++) {
      try {
        const tr = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: PHONE, password: PASS }) })
        const j = await tr.json().catch(() => ({})); token = j.token
      } catch (e) {}
      if (!token) await sleep(2500)
    }
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.evaluate(t => localStorage.setItem('zhiwei_token', t), token)
    await page.goto(BASE + '/materials', { waitUntil: 'domcontentloaded', timeout: 20000 })
    await sleep(1500)
    record('login', token ? 'PASS' : 'FAIL', 'tokenInjected=' + !!token)
    if (!token) throw new Error('login failed')

    // ───── A：AI 课件生成质量（真实 UI 驱动 + 捕获真实 markdown）─────
    try {
      await page.locator('button:has-text("AI 生成课件")').first().click()
      await sleep(800)
      const dlgInput = page.locator('input[placeholder="如：光的折射定律"]')
      await dlgInput.waitFor({ timeout: 5000 })
      await dlgInput.fill('观潮')
      await sleep(300)
      const t0 = Date.now()
      captured.courseware = null
      await page.getByRole('button', { name: '生成课件', exact: true }).click()
      let previewOpen = false
      try { await page.getByText('AI 课件预览', { exact: false }).first().waitFor({ timeout: 90000 }); previewOpen = true } catch (e) {}
      const gen = previewOpen ? await waitCapture('courseware', 90000) : null
      const genMs = Date.now() - t0
      if (gen && gen.courseware_markdown) {
        const md = gen.courseware_markdown
        const slides = (md.match(/^##\s/gm) || []).length
        const hasGoal = /学习目标|教学目标/.test(md)
        const hasPractice = /课堂练习|分层作业/.test(md)
        const hasBoard = /板书/.test(md)
        const divCount = (gen.divergence_map || []).length
        await page.screenshot({ path: shots + '/A_courseware.png' })
        const ok = slides >= 8 && hasGoal && hasPractice && hasBoard && divCount > 0
        record('A-courseware-quality', ok ? 'PASS' : 'WARN',
          `genMs=${genMs} slides=${slides} 目标=${hasGoal} 练习=${hasPractice} 板书=${hasBoard} 发散=${divCount} mdLen=${md.length}`,
          { genMs, slides, hasGoal, hasPractice, hasBoard, divCount, mdLen: md.length })
        // 播放预览
        try {
          await page.getByRole('button', { name: '播放 / 阅读', exact: true }).click(); await sleep(1500)
          const proj = await page.getByText('PPT 在线预览', { exact: false }).first().isVisible().catch(() => false)
          record('A-courseware-play', proj ? 'PASS' : 'WARN', 'projVisible=' + proj)
          await page.keyboard.press('Escape'); await sleep(500)
        } catch (e) { record('A-courseware-play', 'WARN', e.message) }
      } else {
        record('A-courseware-quality', 'WARN', '未捕获课件 markdown（生成超时或拦截失败）', { genMs, previewOpen })
      }
    } catch (e) { record('A-courseware-quality', 'FAIL', e.message) }

    // ───── B：小微助教对话质量（真实 UI + 捕获真实回复）─────
    try {
      await page.keyboard.press('Escape').catch(() => {}); await sleep(500)
      await page.locator('.xw-chat-btn').first().waitFor({ timeout: 8000 })
      await page.locator('.xw-chat-btn').first().click()
      await sleep(800)
      const input = page.locator('input[placeholder="输入你想了解的内容..."]')
      await input.waitFor({ timeout: 5000 })
      const question = '我是四年级语文老师，怎么把《观潮》的“由远及近”写作顺序讲得生动？给三个课堂活动建议'
      await input.fill(question)
      captured.chat = null
      const t0 = Date.now()
      await page.locator('div:has(input[placeholder="输入你想了解的内容..."]) button').last().click()
      const chat = await waitCapture('chat', 60000)
      const respMs = Date.now() - t0
      if (chat && chat.reply) {
        const reply = chat.reply
        const relevant = /活动|课堂|写作|顺序|观潮|情境|朗读/.test(reply)
        const hasSuggest = Array.isArray(chat.suggestions) && chat.suggestions.length > 0
        await page.screenshot({ path: shots + '/B_xiaowei.png' })
        const ok = reply.length > 80 && relevant
        record('B-xiaowei-quality', ok ? 'PASS' : 'WARN',
          `respMs=${respMs} replyLen=${reply.length} relevant=${relevant} suggestions=${hasSuggest}`,
          { respMs, replyLen: reply.length, relevant, hasSuggest, replyHead: reply.slice(0, 80) })
      } else {
        record('B-xiaowei-quality', 'WARN', '未捕获小微回复', { respMs })
      }
    } catch (e) { record('B-xiaowei-quality', 'FAIL', e.message) }

    // ───── C：知识图谱加载质量 ─────
    try {
      await page.goto(BASE + '/lesson-plans/new', { waitUntil: 'domcontentloaded', timeout: 20000 })
      await sleep(2500)
      const kgVisible = await page.getByText('知识图谱', { exact: false }).first().isVisible().catch(() => false)
      const autoSelected = await page.getByText('AI 生成教案', { exact: false }).first().isVisible().catch(() => false)
      const needSelect = await page.getByText('请先在知识图谱选取知识点', { exact: false }).first().isVisible().catch(() => false)
      await page.screenshot({ path: shots + '/C_knowledge.png' })
      record('C-knowledge-graph', kgVisible && (autoSelected || !needSelect) ? 'PASS' : 'WARN',
        `kgVisible=${kgVisible} autoSelected=${autoSelected} needSelect=${needSelect}`, { kgVisible, autoSelected, needSelect })
    } catch (e) { record('C-knowledge-graph', 'FAIL', e.message) }

    // ───── D：覆盖留存验证（权威进度 + 真实 API 计数）─────
    try {
      let progress = {}, metrics = []
      try { progress = JSON.parse(fs.readFileSync(__dirname + '/coverage_progress.json', 'utf8')) } catch {}
      try { metrics = JSON.parse(fs.readFileSync(__dirname + '/coverage_metrics.json', 'utf8')) } catch {}
      const combos = Object.keys(progress)
      const all3 = combos.filter(k => progress[k].ok === 3).length
      const partial = combos.filter(k => progress[k].ok > 0 && progress[k].ok < 3).length
      const zero = combos.filter(k => progress[k].ok === 0).length
      const bySubject = {}
      for (const m of metrics) { const s = (m.combo || '').split('|')[0]; if (s) bySubject[s] = (bySubject[s] || 0) + (m.ok || 0) }
      record('D-coverage-progress', combos.length > 0 ? 'INFO' : 'WARN',
        `combos_done=${combos.length} all3=${all3} partial=${partial} zero=${zero}`, { combos: combos.length, all3, partial, zero, bySubject })
      // 真实 API 计数（确认数据确实落库）
      const hdr = { Authorization: 'Bearer ' + token }
      const mc = await fetch(BASE + '/api/materials', { headers: hdr }).then(r => r.json()).catch(() => ({}))
      const ec = await fetch(BASE + '/api/exams', { headers: hdr }).then(r => r.json()).catch(() => ({}))
      const lc = await fetch(BASE + '/api/lesson-plans', { headers: hdr }).then(r => r.json()).catch(() => ({}))
      const matN = (mc.items || mc.data || []).length
      const exN = (ec.items || ec.data || []).length
      const lpN = (lc.items || lc.data || []).length
      record('D-live-counts', 'INFO', `materials=${matN} exams=${exN} lessonPlans=${lpN}`,
        { materials: matN, exams: exN, lessonPlans: lpN })
    } catch (e) { record('D-coverage-progress', 'FAIL', e.message) }

    record('page-errors', pageErrors.length === 0 ? 'PASS' : 'WARN', 'count=' + pageErrors.length)
  } catch (e) {
    record('exception', 'FAIL', e.message)
  } finally {
    if (pageErrors.length) console.log('PAGE_ERRORS:', pageErrors.slice(0, 8))
    await browser.close()
    const fails = results.filter(r => r.status === 'FAIL')
    const warns = results.filter(r => r.status === 'WARN')
    console.log(`\nSUMMARY: ${results.length} steps, FAIL=${fails.length}, WARN=${warns.length}`)
    fs.writeFileSync(__dirname + '/browser_qa_report.json', JSON.stringify(results, null, 2))
    process.exit(fails.length ? 1 : 0)
  }
})()
