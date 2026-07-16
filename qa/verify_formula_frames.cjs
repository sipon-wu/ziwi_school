/**
 * 公式编辑器逐帧验证 v2（真浏览器 + API 真相源）
 * 关键改进：每次保存后用 API GET 读取后端 content 字段，作为持久化真相源（不依赖编辑器渲染）。
 * 覆盖：A 文档/全屏格式；B 块级；C float-left；D 全屏行内。
 */
const { chromium } = require('playwright')
const fs = require('fs')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const OUT = '/tmp/frames'
fs.mkdirSync(OUT, { recursive: true })

const out = []
const w = (s) => { out.push(s); fs.writeFileSync(OUT + '/report.txt', out.join('\n')); console.log(s) }
const shot = async (p, name) => { try { await p.screenshot({ path: OUT + '/' + name }) } catch {}; w('  📸 ' + name) }

const MD = '# 测试教案标题\n\n## 一、教学目标\n\n这是一段正文。\n\n## 二、重点难点\n\n另一条正文。\n'

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

  const plan = await api('/api/lesson-plans', { method: 'POST', headers: H, body: JSON.stringify({ title: '公式验证', subject: '数学', grade: '八年级', content: MD }) })
  const id = plan.id
  w('=== 新建教案 id=' + id + ' ===')
  if (!id) { w('FATAL ' + JSON.stringify(plan)); await b.close(); return }

  // 真相源：读后端 content，统计关键标记
  const dumpContent = async (label) => {
    const j = await api('/api/lesson-plans/' + id, { headers: H })
    const c = j.content || ''
    const cnt = (re) => (c.match(re) || []).length
    const s = `content(len=${c.length}) data-formula=${cnt(/data-formula/g)} data-latex=${cnt(/data-latex/g)} data-wrap=${cnt(/data-wrap/g)} data-kind=${cnt(/data-kind/g)}`
    w('  [API ' + label + '] ' + s)
    return c
  }

  const formulaBtn = 'button[title="插入数学公式（图片式容器）"]'
  const fsSel = 'div.fixed.inset-0.bg-white'
  const openPlan = async () => {
    await p.goto(BASE + '/lesson-plans/' + id + '/edit?mode=doc', { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.ProseMirror', { timeout: 30000 })
    await p.waitForTimeout(1500)
  }
  // 实时 DOM 公式节点（React 节点视图渲染出 data-latex，而非 data-formula）
  const liveFormulas = async () => p.$$eval('.formula-box-container', els => els.map(e => ({ latex: e.getAttribute('data-latex'), wrap: e.getAttribute('data-wrap') }))).catch(() => 'ERR')
  const liveInline = async () => p.$$eval('.formula-box-container[data-wrap="inline"]', els => els.map(e => ({ latex: e.getAttribute('data-latex') }))).catch(() => 'ERR')
  const katexCount = async () => p.$$eval('.ProseMirror .katex', e => e.length).catch(() => 0)

  const insertFormula = async (latex, wrapLabel) => {
    await p.locator(formulaBtn).click()
    await p.waitForSelector('textarea.font-mono', { timeout: 8000 })
    await p.locator('textarea.font-mono').click()
    await p.locator('textarea.font-mono').fill(latex)
    if (wrapLabel) { await p.locator('button', { hasText: wrapLabel }).click(); await p.waitForTimeout(200) }
    await p.locator('button', { hasText: '插入到文档' }).click()
    await p.waitForTimeout(1200)
  }
  const saveDraft = async () => { await p.getByText('保存为草稿').click(); await p.waitForTimeout(3000) }

  // ===== A. 文档 / 全屏 格式 =====
  w('=== A1: 文档模式格式 ===')
  await openPlan(); await shot(p, 'A1_doc.png')
  w('  文档: raw##=' + await p.$eval('.ProseMirror', el => el.innerText.includes('## ')).catch(() => '?') + ', h2=' + await p.$$eval('.ProseMirror h2', e => e.length).catch(() => 0))
  w('=== A2: 全屏格式 ===')
  await p.getByText('全屏', { exact: true }).click(); await p.waitForTimeout(1500); await shot(p, 'A2_fullscreen.png')
  w('  全屏: raw##=' + await p.evaluate(() => { const c = document.querySelector('div.fixed.inset-0.bg-white'); const pm = c && c.querySelector('.ProseMirror'); return pm ? pm.innerText.includes('## ') : 'no-pm' }).catch(() => 'ERR') + ', h2=' + await p.evaluate(() => { const c = document.querySelector('div.fixed.inset-0.bg-white'); return c ? c.querySelectorAll('.ProseMirror h2').length : 0 }).catch(() => 0))
  const fsContainer = p.locator(fsSel)
  await fsContainer.getByText('完成', { exact: true }).click(); await p.waitForTimeout(800)

  // ===== B. 块级 =====
  w('=== B: 块级公式 ===')
  await openPlan(); await insertFormula('a^{2} + b^{2} = c^{2}', null)
  await shot(p, 'B1_block.png'); w('  插入后 live=' + JSON.stringify(await liveFormulas()) + ' KaTeX=' + await katexCount())
  await saveDraft(); await dumpContent('B-save')
  await openPlan(); await shot(p, 'B2_reload.png')
  w('  重开 live=' + JSON.stringify(await liveFormulas()) + ' KaTeX=' + await katexCount())
  await dumpContent('B-reload')

  // ===== C. float-left =====
  w('=== C: float-left 公式 ===')
  await insertFormula('x_{1} + x_{2}', '四周环绕·左')
  await shot(p, 'C1_float.png'); w('  插入后 live=' + JSON.stringify(await liveFormulas()) + ' KaTeX=' + await katexCount())
  await saveDraft(); await dumpContent('C-save')
  await openPlan(); await shot(p, 'C2_reload.png')
  w('  重开 live=' + JSON.stringify(await liveFormulas()) + ' KaTeX=' + await katexCount())
  await dumpContent('C-reload')

  // ===== D. 全屏内行内 =====
  w('=== D: 全屏内行内公式 ===')
  await p.getByText('全屏', { exact: true }).click(); await p.waitForTimeout(1200)
  const fsC = p.locator(fsSel)
  await fsC.locator(formulaBtn).click(); await p.waitForSelector('textarea.font-mono', { timeout: 8000 })
  await p.locator('textarea.font-mono').click(); await p.locator('textarea.font-mono').fill('E = mc^{2}')
  await p.locator('button', { hasText: '行内字间' }).click(); await p.waitForTimeout(200)
  await p.locator('button', { hasText: '插入到文档' }).click(); await p.waitForTimeout(1200)
  await shot(p, 'D1_fs_inline.png')
  w('  全屏内 live=' + JSON.stringify(await liveFormulas()) + ' KaTeX=' + await katexCount())
  await fsC.getByText('完成', { exact: true }).click(); await p.waitForTimeout(1000)
  // 退出全屏后，先查文档态是否还含公式（验证双编辑器共享 state 不丢）
  w('  退出全屏后 doc态 live=' + JSON.stringify(await liveFormulas()) + ' KaTeX=' + await katexCount())
  await shot(p, 'D1b_doc_after_fs.png')
  await saveDraft(); await dumpContent('D-save')
  await openPlan(); await shot(p, 'D2_reload.png')
  w('  重开 live=' + JSON.stringify(await liveFormulas()) + ' 行内=' + JSON.stringify(await liveInline()) + ' KaTeX=' + await katexCount())
  await dumpContent('D-reload')

  w('=== 控制台/页面错误 ===')
  w(errs.length ? errs.join('\n') : '(无)')
  await api('/api/lesson-plans/' + id, { method: 'DELETE', headers: H }).then(() => w('=== 清理 OK ==='))
  await b.close(); w('DONE')
})().catch(e => { console.error('FATAL', e); process.exit(1) })
