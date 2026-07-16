const { chromium } = require('playwright')
const fs = require('fs')

const BASE = 'http://school1.ziwi.cn'
const TARGET = '/lesson-plans/lp_681dff3a6a7b/edit?mode=doc'
const OUT = '/tmp/frames'
fs.mkdirSync(OUT, { recursive: true })

const out = []
const w = (s) => { out.push(s); fs.writeFileSync(OUT + '/report.txt', out.join('\n')); }
const shot = async (p, name) => { await p.screenshot({ path: OUT + '/' + name }); w('  📸 ' + name) }

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } })
  const errs = []
  p.on('pageerror', e => errs.push('[pageerror] ' + (e.stack || e.message)))
  p.on('console', m => { if (m.type() === 'error') errs.push('[c.err] ' + m.text()) })
  await p.addInitScript(t => { if (t) localStorage.setItem('zhiwei_token', t) }, process.env.TOKEN)

  const formulaBtn = 'button[title="插入数学公式（图片式容器）"]'
  const fsContainer = p.locator('div.fixed.inset-0.bg-white')

  w('=== STEP 1: 打开文档模式（content 为 Markdown）===')
  await p.goto(BASE + TARGET, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.ProseMirror', { timeout: 30000 })
  await p.waitForTimeout(1500)
  await shot(p, 'frame1_doc.png')
  const docRaw = await p.$eval('.ProseMirror', el => el.innerText.includes('## ')).catch(() => null)
  const docH2 = await p.$$eval('.ProseMirror h2', e => e.length).catch(() => 0)
  w('  文档模式: 含原始"## "=' + docRaw + ', h2=' + docH2)

  w('=== STEP 2: 进入全屏（内容仍为 Markdown，验证不再 #/##）===')
  await p.getByText('全屏', { exact: true }).click()
  await p.waitForTimeout(1500)
  await shot(p, 'frame2_fullscreen.png')
  const fsRaw = await p.evaluate(() => {
    const c = document.querySelector('div.fixed.inset-0.bg-white')
    const pm = c && c.querySelector('.ProseMirror')
    return pm ? pm.innerText.includes('## ') : 'no-pm'
  }).catch(() => 'ERR')
  const fsH2 = await p.evaluate(() => {
    const c = document.querySelector('div.fixed.inset-0.bg-white')
    return c ? c.querySelectorAll('.ProseMirror h2').length : 0
  }).catch(() => 0)
  w('  全屏: 含原始"## "=' + fsRaw + ', h2=' + fsH2)

  w('=== STEP 3: 退出全屏 ===')
  await fsContainer.getByText('完成', { exact: true }).click()
  await p.waitForTimeout(800)

  w('=== STEP 4: 插入块级公式（勾股定理）并保存 ===')
  await p.locator(formulaBtn).click()
  await p.waitForSelector('textarea.font-mono', { timeout: 8000 })
  await p.locator('textarea.font-mono').click()
  await p.locator('textarea.font-mono').fill('a^{2} + b^{2} = c^{2}')
  await p.waitForTimeout(400)
  await p.locator('button', { hasText: '插入到文档' }).click()
  await p.waitForTimeout(1200)
  await shot(p, 'frame3_inserted.png')
  const k1 = await p.$$eval('.ProseMirror .katex', e => e.length).catch(() => 0)
  w('  插入后 KaTeX 数=' + k1)

  await p.getByText('保存为草稿').click()
  await p.waitForTimeout(2500)
  w('  已保存')

  w('=== STEP 5: 重开页面（验证公式持久化 / 序列化修复）===')
  await p.goto(BASE + TARGET, { waitUntil: 'domcontentloaded' })
  try {
    await p.waitForSelector('.ProseMirror', { timeout: 45000 })
    w('✅ 重开后 .ProseMirror 挂载')
  } catch (e) {
    w('❌ 重开 45s 内未挂载')
    await shot(p, 'frame4_fail.png')
    const diag = await p.evaluate(() => ({
      url: location.href,
      rootLen: document.getElementById('root') ? document.getElementById('root').innerHTML.length : -1,
      bodyText: document.body.innerText.slice(0, 200),
    })).catch(() => 'eval-err')
    w('  DIAG=' + JSON.stringify(diag))
    w('  控制台错误: ' + (errs.join(' | ') || '(无)'))
    await b.close(); console.log(out.join('\n')); return
  }
  await p.waitForTimeout(2000)
  await shot(p, 'frame4_after_reload.png')
  const fInfo = await p.$$eval('.ProseMirror [data-formula]', els => els.map(e => ({ latex: e.getAttribute('data-latex'), kind: e.getAttribute('data-kind') }))).catch(() => 'ERR')
  const k2 = await p.$$eval('.ProseMirror .katex', e => e.length).catch(() => 0)
  w('  重开后 [data-formula]=' + JSON.stringify(fInfo) + ', KaTeX=' + k2)

  w('=== STEP 6: 全屏内插入行内公式，验证全屏编辑可用 ===')
  await p.getByText('全屏', { exact: true }).click()
  await p.waitForTimeout(1200)
  await fsContainer.locator(formulaBtn).click()
  await p.waitForSelector('textarea.font-mono', { timeout: 8000 })
  await p.locator('textarea.font-mono').click()
  await p.locator('textarea.font-mono').fill('E = mc^{2}')
  await p.waitForTimeout(300)
  await p.locator('button', { hasText: '行内字间' }).click()
  await p.locator('button', { hasText: '插入到文档' }).click()
  await p.waitForTimeout(1200)
  await shot(p, 'frame5_fs_inline.png')
  const inlineInfo = await p.evaluate(() => {
    const c = document.querySelector('div.fixed.inset-0.bg-white')
    const els = c ? c.querySelectorAll('.ProseMirror [data-formula-inline]') : []
    return Array.from(els).map(e => e.getAttribute('data-latex'))
  }).catch(() => 'ERR')
  w('  全屏行内公式 latex=' + JSON.stringify(inlineInfo))
  await fsContainer.getByText('完成', { exact: true }).click()
  await p.waitForTimeout(1000)
  await shot(p, 'frame6_final.png')

  w('=== 控制台错误 ===')
  w(errs.length ? errs.join('\n') : '(无)')
  await b.close()
  w('DONE')
  console.log(out.join('\n'))
})().catch(e => { w('FATAL ' + e.message); console.error(e); process.exit(1) })
