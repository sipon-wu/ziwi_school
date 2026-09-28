/**
 * 全量守卫 runner + 方案覆盖矩阵（2026-09-27 立 · 1-4）
 *
 * 依据《0911》§5.2：
 *   · **M7**：报告强制**三态** `passed / failed / skipped`，**skipped ≠ passed**；
 *     关键路径设"必须执行清单"，**缺一即红**。
 *   · **M5**：方案条目带 ID，脚本生成"**方案覆盖矩阵**"，未覆盖条目在 CI 里红。
 *
 * 用法：
 *   node qa/run_all.cjs            # 全量（含浏览器/网络守卫，数分钟）
 *   node qa/run_all.cjs --list     # 只打印覆盖矩阵（不执行）
 *
 * 退出码：0 全绿且关键路径无跳过；1 有失败；2 有关键跳过 / 矩阵不完整。
 *
 * ⚠ 本文件同时被 `qa/gate_assert_hygiene.cjs` `require`（取**关键守卫清单**）——
 *    因此**清单在主流程之外**，且执行只在 `require.main === module` 时发生。
 */
const fs = require('fs')
const path = require('path')

/**
 * 守卫清单 = **方案覆盖矩阵**（M5 的机器可读形态）。
 * `covers` 对应《0911》§七·五 的执行项 ID 与横向领域；`critical` = 关键路径（skip 即判未验证）。
 * ⚠ 新增守卫应在此登记并纳入 `covers`；未登记的旧守卫会作为**存量计数**打印（不判红）。
 */
const GUARDS = [
  { name: 'regression_20260917', critical: true, covers: ['主回归·课件保存/发布'] },
  { name: 'verify_schema_drift', critical: true, covers: ['0-1', '0-2'] },
  { name: 'verify_style_diversity_ab', critical: true, covers: ['1-1'] },
  { name: 'verify_style_tools', critical: true, covers: ['1-2'] },
  { name: 'verify_orchestration', critical: true, covers: ['1-3'] },
  { name: 'verify_audit_trail', critical: true, covers: ['审计链'] },
  { name: 'verify_material_delete', critical: true, covers: ['素材写权限'] },
  { name: 'verify_material_ownership_ui', critical: true, covers: ['素材写权限·UI'] },
  { name: 'verify_kg_units_backend', critical: false, covers: ['知识点来源'] },
  { name: 'verify_canvas_bounds', critical: false, covers: ['课件编辑器·画布'] },
  { name: 'verify_pptx_decor_export', critical: false, covers: ['课件导出'] },
  { name: 'verify_preview_pure', critical: false, covers: ['预览纯净态'] },
  { name: 'verify_cover_elements', critical: false, covers: ['封面'] },
  { name: 'verify_materials_preview_decor', critical: false, covers: ['素材预览装饰'] },
  { name: 'verify_h5_stage', critical: true, covers: ['H5 舞台（HD 等比档 / 手机档）'] },
  // 2026-09-28：PPT 版式段从"浏览器选择器（已过期 → SKIP）"重写为**确定性判据**后升为关键守卫
  // （往返不丢版式 / 结构化版式几何两两不同 / 单列几何随风格 / 不得自创版式），并带变异自检。
  { name: 'verify_style_diversity', critical: true, covers: ['PPT 版式多样性（确定性判据）'] },
]
/** 方案里**已宣布完成**的条目 → 必须至少有一个守卫覆盖（M5：未覆盖即红） */
const DONE_ITEMS = ['0-1', '0-2', '1-1', '1-2', '1-3']

const QA = __dirname
// 守卫文件 = verify_*.cjs + regression_*.cjs（regression_ 不是 verify_ 前缀，
// 第一版只按 verify_ 枚举 → 把 regression_20260917 误判成"幽灵登记"）
const guardFiles = () => fs.readdirSync(QA)
  .filter(f => /^(verify_.*|regression_.*)\.cjs$/.test(f))
  .map(f => f.replace(/\.cjs$/, ''))

function auditMatrix() {
  const files = guardFiles()
  const listed = new Set(GUARDS.map(g => g.name))
  const ghosts = GUARDS.filter(g => !fs.existsSync(path.join(QA, `${g.name}.cjs`))).map(g => g.name)
  const legacy = files.filter(f => !listed.has(f))
  const uncovered = DONE_ITEMS.filter(it => !GUARDS.some(g => g.covers.includes(it)))
  return { files, ghosts, legacy, uncovered }
}

