// 验证「课件库列表点入 = 预览态」（2026-09-15）
// 判定标准（不靠肉眼猜）：
//   行点击 / 「打开」 → URL = /courseware/<fmt>/<id>（**无** /edit）且页面处于 **只读查看态**
//                        （无「保存草稿」、有「编辑」、view 态自动开全屏预览）
//   右侧笔尖           → URL 含 /edit，且出现「保存草稿」（可编辑）
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const log = (...a) => console.log(...a)

async function probePopup(p) {
  return p.evaluate(() => ({
    title: document.title,
    // 只读查看态证据：**没有**「保存草稿」（编辑态才有），且有「编辑」按钮（view → edit 的解锁口）
    save: [...document.querySelectorAll('button')].some(b => /保存草稿/.test(b.innerText || '')),
    hasEdit: [...document.querySelectorAll('button')].some(x => (x.innerText || '').trim() === '编辑'),
    bodyLen: (document.body.innerText || '').length,
  }))
}
async function clickEdit(p) {
  return p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === '编辑')
    if (!b) return false
    b.click(); return true
  })
}

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const ms = (await (await fetch(B + '/api/materials', { headers: { Authorization: 'Bearer ' + t } })).json()).items || []
  const draft = ms.find(x => String(x.format) === 'ppt' && x.status === 'draft' && !/（旧/.test(String(x.name)))
  if (!draft) { console.error('没有可用的 PPT 草稿'); process.exit(1) }
  log(`测试对象（PPT 草稿）：${draft.name}  id=${draft.id}`)

  const br = await chromium.launch()
  const ctx = await br.newContext({ viewport: { width: 1560, height: 940 } })
  const page = await ctx.newPage()
  await page.goto(B + '/login', { waitUntil: 'domcontentloaded' })
  await page.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  await page.goto(B + '/courseware/ppt', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)

  // ① 点行
  const row = page.locator('tr', { hasText: draft.name.slice(0, 10) }).first()
  await row.click()
  await page.waitForTimeout(500)
  let pop = ctx.pages().find(x => x !== page)
  await pop.waitForLoadState('domcontentloaded').catch(() => { })
  await pop.waitForTimeout(6000)
  const rowUrl = pop.url()
  const s = await probePopup(pop)
  await pop.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/list_open_row_preview.png' })  // 停在本来的落点（未点编辑）
  const unlocked = await clickEdit(pop)     // 预览态应提供「编辑」入口 → 原地解锁到 /edit
  await pop.waitForTimeout(4000)
  log(`① 点「行」     → URL=${rowUrl.replace(B, '')}`)
  log(`                只读态证据：保存草稿=${s.save}（应 false）· 有「编辑」按钮=${s.hasEdit}（应 true）`)
  log(`                点「编辑」后 → ${pop.url().replace(B, '')}`)
  const rowOk = !/\/edit$/.test(rowUrl) && !s.save && s.hasEdit && /\/edit$/.test(pop.url())
  await pop.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/list_open_row_after_edit.png' })
  await pop.close().catch(() => { })

  // ② 点右侧笔尖（编辑）
  const pen = page.locator(`button[title="编辑草稿"]`).first()
  await pen.click()
  await page.waitForTimeout(500)
  pop = ctx.pages().find(x => x !== page)
  await pop.waitForLoadState('domcontentloaded').catch(() => { })
  await pop.waitForTimeout(6000)
  const penUrl = pop.url()
  const ps = await probePopup(pop)
  log(`② 点「笔尖」   → URL=${penUrl.replace(B, '')}  保存草稿可见=${ps.save}`)
  const penOk = /\/edit$/.test(penUrl) && ps.save
  await pop.close().catch(() => { })

  log('')
  log(rowOk ? '① 点行进预览态 ✔ 通过' : '① 点行进预览态 ✘ 未通过')
  log(penOk ? '② 笔尖进编辑态 ✔ 通过' : '② 笔尖进编辑态 ✘ 未通过')
  await br.close()
  process.exit(rowOk && penOk ? 0 : 2)
})().catch(e => { console.error('FAIL:', e.message); process.exit(3) })
