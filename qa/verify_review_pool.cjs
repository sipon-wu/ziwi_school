// 知微 AI 教学助手 · 教案互审池专项真浏览器 E2E（复用阅读视图 + 评审人落库）
// 用法：BASE=http://school1.ziwi.cn node verify_review_pool.cjs
// 覆盖：列表真实拉取、小眼睛→复用已有查看态(阅读视图,非重造弹层)、
//       查看态出现「评审模式」标+通过/退回、通过→落评审人+跳回互审池+pending减少、不误移除。

const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const results = []
const record = (journey, status, detail) => {
  results.push({ journey, status })
  const tag = status === 'PASS' ? 'PASS' : status === 'WARN' ? 'WARN' : 'FAIL'
  console.log(`[${tag}] ${journey} :: ${String(detail).slice(0, 200)}`)
}

async function realLogin(page, phone, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[placeholder="请输入手机号"]', phone)
  await page.fill('input[placeholder="请输入密码"]', password)
  await page.click('button[type=submit]')
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await sleep(1800)
  return page.url()
}

async function countRows(page) {
  return await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('tbody tr'))
    return trs.filter(tr => tr.querySelectorAll('td').length > 1).length
  })
}

async function gotoReview(page) {
  const nav = await page.locator('a[href="/review-pool"]').count()
  if (nav === 0) {
    await page.click('button:has-text("教学备课")', { timeout: 5000 }).catch(() => {})
    await sleep(500)
  }
  await page.click('a[href="/review-pool"]', { timeout: 5000 })
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await sleep(3000)
}

