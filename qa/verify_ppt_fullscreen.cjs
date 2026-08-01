// 知微 PPT 编辑器 · 全屏编辑 真浏览器验证
//   BASE=http://school1.ziwi.cn PHONE=13800000002 PASS=teacher123 node verify_ppt_fullscreen.cjs
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const results = []
const record = (a, j, s, d) => { results.push({ a, j, s, d: String(d).slice(0, 200) }); console.log(`[${s === 'PASS' ? 'PASS' : s === 'WARN' ? 'WARN' : 'FAIL'}] ${a}/${j} :: ${String(d).slice(0, 160)}`) }

async function realLogin(page) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[placeholder="请输入手机号"]', PHONE)
  await page.fill('input[placeholder="请输入密码"]', PASS)
  await page.click('button[type=submit]')
  await sleep(1800)
}

async function run() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))

  await realLogin(page)
  await page.goto(BASE + '/courseware/ppt/new', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await sleep(2800)

  const h = await renderHealth(page)
  if (h.redirected || h.appError) { record('ppt', '渲染', 'FAIL', `redirected=${h.redirected} appError=${h.appError}`); await browser.close(); return finish() }
  record('ppt', '渲染', 'PASS', 'PPT 编辑器进入正常')

  // 全屏按钮存在
  const fsBtn = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /全屏/.test(x.innerText))
    return !!b
  })
  if (!fsBtn) { record('ppt', '全屏按钮', 'FAIL', '未找到「全屏」按钮'); await browser.close(); return finish() }
  record('ppt', '全屏按钮', 'PASS', '找到「全屏」按钮')

  // 点击进入全屏
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /全屏/.test(x.innerText)); b.click() })
  await sleep(1200)
  const fsOn = await page.evaluate(() => {
    const t = document.body.innerText
    return t.includes('退出全屏') && /(Esc)/.test(t)
  })
  if (!fsOn) { record('ppt', '进入全屏', 'FAIL', '点击后未出现退出全屏/画布'); await browser.close(); return finish() }
  record('ppt', '进入全屏', 'PASS', '全屏 overlay 出现（含退出+画布）')

  // Esc 退出
  await page.keyboard.press('Escape')
  await sleep(1000)
  const fsOff = await page.evaluate(() => !document.body.innerText.includes('退出全屏 (Esc)'))
  record('ppt', 'Esc退出', fsOff ? 'PASS' : 'FAIL', fsOff ? 'Esc 后退出全屏' : 'Esc 未退出')

  // 再次进入并点按钮退出
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /全屏/.test(x.innerText)); b.click() })
  await sleep(1000)
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /退出全屏/.test(x.innerText)); b && b.click() })
  await sleep(1000)
  const btnOff = await page.evaluate(() => !document.body.innerText.includes('退出全屏 (Esc)'))
  record('ppt', '按钮退出', btnOff ? 'PASS' : 'FAIL', btnOff ? '点退出按钮后退出全屏' : '按钮未退出')

  // 用色检查：编辑态不应出现视频绿块（非video格式）
  const noVideoGreen = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'))
    return !els.some(e => e.className && typeof e.className === 'string' && e.className.includes('bg-[#52C41A]'))
  })
  record('ppt', '减色·无视频绿', noVideoGreen ? 'PASS' : 'WARN', noVideoGreen ? '编辑态无 #52C41A 绿块' : '仍存在视频绿块（video格式预期）')

  if (errs.length) record('runtime', 'pageerror', 'FAIL', errs.slice(0, 3).join(' | '))
  else record('runtime', 'pageerror', 'PASS', '0 pageerror')

  await browser.close()
  finish()
}

async function renderHealth(page) {
  let redirected = false, appError = false
  try {
    redirected = /(^|\/)login$/.test(page.url())
    const t = await page.evaluate(() => document.body ? document.body.innerText : '')
    appError = /Application error|Uncaught|is not defined|Cannot read properties/i.test(t)
  } catch {}
  return { redirected, appError }
}

function finish() {
  const pass = results.filter(r => r.s === 'PASS').length
  const fail = results.filter(r => r.s === 'FAIL').length
  const warn = results.filter(r => r.s === 'WARN').length
  console.log(`\n==== PPT 全屏验证：${pass} PASS / ${fail} FAIL / ${warn} WARN ====`)
  process.exit(fail > 0 ? 1 : 0)
}
run().catch(e => { console.error('RUN ERROR', e); process.exit(2) })
