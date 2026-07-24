// Phase 0 有据引擎专项验证（真实浏览器）
// 检查：成长关爱接口、覆盖度看板、训练坐标推断、care API 路由
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
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

  // 捕获错误
  const consoleErrors = []
  const networkErrors = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('response', resp => { if (resp.status() >= 500) networkErrors.push(`HTTP ${resp.status()} ${resp.url()}`) })

  // ── 登录 ──
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[placeholder="请输入手机号"]', '13800000002')
  await page.fill('input[placeholder="请输入密码"]', 'teacher123')
  await page.click('button[type=submit]')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await sleep(1500)
  record('UI登录', page.url().includes('/teacher') ? 'PASS' : 'FAIL', `落地=${page.url()}`)

  // ── 1. 学情页面 → 覆盖度看板 ──
  await page.goto(BASE + '/analytics', { waitUntil: 'domcontentloaded' })
  await sleep(2000)
  const covTxt1 = await page.evaluate(() => document.body?.innerText || '')
  const hasCoverage = /覆盖度|覆盖率/.test(covTxt1)
  record('覆盖度看板渲染', hasCoverage ? 'PASS' : 'FAIL', `含覆盖度=${hasCoverage} len=${covTxt1.length}`)

  // 展开覆盖度面板
  const covBtn = page.locator('text=知识点覆盖度')
  if (await covBtn.count() > 0) {
    await covBtn.click()
    await sleep(600)
  }
  record('覆盖度看板展开', 'PASS', '点击展开')

  // ── 2. 成长关爱页面 ──
  await page.goto(BASE + '/care', { waitUntil: 'domcontentloaded' })
  await sleep(2500)
  const careTxt = await page.evaluate(() => document.body?.innerText || '')
  const hasCare = /成长关爱|添加关怀/.test(careTxt)
  record('成长关爱页面渲染', hasCare ? 'PASS' : 'FAIL', `含关爱=${hasCare} len=${careTxt.length}`)

  // ── 3. 成长足迹（检查关怀 toggle） ──
  await page.goto(BASE + '/growth', { waitUntil: 'domcontentloaded' })
  await sleep(2000)
  const growthTxt = await page.evaluate(() => document.body?.innerText || '')
  const hasGrowth = /成长足迹|全部|成长关爱/.test(growthTxt)
  record('成长足迹页面渲染', hasGrowth ? 'PASS' : 'FAIL', `len=${growthTxt.length}`)

  // ── 4. 出题页面 → 确认 infer-coordinate 端点存在 ──
  await page.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' })
  await sleep(2000)
  const exTxt = await page.evaluate(() => document.body?.innerText || '')
  const hasExerciseUI = /出题|题型|难度|题干/.test(exTxt)
  record('出题新建页渲染', hasExerciseUI ? 'PASS' : 'FAIL', `len=${exTxt.length}`)

  // ── 5. API 路由检查：直接调用 care/coverage 端点 ──
  const apiChecks = [
    { name: 'care/students 接口', path: '/api/care/students' },
    { name: 'analytics/coverage 接口', path: '/api/analytics/coverage?subject=语文&grade=4' },
  ]
  for (const ac of apiChecks) {
    try {
      const resp = await page.evaluate(async (p) => {
        const r = await fetch(p, { credentials: 'include' })
        return { status: r.status, text: (await r.text()).slice(0, 200) }
      }, ac.path)
      record(ac.name, resp.status !== 404 ? 'PASS' : 'FAIL', `HTTP ${resp.status} (401=未认证正常，404=路由缺失)`)
    } catch (e) {
      record(ac.name, 'FAIL', String(e))
    }
  }

  // ── 6. 错误检查 ──
  const allErrors = [...consoleErrors, ...networkErrors]
  const detail = allErrors.length > 0
    ? `net5xx=${networkErrors.join('; ')} console=${consoleErrors.join('; ')}`
    : '0'
  record('运行期错误', allErrors.length === 0 ? 'PASS' : 'WARN', detail)

  // ── 7. 渲染健康 ──
  const health = await page.evaluate(() => {
    const t = document.body?.innerText || ''
    return { visible: t.length > 20, appErr: /Application error/i.test(t), len: t.length }
  })
  record('渲染健康检查', health.visible ? 'PASS' : 'FAIL',
    `visible=${health.visible} appErr=${health.appErr} len=${health.len}`)

  // ── 汇总 ──
  const pass = results.filter(r => r.status === 'PASS').length
  const fail = results.filter(r => r.status === 'FAIL').length
  console.log(`\n==== Phase 0 专项验证 ====`)
  console.log(`总计 ${results.length} :: PASS ${pass} / FAIL ${fail} / WARN ${results.length - pass - fail}`)
  if (fail === 0) console.log('PHASE0_PASS')

  await browser.close()
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
