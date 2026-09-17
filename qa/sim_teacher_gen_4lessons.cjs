// 模拟教师手工流程：**四份别的课程**（2026-09-15）
// 用途：拿**新内容**做版面/字号/度量的试验田（旧件上调来调去没意义）。
// 每份都走完整源头链路：教案页（课标课时 + 小微提需求）→ 保存 → 课件页（AI 模式 · 风格 · 附加要求）→ 生成 → 保存草稿。
// 选择器全部来自已验证的探针；完成判据均为"自证式"（看落实的 DOM/API 事实，不等固定时间）。
const { chromium } = require('playwright')
const fs = require('fs')
const B = 'http://school1.ziwi.cn'
const D = '2026-09-15'
const S = '/Users/sipon/CodeBuddy/AI教案/qa/_shots/gen_4lessons'
fs.mkdirSync(S, { recursive: true })
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

const JOBS = [
  { lesson: '乡下人家', fmt: 'ppt', style: '国风', extra: '四年级语文《乡下人家》第一课时：抓"瓜藤攀棚→花开三季→雨后春笋→鸡鸭觅食→秋夜虫鸣"的画面顺序，讲清"总—分"结构，配一处仿写练习。' },
  { lesson: '天窗', fmt: 'ppt', style: '科技', extra: '四年级语文《天窗》第一课时：抓"想象"的两次展开（雨脚卜落卜落地跳、夜的星云闪电），讲"虚实相生"，配想象补白练习。' },
  { lesson: '三月桃花水', fmt: 'h5', style: '国风', extra: '四年级语文《三月桃花水》：抓"水声如铃、水清如镜"的比喻与排比，配朗读与画面想象，情景化呈现。' },
  { lesson: '琥珀', fmt: 'h5', style: '科技', extra: '四年级语文《琥珀》：抓"松脂滴落→形成化石→被发现"的推理链与科学小品文体，配"推断依据—结论"训练。' },
]

const post = async (u, t, b) => (await fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(b) })).json()
const get = async (u, t) => (await fetch(B + u, { headers: { Authorization: 'Bearer ' + t } })).json()

