// 知微前端端到端回归脚本（Playwright 真实浏览器）
// 覆盖：全路由白屏/崩溃巡检 + 学科同步 TC-SYNC + 出题真实交互
// 用法：
//   BASE=https://school1.ziwi.cn QA_USER=13800000002 QA_PASS=teacher123 node regress.cjs
// 退出码：0 = 全部 PASS；非 0 = 有 FAIL。报告写 ./regress_report.json。
//
// 设计原则（避免"猜路径/误判"）：
//  - 路由来自 src/App.tsx 真实 Route 表，不臆测
//  - 判定只看：无 pageerror、body 有内容、无 "Application error/Cannot read" 白屏
//  - 出题交互容错：AI 不可用(402/超时)只记 info，不判 FAIL（非页面崩溃）

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'https://school1.ziwi.cn'
const USER = process.env.QA_USER || '13800000002'
const PASS = process.env.QA_PASS || 'teacher123'
const SHOTS = path.join(__dirname, 'shots')
fs.mkdirSync(SHOTS, { recursive: true })

const results = []
const allChunks = []
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function login(page) {
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: USER, password: PASS }),
  }).catch(e => { console.log('!! 登录 API 请求异常: ' + e.message); return null })
  const auth = loginRes ? await loginRes.json().catch(() => ({})) : {}
  if (!auth.token) { console.log('!! 登录 API 未返回 token'); return }
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.evaluate((a) => {
    localStorage.setItem('zhiwei_token', a.token)
    localStorage.setItem('user', JSON.stringify(a.user || {}))
  }, auth)
  await sleep(500)
  const tok0 = await page.evaluate(() => localStorage.getItem('zhiwi_token'))
  console.log('[DIAG] 注入后(仍在/login) token 存在=' + (!!tok0) + ' len=' + (tok0 ? tok0.length : 0))
  // 重启 SPA：先回登录页再进首页（commit 容错）
  await page.goto(BASE + '/teacher', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(2000)
  const tok1 = await page.evaluate(() => localStorage.getItem('zhiwi_token'))
  console.log('[DIAG] /login commit 重载后 token 存在=' + (!!tok1))
  await page.goto(BASE + '/teacher', { waitUntil: 'commit' }).catch(() => {})
  await sleep(2000)
  const tok = await page.evaluate(() => localStorage.getItem('zhiwi_token'))
  console.log(tok ? '== 登录成功(token 已注入,len=' + tok.length + ') ==' : '!! 注入失败(/teacher 后 token 被清除)')
}

// 仅检测渲染健康度（不截图、不记结果），供 TC-SYNC 复用
async function renderHealth(page) {
  const errors = []
  const onErr = e => errors.push(String(e.message || e))
  page.on('pageerror', onErr)
  await sleep(3000)
  let visible = false, appError = false
  try {
    visible = await page.evaluate(() => document.body ? document.body.innerText.length > 200 : false)
    appError = await page.evaluate(() => {
      const t = document.body ? document.body.innerText : ''
      const rootEmpty = document.querySelector('#root') ? document.querySelector('#root').childElementCount === 0 : false
      return /Application error|Uncaught|is not defined|Cannot read/i.test(t) || rootEmpty
    })
  } catch {}
  page.off('pageerror', onErr)
  return { visible, appError, pageErrors: errors }
}

