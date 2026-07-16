const { chromium } = require('playwright')
const fs = require('fs')
const PID = process.env.PID
const BASE = 'http://school1.ziwi.cn'
const TARGET = '/lesson-plans/' + PID + '/edit?mode=doc'
const OUT = '/tmp/frames'
fs.mkdirSync(OUT, { recursive: true })
const out = []
const w = (s) => { out.push(s); fs.writeFileSync(OUT + '/clean_report.txt', out.join('\n')) }
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } })
  const errs = []
  p.on('pageerror', e => errs.push('[pageerror] ' + (e.stack || e.message)))
  await p.addInitScript(t => { if (t) localStorage.setItem('zhiwei_token', t) }, process.env.TOKEN)
  w('=== 干净计划 ' + PID + ' ===')
  await p.goto(BASE + TARGET, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.ProseMirror', { timeout: 30000 })
  await p.waitForTimeout(1200)
  w('✅ 初始挂载')
  await p.locator('button[title="插入数学公式（图片式容器）"]').click()
  await p.waitForSelector('textarea.font-mono', { timeout: 8000 })
  await p.locator('textarea.font-mono').click()
  await p.locator('textarea.font-mono').fill('x^{2} + y^{2} = r^{2}')
  await p.waitForTimeout(300)
  await p.locator('button', { hasText: '插入到文档' }).click()
  await p.waitForTimeout(1000)
  const k1 = await p.$$eval('.ProseMirror .katex', e => e.length).catch(()=>0)
  w('插入后 KaTeX=' + k1)
  await p.screenshot({ path: OUT + '/clean_insert.png' })
  await p.getByText('保存为草稿').click()
  await p.waitForTimeout(2500)
  w('已保存')
  await p.goto(BASE + TARGET, { waitUntil: 'domcontentloaded' })
  try {
    await p.waitForSelector('.ProseMirror', { timeout: 30000 })
    w('✅ 重开挂载')
  } catch (e) {
    w('❌ 重开崩溃')
    await p.screenshot({ path: OUT + '/clean_crash.png' })
    w('错误: ' + (errs.join('\n') || '(无)'))
    await b.close(); console.log(out.join('\n')); return
  }
  await p.waitForTimeout(2000)
  const fInfo = await p.$$eval('.ProseMirror [data-formula]', els => els.map(e => e.getAttribute('data-latex'))).catch(()=>'ERR')
  const k2 = await p.$$eval('.ProseMirror .katex', e => e.length).catch(()=>0)
  w('重开后 data-formula latex=' + JSON.stringify(fInfo) + ', KaTeX=' + k2)
  await p.screenshot({ path: OUT + '/clean_reload.png' })
  w('错误(若有): ' + (errs.join('\n') || '(无)'))
  await b.close()
  w('DONE')
  console.log(out.join('\n'))
})().catch(e => { w('FATAL ' + e.message); console.error(e); process.exit(1) })
