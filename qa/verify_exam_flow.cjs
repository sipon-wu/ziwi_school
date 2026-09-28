/**
 * 出题 · 组卷/试卷库（真链路 + **真改库**注入）—— 2026-09-29 立
 *
 * 为什么补这条：清退存量守卫时，`verify_exam_generate / verify_exam_preview / verify_exam_warn`
 * 三个历史脚本退役，而**"出题/试卷"这块当时没有任何登记守卫**（见 `qa/RETIRED.md` 的覆盖缺口清单）。
 * 本守卫把它补成**已登记、会真跑**的一条。
 *
 * 判据（全部走真实链路，不靠读码推断）：
 *   ① **造卷落库**：`POST /api/exams` → 201 且带回 id；`GET /api/exams/:id` 回读的
 *      题干/题型/总分/题数与写入**逐项一致**（不是"创建成功"就算完）。
 *   ② **列表与预览读的是库里的真数据**：试卷库列表行显示真实题量（`N 题`）与总分；
 *      点「预览」后页内渲染出**第 1 页的题干**与**对折线**（A3 双排卷面的确定标记）。
 *      ⚠ 2026-09-29 探针实测：旧脚本用的 `[class*="aspect"]` A3 画布选择器**已失效**（现在是
 *        页内渲染 + `对折` 文案 + 纸型切换按钮），故断言改按**内容标记**写，不跟选择器较劲。
 *   ③ 全程 pageerror = 0。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时用 psql **真改库**把该卷的 questions 改成只剩前 2 题 →
 *   ① HTTP 回读必须变 2 题 ② **列表里的题量必须跟着变**（证明 UI 读真源，不是本地缓存/写死）
 *   ③ 预览里必须**不再**出现第 3 题题干。跑完还原 + 删除测试卷。
 *
 * 用法：`BASE=http://school1.ziwi.cn node qa/verify_exam_flow.cjs`
 *       `MUTATE=1 node qa/verify_exam_flow.cjs`（强形态变异自检）
 */
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const MUTATE = process.env.MUTATE === '1'
const STAMP = Date.now()
const TITLE = `__E2E卷自检_${STAMP}`

/** 直连数据库（变异模式专用）：**真改库**里的试卷题目，而不是"在内存里换掉输入" */
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

const QS = [1, 2, 3, 4, 5, 6].map(i => ({
  stem: `__E2E卷Q${i}__ 自检题干`, type: i <= 4 ? 'choice' : 'judge',
  options: i <= 4 ? 'A.甲\nB.乙\nC.丙\nD.丁' : '', answer: i <= 4 ? 'A' : '正确',
  sort: i, score: 3,
}))
const TOTAL = 18   // 6 × 3

