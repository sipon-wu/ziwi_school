/**
 * 教案互审（开关 → 待审列表 → 评审决策）—— 2026-09-29 立（补「★★★ 教案互审」缺口）
 *
 * 为什么补这条：清退存量守卫时，`verify_review_pool`（教案互审池 E2E）退役，而**"互审"这块当时没有登记守卫**
 * （见 `qa/RETIRED.md` 覆盖缺口清单）。互审是**流程 + 权限**类面：谁的交的能看、谁不能看、决策落地与否，
 * 光靠代码评审看不出漏，必须用真链路守。
 *
 * 判据（全部走真实接口，读的是**真库**）：
 *   ① **开关真写库**：`PUT /api/me/school-review-config {lesson_review_enabled:true}` → `GET` 必须为 true；
 *   ② **开关注入行为**：开关开启后 `POST /lesson-plans/:id/finalize` 的教案 `review_status` **必须为 pending**
 *      （`lesson_handler.go:249-256`：`case reviewEnabled: pending`）；
 *   ③ **待审列表口径**：`GET /api/review/pending` 必须**包含同事提交的**、且**排除自己提交的**
 *      （实现是 `review_status='pending' AND teacher_id != me` —— 这条最容易被"顺手改成全部"而无人察觉）；
 *   ④ **决策真落地**：`POST /lesson-plans/:id/review-decision {decision:approve}` → 该教案从待审列表**消失**，
 *      且教案本身 `review_status='approved'`；互审详情 `GET /lesson-plans/:id/review` 可读。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时用 psql **绕过 API 直接改库**把该教案 review_status 改回 `pending`
 *   → 待审列表**必须重新出现**（证明列表与决策都读真库，不是内存态/缓存）。跑完还原 + 删测试数据 + 复位开关。
 *
 * 用法：`node qa/verify_review_flow.cjs`（约 15s，纯 API）
 *       `MUTATE=1 node qa/verify_review_flow.cjs`
 */
