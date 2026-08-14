// 真浏览器验证：教学课件三频道（PPT / H5 互动 / 视频）独立路由导航与可达性
// 方案2 起三频道改为独立路由：/courseware/ppt · /courseware/h5 · /courseware/video，
// 侧边栏「教学课件」分组下各有入口，H5/视频页内顶部也有频道互切 a 链接（非单路由 segment）。
// 注意：频道深层编辑器（新建/导出）交互由 verify_h5_template / verify_h5_interactive /
// verify_scenario_template 专项覆盖；本脚本只验证导航结构 + 三页可达 + 无报错。
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
  await page.waitForTimeout(800)
  if (page.url().includes('/login')) { console.log('STILL_LOGIN'); process.exit(1) }

  const results = {}
  const ok = (k, v) => { results[k] = v }

  // 1) 侧边栏「教学课件」分组下三频道入口可见且 href 正确
  const navMap = await page.$$eval('a', els => {
    const out = {}
    for (const e of els) {
      const t = e.textContent.trim()
      const h = e.getAttribute('href') || ''
      if (t === 'PPT 课件') out.ppt = h
      if (t === 'H5 互动课件') out.h5 = h
      if (t === '视频课件') out.video = h
    }
    return out
  })
  ok('NAV_PPT', navMap.ppt === '/courseware/ppt')
  ok('NAV_H5', navMap.h5 === '/courseware/h5')
  ok('NAV_VIDEO', navMap.video === '/courseware/video')

  // 2) 三频道页各自可达（进 URL 后不被踢回 /login，URL 命中预期）
  const reach = async (path, key, expectIn) => {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    const url = page.url()
    ok(key, url.includes(expectIn) && !url.includes('/login'))
  }
  await reach('/courseware/ppt', 'REACH_PPT', '/courseware/ppt')
  await reach('/courseware/h5', 'REACH_H5', '/courseware/h5')
  await reach('/courseware/video', 'REACH_VIDEO', '/courseware/video')

  // 3) H5 页内顶部频道互切 a 链接存在（PPT / H5 / 视频）
  await page.goto(BASE + '/courseware/h5', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const h5Switch = await page.$$eval('a', els => {
    const ts = els.map(e => e.textContent.trim())
    return {
      ppt: ts.includes('PPT 课件'),
      h5: ts.includes('H5 互动课件'),
      video: ts.includes('视频课件'),
    }
  })
  ok('H5_SWITCH_PPT', h5Switch.ppt)
  ok('H5_SWITCH_H5', h5Switch.h5)
  ok('H5_SWITCH_VIDEO', h5Switch.video)

  const pass = Object.values(results).every(v => v === true) && pageErrors.length === 0

  console.log('RESULTS:', JSON.stringify(results))
  console.log('PAGE_ERRORS:', pageErrors.length ? pageErrors.join(' | ') : 'none')
  console.log('CONSOLE_ERRORS(non-fatal):', consoleErrors.length ? consoleErrors.slice(0, 3).join(' | ') : 'none')
  console.log(pass ? 'PASS' : 'FAIL')
  await browser.close()
  process.exit(pass ? 0 : 1)
})().catch(e => { console.log('SCRIPT_ERR', e.message); process.exit(1) })