let br, examId
;(async () => {
  /** 环境未就绪（冷启动/网关错误页）→ 记 SKIP（未验证），不冤枉被测对象为失败 */
  const jread = async (r, what) => {
    const txt = await r.text()
    if (!/^\s*[{[]/.test(txt)) {
      console.log(`   [SKIP] ${what} 返回非 JSON（HTTP ${r.status}）→ 环境未就绪，本套件**未验证**（skip ≠ pass）`)
      process.exit(2)
    }
    return JSON.parse(txt)
  }

  const lg = await jread(await fetch(`${B}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  }), '登录')
  must(!!lg.token, '教师登录成功（真实链路的调用方）', { user: lg.user && lg.user.name })
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }

  /* ── ① 造卷 + 回读一致 ── */
  const cr = await jread(await fetch(`${B}/api/exams`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ title: TITLE, subject: '语文', grade: '四年级', questions: JSON.stringify(QS), total_score: TOTAL, duration_minutes: 20 }),
  }), '造卷')
  examId = cr.id
  must(!!examId, '造卷成功（POST /api/exams 带回 id）', { id: examId, title: TITLE })

  const read = async () => jread(await fetch(`${B}/api/exams/${examId}`, { headers: H }), '试卷回读')
  const e1 = await read()
  const q1 = JSON.parse(e1.questions || '[]')
  must(e1.title === TITLE && Number(e1.total_score) === TOTAL,
    '回读一致：标题与总分与写入相同', { title: e1.title, total: e1.total_score })
  must(q1.length === QS.length && q1.every((x, i) => x.stem === QS[i].stem && x.type === QS[i].type),
    `回读一致：${QS.length} 题的题干与题型逐项与写入相同（不是"创建成功"就算完）`,
    { got: q1.map(x => x.stem).slice(0, 3) })

  /* ── ② 列表与预览读真数据 ── */
  br = await chromium.launch()
  const errs = []
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto(`${B}/login`, { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])

  const openList = async () => {
    await p.goto(`${B}/exams`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(4000)
    return p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  }
  const rowText = async (txt) => {
    const i = txt.indexOf(TITLE)
    return i < 0 ? '' : txt.slice(i, i + 60)
  }
  let listTxt = await openList()
  const row1 = await rowText(listTxt)
  must(row1.length > 0, '试卷库列表出现刚造的试卷（按标题定位到行）', { row: row1 })
  must(new RegExp(`${QS.length}\\s*题`).test(row1) && new RegExp(`${TOTAL}\\s*分`).test(row1),
    '列表行显示**真实题量与总分**（读库数据，不是占位）', { row: row1 })

  const openPreview = async () => {
    const how = await p.evaluate((title) => {
      const row = [...document.querySelectorAll('tr')].find(r => r.innerText.includes(title.slice(0, 12)))
      if (!row) return 'no-row'
      const btn = [...row.querySelectorAll('button')].find(b => /预览/.test(b.title || b.innerText || ''))
      if (btn) { btn.click(); return 'preview-btn' }
      row.click(); return 'row-click'
    }, TITLE)
    await p.waitForTimeout(4000)
    return { how, txt: await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')) }
  }
  const pv1 = await openPreview()
  must(pv1.how !== 'no-row', '找到该卷的「预览」入口并点击', { how: pv1.how })
  must(pv1.txt.includes('__E2E卷Q1__'),
    '预览渲染出**第 1 页题干**（内容是库里那份卷子，不是空壳预览）', { has: pv1.txt.includes('__E2E卷Q1__') })
  must(/对折/.test(pv1.txt) && /A3/.test(pv1.txt),
    '预览是**A3 双排卷面**（有纸型切换与"对折"标记 —— 旧脚本的 aspect 选择器已失效，改为按内容标记断言）',
    { dashed: /对折/.test(pv1.txt), a3: /A3/.test(pv1.txt) })

  /* ── ③ 变异（强形态）：真改库题目 → 列表/预览必须跟着变 ── */
  if (MUTATE) {
    const keep = JSON.stringify(QS.slice(0, 2)).replace(/'/g, "''")
    const orig = JSON.stringify(QS).replace(/'/g, "''")
    const r = psql(`UPDATE exams SET questions='${keep}'::jsonb WHERE id='${examId}'`)
    if (r === null) {
      console.log('   [SKIP] 强形态变异需改库（ssh/psql 不可用）→ 本项**未验证**（skip ≠ pass）')
      process.exit(2)
    }
    try {
      const e2 = await read()
      must(JSON.parse(e2.questions || '[]').length === 2,
        '【变异测试·真注入】真改库把题目改成 2 题后，HTTP 回读必须是 2 题（读的是库）',
        { got: JSON.parse(e2.questions || '[]').length })
      listTxt = await openList()
      const row2 = await rowText(listTxt)
      must(/2\s*题/.test(row2) && !/6\s*题/.test(row2),
        '【变异测试·真注入】列表里的题量**跟着库变**（6 题 → 2 题）—— 证明 UI 读真源，不是本地缓存/写死',
        { row: row2 })
      const pv2 = await openPreview()
      must(!pv2.txt.includes('__E2E卷Q3__') && pv2.txt.includes('__E2E卷Q1__'),
        '【变异测试·真注入】预览里第 3 题消失、第 1 题仍在（预览渲染的是库里的题目）',
        { hasQ1: pv2.txt.includes('__E2E卷Q1__'), hasQ3: pv2.txt.includes('__E2E卷Q3__') })
    } finally {
      psql(`UPDATE exams SET questions='${orig}'::jsonb WHERE id='${examId}'`)
    }
  }

  must(errs.length === 0, '全程 pageerror = 0', { errs })

  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
}).finally(async () => {
  try { await br?.close() } catch { /* noop */ }
  /* 收尾：删掉测试卷（不留测试数据） */
  if (examId) {
    try {
      const lg = await (await fetch(`${B}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: PHONE, password: PASS }),
      })).json()
      const st = (await fetch(`${B}/api/exams/${examId}`, {
        method: 'DELETE', headers: { Authorization: 'Bearer ' + lg.token },
      })).status
      console.log(`   [cleanup] 测试卷已删除：${st}`)
    } catch (e) {
      console.log(`   [cleanup] 删除测试卷失败（需人工看一眼）：${e.message}`)
    }
  }
})
