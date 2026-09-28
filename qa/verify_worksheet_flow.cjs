/**
 * 题单 / 习题库（工作单 · 简单卷面）—— 2026-09-29 立（补 55 条缺口里的"题单"）
 *
 * 为什么补这条：清退存量守卫时，`verify_sheet_unified`（题单 SheetBuilder）退役，而
 * **"题单/习题库"这块当时没有任何登记守卫**（见 `qa/RETIRED.md` 覆盖缺口清单）。
 *
 * 为什么主对象选 `/api/worksheets`（习题库）而不是 `/api/sheets`（题单）：
 *   `sheets` **没有 DELETE 路由** → 守卫造的数据**清不掉**（会往产品里留垃圾）。`worksheets` 是同一家族
 *   （"与试卷库同构，单题用快照"）且 **CRUD 齐全**，故主对象用它；`sheets` 只做**只读可达性**检查。
 *
 * 判据（全部走真实接口，读的是**真库**）：
 *   ① 新建落库：`POST /api/worksheets` → 201 + id；`GET /api/worksheets/:id` 回读的
 *      标题/学科/年级/题目**逐项与写入一致**；
 *   ② 更新真写库：`PUT` 改标题与题目 → 回读必须**跟着变**（不是假回显）；
 *   ③ 列表读真源：`GET /api/worksheets` 里能找到刚建的那条；
 *   ④ 删除真删：`DELETE` 后回读必须 **404**（不是"删了但还查得到"）；
 *   ⑤ `GET /api/sheets`（题单）可达且返回数组。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时用 psql **绕过 API 直接改库**（题目砍成 1 题、标题改掉）→
 *   `GET` 回读**必须立刻反映**（证明接口真在读库，没有任何中间缓存/假回显）。跑完还原。
 *
 * 用法：`node qa/verify_worksheet_flow.cjs`（约 10s，纯 API）
 *       `MUTATE=1 node qa/verify_worksheet_flow.cjs`
 */
