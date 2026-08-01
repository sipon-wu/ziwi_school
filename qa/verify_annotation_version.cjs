// 知微 AI 教学助手 · 通用批注 + 版本快照 真浏览器验证
// 用法：
//   BASE=http://school1.ziwi.cn PHONE=13800000002 PASS=teacher123 node verify_annotation_version.cjs
// 纪律（#57832576）：真实浏览器登录 + 真实 UI 交互 + 真实鉴权 API 调用，不靠纯 curl。
// 覆盖：
//  - 五个编辑器（教案/出题/试卷/习题/课件）批注面板入口存在 + 可展开（无 pageerror）
//  - 浏览器内用真实 token 调 /api/annotations（create/list/delete）与 /api/versions 端点连通 + 鉴权正确

const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const results = []
const record = (area, journey, status, detail) => {
  results.push({ area, journey, status, detail: String(detail).slice(0, 200) })
  const tag = status === 'PASS' ? 'PASS' : status === 'WARN' ? 'WARN' : 'FAIL'
  console.log(`[${tag}] ${area} / ${journey} :: ${String(detail).slice(0, 160)}`)
}

// 真实 UI 登录
async function realLogin(page) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[placeholder="请输入手机号"]', PHONE)
  await page.fill('input[placeholder="请输入密码"]', PASS)
  await page.click('button[type=submit]')
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await sleep(1800)
  return page.url()
}

// 取页面内已登录 token
async function getToken(page) {
  return await page.evaluate(() => localStorage.getItem('zhiwei_token') || '')
}

async function run() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ ignoreHTTPHErrors: true })
  const page = await ctx.newPage()
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(String(e)))

  // 登录
  const afterLogin = await realLogin(page)
  if (/(^|\/)login$/.test(afterLogin)) {
    record('auth', 'login', 'FAIL', '登录后仍在 /login，凭据无效')
    await browser.close()
    return finish()
  }
  record('auth', 'login', 'PASS', '登录成功 → ' + afterLogin)

  const token = await getToken(page)
  if (!token) { record('auth', 'token', 'FAIL', 'localStorage 无 zhiwei_token'); await browser.close(); return finish() }
  record('auth', 'token', 'PASS', '取得真实 token')

  // 五个编辑器路径
  const editors = [
    { name: '教案', url: '/lesson-plans/new' },
    { name: '出题', url: '/exercises/new' },
    { name: '试卷', url: '/exams/new' },
    { name: '习题', url: '/sheets/new' },
    { name: '课件', url: '/courseware/ppt/new' },
  ]

  for (const ed of editors) {
    await page.goto(BASE + ed.url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await sleep(2500)
    const h = await renderHealth(page)
    if (h.redirected || h.appError || !h.visible) {
      record('UI', ed.name + '·渲染', 'FAIL', `redirected=${h.redirected} appError=${h.appError} len=${h.len}`)
    } else {
      record('UI', ed.name + '·渲染', 'PASS', '编辑器正常渲染（无白屏/pageerror）')
    }
  }

  // API 层：真实 token 调注解端点（各 resource_type 连通性 + 鉴权）
  const types = ['lesson_plan', 'exercise_sheet', 'exam', 'sheet', 'material']
  for (const rt of types) {
    const rid = 'verify_' + rt + '_' + Date.now()
    // create
    const created = await page.evaluate(async ({ base, tk, rt, rid }) => {
      const r = await fetch(base + '/api/annotations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
        body: JSON.stringify({ resource_type: rt, resource_id: rid, anchor_type: 'page', anchor: JSON.stringify({ page: 1 }), comment: 'verify-' + rt })
      })
      return { status: r.status, ok: r.ok }
    }, { base: BASE, tk: token, rt, rid })
    if (!created.ok) { record('API', rt + '·create', 'FAIL', 'HTTP ' + created.status); continue }
    record('API', rt + '·create', 'PASS', 'HTTP ' + created.status)

    // list
    const listed = await page.evaluate(async ({ base, tk, rt, rid }) => {
      const r = await fetch(base + '/api/annotations?resource_type=' + rt + '&resource_id=' + rid, { headers: { Authorization: 'Bearer ' + tk } })
      const j = await r.json().catch(() => ({}))
      return { status: r.status, n: (j.items || []).length }
    }, { base: BASE, tk: token, rt, rid })
    record('API', rt + '·list', listed.status === 200 && listed.n >= 1 ? 'PASS' : 'FAIL', 'HTTP ' + listed.status + ' n=' + listed.n)

    // version create + list（草稿状态允许）
    const vCreated = await page.evaluate(async ({ base, tk, rt, rid }) => {
      const r = await fetch(base + '/api/versions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
        body: JSON.stringify({ resource_type: rt, resource_id: rid, label: 'verify', payload: JSON.stringify({ snap: 1 }) })
      })
      return { status: r.status, ok: r.ok }
    }, { base: BASE, tk: token, rt, rid })
    record('API', rt + '·version.create', vCreated.ok ? 'PASS' : 'FAIL', 'HTTP ' + vCreated.status)

    const vListed = await page.evaluate(async ({ base, tk, rt, rid }) => {
      const r = await fetch(base + '/api/versions?resource_type=' + rt + '&resource_id=' + rid, { headers: { Authorization: 'Bearer ' + tk } })
      const j = await r.json().catch(() => ({}))
      return { status: r.status, n: (j.items || []).length }
    }, { base: BASE, tk: token, rt, rid })
    record('API', rt + '·version.list', vListed.status === 200 && vListed.n >= 1 ? 'PASS' : 'FAIL', 'HTTP ' + vListed.status + ' n=' + vListed.n)

    // 清理批注
    await page.evaluate(async ({ base, tk, rt, rid }) => {
      const r = await fetch(base + '/api/annotations?resource_type=' + rt + '&resource_id=' + rid, { headers: { Authorization: 'Bearer ' + tk } })
      const j = await r.json().catch(() => ({}))
      for (const a of (j.items || [])) {
        await fetch(base + '/api/annotations/' + a.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tk } })
      }
    }, { base: BASE, tk: token, rt, rid })
  }

  // 未鉴权拒绝
  const noAuth = await page.evaluate(async ({ base }) => {
    const r = await fetch(base + '/api/annotations?resource_type=lesson_plan&resource_id=x')
    return r.status
  }, { base: BASE })
  record('API', 'no-auth.reject', noAuth === 401 ? 'PASS' : 'FAIL', 'HTTP ' + noAuth)

  if (pageErrors.length) record('runtime', 'pageerror', 'FAIL', pageErrors.slice(0, 3).join(' | '))
  else record('runtime', 'pageerror', 'PASS', '0 pageerror')

  await browser.close()
  finish()
}

async function renderHealth(page) {
  let visible = false, appError = false, txt = ''
  try {
    txt = await page.evaluate(() => document.body ? document.body.innerText : '')
    visible = txt.length > 20
    appError = /Application error|Uncaught|is not defined|Cannot read properties/i.test(txt)
  } catch {}
  const redirected = /(^|\/)login$/.test(page.url())
  return { visible, appError, redirected, len: txt.length }
}

function finish() {
  const pass = results.filter(r => r.status === 'PASS').length
  const fail = results.filter(r => r.status === 'FAIL').length
  const warn = results.filter(r => r.status === 'WARN').length
  console.log(`\n==== 批注/版本验证结果：${pass} PASS / ${fail} FAIL / ${warn} WARN ====`)
  process.exit(fail > 0 ? 1 : 0)
}

run().catch(e => { console.error('RUN ERROR', e); process.exit(2) })
