/**
 * 换风格流程（意图识别 / 多轮确认 / 「重档」重排与**预演** / 可回退）—— 2026-09-29 立
 *
 * 为什么补这条：清退存量守卫时，`verify_switch_style` / `verify_switch_flow` / `verify_reflow` 退役，
 * 而**"换风格"这块当时没有登记守卫**（见 `qa/RETIRED.md` 缺口清单；它是用户 2026-09-14 点名的 A 验收项）。
 * 换风格是**纯前端**能力（后端无对应路由）：小微指令 → 选档（轻/重）→ 二次确认（重档要报**预演出来的真实影响**）
 * → 执行 → 可回退。它承诺了三件很容易"说着有、其实没有"的事，本守卫就守这三件：
 *
 *   ① **不抢生成意图**：只说风格（"做个国风的课件"）必须**不**命中换风格（那是生成意图）；
 *      命中必须有"切换动词 + 风格词"。
 *   ② **预演 = 真实影响**：`reflowToSkeleton` 报出的 `pages/elements` 必须等于**从结果反推**的
 *      "真的变了几页 / 几个元素" —— 否则二次确认里那句"影响 N 页 / M 个元素"就是编的。
 *      同时守：重档**只改几何**（文字/字号/颜色逐字段不变）、无元素页不计入影响。
 *   ③ **可回退是真承诺**：`revertTemplate` 必须把元素几何**也**回退（2026-09-15 修过的真缺陷：
 *      只回退 layout 不回退 elements → 教师点"撤销套用"后位置仍停在被重排的样子）。
 *   另有文案口径：light 档必须写明"位置不动"、heavy 档必须写明"会被重排"；**快照失败要如实降级承诺**
 *      （不许说"保存或刷新后依然可用"）；未处理时必须如实回报，不得假装"已换成"。
 *
 * 判据全部为**确定性纯函数**（打包后 node 直跑，无浏览器、无网络）：
 *   `src/lib/styleIntent.ts`（意图/流程/文案） + `src/lib/cwTemplate.ts`（重排/回退）。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时**真改被测源码**（临时副本）注入两个真缺陷 ——
 *   把影响范围 `pages/elements` 写死为 0（假报影响）+ 剥掉 `revertTemplate` 的 elements 回退 →
 *   ②③ 的判据**必须变红**。跑完删除临时件，被测源码本体一行不动。
 *
 * 用法：`node qa/verify_style_intent.cjs`（约 20s：两次 esbuild 打包）
 *       `MUTATE=1 node qa/verify_style_intent.cjs`
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { must, report } = require('./lib/assert.cjs')

const FE = path.join(__dirname, '..', 'code', 'frontend')
const B_INTENT = '/tmp/qaStyleIntent.cjs'
const B_TPL = '/tmp/qaCwTemplate.cjs'
const B_MUT = '/tmp/qaMutCwTemplate.cjs'
const MUTATE = process.env.MUTATE === '1'

const bundle = (entry, out) => execFileSync('npx',
  ['esbuild', entry, '--bundle', '--format=cjs', '--platform=node',
    '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
    '--define:import.meta.env={}', `--outfile=${out}`, '--log-level=error'],
  { cwd: FE, stdio: 'inherit' })

/** 夹具：3 页（第 3 页无元素）+ 若干元素（部分带 slotKey，部分不带 → 走"循环分配"启发式） */
const EL = (o) => ({ type: 'text', w: 120, h: 40, fontSize: 18, color: '333333', ...o })
const FIXTURE = [
  { title: '第一页', bullets: [], layout: 'edu-explain', elements: [
    EL({ id: 'e1', x: 40, y: 60, text: '标题甲', fontSize: 24, slotKey: 'title' }),
    EL({ id: 'e2', x: 40, y: 140, text: '要点一', slotKey: 'body' }),
  ] },
  { title: '第二页', bullets: [], layout: 'title-body', elements: [EL({ id: 'e3', x: 10, y: 10, text: '正文乙' })] },
  { title: '第三页', bullets: [], layout: 'title-only' },
]
const clone = (x) => JSON.parse(JSON.stringify(x))
const geom = (e) => `${e.x},${e.y},${e.w},${e.h}`
const NON_GEOM = ['id', 'type', 'text', 'fontSize', 'color', 'bold', 'italic', 'underline', 'align', 'fontFamily', 'lineHeight', 'rotation', 'locked']