const { execFileSync } = require('child_process')
const { must, report } = require('./lib/assert.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const MUTATE = process.env.MUTATE === '1'
const STAMP = Date.now()
const TITLE = `__E2E习题库自检_${STAMP}`
const TITLE2 = `__E2E习题库自检_改_${STAMP}`

/** 直连数据库（变异模式专用）：**绕过 API 直接改库**，看接口是否真读库 */
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

const mkQs = (n) => Array.from({ length: n }, (_, i) => ({
  stem: `__E2E习题Q${i + 1}__ 自检题干`, type: 'choice', options: 'A.甲\nB.乙', answer: 'A', sort: i + 1, score: 2,
}))
const QS6 = mkQs(6)
const QS3 = mkQs(3)

let wsId
;(async () => {
  const jread = async (r, what) => {
    const txt = await r.text()
    if (txt && !/^\s*[{[]/.test(txt)) {
      console.log(`   [SKIP] ${what} 返回非 JSON（HTTP ${r.status}）→ 环境未就绪，本套件**未验证**（skip ≠ pass）`)
      process.exit(2)
    }
    return txt ? JSON.parse(txt) : null
  }
  const lg = await jread(await fetch(`${B}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  }), '登录')
  must(!!lg.token, '教师登录成功（真实链路的调用方）', { user: lg.user && lg.user.name })
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }

  /* ── ⑤ 题单（sheets）只读可达性（无 DELETE 路由 → 不造数据）── */
  const sheets = await jread(await fetch(`${B}/api/sheets`, { headers: H }), '题单列表')
  must(Array.isArray(sheets) || Array.isArray(sheets && sheets.items),
    '题单面可达：GET /api/sheets 返回列表（该面无 DELETE 路由，故只读检查、不造数据）',
    { kind: Array.isArray(sheets) ? 'array' : typeof sheets })

  /* ── ① 前置：习题库接口**必须可用** ──
   *   ⚠ 2026-09-29 实测：`/api/worksheets` 全 500 —— `exercise_sheets` 表在库里**不存在**
   *   （`model.ExerciseSheet` 没进 `main.go` 的 AutoMigrate 清单，迁移目录里也没有这张表）。
   *   这是**真缺陷**，不是环境问题：前置不成立时后续校验**无法验证**（记未验证），但整体**必须判红**。 */
  const crResp = await fetch(`${B}/api/worksheets`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ title: TITLE, subject: '语文', grade: '四年级', questions: JSON.stringify(QS6), paper_size: 'A4' }),
  })
  const crTxt = await crResp.text()
  let cr = null
  try { cr = JSON.parse(crTxt) } catch { /* 非 JSON（网关错误页等） */ }
  const crErr = cr && cr.error ? String(cr.error) : ''
  must(crResp.status === 201 && !!(cr && cr.id),
    `① 习题库接口可用：POST /api/worksheets 应 201 且回 id（实测 HTTP ${crResp.status}${crErr ? ' / ' + crErr : ''}）`,
    { status: crResp.status, body: crErr || (cr && cr.id) || crTxt.slice(0, 120) })
  if (!(cr && cr.id)) {
    console.log('   [SKIP] 前置不成立 → 回读 / 更新 / 列表 / 删除四项**未验证**（skip ≠ pass，不堆成一片红）')
    console.log('   [根因] 见 qa/RETIRED.md「新守卫抓到的真缺陷」：模型 ExerciseSheet 未进 AutoMigrate、迁移里无 exercise_sheets')
    report()
    process.exit(1)     // 前置本身是真缺陷 → 整体判红（不是"未验证"）
  }
  wsId = cr.id
  must(!!wsId, '新建落库（POST /api/worksheets → 201 + id）', { id: wsId, title: TITLE })

  const read = async () => jread(await fetch(`${B}/api/worksheets/${wsId}`, { headers: H }), '习题库回读')
  const w1 = await read()
  must(w1 && w1.title === TITLE && w1.subject === '语文' && w1.grade === '四年级',
    '① 回读一致：标题/学科/年级与写入相同', { title: w1 && w1.title, subject: w1 && w1.subject, grade: w1 && w1.grade })
  const q1 = JSON.parse((w1 && w1.questions) || '[]')
  must(q1.length === QS6.length && q1.every((x, i) => x.stem === QS6[i].stem),
    `① 回读一致：${QS6.length} 题题干逐项与写入相同`, { got: q1.map(x => x.stem).slice(0, 3) })

  /* ── ③ 列表读真源 ── */
  const list = await jread(await fetch(`${B}/api/worksheets`, { headers: H }), '习题库列表')
  const arr = Array.isArray(list) ? list : ((list && list.items) || [])
  must(arr.some(x => x.id === wsId || x.title === TITLE),
    '③ 列表读真源：刚建的那条出现在 GET /api/worksheets 里', { n: arr.length })

  /* ── ② 更新真写库 ── */
  await fetch(`${B}/api/worksheets/${wsId}`, { method: 'PUT', headers: H, body: JSON.stringify({ title: TITLE2, questions: JSON.stringify(QS3) }) })
  const w2 = await read()
  const q2 = JSON.parse((w2 && w2.questions) || '[]')
  must(w2 && w2.title === TITLE2 && q2.length === QS3.length,
    '② 更新真写库：改标题与题目（6→3）后回读**跟着变**（不是假回显）',
    { title: w2 && w2.title, n: q2.length })

  /* ── 变异（强形态）：绕过 API 直接改库 → 回读必须立刻反映 ── */
  if (MUTATE) {
    const dump = psql(`SELECT title||'|'||(questions::text) FROM exercise_sheets WHERE id='${wsId}'`)
    if (dump === null) {
      console.log('   [SKIP] 强形态变异需改库（ssh/psql 不可用）→ 本项**未验证**（skip ≠ pass）')
      process.exit(2)
    }
    const origTitle = dump.split('|')[0]
    const oneQ = JSON.stringify(mkQs(1)).replace(/'/g, "''")
    const r = psql(`UPDATE exercise_sheets SET title='${TITLE}_psql', questions='${oneQ}'::jsonb WHERE id='${wsId}'`)
    if (r === null) { console.log('   [SKIP] psql 改库失败 → **未验证**'); process.exit(2) }
    try {
      const w3 = await read()
      const q3 = JSON.parse((w3 && w3.questions) || '[]')
      must(w3 && w3.title === `${TITLE}_psql` && q3.length === 1,
        '【变异测试·真注入】psql **绕过 API** 直接改库（标题 + 题目砍成 1 题）后，GET 回读**立刻反映** —— 证明接口真在读库，没有中间缓存/假回显',
        { title: w3 && w3.title, n: q3.length })
    } finally {
      const back = JSON.stringify(QS3).replace(/'/g, "''")
      psql(`UPDATE exercise_sheets SET title='${origTitle}', questions='${back}'::jsonb WHERE id='${wsId}'`)
    }
  }

  /* ── ④ 删除真删 ── */
  const del = await fetch(`${B}/api/worksheets/${wsId}`, { method: 'DELETE', headers: H })
  must([200, 204].includes(del.status), '④ 删除接口返回成功（200/204）', { status: del.status })
  const after = await fetch(`${B}/api/worksheets/${wsId}`, { headers: H })
  must(after.status === 404, '④ 删除**真删**：回读变 404（不是"删了但还查得到"）', { status: after.status })
  wsId = null   // 已删除，收尾不必再删

  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
}).finally(async () => {
  if (!wsId) return
  try {
    const lg = await (await fetch(`${B}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: PHONE, password: PASS }),
    })).json()
    const st = (await fetch(`${B}/api/worksheets/${wsId}`, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + lg.token },
    })).status
    console.log(`   [cleanup] 测试习题库已删除：${st}`)
  } catch (e) {
    console.log(`   [cleanup] 删除失败（需人工看一眼）：${e.message}`)
  }
})
