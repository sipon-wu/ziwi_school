// 二维码只应出现在**预览/放映态**（2026-09-15）—— 按三种真实入口验全。
// 入口规则（CoursewareList.tsx:142-155）：
//   草稿 + 点条目   → 编辑器 /:id/edit
//   已发布 + 点条目 → 放映/预览态 /:id
//   任意 + 点右端笔尖 → 编辑器 /:id/edit
// 期望：编辑态 → 右栏「批注/版本」；放映/预览态 → 右栏「手机扫码查看」+ 二维码。
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const log = (...a) => console.log(...a)

const probe = (pg) => pg.evaluate(() => {
  const body = document.body.innerText || ''
  return {
    path: location.pathname,
    scan: /手机扫码查看/.test(body),
    qr: [...document.querySelectorAll('img')].filter(i => (i.alt || '').includes('扫码')).length,
    ann: /批注/.test(body) && /版本/.test(body),
    previewTag: /预览模式|第 \d+\/\d+ 页/.test(body),
  }
})

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const H = { Authorization: 'Bearer ' + t }
  const all = (await (await fetch(B + '/api/materials', { headers: H })).json()).items || []
  const draft = all.find(x => x.format === 'h5' && String(x.name).includes('观潮 国风 09-15'))
  const pub = all.find(x => x.format === 'h5' && x.status === 'active')
  log(`草稿件=${draft ? draft.name : '（无）'} | 已发布 H5=${pub ? pub.name : '（无，需发布才能测这条）'}`)

  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1560, height: 940 } })
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 140)))
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)

  const openAndClick = async (name, selector) => {
    await p.goto(B + '/courseware/h5', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(5000)
    const row = p.locator('tr,div[class*="row"],li').filter({ hasText: name }).first()
    const target = selector === 'pencil' ? p.locator('button[title="编辑草稿"]').first() : row
    const [np] = await Promise.all([p.context().waitForEvent('page', { timeout: 15000 }), target.click()])
    await np.waitForLoadState('domcontentloaded').catch(() => { })
    await np.waitForTimeout(9000)
    return np
  }

  const results = {}

  // ① 草稿 + 点条目 → 期望编辑态
  if (draft) {
    const pg = await openAndClick(draft.name, 'row')
    const s = await probe(pg); results['草稿·点条目'] = s
    log(`① 草稿·点条目 → ${s.path}  扫码栏=${s.scan} 二维码=${s.qr} 批注&版本=${s.ann}`)
    await pg.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/qr_entry1_draft_row.png' })
    // ② 编辑态点「预览」→ 期望扫码栏（预览 overlay）
    await pg.locator('button:has-text("预览")').first().click().catch(() => { })
    await pg.waitForTimeout(6000)
    const s2 = await probe(pg); results['编辑态·点预览'] = s2
    log(`② 编辑态·点「预览」 → ${s2.path}  扫码栏=${s2.scan} 二维码=${s2.qr} 批注&版本=${s2.ann}`)
    await pg.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/qr_entry2_preview.png' })
    await pg.close()
  }

  // ③ 已发布 + 点条目 → 期望放映/预览态
  if (pub) {
    const pg = await openAndClick(pub.name, 'row')
    const s = await probe(pg); results['已发布·点条目'] = s
    log(`③ 已发布·点条目 → ${s.path}  扫码栏=${s.scan} 二维码=${s.qr} 批注&版本=${s.ann}`)
    await pg.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/qr_entry3_published.png' })
    await pg.close()
  }

  const r1 = results['草稿·点条目'], r2 = results['编辑态·点预览'], r3 = results['已发布·点条目']
  const ok = (!r1 || (/\/edit$/.test(r1.path) && !r1.scan && r1.ann))
    && (!r2 || (r2.scan && r2.qr > 0))
    && (!r3 || (!/\/edit$/.test(r3.path) && r3.scan && r3.qr > 0))
  log('\n结论：' + (ok ? '通过 ✔' : '不通过 ✘'))
  await br.close()
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
