/**
 * 验证公式插入到【光标位置】而非文档末尾（真浏览器）。
 * 自建教案，在段落中间放光标插入块级+行内公式，验证公式出现在光标处（其后仍有文字）。
 */
const { chromium } = require('playwright')
const fs = require('fs')
const BASE = process.env.BASE || 'https://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const OUT = '/tmp/frames_cursor'
fs.mkdirSync(OUT, { recursive: true })
const out = []
const w = (s) => { out.push(s); fs.writeFileSync(OUT + '/report.txt', out.join('\n')); console.log(s) }
const shot = async (p, n) => { try { await p.screenshot({ path: OUT + '/' + n }) } catch {}; w('  📸 ' + OUT + '/' + n) }
const api = (path, opts = {}) => fetch(BASE + path, opts).then(r => r.json().catch(() => ({})))

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } })
  const errs = []
  p.on('pageerror', e => errs.push('[pageerror] ' + (e.stack || e.message)))
  p.on('console', m => { if (m.type() === 'error') errs.push('[c.err] ' + m.text()) })

  const login = await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: PHONE, password: PASS }) })
  const token = login.token
  w('=== TOKEN ' + (token ? 'OK' : 'FAIL ' + JSON.stringify(login)) + ' ===')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  await p.addInitScript(t => { if (t) localStorage.setItem('zhiwei_token', t) }, token)

  // 第一段中间含标记词"书签位置"，其后有"后面还有文字"
  const MD = '# 验证插入位置\n\n这是第一段，前面文字书签位置MARKER后面还有文字。\n\n这是第二段在文末。\n'
  const plan = await api('/api/lesson-plans', { method: 'POST', headers: H, body: JSON.stringify({ title: '插入位置验证', subject: '数学', grade: '八年级', content: MD }) })
  const id = plan.id
  w('=== 新建 id=' + id + ' ===')
  if (!id) { w('FATAL ' + JSON.stringify(plan)); await b.close(); return }

  const formulaBtn = 'button[title="插入数学公式（图片式容器）"]'
  const openPlan = async () => { await p.goto(BASE + '/lesson-plans/' + id + '/edit?mode=doc', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.ProseMirror', { timeout: 30000 }); await p.waitForTimeout(1500) }

  // 结构快照：返回每个顶层块的类型与前若干字
  const struct = async () => p.evaluate(() => {
    const pm = document.querySelector('.ProseMirror')
    return Array.from(pm.children).map(ch => ({ tag: ch.tagName, text: (ch.innerText || '').slice(0, 24), hasKatex: !!ch.querySelector('.katex') }))
  }).catch(() => 'ERR')

  await openPlan()
  w('=== 初始结构 ===')
  w(JSON.stringify(await struct()))

  // ---- 在段落中间放光标：用精确坐标点击第一段内部（x=60 处，约开头附近）----
  w('=== 第一段 x=60 处放光标，插块级公式 x^2 ===')
  const box = await p.locator('.ProseMirror p').first().boundingBox()
  await p.mouse.click(box.x + 60, box.y + box.height / 2)
  await p.waitForTimeout(300)
  const selDbg = await p.evaluate(() => { const s = window.getSelection(); const r = s.getRangeAt(0); return { text: s.anchorNode && s.anchorNode.textContent ? s.anchorNode.textContent.slice(0, 20) : '', offset: s.anchorOffset } })
  w('  点击后 DOM 选区=' + JSON.stringify(selDbg))
  await p.locator(formulaBtn).click()
  await p.waitForSelector('textarea.font-mono', { timeout: 8000 })
  await p.locator('textarea.font-mono').click()
  await p.locator('textarea.font-mono').fill('x^{2}')
  await p.locator('button', { hasText: '插入到文档' }).click()
  await p.waitForTimeout(1200)
  await shot(p, '01_block_at_cursor.png')
  w('  插入后结构=' + JSON.stringify(await struct()))
  w('  段落内 KaTeX=' + await p.$$eval('.ProseMirror .katex', e => e.length).catch(() => 0))

  // ---- 在第二段中间插行内公式（精确坐标）----
  w('=== 第二段 x=60 处插行内公式 E=mc^2 ===')
  const box2 = await p.locator('.ProseMirror p').nth(1).boundingBox()
  await p.mouse.click(box2.x + 60, box2.y + box2.height / 2)
  await p.waitForTimeout(300)
  await p.locator(formulaBtn).click()
  await p.waitForSelector('textarea.font-mono', { timeout: 8000 })
  await p.locator('textarea.font-mono').click()
  await p.locator('textarea.font-mono').fill('E = mc^{2}')
  await p.locator('button', { hasText: '行内字间' }).click()
  await p.waitForTimeout(200)
  await p.locator('button', { hasText: '插入到文档' }).click()
  await p.waitForTimeout(1200)
  await shot(p, '02_inline_at_cursor.png')
  const inlineCheck = await p.evaluate(() => {
    const k = document.querySelector('.ProseMirror .katex')
    if (!k) return 'NO_KATEX'
    const para = k.closest('p')
    return { paraText: (para ? para.innerText : '').slice(0, 40), katexInSamePara: !!para }
  }).catch(() => 'ERR')
  w('  行内检查=' + JSON.stringify(inlineCheck))

  await p.getByText('保存为草稿').click()
  await p.waitForTimeout(3000)
  const after = await api('/api/lesson-plans/' + id, { headers: H })
  const c = after.content || ''
  const cnt = (re) => (c.match(re) || []).length
  w('  保存后 content data-formula=' + cnt(/data-formula/g) + ' data-latex=' + cnt(/data-latex/g))

  await openPlan()
  await shot(p, '03_reload.png')
  w('  重开结构=' + JSON.stringify(await struct()))

  w('=== 错误 ===')
  w(errs.length ? errs.join('\n') : '(无)')
  await api('/api/lesson-plans/' + id, { method: 'DELETE', headers: H }).then(() => w('=== 清理 OK ==='))
  await b.close(); w('DONE')
})().catch(e => { console.error('FATAL', e); process.exit(1) })
