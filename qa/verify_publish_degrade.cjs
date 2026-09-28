/**
 * 发布链路的"降级可见性"守卫 —— **真故障注入**（2026-09-28 立 · 用户选 3aB）
 *
 * 为什么需要它（真实事故）：内容审核服务（ai-service）不可用时，后端会按安全策略把**发布降级为草稿**，
 *   但此前**接口照旧 200、前端照旧提示"已发布"** → 教师以为发布成功、实际是草稿、且没有任何发布留痕
 *   （2026-09-18 冷启动窗口实测踩到，见报告第十四轮）。当时的修法是"明确回告 `code=POLICY_UNAVAILABLE`"，
 *   但那条修复**一直没有被真正验证过**：谁也没把审核服务真的停掉试试。
 *
 * 本守卫用**往被测系统注入真故障**的方式把它钉住（这是"变异强形态"：不是喂假数据，而是真把依赖弄坏）：
 *   ① 造一个草稿课件 → **停掉 ai-service 容器** → 发发布请求：
 *        · 必须 200（不能 500 崩），且带 `code=POLICY_UNAVAILABLE`（**明确告知**）
 *        · 结果必须是 `draft`（**不许假装发布成功**）
 *        · 且**不得**产生 release 留痕（不许留下"已发布"的假证据）
 *        · 同时核心链路不受影响（列表接口照常 200 —— 依赖坏了不该拖垮别的）
 *   ② **恢复 ai-service** → 再发布：必须真的发布成功（active）+ 产生 release 留痕（**恢复能力**）
 *   ③ 变异模式（`MUTATE=1`）：**不停服务**跑同一段发布 → 必须直接成功
 *        → 证明①里的降级是"服务挂了"造成的**因果**，不是请求本身的问题。
 *
 * ⚠ 安全性：会**短暂停掉 ai-service（约 10~30 秒）**，因此默认**只允许在 staging 跑**；
 *   其它环境必须显式 `ALLOW_ANY_ENV=1`（防误在生产上制造故障）。所有分支都用 finally 保证**把服务拉起来**。
 *
 * 用法：`node qa/verify_publish_degrade.cjs`（约 1 分钟）
 */
