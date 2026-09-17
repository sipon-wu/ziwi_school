// 抓"生成完成后白屏"的现场（2026-09-15 · 科技风格）：控制台报错 + React 错误 + DOM 快照
const { chromium } = require('playwright')
const fs = require('fs')
const B = 'http://school1.ziwi.cn'
const S = '/Users/sipon/CodeBuddy/AI教案/qa/_shots/debug_white'
fs.mkdirSync(S, { recursive: true })
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1560, height: 940 } })
  const errs = []
  p.on('console', m => { if (m.type() === 'error') { errs.push('[console] ' + m.text()); log('  [console.error] ' + m.text().slice(0, 400)) } })
  p.on('pageerror', e => { errs.push('[pageerror] ' + e.message + '\n' + (e.stack || '')); log('  [pageerror] ' + String(e.message).slice(0, 400)); log('     at ' + String(e.stack || '').split('\n').slice(1, 4).join(' | ')) })
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('zhiwei_cw_draft')).forEach(k => localStorage.removeItem(k)))

  await p.goto(B + '/courseware/ppt/new', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(4000)
  await p.locator('button:has-text("AI 模式")').first().click()
  await p.waitForTimeout(1500)
  await p.locator('input[placeholder="如：光的折射定律"]').fill('观潮 科技 09-15')
  await p.locator('button:has-text("科技")').first().click()
  await p.locator('textarea[placeholder^="如：多放实验图示"]').fill('四年级语文《观潮》第一课时：按时间顺序梳理景物变化，重点讲词语搭配与排比句。')
  log('表单就绪（科技），点击 AI 生成课件')
  await p.locator('button:has-text("AI 生成课件")').first().click()

  let white = false
  for (let i = 0; i < 45; i++) {
    await p.waitForTimeout(6000)
    const st = await p.evaluate(() => ({
      bodyLen: (document.body.innerText || '').length,
      rootLen: (document.getElementById('root')?.innerHTML || '').length,
      btns: [...new Set([...document.querySelectorAll('button')].map(e => (e.innerText || '').trim()).filter(x => x && x.length < 16))].slice(0, 10),
    }))
    log(`  ${(i + 1) * 6}s root=${st.rootLen} body=${st.bodyLen}`)
    if (st.bodyLen < 60 && st.rootLen < 500) { white = true; log('  ⚠ 白屏，落快照'); break }
    if (st.btns.some(x => /保存草稿/.test(x)) && !st.btns.some(x => /生成中|修订中|校验中/.test(x)) && st.bodyLen > 200) { log('  ✔ 完成且存活'); break }
  }
  await p.screenshot({ path: S + '/tech_' + (white ? 'white' : 'ok') + '.png' })
  fs.writeFileSync(S + '/tech_dom.html', await p.content())
  fs.writeFileSync(S + '/tech_errs.txt', errs.join('\n\n'))
  log('共捕获报错 ' + errs.length + ' 条 → ' + S + '/tech_errs.txt')
  await br.close()
  log('DEBUG_DONE')
})().catch(e => { console.error('DEBUG_FAIL:', e.message); process.exit(2) })
