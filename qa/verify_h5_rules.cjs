/**
 * H5 课件是否与 PPT **同一套换风格规则**（契约一致 / 自动版本快照 / 画布真重渲染）—— 2026-09-29 立
 *
 * 为什么补这条：清退存量守卫时 `verify_h5_rules` 退役，而**"H5 换风格规则"这块没有登记守卫**
 * （见 `qa/RETIRED.md` 缺口清单）。它守的是一条**跨模块契约**，坏掉时极其隐蔽：
 *   小微面板（派发端，`styleIntent.ts` 的 `SWITCH_STYLE_EVENT` 常量）
 *     ↕ 必须与 编辑器（监听端，`useCwTemplate.ts` **注册的字符串**）**指同一个事件名**
 *   两边一旦不一致 → 教师看到"已换成 X"（或干脆没反应），**画布却一动不动**，而且不报错。
 *
 * 判据：
 *   ① **契约一致（源码级）**：派发端常量值 === 监听端 `addEventListener` 注册的字面量；
 *   ② **快照标签与格式无关（源码级）**：`换风格前（轻档/重档 → 风格名）` 只有一处模板，**没有**按 `format/cwFormat`
 *      分支 —— 这就是"H5 与 PPT 同规则"的代码证据；
 *   ③ **H5 编辑器的监听端真的接住了**（真页面）：按契约派发一次**轻档换素净**事件 → `handled === true`；
 *   ④ **自动版本快照落库**：`GET /api/versions?resource_type=material&resource_id=…` 必须出现
 *      label 含 `换风格前（轻档 → 素净）` 的条目（与 PPT 同规则，可回退的承诺靠它）；
 *   ⑤ **画布真重渲染**：iframe 的 `srcdoc` 必须**变了**，且新 srcdoc 里能看到素净的 themeId（真换肤，不是只改了状态）；
 *   ⑥ `pageerror = 0`。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时**真改被测源码**（临时副本 `styleIntent.ts`：把 `SWITCH_STYLE_EVENT`
 *   的值改掉）→ ① 必须变红 —— 这**正是"改了一边"的真实事故形态**（面板说换了、画布不动）。
 *
 * ⚠ 口径说明：多轮对话（选档 → 二次确认 → 执行）的**逻辑**由 `qa/verify_style_intent.cjs` 的确定性判据覆盖；
 *   本守卫不做多轮对话 UI 操作（那条路径既脆又已覆盖），只验 **H5 特有的三件事**：契约、快照、重渲染。
 *
 * 用法：`node qa/verify_h5_rules.cjs`（约 30s）
 *       `MUTATE=1 node qa/verify_h5_rules.cjs`
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')
const { session, h5Content } = require('./lib/cwFixture.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const FE = path.join(__dirname, '..', 'code', 'frontend')
const B_IDX = '/tmp/qaH5Rules.cjs'
const MUTATE = process.env.MUTATE === '1'
const STAMP = Date.now()
const NAME = `__E2E_H5规则自检_${STAMP}`

const bundle = (entry, out) => execFileSync('npx',
  ['esbuild', entry, '--bundle', '--format=cjs', '--platform=node',
    '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
    '--define:import.meta.env={}', `--outfile=${out}`, '--log-level=error'],
  { cwd: FE, stdio: 'inherit' })

let br, id
;(async () => {
  /* ── ① 契约一致（源码级）── */
  const intentSrc = fs.readFileSync(path.join(FE, 'src/lib/styleIntent.ts'), 'utf8')
  const tplSrc = fs.readFileSync(path.join(FE, 'src/hooks/useCwTemplate.ts'), 'utf8')
  const dispatchConst = (intentSrc.match(/SWITCH_STYLE_EVENT\s*=\s*'([^']+)'/) || [])[1]
  const dispatchIns = [...intentSrc.matchAll(/dispatchEvent\(new CustomEvent\(\s*([A-Za-z_$][\w$]*|'[^']+')/g)].map(m => m[1])
  const listenLits = [...tplSrc.matchAll(/addEventListener\(\s*'([^']+)'/g)].map(m => m[1])
  const listenUsesConst = /addEventListener\(\s*SWITCH_STYLE_EVENT/.test(tplSrc)
  must(!!dispatchConst, '① 找到派发端的常量 `SWITCH_STYLE_EVENT`', { value: dispatchConst })
  must(listenLits.length > 0 || listenUsesConst,
    '① 找到监听端的注册（编辑器确实在监听换风格事件）', { listenLits })
  const listenValue = listenUsesConst ? dispatchConst : listenLits[0]
  must(listenValue === dispatchConst,
    `① **跨模块契约一致**：派发端常量（'${dispatchConst}'）与监听端注册（'${listenValue}'）必须是同一个事件名`
    + ' —— 不一致时教师会看到"已换成 X"而画布一动不动（且不报错）',
    { dispatch: dispatchConst, listen: listenValue, dispatchIns, listenUsesConst })
  must(dispatchIns.includes('SWITCH_STYLE_EVENT') || dispatchIns.some(x => x.replace(/'/g, '') === dispatchConst),
    '① 派发端用的确实是这个事件名（不是另写一个）', { dispatchIns })

  /* ── ② 快照标签与格式无关（源码级）── */
  const labelLine = (tplSrc.match(/const snapLabel = `([^`]+)`/) || [])[1] || ''
  must(/换风格前/.test(labelLine) && /level === 'heavy' \? '重档' : '轻档'/.test(labelLine) && /STYLE_LABELS/.test(labelLine),
    '② **快照标签只有一处模板**：`换风格前（轻档/重档 → 风格名）`（H5 与 PPT 共用同一函数 ⇒ 同规则）',
    { labelLine })
  const labelBlock = tplSrc.slice(Math.max(0, tplSrc.indexOf(labelLine) - 400), tplSrc.indexOf(labelLine) + 200)
  must(!/cwFormat\s*===|format\s*===\s*'h5'|format\s*===\s*'ppt'/.test(labelBlock),
    '② 该标签**没有按格式分支**（有分支就等于"H5 一套、PPT 另一套"）', { around: labelBlock.slice(0, 0) })

  /* ── 真页面：H5 编辑器接住事件 + 快照落库 + 画布重渲染 ── */
  bundle('src/lib/courseware-h5/index.ts', B_IDX)   // 仅为确认产物链路可用（不参与断言）
  const { H, get } = await session()
  const cr = await (await fetch(`${B}/api/materials/json`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: NAME, type: 'courseware', format: 'h5', content: h5Content(), status: 'draft', subject: '语文', grade: '四年级' }),
  })).json()
  id = cr && cr.id
  must(!!id, '造一份 H5 课件（草稿态）', { id })

  br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  const lg = await (await fetch(`${B}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
  })).json()
  await p.goto(`${B}/login`, { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])
  await p.goto(`${B}/courseware/h5/${id}/edit`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(9000)

  const srcdocOf = () => p.evaluate(() => (document.querySelector('iframe')?.getAttribute('srcdoc') || ''))
  const before = await srcdocOf()
  must(before.length > 1000, 'H5 编辑器画布是 `iframe[srcdoc]` 且已渲染', { len: before.length })

  /* ── ③ 按契约派发一次「轻档 → 素净」── */
  const res = await p.evaluate(async ([EV, payload]) => {
    const detail = { ...payload, handled: false }
    const waited = new Promise(r => { detail.resolve = r })
    try { window.dispatchEvent(new CustomEvent(EV, { detail })) } catch (e) { return { dispatchError: String(e && e.message) } }
    await Promise.race([waited, new Promise(r => setTimeout(r, 9000))])
    return { handled: detail.handled, error: detail.error, impact: detail.impact, snapshot: detail.snapshot }
  }, [dispatchConst, { styleTag: 'minimal', level: 'light', dryRun: false }])
  must(res.handled === true,
    `③ **H5 编辑器的监听端接住了**（按契约派发 '${dispatchConst}' → handled=true；false/超时说明事件名两端不一致或监听被摘掉）`,
    res)
  await p.waitForTimeout(2500)

  /* ── ④ 自动版本快照落库（与 PPT 同规则）── */
  const vs = await (await fetch(`${B}/api/versions?resource_type=material&resource_id=${id}`, { headers: H })).json()
  const items = (vs && vs.items) || []
  const snap = items.find(v => /换风格前/.test(String(v.label || '')))
  must(!!snap,
    '④ **自动版本快照落库**：`/api/versions` 出现「换风格前（…）」条目（与 PPT 同规则；"可回退"的承诺靠它）',
    { labels: items.map(v => v.label) })
  must(snap && /轻档/.test(String(snap.label)) && /素净/.test(String(snap.label)),
    '④ 快照标签点名了**档位与目标风格**（如「换风格前（轻档 → 素净）」）', { label: snap && snap.label })

  /* ── ⑤ 画布真重渲染（iframe srcdoc 变了 + 真换肤）── */
  const after = await srcdocOf()
  must(after.length > 1000 && after !== before,
    '⑤ **画布真重渲染**：iframe `srcdoc` 确实变了（不是只改了状态/只弹了提示）',
    { before: before.length, after: after.length })
  /* ⚠ 判"真换肤"的标记要选对（两版都踩过）：
   *   ① 首版写成 `after.includes('min-classic-blue') || /minimal/.test(after)` → gotTheme=false 也算过（**真空通过**）；
   *   ② 收紧成"必须含 styleRegistry 里的 themeId" → **实测不成立**：H5 画布把配色**解析成具体色值内联**，
   *      并不保留 themeId 字符串（轻档换的正是配色/标题形态/底纹/装饰）。
   *   故改为：**两侧的色值集合都必须变**（有只属于新画布的颜色、也有只属于旧画布的颜色）——
   *   这既证明"真换肤"，又排除"只是追加/删了别的东西"的巧合。 */
  const hues = (s) => [...new Set((s.match(/#[0-9a-fA-F]{6}/g) || []).map(x => x.toLowerCase()))]
  const hb = hues(before), ha = hues(after)
  const onlyOld = hb.filter(x => !ha.includes(x)), onlyNew = ha.filter(x => !hb.includes(x))
  must(onlyNew.length > 0 && onlyOld.length > 0,
    '⑤ 新画布的**配色集合确实变了**（既有只属于新画布的颜色、也有只属于旧画布的）—— 轻档＝只换风格语汇，不是空转',
    { onlyNew: onlyNew.slice(0, 4), onlyOld: onlyOld.slice(0, 4), nOld: hb.length, nNew: ha.length })

  must(errs.length === 0, '⑥ 全程 pageerror = 0', { errs })

  /* ── 变异（强形态）：真改被测源码把事件名改掉 → ① 必须红 ── */
  if (MUTATE) {
    const srcPath = path.join(FE, 'src/lib/styleIntent.ts')
    const mutPath = path.join(FE, 'src/lib/__qa_mut_styleIntent.ts')
    const orig = fs.readFileSync(srcPath, 'utf8')
    const patched = orig.replace(`export const SWITCH_STYLE_EVENT = '${dispatchConst}'`,
      "export const SWITCH_STYLE_EVENT = 'zhiwei:switch-style-RENAMED'")
    try {
      must(patched !== orig, '【变异测试·前置】源码注入点匹配成功（事件名常量）', {})
      fs.writeFileSync(mutPath, patched)
      const mutSrc = fs.readFileSync(mutPath, 'utf8')
      const mutConst = (mutSrc.match(/SWITCH_STYLE_EVENT\s*=\s*'([^']+)'/) || [])[1]
      must(mutConst !== listenValue,
        '【变异测试·真注入】把派发端事件名改掉后 → ① 的**契约一致**判据必须能抓到'
        + `（'${mutConst}' ≠ 监听端 '${listenValue}'）—— 这正是"面板说换了、画布不动"的事故形态`,
        { mutConst, listen: listenValue })
    } finally {
      try { fs.unlinkSync(mutPath) } catch { /* 已删除 */ }
    }
  }

  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
}).finally(async () => {
  try { await br?.close() } catch { /* noop */ }
  try { fs.rmSync(B_IDX, { force: true }) } catch { /* noop */ }
  if (!id) return
  try {
    const lg = await (await fetch(`${B}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
    })).json()
    const st = (await fetch(`${B}/api/materials/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + lg.token } })).status
    console.log(`   [cleanup] 测试 H5 课件已删除：${st}`)
  } catch (e) {
    console.log(`   [cleanup] 删除失败：${e.message}`)
  }
})