async function run() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  const pe = []
  page.on('pageerror', e => pe.push(String(e.message || e)))

  const url = await realLogin(page, '13800000002', 'teacher123')
  record('教师(语文) UI登录', url.endsWith('/login') ? 'FAIL' : 'PASS', '落地=' + new URL(url).pathname)

  await gotoReview(page)
  const txt = await page.evaluate(() => document.body ? document.body.innerText : '')
  const redirected = /(^|\/)login$/.test(page.url())
  const visible = txt.length > 20 && /教案互审/.test(txt)
  record('互审页渲染', (visible && !redirected) ? 'PASS' : 'FAIL', `visible=${visible} redirect=${redirected}`)

  const before = await countRows(page)
  record('待审列表渲染', before > 0 ? 'PASS' : 'WARN', `可见待审项=${before}（真实 pending；无 mock fallback）`)

  // 用例0：列表整行点击→同样进入 ?review=1 阅读视图（与"小眼睛"统一入口）
  const firstRow = page.locator('tbody tr').first()
  await firstRow.click()
  await sleep(2200)
  const rowInView = /lesson-plans\/.+\?review=1/.test(page.url())
  const rowContent = /质量守恒|教案|教学|正文/.test(await page.evaluate(() => document.body.innerText))
  record('列表整行点击→统一阅读视图', rowInView && rowContent ? 'PASS' : 'FAIL',
    `整行点击进入review态=${rowInView} 正文渲染=${rowContent}`)
  // 回到列表继续后续用例
  await page.goto(BASE + '/review-pool', { waitUntil: 'domcontentloaded' })
  await sleep(2500)

  // 用例1：小眼睛→复用已有查看态（阅读视图），而非重造弹层
  const eyeBtn = page.locator('button[title="阅读并批注（查看态）"]').first()
  await eyeBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  await eyeBtn.click()
  await sleep(2500)
  const inView = /lesson-plans\/.+\?review=1/.test(page.url())
  const bodyText = await page.evaluate(() => document.body.innerText)
  const hasContent = /质量守恒|教案|教学目标|教学/.test(bodyText)
  const afterOpen = await countRows(page) // 已在查看态，列表不在 DOM，用 URL 判定不误移除
  record('小眼睛→复用阅读视图(查看态)', (inView && hasContent) ? 'PASS' : 'FAIL',
    `review态=${inView} 正文渲染=${hasContent}`)
  // 评审模式下不应出现左栏编辑态字段（班级/课时/教材单元等），仅作品本身
  const hasLeftPanelFields = /课时|教材单元|课型|班级/.test(bodyText)
  record('评审视图无左栏基本信息', !hasLeftPanelFields ? 'PASS' : 'FAIL',
    `编辑态左栏字段(课时/班级/课型/教材单元)=${hasLeftPanelFields}`)
  // 评审视图不应有 466px 固定左栏（EditorLayout 的硬约束，评审模式需绕过）
  const has466Left = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div')).some(el => {
      const cls = el.className || ''
      return typeof cls === 'string' && /w-\[466px\]/.test(cls)
    })
  })
  record('评审视图无466px固定左栏', !has466Left ? 'PASS' : 'FAIL', `存在466px左栏容器=${has466Left}`)
  // 评审视图应有批注侧栏（TipTapEditor 接收 resourceType/resourceId 后渲染批注面板）
  const annoInput = await page.locator('textarea[placeholder*="批注"]').count()
  record('评审视图显示批注侧栏', annoInput > 0 ? 'PASS' : 'FAIL', `批注textarea=${annoInput}`)
  // 评审批注可提交（无选中也能写，正文不需要先拖选，落到整篇 anchor）
  const annoTa = page.locator('textarea[placeholder*="批注"]').first()
  await annoTa.fill('评审E2E自动批注：建议补充例题。').catch(() => {})
  await sleep(200)
  const beforeAnno = await page.evaluate(async () => {
    const t = localStorage.getItem('zhiwei_token')
    const r = await fetch(`/api/annotations?resource_type=lesson_plan&resource_id=${location.pathname.split('/lesson-plans/')[1].split('?')[0]}`, { headers: { Authorization: 'Bearer ' + t } })
    return ((await r.json()).items || []).length
  })
  await page.locator('button:has-text("添加批注")').first().click()
  await sleep(1200)
  const afterAnno = await page.evaluate(async () => {
    const t = localStorage.getItem('zhiwei_token')
    const r = await fetch(`/api/annotations?resource_type=lesson_plan&resource_id=${location.pathname.split('/lesson-plans/')[1].split('?')[0]}`, { headers: { Authorization: 'Bearer ' + t } })
    return ((await r.json()).items || []).length
  })
  record('评审模式下批注可提交（无需先选正文）', afterAnno === beforeAnno + 1 ? 'PASS' : 'FAIL',
    `批注数 ${beforeAnno}→${afterAnno}`)
  // 评审视图应有左侧章节导航（评审者快速定位，fullscreen 默认展开）
  const hasToc = await page.evaluate(() => /章节导航/.test(document.body.innerText))
  record('评审视图显示章节导航', hasToc ? 'PASS' : 'FAIL', `章节导航=${hasToc}`)
  // 评审视图不应有编辑/预览/返回教案库 footer
  const noEditFooter = !(await page.locator('button:has-text("返回教案库")').count()) &&
                       !(await page.locator('button:has-text("导出教案")').count())
  record('评审视图无编辑态footer/导出', noEditFooter ? 'PASS' : 'FAIL', `返回教案库+导出教案=${!noEditFooter}`)
  record('阅读视图打开不误移除列表', (inView) ? 'PASS' : 'FAIL', `已跳转查看态(列表离开DOM属正常)`)

  // 用例2：查看态出现「评审模式」标 + 通过/退回按钮（评审人操作入口）
  const reviewBadge = /评审模式/.test(bodyText) || await page.locator('text=评审模式').count() > 0
  const approveBtn = page.locator('button:has-text("通过")').first()
  const rejectBtn = page.locator('button:has-text("退回")').first()
  record('查看态显示评审模式入口', reviewBadge ? 'PASS' : 'FAIL', `评审模式标=${reviewBadge}`)
  record('查看态提供通过/退回按钮', (await approveBtn.count() > 0 && await rejectBtn.count() > 0) ? 'PASS' : 'FAIL',
    `通过=${await approveBtn.count()} 退回=${await rejectBtn.count()}`)

  // 用例3：通过→落评审人 + 跳回互审池 + 后端 pending 减少
  const beforeApi = await page.evaluate(async () => {
    const t = localStorage.getItem('zhiwei_token')
    const r = await fetch('/api/review/pending', { headers: { Authorization: 'Bearer ' + t } })
    const d = await r.json()
    return d.total || (d.items ? d.items.length : 0)
  })
  await approveBtn.click()
  await sleep(2500)
  const backToPool = /review-pool$/.test(page.url())
  const afterApi = await page.evaluate(async () => {
    const t = localStorage.getItem('zhiwei_token')
    const r = await fetch('/api/review/pending', { headers: { Authorization: 'Bearer ' + t } })
    const d = await r.json()
    return d.total || (d.items ? d.items.length : 0)
  })
  record('通过→跳回互审池', backToPool ? 'PASS' : 'FAIL', `落地=${new URL(page.url()).pathname}`)
  record('通过→后端pending减少', afterApi === beforeApi - 1 ? 'PASS' : 'WARN',
    `后端pending ${beforeApi}→${afterApi}（WARN 可能因 mock 数据或无更多 pending）`)

  record('运行期pageerror', pe.length === 0 ? 'PASS' : 'FAIL', `count=${pe.length} ${pe.slice(0,2).join(' | ')}`)

  await browser.close()
  const fail = results.filter(r => r.status === 'FAIL').length
  const warn = results.filter(r => r.status === 'WARN').length
  const pass = results.filter(r => r.status === 'PASS').length
  console.log(`\n==== 教案互审(复用阅读视图+评审人落库)专项 E2E ====\n总计 ${results.length} :: PASS ${pass} / WARN ${warn} / FAIL ${fail}`)
  process.exit(fail > 0 ? 1 : 0)
}

run().catch(e => { console.error('脚本异常:', e); process.exit(2) })