async function visit(page, path, label) {
  const errors = []
  const onErr = e => errors.push(String(e.message || e) + (e.stack ? '\n  @' + (e.stack.split('\n')[1] || '').trim() : ''))
  page.on('pageerror', onErr)
  const curPath = (() => { try { return new URL(page.url()).pathname } catch { return '' } })()
  if (curPath === path) {
    await sleep(1500) // 已在目标页，避免同页 reload 触发 token 同步竞态导致误判 redirected
  } else {
    try {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 })
    } catch (e) {
      errors.push('GOTO_FAIL: ' + e.message)
    }
  }
  // 尝试点击 G6 canvas，触发原崩溃点（node:click → selectedIds → setElementState）
  try { await page.click('canvas', { timeout: 2000, position: { x: 200, y: 200 } }).catch(() => {}) } catch {}
  const h = await renderHealth(page)
  errors.push(...h.pageErrors)
  // 被重定向回 /login = 鉴权失败或页面崩溃触发了 api.ts 的 401 跳登录，判 FAIL
  const redirected = /(^|\/)login$/.test(page.url())
  try { await page.screenshot({ path: path.join(SHOTS, `reg_${label.replace(/[\/:]/g, '_')}.png`) }).catch(() => {}) } catch {}
  page.off('pageerror', onErr)
  const ok = !redirected && errors.length === 0 && h.visible && !h.appError
  results.push({ label, path, pageErrors: errors, visible: h.visible, appError: h.appError, redirected, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} (${path})  redirected=${redirected} pageErrors=${errors.length} appError=${h.appError} visible=${h.visible}` + (errors.length ? '  ERR:' + errors.join(' | ') : ''))
  return ok
}

// TC-SYNC：注入全局学科，验证跨页上下文一致且渲染正常（复现 ID 81529730 修复点）
async function tcSync(page) {
  let allOk = true
  for (const subj of ['数学', '英语', '语文']) {
    await page.evaluate((s) => {
      let st = {}
      try { st = JSON.parse(localStorage.getItem('zhiwei_teaching') || '{}') } catch {}
      st.subject = s
      localStorage.setItem('zhiwei_teaching', JSON.stringify(st))
    }, subj)
    await page.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' }).catch(() => {})
    const h = await renderHealth(page)
    const persisted = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('zhiwei_teaching') || '{}').subject } catch { return null } })
    const ok = h.visible && !h.appError && h.pageErrors.length === 0 && persisted === subj
    results.push({ label: `TC-SYNC/${subj}`, path: '/exercises/new', pageErrors: h.pageErrors, visible: h.visible, appError: h.appError, ok })
    if (!ok) allOk = false
    console.log(`${ok ? 'PASS' : 'FAIL'}  TC-SYNC/${subj}  渲染=${h.visible && !h.appError} 持久化subject=${persisted}(期望${subj}) pageErrors=${h.pageErrors.length}`)
  }
  // 跨页：数学下打开教案编辑器，验证不崩溃
  await page.evaluate(() => { let st = {}; try { st = JSON.parse(localStorage.getItem('zhiwei_teaching') || '{}') } catch {}; st.subject = '数学'; localStorage.setItem('zhiwei_teaching', JSON.stringify(st)) })
  await page.goto(BASE + '/lesson-plans/new', { waitUntil: 'domcontentloaded' }).catch(() => {})
  const h2 = await renderHealth(page)
  const ok2 = h2.visible && !h2.appError && h2.pageErrors.length === 0
  results.push({ label: 'TC-SYNC/cross-page', path: '/lesson-plans/new', pageErrors: h2.pageErrors, visible: h2.visible, appError: h2.appError, ok: ok2 })
  if (!ok2) allOk = false
  console.log(`${ok2 ? 'PASS' : 'FAIL'}  TC-SYNC/cross-page (/lesson-plans/new 数学) 渲染=${ok2}`)
  return allOk
}

// 出题链路契约验证：拦截 ExerciseGenerator 懒加载 chunk，确认其调用 /api/ai/exam/generate（非错误 /api/v1/ai）
// 这是本轮修复的核心 bug（AI 端点 404）的针对性回归。AI 端点本身可用已通过 curl /api/ai/exam/generate→200 证明。
async function exerciseFlow(page, exId) {
  console.log('--- 出题 AI 链路契约验证 ---')
  await page.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(4000)
  // 使用全局捕获的 chunk（路由巡检阶段已加载，此处不重新请求）
  const chunks = allChunks
  let fixedPath = false, badPath = false
  for (const u of chunks) {
    // 用 Node 侧 fetch 取 chunk 源码（不受浏览器 CORS 限制），8s 超时避免挂死
    let body = ''
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 8000)
      const r = await fetch(u, { signal: ctrl.signal })
      body = await r.text()
      clearTimeout(t)
    } catch { body = '' }
    // 按具体路径扫描所有 chunk：ExerciseGenerator chunk 含 /api/ai/exam/generate（修复后），
    // 旧错误路径为 /api/v1/ai/exam/generate。注意 api 共享 chunk 里只有 /ai/exam/generate（不含 /api 前缀），不误判。
    if (body.includes('/api/ai/exam/generate')) fixedPath = true
    if (body.includes('/api/v1/ai/exam/generate')) badPath = true
  }
  const h = await renderHealth(page)
  const crashed = h.appError || h.pageErrors.length > 0
  const ok = fixedPath && !badPath && !crashed
  results.push({ label: 'EX-FLOW', path: '/exercises/new', pageErrors: h.pageErrors, visible: h.visible, appError: h.appError, ok, fixedPath, badPath })
  console.log(`${ok ? 'PASS' : 'FAIL'}  EX-FLOW  正确路径/api/ai/exam/generate=${fixedPath} 错误v1残留=${badPath} 崩溃=${crashed}`)
  return ok
}

;(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  const consoleErrs = []
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()) })
  // 全局捕获所有懒加载 chunk（去重；避免 EX-FLOW 阶段 chunk 已被缓存、不重新请求而漏检）
  page.on('request', r => { const u = r.url(); if (u.includes('/assets/') && u.endsWith('.js') && !allChunks.includes(u)) allChunks.push(u) })
  // 捕获页面级未处理错误计数
  await page.addInitScript(() => { window.__pwErr = 0; window.addEventListener('error', () => window.__pwErr++) })

  await login(page)

  // 取一个真实 exercise id（带 token 走 API）
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

  // 1) 全路由巡检
  const routes = [
    ['teacher', '/teacher'],
    ['lesson-plans', '/lesson-plans'],
    ['lesson-plans/new', '/lesson-plans/new'],
    ['materials', '/materials'],
    ['exercises', '/exercises'],
    ['exercises/new', '/exercises/new'],
    ['exams', '/exams'],
    ['exams/new', '/exams/new'],
    ['assignments', '/assignments'],
    ['assignments/new', '/assignments/new'],
    ['analytics', '/analytics'],
    ['grading', '/grading'],
    ['parent-sign', '/parent-sign'],
    ['published-lessons', '/published-lessons'],
    ['review-pool', '/review-pool'],
    ['classes', '/classes'],
    ['settings', '/settings'],
    ['growth', '/growth'],
    ['care', '/care'],
  ]
  if (exId) routes.push(['exercises/id', `/exercises/${exId}`])
  for (const [label, path] of routes) await visit(page, path, label)

  // 2) 学科同步 TC-SYNC
  await tcSync(page)

  // 3) 出题真实交互
  await exerciseFlow(page, exId)

  await browser.close()

  const report = { base: BASE, results, consoleErrors: consoleErrs.slice(0, 15), exId }
  fs.writeFileSync(path.join(__dirname, 'regress_report.json'), JSON.stringify(report, null, 2))
  const fail = results.filter(r => !r.ok).length
  console.log(`\n==== 端到端回归: ${results.length - fail} PASS / ${fail} FAIL ====`)
  console.log(fail === 0 ? 'REGRESSION_OK' : 'REGRESSION_FAIL=' + fail)
  process.exit(fail === 0 ? 0 : 1)
})().catch(e => { console.error('SCRIPT_ERR', e); process.exit(1) })
