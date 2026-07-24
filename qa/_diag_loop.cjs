// 一次性诊断：定位 Maximum update depth 触发时机（加载 vs 交互）
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:5173'
const sleep = ms => new Promise(r => setTimeout(r, ms))
;(async () => {
  const b = await chromium.launch({ headless: true })
  const p = await (await b.newContext({ viewport: { width: 1536, height: 864 } })).newPage()
  const errs = []
  p.on('console', m => { if (m.type() === 'error') errs.push('[t+' + Date.now() % 100000 + '] ' + m.text().slice(0, 120)) })
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e.message || e).slice(0, 120)))
  const snap = (tag) => console.log(`-- ${tag} -- 错误数=${errs.length}:`, errs.slice(-3).join(' || '))

  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }); await sleep(800)
  await p.fill('input[placeholder="请输入手机号"]', '13800000002')
  await p.fill('input[placeholder="请输入密码"]', 'teacher123')
  await p.click('button[type=submit]'); await sleep(1500)

  await p.goto(BASE + '/lesson-plans/new', { waitUntil: 'domcontentloaded' }); await sleep(4000)
  snap('加载4s后(无交互)')

  // 展开小微
  const xw = p.locator('button:has-text("请补充要求")')
  if (await xw.count() > 0) { await xw.first().click(); await sleep(2000); snap('展开小微2s') }
  // 关闭小微
  const close = p.locator('button:has-text("收起"), button[aria-label="close"]')
  if (await close.count() > 0) { await close.first().click(); await sleep(1000) }

  // 打开预览
  const pv = p.locator('button:has-text("预览")')
  if (await pv.count() > 0) { await pv.first().click(); await sleep(2000); snap('打开预览2s') }
  const back = p.locator('button:has-text("返回编辑")')
  if (await back.count() > 0) { await back.first().click(); await sleep(1000) }

  // 等待自动保存 debounce(8s)
  await sleep(9000); snap('等待9s(自动保存debounce后)')

  console.log('\n全部错误:'); errs.forEach(e => console.log('  ' + e))
  await b.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
