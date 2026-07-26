// 查看态统一 EditorLayout + 全屏预览 fullscreen 专项验证（staging 真浏览器）
// 覆盖：教案/出题/组卷 三页查看态（bare :id）= EditorLayout（左栏信息 + 顶栏按钮 + footer），
//      点「预览」→ PreviewOverlay 全屏，TipTap fullscreen：章节导航/批注侧栏默认展开。
// 用法：BASE=http://school1.ziwi.cn node verify_view_unified.cjs
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const results = []
const record = (check, status, detail) => {
  results.push({ check, status, detail: String(detail).slice(0, 300) })
  console.log(`[${status}] ${check} :: ${detail}`)
}

async function apiLogin() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const j = await r.json()
  const token = j.token || j.data?.token
  if (!token) throw new Error('登录失败: ' + JSON.stringify(j).slice(0, 200))
  return token
}

async function apiGet(token, path) {
  const r = await fetch(BASE + '/api' + path, { headers: { Authorization: 'Bearer ' + token } })
  return r.json()
}

async function checkViewPage(page, consoleErrors, { name, url, topBtns, previewTitle, footerBack }) {
  consoleErrors.length = 0
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await sleep(3500)

  // 1) 渲染健康
  const h = await page.evaluate(() => {
    const t = document.body?.innerText || ''
    return { visible: t.length > 30, appErr: /Application error|Cannot read properties|is not defined/.test(t), redir: /(^|\/)login$/.test(location.href), len: t.length }
  })
  record(`${name} 查看态渲染健康`, (!h.appErr && !h.redir && h.visible) ? 'PASS' : 'FAIL', `visible=${h.visible} appErr=${h.appErr} redir=${h.redir} url=${page.url()}`)
  if (h.redir || h.appErr) return

  // 2) EditorLayout 框架标识：左栏基本信息 + footer 返回按钮
  const fr = await page.evaluate(({ footerBack }) => {
    const t = document.body.innerText
    return { basic: /基本信息/.test(t), back: t.includes(footerBack), edit: /编辑/.test(t) }
  }, { footerBack })
  record(`${name} EditorLayout 框架(基本信息/返回/编辑)`, (fr.basic && fr.back && fr.edit) ? 'PASS' : 'FAIL', JSON.stringify(fr))

  // 3) 顶栏按钮
  const btnStates = {}
  for (const b of topBtns) {
    btnStates[b] = await page.locator(`button:has-text("${b}")`).count()
  }
  const btnOk = topBtns.every(b => btnStates[b] > 0)
  record(`${name} 顶栏按钮(${topBtns.join('/')})`, btnOk ? 'PASS' : 'FAIL', JSON.stringify(btnStates))

  // 4) 全屏预览：点「预览」→ PreviewOverlay 打开，标题正确，fullscreen 侧栏默认展开
  const pv = page.locator('button:has-text("预览")').first()
  if (await pv.count() === 0) {
    record(`${name} 预览按钮`, 'FAIL', '未找到「预览」按钮')
    return
  }
  await pv.click()
  await sleep(2000)
  const ov = await page.evaluate(({ previewTitle }) => {
    const t = document.body.innerText
    return {
      title: t.includes(previewTitle),
      backEdit: /返回编辑/.test(t),
      outline: /章节导航/.test(t),
      annot: /批注/.test(t),
    }
  }, { previewTitle })
  record(`${name} 全屏预览 overlay(标题/返回编辑)`, (ov.title && ov.backEdit) ? 'PASS' : 'FAIL', JSON.stringify(ov))
  record(`${name} fullscreen 侧栏默认展开(章节导航+批注)`, (ov.outline && ov.annot) ? 'PASS' : 'FAIL', `outline=${ov.outline} annot=${ov.annot}`)

  // 5) 侧栏为覆盖式(absolute)：不平移居中 A4 内容
  const abs = await page.evaluate(() => {
    const panels = [...document.querySelectorAll('div')].filter(d => {
      const c = d.className || ''
      return typeof c === 'string' && c.includes('absolute') && (c.includes('w-[180px]') || c.includes('w-[220px]'))
    })
    return panels.length
  })
  record(`${name} 侧栏覆盖式(absolute)`, abs >= 2 ? 'PASS' : 'FAIL', `absolute侧栏数=${abs}(期望≥2)`)

  // 6) 返回编辑关闭 overlay
  await page.locator('button:has-text("返回编辑")').first().click().catch(() => {})
  await sleep(800)

  // 7) 控制台错误
  const realErr = consoleErrors.filter(e => !/401|AI|timeout|网络|graph instance|draw|Maximum update depth|Failed to load resource/i.test(e))
  record(`${name} 控制台错误(非预期)`, realErr.length === 0 ? 'PASS' : 'WARN', realErr.slice(0, 3).join(' | ') || '0')
}

async function main() {
  const token = await apiLogin()
  console.log('API 登录成功，取各库首条数据 id ...')

  const [lessons, questions, exams] = await Promise.all([
    apiGet(token, '/lesson-plans'),
    apiGet(token, '/exercises?page_size=5'),
    apiGet(token, '/exams'),
  ])
  const pick = (j) => {
    const arr = j.items || j.data?.items || j.data || j
    return Array.isArray(arr) && arr.length ? (arr[0].id || arr[0].ID) : null
  }
  const lessonId = pick(lessons), questionId = pick(questions), examId = pick(exams)
  console.log(`lessonId=${lessonId} questionId=${questionId} examId=${examId}`)

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 864 } })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('pageerror', e => consoleErrors.push('PAGEERR: ' + (e.message || e)))

  // 注入 token（纪律：禁止依赖脆弱 UI 登录，键名必须 zhiwei_token）
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), token)

  if (lessonId) {
    await checkViewPage(page, consoleErrors, {
      name: '教案', url: `/lesson-plans/${lessonId}`,
      topBtns: ['导出教案', '打印', '编辑'], previewTitle: '教案预览', footerBack: '返回教案库',
    })
  } else record('教案 数据源', 'WARN', '无教案数据，跳过')

  if (questionId) {
    await checkViewPage(page, consoleErrors, {
      name: '出题', url: `/exercises/${questionId}`,
      topBtns: ['Word', 'PDF', '编辑'], previewTitle: '题目预览', footerBack: '返回题库',
    })
  } else record('出题 数据源', 'WARN', '无题目数据，跳过')

  if (examId) {
    await checkViewPage(page, consoleErrors, {
      name: '组卷', url: `/exams/${examId}`,
      topBtns: ['编辑'], previewTitle: '试卷预览', footerBack: '返回试卷库',
    })
  } else record('组卷 数据源', 'WARN', '无试卷数据，跳过')

  const pass = results.filter(r => r.status === 'PASS').length
  const fail = results.filter(r => r.status === 'FAIL').length
  console.log(`\n==== 查看态统一 + 全屏预览专项验证 (${BASE}) ====`)
  console.log(`总计 ${results.length} :: PASS ${pass} / FAIL ${fail} / WARN ${results.length - pass - fail}`)
  if (fail === 0) console.log('VIEW_UNIFIED_PASS')
  await browser.close()
  process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
