// 模拟教师手工流程生成课件（2026-09-15）
// 路径：登录 → 教案（课标课时源头：单元/课时/知识点 + 小微提需求）→ 生成教案 → 保存为草稿
//       → 教学课件 PPT/H5 × 风格（国风/科技）→ AI 模式 → 课题名称/风格/附加要求 → AI 生成课件 → 保存草稿
// 纪律：① 选择器全部来自探针证实（probe_teacher_flow*.cjs），不猜；② 每步留截图；③ 结束打印可目测清单。
const { chromium } = require('playwright')
const fs = require('fs')
const B = 'http://school1.ziwi.cn'
const D = '2026-09-15'
const SHOTS = '/Users/sipon/CodeBuddy/AI教案/qa/_shots/sim_0915'
fs.mkdirSync(SHOTS, { recursive: true })
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

const EXTRA = '四年级语文《观潮》第一课时：按“潮来前→潮来时→潮头过后”的时间顺序梳理景物变化，重点讲词语搭配与排比句，配诵读与仿写练习。'
const LESSON_TITLE = '观潮 ' + D.slice(5)                 // 标题有 12 字上限
const JOBS = [
  { fmt: 'ppt', style: '国风', title: '观潮 国风 ' + D.slice(5) },
  { fmt: 'ppt', style: '科技', title: '观潮 科技 ' + D.slice(5) },
  { fmt: 'h5', style: '国风', title: '观潮 国风 ' + D.slice(5) },
  { fmt: 'h5', style: '科技', title: '观潮 科技 ' + D.slice(5) },
]

const post = async (u, t, b) => (await fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(b) })).json()
const get = async (u, t) => (await fetch(B + u, { headers: { Authorization: 'Bearer ' + t } })).json()

