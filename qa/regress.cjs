// 知微前端回归脚本：聚焦易回归的关键路径（出题编辑/详情 + G6 知识图谱 canvas 点击崩溃点）。
// 用法：
//   BASE=http://school1.ziwi.cn node regress.cjs
// 退出码：0 = 全部 PASS；非 0 = 有 FAIL。报告写 ./regress_report.json。

const { chromium } = require('playwright')
const fs = require('fs')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const USER = process.env.QA_USER || '13800000002'
const PASS = process.env.QA_PASS || 'teacher123'
const results = []

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  const inputs = await page.$$('input')
  if (inputs.length >= 2) { await inputs[0].fill(USER); await inputs[1].fill(PASS) }
  try { await page.click('button:has-text("登录")', { timeout: 6000 }) }
  catch { try { await page.click('button[type="submit"]', { timeout: 6000 }) } catch {} }
  await page.waitForURL('**/teacher', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

async function visit(page, path, label) {
  const errors = []
  const onErr = e => errors.push(String(e.message || e) + (e.stack ? '\n  @' + (e.stack.split('\n')[1] || '').trim() : ''))
  page.on('pageerror', onErr)
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 })
  } catch (e) {
    errors.push('GOTO_FAIL: ' + e.message)
  }
  await page.waitForTimeout(3500)
  // 尝试点击 G6 canvas，触发 node:click → selectedIds 变化 → setElementState 路径（原崩溃点）
  try { await page.click('canvas', { timeout: 2000, position: { x: 200, y: 200 } }).catch(() => {}) } catch {}
  await page.waitForTimeout(800)
  let visible = false, appError = false
  try {
    visible = await page.evaluate(() => document.body ? document.body.innerText.length > 200 : false)
    appError = await page.evaluate(() => {
      const t = document.body ? document.body.innerText : ''
      const rootEmpty = document.querySelector('#root') ? document.querySelector('#root').childElementCount === 0 : false
      return /Application error|Uncaught|is not defined|Cannot read/i.test(t) || rootEmpty
    })
  } catch {}
  try { await page.screenshot({ path: `./shots/reg_${label.replace(/[\/:]/g, '_')}.png`, fullPage: false }) } catch {}
  page.off('pageerror', onErr)
  results.push({ label, path, pageErrors: errors, visible, appError })
}

;(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()
  const consoleErrs = []
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()) })
  await login(page)

  // 取一个真实 exercise id（通过 API，带 zhiwei_token）
  let exId = null
  try {
    exId = await page.evaluate(async () => {
      const token = localStorage.getItem('zhiwei_token') || ''
      const res = await fetch('/api/exercises?page=1&page_size=5', { headers: { Authorization: 'Bearer ' + token }, credentials: 'include' })
      const j = await res.json()
      const list = j?.data?.list || j?.list || j?.data?.items || j?.items || (Array.isArray(j) ? j : [])
      const first = Array.isArray(list) ? list[0] : null
      return first?.id || first?.exercise_id || first?.exerciseId || null
    })
  } catch (e) { exId = null }

  await visit(page, '/exercises/new', 'exercises_new')
  if (exId) await visit(page, `/exercises/${exId}`, 'exercises_id')

  await browser.close()

  const report = { base: BASE, results, consoleErrors: consoleErrs.slice(0, 10), exId }
  fs.writeFileSync('./regress_report.json', JSON.stringify(report, null, 2))
  let fail = 0
  results.forEach(r => {
    const ok = r.pageErrors.length === 0 && r.visible && !r.appError
    if (!ok) fail++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.label} (${r.path})  pageErrors=${r.pageErrors.length} appError=${r.appError} visible=${r.visible}` + (r.pageErrors.length ? '  ERR:' + r.pageErrors.join(' | ') : ''))
  })
  console.log('exId fetched =', exId)
  console.log(fail === 0 ? 'REGRESSION_OK' : 'REGRESSION_FAIL=' + fail)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('SCRIPT_ERR', e); process.exit(1) })
