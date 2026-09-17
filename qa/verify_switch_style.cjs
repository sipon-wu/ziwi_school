// A 验收（2026-09-14）：「小微明确指令换风格」
// 断言（全部在浏览器实测，不靠读码推断）：
//   ① 在课件编辑器里对小微说「把课件换成国风风格」→ 小微回报**已切换**（说明编辑器真的收到了指令）
//   ② 画布的风格签名变了（配色/标题形态/底纹确实换了）
//   ③ 元素层几何**逐值不变**（换风格只换语汇、不重排 —— 这是"确定性"与"重生成"的分水岭）
//   ④ 不在编辑器里说同一句话 → 小微**如实**回报"要在课件编辑器里做"（不冒充成功）
//   ⑤ 全程不调模型：回复应在 3s 内出现（若走 /ai/chat，至少数秒到数十秒）
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const ID = '971395a2-55c5-4f34-bb42-9cf4ef1528c1'
const ASK = '把课件换成国风风格'

const CANVAS = `[...document.querySelectorAll('[style*="transform: scale"], .relative.bg-white')]
  .map(e => ({ e, r: e.getBoundingClientRect() })).filter(o => o.r.width > 400)
  .sort((a, b) => b.r.width - a.r.width)[0]?.e || null`

// 几何：元素层盒子的百分比指纹（限定主画布内，避免把左侧真实缩略图算进来）
const GEOM = `(() => {
  const root = ${CANVAS}; if (!root) return null
  const g = (s, k) => { const m = s.match(new RegExp(k + ':\\\\s*([0-9.]+)%')); return m ? m[1] : null }
  const set = new Set()
  for (const el of [root, ...root.querySelectorAll('*')]) {
    const s = el.getAttribute('style') || ''
    const l = g(s, 'left'), t = g(s, 'top'), w = g(s, 'width'), h = g(s, 'height')
    if (l && t && w && h) set.add(l + ',' + t + ',' + w + ',' + h)
  }
  return [...set].sort()
})()`

// 风格签名：画布 HTML 的哈希 + 出现最多的几个非白非透明颜色（换风格必然改变其一）
const SIG = `(() => {
  const root = ${CANVAS}; if (!root) return null
  const html = root.innerHTML
  let hsh = 0; for (let i = 0; i < html.length; i++) hsh = (hsh * 31 + html.charCodeAt(i)) | 0
  const cnt = {}
  for (const el of root.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    for (const k of ['backgroundColor', 'borderTopColor', 'color']) {
      const v = cs[k]
      if (v && v !== 'rgba(0, 0, 0, 0)' && v !== 'rgb(255, 255, 255)') cnt[v] = (cnt[v] || 0) + 1
    }
  }
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]).join(' ')
  return { hsh, len: html.length, top }
})()`

async function openXiaoWei(p) {
  // 多种策略（不同页面的入口长得不一样：编辑器内是"请补充要求…"入口条，其他页是浮动头像/气泡）
  const clicked = await p.evaluate(() => {
    const img = document.querySelector('img[alt="小微"]')
    const cand = (img && (img.closest('button') || img.parentElement))
      || [...document.querySelectorAll('button,[role=button],div')]
        .find(e => /^(小微|小微助教)/.test((e.textContent || '').trim()) || /小微/.test(e.getAttribute('aria-label') || ''))
    if (!cand) return false
    cand.click(); return true
  })
  await p.waitForTimeout(1200)
  return clicked
}

/** 等输入框出现（此前只查一次就返回 → 判成"功能没生效"，其实是我没等） */
async function waitInput(p, ms = 6000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const n = await p.evaluate(() => [...document.querySelectorAll('textarea,input')]
      .filter(e => {
        const ph = e.placeholder || ''
        return ph.includes('输入补充需求') || ph.includes('输入你想了解的内容')
      }).length)
    if (n > 0) return true
    await p.waitForTimeout(400)
  }
  return false
}

