/**
 * 「素材归属只读」UI 守卫（2026-09-18 立）
 *
 * 背景：后端 `PUT /api/materials/:id` 口径改为**仅本人可改**后，前端（CoursewareBuilder 的 `notMine`）
 *   靠 `localStorage.user.id` 与素材 `user_id` 比对来决定是否只读。
 *   ⚠ 若两侧 ID 口径漂移（例如一端 `u-teacher`、另一端数字 ID），**所有人打开自己的课件都会被误判为他人、
 *   直接禁存** —— 这是"改权限"最危险的失败模式，而 API 层守卫**查不出来**（API 一切正常，坏的是前端判定）。
 *   故必须用真浏览器守。
 *
 * 本脚本守：
 *   ① 打开**本人**课件 → 全程不出现「不是本人创建的」提示（ID 口径一致，未被误判）
 *   ② 打开**同事**（13800000003 王老师）课件 → 出现只读提示且点名作者
 *   ③ 收尾：两个临时件都清掉（各由本人删）
 */
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const MY = { phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }
const OTHER = { phone: process.env.PHONE_B || '13800000003', password: process.env.PASS_B || 'teacher123' }
const HINT = '不是本人创建的'
const DRAFT = '# 归属守卫\n\n## 页一\n- 仅供守卫使用\n'

const login = async (c) => (await (await fetch(B + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c),
})).json())
const create = async (lg, name) => (await (await fetch(B + '/api/materials/json', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token },
  body: JSON.stringify({ name, type: 'courseware', format: 'ppt', content: DRAFT, status: 'draft', subject: '语文', grade: '四年级' }),
})).json())
const del = async (lg, id) => (await fetch(B + '/api/materials/' + id, {
  method: 'DELETE', headers: { Authorization: 'Bearer ' + lg.token },
})).status

/** 在页内 200ms 轮询抓提示文案（toast 数秒即消失，必须持续采样才抓得到） */
const WATCH = () => {
  window.__hits = []
  setInterval(() => {
    const s = document.body ? document.body.innerText : ''
    if (s && new RegExp('该课件由|不是本人创建的').test(s)) {
      const m = s.match(/该课件由[^\n]{0,40}/)
      if (m && !window.__hits.includes(m[0])) window.__hits.push(m[0])
    }
  }, 200)
}

let br, aId, bId, mineLg, otherLg
;(async () => {
  mineLg = await login(MY); must(!!mineLg.token, '本人账号登录成功')
  otherLg = await login(OTHER); must(!!otherLg.token, '同事账号登录成功（同校）')
  must(!!mineLg.user?.id && !!otherLg.user?.id, '两账号均返回 user.id（前端比对的口径源）',
    { mineId: mineLg.user?.id, otherId: otherLg.user?.id })
  const a = await create(mineLg, '__E2E归属_本人')
  const b = await create(otherLg, '__E2E归属_同事')
  aId = a.id; bId = b.id
  must(!!aId && !!bId, '建出「本人件」与「同事件」', { mine: aId, other: bId })

  br = await chromium.launch()
  const errs = []
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto(B + '/login', { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [mineLg.token, mineLg.user])

  /* ① 本人课件：不得被判为"他人"（否则等于禁掉了所有正常编辑） */
  await p.addInitScript(WATCH)
  await p.goto(`${B}/courseware/ppt/${aId}/edit`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(11000)
  const mineHits = await p.evaluate(() => window.__hits || [])
  must(mineHits.length === 0, '打开本人课件**不出现**只读提示（user.id 与 user_id 口径一致，未被误判）', { hits: mineHits })

  /* ② 同事课件：必须出现只读提示 + 点名作者 */
  await p.goto(`${B}/courseware/ppt/${bId}/edit`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(11000)
  const otherHits = await p.evaluate(() => window.__hits || [])
  must(otherHits.length > 0, '打开同事课件出现只读提示（前端同步收口）', { hits: otherHits })
  must(otherHits.join(' ').includes('王老师'), '提示点名作者（王老师）', { hits: otherHits })
  must(errs.length === 0, '全程 pageerror=0', { errs })
  report()
})().catch(e => {
  console.error('✘ 脚本异常：' + e.message)
  process.exitCode = 2
}).finally(async () => {
  try { await br?.close() } catch { /* noop */ }
  /* ③ 收尾：各由本人删（后端只允许删自己名下的） */
  const out = []
  if (aId) out.push({ mine: await del(mineLg, aId) })
  if (bId) out.push({ other: await del(otherLg, bId) })
  console.log('   [cleanup] ' + JSON.stringify(out))
})
