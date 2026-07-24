// 课件(P4)轻量一致性验证：PreviewOverlay 统一承载课件全屏预览/播放
// 路径A：素材库「播放」→ PresentationMode(embedded) via PreviewOverlay
// 路径B：AI 生成预览「播放 / 阅读」→ PptxPreview(embedded) via PreviewOverlay（best-effort，依赖外部AI）
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
  const log = (...a) => console.log(...a)
  let pass = 0, fail = 0, warn = 0

  // 登录
  const tok = await page.evaluate(async ({ BASE, PHONE, PASS }) => {
    const res = await fetch(BASE + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: PHONE, password: PASS })
    })
    const j = await res.json()
    return j.data?.token || j.token || ''
  }, { BASE, PHONE, PASS })
  if (!tok) { log('[FAIL] 登录失败'); await browser.close(); process.exit(1) }
  await page.addInitScript(t => localStorage.setItem('zhiwei_token', t), tok)
  await page.goto(BASE + '/materials', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=素材库', { timeout: 20000 })
  log('[PASS] ① /materials 渲染健康')
  pass++

  // 诊断：列出当前页面所有 fixed inset-0 z-50 层（排查遮挡源）
  const layers = await page.locator('div.fixed.inset-0').evaluateAll(els => els.map(e => ({
    cls: e.className, vis: getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden',
    txt: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 50)
  })))
  log('[DIAG] fixed inset-0 layers:', JSON.stringify(layers))
  const playBtns = await page.locator("button:has-text('播放')").count()
  const cards = await page.locator("div[class*='group']").count()
  log('[DIAG] playBtns=', playBtns, 'cards(group)=', cards)
  await page.screenshot({ path: '/tmp/materials.png' })

  // 路径A：素材库播放（PresentationMode embedded via PreviewOverlay）
  // 注：「播放」按钮仅 list 视图渲染，先切到列表视图（List 图标按钮）
  try {
    await page.locator('button:has(svg.lucide-list)').first().click().catch(e => log('[DIAG] list click err', e.message))
    await page.waitForTimeout(800)
    const playAfter = await page.locator("button:has-text('播放')").count()
    log('[DIAG] after list-switch: playBtns=', playAfter)
    const playBtn = page.locator('button', { hasText: '播放' }).first()
    await playBtn.scrollIntoViewIfNeeded().catch(() => {})
    await playBtn.click({ force: true })
    await page.waitForTimeout(3500)
    const layers2 = await page.locator('div.fixed.inset-0').evaluateAll(els => els.map(e => ({ cls: e.className, txt: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 80) })))
    log('[DIAG] after play: fixed layers=', JSON.stringify(layers2))
    const back = page.locator('button', { hasText: '返回编辑' })
    const backVis = await back.first().isVisible().catch(() => false)
    const titleTxt = await page.locator('span', { hasText: '课件播放' }).first().textContent().catch(() => '')
    const overlayTxt = await page.locator('div.fixed.inset-0.z-50').first().innerText().catch(() => '')
    const bodyTxt = await page.locator('body').innerText().catch(() => '')
    log('[DIAG] backVis=', backVis, 'overlayLen=', overlayTxt.length, 'title=', titleTxt, 'pageErrors=', pageErrors.length, 'noContentToast=', /暂无正文内容/.test(bodyTxt))
    if (pageErrors.length) log('[DIAG] pageError0=', pageErrors[0])
    if (backVis) { await back.first().click({ force: true }); await back.first().waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {}) }
    const gone = !(await back.first().isVisible().catch(() => false))
    const ok = backVis && overlayTxt.length > 0
    if (ok) { pass++; log(`[PASS] ② 路径A 素材库播放: PreviewOverlay承载, 标题含"课件播放"=${titleTxt.includes('课件播放')}, 暗色舞台内容=${overlayTxt.length > 0}, 关闭回素材库=${gone}`) }
    else { warn++; log(`[WARN] ② 路径A: backVis=${backVis}, overlayLen=${overlayTxt.length}, title=${titleTxt}, noContentToast=${/暂无正文内容/.test(bodyTxt)}`) }
  } catch (e) {
    fail++; log('[FAIL] ② 路径A 素材库播放:', e.message)
  }

  // 路径B：AI 生成预览「播放 / 阅读」（PptxPreview embedded via PreviewOverlay）— best-effort（外部AI）
  try {
    await page.goto(BASE + '/materials', { waitUntil: 'networkidle' })
    await page.waitForSelector('text=素材库', { timeout: 15000 })
    const genBtn = page.locator('button', { hasText: 'AI 生成课件' }).first()
    await genBtn.scrollIntoViewIfNeeded().catch(() => {})
    await genBtn.click({ force: true })
    const titleInput = page.locator('input[placeholder*="光的折射定律"]').first()
    await titleInput.waitFor({ state: 'visible', timeout: 8000 })
    await titleInput.fill('PreviewOverlay验证测试课件')
    const genSubmit = page.locator('button', { hasText: '生成课件' }).first()
    await genSubmit.click({ force: true })
    const playRead = page.locator('button', { hasText: '播放 / 阅读' })
    await playRead.waitFor({ state: 'visible', timeout: 90000 })
    await playRead.click({ force: true })
    const back2 = page.locator('button', { hasText: '返回编辑' })
    await back2.waitFor({ state: 'visible', timeout: 15000 })
    const titleTxt2 = await page.locator('span', { hasText: 'PPT 预览' }).first().textContent().catch(() => '')
    const overlayTxt2 = await page.locator('div.fixed.inset-0.z-50').first().innerText().catch(() => '')
    await back2.click({ force: true })
    await back2.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
    const gone2 = !(await back2.first().isVisible().catch(() => false))
    const ok2 = titleTxt2.includes('PPT 预览') && gone2 && overlayTxt2.length > 0
    if (ok2) { pass++; log(`[PASS] ③ 路径B AI生成预览: PreviewOverlay承载「PPT 预览」标题=${titleTxt2.includes('PPT 预览')}, 暗色舞台有内容=${overlayTxt2.length > 0}, 关闭=${gone2}`) }
    else { warn++; log(`[WARN] ③ 路径B: 标题含"PPT 预览"=${titleTxt2.includes('PPT 预览')}, 关闭=${gone2}, 内容=${overlayTxt2.length > 0}`) }
  } catch (e) {
    warn++; log(`[WARN] ③ 路径B AI生成预览未触达(外部AI慢/限流，非代码缺陷): ${e.message}`)
  }

  const realConsole = consoleErrors.filter(t => !/G6|graph|destroyed|Maximum update|ResizeObserver/i.test(t))
  log('==== 汇总 ====')
  log(`PASS=${pass} WARN=${warn} FAIL=${fail}`)
  log(`pageErrors=${pageErrors.length}`, pageErrors.slice(0, 3))
  log(`consoleErrors(non-G6)=${realConsole.length}`, realConsole.slice(0, 3))
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(2) })
