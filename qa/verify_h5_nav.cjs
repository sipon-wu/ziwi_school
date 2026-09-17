// H5 导航/白屏两个问题的验收（2026-09-15）
// 症状与根因（实测定位）：
//   ① 列表点入预览 → 再点「编辑」→ **空白页**
//      根因：H5 互动排序的 `useSensors` 写在 `{!ctrl.readOnly && … && (() => {…})()}` 这个 JSX IIFE 里，
//      查看态不执行、编辑态才执行 ⇒ hooks 数量变化 ⇒ React #310（Rendered more hooks…）→ 整页白屏。
//      修法：传感器提到组件顶层调用（hook 不能放在条件/IIFE 里）。
//   ② 列表右端「笔尖」按钮 → 进的是**预览页**
//      根因：按钮用了 `ch.open()`（`/:id` 放映态 URL），应为 `ch.openEdit()`（`/:id/edit`）。
// 断言：
//   A 预览 → 点编辑：页面不再空白（有内容 + iframe + 模式页签），且**无 React 错误**
//   B 列表笔尖按钮：新标签打开的 URL 以 `/edit` 结尾
//   C 列表点入（打开）：仍是放映态 URL（`/:id`，不误改成编辑）
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const DRAFT_H5 = '55b904c9-6b2d-4485-b824-a95bc72ce43c'
const PUB_H5 = 'cw-h5-00'

;(async () => {
  const lr = await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()
  const t = lr.token || lr.data?.token
  const user = lr.user || lr.data?.user || null
  let bad = 0
  const chk = (c, m) => { if (!c) { bad++; console.log('   ✘ ' + m) } else console.log('   ✔ ' + m) }

  const b = await chromium.launch()
  const prep = async (p) => {
    await p.goto(B, { waitUntil: 'domcontentloaded' })
    await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
    if (user) await p.evaluate(u => localStorage.setItem('zhiwei_user', JSON.stringify(u)), user)
  }
  const SNAP = `(() => ({
    t: (document.body.innerText || '').length,
    iframe: !!document.querySelector('iframe'),
    url: location.pathname,
    editTab: /AI 模式|文档模式/.test(document.body.innerText || ''),
  }))()`

  // ── A 预览 → 编辑 ──
  console.log('A 草稿 H5：进 `/h5/<id>`（放映态）→ 点「编辑」→')
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
    const errs = []
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 100)))
    await prep(p)
    await p.goto(`${B}/courseware/h5/${DRAFT_H5}`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(4000)
    const clicked = await p.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(x => /^(编辑|去编辑|编辑草稿)$/.test((x.textContent || '').trim()))
      if (!btn) return false
      btn.click(); return true
    })
    chk(clicked, '找到并点了「编辑」')
    await p.waitForTimeout(3500)
    const s = await p.evaluate(SNAP)
    chk(s.t > 200, `不再空白（正文字数 ${s.t}）`)
    chk(s.iframe, 'H5 画布（iframe）在')
    chk(s.url.endsWith('/edit'), `URL 已是编辑态（${s.url.slice(-24)}）`)
    chk(s.editTab, '出现「AI 模式 / 文档模式」页签（说明确实在编辑态）')
    chk(errs.length === 0, `无 React 错误（${errs.slice(0, 2).join(' | ') || '无'}）`)
    await p.close()
  }

  // ── B 列表「笔尖」按钮 ──
  console.log('\nB 列表页 → 草稿行右端「笔尖（编辑草稿）」→')
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
    await prep(p)
    await p.goto(`${B}/courseware/h5`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(3500)
    const [popup] = await Promise.all([
      p.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
      p.evaluate(() => {
        // 草稿行（含"编辑草稿"按钮）里点那个笔尖按钮
        const rows = [...document.querySelectorAll('div,li,tr')].filter(d => d.querySelector('button[title="编辑草稿"]'))
        const row = rows[rows.length - 1]
        const btn = row?.querySelector('button[title="编辑草稿"]')
        if (btn) { btn.click(); return true }
        return false
      }),
    ])
    chk(!!popup, '点击后打开了新标签')
    const url = popup ? popup.url() : ''
    console.log('   新标签 URL = ' + url)
    chk(/\/courseware\/h5\/[^/]+\/edit$/.test(url), '新标签是**编辑态 URL**（以 /edit 结尾）')
    if (popup) await popup.close()
    await p.close()
  }

  // ── C 列表「打开」按钮仍应进放映态 ──
  console.log('\nC 列表页 → 「打开（放映）」→')
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
    await prep(p)
    await p.goto(`${B}/courseware/h5`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(3500)
    const [popup] = await Promise.all([
      p.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
      p.evaluate(() => {
        const btn = [...document.querySelectorAll('button[title="打开"],button[title="放映"]')].pop()
        if (btn) { btn.click(); return true }
        return false
      }),
    ])
    const url = popup ? popup.url() : ''
    console.log('   新标签 URL = ' + url)
    chk(!!popup && !/\/edit$/.test(url), '放映按钮仍进放映态 URL（未被误改成 /edit）')
    if (popup) await popup.close()
    await p.close()
  }

  console.log(bad === 0 ? '\n结论：全部通过 ✔' : `\n结论：${bad} 项未通过 ✘`)
  await b.close()
})().catch(e => console.error('ERR', e.message))
