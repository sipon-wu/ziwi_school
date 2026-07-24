// 题单 SheetBuilder 专项验证：渲染健康 / 小微 / 统一 footer / 出题生成
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const b = await chromium.launch({ headless: true })
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  const consoleErrors = []
  p.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  p.on('pageerror', e => consoleErrors.push('PAGEERR: ' + (e.message || e)))

  // 登录
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[placeholder="请输入手机号"]', '13800000002')
  await p.fill('input[placeholder="请输入密码"]', 'teacher123')
  await p.click('button[type=submit]')
  await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await sleep(1500)

  // 题单页
  await p.goto(BASE + '/sheets/new', { waitUntil: 'domcontentloaded' })
  await sleep(3500)

  const checks = []
  const tag = (check, status, detail) => { checks.push({ check, status, detail: String(detail).slice(0, 250) }); console.log(`[${status}] ${check} :: ${detail}`) }

  // 1. 渲染健康
  const ren = await p.evaluate(() => {
    const t = document.body.innerText
    return { len: t.length, redir: /(^|\/)login$/.test(location.href), appErr: /Application error|Cannot read properties|is not defined/.test(t) }
  })
  tag('题单页渲染健康', (!ren.appErr && !ren.redir && ren.len > 30) ? 'PASS' : 'FAIL', `len=${ren.len} redir=${ren.redir}`)

  // 2. 左栏基本信息卡
  const info = await p.evaluate(() => {
    const t = document.body.innerText
    return { basic: /基本信息/.test(t), subj: /学科/.test(t), grade: /年级/.test(t), cls: /班级/.test(t) }
  })
  tag('P0-3 左栏基本信息卡(学科/年级/班级)', (info.basic && info.subj && info.grade && info.cls) ? 'PASS' : 'FAIL', JSON.stringify(info))

  // 3. 小微入口条
  const xwBtn = await p.$('button:has-text("请补充要求")')
  tag('P0-4 小微入口条', xwBtn ? 'PASS' : 'FAIL', `count=${await p.evaluate(() => Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('请补充要求')).length)}`)

  // 4. 小微可展开
  const xwBtnLoc = p.locator('button:has-text("请补充要求")')
  if (await xwBtnLoc.count()) {
    await xwBtnLoc.click()
    await sleep(1000)
    const opened = await p.evaluate(() => document.body.innerText.includes('应用到当前内容') || !!document.querySelector('input[placeholder*="补充"]'))
    tag('P0-4 小微展开', opened ? 'PASS' : 'FAIL', `opened=${opened}`)
    // 关闭 — 重新查询（DOM 已变）
    const xwBtnLoc2 = p.locator('button:has-text("请补充要求")')
    if (await xwBtnLoc2.count()) { await xwBtnLoc2.click(); await sleep(500) }
  }

  // 5. footer 三按钮（保存草稿蓝/预览白/布置到班级白）
  const footerBtns = await p.evaluate(() => {
    // 找包含「保存草稿」或「保存为草稿」和「预览」的最外层容器
    const all = Array.from(document.querySelectorAll('div'))
    const candidates = all.filter(el => {
      const t = el.innerText || ''
      return /保存(?:为)?草稿/.test(t) && /预览/.test(t) && /布置|发布/.test(t)
    })
    // 取层级最浅的那个（querySelectorAll('div').length 最少的）
    candidates.sort((a, b) => a.querySelectorAll('div').length - b.querySelectorAll('div').length)
    const footer = candidates[0]
    if (!footer) return null
    const btns = Array.from(footer.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean)
    const rect = footer.getBoundingClientRect()
    return { btns, w: Math.round(rect.width), y: Math.round(rect.y), x: Math.round(rect.x) }
  })
  const footerOk = footerBtns && footerBtns.btns && footerBtns.btns.length === 3 && footerBtns.btns[0].includes('保存') && footerBtns.btns[1].includes('预览') && /布置|发布/.test(footerBtns.btns[2])
  tag('P0-6 统一 footer(三按钮:保存/预览/布置到班级)', footerOk ? 'PASS' : 'FAIL', JSON.stringify(footerBtns))

  // 6. footer 嵌在左栏底部（x≈0，w≈466），不是全宽 1440（2026-07-24 设计变更：底栏按钮移入左栏底）
  tag('footer 在左栏底部(x≈0, w≈466)', footerBtns && footerBtns.x <= 10 && footerBtns.w >= 450 && footerBtns.w <= 470 ? 'PASS' : 'FAIL', `x=${footerBtns?.x} w=${footerBtns?.w}`)

  // 7. footer 位置：底部 ~834（左栏底，与其他四页一致）
  tag('footer y 位置与其他四页一致', footerBtns && Math.abs(footerBtns.y - 834) <= 6 ? 'PASS' : 'FAIL', `y=${footerBtns?.y}`)

  // 8. 头部模式切换
  const hdrBtns = await p.evaluate(() => {
    const hdr = document.querySelector('header')
    if (!hdr) return null
    return Array.from(hdr.querySelectorAll('button')).map(b => b.innerText.trim())
  })
  const modeOk = hdrBtns && hdrBtns.includes('AI 模式') && hdrBtns.includes('文档模式')
  tag('Header AI/文档模式切换', modeOk ? 'PASS' : 'FAIL', `labels=${JSON.stringify(hdrBtns)}`)

  // 9. 切到文档模式 → 左栏变只读元数据
  await p.click('button:has-text("文档模式")')
  await sleep(1000)
  const docMode = await p.evaluate(() => {
    const t = document.body.innerText
    return { hasFooterSave: /保存草稿/.test(t), formGone: !document.querySelector('input[placeholder*="第三单元课后练习"]'), previewArea: document.body.innerText.includes('练习题') }
  })
  tag('文档模式左栏变只读元数据', docMode.formGone ? 'PASS' : 'FAIL', JSON.stringify(docMode))
  // 切回
  await p.click('button:has-text("AI 模式")')
  await sleep(1000)

  // 10. 出题配置三个核心控件（难度/题量/题型）—— 给页面再补等待，避免前一步关闭动画影响
  await sleep(1500)
  const cfg = await p.evaluate(() => {
    const t = document.body.innerText
    return { diff: /基础[\s\S]*中等[\s\S]*进阶[\s\S]*挑战/.test(t), count: /3 题|5 题|8 题/.test(t), types: /选择题[\s\S]*填空题/.test(t) }
  })
  tag('出题配置(难度/题量/题型)控件', (cfg.diff && cfg.count && cfg.types) ? 'PASS' : 'FAIL', JSON.stringify(cfg))

  // 11. AI 生成按钮存在
  const genBtn = await p.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).find(b => /AI[\s]*生成题目/.test(b.innerText))?.innerText || null
  })
  tag('AI 生成题目按钮', genBtn ? 'PASS' : 'FAIL', `label="${genBtn}"`)

  // 12. 控制台错误
  const expectedErrors = /Failed to fetch|AbortError|NetworkError|proxy|generating|timed?out/i
  const realErrors = consoleErrors.filter(e => !expectedErrors.test(e))
  tag('控制台 0 非预期错误', realErrors.length === 0 ? 'PASS' : 'FAIL', `n=${realErrors.length}`)

  // 汇总
  const pass = checks.filter(c => c.status === 'PASS').length
  const fail = checks.filter(c => c.status === 'FAIL').length
  const warn = checks.filter(c => c.status === 'WARN').length
  console.log(`\n==== 总计 ${checks.length} :: PASS ${pass} / FAIL ${fail} / WARN ${warn} ====`)

  await b.close()
  process.exit(fail === 0 ? 0 : 1)
})()
