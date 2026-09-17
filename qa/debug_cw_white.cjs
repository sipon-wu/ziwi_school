// 调试（2026-09-15）：课件页"生成完成后白屏"——抓控制台报错与各阶段 DOM 状态
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
  p.on('console', m => { if (m.type() === 'error') log('  [console.error] ' + m.text().slice(0, 300)) })
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 300) + ' :: ' + String(e.stack || '').split('\n')[1] ))
  p.on('requestfailed', r => log('  [reqfail] ' + r.url().slice(0, 90) + ' ' + (r.failure() || {}).errorText))
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)

  await p.goto(B + '/courseware/ppt/new', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(4000)
  await p.locator('button:has-text("AI 模式")').first().click()
  await p.waitForTimeout(1500)
  await p.locator('input[placeholder="如：光的折射定律"]').fill('观潮 国风 09-15')
  await p.locator('button:has-text("国风")').first().click()
  await p.locator('textarea[placeholder^="如：多放实验图示"]').fill('四年级语文《观潮》第一课时：按时间顺序梳理景物变化，重点讲词语搭配与排比句。')
  log('表单就绪，点击 AI 生成课件')
  await p.locator('button:has-text("AI 生成课件")').first().click()

  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(6000)
    const st = await p.evaluate(() => ({
      rootLen: (document.getElementById('root')?.innerHTML || '').length,
      bodyLen: (document.body.innerText || '').length,
      btns: [...new Set([...document.querySelectorAll('button')].map(e => (e.innerText || '').trim()).filter(x => x && x.length < 16))].slice(0, 18),
      head: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
    }))
    log(`  ${(i + 1) * 6}s root=${st.rootLen} body=${st.bodyLen} 按钮=${st.btns.join('|')}`)
    if (st.bodyLen < 60 || st.rootLen < 200) {           // 白屏特征
      log('  ⚠ 疑似白屏，落快照')
      await p.screenshot({ path: S + '/white_' + (i + 1) + '.png' })
      fs.writeFileSync(S + '/white_dom.html', await p.content())
      break
    }
    if (st.btns.some(x => /重新生成课件/.test(x))) { log('  ✔ 生成完成'); await p.screenshot({ path: S + '/done.png' }); break }
  }
  // 收尾：看保存按钮是否可达
  const footBtns = await p.evaluate(() => [...document.querySelectorAll('button')].map(e => (e.innerText || '').trim()).filter(x => x && x.length < 16))
  log('  最终按钮: ' + [...new Set(footBtns)].join(' | '))
  await p.screenshot({ path: S + '/final.png' })
  await br.close()
  log('DEBUG_DONE')
})().catch(e => { console.error('DEBUG_FAIL:', e.message); process.exit(2) })