;(async () => {
  const t = (await post('/api/auth/login', '', { phone: '13800000002', password: 'teacher123' })).token
  if (!t) throw new Error('登录失败')
  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1560, height: 940 } })
  p.setDefaultTimeout(25000)
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 160)))
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)

  const out = []
  for (const j of JOBS) {
    const title = `${j.lesson} ${D.slice(5)}`            // 课题名 = 「课题 09-15」
    const label = `${j.fmt.toUpperCase()}·${j.lesson}`
    log(`=== ${label}（${title}）`)

    // ── ① 教案（源头：课标课时 + 小微提需求）──
    await p.goto(B + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(4000)
    await p.locator('input[placeholder="请在这里输入标题"]').fill(title)
    await p.locator('textarea[placeholder^="如：侧重实验探究"]').fill(j.extra)
    await p.locator('button:has-text("请补充要求，支持会话、附件上传、在线素材")').first().click()
    await p.waitForTimeout(1200)
    const ask = p.locator('input[placeholder="输入补充需求..."], input[placeholder="请稍候..."]').first()
    await ask.fill(`请按四年级语文课标要求生成《${j.lesson}》第一课时教案：${j.extra}`)
    await ask.press('Enter')
    const apply = p.locator('button:has-text("应用到当前内容")').first()
    await apply.waitFor({ state: 'visible', timeout: 90000 })
    await apply.click()
    log('  教案生成中…')
    let lpOk = false, lpId = ''
    for (let i = 0; i < 40; i++) {                       // 自证：轮询 /lesson-plans 是否出现该标题（自动保存会落库）
      await p.waitForTimeout(6000)
      const lps = await get('/api/lesson-plans', t)
      const hit = (lps.items || lps.data || []).find(x => String(x.title || '') === title)
      if (hit && String(hit.content || '').length > 800) { lpOk = true; lpId = hit.id; break }
    }
    log(`  教案落库=${lpOk} id=${lpId || '(未确认)'} 正文=${lpOk ? '≥800 字' : '-'}`)
    await p.locator('button:has-text("保存为草稿")').first().click().catch(() => { })
    await p.waitForTimeout(2500)

    // ── ② 课件 ──
    const exist = ((await get('/api/materials', t)).items || [])
      .find(x => String(x.name || '') === title + '_课件' && String(x.format || '') === j.fmt)
    if (exist) { log(`  课件已存在，跳过（id=${exist.id}）`); out.push({ label, title, id: exist.id, fmt: j.fmt, theme: exist.theme_id, ok: true, lp: lpId }); continue }

    await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('zhiwei_cw_draft')).forEach(k => localStorage.removeItem(k)))
    await p.goto(B + '/courseware/' + j.fmt + '/new', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(4000)
    await p.locator('button:has-text("AI 模式")').first().click()
    await p.waitForTimeout(1500)
    await p.locator('input[placeholder="如：光的折射定律"]').fill(title)
    await p.locator('button:has-text("' + j.style + '")').first().click()
    await p.locator('textarea[placeholder^="如：多放实验图示"]').fill(j.extra)
    await p.screenshot({ path: `${S}/${j.fmt}_${j.lesson}_form.png` })
    await p.getByRole('button', { name: /^(AI 生成课件|重新生成课件)$/ }).first().click()
    log('  课件生成中…')
    let done = false, calm = 0
    for (let i = 0; i < 55; i++) {
      await p.waitForTimeout(6000)
      const st = await p.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].map(e => (e.innerText || '').trim())
        return { busy: btns.some(x => /生成中|修订中|校验中/.test(x)), gen: btns.some(x => /AI 生成课件|重新生成课件/.test(x)), save: btns.some(x => /保存草稿/.test(x)), alive: (document.body.innerText || '').length > 200 }
      })
      if (i % 5 === 0) log(`    …${(i + 1) * 6}s busy=${st.busy} 存活=${st.alive}`)
      calm = (!st.busy && st.save && !st.gen && st.alive) ? calm + 1 : 0
      if (calm >= 2) { done = true; break }
    }
    if (done) await p.locator('button:has-text("保存草稿")').first().click().catch(() => log('  ⚠ 保存按钮不可达'))
    await p.waitForTimeout(5000)
    await p.screenshot({ path: `${S}/${j.fmt}_${j.lesson}_done.png` })
    const idm = p.url().match(/courseware\/(ppt|h5)\/([0-9a-f-]{8,})/)
    let id = idm ? idm[2] : ''
    if (!id) {
      const hit = ((await get('/api/materials', t)).items || []).find(x => String(x.name || '') === title + '_课件' && String(x.format || '') === j.fmt)
      id = (hit && hit.id) || ''
    }
    const back = id ? await get('/api/materials/' + id, t) : null
    log(`  生成=${done ? '成功' : '⚠ 超时'} id=${id || '(未找到)'} 回读：${back ? back.name + ' 正文' + String(back.content || '').length + '字 theme=' + back.theme_id : '(无)'}`)
    out.push({ label, title, id, fmt: j.fmt, theme: back?.theme_id || '', len: String(back?.content || '').length, ok: done, lp: lpId })
  }

  fs.writeFileSync('/Users/sipon/CodeBuddy/AI教案/qa/_logs/gen_4lessons_report.json', JSON.stringify({ date: D, jobs: out }, null, 2))
  console.log(`\n===== 交付清单（${D} · 四份别的课程）=====`)
  out.forEach(o => console.log(o.label.padEnd(14) + ' 正文=' + String(o.len).padEnd(6) + ' theme=' + String(o.theme).padEnd(20) + (o.id ? `http://school1.ziwi.cn/courseware/${o.fmt}/${o.id}/edit` : '（未生成）')))
  console.log('===== DONE =====')
  await br.close()
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
