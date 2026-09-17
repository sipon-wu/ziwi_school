// 两态几何一致性（2026-09-14，第二版）
// 用户最初两张截图差的是「内容 + 几何」；内容已被 verify_parity.cjs 逐字验证，这里验几何。
// 纪律（沿用 verify_parity 的教训）：
//   ① 目标页由**课件原文**导出；② 定位方式两态统一（页面里最大的画布容器）；
//   ③ **采集范围限定在主画布内** —— 否则会扫到左侧真实缩略图（每张缩略图都是一个完整渲染），造成假差异；
//   ④ 采集失败要报 NAV-FAIL，不把探针问题当产品问题。
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const IDS = [
  ['科技', '971395a2-55c5-4f34-bb42-9cf4ef1528c1'],
  ['清新', '8dd8f89f-4e67-43d1-a9d9-0cb30aa545b2'],
  ['国风', '194b0070-c528-455a-8450-2206334e0a4a'],
]

const CANVAS = `[...document.querySelectorAll('[style*="transform: scale"], .relative.bg-white')]
  .map(e => ({ e, r: e.getBoundingClientRect() })).filter(o => o.r.width > 400)
  .sort((a, b) => b.r.width - a.r.width)[0]?.e || null`

// 主画布内元素层盒子的百分比指纹（去重：同一矩形可能因嵌套包装器出现多次）
const BOXES = `(() => {
  const root = ${CANVAS}
  if (!root) return null
  const g = (s, k) => { const m = s.match(new RegExp(k + ':\\\\s*([0-9.]+)%')); return m ? m[1] : null }
  const set = new Set()
  for (const el of [root, ...root.querySelectorAll('*')]) {
    const s = el.getAttribute('style') || ''
    const l = g(s, 'left'), t = g(s, 'top'), w = g(s, 'width'), h = g(s, 'height')
    if (l && t && w && h) set.add(l + ',' + t + ',' + w + ',' + h)
  }
  return [...set].sort()
})()`

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token

  const b = await chromium.launch()
  let fail = 0
  for (const [label, ID] of IDS) {
    const m = await (await fetch(B + '/api/materials/' + ID, { headers: { Authorization: 'Bearer ' + t } })).json()
    const titles = (m.content || '').split('\n').filter(l => l.startsWith('## ')).map(l => l.slice(3).trim())
    const target = (titles[1] || titles[0] || '').replace(/\s/g, '')
    if (!target) { console.log(`[${label}] 原文无页标题 → 跳过`); continue }

    const got = {}
    for (const isEdit of [true, false]) {
      const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
      await p.goto(B, { waitUntil: 'domcontentloaded' })
      await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
      await p.goto(B + '/courseware/ppt/' + ID + (isEdit ? '/edit' : ''), { waitUntil: 'networkidle' })
      await p.waitForTimeout(3500)
      if (!isEdit) {
        await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find(b => /暂停/.test(b.textContent || '')); if (x) x.click() }).catch(() => {})
      }
      let ok = false
      for (let k = 0; k < 14; k++) {
        const txt = await p.evaluate(`((${CANVAS})?.innerText || '').replace(/\\s+/g, '')`)
        if (txt && txt.includes(target.slice(0, 6))) { ok = true; break }
        await p.evaluate((kw) => {
          const canv = [...document.querySelectorAll('[style*="transform: scale"], .relative.bg-white')]
            .map(e => ({ e, r: e.getBoundingClientRect() })).filter(o => o.r.width > 400)
            .sort((a, b) => b.r.width - a.r.width)[0]?.e || null
          const cand = [...document.querySelectorAll('div,button,li')]
            .filter(el => (el.innerText || '').includes(kw) && !(canv && canv.contains(el)))
            .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)
          const el = cand[0]
          if (el) (el.closest('button') || el).click()
        }, target.slice(0, 8)).catch(() => {})
        await p.waitForTimeout(900)
      }
      got[isEdit ? 'edit' : 'prev'] = { ok, boxes: await p.evaluate(BOXES) }
      await p.close()
    }

    if (!got.edit.ok || !got.prev.ok || !got.edit.boxes || !got.prev.boxes) {
      fail++
      console.log(`[${label}] **NAV-FAIL**（编辑找到=${got.edit.ok} 预览找到=${got.prev.ok}）→ 本次比对无效`)
      continue
    }
    const a = got.edit.boxes, c = got.prev.boxes
    const same = JSON.stringify(a) === JSON.stringify(c)
    if (!same) fail++
    console.log(`【${label}】目标页="${target.slice(0, 8)}" 编辑态 ${a.length} 个盒子 · 预览态 ${c.length} 个盒子 → ${same ? '逐值相同 ✔' : '不一致 ✘'}`)
    if (!same) {
      const onlyE = a.filter(x => !c.includes(x)), onlyP = c.filter(x => !a.includes(x))
      console.log('   仅编辑态有: ' + (onlyE.join(' | ') || '(无)'))
      console.log('   仅预览态有: ' + (onlyP.join(' | ') || '(无)'))
    }
  }
  console.log(fail === 0 ? '\n结论：两态几何逐值一致 ✔' : `\n结论：${fail} 项未通过`)
  await b.close()
})().catch(e => console.error('ERR', e.message))
