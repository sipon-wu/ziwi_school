/**
 * P1 受控编排 S0–S5 + SSE 中间态 + 逐次留痕（2026-09-27 立 · 覆盖方案 1-3）
 *
 * DoD（《0911》§七·五 1-3）：**真实链路跑通且可回放；中间态可见**
 * （已选风格 → 已取资产 → 生成中 → 质检结果）。
 *
 * 本守卫**不造假链路**：真的调一次 `POST /api/ai/courseware/generate`（会真跑 LLM），
 * 并**并发**订阅 `GET /api/ai/courseware/generate/stream` 收中间态，最后调
 * `GET /api/ai/courseware/trace/{job_id}` 取留痕，用"活的事件 vs 落的留痕"互相对账
 * —— 这样"可回放"才有可证伪的含义（留痕若是空壳/伪造，对账必红）。
 *
 * 覆盖断言：
 *   ① 真实链路出正文，响应带 pipeline 元信息（版本/job_id/步骤序列/是否落库）
 *   ② SSE 中间态含 S0–S5 且**顺序正确**
 *   ③ DoD 四态齐备：已选风格（styleKey）→ 已取资产（assetCount/assetIds）→ 生成中（每轮）→ 质检结果（分数）
 *   ④ 留痕落库（source=db）且含：工具调用**入参**+结果摘要、每轮生成、三关质检分数、技能 id/版本
 *   ⑤ 可回放对账：留痕步骤序列 == 活响应步骤序列；留痕轮次 == SSE 的 s3 轮次；留痕分数 == 响应 quality_report
 *
 * 用法：BASE=http://school1.ziwi.cn node qa/verify_orchestration.cjs
 *       （可选 JOB_ID=xxx 指定 job_id，便于人工按 id 去 trace 端点复查）
 */
