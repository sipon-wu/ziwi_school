/**
 * M3 变异门：**统一契约** —— 每个关键守卫都必须能"注入真缺陷 → 判据被触发"
 * （2026-09-27 从"两个特例"升级；依据《0911》§5.2 M3"变异测试 + 负控用例"）
 *
 * 契约（每个 `critical: true` 的守卫都要满足）：
 *   ① 静态：源码里必须有 `MUTATE` 变异模式；
 *   ② 运行：`MUTATE=1` 下守卫**自身跑完且 exit 0**（变异模式是"自证"，不是"变红"）；
 *   ③ 证据：输出里必须出现 `【变异测试】`，说明它**知道**自己注入了什么、以及判据应当如何反应；
 *   ④ 量化（对自证型守卫）：如"可区分组合数=1"这类数字，防止"只说检测到了"却拿不出证据。
 *
 * 为什么要升成统一契约：只有两个特例时，"其余守卫会不会恒真"无从回答——
 * 2026-09-27 的全面体检（`qa/audit_all.cjs` A1b）实测覆盖率仅 **2/9**，因此逐条补上注入：
 *   · 身份类：假 user.id → 本人课件必须被判为他人（verify_material_ownership_ui）
 *   · 对象类：剥掉 `syncHd()` → 舞台必须不再启用（verify_h5_stage）
 *   · 越权类：同事 token 改本人素材 → 必须 403（verify_material_delete）
 *   · 对账类：删掉留痕里的 s5 → 对账必须报不一致（verify_orchestration）
 *   · 清单类：塞一个库里不存在的期望字段 → 漂移对账必须报出来（verify_schema_drift）
 *   · 证据类：psql 主动抹掉 release 留痕 → 必须看到证据消失（verify_audit_trail）
 *   · 往返类：剥掉带装饰提纲的 decor → 往返对账必须发现丢失（regression_20260917）
 *
 * 用法：`node qa/gate_mutation.cjs`（约 6~8 分钟：内含一次真实 LLM 生成与真浏览器）
 *       `node qa/gate_mutation.cjs --only=verify_h5_stage,verify_material_delete`（定点复验）
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { must, report } = require('./lib/assert.cjs')
const { GUARDS } = require('./run_all.cjs')

const QA = __dirname

/** 自证型守卫的**量化证据**：光说"检测到了"不算，必须给出可核对的数字 */
const EVIDENCE = [
  { guard: 'verify_style_diversity_ab', detect: /"distinguishable":0/, what: '6 个课件同主题 → 可区分对数必须为 0' },
  { guard: 'verify_style_tools', detect: /"uniq":1/, what: '9 个 style_tag 打成同一个 → 去重后必须只剩 1' },
]

const onlyArg = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1]
const targets = GUARDS.filter(g => g.critical && (!onlyArg || onlyArg.split(',').includes(g.name)))
if (onlyArg) console.log(`[--only] 只跑 ${targets.map(g => g.name).join(', ')}`)

;(async () => {
  must(targets.length > 0, `变异门覆盖全部关键守卫（共 ${targets.length} 个）`, { targets: targets.map(g => g.name) })

  for (const g of targets) {
    const file = path.join(QA, `${g.name}.cjs`)
    const src = fs.readFileSync(file, 'utf8')
    must(/MUTATE/.test(src), `[${g.name}] 源码含 MUTATE 变异模式（统一契约①）`)

    const r = spawnSync('node', [file], {
      encoding: 'utf8', timeout: 20 * 60 * 1000,
      env: { ...process.env, MUTATE: '1' },
    })
    const out = `${r.stdout || ''}${r.stderr || ''}`
    const tail = out.trim().split('\n').slice(-2).join(' / ')
    must(r.status === 0, `[${g.name}] 变异模式下守卫自身跑完且通过（exit=0，统一契约②）`, { exit: r.status, tail })
    // 前缀匹配（不是 `【变异测试】` 全等）：编排守卫打印的是 `【变异测试·判据自检】`
    // —— 首版正则写死全等，把它误判为"没有证据"（门自身的精度问题，已修）。
    must(/【变异测试/.test(out), `[${g.name}] 打印【变异测试…】证据（统一契约③：它知道自己注入了什么）`, { tail })

    const ev = EVIDENCE.find(e => e.guard === g.name)
    if (ev) {
      must(ev.detect.test(out), `[${g.name}] 量化证据（统一契约④）：${ev.what}`, { pattern: String(ev.detect) })
    }
    console.log(`   ✔ ${g.name}：注入 → 判据被触发（${(out.match(/【变异测试[^\n]{0,60}/) || [''])[0]}）`)
  }
  report()
})().catch(e => {
  console.error('✘ 变异门自身异常：' + e.message)
  process.exitCode = 2
})
