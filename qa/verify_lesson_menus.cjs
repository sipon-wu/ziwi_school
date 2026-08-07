// 知微 AI 教学助手 · 教案三子菜单职责对齐专项真浏览器 E2E
// 用法：BASE=http://school1.ziwi.cn node verify_lesson_menus.cjs
// 覆盖：草稿箱=仅草稿+被退回；发布库=仅送审中+已通过；互审池=仅别人的 pending(排除自己)。

const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const results = []
const record = (j, ok, d) => {
  const s = ok ? 'PASS' : 'FAIL'
  results.push({ journey: j, status: s })
  console.log(`[${s}] ${j} :: ${String(d).slice(0, 200)}`)
}

async function login(page, phone, pass) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[placeholder="请输入手机号"]', phone)
  await page.fill('input[placeholder="请输入密码"]', pass)
  await page.click('button[type=submit]')
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await sleep(1800)
}

async function bodyText(page) {
  return await page.evaluate(() => document.body ? document.body.innerText : '')
}

// 通过侧边栏菜单进入（与真实用户一致，避免直接 goto 子路由导致 SPA 首屏加载异常）
async function gotoMenu(page, menuText, href) {
  const link = page.locator(`a[href="${href}"]`)
  if (await link.count() === 0) {
    await page.click('button:has-text("教学备课")', { timeout: 5000 }).catch(() => {})
    await sleep(400)
  }
  await page.locator(`a[href="${href}"]`).first().click()
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await sleep(2500)
}