if (require.main === module) {
  const { ghosts, legacy, uncovered } = auditMatrix()

  if (process.argv.includes('--list')) {
    console.log('方案覆盖矩阵（方案条目 → 守卫）:')
    for (const it of DONE_ITEMS) {
      const gs = GUARDS.filter(g => g.covers.includes(it)).map(g => g.name)
      console.log(`  ${it} → ${gs.join(', ') || '✘ 无覆盖'}`)
    }
    console.log(`幽灵登记（清单有、文件不存在）: ${ghosts.join(', ') || '无'}`)
    console.log(`存量守卫（文件在、清单未登记，登记不判红）: ${legacy.length} 个`)
    process.exit((ghosts.length || uncovered.length) ? 2 : 0)
  }

  const tri = { passed: [], failed: [], skipped: [] }
  // `--only=a,b`：只跑指定守卫（定点复验用；**覆盖矩阵仍按全量清单核对**，不会被 --only 糊弄过去）
  const onlyArg = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1]
  const guards = onlyArg ? GUARDS.filter(g => onlyArg.split(',').includes(g.name)) : GUARDS
  if (onlyArg) console.log(`[--only] 只跑 ${guards.map(g => g.name).join(', ')}（共 ${guards.length} 个）`)
  for (const g of guards) {
    process.stdout.write(`${g.name.padEnd(34)} `)
    const r = require('child_process').spawnSync('node', [path.join(QA, `${g.name}.cjs`)], { encoding: 'utf8', timeout: 20 * 60 * 1000 })
    const out = `${r.stdout || ''}${r.stderr || ''}`
    const asserts = (out.match(/断言\s*(\d+)\s*条/) || [])[1]
    const skipped = /SKIP（未验证）|\[SKIP\]/.test(out) || r.status === 2
    // ⚠ 退出码 2 = **未验证（skip）**，不是失败（2026-09-27 修：首版只在"退出码 0 且输出含 SKIP"时算 skip，
    // 于是"零断言 → exit 2"的守卫被误报为 failed）。三态口径：0=passed / 2=skipped / 其他=failed。
    const state = r.status === 2 ? 'skip' : (r.status === 0 ? (skipped ? 'skip' : 'pass') : 'fail')
    console.log(`${state.toUpperCase().padEnd(5)} ${asserts ? `断言 ${asserts} 条` : ''} ${r.status !== 0 ? `(exit=${r.status})` : ''}`)
    if (state === 'pass') tri.passed.push({ ...g, asserts })
    else if (state === 'skip') tri.skipped.push({ ...g, asserts })
    else tri.failed.push({ ...g, asserts, tail: out.trim().split('\n').slice(-4).join(' / ') })
  }

  const critSkip = tri.skipped.filter(g => g.critical)
  // 落一份"上次全量结果"：体检器（qa/audit_all.cjs A6）与人工复盘都读它；**不参与门禁判定**
  try {
    if (onlyArg) throw new Error('--only 定点跑不落"上次全量结果"（避免体检器读到不完整样本）')
    fs.writeFileSync(path.join(QA, '.qa_last_run.json'), JSON.stringify({
      at: new Date().toISOString(),
      passed: tri.passed.map(g => g.name), failed: tri.failed.map(g => g.name),
      skipped: tri.skipped.map(g => g.name),
      asserts: tri.passed.reduce((s, g) => s + Number(g.asserts || 0), 0),
    }, null, 1) + '\n')
  } catch (e) { console.log('  [note] 上次结果未落盘：' + e.message) }
  console.log('\n==== 三态汇总（M7：skipped ≠ passed）====')
  console.log(`  passed=${tri.passed.length}  failed=${tri.failed.length}  skipped=${tri.skipped.length}  | 断言合计=${tri.passed.reduce((s, g) => s + Number(g.asserts || 0), 0)}`)
  if (tri.failed.length) console.log('  failed:', tri.failed.map(g => `${g.name}${g.critical ? '(关键)' : ''}`).join(', '))
  if (tri.skipped.length) console.log('  skipped:', tri.skipped.map(g => `${g.name}${g.critical ? '(关键)' : ''}`).join(', '))
  if (ghosts.length) console.log('  幽灵登记（清单有、文件不存在）:', ghosts.join(', '))
  if (legacy.length) console.log(`  存量守卫未登记（不判红，登记计数）: ${legacy.length} 个`)
  if (uncovered.length) console.log('  方案条目无守卫覆盖:', uncovered.join(', '))

  /* 判定（缺一即红） */
  let code = 0
  if (tri.failed.length) { console.log('\n✘ 有守卫失败'); code = 1 }
  if (critSkip.length) { console.log('\n✘ 关键路径守卫被跳过 → 按 M7「skip = fail」判**未验证**'); code = 2 }
  if (ghosts.length || uncovered.length) { console.log('\n✘ 覆盖矩阵不完整（幽灵登记 / 方案条目未覆盖）'); code = code || 2 }
  if (!code) console.log('\n✔ 全绿：无失败、关键路径无跳过、覆盖矩阵完整')
  process.exit(code)
}

module.exports = { GUARDS, DONE_ITEMS }
