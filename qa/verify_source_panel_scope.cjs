/**
 * 「来源（生成配方）」面板的**可见范围**：教师视角缺省隐藏 / 诊断开关才显示 —— 2026-09-29 立
 *
 * 覆盖退役文件（见 `qa/RETIRED.md`）：`verify_source_panel_hidden`（"来源面板缺省隐藏、?debug=1 才显示"）。
 * 它守的是**内部语汇不得出现在教师视角**：知识面来源 `teacher|kg`、前置来源 `qian_zhi|parent_id`、
 * 发散边界 `orbit/edge/beyond_band`、生成模型 `qwen-plus` —— 教师原话"这是啥，应该隐藏的吧"。
 * 规则本体在 `code/frontend/src/lib/debugFlag.ts`（`?debug=1` 或 localStorage `zhiwei_debug=1`，两者取或），
 * 面板在 `components/CwLeftPanel.tsx`（PPT 与 H5 **两处都有**，故本守卫两通道都验）。
 *
 * 判据（真浏览器 + 真库数据；**两通道各跑一遍**）：
 *   ① **前置**：psql **真把生成配方写进库里**（`gen_params` 含 `scope_resolved`），并经 HTTP 回读确认数据真在
 *      —— 这一步最要紧：否则"缺省看不到"可能只是"库里本来就没数据"，断言会**空转**；
 *   ② 教师视角（无 debug）打开编辑页：正文**不得**出现 前置来源/发散边界/生成模型；
 *   ③ `?debug=1`：**必须全部出现**（诊断可达 —— 否则"隐藏"变成了"功能没了"）；
 *   ④ localStorage `zhiwei_debug=1`（不带 query）：也必须全部出现（第二个开关同样生效）；
 *   ⑤ 清掉 localStorage 后回到隐藏（开关是**每次真读**的，不是一次性的）；
 *   ⑥ 查看态（无 `/edit`）也不得出现；
 *   ⑦ 全程 pageerror = 0；⑧ 跑完删自建件（不留副作用）。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时，② 就是**真注入**（真写库塞进配方数据 → 教师视角仍不得显示），
 *   并把"库里确有配方"作为前置证据打印 —— 若有人把开关改成恒真、或把面板移出 `isDebugView()`，② 必红。
 *   ⚠ 如实标注：③④ 是**集成冒烟**（改组件源码需重新构建部署才生效），证明力弱于 ②。
 *
 * 用法：`node qa/verify_source_panel_scope.cjs`（约 70s：2 通道 × 4 次加载）
 *       `MUTATE=1 node qa/verify_source_panel_scope.cjs`
 */
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')
const { session, h5Content, pptContent } = require('./lib/cwFixture.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const MUTATE = process.env.MUTATE === '1'
const STAMP = Date.now()
const KEYS = ['前置来源', '发散边界', '生成模型']
/** 注入的生成配方（字段名照 `CwLeftPanel.tsx` 实际读取的路径，确保"若开关失效就一定会显示"） */
const RECIPE = {
  scope_resolved: {
    source: 'kg',
    prereq_source: 'qian_zhi',
    knowledge_points: ['光的折射', '折射定律'],
    model: 'qwen-plus',
    unit: '第四单元',
    divergence: { level: 'B', orbit: 2, edge: 1, beyond_band: false },
  },
  textbook_version_name: '统编版 四年级下册',
}
const FORMATS = [
  { fmt: 'ppt', label: 'PPT', content: () => pptContent() },
  { fmt: 'h5', label: 'H5', content: () => h5Content() },
]

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
const b64set = (text) => `convert_from(decode('${Buffer.from(text, 'utf8').toString('base64')}','base64'),'UTF8')`
const del = async (H, mid) => (await fetch(`${B}/api/materials/${mid}`, { method: 'DELETE', headers: H })).status

let br
const ids = []
;(async () => {
  const { H, get } = await session()
  const lg = await (await fetch(`${B}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
  })).json()
  must(!!lg.token, '教师登录成功', {})
  br = await chromium.launch()
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto(`${B}/login`, { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])

  /** 打开某 URL，返回正文里命中的诊断字段 */
  const hits = async (url, clearDebug = false) => {
    await p.goto(url, { waitUntil: 'domcontentloaded' })
    if (clearDebug) await p.evaluate(() => { try { localStorage.removeItem('zhiwei_debug') } catch { /* noop */ } })
    await p.waitForTimeout(6000)
    const txt = await p.evaluate(() => document.body.innerText || '')
    return KEYS.filter(k => txt.includes(k))
  }

  const skips = []
  for (const { fmt, label, content } of FORMATS) {
    const name = `__E2E_来源面板_${fmt.toUpperCase()}_${STAMP}`
    const cr = await (await fetch(`${B}/api/materials/json`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ name, type: 'courseware', format: fmt, content: content(), status: 'draft', subject: '语文', grade: '四年级' }),
    })).json()
    const id = cr && cr.id
    ids.push(id)
    must(!!id, `[${label}] 造一份课件（草稿态 · 本人）`, { id })
    if (!id) continue

    /* ── ① 真把生成配方写进库，并经 HTTP 回读确认（否则后面"看不到"会空转）── */
    const w = psql(`UPDATE materials SET gen_params = ${b64set(JSON.stringify(RECIPE))} WHERE id='${id}'`)
    if (w === null) {
      skips.push(`[${label}] 写配方（改库不可用）`)
      continue
    }
    const back = String((await get(`/api/materials/${id}`)).gen_params || '')
    must(back.includes('qian_zhi') && back.includes('qwen-plus'),
      `① [${label}] **前置：库里确有生成配方**（psql 真写入 + 接口回读含 qian_zhi/qwen-plus）—— 缺省看不到才不是"因为没数据"`,
      { got: back.slice(0, 90) })

    /* ── ② 教师视角（无 debug）→ 三个诊断字段都不得出现 ── */
    const normal = await hits(`${B}/courseware/${fmt}/${id}/edit`, true)
    must(normal.length === 0,
      `② [${label}] **教师视角（无 debug）看不到任何诊断字段**（${KEYS.join('/')}）`,
      { hits: normal })

    /* ── ③ ?debug=1 → 必须全部出现（诊断可达）── */
    const dbg = await hits(`${B}/courseware/${fmt}/${id}/edit?debug=1`)
    must(dbg.length === KEYS.length,
      `③ [${label}] \`?debug=1\` 时**三个诊断字段全部可见**（隐藏 ≠ 功能没了；QA 复现缺陷要用）`,
      { hits: dbg, want: KEYS })

    /* ── ④ localStorage 开关（不带 query）→ 同样可见 ── */
    await p.evaluate(() => { try { localStorage.setItem('zhiwei_debug', '1') } catch { /* noop */ } })
    const local = await hits(`${B}/courseware/${fmt}/${id}/edit`)
    must(local.length === KEYS.length,
      `④ [${label}] localStorage \`zhiwei_debug=1\`（不带 query）时同样全部可见（第二个开关也生效）`,
      { hits: local, want: KEYS })

    /* ── ⑤ 清掉开关 → 回到隐藏（开关是每次真读的）── */
    const off = await hits(`${B}/courseware/${fmt}/${id}/edit`, true)
    must(off.length === 0,
      `⑤ [${label}] 清掉开关后**立刻回到隐藏**（说明是每次真读开关，不是"进来一次就常开"）`,
      { hits: off })

    /* ── ⑥ 查看态也不得出现 ── */
    const view = await hits(`${B}/courseware/${fmt}/${id}`, true)
    must(view.length === 0, `⑥ [${label}] 查看态（无 /edit）也不得出现诊断字段`, { hits: view })

    if (MUTATE) {
      must(normal.length === 0 && dbg.length === KEYS.length,
        `【变异测试·真注入】[${label}] 真把生成配方写进库里（① 回读确认数据在）后：`
        + '教师视角**仍是零命中**、带 `?debug=1` 才全命中 —— 证明"缺省隐藏"读的是真开关，而不是"库里没有可显示的数据"',
        { 教师视角: normal, debug: dbg })
    }
  }

  must(errs.length === 0, '⑦ 全程 pageerror = 0', { errs })

  const left = []
  for (const mid of ids) if (mid && (await del(H, mid)) !== 200) left.push(mid)
  must(left.length === 0, `⑧ **本守卫不留副作用**：${ids.length} 个自建件已删除`, { left })

  report()
  if (skips.length) {
    console.log('   [SKIP] 以下判据**未验证**（skip ≠ pass）：' + skips.join('；'))
    process.exitCode = 2
  }
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
}).finally(async () => {
  try { await br?.close() } catch { /* noop */ }
  try {
    const lg = await (await fetch(`${B}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
    })).json()
    for (const mid of ids) if (mid) await del({ Authorization: 'Bearer ' + lg.token }, mid).catch(() => { })
  } catch { /* noop */ }
})
