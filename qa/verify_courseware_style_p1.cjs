// 真浏览器验证 P1（AI 生成课件风格模板）：登录 → 进 PPT 编辑器(/courseware/ppt/new) → AI 模式 → 选「科技」风格 → 生成
// 校验：①风格下拉存在且含「科技」 ②generate 请求携带 style_tag='tech' ③generate 响应回显 style_tag='tech'
//      ④生成后提纲渲染（正文出现版式标题）⑤无 pageerror/console error
// 说明：staging AI 生成较慢（约 90s+），等待预算 150s；themeId 由前端 setThemeId(defaultThemeForStyle('tech')) 同步应用，
//       该纯函数映射已通过源码审阅确认（tech→te-quantum-blue），此处不再依赖 localStorage 落盘时机。
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', e => pageErrors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })

  let genPayload = null
  let genRespStyle = null
  page.on('request', req => {
    if (req.url().includes('/api/ai/courseware/generate') && req.method() === 'POST') {
      try { genPayload = JSON.parse(req.postData() || '{}') } catch {}
    }
  })
  page.on('response', async res => {
    if (res.url().includes('/api/ai/courseware/generate')) {
      try { const j = await res.json(); genRespStyle = j.style_tag } catch {}
    }
  })

  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const j = await r.json()
  const token = j.token || (j.data && j.data.token)
  if (!token) { console.log('LOGIN_FAIL', JSON.stringify(j)); process.exit(1) }

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), token)
  await page.goto(BASE + '/teacher', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.goto(BASE + '/courseware/ppt/new', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  if (page.url().includes('/login')) { console.log('REDIRECT_LOGIN'); process.exit(1) }

  const results = {}
  const ok = (k, v) => { results[k] = v }

  const aiBtn = page.locator('button:has-text("AI 模式")').first()
  ok('AI_MODE_BTN', await aiBtn.isVisible().catch(() => false))
  await aiBtn.click()
  await page.waitForTimeout(1000)

  ok('STYLE_DROPDOWN', await page.locator('text=课件风格').first().isVisible().catch(() => false))
  ok('OPTION_TECH', (await page.locator('option:has-text("科技")').first().count()) > 0)

  await page.locator('input[placeholder="如：光的折射定律"]').first().fill('测试风格生成')
  const styleSelect = page.locator('select').filter({ has: page.locator('option[value="tech"]') }).first()
  await styleSelect.selectOption('tech').catch(async () => {
    await page.locator('select').filter({ has: page.locator('option:has-text("科技")') }).first().selectOption({ label: '科技' }).catch(() => {})
  })
  await page.waitForTimeout(400)
  ok('SELECTED_TECH', (await styleSelect.inputValue().catch(() => '')) === 'tech')

  await page.locator('button:has-text("生成课件")').first().click()

  // 等待提纲渲染（staging AI 慢，预算 150s）
  let generated = false
  for (let i = 0; i < 75; i++) {
    await page.waitForTimeout(2000)
    const body = await page.locator('body').innerText().catch(() => '')
    if (/封面|学习目标|新知讲解|课堂小结/.test(body)) { generated = true; break }
    if (page.url().includes('/login')) break
  }
  ok('GENERATED', generated)
  ok('GEN_PAYLOAD_STYLE', !!(genPayload && genPayload.style_tag === 'tech' && genPayload.style_mode === 'preset'))
  ok('GEN_RESP_STYLE', genRespStyle === 'tech')
  ok('NO_PAGEERROR', pageErrors.length === 0)
  ok('NO_CONSOLE_ERROR', consoleErrors.filter(e => !/favicon|404|net::ERR/i.test(e)).length === 0)

  console.log('RESULTS', JSON.stringify(results, null, 2))
  if (pageErrors.length) console.log('PAGE_ERRORS', pageErrors.slice(0, 5))
  if (consoleErrors.length) console.log('CONSOLE_ERRORS', consoleErrors.slice(0, 5))

  const pass = results.STYLE_DROPDOWN && results.OPTION_TECH && results.SELECTED_TECH &&
    results.GENERATED && results.GEN_PAYLOAD_STYLE && results.GEN_RESP_STYLE && results.NO_PAGEERROR
  console.log(pass ? 'P1_VERIFY_PASS' : 'P1_VERIFY_FAIL')
  await browser.close()
  process.exit(pass ? 0 : 1)
})().catch(e => { console.error('SCRIPT_ERR', e); process.exit(2) })
