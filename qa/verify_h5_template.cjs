/**
 * H5 课件频道的模板库接入（池隔离 / 条目完备 / 面板真的用 H5 池）—— 2026-09-29 立
 *
 * 为什么补这条：清退存量守卫时 `verify_h5_template` 退役，而**"H5 模板接入"这块没有登记守卫**
 * （见 `qa/RETIRED.md` 缺口清单）。它守的是一个很容易"静默坏掉"的接线：
 *   H5 编辑器左栏模板库若取错池（`cwFormat === 'h5' ? H5_TEMPLATES : PPT_TEMPLATES`），
 *   教师会看到一堆**PPT 模板**套到 H5 上 → 版式/装饰全不对，但页面不报错、也没人会发现。
 *
 * 判据：
 *   ① **池隔离**：`H5_TEMPLATES` 非空、每条 `kind==='h5'`；`getTemplatesByKind('h5')` 返回的就是 H5 池、
 *      `'ppt'` 返回 PPT 池；**两池 id 不相交**（不混用同一池）；
 *   ② **条目完备**：每条 `id/name/themeId` 非空、`themeId` 能被 `getTheme()` 解析（不是死链）、
 *      `style` 在 `STYLE_LABELS` 里有中文标签、面板筛选用到的 `templateStyleTags/templateColorTags` 不抛错；
 *   ③ **面板真的用 H5 池**（真浏览器集成冒烟）：进 `/courseware/h5/new` → 点「模板库」→
 *      页面文本里必须出现**一个 H5 池独有的模板名**（名字**从被测对象里取**，不硬编码，改名字不会让守卫失效）；
 *      且**不得**出现只在 PPT 池里的模板名（用户可见的池隔离证据）。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时**真改被测源码**（临时副本 `cwTemplate.ts`：把 H5 池建成空数组、
 *   并让 `getTemplatesByKind` 永远返回 PPT 池）→ ①② 必须变红。
 *   ⚠ 变异只覆盖**确定性部分**；③ 是跑**线上真实产物**的集成冒烟（源码改动要重新构建部署才生效），
 *     故 ③ 的证明力弱于 ①②，本守卫不声称 ③ 被变异过。
 *
 * 用法：`node qa/verify_h5_template.cjs`（约 20s：两次打包 + 一次真浏览器）
 *       `MUTATE=1 node qa/verify_h5_template.cjs`
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const FE = path.join(__dirname, '..', 'code', 'frontend')
const B_TPL = '/tmp/qaCwTpl.cjs'
const B_THEMES = '/tmp/qaPptThemes.cjs'
const B_MUT = '/tmp/qaMutCwTpl.cjs'
const MUTATE = process.env.MUTATE === '1'

const bundle = (entry, out) => execFileSync('npx',
  ['esbuild', entry, '--bundle', '--format=cjs', '--platform=node',
    '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
    '--define:import.meta.env={}', `--outfile=${out}`, '--log-level=error'],
  { cwd: FE, stdio: 'inherit' })

let br
;(async () => {
  bundle('src/lib/cwTemplate.ts', B_TPL)
  globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { }, clear() { } }
  globalThis.window = globalThis.window || {}
  const T = require(B_TPL)
  must(Array.isArray(T.H5_TEMPLATES) && Array.isArray(T.PPT_TEMPLATES) && typeof T.getTemplatesByKind === 'function',
    '打包成功：模板池与取池函数可用', { h5: (T.H5_TEMPLATES || []).length, ppt: (T.PPT_TEMPLATES || []).length })

  /* ── ① 池隔离 ── */
  must(T.H5_TEMPLATES.length > 0, '① H5 模板池**非空**（H5 频道真的有模板可套）', { n: T.H5_TEMPLATES.length })
  const wrongKind = T.H5_TEMPLATES.filter(t => t.kind !== 'h5').map(t => `${t.id}:${t.kind}`)
  must(wrongKind.length === 0, '① H5 池里每条的 `kind` 都是 `h5`', { wrong: wrongKind })
  const pickH5 = T.getTemplatesByKind('h5'), pickPpt = T.getTemplatesByKind('ppt')
  must(pickH5 === T.H5_TEMPLATES || (pickH5.length === T.H5_TEMPLATES.length && pickH5.every(t => t.kind === 'h5')),
    '① `getTemplatesByKind("h5")` 取到的确实是 H5 池', { h5: T.H5_TEMPLATES.length, got: pickH5.length })
  must(pickPpt.length === T.PPT_TEMPLATES.length && pickPpt.every(t => t.kind === 'ppt'),
    '① `getTemplatesByKind("ppt")` 取到的是 PPT 池（按媒介分流，没串池）', { ppt: T.PPT_TEMPLATES.length, got: pickPpt.length })
  const idsH5 = new Set(T.H5_TEMPLATES.map(t => t.id)), dup = T.PPT_TEMPLATES.filter(t => idsH5.has(t.id)).map(t => t.id)
  must(dup.length === 0, '① **两池 id 不相交**（混用同一池会导致"同一模板两个媒介"）', { dup: dup.slice(0, 4) })

  /* ── ② 条目完备 ── */
  const badField = T.H5_TEMPLATES.filter(t => !t.id || !t.name || !t.themeId).map(t => t.id || '(无 id)')
  must(badField.length === 0, '② 每条 H5 模板的 `id/name/themeId` 非空', { bad: badField })
  // ⚠ 别写成"没这个函数就跳过"（那叫**真空通过**）：单独打包 pptThemes 拿到真解析器再判。
  bundle('src/lib/pptThemes.ts', B_THEMES)
  const TH = require(B_THEMES)
  const themeOf = TH.getTheme || TH.resolveTheme
  must(typeof themeOf === 'function', '② 拿到配色解析器（`pptThemes.getTheme/resolveTheme`）—— 否则本判据无法成立', { keys: Object.keys(TH).slice(0, 6) })
  const themeMissing = T.H5_TEMPLATES.filter(t => !themeOf(t.themeId)).map(t => `${t.id}→${t.themeId}`)
  must(themeMissing.length === 0,
    '② 每条模板的 `themeId` 都能解析出配色（不是死链 → 面板不会给出"无名配色"的模板）',
    { missing: themeMissing.slice(0, 6) })
  const noLabel = T.H5_TEMPLATES.filter(t => !(T.STYLE_LABELS || {})[t.style]).map(t => `${t.id}:${t.style}`)
  must(noLabel.length === 0, '② 每条模板的 `style` 在 `STYLE_LABELS` 里有中文标签（面板要显示它）', { bad: noLabel })
  let tagErr = null, tagOk = true
  try {
    for (const t of T.H5_TEMPLATES) {
      const a = T.templateStyleTags(t), b = T.templateColorTags(t)
      if (!Array.isArray(a) || !Array.isArray(b)) tagOk = false
    }
  } catch (e) { tagErr = e.message }
  must(tagOk && !tagErr, '② 面板筛选用到的 `templateStyleTags/templateColorTags` 对每条都不抛错且返回数组', { err: tagErr })

  /* ── ③ 真浏览器：H5 频道面板必须用 H5 池（名字从被测对象里取） ── */
  const h5Names = new Set(T.H5_TEMPLATES.map(t => t.name))
  const pptOnly = T.PPT_TEMPLATES.map(t => t.name).filter(n => !h5Names.has(n))
  const probeName = [...h5Names].find(n => !new Set(T.PPT_TEMPLATES.map(x => x.name)).has(n)) || [...h5Names][0]
  const pptProbe = [...new Set(pptOnly)].find(n => n && n.length >= 4)
  console.log(`   [info] H5 池 ${T.H5_TEMPLATES.length} 条 / PPT 池 ${T.PPT_TEMPLATES.length} 条；面板探针名 = 「${probeName}」`)

  br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  const lg = await (await fetch(`${B}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
  })).json()
  must(!!lg.token, '教师登录成功', {})
  await p.goto(`${B}/login`, { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])
  await p.goto(`${B}/courseware/h5/new`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(6000)
  must(!p.url().includes('/login'), '③ H5 新建页可达（未被踢回登录）', { url: p.url() })
  const tplBtn = p.locator('button[title="模板库"]').first()
  must(await tplBtn.count() > 0, '③ H5 编辑器有「模板库」入口', {})
  await tplBtn.click()
  await p.waitForTimeout(2500)
  const body = await p.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '))
  must(body.includes(probeName),
    `③ **面板真的用 H5 池**：页面出现 H5 池注册的模板名「${probeName}」（名字取自被测对象，非硬编码）`,
    { hit: body.includes(probeName), sample: body.slice(0, 100) })
  if (pptProbe) {
    must(!body.includes(pptProbe),
      `③ 面板**不得**出现只在 PPT 池里的模板「${pptProbe}」（用户可见的池隔离证据）`, { leaked: body.includes(pptProbe) })
  }
  must(errs.length === 0, '③ 打开模板库全程 pageerror = 0', { errs })

  /* ── 变异（强形态）：真改被测源码（H5 池清空 + 取池函数串池）→ ①② 必须红 ── */
  if (MUTATE) {
    const srcPath = path.join(FE, 'src/lib/cwTemplate.ts')
    const mutPath = path.join(FE, 'src/lib/__qa_mut_cwTemplate.ts')
    const orig = fs.readFileSync(srcPath, 'utf8')
    const patched = orig
      .replace("export const H5_TEMPLATES: CwTemplate[] = buildTemplates('h5', H5_TEMPLATE_DEFS)",
        'export const H5_TEMPLATES: CwTemplate[] = []')
      .replace("  return kind === 'ppt' ? PPT_TEMPLATES : H5_TEMPLATES", '  return PPT_TEMPLATES')
    try {
      must(patched !== orig && /H5_TEMPLATES: CwTemplate\[\] = \[\]/.test(patched) && !/kind === 'ppt' \? PPT_TEMPLATES : H5_TEMPLATES/.test(patched),
        '【变异测试·前置】两处注入点都匹配成功（H5 池清空 + 取池串池）', {})
      fs.writeFileSync(mutPath, patched)
      bundle('src/lib/__qa_mut_cwTemplate.ts', B_MUT)
      const M = require(B_MUT)
      must(M.H5_TEMPLATES.length === 0,
        '【变异测试·真注入】把 H5 池清空后 → ①"H5 池非空"判据**必须能抓到**（否则教师进 H5 频道看不到任何模板）',
        { n: M.H5_TEMPLATES.length })
      const mutPick = M.getTemplatesByKind('h5')
      must(!(mutPick.length === M.H5_TEMPLATES.length && mutPick.every(t => t.kind === 'h5')),
        '【变异测试·真注入】让取池函数"总是返回 PPT 池"后 → ①"池隔离"判据**必须能抓到**（否则 H5 会被套上 PPT 模板）',
        { gotKinds: [...new Set(mutPick.map(t => t.kind))] })
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
  for (const f of [B_TPL, B_THEMES, B_MUT]) { try { fs.rmSync(f, { force: true }) } catch { /* noop */ } }
})
