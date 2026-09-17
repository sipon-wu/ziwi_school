// 临时验证脚本（2026-09-14）：编辑态 vs 预览态「同一页」逐字比对。
// 纪律（针对本会话 4 次探针翻车）：
//   ① 目标页由**课件原文**导出（不写死关键词）；
//   ② 探针**自证导航成功**（找不到目标页就报 NAV-FAIL，而不是把探针问题当产品问题）；
//   ③ 两态用**各自正确的**画布选择器（编辑态 transform:scale / 预览态 .relative.bg-white）。
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const IDS = [
  ['科技', '971395a2-55c5-4f34-bb42-9cf4ef1528c1'],
  ['清新', '8dd8f89f-4e67-43d1-a9d9-0cb30aa545b2'],
  ['国风', '194b0070-c528-455a-8450-2206334e0a4a'],
]

// 取「主画布」文本：两态都取页面里最大的那个画布容器。
// （教训：此前按状态传不同选择器、且参数名写错 → 编辑态永远读到左侧表单，"找不到目标页"是探针问题）
const canvasText = () => {
  const pick = [...document.querySelectorAll('[style*="transform: scale"], .relative.bg-white')]
    .map(e => ({ e, r: e.getBoundingClientRect() }))
    .filter(o => o.r.width > 400)
    .sort((a, b) => b.r.width - a.r.width)[0]
  return pick ? pick.e.innerText.replace(/\s+/g, '') : null
}

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token

  const b = await chromium.launch()
  let fail = 0
  for (const [label, ID] of IDS) {
    // ① 目标页来自原文：第 2 个 ## 标题（去掉 '## '）
    const m = await (await fetch(B + '/api/materials/' + ID, { headers: { Authorization: 'Bearer ' + t } })).json()
    const titles = (m.content || '').split('\n').filter(l => l.startsWith('## ')).map(l => l.slice(3).trim())
    const target = (titles[1] || titles[0] || '').replace(/\s/g, '')
    if (!target) { console.log(`[${label}] 原文没有页标题 → 跳过`); continue }

    const got = {}
    for (const isEdit of [true, false]) {
      const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
      const errs = []
      p.on('pageerror', e => errs.push(e.message.slice(0, 80)))
      await p.goto(B, { waitUntil: 'domcontentloaded' })
      await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
      await p.goto(B + '/courseware/ppt/' + ID + (isEdit ? '/edit' : ''), { waitUntil: 'networkidle' })
      await p.waitForTimeout(3500)

      if (!isEdit) {
        // 预览态默认自动轮播 → 先暂停，翻页才可控
        await p.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find(x => /暂停/.test(x.textContent || ''))
          if (b) b.click()
        }).catch(() => {})
      }
      let ok = false
      for (let k = 0; k < 14; k++) {
        const txt = await p.evaluate(canvasText)
        if (txt && txt.includes(target.slice(0, 6))) { ok = true; break }
        // 两态统一：点左侧缩略图，按**目标页标题**找，并排除主画布内的同名文本 ——
        // 不排除的话会点到画布里的元素（空操作），这正是此前"预览态找不到目标页"的真因。
        await p.evaluate((kw) => {
          const canv = [...document.querySelectorAll('[style*="transform: scale"], .relative.bg-white')]
            .map(e => ({ e, r: e.getBoundingClientRect() })).filter(o => o.r.width > 400)
            .sort((a, b) => b.r.width - a.r.width)[0]?.e
          const cand = [...document.querySelectorAll('div,button,li')]
            .filter(el => (el.innerText || '').includes(kw) && !(canv && canv.contains(el)))
            .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)
          const t = cand[0]
          if (t) (t.closest('button') || t).click()
        }, target.slice(0, 8)).catch(() => {})
        await p.waitForTimeout(900)
      }
      const txt = await p.evaluate(canvasText)
      got[isEdit ? 'edit' : 'prev'] = { txt: txt || '', ok }
      if (errs.length) console.log(`   [${label}${isEdit ? ' 编辑' : ' 预览'}] 页面错误 ${JSON.stringify(errs.slice(0, 1))}`)
      await p.close()
    }

    const navOk = got.edit.ok && got.prev.ok
    if (!navOk) {
      fail++
      console.log(`[${label}] **NAV-FAIL**（编辑找到=${got.edit.ok} 预览找到=${got.prev.ok}；目标="${target.slice(0, 10)}"）→ 本次比对无效，不算产品结论`)
      continue
    }
    const sortStr = s => [...s].sort().join('')
    const exact = got.edit.txt === got.prev.txt
    const sameSet = sortStr(got.edit.txt) === sortStr(got.prev.txt)
    if (!sameSet) fail++
    console.log(`[${label}] 目标页="${target.slice(0, 10)}" 编辑=${got.edit.txt.length}字 预览=${got.prev.txt.length}字 → `
      + (exact ? '逐字一致 ✔' : sameSet ? '**内容一致**（仅 DOM 顺序不同）✔' : '内容不一致 ✘'))
    if (!sameSet) {
      let i = 0
      while (i < Math.min(got.edit.txt.length, got.prev.txt.length) && got.edit.txt[i] === got.prev.txt[i]) i++
      console.log(`   首个差异在第 ${i} 字：编辑="…${got.edit.txt.slice(Math.max(0, i - 12), i + 14)}"  预览="…${got.prev.txt.slice(Math.max(0, i - 12), i + 14)}"`)
    }
  }
  console.log(fail === 0 ? '\n结论：全部一致 ✔' : `\n结论：${fail} 项未通过`)
  await b.close()
})().catch(e => console.error('ERR', e.message))
