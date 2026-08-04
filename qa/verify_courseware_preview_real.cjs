// 真实验证：创建多页课件 → 预览页(带左右侧栏、可下拉) → 编辑态
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

const A = []
const assert = (c, m) => { A.push((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1 }

;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(e.message))

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  if (!login.ok) { console.log('LOGIN_FAIL', login.status); process.exit(1) }
  const tok = (await login.json()).token
  const H = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }

  // 创建 5 页课件（JSON 专用端点 /api/materials/json）
  const pages = []
  for (let i = 1; i <= 5; i++) pages.push(`## 第${i}课\n- 知识点${i}\n- 例题${i}`)
  const content = '# 验证课件\n' + pages.join('\n')
  const create = await fetch(`${BASE}/api/materials/json`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: '验证课件_多页', type: 'courseware', tag: '语文七年级', content, status: 'active', grade: '七年级', subject: '语文' }),
  })
  if (!create.ok) { console.log('CREATE_FAIL', create.status, await create.text()); process.exit(1) }
  const created = await create.json()
  const mid = created.ID || created.id || (created.data && (created.data.ID || created.data.id))
  A.push('created id=' + mid)
  if (!mid) { console.log('NO_ID', JSON.stringify(created)); process.exit(1) }

  const popup = await context.newPage()
  await popup.goto(BASE, { waitUntil: 'domcontentloaded' })
  await popup.evaluate(t => localStorage.setItem('zhiwei_token', t), tok)
  await popup.goto(`${BASE}/courseware/ppt/${mid}`, { waitUntil: 'networkidle' })
  await popup.waitForTimeout(1200)
  const afterGotoUrl = popup.url()
  A.push('popupUrl=' + afterGotoUrl)
  if (afterGotoUrl.includes('/login')) { console.log('POPUP_REDIRECTED_TO_LOGIN'); process.exit(1) }

  // 1) 非全屏 overlay
  const overlayCount = await popup.locator('.fixed.inset-0.z-50').count().catch(() => 0)
  assert(overlayCount === 0, `预览页非全屏 overlay (count=${overlayCount})`)

  // 2) 左缩略图多项
  const leftThumbs = await popup.locator('text=/^P\\d+$/').count().catch(() => 0)
  assert(leftThumbs >= 5, `左侧多页缩略图 (count=${leftThumbs}, 期望>=5)`)

  // 3) 顶部编辑按钮
  const hasEditBtn = await popup.getByRole('button', { name: '编辑' }).isVisible().catch(() => false)
  assert(hasEditBtn, '预览页顶部有"编辑"按钮')

  // 4) 右栏可下拉：容器 overflow-y-auto 且可滚动
  const scrollInfo = await popup.evaluate(() => {
    const e = [...document.querySelectorAll('.overflow-y-auto')].pop()
    if (!e) return { found: false }
    const cs = getComputedStyle(e)
    return { found: true, overflowY: cs.overflowY, scrollH: e.scrollHeight, clientH: e.clientHeight, scrollable: e.scrollHeight > e.clientHeight }
  })
  A.push('rightPane=' + JSON.stringify(scrollInfo))
  assert(scrollInfo.found && (scrollInfo.overflowY === 'auto' || scrollInfo.overflowY === 'scroll'), `右栏容器可滚动(overflowY=${scrollInfo.overflowY})`)
  if (scrollInfo.scrollable) {
    const moved = await popup.evaluate(() => { const e = [...document.querySelectorAll('.overflow-y-auto')].pop(); e.scrollTop = 200; return e.scrollTop })
    A.push('rightPaneScrollTopAfterSet=' + moved)
    assert(moved > 0, `右栏实际可下拉(scrollTop=${moved})`)
  } else {
    assert(false, '右栏内容未溢出，多页课件应可滚动')
  }

  // 5) 点缩略图切页：P5 缩略图获得高亮（当前页），右栏可滚动到该页
  const p5Thumb = popup.locator('text=/^P5$/')
  await p5Thumb.click().catch(() => {})
  await popup.waitForTimeout(300)
  const p5Highlighted = await p5Thumb.evaluate(el => el.closest('div')?.className.includes('border-[#02A7F0]') || el.parentElement?.className.includes('02A7F0')).catch(() => false)
  A.push('p5ThumbHighlighted=' + p5Highlighted)
  assert(p5Highlighted, '点缩略图P5可切换并高亮当前页')
  // 右栏可滚到末页（确证长画布可下拉到任意页）
  const toEnd = await popup.evaluate(() => { const e = [...document.querySelectorAll('.overflow-y-auto')].pop(); e.scrollTop = e.scrollHeight; return e.scrollTop })
  await popup.waitForTimeout(200)
  const lastVisible = await popup.getByText('第5课').first().isVisible().catch(() => false)
  A.push('scrollToEnd_lastPageVisible=' + lastVisible)
  assert(lastVisible, '右栏滚动到底可看到第5课（长画布可下拉）')

  // 6) 点编辑→编辑态
  if (hasEditBtn) {
    await popup.getByRole('button', { name: '编辑' }).click()
    await popup.waitForTimeout(1000)
    const overlayAfter = await popup.locator('.fixed.inset-0.z-50').count().catch(() => 0)
    assert(overlayAfter === 0, `编辑态无全屏 overlay (count=${overlayAfter})`)
    const toolbar = await popup.getByText('+ 文本框', { exact: true }).isVisible().catch(() => false)
    assert(toolbar, '编辑态渲染工具栏(+文本框)')
  }

  // 清理
  await fetch(`${BASE}/api/materials/${mid}`, { method: 'DELETE', headers: H }).catch(() => {})

  assert(pageErrors.length === 0, '无 pageerror (' + pageErrors.join('|') + ')')
  await browser.close()
  console.log(A.join('\n'))
  console.log(process.exitCode ? 'OVERALL: FAIL' : 'OVERALL: PASS')
})().catch(e => { console.log('ERR', e.message); process.exit(1) })
