// Phase 0 编辑器框架重构专项验证 · 出题页（ExerciseGenerator 迁移）
// 本地 dev :5173 + staging 后端。覆盖 P0-3 左栏基本信息卡 / P0-4 左栏底框架小微 / 业务渲染不崩
// 用法：BASE=http://localhost:5173 node verify_editor_p0_exercise.cjs
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:5173'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const results = []
const record = (check, status, detail) => {
  results.push({ check, status, detail: String(detail).slice(0, 300) })
  console.log(`[${status}] ${check} :: ${detail}`)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 864 } })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('pageerror', e => consoleErrors.push('PAGEERR: ' + (e.message || e)))

  // 登录
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[placeholder="请输入手机号"]', '13800000002')
  await page.fill('input[placeholder="请输入密码"]', 'teacher123')
  await page.click('button[type=submit]')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await sleep(1500)
  record('UI登录', page.url().includes('/teacher') ? 'PASS' : 'FAIL', `落地=${page.url()}`)

  // 出题页渲染健康
  await page.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' })
  await sleep(4000)
  const h = await page.evaluate(() => {
    const t = document.body?.innerText || ''
    return { visible: t.length > 30, appErr: /Application error|Cannot read properties|is not defined/.test(t), redir: /(^|\/)login$/.test(location.href), len: t.length }
  })
  record('出题页渲染健康', (!h.appErr && !h.redir && h.visible) ? 'PASS' : 'FAIL', `visible=${h.visible} appErr=${h.appErr} redir=${h.redir} len=${h.len}`)

  // P0-3 左栏基本信息卡
  const lp = await page.evaluate(() => {
    const t = document.body.innerText
    return { basic: /基本信息/.test(t), subj: /学科/.test(t), cls: /班级/.test(t), grade: /年级/.test(t) }
  })
  record('P0-3 左栏基本信息卡', (lp.basic && lp.subj && lp.cls && lp.grade) ? 'PASS' : 'FAIL', JSON.stringify(lp))

  // 业务渲染不崩：产品特定表单 + footer 保留
  const biz = await page.evaluate(() => {
    const t = document.body.innerText
    return { purpose: /命题用途/.test(t), saveDraft: /保存为草稿/.test(t), publish: /发布到题库/.test(t) }
  })
  record('业务渲染(命题用途/保存草稿/发布题库)', (biz.purpose && biz.saveDraft && biz.publish) ? 'PASS' : 'FAIL', JSON.stringify(biz))

  // P0-4 左栏底框架小微入口
  const xw = page.locator('button:has-text("请补充要求")')
  const xwOk = await xw.count()
  record('P0-4 小微入口(左栏底)', xwOk > 0 ? 'PASS' : 'FAIL', `入口数=${xwOk}`)

  // P0-4 小微展开
  if (xwOk > 0) {
    await xw.first().click()
    await sleep(1200)
    const panel = await page.evaluate(() => /发送|小微|补充要求|附件|对话/.test(document.body.innerText))
    record('P0-4 小微展开面板', panel ? 'PASS' : 'WARN', `面板标识=${panel}`)
    const close = page.locator('button:has-text("收起"), button[aria-label="close"]')
    if (await close.count() > 0) { await close.first().click(); await sleep(600) }
  }

  // 控制台错误（过滤 401/AI/timeout/G6 预存）
  const realErr = consoleErrors.filter(e => !/401|AI|timeout|网络|graph instance|draw|Maximum update depth|Failed to load resource.*(401|4\d\d)/i.test(e))
  record('控制台错误(非预期)', realErr.length === 0 ? 'PASS' : 'WARN', realErr.slice(0, 3).join(' | ') || '0')

  const pass = results.filter(r => r.status === 'PASS').length
  const fail = results.filter(r => r.status === 'FAIL').length
  console.log(`\n==== P0 出题页专项验证 ====`)
  console.log(`总计 ${results.length} :: PASS ${pass} / FAIL ${fail} / WARN ${results.length - pass - fail}`)
  if (fail === 0) console.log('P0_EXERCISE_PASS')
  await browser.close()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
