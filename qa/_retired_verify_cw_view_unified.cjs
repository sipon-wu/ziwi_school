// ── 已退役（2026-09-29，用户选「2 清存量守卫」）────────────────────────────
// 原用途：(原文件无头部说明)
// 退役理由：**从未登记进 `qa/run_all.cjs` 的守卫清单 ⇒ 不在 runner / 门禁 / CI 里执行** ——
//   它是"历史脚本"而不是"守卫"：没人跑它，就没人知道它的断言是否还成立（本轮之前还实测发现
//   这类文件多数带"静默通过"形状，见 `qa/gate_assert_hygiene.cjs` 的 R1~R4）。留着只会让人误以为这块有覆盖。
// 接管者：**无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单）
// 复活方式：去掉文件名前缀 `_retired_` 即可重新被扫描；要长期有效则**必须登记进 `qa/run_all.cjs`**（写 covers）。
// ──────────────────────────────────────────────────────────────────────
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const A = []
const assert = (c, m) => { A.push((c?'PASS ':'FAIL ')+m); if(!c) process.exitCode=1 }
;(async () => {
  const login = await fetch(`${BASE}/api/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({phone:PHONE,password:PASS}) })
  const tok = (await login.json()).token
  const H = { Authorization:'Bearer '+tok, 'Content-Type':'application/json' }
  const mats = await (await fetch(`${BASE}/api/materials?type=courseware`, { headers:H })).json().catch(()=>({}))
  const cwId = (mats.items||mats.data||[])[0]?.id || (mats.items||mats.data||[])[0]?.ID
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport:{width:1280,height:800} })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(e.message))
  await page.goto(BASE, { waitUntil:'domcontentloaded' })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), tok)
  await page.goto(`${BASE}/courseware/ppt/${cwId}`, { waitUntil:'networkidle' })
  await page.waitForTimeout(1800)
  const overlay = await page.locator('.fixed.inset-0.z-50').count()
  assert(overlay === 1, `查看态自动开全屏预览 overlay (count=${overlay})`)
  // overlay 标题栏的"编辑"按钮（PreviewOverlay 顶部条内）
  const editBtn = page.locator('.fixed.inset-0.z-50 > div:first-child button', { hasText: '编辑' })
  const editVisible = await editBtn.isVisible().catch(()=>false)
  assert(editVisible, '预览顶部有"编辑"按钮')
  const thumbs = await page.locator('text=/^P\\d+$/').count().catch(()=>0)
  assert(thumbs >= 1, `overlay 内左侧缩略图导航 (count=${thumbs})`)
  const scroll = await page.evaluate(() => {
    const ov = document.querySelector('.fixed.inset-0.z-50')
    if (!ov) return { found:false }
    const inner = [...ov.querySelectorAll('.overflow-y-auto')].pop()
    if (!inner) return { found:false }
    return { found:true, sh: inner.scrollHeight, ch: inner.clientHeight, canScroll: inner.scrollHeight > inner.clientHeight + 5 }
  })
  A.push('scroll=' + JSON.stringify(scroll))
  assert(scroll.found && scroll.canScroll, `overlay 放映区可下拉 (sh=${scroll.sh},ch=${scroll.ch})`)
  await page.screenshot({ path: 'cw_view_overlay.png' })
  if (editVisible) {
    await editBtn.click()
    await page.waitForTimeout(1500)
    const url = page.url()
    const overlayAfter = await page.locator('.fixed.inset-0.z-50').count()
    A.push('afterEditUrl=' + url)
    assert(url.includes('/edit'), `点编辑 URL 变 /edit (url=${url})`)
    assert(overlayAfter === 0, `编辑态无全屏 overlay (count=${overlayAfter})`)
    const toolbar = await page.getByText('导出 PPT', { exact:false }).first().isVisible().catch(()=>false)
    assert(toolbar, '编辑态渲染工具栏(导出 PPT)')
    await page.screenshot({ path: 'cw_edit_mode.png' })
  }
  assert(errs.length === 0, '无 pageerror (' + errs.join('|') + ')')
  await browser.close()
  console.log(A.join('\n'))
  console.log(process.exitCode ? 'OVERALL: FAIL' : 'OVERALL: PASS')
})().catch(e => { console.log('ERR', e.message); process.exit(1) })