const { must, report } = require('./lib/assert.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const JOB = process.env.JOB_ID || `qa-orch-${Date.now()}`
/** `MUTATE=1`：变异模式（A1b 判据自检）—— 只跑"喂坏输入 → 判据必须报错"，用于证明判据非恒真 */
const MUTATE = process.env.MUTATE === '1'
const STEPS = ['s0', 's1', 's2', 's3', 's4', 's5']

;(async () => {
  /**
   * 读 JSON，但**非 JSON 响应要给出可读原因**：部署刚换容器时 nginx 会返回 HTML 502/504 错误页，
   * 直接 `.json()` 会抛 `Unexpected token '<'`（实测踩到，看着像守卫 bug、其实是环境未就绪）。
   * 这种情况按 M7 记 **SKIP（未验证，退出码 2）** —— 既不是"通过"，也不冤枉被测对象为失败。
   */
  const jread = async (r, what) => {
    const txt = await r.text()
    if (!/^\s*[{[]/.test(txt)) {
      console.log(`   [SKIP] ${what} 返回非 JSON（HTTP ${r.status}）：${txt.replace(/\s+/g, ' ').slice(0, 120)}`)
      console.log('   → 环境未就绪（如冷启动/网关错误页），本套件**未验证**（skip ≠ pass）')
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
  console.log(`   [job] ${JOB}`)

  /* ai-service 预热：刚部署完容器可能还没起，等它就绪（最多 60s），避免把"部署时序"记成"链路故障" */
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${B}/api/ai/courseware/tools/template.query`, {
      method: 'POST', headers: H, body: JSON.stringify({ style_tag: 'china' }),
    }).catch(() => null)
    if (r && r.ok) { console.log(`   [warmup] ai-service 就绪（第 ${i + 1} 次探测）`); break }
    if (i === 11) {
      console.log('   [SKIP] ai-service 未就绪（tools 端点 60s 内无 200）→ 本套件**未验证**')
      process.exit(2)
    }
    await new Promise(res => setTimeout(res, 5000))
  }

  /* ── 并发：先挂 SSE 订阅，再发生成（顺序反了会漏掉最早的 s0/s1 事件）── */
  const evs = []
  let sseEnded = false
  const sseP = (async () => {
    const rd = (await fetch(`${B}/api/ai/courseware/generate/stream?job_id=${encodeURIComponent(JOB)}`, { headers: H })).body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    const deadline = Date.now() + 5 * 60 * 1000
    while (Date.now() < deadline) {
      const { value, done } = await rd.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let i
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i)
        buf = buf.slice(i + 2)
        if (/^event: done/m.test(chunk)) sseEnded = true
        const m = /^data: (.*)$/m.exec(chunk)
        if (m) { try { evs.push(JSON.parse(m[1])) } catch { /* 保活注释行等非 JSON，忽略 */ } }
      }
      if (sseEnded) break
    }
  })().catch(e => console.log('   [note] SSE 读取结束：' + e.message))

  const t0 = Date.now()
  const gen = await jread(await fetch(`${B}/api/ai/courseware/generate`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      job_id: JOB, subject: '语文', grade: '四年级', lesson_title: '__E2E编排自检',
      content: '# __E2E编排自检\n\n## 教学目标\n- 认识并理解本课核心概念。\n\n## 教学过程\n- 导入、讲授、练习。\n',
      format: 'ppt', style_tag: 'china', divergence_level: 'standard',
    }),
  }), '课件生成')
  const genMs = Date.now() - t0
  await Promise.race([sseP, new Promise(r => setTimeout(r, 20000))])   // SSE 通常随 done 立即收尾

  /* ① 真实链路 */
  must(typeof gen.courseware_markdown === 'string' && gen.courseware_markdown.length > 100,
    '真实链路跑通：返回课件正文', { chars: (gen.courseware_markdown || '').length, ms: genMs })
  must(!!gen.pipeline && !!gen.pipeline.version,
    '响应带回 pipeline 元信息（版本/job_id/步骤序列/是否落库）', { pipeline: gen.pipeline })
  const liveSteps = (gen.pipeline && gen.pipeline.steps) || []

  /* ② SSE 中间态：S0–S5 齐备且顺序正确 */
  const sStages = evs.map(e => e.stage).filter(s => STEPS.includes(s))
  const missing = STEPS.filter(s => !sStages.includes(s))
  if (evs.length === 0) {
    console.log('   [SKIP] 未收到任何 SSE 事件 → **中间态无法验证**（skip ≠ pass）')
    process.exit(2)
  }
  must(missing.length === 0, 'SSE 中间态含全部六步（S0–S5）',
    { got: [...new Set(sStages)], missing, total: evs.length })
  const firstIdx = STEPS.map(s => sStages.indexOf(s))
  must(firstIdx.every((v, i) => v >= 0 && (i === 0 || v > firstIdx[i - 1])),
    '六步事件**顺序正确**（s0 → s5 递增出现）', { firstIdx })

  /* ③ DoD 四态：已选风格 → 已取资产 → 生成中 → 质检结果 */
  const evOf = (s) => evs.find(e => e.stage === s) || {}
  const s2d = (evOf('s2').data) || {}
  must(!!s2d.styleKey, '中间态·**已选风格**：S2 事件带 styleKey（平台确定的风格，非模型自由发挥）',
    { message: evOf('s2').message, styleKey: s2d.styleKey, skeletonClass: s2d.skeletonClass })
  must(typeof s2d.assetCount === 'number' && Array.isArray(s2d.assetIds),
    '中间态·**已取资产**：S2 事件带资产数量与 id 列表', { assetCount: s2d.assetCount, ids: (s2d.assetIds || []).slice(0, 3) })
  // 这条是"实测抓出来的"：首版把输出格式当 `scene` 传下去（"ppt"），被工具当成 pageType 过滤 →
  // 恒返回 0 项，而 0 项照样"通过"了上面那条类型断言 —— 所以"已取资产"必须断言**真的取到了**。
  must(s2d.assetCount >= 1,
    '"已取资产"**真的取到了**（assetCount ≥ 1）—— 若为 0：要么装饰库为空，要么过滤参数传错（见 2026-09-27 修复）',
    { assetCount: s2d.assetCount, styleKey: s2d.styleKey })
  const s3evs = evs.filter(e => e.stage === 's3')
  must(s3evs.length >= 1 && s3evs.every(e => !!(e.data && e.data.role)),
    '中间态·**生成中**：S3 每轮带 role/model（逐轮可见，不是干等）',
    { rounds: s3evs.length, roles: s3evs.map(e => e.data && e.data.role) })
  const s4d = (evOf('s4').data) || {}
  must(s4d.gate1 && typeof s4d.gate1.errors === 'number' && typeof s4d.redline_pass === 'boolean',
    '中间态·**质检结果**：S4 事件带三关分数（规则违规数 / 红线是否通过）',
    { gate1: s4d.gate1, gate2_available: s4d.gate2_available, redline_pass: s4d.redline_pass })

  /* ④ 留痕落库 + 内容完备 */
  const tr = await jread(await fetch(`${B}/api/ai/courseware/trace/${encodeURIComponent(JOB)}`, { headers: H }), '留痕端点')
  must(!tr.error && Array.isArray(tr.steps) && tr.steps.length >= 6,
    '留痕可查（GET /api/ai/courseware/trace/{job_id}）', { source: tr.source, steps: (tr.steps || []).map(s => s.id) })
  must(tr.source === 'db', '留痕**已落库**（ai_generation_logs；非仅内存）', { source: tr.source })
  const tools = tr.tool_calls || []
  must(tools.some(t => t.name === 'template.query') && tools.some(t => t.name === 'asset.search'),
    '留痕含**工具调用**（template.query + asset.search）', { names: tools.map(t => t.name) })
  must(tools.every(t => t.params && Object.keys(t.params).length > 0),
    '留痕含工具调用的**入参**（P1 DoD 明确要求）', { params: tools.map(t => t.params) })
  must((tr.rounds || []).length >= 1 && tr.rounds.every(r => !!r.model && r.ms >= 0),
    '留痕含**逐轮生成**（role/model/耗时/字数）', { rounds: tr.rounds })
  const q = tr.quality || {}
  // 注意：`anchor_coverage` 在"未指定知识点"时**合法为 null**（本次请求就没传知识点）→ 只断言**键存在**，
  // 不硬要求非空 —— 否则就是逼实现编一个假覆盖率，正是反假绿要防的那种"为过测试而造假"。
  must(!!q.gate1 && !!q.gate2 && !!q.redline && 'anchor_coverage' in q,
    '留痕含**三关质检分数**（规则 / 内容评审 / 红线）与锚点覆盖率键',
    { gates: Object.keys(q), anchor_coverage: q.anchor_coverage })
  must(!!tr.skill_id && !!tr.skill_version && !!tr.pipeline_version,
    '留痕含**技能 id/版本**与流水线版本（声明层，非代码写死）',
    { skill_id: tr.skill_id, skill_version: tr.skill_version, pipeline_version: tr.pipeline_version })

  /* ⑤ 可回放对账：活的事件/响应 ↔ 落的留痕，必须一致 */
  const traceIds = (tr.steps || []).map(s => s.id)
  // 判据抽成可复用函数（2026-09-27，A1b）：只有能被"喂坏输入"的判据，才谈得上不是恒真。
  const sameStepSet = (a, b) => JSON.stringify([...new Set(a)]) === JSON.stringify([...new Set(b)])
  if (MUTATE) {
    // 【变异测试·判据自检】注入：把留痕里的 s5 删掉（模拟"落库早于 emit s5"那个真实缺陷）→ 对账必须报不一致。
    const tampered = traceIds.filter(id => id !== 's5')
    must(!sameStepSet(tampered, liveSteps),
      '【变异测试·判据自检】故意删掉留痕里的 s5 → 对账判据必须报"不一致"（证明下面那条断言不是恒真）',
      { tampered: [...new Set(tampered)], live: [...new Set(liveSteps)] })
  }
  must(sameStepSet(traceIds, liveSteps),
    '可回放：留痕步骤序列 == 活响应步骤序列', { trace: [...new Set(traceIds)], live: [...new Set(liveSteps)] })
  must((tr.rounds || []).length === s3evs.length,
    '可回放：留痕轮次 == SSE 实际发生的 s3 轮次', { trace: tr.rounds.length, sse: s3evs.length })
  const qr = gen.quality_report || {}
  must(q.gate1 && q.gate1.errors === qr.error_count && q.gate1.pages === qr.pages,
    '可回放：留痕质检分数 == 响应 quality_report（留痕不是空壳/伪造）',
    { trace_errors: q.gate1 && q.gate1.errors, resp_errors: qr.error_count, trace_pages: q.gate1 && q.gate1.pages, resp_pages: qr.pages })
  const tq = tools.find(t => t.name === 'template.query') || {}
  const s2trace = (tr.steps || []).find(s => s.id === 's2') || {}
  must(s2trace.data && s2trace.data.styleKey === (tq.result || {}).styleKey,
    '可回放：S2 步数据与工具结果同源（风格 key 一致）',
    { step: s2trace.data && s2trace.data.styleKey, tool: (tq.result || {}).styleKey })

  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
})
