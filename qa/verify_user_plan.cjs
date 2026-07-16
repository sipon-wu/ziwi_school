/**
 * 针对用户指定真实教案 lp_ee1dd53dfaf9（doc 模式）插入公式的真浏览器截图脚本。
 * 不新建、不删除，只在该真实文档里插入公式并截图，截图存 /tmp/frames_user/。
 */
const { chromium } = require('playwright')
const fs = require('fs')

const BASE = process.env.BASE || 'https://school1.ziwi.cn'
const PLAN_ID = process.env.PLAN_ID || 'lp_ee1dd53dfaf9'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const OUT = '/tmp/frames_user'
fs.mkdirSync(OUT, { recursive: true })

const out = []
const w = (s) => { out.push(s); fs.writeFileSync(OUT + '/report.txt', out.join('\n')); console.log(s) }
const shot = async (p, name) => { try { await p.screenshot({ path: OUT + '/' + name }) } catch (e) { w('  shot失败 ' + name + ' ' + e.message) }; w('  📸 ' + name + ' -> ' + OUT + '/' + name) }

const api = (path, opts = {}) => fetch(BASE + path, opts).then(r => r.json().catch(() => ({})))

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } })
  const errs = []
  p.on('pageerror', e => errs.push('[pageerror] ' + (e.stack || e.message)))
  p.on('console', m => { if (m.type() === 'error') errs.push('[c.err] ' + m.text()) })

  const login = await api('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const token = login.token
  w('=== TOKEN ' + (token ? 'OK' : 'FAILED ' + JSON.stringify(login)) + ' ===')
  if (!token) { await b.close(); return }
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  await p.addInitScript(t => { if (t) localStorage.setItem('zhiwei_token', t) }, token)

  // 读原文档，作为对照
  const orig = await api('/api/lesson-plans/' + PLAN_ID, { headers: H })
  w('=== 打开真实教案 title=' + JSON.stringify(orig.title) + ' content.len=' + (orig.content || '').length + ' ===')

  const formulaBtn = 'button[title="插入数学公式（图片式容器）"]'
  const openPlan = async () => {
    await p.goto(BASE + '/lesson-plans/' + PLAN_ID + '/edit?mode=doc', { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.ProseMirror', { timeout: 30000 })
    await p.waitForTimeout(1500)
  }
  const katexCount = async () => p.$$eval('.ProseMirror .katex', e => e.length).catch(() => 0)
  const liveFormulas = async () => p.$$eval('.formula-box-container', els => els.map(e => ({ latex: e.getAttribute('data-latex'), wrap: e.getAttribute('data-wrap') }))).catch(() => 'ERR')

  // ===== 0. 进入文档前 =====
  w('=== 0: 进入 doc 模式（插入前）===')
  await openPlan()
  await shot(p, '00_before.png')
  w('  插入前 KaTeX=' + await katexCount() + ' 公式数=' + JSON.stringify(await liveFormulas()))

  // ===== 1. 插入块级公式 =====
  w('=== 1: 插入块级数学公式 a^2+b^2=c^2 ===')
  await p.locator(formulaBtn).click()
  await p.waitForSelector('textarea.font-mono', { timeout: 8000 })
  await p.locator('textarea.font-mono').click()
  await p.locator('textarea.font-mono').fill('a^{2} + b^{2} = c^{2}')
  await p.locator('button', { hasText: '插入到文档' }).click()
  await p.waitForTimeout(1200)
  await shot(p, '01_block_inserted.png')
  w('  块级插入后 live=' + JSON.stringify(await liveFormulas()) + ' KaTeX=' + await katexCount())

  // ===== 2. 插入行内公式（把光标放到段落内，再插入行内字间）=====
  w('=== 2: 插入行内公式 E=mc^2（行内字间）===')
  // 把光标放到 ProseMirror 第一段文本末尾
  await p.locator('.ProseMirror').click()
  await p.waitForTimeout(300)
  await p.locator(formulaBtn).click()
  await p.waitForSelector('textarea.font-mono', { timeout: 8000 })
  await p.locator('textarea.font-mono').click()
  await p.locator('textarea.font-mono').fill('E = mc^{2}')
  await p.locator('button', { hasText: '行内字间' }).click()
  await p.waitForTimeout(200)
  await p.locator('button', { hasText: '插入到文档' }).click()
  await p.waitForTimeout(1200)
  await shot(p, '02_inline_inserted.png')
  w('  行内插入后 live=' + JSON.stringify(await liveFormulas()) + ' KaTeX=' + await katexCount())

  // ===== 3. 保存草稿 =====
  w('=== 3: 保存为草稿 ===')
  await p.getByText('保存为草稿').click()
  await p.waitForTimeout(3000)
  const afterSave = await api('/api/lesson-plans/' + PLAN_ID, { headers: H })
  const c = afterSave.content || ''
  const cnt = (re) => (c.match(re) || []).length
  w('  保存后 API content len=' + c.length + ' data-formula=' + cnt(/data-formula/g) + ' data-latex=' + cnt(/data-latex/g) + ' data-wrap=' + cnt(/data-wrap/g) + ' data-kind=' + cnt(/data-kind/g))
  await shot(p, '03_after_save.png')

  // ===== 4. 重新打开（持久化验证）=====
  w('=== 4: 重开验证持久化 ===')
  await openPlan()
  await shot(p, '04_reload.png')
  w('  重开 live=' + JSON.stringify(await liveFormulas()) + ' KaTeX=' + await katexCount())

  w('=== 控制台/页面错误 ===')
  w(errs.length ? errs.join('\n') : '(无)')
  await b.close(); w('DONE')
})().catch(e => { console.error('FATAL', e); process.exit(1) })