;(async () => {
  bundle('src/lib/styleIntent.ts', B_INTENT)
  bundle('src/lib/cwTemplate.ts', B_TPL)
  // node 下没有浏览器全局：被打包的模块在**加载期**会碰 localStorage / window（如读偏好）→ 补最小垫片
  globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { }, clear() { } }
  globalThis.window = globalThis.window || {}
  const SI = require(B_INTENT)
  const TPL = require(B_TPL)
  must(typeof SI.detectTemplateIntent === 'function' && typeof TPL.reflowToSkeleton === 'function',
    '打包成功：styleIntent（意图/流程/文案）+ cwTemplate（重排/回退）', { intent: Object.keys(SI).length, tpl: !!TPL.reflowToSkeleton })

  /* ── ① 用途识别：不抢生成意图 ── */
  must(SI.detectTemplateIntent('帮我做一个国风的课件').hit === false,
    '① **不抢生成意图**：只说风格（"做个国风的课件"）不算换风格（那是生成意图）',
    { got: SI.detectTemplateIntent('帮我做一个国风的课件') })
  const hit = SI.detectTemplateIntent('换成国风风格')
  must(hit.hit === true && hit.styleTag === 'china' && !!hit.label,
    '① 有"切换动词 + 风格词"才命中，且带回风格标签', { got: hit })
  must(SI.detectTemplateIntent('换回上一个风格').revert === true,
    '① "换回上一个风格"识别为 revert（低风险动作，不做多轮确认）', {})
  const list = SI.detectTemplateIntent('换个风格')
  must(list.hit === true && !list.styleTag,
    '① 只说"换个风格"（没指定哪种）→ 命中但无 styleTag，由调用方回可选清单（不瞎猜一种）', { got: list })

  /* ── ② 多轮流程状态机 ── */
  const st = { styleTag: 'china', label: '国风', stage: 'choose' }
  must(SI.styleFlowStep(null, '1') === null, '② 无流程在跑 → 交回正常处理（null）', {})
  must(SI.styleFlowStep(st, '1').level === 'light' && SI.styleFlowStep(st, '2').level === 'heavy',
    '② 选档：1=轻 / 2=重', {})
  must(SI.styleFlowStep(st, '取消').kind === 'cancelled', '② 选档阶段可取消', {})
  const cf = { styleTag: 'china', label: '国风', level: 'light', stage: 'confirm' }
  must(SI.styleFlowStep(cf, '确认').kind === 'execute', '② 确认 → 执行', {})
  must(SI.styleFlowStep(cf, '取消').kind === 'cancelled', '② 确认阶段可取消', {})
  must(SI.styleFlowStep(cf, '2').kind === 'confirmAsk',
    '② 确认阶段改主意换档 → 回到二次确认（重新预演影响）', {})
  /* ⚠ 这里**只登记不判红**（2026-09-29 实测发现"注释承诺 vs 实现"不一致，属**待你定的产品项**）：
   *   函数注释明写「先判确认/取消/改档，再判新指令，否则"确认换成国风"会被当成新指令而重开流程」，
   *   但 `CONFIRM_RE = /^\s*(确认|确定|…)\s*[。.!！]?\s*$/` 是**整串锚定**的 → "确认换成国风"既不匹配确认、
   *   也不匹配取消/改档 → 返回 null；调用方会拿它去走正常处理 → detectTemplateIntent 命中（含"换"+风格词）
   *   → **重开流程（再问一次选档）**，正是注释想避免的那件事。
   *   两种改法（都不影响"预演/回退"这两条安全承诺）：① 放宽 CONFIRM_RE（允许"确认…"开头）或 ② 修正注释。
   *   在定下来之前，本守卫**不判红**，但把实测结果打印出来（见 qa/RETIRED.md「新守卫抓到的真缺陷」）。 */
  const mixed = SI.styleFlowStep(cf, '确认换成国风')
  console.log(`   [note] 待定项：确认阶段回"确认换成国风" → 实测 ${JSON.stringify(mixed)}（注释承诺 execute；见 RETIRED.md）`)
  must(SI.styleFlowStep(cf, '帮我查一下天气') === null,
    '② 与流程无关的话 → 交回正常处理（不吞掉用户真实问题）', {})

  /* ── ③ 文案口径（两处面板同一份话术）── */
  const heavy = SI.styleConfirmText('国风', 'heavy', { handled: true, impact: { pages: 7, elements: 33 } })
  must(heavy.includes('7 页') && heavy.includes('33 个元素'),
    '③ heavy 档二次确认里报的**就是预演出来的真实影响**（7 页 / 33 个元素）', {})
  const heavy2 = SI.styleConfirmText('国风', 'heavy', { handled: true, impact: { pages: 2, elements: 5 } })
  must(heavy2.includes('2 页') && heavy2.includes('5 个元素') && !heavy2.includes('7 页'),
    '③ 影响数字**随入参变化**（防"文案写死"）', {})
  const light = SI.styleConfirmText('国风', 'light', { handled: true })
  must(/不会变：文字、字号、每个元素的位置与尺寸/.test(light) && !/会被重排/.test(light),
    '③ light 档必须写明"位置不动"，且不得出现"会被重排"', {})
  must(/风险/.test(heavy), '③ heavy 档必须写明风险（手工挪过的位置也会被重排）', {})
  must(SI.styleDoneText('国风', 'light', { handled: false, error: '编辑器未就绪' }).includes('没能换风格'),
    '③ 未处理时如实回报（带错误原因），**不得**假装"已换成"',
    { got: SI.styleDoneText('国风', 'light', { handled: false, error: '编辑器未就绪' }).slice(0, 40) })
  must(!SI.styleDoneText('国风', 'light', { handled: false }).includes('已把当前课件换成'),
    '③ 未处理（无 error）时提示"要在课件编辑器里做"，不得报告成功', {})
  const noSnap = SI.styleDoneText('国风', 'light', { handled: true, snapshot: false })
  must(noSnap.includes('只在本次编辑会话内有效') && !noSnap.includes('保存或刷新后依然可用'),
    '③ **快照失败要如实降级承诺**：不许再说"保存或刷新后依然可用"', { got: noSnap.slice(-60) })

  /* ── ④ 预演 = 真实影响（重档实质动作）── */
  const before = clone(FIXTURE)
  const r = TPL.reflowToSkeleton(clone(FIXTURE), 'china')
  let realPages = 0, realEls = 0
  r.outline.forEach((s, i) => {
    const p = before[i].elements || [], n = s.elements || []
    const moved = n.filter((e, j) => p[j] && geom(e) !== geom(p[j])).length
    if (moved > 0) realPages++
    realEls += moved
  })
  must(realPages > 0 && realEls > 0,
    '④ 夹具前提：重档**确实**重排了元素（否则下面的"预演=真实"无从谈起）', { realPages, realEls })
  must(r.pages === realPages && r.elements === realEls,
    '④ **预演 = 真实影响**：报出的 pages/elements 必须等于从结果反推的"真的变了几页/几个元素"',
    { reported: { pages: r.pages, elements: r.elements }, real: { pages: realPages, elements: realEls } })
  must(!r.outline[2].elements, '④ 无元素的页不计入影响，也不被凭空造出元素', { third: r.outline[2].elements })
  const nonGeomBad = []
  r.outline.forEach((s, i) => (s.elements || []).forEach((e, j) => {
    const p = (before[i].elements || [])[j]; if (!p) return
    for (const f of NON_GEOM) {
      if (JSON.stringify(e[f]) !== JSON.stringify(p[f])) nonGeomBad.push(`第${i + 1}页 ${e.id}.${f}: ${JSON.stringify(p[f])}→${JSON.stringify(e[f])}`)
    }
  }))
  must(nonGeomBad.length === 0,
    '④ 重档**只改几何**：文字 / 字号 / 颜色等非几何字段逐字段不变', { bad: nonGeomBad.slice(0, 4) })

  /* ── ⑤ 可回退是真承诺 ── */
  const prevLayouts = before.map(s => s.layout)
  const prevElements = before.map(s => s.elements)
  const back = TPL.revertTemplate(r.outline, 'zgf-ink-wash', prevLayouts, prevElements)
  must(back.themeId === 'zgf-ink-wash', '⑤ 回退恢复 themeId', { got: back.themeId })
  const notBack = []
  back.outline.forEach((s, i) => (s.elements || []).forEach((e, j) => {
    const p = (before[i].elements || [])[j]
    if (p && geom(e) !== geom(p)) notBack.push(`${e.id}: ${geom(e)} ≠ ${geom(p)}`)
  }))
  must(notBack.length === 0,
    '⑤ **可回退**：撤销套用后元素几何回到原样（守 2026-09-15 修过的"只回退 layout 不回退 elements"真缺陷）',
    { notBack: notBack.slice(0, 4) })

  /* ── 变异（强形态）：真改被测源码注入两个真缺陷 → ④⑤ 必须能抓到 ── */
  if (MUTATE) {
    const srcPath = path.join(FE, 'src/lib/cwTemplate.ts')
    const mutPath = path.join(FE, 'src/lib/__qa_mut_cwTemplate.ts')
    const orig = fs.readFileSync(srcPath, 'utf8')
    const patched = orig
      .replace('return { outline: out, pages, elements: count }', 'return { outline: out, pages: 0, elements: 0 }')
      .replace('    ...(prevElements && prevElements[i] ? { elements: prevElements[i] } : {}),\n', '')
    try {
      must(patched !== orig && !/pages, elements: count/.test(patched) && !/prevElements\[i\]/.test(patched),
        '【变异测试·前置】两处注入点都匹配成功（否则说明实现变了，需更新注入点 —— 不是"变异通过"）', {})
      fs.writeFileSync(mutPath, patched)
      bundle('src/lib/__qa_mut_cwTemplate.ts', B_MUT)
      const M = require(B_MUT)
      const rm = M.reflowToSkeleton(clone(FIXTURE), 'china')
      const movedInMut = rm.outline.some((s, i) => (s.elements || []).some((e, j) => {
        const p = (before[i].elements || [])[j]; return p && geom(e) !== geom(p)
      }))
      must(movedInMut, '【变异测试·前置】注入版**仍然重排了几何**（差异只在"报出来的数字"上，不是整段没跑）', {})
      must(!(rm.pages === realPages && rm.elements === realEls),
        '【变异测试·真注入】把影响范围写死为 0（假报影响）→ ④"预演=真实"判据**必须能抓到**',
        { reported: { pages: rm.pages, elements: rm.elements }, real: { pages: realPages, elements: realEls } })
      const bm = M.revertTemplate(rm.outline, 'zgf-ink-wash', prevLayouts, prevElements)
      const stillMoved = []
      bm.outline.forEach((s, i) => (s.elements || []).forEach((e, j) => {
        const p = (before[i].elements || [])[j]
        if (p && geom(e) !== geom(p)) stillMoved.push(e.id)
      }))
      must(stillMoved.length > 0,
        '【变异测试·真注入】剥掉"回退 elements"→ 撤销后几何仍停在被重排的样子（＝2026-09-15 那个真缺陷复现）→ ⑤"可回退"判据**必须能抓到**',
        { stillMoved })
    } finally {
      try { fs.unlinkSync(mutPath) } catch { /* 已删除 */ }
    }
  }

  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
}).finally(() => {
  for (const f of [B_INTENT, B_TPL, B_MUT]) { try { fs.rmSync(f, { force: true }) } catch { /* noop */ } }
})
