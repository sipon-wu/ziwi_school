/**
 * P3 云通道隔离守卫（2026-09-28 立 · 用户选 3cB「现在做 P3」）
 *
 * DoD（《0911》§六/§七）：**与核心链路物理隔离，不影响主流程**。四条隔离原则逐条证伪：
 *   ① **默认关闭**：未配置 → 状态为"未配置"，触发同步**不产生网络行为**（提前返回）；
 *   ② **出网单向**：`cloud_sync.py` 只有出网请求（`urllib.request.urlopen`），**没有入站服务**（无 `@app.` 路由）；
 *   ③ **不在请求路径**：静态断言 —— **生成链路函数体里没有任何 `cloud_sync` 引用**；
 *   ④ **默认干跑 + 掩码拒收**：拉到配置也只"报告打算怎么写"；带掩码的密钥一律拒绝，
 *      且**真实配置前后必须完全一致**（最要紧的一条：云通道不许把本服务配置写坏）。
 *
 * 另测两种真实故障场景（这是"往被测系统注入"而非喂假数据）：
 *   · 云端地址**不可达** → 同步必须**明确失败**，且核心链路（模型通道/工具端点）照常 200（不拖垮主流程）；
 *   · 云端地址**可达**（指向本服务自己的 config 端点）→ 真的取到 JSON、掩码被拒、干跑不落地。
 *
 * 收尾**必定**把云通道恢复为"未配置"（不把测试地址留在环境里）。
 * 用法：`node qa/verify_cloud_isolation.cjs`
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { must, report } = require('./lib/assert.cjs')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const SERVER = process.env.SERVER || 'root@193.112.163.147'
const CONTAINER = process.env.AI_CONTAINER || 'zhiwei-ai-staging'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const SELF_URL = process.env.AI_SELF_URL || 'http://127.0.0.1:8000'  // 容器内自指（可达端点）
const DEAD_URL = process.env.DEAD_URL || 'http://127.0.0.1:9'        // 必连不上的端口
const MUTATE = process.env.MUTATE === '1'

;(async () => {
  const lg = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })).json()
  must(!!lg.token, '教师登录成功（用于核对核心链路）', {})
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }

  const st = async () => (await (await fetch(`${BASE}/api/ai/llm/sync/status`, { headers: H })).json())
  const setCfg = async (body) => (await (await fetch(`${BASE}/api/ai/llm/sync/config`, {
    method: 'POST', headers: H, body: JSON.stringify(body),
  })).json())
  const runSync = async () => (await (await fetch(`${BASE}/api/ai/llm/sync`, { method: 'POST', headers: H })).json())
  const coreOk = async () => (await (await fetch(`${BASE}/api/ai/courseware/tools/template.query`, {
    method: 'POST', headers: H, body: JSON.stringify({ style_tag: 'china' }),
  })).json()).styleKey
  const realConfig = async () => JSON.stringify(await (await fetch(`${BASE}/api/ai/llm/config`, { headers: H })).json())

  try {
    /* ── ② 静态：出网单向（cloud_sync 只有出网、没有入站路由）── */
    const src = fs.readFileSync(path.join(__dirname, '..', 'code/ai-service/cloud_sync.py'), 'utf8')
    must(/urllib\.request\.urlopen/.test(src) && !/@app\.|FastAPI|uvicorn/.test(src),
      '② 出网单向：`cloud_sync.py` 只有出网请求，**不含任何入站路由/服务**', {})
    /* ── ③ 静态：不在请求路径（生成链路函数体里无 cloud_sync 引用）── */
    const api = fs.readFileSync(path.join(__dirname, '..', 'code/ai-service/api_server.py'), 'utf8')
    const lines = api.split('\n')
    const start = lines.findIndex(l => /^async def gen_courseware\(/.test(l))
    let end = lines.length
    for (let i = start + 1; i < lines.length; i++) {
      if (/^(async def |def |@app\.)/.test(lines[i])) { end = i; break }
    }
    const inGen = lines.slice(start, end).some(l => l.includes('cloud_sync'))
    must(start > 0 && !inGen,
      '③ 不在请求路径：生成链路（S0–S5）函数体内**没有** cloud_sync 引用（云通道不参与生成）',
      { genRange: `${start + 1}-${end}` })

    /* ── ① 默认关闭 ── */
    await setCfg({ url: '', enabled: false })
    const s0 = await st()
    must(s0.enabled === false && s0.configured === false && s0.isolated === true,
      '① 默认关闭：未配置时 enabled=false / configured=false / isolated=true', { status: s0 })
    must(s0.url === '' && s0.token_set === false, '① 关闭状态不残留地址；且**不回传 token 明文**', { url: s0.url })
    const r0 = await runSync()
    must(r0.ok === false && r0.configured === false && /未配置/.test(String(r0.reason)),
      '① 未配置时触发同步 → **提前返回、不产生网络行为**', { result: r0 })
    const k0 = await coreOk()
    must(k0 === 'china', '① 核心链路照常（工具端点 200 且结果正确）', { styleKey: k0 })

    /* ── 故障注入 A：云端地址不可达 ── */
    await setCfg({ url: DEAD_URL, enabled: true })
    const rDead = await runSync()
    must(rDead.ok === false && rDead.configured === true && /Error|Refused|timed out/i.test(String(rDead.reason)),
      '云端不可达 → 同步**明确失败**（不是静默成功，也不是抛异常）', { reason: String(rDead.reason).slice(0, 80) })
    const sDead = await st()
    must(sDead.fail_count >= 1, '失败被计数（状态可观测）', { fail_count: sDead.fail_count })
    const kDead = await coreOk()
    must(kDead === 'china', '**隔离性**：云通道失败不影响核心链路（工具端点照常 200）', { styleKey: kDead })

    /* ── 故障注入 B：云端可达但返回掩码配置（指向本服务自己的 config 端点）── */
    if (MUTATE) {
      // 【变异测试】判据必须能区分三种"不成功"：未配置 / 网络失败 / 成功 —— 若能区分，说明它真的在看状态而不是恒真。
      await setCfg({ url: '', enabled: false })
      const rOff = await runSync()
      must(/未配置/.test(String(rOff.reason)) && !/未配置/.test(String(rDead.reason)),
        '【变异测试】判据能区分"未配置"与"网络失败"（两次结果文案不同 → 状态真的在被观察）',
        { off: String(rOff.reason).slice(0, 40), dead: String(rDead.reason).slice(0, 60) })
    } else {
      const before = await realConfig()
      // 形状正确的"云端"配置：放在**容器内**（`file://` 同一个 urlopen 路径，可控 payload）
      // —— 为什么不用公网/网关 mock：要给"掩码拒收"这条最要紧的安全性喂**确定的输入**，
      //    依赖外部端点的返回形状＝把判据交给别人（本轮实测：自指端点返回里没有 items，导致这条没测到）。
      const mock = JSON.stringify({
        items: [
          { name: 'cloud-1', api_key: 'sk-cloud-real-ish-123456' },   // 正常密钥 → 计划落地
          { name: 'cloud-2', api_key: 'sk-****abcd' },                // 掩码密钥 → 必须被拒
        ],
      })
      execSync(`ssh -o ConnectTimeout=8 ${SERVER} 'docker exec -i ${CONTAINER} sh -c "cat > /tmp/qa_mock_cloud.json"'`,
        { input: mock, stdio: ['pipe', 'ignore', 'ignore'] })
      await setCfg({ url: 'file:///tmp/qa_mock_cloud.json', enabled: true })
      const rSelf = await runSync()
      must(rSelf.ok === true, '云端可达 → 同步成功（真的取到并解析了 JSON）', { result: rSelf })
      must(rSelf.plan && rSelf.plan.skipped_masked === 1 && rSelf.plan.would_apply.includes('cloud-1'),
        '④ 掩码密钥被拒收、正常密钥进入"打算写"清单（`sk-***` 写回去＝把真密钥毁掉）',
        { plan: rSelf.plan })
      must(rSelf.dry_run === true && rSelf.applied === false,
        '④ 默认**干跑**：只报告"打算怎么写"，不落地', { dry_run: rSelf.dry_run, applied: rSelf.applied })
      const after = await realConfig()
      must(before === after, '④ **最要紧的一条**：真实模型配置前后完全一致（云通道不许改动它）',
        { changed: before !== after })
    }

    /* ── ⑤ 接**真实 cloud 服务**（只读）+ 契约对账（2026-09-29 深化，用户选 a）──
     *  ① 真的连上 cloud.ziwi.cn（不是 mock）——证明"云通道"接的是真服务；
     *  ② 它当前没有对账契约端点 → 必须**如实报告"契约不符"**，不许伪造成功；
     *  ③ 给一份符合契约的 payload → 必须**算出真实差异**（模型不一致 / 云端下发未知角色），且不写入。 */
    const realConfigBefore = await realConfig()
    await setCfg({ url: 'https://cloud.ziwi.cn/api/v1/auth/public-key', enabled: true })
    const rReal = await runSync()
    must(rReal.ok === true, '⑤ 真的连上了 cloud 服务（cloud.ziwi.cn 从容器内可达，HTTP 200）',
      { url: rReal.url, mode: rReal.mode })
    must(rReal.contract_ok === false && /契约不符/.test(String(rReal.reason || '')),
      '⑤ 云端当前无对账契约端点 → **如实报告契约不符**（不伪造成功、不假装对上了）',
      { reason: String(rReal.reason || '').slice(0, 80) })

    const contractMock = JSON.stringify({
      data: {   // 注意：cloud.ziwi.cn 统一把响应包在 data 里（实测）
        channels: [
          { role: 'gen', model: '__cloud-model-X' },   // 与本地不一致 → 应报 drift
          { role: 'ghost-role', model: 'whatever' },   // 未知角色 → 应报 drift
        ],
      },
    })
    execSync(`ssh -o ConnectTimeout=8 ${SERVER} 'docker exec -i ${CONTAINER} sh -c "cat > /tmp/qa_mock_contract.json"'`,
      { input: contractMock, stdio: ['pipe', 'ignore', 'ignore'] })
    await setCfg({ url: 'file:///tmp/qa_mock_contract.json', enabled: true })
    const rRec = await runSync()
    must(rRec.mode === 'reconcile' && rRec.contract_ok === true,
      '⑤ 契约符合 → 进入**对账模式**（不是直接套用）', { mode: rRec.mode, contract: rRec.contract })
    const drift = rRec.drift || []
    must(drift.some(d => d.field === 'model') && drift.some(d => /未知角色/.test(String(d.why))),
      '⑤ 对账算出真实差异（模型不一致 + 云端下发未知角色），逐条给出 云端值/本地值',
      { drift: drift.slice(0, 4) })
    must(rRec.dry_run === true && rRec.applied === false, '⑤ 对账是**干跑**（不写入）', { dry_run: rRec.dry_run })
    must((await realConfig()) === realConfigBefore, '⑤ 对账全程本地配置零改动（最要紧的一条）', {})
  } finally {
    // 收尾：无论如何把云通道恢复为"未配置"（不把测试地址留在环境里）
    const closed = await setCfg({ url: '', enabled: false }).catch(() => null)
    console.log(`   [cleanup] 云通道已复位为未配置：${closed && closed.configured === false ? 'OK' : '需人工检查'}`)
  }

  const sEnd = await st()
  must(sEnd.configured === false, '收尾自检：云通道处于关闭状态（守卫不留下配置）', { status: sEnd })
  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
})