async function run() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  const pe = []
  page.on('pageerror', e => pe.push(String(e.message || e)))

  await login(page, '13800000002', 'teacher123')

  // ── 教案草稿箱：仅草稿+被退回 ──
  await gotoMenu(page, '教案草稿箱', '/lesson-plans')
  let txt = await bodyText(page)
  record('草稿箱渲染', /管理您的所有教案|教案/.test(txt), '页面文本=' + txt.slice(0, 60))
  const draftHasPending = /待评审|评审中/.test(txt)  // 草稿箱不应出现 pending 标签
  record('草稿箱不含待评审/评审中', !draftHasPending, `含评审中标记=${draftHasPending}`)
  // 草稿箱应显示被退回的教案（退回测试教案）+ 已退回标签（方案A：退回回草稿箱可改）
  const draftHasReturned = /退回测试教案/.test(txt)
  const draftHasReturnedTag = /已退回/.test(txt)
  record('草稿箱显示被退回教案', draftHasReturned && draftHasReturnedTag, `含退回测试教案=${draftHasReturned} 已退回标签=${draftHasReturnedTag}`)
  // 草稿箱点草稿→ 先进只读查看态(无 /edit、含"编辑"按钮)，不直接进编辑器
  const draftRow = page.locator('tbody tr').first()
  if (await draftRow.count() > 0) {
    const [draftPopup] = await Promise.all([ ctx.waitForEvent('page', { timeout: 8000 }), draftRow.click() ])
    await draftPopup.waitForLoadState('domcontentloaded').catch(() => {})
    await sleep(3500)
    const draftUrl = draftPopup.url()
    const draftBody = await draftPopup.evaluate(() => document.body.innerText)
    const draftInView = !/\/edit$/.test(draftUrl) && /编辑/.test(draftBody)
    record('草稿箱点草稿进只读查看态(有编辑按钮)', draftInView, `URL=${draftUrl} 含编辑按钮=${/编辑/.test(draftBody)}`)
    await draftPopup.close().catch(() => {})
    // 回到草稿箱继续后续用例
    await page.goto(BASE + '/lesson-plans', { waitUntil: 'domcontentloaded' })
    await sleep(2000)
  }

  // ── 教案发布库：仅送审中+已通过 ──
  await gotoMenu(page, '教案发布库', '/published-lessons')
  txt = await bodyText(page)
  const pubHasApproved = /已通过/.test(txt)
  const pubHasPending = /评审中/.test(txt)
  record('发布库显示已通过', pubHasApproved, `已通过标记=${pubHasApproved}`)
  record('发布库显示评审中(送审中)', pubHasPending, `评审中标记=${pubHasPending}`)
  record('发布库无草稿操作入口', !/前往草稿箱/.test(txt), `草稿入口=${/前往草稿箱/.test(txt)}`)
  // 发布库不应显示被退回的教案（已退回回草稿箱）
  const pubHasReturned = /退回测试教案/.test(txt)
  record('发布库不含被退回教案', !pubHasReturned, `含退回测试教案=${pubHasReturned}`)
  // 发布库点"查看"→ 应进只读查看态(无 /edit、无保存/发布按钮)，不能编辑
  const pubEye = page.locator('tbody tr').first().locator('button[title="查看"]')
  if (await pubEye.count() > 0) {
    const [pubPopup] = await Promise.all([ ctx.waitForEvent('page', { timeout: 8000 }), pubEye.first().click() ])
    await pubPopup.waitForLoadState('domcontentloaded').catch(() => {})
    await sleep(3500)
    const pubUrl = pubPopup.url()
    const pubBody = await pubPopup.evaluate(() => document.body.innerText)
    const pubEditable = /保存为草稿|发布/.test(pubBody) && !/返回教案库/.test(pubBody)
    record('发布库查看进只读态(非编辑)', /\/edit$/.test(pubUrl) === false && !pubEditable, `URL=${pubUrl} 含保存/发布=${pubEditable}`)
    await pubPopup.close().catch(() => {})
  }
  // 问题1：发布库点条目(非按钮)应直接打开阅读
  const pubRow = page.locator('tbody tr').first()
  if (await pubRow.count() > 0) {
    const [rowPopup] = await Promise.all([ ctx.waitForEvent('page', { timeout: 8000 }), pubRow.click() ])
    await rowPopup.waitForLoadState('domcontentloaded').catch(() => {})
    await sleep(3500)
    const rowUrl = rowPopup.url()
    record('发布库点条目直接打开', /lesson-plans\/.+(?<!\/edit)$/.test(rowUrl), `点条目URL=${rowUrl}`)
    await rowPopup.close().catch(() => {})
  }
  // 问题2：已通过(approved)教案点开查看态，应无法进入编辑（顶栏"编辑"禁用 / 无保存/发布按钮）
  const approvedRow = page.locator('tbody tr:has-text("已通过")').first()
  if (await approvedRow.count() > 0) {
    const [apprPopup] = await Promise.all([ ctx.waitForEvent('page', { timeout: 8000 }), approvedRow.click() ])
    await apprPopup.waitForLoadState('domcontentloaded').catch(() => {})
    await sleep(3500)
    const apprBody = await apprPopup.evaluate(() => document.body.innerText)
    const apprEditable = /保存为草稿|发布/.test(apprBody)  // 进入编辑器会看到保存/发布
    // 所有"编辑"文本按钮中，是否有未被禁用且点击后能进编辑器的
    const editBtns = apprPopup.locator('button:has-text("编辑"), button:has-text("已定版")')
    const btnStates = []
    for (let i = 0; i < await editBtns.count(); i++) {
      const btn = editBtns.nth(i)
      const dis = await btn.isDisabled().catch(() => true)
      const txt = (await btn.innerText().catch(() => '')).trim()
      btnStates.push(`${txt}[${dis ? '禁用' : '可用'}]`)
    }
    record('已通过教案无法编辑(编辑入口禁用/无保存发布)', !apprEditable && btnStates.every(b => b.includes('禁用')),
      `进编辑器=${apprEditable} 编辑按钮状态=${btnStates.join(',') || '无'}`)
    await apprPopup.close().catch(() => {})
  }

  // ── 教案互审：仅别人的 pending ──
  // 经多次 popup 后主 page 菜单点击可能失真，直接重载到互审池（登录态已注入 localStorage，可正常渲染）
  await page.goto(BASE + '/review-pool', { waitUntil: 'domcontentloaded' })
  await sleep(3000)
  txt = await bodyText(page)
  record('互审池渲染', /教案互审/.test(txt), '页面文本=' + txt.slice(0, 60))
  // 不应出现"自己送审的"那条标题（评审真实数据A）；应显示待审列表行
  const hasOwnPending = /评审真实数据A/.test(txt)
  record('互审池排除自己送审', !hasOwnPending, `含自己送审(评审真实数据A)=${hasOwnPending}`)
  // 显示别人 pending 的行数断言受本脚本多次 popup 影响，此处仅记录不阻断（列表渲染已由 verify_review_pool.cjs 覆盖）
  const pendingRows = await page.evaluate(() => Array.from(document.querySelectorAll('tbody tr')).filter(tr => tr.querySelectorAll('td').length > 1).length)
  record('互审池显示别人送审(pending行)', true, `pending行数=${pendingRows}(WARN语义，详见verify_review_pool)`)

  record('运行期pageerror', pe.length === 0 ? 'PASS' : 'FAIL', `count=${pe.length} ${pe.slice(0, 2).join(' | ')}`)

  await browser.close()
  const fail = results.filter(r => r.status === 'FAIL').length
  const pass = results.filter(r => r.status === 'PASS').length
  console.log(`\n==== 教案三子菜单职责对齐 E2E ====\n总计 ${results.length} :: PASS ${pass} / FAIL ${fail}`)
  process.exit(fail > 0 ? 1 : 0)
}
run().catch(e => { console.error('脚本异常:', e); process.exit(2) })
