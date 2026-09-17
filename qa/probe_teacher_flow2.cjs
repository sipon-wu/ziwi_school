// 探针②（2026-09-15）：只查两件还没证实的事 ——
//   ① 教案页「知识点」当前 0/12，怎么选上（搜索框 → 结果项的真实 DOM）
//   ② 小微面板：发送后「应用到当前内容」是否出现（不点，只确认可达）
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const log = (...a) => console.log(...a)

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1560, height: 940 } })
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)

  await p.goto(B + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(4000)

  // ── ① 知识点搜索 ──
  const search = p.locator('input[placeholder="搜索知识点"]').first()
  log('搜索框存在 = ' + (await search.count() > 0))
  await search.fill('观潮')
  await p.waitForTimeout(2500)
  const after = await p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    // 搜索框所在面板内，所有"有文字的小块"
    const cands = [...document.querySelectorAll('div,li,button,span')].filter(vis)
      .filter(e => {
        const t = (e.innerText || '').trim()
        return t && t.length <= 14 && /观潮/.test(t) && e.children.length === 0
      })
    return {
      hits: cands.slice(0, 12).map(e => ({ tag: e.tagName.toLowerCase(), cls: (e.className || '').toString().slice(0, 40), text: (e.innerText || '').trim() })),
      chip: [...document.querySelectorAll('*')].filter(e => vis(e) && /^\d+\/\d+$/.test((e.textContent || '').trim())).map(e => e.textContent.trim()),
    }
  })
  log('搜索结果候选: ' + JSON.stringify(after.hits, null, 0))
  log('计数 chip: ' + after.chip.join(' '))
  // 试着点第一个候选（若可点）
  if (after.hits.length) {
    try {
      await p.locator('text=' + after.hits[0].text).first().click({ timeout: 4000 })
      await p.waitForTimeout(2000)
      const chip2 = await p.evaluate(() => [...document.querySelectorAll('*')]
        .filter(e => /^\d+\/\d+$/.test((e.textContent || '').trim())).map(e => e.textContent.trim()))
      log('点击第一个候选后 chip = ' + chip2.join(' ') + '  (若从 0/12 变成 n/12 即选中成功)')
    } catch (e) { log('点击候选失败: ' + e.message.slice(0, 80)) }
  }
  await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/probe2_knowledge.png' })

  // ── ② 小微面板 ──
  const entry = p.locator('button:has-text("请补充要求，支持会话、附件上传、在线素材")').first()
  log('\n小微入口条存在 = ' + (await entry.count() > 0))
  if (await entry.count()) {
    await entry.click()
    await p.waitForTimeout(1500)
    const box = p.locator('input[placeholder="输入补充需求..."], input[placeholder="请稍候..."]').first()
    log('面板输入框存在 = ' + (await box.count() > 0))
    if (await box.count()) {
      await box.fill('请按四年级语文课标要求生成《观潮》教案，突出时间顺序与景物变化，便于课堂诵读。')
      await p.waitForTimeout(300)
      // 发送：回车（源码 handleKeyDown）
      await box.press('Enter')
      log('已回车发送，等待小微回答…')
      for (let i = 0; i < 12; i++) {
        await p.waitForTimeout(3000)
        const st = await p.evaluate(() => {
          const btns = [...document.querySelectorAll('button')].map(e => (e.innerText || '').trim())
          return { apply: btns.filter(t => /应用到当前内容/.test(t)).length, texts: (document.body.innerText || '').length }
        })
        if (st.apply > 0) { log('「应用到当前内容」已出现（第 ' + (i + 1) + ' 次探测）'); break }
        if (i === 11) log('⚠ 12 次探测后仍未出现「应用到当前内容」')
      }
      const panelBtns = await p.evaluate(() => [...new Set([...document.querySelectorAll('button')]
        .map(e => (e.innerText || '').trim()).filter(t => t && t.length < 20))])
      log('面板按钮: ' + panelBtns.join(' / '))
    }
  }
  await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/probe2_xiaowei.png' })
  await b.close()
  log('\nPROBE2_DONE')
})().catch(e => { console.error('PROBE2_FAIL:', e.message); process.exit(2) })
