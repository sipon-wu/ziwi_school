// 生成路径验收（2026-09-15，产品规则第 1 条）：**系统生成并显示到屏幕上 = 自动一稿草稿**
// 断言：
//   ① 点「重新生成课件」后，**无需教师点保存**，版本表出现 label = `AI 生成（一稿）`
//   ② 该版本 kind=snapshot 且有时间戳
//   ③ 素材确实被自动落库（material.updated_at 变新）
// 说明：这需要一次真实 LLM 生成（约 1~3 分钟），会产生新内容 —— 跑在 staging 的测试课件上。
const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
const ID = '971395a2-55c5-4f34-bb42-9cf4ef1528c1'

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
  const material = async () => (await (await fetch(`${B}/api/materials/${ID}`, { headers: H })).json())

  let bad = 0
  const chk = (c, m) => { if (!c) { bad++; console.log('   ✘ ' + m) } else console.log('   ✔ ' + m) }

  const m0 = await material()
  const v0 = await versions()
  console.log(`基线：版本数=${v0.length} · material.updated_at=${m0.updated_at}`)

  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  if (user) await p.evaluate(u => localStorage.setItem('zhiwei_user', JSON.stringify(u)), user)
  await p.goto(`${B}/courseware/ppt/${ID}/edit`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(4000)

  // 生成按钮在「AI 模式」页签下（打开已有课件默认是「文档模式」，此处没有生成按钮）
  await p.evaluate(() => {
    const tab = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'AI 模式')
    if (tab) tab.click()
  })
  await p.waitForTimeout(1200)
  const clicked = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(x => /重新生成课件|AI 生成课件/.test((x.textContent || '').trim()))
    if (!btn) return false
    btn.click(); return true
  })
  chk(clicked, '切到「AI 模式」后点击了生成按钮')
  const t0 = Date.now()
  console.log('   生成中……（真实 LLM，约 1~3 分钟）')

  let hit = null
  for (let i = 0; i < 60; i++) {          // 最多等 5 分钟
    await p.waitForTimeout(5000)
    const vs = await versions()
    hit = vs.find(v => String(v.label || '').startsWith('AI 生成（一稿）'))
    if (hit) break
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0)
  console.log(`\n① 生成后 ${secs}s 检查版本 →`)
  chk(!!hit, '出现 label = 「AI 生成（一稿）」的版本（**未点保存**）')
  if (hit) {
    chk(hit.kind === 'snapshot', `kind=${hit.kind}（应为 snapshot）`)
    chk(!!hit.created_at, `有时间戳：${hit.created_at}`)
  }

  console.log('\n② 素材是否自动落库 →')
  const m1 = await material()
  chk(String(m1.updated_at) !== String(m0.updated_at), `material.updated_at 已更新（${m0.updated_at} → ${m1.updated_at}）`)

  console.log('\n③ 版本列表（最近 4 条）→')
  const vs = await versions()
  for (const v of vs.slice(0, 4)) {
    console.log(`   [${v.kind === 'release' ? '发布版' : '快照'}] ${String(v.created_at).slice(0, 16).replace('T', ' ')}  ${v.label}`)
  }

  console.log(bad === 0 ? '\n结论：全部通过 ✔' : `\n结论：${bad} 项未通过 ✘`)
  await p.close()
  await b.close()
})().catch(e => console.error('ERR', e.message))