async function ask(p, text) {
  const t0 = Date.now()
  if (!(await waitInput(p))) {
    const ph = await p.evaluate(() => [...document.querySelectorAll('input,textarea')]
      .map(e => e.placeholder || '').filter(Boolean))
    console.log('   （诊断）当前可见输入框 placeholder：' + JSON.stringify(ph))
    return { ok: false, ms: Date.now() - t0, reply: '' }
  }
  const ok = await p.evaluate(async (t) => {
    // 两处小微的输入框文案不同：编辑器内 = EditXiaoWeiPanel「输入补充需求...」；
    // 其他页 = XiaoWeiChat「输入你想了解的内容...」→ 都要认（此前只认后者，导致"找不到输入框"）
    const inp = [...document.querySelectorAll('textarea,input')].find(e => {
      const ph = e.placeholder || ''
      return ph.includes('输入补充需求') || ph.includes('输入你想了解的内容')
    })
    if (!inp) return false
    inp.focus()
    // setter 必须取自**元素自己的** prototype（此前固定取 textarea 的 setter 用在 input 上
    // → 浏览器抛 `Illegal invocation`，考的是探针不是产品）
    const proto = inp.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
      : inp.tagName === 'INPUT' ? window.HTMLInputElement.prototype : null
    const setter = proto ? Object.getOwnPropertyDescriptor(proto, 'value')?.set : null
    if (setter) setter.call(inp, t); else inp.value = t
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    return (inp.value || '') === t
  }, text)
  if (!ok) return { ok: false, ms: Date.now() - t0, reply: '' }
  await p.keyboard.press('Enter')
  // 等小微回复出现「已把当前课件换成」或「换风格要在课件编辑器里做」
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(300)
    const r = await p.evaluate(() => {
      const t = document.body.innerText
      const m = t.match(/(已把当前课件换成[^\n]{0,60}|已恢复到上一个风格[^\n]{0,40}|换风格要在课件编辑器里做[^\n]{0,40}|想换成哪种风格[^\n]{0,40})/)
      return m ? m[1] : ''
    })
    if (r) return { ok: true, ms: Date.now() - t0, reply: r }
  }
  return { ok: false, ms: Date.now() - t0, reply: '' }
}

;(async () => {
  const lr = await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()
  const t = lr.token || lr.data?.token
  const user = lr.user || lr.data?.user || null
  const b = await chromium.launch()
  let bad = 0

  // ── ① 编辑器内换风格 ──
  let p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  if (user) await p.evaluate(u => localStorage.setItem('zhiwei_user', JSON.stringify(u)), user)
  await p.goto(`${B}/courseware/ppt/${ID}/edit`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(3500)
  const sig0 = await p.evaluate(SIG)
  const geom0 = await p.evaluate(GEOM)
  const opened = await openXiaoWei(p)
  const a = await ask(p, ASK)
  await p.waitForTimeout(1500)
  const sig1 = await p.evaluate(SIG)
  const geom1 = await p.evaluate(GEOM)

  console.log(`小微面板打开=${opened}  指令="${ASK}"`)
  console.log(`① 回复（${a.ms}ms）：${a.reply || '(无)'}`)
  const switched = /已把当前课件换成/.test(a.reply)
  if (!switched) { bad++; console.log('   ✘ 未回报"已切换"') }
  else console.log('   ✔ 回报"已切换"（编辑器确实收到了指令）')
  if (a.ms > 3000) { bad++; console.log(`   ✘ 耗时 ${a.ms}ms 偏长，疑似走了模型（应为确定性动作）`) }
  else console.log(`   ✔ 耗时 ${a.ms}ms（确定性动作，未走模型）`)

  const sigChanged = sig0 && sig1 && sig0.hsh !== sig1.hsh
  const geomSame = JSON.stringify(geom0) === JSON.stringify(geom1)
  console.log(`② 风格签名：前 ${sig0 && sig0.top} → 后 ${sig1 && sig1.top}  ${sigChanged ? '✔ 已改变' : '✘ 未变'}`)
  console.log(`③ 元素几何：前 ${geom0 ? geom0.length : '?'} 盒 → 后 ${geom1 ? geom1.length : '?'} 盒  ${geomSame ? '✔ 逐值不变' : '✘ 变了'}`)
  if (!sigChanged) bad++
  if (!geomSame) bad++
  await p.close()

  // ── ④ 不在编辑器里说同一句话 → 必须如实回报 ──
  p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  if (user) await p.evaluate(u => localStorage.setItem('zhiwei_user', JSON.stringify(u)), user)
  // 用**真实存在**的课件列表路由（此前用 /dashboard、/courseware 都落到未知路由 → 被重定向到登录页；
  // 路由表里没有裸 /courseware，真名是 /courseware/ppt —— 又是探针用错了路径，不是功能错）
  await p.goto(`${B}/courseware/ppt`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2500)
  await openXiaoWei(p)
  const a2 = await ask(p, ASK)
  console.log(`④ 非编辑器页回复（${a2.ms}ms）：${a2.reply || '(无)'}`)
  if (/换风格要在课件编辑器里做/.test(a2.reply)) console.log('   ✔ 如实回报（未冒充成功）')
  else { bad++; console.log('   ✘ 未如实回报') }
  await p.close()

  console.log(bad === 0 ? '\n结论：通过 ✔' : `\n结论：${bad} 项未通过 ✘`)
  await b.close()
})().catch(e => console.error('ERR', e.message))