const { execFileSync } = require('child_process')
const { must, report } = require('./lib/assert.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const A = { phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }    // 评审人（李老师）
const C = { phone: process.env.PHONE_B || '13800000003', password: process.env.PASS_B || 'teacher123' } // 提交人（王老师）
const MUTATE = process.env.MUTATE === '1'
const STAMP = String(Date.now()).slice(-6)
const TITLE_B = `__互审B${STAMP}`   // ⚠ 标题有 ≤12 字限制（utf8 计字），务必短
const TITLE_A = `__互审A${STAMP}`

/** 直连数据库（变异模式专用）：**绕过 API 直接改库**，看列表/决策是否真读库 */
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

let planB, planA, origEnabled
;(async () => {
  const jread = async (r, what) => {
    const txt = await r.text()
    if (txt && !/^\s*[{[]/.test(txt)) {
      console.log(`   [SKIP] ${what} 返回非 JSON（HTTP ${r.status}）→ 环境未就绪，本套件**未验证**（skip ≠ pass）`)
      process.exit(2)
    }
    return txt ? JSON.parse(txt) : null
  }
  const login = async (who) => jread(await fetch(`${B}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(who),
  }), '登录')
  const lgA = await login(A), lgC = await login(C)
  must(!!lgA.token && !!lgC.token, '两个同校账号登录成功（评审人 A / 提交人 C）',
    { a: lgA.user && lgA.user.name, c: lgC.user && lgC.user.name, sameSchool: lgA.user && lgC.user && lgA.user.school_id === lgC.user.school_id })
  const HA = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lgA.token }
  const HC = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lgC.token }

  const pendingIds = async (H) => {
    const r = await jread(await fetch(`${B}/api/review/pending`, { headers: H }), '待审列表')
    return ((r && r.items) || []).map(x => x.id)
  }

  /* ── ① 开关真写库 ── */
  const cfg0 = await jread(await fetch(`${B}/api/me/school-review-config`, { headers: HA }), '读互审开关')
  origEnabled = !!(cfg0 && cfg0.lesson_review_enabled)
  console.log(`   [info] 原开关 = ${origEnabled}（收尾会复位）`)
  const cfg1 = await jread(await fetch(`${B}/api/me/school-review-config`, {
    method: 'PUT', headers: HA, body: JSON.stringify({ lesson_review_enabled: true }),
  }), '写互审开关')
  must(cfg1 && cfg1.lesson_review_enabled === true, '① 写开关返回 true', { got: cfg1 })
  const cfg2 = await jread(await fetch(`${B}/api/me/school-review-config`, { headers: HA }), '复读开关')
  must(cfg2 && cfg2.lesson_review_enabled === true, '① 复读开关仍为 true（真写库，不是假回显）', { got: cfg2 })

  /* ── 造两份教案并定稿（C 的 / A 的）── */
  const mkPlan = async (H, title) => {
    const p = await jread(await fetch(`${B}/api/lesson-plans`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ title, subject: '语文', grade: '四年级', content: `# ${title}\n\n## 教学目标\n- 互审流程自检用教案（可随时删除）。\n\n## 教学过程\n- 导入、讲授、练习。\n` }),
    }), '建教案')
    must(!!(p && p.id), `建教案成功（${title}）`, { id: p && p.id, status: p && p.status })
    const fin = await jread(await fetch(`${B}/api/lesson-plans/${p.id}/finalize`, { method: 'POST', headers: H }), '定稿')
    return { id: p.id, fin }
  }
  const b = await mkPlan(HC, TITLE_B); planB = b.id
  const a = await mkPlan(HA, TITLE_A); planA = a.id

  /* ── ② 开关注入行为：定稿后 review_status 必须 pending ── */
  const bAfter = await jread(await fetch(`${B}/api/lesson-plans/${planB}`, { headers: HC }), '提交人读自己的教案')
  must(bAfter && bAfter.status === 'active' && bAfter.review_status === 'pending',
    '② 互审开关开启时，定稿的教案 `status=active` 且 `review_status=pending`（发布即转待人工评审）',
    { status: bAfter && bAfter.status, review_status: bAfter && bAfter.review_status })

  /* ── ③ 待审列表口径：含同事的、排除自己的 ── */
  const ids = await pendingIds(HA)
  must(ids.includes(planB), '③ 待审列表**包含同事提交的**教案', { hit: ids.includes(planB), n: ids.length })
  must(!ids.includes(planA), '③ 待审列表**排除自己提交的**（实现是 `teacher_id != me` —— 顺手改成全部就没人察觉）',
    { mineInList: ids.includes(planA), n: ids.length })

  /* ── ④ 决策真落地 ── */
  const dec = await jread(await fetch(`${B}/api/lesson-plans/${planB}/review-decision`, {
    method: 'POST', headers: HA, body: JSON.stringify({ decision: 'approve', comment: '__E2E互审自检' }),
  }), '评审决策')
  must(dec && (dec.review_status === 'approved' || dec.decision === 'approve'),
    '④ 评审 approve 返回成功（review_status 变 approved）', { got: dec && (dec.review_status || dec.decision) })
  const ids2 = await pendingIds(HA)
  must(!ids2.includes(planB), '④ 决策后该教案**从待审列表消失**', { stillThere: ids2.includes(planB) })
  const bAfter2 = await jread(await fetch(`${B}/api/lesson-plans/${planB}`, { headers: HC }), '提交人复读教案')
  must(bAfter2 && bAfter2.review_status === 'approved',
    '④ 教案本身 `review_status=approved`（决策真写库，不是只把列表过滤掉）', { review_status: bAfter2 && bAfter2.review_status })
  const rv = await fetch(`${B}/api/lesson-plans/${planB}/review`, { headers: HA })
  must(rv.status === 200, '④ 互审详情可读（GET /lesson-plans/:id/review → 200）', { status: rv.status })

  /* ── 变异（强形态）：绕过 API 直接改库 → 待审列表必须重新出现 ── */
  if (MUTATE) {
    const r = psql(`UPDATE lesson_plans SET review_status='pending' WHERE id='${planB}'`)
    if (r === null) {
      console.log('   [SKIP] 强形态变异需改库（ssh/psql 不可用）→ 本项**未验证**（skip ≠ pass）')
      process.exit(2)
    }
    const ids3 = await pendingIds(HA)
    must(ids3.includes(planB),
      '【变异测试·真注入】psql **绕过 API** 把 review_status 改回 pending 后，待审列表**重新出现**该教案 —— 证明列表与决策都读真库（不是内存态/缓存）',
      { back: ids3.includes(planB), n: ids3.length })
  }

  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
}).finally(async () => {
  /* 收尾：删两份测试教案 + **复位开关**（不留测试数据、不改产品配置） */
  const H = async (who) => {
    const lg = await (await fetch(`${B}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(who),
    })).json()
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }
  }
  try {
    const HC = await H(C), HA = await H(A)
    if (planB) console.log(`   [cleanup] C 删教案：${(await fetch(`${B}/api/lesson-plans/${planB}`, { method: 'DELETE', headers: HC })).status}`)
    if (planA) console.log(`   [cleanup] A 删教案：${(await fetch(`${B}/api/lesson-plans/${planA}`, { method: 'DELETE', headers: HA })).status}`)
    if (typeof origEnabled === 'boolean') {
      const st = (await fetch(`${B}/api/me/school-review-config`, {
        method: 'PUT', headers: HA, body: JSON.stringify({ lesson_review_enabled: origEnabled }),
      })).status
      console.log(`   [cleanup] 互审开关已复位为 ${origEnabled}：${st}`)
    }
  } catch (e) {
    console.log(`   [cleanup] 失败（需人工看一眼）：${e.message}`)
  }
})
