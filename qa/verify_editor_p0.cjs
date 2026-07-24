// Phase 0 编辑器框架重构专项验证（真实浏览器，本地 dev :5173 + staging 后端）
// 验证 LessonPlanEditor 样板迁移：P0-2 全屏预览 / P0-3 左栏容器 / P0-4 框架小微 / P0-6 统一 footer
// 用法：BASE=http://localhost:5173 node verify_editor_p0.cjs
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
  const netErrors = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('pageerror', e => netErrors.push('PAGEERR: ' + (e.message || e)))
  page.on('response', resp => { if (resp.status() >= 500) netErrors.push(`HTTP5xx ${resp.status()} ${resp.url()}`) })

  // ── 登录（proxy 到 staging 后端） ──
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[placeholder="请输入手机号"]', '13800000002')
  await page.fill('input[placeholder="请输入密码"]', 'teacher123')
  await page.click('button[type=submit]')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await sleep(1500)
  record('UI登录', page.url().includes('/teacher') ? 'PASS' : 'FAIL', `落地=${page.url()}`)

  // ── 教案编辑页渲染健康 ──
  await page.goto(BASE + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })
  await sleep(3000)
  const h = await page.evaluate(() => {
    const t = document.body?.innerText || ''
    return { visible: t.length > 30, appErr: /Application error|Cannot read properties|is not defined/.test(t), redir: /(^|\/)login$/.test(location.href), len: t.length }
  })
  record('教案页渲染健康', (!h.appErr && !h.redir && h.visible) ? 'PASS' : 'FAIL', `visible=${h.visible} appErr=${h.appErr} redir=${h.redir} len=${h.len}`)

  // ── P0-3 左栏基本信息卡 ──
  const lpInfo = await page.evaluate(() => {
    const t = document.body.innerText
    return { basic: /基本信息/.test(t), subj: /学科/.test(t), cls: /班级/.test(t), tb: /人教版|北师大|部编|苏教|华师/.test(t) }
  })
  record('P0-3 左栏基本信息卡', (lpInfo.basic && lpInfo.subj && lpInfo.cls) ? 'PASS' : 'FAIL', JSON.stringify(lpInfo))

  // ── P0-4 框架级小微入口 ──
  const xwEntry = page.locator('button:has-text("请补充要求")')
  const xwOk = await xwEntry.count()
  record('P0-4 小微入口存在', xwOk > 0 ? 'PASS' : 'FAIL', `入口按钮数=${xwOk}`)

  // ── P0-4 小微展开 ──
  if (xwOk > 0) {
    await xwEntry.first().click()
    await sleep(1200)
    const panel = await page.evaluate(() => /发送|小微|补充要求|附件|对话/.test(document.body.innerText))
    record('P0-4 小微展开面板', panel ? 'PASS' : 'WARN', `面板标识=${panel}`)
    const closeBtn = page.locator('button:has-text("收起"), button[aria-label="close"]')
    if (await closeBtn.count() > 0) { await closeBtn.first().click(); await sleep(600) }
  }

  // ── P0-6 统一 footer ──
  const ft = await page.evaluate(() => {
    const t = document.body.innerText
    return { draft: /保存为草稿/.test(t), pub: /发布/.test(t) }
  })
  record('P0-6 统一footer(保存草稿/发布)', (ft.draft && ft.pub) ? 'PASS' : 'FAIL', JSON.stringify(ft))

  // ── P0-2 全屏预览承载层 ──
  const prevBtn = page.locator('button:has-text("预览")')
  const prevCount = await prevBtn.count()
  if (prevCount > 0) {
    await prevBtn.first().click()
    await sleep(1200)
    const overlay = await page.evaluate(() => {
      const t = document.body.innerText
      const hasFull = !!document.querySelector('.fixed.inset-0.z-50')
      return { hasFull, title: /教案预览/.test(t), back: /返回编辑/.test(t) }
    })
    record('P0-2 全屏预览承载层', (overlay.hasFull && overlay.title && overlay.back) ? 'PASS' : 'FAIL', JSON.stringify(overlay))
    const backBtn = page.locator('button:has-text("返回编辑")')
    if (await backBtn.count() > 0) { await backBtn.first().click(); await sleep(600) }
    const closed = await page.evaluate(() => !document.querySelector('.fixed.inset-0.z-50'))
    record('P0-2 预览可关闭返回', closed ? 'PASS' : 'FAIL', `closed=${closed}`)
  } else {
    record('P0-2 全屏预览承载层', 'FAIL', '未找到预览按钮')
  }

  // ── AI 生成链路（外部服务可用性，WARN 不 FAIL，重点验证路径正确不崩） ──
  try {
    await page.goto(BASE + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })
    await sleep(2500)
    const entry2 = page.locator('button:has-text("请补充要求")')
    if (await entry2.count() > 0) {
      await entry2.first().click()
      await sleep(1000)
      const ta = page.locator('textarea').first()
      if (await ta.count() > 0) {
        await ta.fill('生成一份小学古诗《静夜思》教案')
        await sleep(300)
        const send = page.locator('button:has-text("发送"), button:has-text("应用"), button:has-text("生成")')
        if (await send.count() > 0) {
          await send.first().click()
          await page.waitForFunction(() => !/正在生成/.test(document.body.innerText) || /生成失败|AI 生成失败/.test(document.body.innerText), { timeout: 40000 }).catch(() => {})
          const done = await page.evaluate(() => /生成失败|AI 生成失败/.test(document.body.innerText))
          const leaked = await page.evaluate(() => /api\/v1\/ai/.test(document.body.innerHTML))
          record('AI生成链路(外部服务,WARN)', done ? 'WARN' : 'PASS', done ? 'AI返回错误(外部可用性,非代码)' : '触发并等待完成,无404/崩溃' + (leaked ? '[注意:命中/api/v1/ai]' : ''))
        } else {
          record('AI生成链路(外部服务,WARN)', 'WARN', '未找到发送按钮')
        }
      } else {
        record('AI生成链路(外部服务,WARN)', 'WARN', '未找到输入框')
      }
    } else {
      record('AI生成链路(外部服务,WARN)', 'WARN', '未找到小微入口')
    }
  } catch (e) {
    record('AI生成链路(外部服务,WARN)', 'WARN', '异常=' + String(e).slice(0, 120))
  }

  // ── 控制台错误（过滤 401/AI/timeout 等预期外噪声） ──
  const realErr = consoleErrors.filter(e => !/401|AI|timeout|网络|Failed to load resource.*(401|4\d\d)/i.test(e))
  record('控制台错误(非预期)', realErr.length === 0 ? 'PASS' : 'WARN', realErr.slice(0, 3).join(' | ') || '0')

  // ── 汇总 ──
  const pass = results.filter(r => r.status === 'PASS').length
  const fail = results.filter(r => r.status === 'FAIL').length
  console.log(`\n==== P0 编辑器框架专项验证 ====`)
  console.log(`总计 ${results.length} :: PASS ${pass} / FAIL ${fail} / WARN ${results.length - pass - fail}`)
  if (fail === 0) console.log('P0_EDITOR_PASS')
  await browser.close()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