const { execSync } = require('child_process')
const { must, report } = require('./lib/assert.cjs')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const SERVER = process.env.SERVER || 'root@193.112.163.147'
const CONTAINER = process.env.AI_CONTAINER || 'zhiwei-ai-staging'   // 实测容器名（不是 zhiwei-ai-service-staging）
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const MUTATE = process.env.MUTATE === '1'   // 变异：不停服务 → 发布应直接成功（证明因果）
const NAME = `__E2E发布降级_${Date.now()}`

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 }).trim()
const ssh = (c) => sh(`ssh -o ConnectTimeout=8 ${SERVER} '${c}'`)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function aiReady(timeoutMs = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/ai/courseware/tools/template.query`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ style_tag: 'china' }),
      })
      if (r.ok) return true
    } catch { /* 还没起来 */ }
    await sleep(3000)
  }
  return false
}

let lg, H, mid
;(async () => {
  if (!/school1|staging|localhost|127\.0\.0\.1/.test(BASE) && process.env.ALLOW_ANY_ENV !== '1') {
    console.log(`   [SKIP] BASE=${BASE} 不像测试环境 → 拒绝注入故障（否则等于在生产制造停服）。`)
    console.log('          如确需在其它环境跑：ALLOW_ANY_ENV=1 node qa/verify_publish_degrade.cjs')
    process.exit(2)
  }

  lg = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })).json()
  must(!!lg.token, '教师登录成功', { user: lg.user && lg.user.name })
  H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }

  // 造草稿 fixture（内容很短：本守卫验的是"降级可见性"，不是生成质量）
  const created = await (await fetch(`${BASE}/api/materials/json`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      name: NAME, type: 'courseware', format: 'ppt', status: 'draft', subject: '语文', grade: '四年级',
      content: '# 发布降级自证\n\n## 一、导入\n- 导入语\n\n## 二、讲授\n- 要点\n',
    }),
  })).json()
  mid = created.id
  must(!!mid, '建出草稿 fixture（用于发布）', { id: mid })

  const readBack = async () => (await (await fetch(`${BASE}/api/materials/${mid}`, { headers: H })).json())
  /** `append`：可选，追加正文 —— 发布留痕**只在内容真变化时**才记（后端 `existing.Content != originalContent`） */
  const publish = async (append = '') => {
    const cur = await readBack()
    const r = await fetch(`${BASE}/api/materials/${mid}`, {
      method: 'PUT', headers: H, body: JSON.stringify({ ...cur, status: 'active', content: String(cur.content || '') + append }),
    })
    return { status: r.status, body: await r.json().catch(() => ({})) }
  }
  const releases = async () => {
    // 端点以 `verify_audit_trail.cjs` 的既有写法为准（实测 `/api/versions?...`）
    const v = await (await fetch(`${BASE}/api/versions?resource_type=courseware&resource_id=${mid}`, { headers: H })).json()
    return (Array.isArray(v) ? v : (v.items || [])).filter(x => x.kind === 'release').length
  }

  try {
    if (MUTATE) {
      /* ── 变异模式：不注入故障 ── */
      const ok = await publish('\n## 三、小结\n- 小结语\n')
      must(ok.status === 200 && ok.body.status === 'active' && ok.body.code !== 'POLICY_UNAVAILABLE',
        '【变异测试】审核服务**正常**时，同一段发布请求必须直接成功（证明非变异模式里的降级是"服务挂了"造成的因果）',
        { status: ok.status, code: ok.body.code, materialStatus: ok.body.status })
    } else {
      /* ── ① 真故障注入：停掉审核服务 ── */
      const wasRunning = ssh(`docker inspect -f '{{.State.Running}}' ${CONTAINER} 2>/dev/null || echo missing`)
      must(wasRunning === 'true' || wasRunning === 'true\r', `ai-service 容器在跑（${CONTAINER}）`, { wasRunning })
      ssh(`docker stop ${CONTAINER} >/dev/null 2>&1; echo stopped`)
      await sleep(2000)
      const downProbe = await fetch(`${BASE}/api/ai/courseware/tools/template.query`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ style_tag: 'china' }),
      }).then(r => r.status).catch(() => 'error')
      must(downProbe !== 200, '故障注入生效：审核服务已不可用', { probe: downProbe })

      const deg = await publish()
      must(deg.status === 200, '审核服务不可用时：发布请求**不崩**（200，而非 500）', { status: deg.status })
      must(deg.body.code === 'POLICY_UNAVAILABLE',
        '① **明确告知**：响应带 code=POLICY_UNAVAILABLE（此前是"照旧 200 + 前端谎报已发布"）',
        { code: deg.body.code, message: deg.body.message })
      must(deg.body.status === 'draft' || (await readBack()).status === 'draft',
        '① **不许假装发布成功**：结果仍是 draft', { bodyStatus: deg.body.status, storeStatus: (await readBack()).status })
      must((await releases()) === 0, '① 不产生 release 留痕（不留"已发布"的假证据）', { releases: await releases() })

      // 依赖坏了不该拖垮核心链路
      const listStatus = (await fetch(`${BASE}/api/materials`, { headers: H })).status
      must(listStatus === 200, '① 隔离性：审核服务挂掉期间，素材列表等核心接口照常 200', { listStatus })

      /* ── ② 恢复：服务拉起来后必须能真发布 ── */
      ssh(`docker start ${CONTAINER} >/dev/null 2>&1; echo started`)
      must(await aiReady(), '② ai-service 已恢复（tools 端点 200）', {})
      // ⚠ 必须**带内容变化**：发布留痕只在"内容真变化 + 最终 active"时记（设计如此，避免改个标签就产生版本）。
      //   首版没改内容就断言"应有 release 留痕" → 失败；错在我的期望，不在实现。
      const ok = await publish('\n## 三、小结\n- 小结语\n')
      must(ok.status === 200 && ok.body.status === 'active' && ok.body.code !== 'POLICY_UNAVAILABLE',
        '② 恢复后发布**真的成功**（active，无降级提示）', { status: ok.status, code: ok.body.code, materialStatus: ok.body.status })
      const relAfter = await releases()
      must(relAfter >= 1, '② 内容变化 + 发布成功 → 产生 release 留痕（可追溯"何时发布过什么"）', { releases: relAfter })
      // 顺带把设计意图钉住：**只改标签不动内容** → 不应新增留痕（否则版本列表会被"改标签"刷屏）
      const again = await publish('')
      must(again.status === 200 && (await releases()) === relAfter,
        '② 只改状态不动内容 → **不新增** release 留痕（避免"改个标签就产生版本"）',
        { before: relAfter, after: await releases() })
    }
  } finally {
    /* 无论如何都把服务拉起来（守卫失败也不能让 staging 停着） */
    if (!MUTATE) {
      try {
        const running = ssh(`docker inspect -f '{{.State.Running}}' ${CONTAINER} 2>/dev/null || echo missing`)
        if (running.trim() !== 'true') ssh(`docker start ${CONTAINER} >/dev/null 2>&1; echo started`)
      } catch (e) { console.log('   [warn] 兜底拉起 ai-service 失败：' + e.message.slice(0, 80)) }
    }
    // 清理 fixture（连同留痕；删除接口只允许本人）
    if (mid) {
      const del = await fetch(`${BASE}/api/materials/${mid}`, { method: 'DELETE', headers: H }).then(r => r.status).catch(() => 'error')
      console.log(`   [cleanup] fixture 删除：${del}`)
    }
  }

  const back = await aiReady(30000)
  must(back, '收尾自检：ai-service 处于可用状态（守卫不留下故障）', {})
  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
})