;(async () => {
  const t = (await post('/api/auth/login', '', { phone: '13800000002', password: 'teacher123' })).token
  if (!t) throw new Error('登录失败')
  const br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1560, height: 940 } })
  p.setDefaultTimeout(20000)
  // 现场留痕：白屏是间歇性的（见过两次），没有报错与 URL 就无从定位
  p.on('pageerror', e => log('  [pageerror] ' + String(e.message).slice(0, 260)))
  p.on('console', m => { if (m.type() === 'error') log('  [console.error] ' + m.text().slice(0, 260)) })
  p.on('framenavigated', f => { if (f === p.mainFrame()) log('  [nav] ' + f.url().replace(B, '')) })
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)

  const chips = () => p.evaluate(() => [...document.querySelectorAll('*')]
    .filter(e => /^\d+\/\d+$/.test((e.textContent || '').trim())).map(e => e.textContent.trim()))

  // ══════════ 第一步：教案（课标课时源头） ══════════
  if (process.env.SKIP_LESSON === '1') {
    log('① 跳过教案（复用已生成的「观潮 09-15」lp_04a32a097ce2）')
  } else {
  log('① 进入教案页（课标课时源头）')
  await p.goto(B + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(4000)
  await p.locator('input[placeholder="请在这里输入标题"]').fill(LESSON_TITLE)
  await p.locator('textarea[placeholder^="如：侧重实验探究"]').fill(EXTRA)
  // 课时（第 2 个 select）默认第 1 课时；单元保持"请选择"（实测：选单元会清空图谱 → 0 个知识点 → 生成被拦）
  const sels = p.locator('select')
  log('   单元=' + (await sels.nth(0).inputValue() || '(未选)') + ' 课时=' + await sels.nth(1).inputValue()
    + ' 知识点=' + (await chips()).join(''))
  await p.screenshot({ path: SHOTS + '/1_lesson_form.png' })

  log('   小微提需求 → 应用到当前内容')
  await p.locator('button:has-text("请补充要求，支持会话、附件上传、在线素材")').first().click()
  await p.waitForTimeout(1200)
  const ask = p.locator('input[placeholder="输入补充需求..."], input[placeholder="请稍候..."]').first()
  await ask.fill('请按四年级语文课标要求生成《观潮》第一课时教案：' + EXTRA)
  await ask.press('Enter')
  const applyBtn = p.locator('button:has-text("应用到当前内容")').first()
  await applyBtn.waitFor({ state: 'visible', timeout: 90000 })
  await applyBtn.click()
  log('   已触发教案生成，等待…')
  let lpOk = false
  for (let i = 0; i < 48; i++) {
    await p.waitForTimeout(5000)
    const st = await p.evaluate(() => {
      const txt = document.body.innerText || ''
      const editors = [...document.querySelectorAll('.cm-content, textarea')].map(e => (e.innerText || e.value || '').length)
      return { len: Math.max(0, ...editors), has内容: /##|一、|教学目标/.test(txt), gening: /生成中|正在生成/.test(txt) }
    })
    if (i % 6 === 0) log(`     …${(i + 1) * 5}s 正文=${st.len}字 生成中=${st.gening}`)
    if (st.len > 400 && !st.gening) { lpOk = true; break }
  }
  log('   教案生成 = ' + (lpOk ? '成功' : '⚠ 超时未确认') + '，保存为草稿')
  await p.screenshot({ path: SHOTS + '/2_lesson_generated.png' })
  await p.locator('button:has-text("保存为草稿")').first().click()
  await p.waitForTimeout(4000)
  await p.screenshot({ path: SHOTS + '/3_lesson_saved.png' })
  }
  const lps = await get('/api/lesson-plans', t)
  const lpHit = (lps.items || lps.data || []).find(x => String(x.title || x.name || '').includes('观潮'))
  log('   教案已落库 id=' + (lpHit && (lpHit.id || lpHit.ID) || '(未找到)'))

  // ══════════ 第二步：4 份课件（PPT/H5 × 国风/科技） ══════════
  const out = []
  for (const j of JOBS) {
    const label = j.fmt.toUpperCase() + '·' + j.style
    // 已存在同名**同格式**就跳过，避免重复件（可安全重跑）
    // 注意：列表接口**不支持 format 过滤**（实测 ?format=ppt/h5 返回同一批），必须自己按 format 字段筛。
    const exist = ((await get('/api/materials', t)).items || [])
      .find(x => String(x.name || '') === j.title + '_课件' && String(x.format || '') === j.fmt)
    if (exist) { log('② 跳过 ' + label + '（已存在 id=' + exist.id + '）'); out.push({ label, fmt: j.fmt, style: j.style, title: j.title, id: exist.id, pages: 0, ok: true, name: exist.name, len: 0, theme: exist.theme_id || '' }); continue }
    log('② 生成 ' + label + '（' + j.title + '）')
    // 清掉本机草稿：/new 页会按 zhiwei_cw_draft_new 恢复上一份内容 → 会让"新的一稿"带着上一份的骨架
    await p.evaluate(() => { Object.keys(localStorage).filter(k => k.startsWith('zhiwei_cw_draft')).forEach(k => localStorage.removeItem(k)) })
    await p.goto(B + '/courseware/' + j.fmt + '/new', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(4000)
    await p.locator('button:has-text("AI 模式")').first().click()
    await p.waitForTimeout(1500)
    await p.locator('input[placeholder="如：光的折射定律"]').fill(j.title)
    await p.locator('button:has-text("' + j.style + '")').first().click()
    await p.locator('textarea[placeholder^="如：多放实验图示"]').fill(EXTRA)
    log('   表单就绪（风格=' + j.style + '）')
    await p.screenshot({ path: SHOTS + '/4_' + j.fmt + '_' + j.style + '_form.png' })

    await p.getByRole('button', { name: /^(AI 生成课件|重新生成课件)$/ }).first().click()
    log('   已触发生成，等待完成…')
    // 完成判据（2026-09-15 修正）：**不能等「重新生成课件」** —— 生成完成后界面会切到文档模式，
    // 生成按钮消失、只剩 保存草稿/预览/发布（实测 debug_cw_white.cjs 的最终态）。
    // 故判据 = 无 busy 文案 且「保存草稿」可见 且 生成按钮已消失（连续两次成立才算，避开切换瞬间的空帧）。
    let done = false, pages = 0, calm = 0
    for (let i = 0; i < 50; i++) {
      await p.waitForTimeout(6000)
      const st = await p.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].map(e => (e.innerText || '').trim())
        const tab = [...document.querySelectorAll('*')].map(e => (e.textContent || '').trim()).find(s => /^页面（\d+）$/.test(s)) || ''
        const body = document.body.innerText || ''
        return {
          busy: btns.some(x => /生成中|修订中|校验中/.test(x)),
          gen: btns.some(x => /AI 生成课件|重新生成课件/.test(x)),
          save: btns.some(x => /保存草稿/.test(x)),
          alive: body.length > 200,
          tab, pageN: Number(((tab.match(/(\d+)/) || [])[1]) || 0),
          title: (body.match(/观潮[^\n]{0,18}/) || [''])[0],
        }
      })
      if (st.tab) pages = st.pageN
      if (i % 5 === 0) log(`     …${(i + 1) * 6}s 页面=${pages} busy=${st.busy} 存活=${st.alive}`)
      calm = (!st.busy && st.save && !st.gen && st.alive) ? calm + 1 : 0
      if (calm >= 2) { done = true; break }
    }
    log('   生成=' + (done ? '成功' : '⚠ 超时') + ' 页数=' + pages)
    await p.screenshot({ path: SHOTS + '/5_' + j.fmt + '_' + j.style + '_generated.png' })
    // 保存草稿（容错）：生成完成时见过两次间歇性白屏（换页/渲染竞态），点不到按钮不该丢掉这一份 ——
    // 生成完成后前端本就有自动保存（实测会在素材库落一条 draft），故失败只记 ⚠，随后按名字回读确认。
    try {
      await p.locator('button:has-text("保存草稿")').first().click({ timeout: 15000 })
      log('   已点保存草稿')
    } catch {
      log('   ⚠ 保存按钮不可达（疑似白屏），改为回读确认是否已自动落库')
    }
    await p.waitForTimeout(5000)
    const url = p.url()
    const idm = url.match(/courseware\/(ppt|h5)\/([0-9a-f-]{8,})/)
    let id = idm ? idm[2] : ''
    if (!id) {   // 兜底：按名字+格式在素材库里找（列表接口不支持 format 过滤，自己筛）
      const ms = await get('/api/materials', t)
      const hit = (ms.items || []).find(x => String(x.name || '') === j.title + '_课件' && String(x.format || '') === j.fmt)
      id = (hit && hit.id) || ''
    }
    await p.screenshot({ path: SHOTS + '/6_' + j.fmt + '_' + j.style + '_saved.png' })
    // 落库自证：回读该素材，确认名字/正文/主题真的写进去了（不靠"我以为保存成功了"）
    let back = null
    if (id) back = await get('/api/materials/' + id, t)
    log('   已保存草稿 id=' + (id || '(未找到)') + ' 回读: 名字=' + (back?.name || '(无)')
      + ' 正文=' + String(back?.content || '').length + '字 theme=' + (back?.theme_id || '-'))
    out.push({ label, fmt: j.fmt, style: j.style, title: j.title, id, pages, ok: done,
      name: back?.name || '', len: String(back?.content || '').length, theme: back?.theme_id || '' })
  }

  fs.writeFileSync('/Users/sipon/CodeBuddy/AI教案/qa/_logs/sim_0915_report.json', JSON.stringify({ date: D, lessonPlanId: (lpHit && lpHit.id) || '', jobs: out }, null, 2))
  console.log('\n===== 交付清单（' + D + ' · 教师手工流程）=====')
  out.forEach(o => console.log(o.label.padEnd(9) + ' 页=' + String(o.pages).padEnd(3) + ' 正文=' + String(o.len).padEnd(6)
    + ' theme=' + String(o.theme).padEnd(20) + ' ' + (o.ok ? 'OK ' : '⚠  ') + B + '/courseware/' + o.fmt + '/' + o.id + '/edit'))
  console.log('教案 id = ' + ((lpHit && lpHit.id) || '(未找到)'))
  console.log('列表：' + B + '/courseware/ppt  ·  ' + B + '/courseware/h5')
  console.log('===== DONE =====')
  await br.close()
})().catch(e => { console.error('FAIL:', e.message); console.error(e.stack?.split('\n').slice(0, 4).join('\n')); process.exit(2) })
