// 功能验证（2026-09-14）
// ① H5 点读「停止朗读」控件：点 .read-word 后应出现，点它应收起
// ② 小微进度气泡：发"做个 H5 课件"后，气泡文本应随 SSE 阶段变化（不再是一句话挂到底）
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const H = (t) => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + t })
const post = async (u, t, b) => (await fetch(B + u, { method: 'POST', headers: H(t), body: JSON.stringify(b) })).json()

;(async () => {
  const t = (await post('/api/auth/login', '', { phone: '13800000002', password: 'teacher123' })).token

  // ── ① 生成一份含点读的 H5 并落库 ──
  log('① 生成 H5（含点读场景）…')
  const gen = await post('/api/ai/courseware/generate', t, {
    subject: '英语', grade: '四年级', lesson_title: 'My Day',
    format: 'h5', style_tag: 'fresh',
    extra_requirements: '含点读跟读：单词与句子都要能点读',
  })
  const md = gen.courseware_markdown || ''
  if (!md.trim()) throw new Error('H5 生成为空')
  const m = await post('/api/materials/json', t, {
    name: '【验证】H5 点读停止控件', type: 'courseware', format: 'h5', tag: 'fresh',
    content: md, status: 'draft', grade: '四年级', subject: '英语', theme_id: 'fr-mint',
  })
  const h5id = m.id || (m.data && m.data.id)
  log('   H5 id=' + h5id + ' ERR=' + (gen.quality_report || {}).error_count + ' 页=' + (gen.quality_report || {}).pages)

  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate((x) => localStorage.setItem('zhiwei_token', x), t)

  // ── ② 验证「停止朗读」控件 ──
  log('② 打开 H5 编辑页 → 验证点读控件…')
  await p.goto(B + '/courseware/h5/' + h5id + '/edit', { waitUntil: 'networkidle' })
  await p.waitForTimeout(6000)
  const fr = p.frameLocator('iframe[title="H5 绘本预览"]')
  const nWords = await fr.locator('.read-word').count().catch(() => -1)
  log('   iframe 内 .read-word 数量 = ' + nWords)
  if (nWords > 0) {
    await fr.locator('.read-word').first().click()
    // 立刻轮询：控件应在点击后出现（headless 无语音时可能随即结束，故记录"是否出现过"）
    let appeared = false
    for (let i = 0; i < 12; i++) {
      if (await fr.locator('.tts-stop').count() > 0) { appeared = true; break }
      await p.waitForTimeout(100)
    }
    log('   点击后「停止朗读」是否出现过 = ' + appeared)
    if (appeared) {
      await fr.locator('.tts-stop').first().click().catch(() => {})
      await p.waitForTimeout(500)
      const left = await fr.locator('.tts-stop').count()
      log('   点「停止朗读」后是否收起 = ' + (left === 0))
    }
  } else {
    log('   ⚠ 该 H5 未生成点读场景，无法验证控件（记录为未覆盖）')
  }

  // ── ③ 验证小微进度气泡原地更新 ──
  log('③ 打开小微 → 发「做个 H5 课件」→ 观察气泡是否随阶段变化…')
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const opened = await p.evaluate(() => {
    const el = [...document.querySelectorAll('button,[role=button],div')]
      .find((e) => /小微/.test(e.getAttribute('title') || '') || /小微/.test((e.textContent || '').slice(0, 6)))
    if (el) { el.click(); return true }
    return false
  })
  log('   小微入口是否点到 = ' + opened)
  await p.waitForTimeout(1200)
  const box = p.locator('textarea, input[type=text]').last()
  await box.fill('做个H5互动课件：《My Day》英语四年级，点读跟读')
  await box.press('Enter')
  const seen = new Set()
  for (let i = 0; i < 16; i++) {
    const txt = await p.evaluate(() => {
      const hits = [...document.querySelectorAll('*')].filter((e) => e.childElementCount === 0 && /制作 H5 互动课件/.test(e.textContent || ''))
      return hits.length ? hits[hits.length - 1].textContent.trim().slice(0, 80) : ''
    })
    if (txt && !seen.has(txt)) { seen.add(txt); log('   气泡: ' + txt) }
    if (seen.size >= 2) break
    await p.waitForTimeout(6000)
  }
  log('   气泡是否发生过变化（≥2 种文本）= ' + (seen.size >= 2 ? '是 ✔' : '否（可能仍在生成中）'))
  await b.close()
  console.log('===== DONE =====')
})().catch((e) => { console.error('FAIL:', e.message); process.exit(2) })
