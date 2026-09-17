// 探针（2026-09-15）：把"教师从课标课时开始生成"这条 UI 路的**真实控件清单**打出来。
// 纪律：不猜选择器 —— 先让探针自证"导航成功 + 控件存在"，再由主脚本按真实文案点击。
// 只读，不点生成、不保存任何数据。
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const log = (...a) => console.log(...a)

async function dumpControls(page, tag) {
  const info = await page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    const labelOf = (e) => {
      const box = e.closest('div,section,fieldset') || e.parentElement
      const t = (box?.innerText || '').split('\n').map(s => s.trim()).filter(Boolean)
      return t.slice(0, 3).join(' | ')
    }
    const inputs = [...document.querySelectorAll('input,textarea')].filter(vis).map(e => ({
      tag: e.tagName.toLowerCase(), type: e.type, ph: e.placeholder || '', val: String(e.value || '').slice(0, 24), near: labelOf(e).slice(0, 60),
    }))
    const selects = [...document.querySelectorAll('select')].filter(vis).map(e => ({
      val: e.value, opts: [...e.options].map(o => o.text.trim()).slice(0, 10), near: labelOf(e).slice(0, 50),
    }))
    const btns = [...document.querySelectorAll('button')].filter(vis)
      .map(e => (e.innerText || '').trim().replace(/\s+/g, ' ')).filter(t => t && t.length < 26)
    const picked = [...document.querySelectorAll('*')].filter(e => vis(e) && /^\d+\/\d+$/.test((e.textContent || '').trim())).map(e => e.textContent.trim())
    return { title: document.title, url: location.pathname, inputs, selects, btns: [...new Set(btns)], picked }
  })
  log(`\n───── ${tag}  path=${info.url}`)
  log('  inputs : ' + JSON.stringify(info.inputs, null, 0))
  log('  selects: ' + JSON.stringify(info.selects, null, 0))
  log('  buttons: ' + info.btns.join(' / '))
  if (info.picked.length) log('  计数   : ' + info.picked.join(' '))
  return info
}

;(async () => {
  const t = (await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()).token
  if (!t) throw new Error('登录失败')

  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1560, height: 940 } })
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)

  // ① 首页：侧栏菜单 + 快捷创作卡（确认教师入口）
  await p.goto(B + '/teacher', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const home = await p.evaluate(() => ({
    menus: [...document.querySelectorAll('aside a, aside button, nav a, nav button')].map(e => (e.innerText || '').trim()).filter(Boolean),
    cards: [...document.querySelectorAll('button')].map(e => (e.innerText || '').trim().replace(/\s+/g, ' ')).filter(t => t && t.length < 22),
  }))
  log('── /teacher 侧栏菜单: ' + [...new Set(home.menus)].join(' / '))
  log('── /teacher 可点按钮  : ' + [...new Set(home.cards)].slice(0, 40).join(' / '))
  await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/probe_teacher_home.png' })

  // ② 教案页（课标课时源头）
  await p.goto(B + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await dumpControls(p, '② 教案 /lesson-plans/new')
  await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/probe_lesson_new.png', fullPage: false })

  // ③ 课件页（PPT 新建）
  await p.goto(B + '/courseware/ppt/new', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await dumpControls(p, '③ 课件 /courseware/ppt/new（默认文档模式）')
  // 切 AI 模式后再看一次
  const aiBtn = p.locator('button:has-text("AI 模式")').first()
  if (await aiBtn.count()) {
    await aiBtn.click()
    await p.waitForTimeout(2000)
    await dumpControls(p, '③b 同上（已切 AI 模式）')
  } else log('\n!! 未找到「AI 模式」按钮')
  await p.screenshot({ path: '/Users/sipon/CodeBuddy/AI教案/qa/_shots/probe_cw_new.png' })

  await b.close()
  log('\nPROBE_DONE')
})().catch(e => { console.error('PROBE_FAIL:', e.message); process.exit(2) })
