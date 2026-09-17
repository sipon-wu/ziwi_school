// H5 课件是否同一套版本规则的验收（2026-09-15）
// 断言：
//   ① H5 课件里小微换风格同样可用（轻档 → 确认 → 执行）
//   ② 同样自动形成「换风格前（…）」版本快照（与 PPT 同规则）
//   ③ **H5 画布真的重渲染**：iframe 的 srcDoc 变了
//      —— 这是 H5 特有的派生链（markdown → markdownToStorybookH5 → iframe srcDoc），
//         此前只在载入/生成/发布三处计算，编辑预览不刷新（本次补齐）
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const ID = '55b904c9-6b2d-4485-b824-a95bc72ce43c'   // H5·国风（生成的测试课件）

;(async () => {
  const lr = await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()
  const t = lr.token || lr.data?.token
  const user = lr.user || lr.data?.user || null
  const H = { Authorization: 'Bearer ' + t }
  const versions = async () =>
    (await (await fetch(`${B}/api/versions?resource_type=material&resource_id=${ID}`, { headers: H })).json()).items || []

  let bad = 0
  const chk = (c, m) => { if (!c) { bad++; console.log('   ✘ ' + m) } else console.log('   ✔ ' + m) }

  const m0 = await (await fetch(`${B}/api/materials/${ID}`, { headers: H })).json()
  const v0 = await versions()
  console.log(`课件：${m0.name} · status=${m0.status} · 版本数=${v0.length}`)

  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  if (user) await p.evaluate(u => localStorage.setItem('zhiwei_user', JSON.stringify(u)), user)
  await p.goto(`${B}/courseware/h5/${ID}/edit`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(4500)

  const h5sig = () => p.evaluate(() => {
    const f = document.querySelector('iframe')
    const doc = f?.getAttribute('srcdoc') || f?.getAttribute('srcDoc') || ''
    let h = 0; for (let i = 0; i < doc.length; i++) h = (h * 31 + doc.charCodeAt(i)) | 0
    return { len: doc.length, h }
  })
  const s0 = await h5sig()
  console.log(`基线：H5 画面 srcDoc=${s0.len} 字 · 指纹=${s0.h}`)
  chk(s0.len > 0, 'H5 画布是 iframe(srcDoc)，已读到派生 HTML')

  // 打开小微（与 PPT 同一个面板）
  await p.evaluate(() => { const i = document.querySelector('img[alt="小微"]'); if (i) (i.closest('button') || i.parentElement).click() })
  await p.waitForTimeout(1500)

  const say = async (text, expectRe, waitMs = 15000) => {
    const t0 = Date.now()
    const ok = await p.evaluate((tt) => {
      const inp = [...document.querySelectorAll('textarea,input')]
        .find(e => /输入补充需求|输入你想了解的内容/.test(e.placeholder || ''))
      if (!inp) return false
      inp.focus()
      const proto = inp.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
      if (setter) setter.call(inp, tt); else inp.value = tt
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }, text)
    if (!ok) return { ok: false, reply: '' }
    await p.keyboard.press('Enter')
    while (Date.now() - t0 < waitMs) {
      await p.waitForTimeout(300)
      const r = await p.evaluate((src) => {
        const all = [...document.body.innerText.matchAll(new RegExp(src, 'g'))]
        return all.length ? all[all.length - 1][0] : ''
      }, expectRe)
      if (r) return { ok: true, reply: r }
    }
    return { ok: false, reply: '' }
  }

  console.log('\n① H5 里换风格（换成科技风格 → 1 → 确认）→')
  let r = await say('换成科技风格', '有两种强度[\\s\\S]{0,120}')
  chk(/有两种强度/.test(r.reply), 'H5 里同样给出轻/重两档话术')
  r = await say('1', '请确认：[\\s\\S]{0,300}')
  chk(/「轻 · 只换风格语汇」/.test(r.reply.replace(/\n/g, ' ')), 'H5 里同样二次确认')
  r = await say('确认', '已把当前课件换成「科技」风格')
  chk(/已把当前课件换成「科技」风格/.test(r.reply), 'H5 里执行成功')

  await p.waitForTimeout(2000)
  const s1 = await h5sig()
  console.log(`\n② H5 画面：${s0.len} 字 → ${s1.len} 字 · 指纹 ${s0.h} → ${s1.h}`)
  chk(s1.h !== s0.h, '**H5 画布已重渲染**（iframe srcDoc 变了）')

  console.log('\n③ 版本规则是否与 PPT 一致 →')
  const v1 = await versions()
  chk(v1.length === v0.length + 1, `版本数 ${v0.length} → ${v1.length}（+1，与 PPT 同规则）`)
  chk(String(v1[0]?.label || '').startsWith('换风格前'), `最新版本 label = ${v1[0]?.label}`)
  chk(v1[0]?.kind === 'snapshot', `kind = ${v1[0]?.kind}`)

  console.log('\n结论：H5 与 PPT 同规则，且画布会随编辑/回退刷新 ✔' === '' ? '' :
    (bad === 0 ? '\n结论：全部通过 ✔' : `\n结论：${bad} 项未通过 ✘`))
  await p.close()
  await b.close()
})().catch(e => console.error('ERR', e.message))
