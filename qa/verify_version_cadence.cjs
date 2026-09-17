// 版本节奏验收（2026-09-15，按产品规则：生成 / 保存草稿 / 发布 三个时机形成版本）
// 断言：
//   ① 点「保存草稿」→ 版本表**新增一条**（kind=snapshot、label=保存草稿、有时间戳）
//   ② 不改动再点一次 → **不重复建版本**（连点不该堆版本）
//   ③ 右侧版本列表 DOM 里能看到「快照」徽标 + 时间戳（2026-09-15 14:32 形式）
//   ④ 版本列表按时间倒序（最新在最上面）
// 说明：③"系统生成"这条时机的版本要在**生成之后的那次保存**里落（新建课件此刻还没有 materialId，
//      挂在本地草稿 key 上保存后会掉队）—— 该路径需一次真实 LLM 生成（约 100s），本脚本不覆盖，
//      以代码位置说明为准（pendingGenVersion 标记 → takeSaveVersion 里 label='AI 生成'）。
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
  const listVersions = async () =>
    (await (await fetch(`${B}/api/versions?resource_type=material&resource_id=${ID}`, { headers: H })).json()).items || []

  let bad = 0
  const chk = (c, m) => { if (!c) { bad++; console.log('   ✘ ' + m) } else console.log('   ✔ ' + m) }

  const before = await listVersions()
  console.log(`基线：版本数=${before.length}  最新=${before[0]?.label || '(无)'} ${before[0]?.created_at || ''}`)

  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(B, { waitUntil: 'domcontentloaded' })
  await p.evaluate(x => localStorage.setItem('zhiwei_token', x), t)
  if (user) await p.evaluate(u => localStorage.setItem('zhiwei_user', JSON.stringify(u)), user)
  await p.goto(`${B}/courseware/ppt/${ID}/edit`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(4000)

  const clickSave = async () => {
    const ok = await p.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === '保存草稿')
      if (!btn) return false
      btn.click(); return true
    })
    await p.waitForTimeout(3000)
    return ok
  }

  console.log('\n① 点「保存草稿」→')
  const clicked = await clickSave()
  chk(clicked, '找到并点击了「保存草稿」')
  const after1 = await listVersions()
  chk(after1.length === before.length + 1, `版本数 ${before.length} → ${after1.length}（应 +1）`)
  chk(after1[0]?.label === '保存草稿', `最新一条 label = ${after1[0]?.label}（应为"保存草稿"）`)
  chk(after1[0]?.kind === 'snapshot', `kind = ${after1[0]?.kind}（应为 snapshot）`)
  chk(!!after1[0]?.created_at, `有时间戳：${after1[0]?.created_at}`)

  console.log('\n② 不改动再点一次「保存草稿」→')
  await clickSave()
  const after2 = await listVersions()
  chk(after2.length === after1.length, `版本数保持 ${after2.length}（内容未变 → 不重复建版本）`)

  console.log('\n③ 列表 UI（徽标 + 时间戳）→')
  // 版本列表在「版本」页签下（此前没切页签 → 把"没显示"误判成功能问题）
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(x => /^版本/.test((x.textContent || '').trim()))
    if (btn) btn.click()
  })
  await p.waitForTimeout(1000)
  const rail = await p.evaluate(() => document.body.innerText)
  chk(/快照/.test(rail), '列表里出现「快照」徽标')
  chk(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(rail), '列表里出现时间戳（YYYY-MM-DD HH:mm）')
  chk(/保存草稿/.test(rail), '列表里出现「保存草稿」这一版')

  console.log('\n④ 倒序 →')
  const ts = after2.map(v => new Date(v.created_at).getTime())
  const desc = ts.every((x, i) => i === 0 || ts[i - 1] >= x)
  chk(desc, '版本按时间倒序（最新在最上面）')
  console.log('   最近的 5 条：')
  for (const v of after2.slice(0, 5)) {
    console.log(`     [${v.kind === 'release' ? '发布版' : '快照'}] ${String(v.created_at).slice(0, 16).replace('T', ' ')}  ${v.label}`)
  }

  console.log('\n注：③"系统生成"版本在**生成后的那次保存**里落（label=AI 生成）—— 需真实 LLM 生成，本脚本不覆盖')
  console.log(bad === 0 ? '\n结论：全部通过 ✔' : `\n结论：${bad} 项未通过 ✘`)
  await p.close()
  await b.close()
})().catch(e => console.error('ERR', e.message))
