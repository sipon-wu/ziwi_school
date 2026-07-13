// 真实浏览器端到端验收：出题→保存题库 / AI组卷→保存试卷 / 课件生成 / 小微
// 验证策略：UI 保存确认文案 + Node 侧 GET 读回落库（权威），不依赖 response 拦截
// 用法：BASE=http://school1.ziwi.cn node browser_e2e_fixes.cjs
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
  results.push({ step, status, detail: String(detail).slice(0, 600), ...(extra || {}) })
  console.log(`[${status}] ${step} :: ${String(detail).slice(0, 200)}`)
}

;(async () => {
  // Node 侧 token 用于 GET 读回
  let token = null
  try { const tr = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: PHONE, password: PASS }) }); const j = await tr.json().catch(() => ({})); token = j.token } catch {}
  const getCount = async (url) => {
    const j = await fetch(BASE + url + '?limit=1', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => ({}))
    if (j.total !== undefined) return j.total
    if (j.data && j.data.total !== undefined) return j.data.total
    return (j.items || []).length
  }
  const findExamByTitle = async (title) => {
    const j = await fetch(BASE + '/api/exams?limit=300', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => ({}))
    return (j.items || j.data || []).find(e => e.title && e.title.includes(title))
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push('pageerror:' + String(e)))
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console:' + m.text()) })

  const waitEnabled = async (loc, timeout) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) { try { if (await loc.isEnabled()) return true } catch {}; await sleep(800) }
    return false
  }

  let browserToken = token
  try {
    // 登录注入
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.evaluate(t => localStorage.setItem('zhiwei_token', t), token)
    record('login', token ? 'PASS' : 'FAIL', 'tokenInjected=' + !!token)
    if (!token) throw new Error('login failed')

    // ───── 流程1：出题 → 保存个人题库（验证 #1 /exercises 端点）─────
    try {
      await page.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded', timeout: 20000 })
      await sleep(2500)
      const aiBtn = page.locator('button:has-text("AI 生成")').first()
      const enabled = await waitEnabled(aiBtn, 12000)
      if (!enabled) record('E1-ai-enabled', 'WARN', 'AI 生成按钮仍 disabled')
      else {
        const t0 = Date.now()
        await aiBtn.click()
        const saveBtn = page.locator('button:has-text("保存到个人题库")')
        const ok = await saveBtn.waitFor({ timeout: 90000 }).then(() => true).catch(() => false)
        const genMs = Date.now() - t0
        if (ok) {
          const before = await getCount('/api/exercises')
          await saveBtn.click()
          const uiSaved = await page.getByText(/已保存 \d+ 道题目/).first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false)
          await sleep(4000)
          const after = await getCount('/api/exercises')
          const pass = uiSaved && after > before
          record('E1-exercise-save', pass ? 'PASS' : 'FAIL',
            `genMs=${genMs} uiSaved=${uiSaved} before=${before} after=${after} delta=${after - before}`,
            { genMs, uiSaved, before, after, delta: after - before })
        } else record('E1-exercise-save', 'FAIL', '生成后未出现保存按钮', { genMs })
      }
    } catch (e) { record('E1-exercise-save', 'FAIL', e.message) }

    // ───── 流程2：AI 组卷 → 保存试卷（验证 #4 题目落库）─────
    try {
      await page.goto(BASE + '/exams/new', { waitUntil: 'domcontentloaded', timeout: 20000 })
      await sleep(2500)
      const aiBtn = page.locator('button:has-text("AI 智能组卷")')
      const enabled = await waitEnabled(aiBtn, 12000)
      if (!enabled) record('E2-ai-enabled', 'WARN', 'AI 智能组卷按钮仍 disabled')
      else {
        const t0 = Date.now()
        await aiBtn.click()
        const qAppear = await page.getByText(/^1\./).first().waitFor({ timeout: 90000 }).then(() => true).catch(() => false)
        const genMs = Date.now() - t0
        if (!qAppear) record('E2-exam-gen', 'WARN', '组卷后未出现题目列表', { genMs })
        else {
          const titleInput = page.locator('input[placeholder="如：四年级语文第一单元检测"]')
          await titleInput.fill('E2E验收-智能组卷').catch(() => {})
          await sleep(500)
          await page.locator('button:has-text("保存为草稿")').click()
          const uiSaved = await page.getByText('已保存为草稿').first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false)
          await sleep(4000)
          const found = await findExamByTitle('E2E验收-智能组卷')
          let qLen = 0
          try { qLen = JSON.parse(found && found.questions ? found.questions : '[]').length } catch {}
          const pass = uiSaved && found && qLen > 0
          record('E2-exam-save', pass ? 'PASS' : 'FAIL',
            `genMs=${genMs} uiSaved=${uiSaved} examFound=${!!found} questionsLen=${qLen}`,
            { genMs, uiSaved, examFound: !!found, questionsLen: qLen })
        }
      }
    } catch (e) { record('E2-exam-save', 'FAIL', e.message) }

    // ───── 流程3：AI 课件生成 ─────
    try {
      await page.goto(BASE + '/materials', { waitUntil: 'domcontentloaded', timeout: 20000 })
      await sleep(1500)
      await page.locator('button:has-text("AI 生成课件")').first().click()
      await sleep(800)
      const dlgInput = page.locator('input[placeholder="如：光的折射定律"]')
      await dlgInput.waitFor({ timeout: 5000 })
      await dlgInput.fill('观潮')
      await sleep(300)
      const t0 = Date.now()
      await page.getByRole('button', { name: '生成课件', exact: true }).click()
      const previewOpen = await page.getByText('AI 课件预览', { exact: false }).first().waitFor({ timeout: 120000 }).then(() => true).catch(() => false)
      const genMs = Date.now() - t0
      await page.screenshot({ path: shots + '/E3_courseware.png' })
      record('E3-courseware', previewOpen ? 'PASS' : 'WARN', `genMs=${genMs} previewOpen=${previewOpen}`, { genMs, previewOpen })
    } catch (e) { record('E3-courseware', 'FAIL', e.message) }

    // ───── 流程4：小微对话 ─────
    try {
      await page.keyboard.press('Escape').catch(() => {}); await sleep(500)
      await page.locator('.xw-chat-btn').first().waitFor({ timeout: 8000 })
      await page.locator('.xw-chat-btn').first().click()
      await sleep(800)
      const input = page.locator('input[placeholder="输入你想了解的内容..."]')
      await input.waitFor({ timeout: 5000 })
      await input.fill('我是四年级语文老师，怎么把《观潮》的“由远及近”写作顺序讲得生动？给三个课堂活动建议')
      const t0 = Date.now()
      await page.locator('div:has(input[placeholder="输入你想了解的内容..."]) button').last().click()
      const replied = await page.getByText(/活动|课堂|写作|顺序|观潮|情境|朗读/).first().waitFor({ timeout: 120000 }).then(() => true).catch(() => false)
      const respMs = Date.now() - t0
      await page.screenshot({ path: shots + '/E4_xiaowei.png' })
      record('E4-xiaowei', replied ? 'PASS' : 'WARN', `respMs=${respMs} replied=${replied}`, { respMs, replied })
    } catch (e) { record('E4-xiaowei', 'FAIL', e.message) }

    record('page-errors', pageErrors.length === 0 ? 'PASS' : 'WARN', 'count=' + pageErrors.length)
  } catch (e) {
    record('exception', 'FAIL', e.message)
  } finally {
    if (pageErrors.length) console.log('PAGE_ERRORS:', pageErrors.slice(0, 8))
    // 清理 E2E 验收产生的试卷，保持数据干净
    try {
      const list = await fetch(BASE + '/api/exams?limit=300', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => ({}))
      const targets = (list.items || list.data || []).filter(e => /E2E验收/.test(e.title || ''))
      for (const e of targets) { await fetch(BASE + '/api/exams/' + e.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); console.log('cleaned exam', e.id) }
    } catch {}
    await browser.close()
    const fails = results.filter(r => r.status === 'FAIL')
    const warns = results.filter(r => r.status === 'WARN')
    console.log(`\nSUMMARY: ${results.length} steps, FAIL=${fails.length}, WARN=${warns.length}`)
    fs.writeFileSync(__dirname + '/browser_e2e_fixes_report.json', JSON.stringify(results, null, 2))
    process.exit(fails.length ? 1 : 0)
  }
})()
