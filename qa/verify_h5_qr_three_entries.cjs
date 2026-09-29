/**
 * H5 课件库的「三种入口」归属（点行 / 右侧按钮 / 状态翻转后）—— 2026-09-29 立
 *
 * 为什么补这条：清退存量守卫时 `verify_h5_qr_three_entries` 退役（它是 H5 一族最后一条缺口）。
 * 它守的是**列表入口把你送到哪**——送错就是"教师点进课件库，落在编辑器里（甚至他人的只读件上）"。
 *
 * ⚠ **口径已按现实现更正**（退役文件写的是 2026-09-15 之前的老规则）：
 *   退役文件说「草稿点条目→编辑器 / 已发布点条目→预览」——**已不成立**。现实现（`CoursewareList.tsx`）：
 *     · **点行** → `openWorkspace(ch.open(id))` → `/courseware/h5/:id` **预览态**（**不分状态**；2026-09-15 修正）
 *     · 右侧按钮：**本人草稿** → `title="编辑草稿"` → `/courseware/h5/:id/edit` 编辑器；
 *       **已发布 / 他人草稿** → `title="打开"`（或「查看（他人草稿 · 仅本人可编辑）」）→ 仍是**预览态**
 *   本守卫按**现实现**写；下一个人不要照退役文件的老规则写断言（同 `RETIRED.md` 里二维码那条提醒）。
 *
 * 判据（真浏览器 + 真库状态；跳转是新标签，用 popup 捕获后核对 pathname）：
 *   ① 列表页可达，本件出现在列表里（草稿徽标）；
 *   ② **点行 → 预览态**：新标签 pathname === `/courseware/h5/:id`（无 `/edit`）；
 *   ③ **右侧按钮（本人草稿）→ 编辑器**：title === `编辑草稿`，新标签 pathname === `…/edit`；
 *   ④ **状态翻转后（psql 真改 `status='active'`）**：
 *      · 点行**仍是预览态**（规则与状态无关——这条最容易被人"顺手"改成"已发布才预览"）；
 *      · 右侧按钮 title 必须变成 `打开`，且点击**仍是预览态**（已发布不再给编辑器入口）；
 *   ⑤ 全程 pageerror = 0。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时，④ 的状态翻转就是**真注入**（真改库数据 → 入口归属必须跟着变），
 *   并额外把"按钮 title 从「编辑草稿」翻成「打开」"作为【变异测试·真注入】证据打印出来 ——
 *   若有人把入口写死（忽略状态），这两条必然红。
 *
 * 用法：`node qa/verify_h5_qr_three_entries.cjs`（约 40s）
 *       `MUTATE=1 node qa/verify_h5_qr_three_entries.cjs`
 */
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')
const { session, h5Content } = require('./lib/cwFixture.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const MUTATE = process.env.MUTATE === '1'
const STAMP = Date.now()
const NAME = `__E2E_H5入口自检_${STAMP}`

const SSH = process.env.SSH_TARGET || 'root@193.112.163.147'
const ENV_FILE = process.env.ENV_FILE || '/opt/zhiwei/code/deploy/.env.staging'
const psql = (sql) => {
  try {
    return execFileSync('ssh', [SSH,
      `set -a; . ${ENV_FILE}; set +a; docker exec -i zhiwei-postgres-staging psql -U "$DB_USER" -d "$DB_NAME" -t -A -c ${JSON.stringify(sql)}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map(s => s.trim()).filter(s => s && !/^WARNING|^DETAIL|^HINT|collation/i.test(s)).join('\n')
  } catch { return null }
}

let br, id
;(async () => {
  const { H, get } = await session()
  const cr = await (await fetch(`${B}/api/materials/json`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: NAME, type: 'courseware', format: 'h5', content: h5Content(), status: 'draft', subject: '语文', grade: '四年级' }),
  })).json()
  id = cr && cr.id
  must(!!id, '造一份 H5 课件（草稿态 · 本人）', { id, name: NAME })

  br = await chromium.launch()
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  const lg = await (await fetch(`${B}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
  })).json()
  must(!!lg.token, '教师登录成功', {})
  await p.goto(`${B}/login`, { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])

  /** 打开 H5 课件库并定位到本件那一行 */
  const openList = async (tag) => {
    await p.goto(`${B}/courseware/h5`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(5000)
    const info = await p.evaluate((name) => {
      const rows = [...document.querySelectorAll('tr')]
      const row = rows.find(r => (r.innerText || '').includes(name))
      if (!row) return null
      const btns = [...row.querySelectorAll('button')].map(b => ({ title: b.getAttribute('title') || '', text: (b.innerText || '').trim() }))
      return { text: (row.innerText || '').replace(/\s+/g, ' ').slice(0, 80), btns }
    }, NAME)
    console.log(`   [${tag}] 行=${info ? '命中' : '未命中'} 按钮=${JSON.stringify(info && info.btns)} 徽标=${info ? (info.text.includes('草稿') ? '草稿' : (info.text.includes('已发布') ? '已发布' : '?')) : '-'}`)
    return info
  }

  /** 点这一行的某个位置（行本身 or 指定 title 的按钮），捕获新标签并返回它的 pathname */
  const clickAndCatch = async (title) => {
    const [popup] = await Promise.all([
      ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null),
      p.evaluate(([name, t]) => {
        const row = [...document.querySelectorAll('tr')].find(r => (r.innerText || '').includes(name))
        if (!row) return false
        if (!t) { row.click(); return true }
        const b = [...row.querySelectorAll('button')].find(x => (x.getAttribute('title') || '') === t)
        if (!b) return false
        b.click(); return true
      }, [NAME, title || '']),
    ])
    if (!popup) return { url: null }
    await popup.waitForLoadState('domcontentloaded').catch(() => {})
    const url = new URL(popup.url())
    await popup.close().catch(() => {})
    return { url: url.pathname }
  }

  /* ── ① 列表可达 + 本件在列表里 ── */
  const row0 = await openList('草稿态')
  must(!!row0, '① H5 课件库可达且本件出现在列表里', { hit: !!row0 })
  must(row0.text.includes('草稿'), '① 本件在列表里显示「草稿」徽标', { row: row0.text })

  /* ── ② 点行 → 预览态（不分状态）── */
  const r1 = await clickAndCatch(null)
  must(r1.url === `/courseware/h5/${id}`,
    '② **点行 → 预览态** `/courseware/h5/:id`（2026-09-15 修正后的规则：点行=先看，草稿也同样）',
    { got: r1.url })

  /* ── ③ 右侧按钮（本人草稿）→ 编辑器 ── */
  const pencilTitle = (row0.btns.find(b => b.title === '编辑草稿') || {}).title
  must(pencilTitle === '编辑草稿', '③ 本人草稿的右侧按钮 title 是「编辑草稿」', { btns: row0.btns })
  const r2 = await clickAndCatch('编辑草稿')
  must(r2.url === `/courseware/h5/${id}/edit`,
    '③ **右侧按钮 → 编辑器** `/courseware/h5/:id/edit`（改内容走笔尖）', { got: r2.url })

  /* ── ④ 状态翻转（真改库）→ 入口归属必须跟着变 ── */
  await openList('翻转前')
  const flip = psql(`UPDATE materials SET status='active' WHERE id='${id}'`)
  if (flip === null) {
    console.log('   [SKIP] ④ 需改库（ssh/psql 不可用）→ 状态翻转相关判据**未验证**（skip ≠ pass）')
  } else {
    const row1 = await openList('翻转后（已发布）')
    must(!!row1 && row1.text.includes('已发布'), '④ psql 改状态后，列表徽标变成「已发布」', { row: row1 && row1.text })
    const r3 = await clickAndCatch(null)
    must(r3.url === `/courseware/h5/${id}`,
      '④ **已发布时点行仍是预览态**（"点行=先看"与状态无关 —— 最容易被人顺手改成"已发布才预览"）',
      { got: r3.url })
    const openTitle = (row1.btns.find(b => /打开/.test(b.title)) || {}).title
    must(openTitle === '打开',
      '④ 已发布后右侧按钮 title 从「编辑草稿」变成「打开」（不再给编辑器入口）',
      { before: pencilTitle, after: row1.btns })
    const r4 = await clickAndCatch('打开')
    must(r4.url === `/courseware/h5/${id}`,
      '④ 已发布时点右侧按钮**仍是预览态**（若入口写死或忽略状态，此条必红）', { got: r4.url })
    if (MUTATE) {
      must(openTitle !== pencilTitle && r3.url === `/courseware/h5/${id}` && r4.url === `/courseware/h5/${id}`,
        '【变异测试·真注入】psql **真改库状态**（草稿 → 已发布）后：右侧入口 title 翻转（`编辑草稿` → `打开`）'
        + '且点行/点按钮**都仍是预览态** —— 证明入口归属读的是**真库状态**，不是写死',
        { before: pencilTitle, after: openTitle, row: r3.url, btn: r4.url })
    }
  }

  must(errs.length === 0, '⑤ 全程 pageerror = 0', { errs })
  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
}).finally(async () => {
  try { await br?.close() } catch { /* noop */ }
  if (!id) return
  try {
    const lg = await (await fetch(`${B}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
    })).json()
    const st = (await fetch(`${B}/api/materials/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + lg.token } })).status
    console.log(`   [cleanup] 测试 H5 课件已删除：${st}`)
  } catch (e) {
    console.log(`   [cleanup] 删除失败：${e.message}`)
  }
})
