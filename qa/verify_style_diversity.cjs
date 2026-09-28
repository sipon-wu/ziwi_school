/**
 * PPT 版式多样性（确定性判据）—— 2026-09-28 重写
 *
 * 历史（诚实交代）：
 *   · 旧版两段都是"假绿"：H5 段与 PPT 段各自因**样本为空**而空转报绿（1-4 轮整改为显式 SKIP）。
 *   · H5 段 2026-09-27 已迁出到 `qa/verify_h5_stage.cjs`（正确方法：取播放器 HTML 独立渲染三档）。
 *   · PPT 段旧实现用**浏览器选择器**在编辑器画布里抓 `[data-layout]/.slide/...` —— 随新版预览标记过期后
 *     采集不到页（只能记 SKIP）。**本轮换成确定性判据**：不走浏览器、不看选择器，直接验"版式语义链"。
 *
 * 判据（为什么这样才可信）：
 *   "版式多样性"真正要保证的是三件事，都可**离线确定性**验证：
 *     ① **往返不丢版式**：outline → markdown → outline，每页 `layout` 必须原样保留；
 *     ② **版式真的有差异**：不同 layout 经 `layoutElements()` 得到的**元素几何签名**必须两两不同
 *        （否则"换了版式标注"只是标签游戏，渲染出来一模一样）；
 *     ③ **不得自创版式**：真实课件里的 `layout` 标注必须全部落在 `SlideLayout` 已知集合内
 *        （SKILL 明写"版式集合由平台定义，不得自创"）。
 *   另有**变异自检**：把 4 页打成同一版式 → 判据必须看到"只剩 1 种"（证明它不是恒真）。
 *
 * 用法：`BASE=http://school1.ziwi.cn node qa/verify_style_diversity.cjs`
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { must, report } = require('./lib/assert.cjs')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const FE = path.join(__dirname, '..', 'code', 'frontend')
const BUNDLE = '/tmp/qaLayoutDiversity.cjs'
const MUTATE = process.env.MUTATE === '1'
const MIN_DISTINCT = 3 // DoD：一份课件里 ≥3 种版式视为"多样化"

/** 已知版式集合：直接解析 `SlideLayout` 的 TS 联合类型（**单一事实源**就在那里，不再手抄一份） */
function knownLayouts() {
  const src = fs.readFileSync(path.join(FE, 'src/lib/cwTemplate.ts'), 'utf8')
  const m = /export type SlideLayout =([\s\S]*?)\n\n/.exec(src)
  if (!m) return []
  return [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map(x => x[1])
}

;(async () => {
  const known = knownLayouts()
  must(known.length >= 8, `解析到已知版式集合（SlideLayout 联合类型）共 ${known.length} 种`, { known: known.slice(0, 6) })

  // ── 打包前端纯函数（与 regression_20260917 同款：离线、无浏览器）──
  execFileSync('npx', ['esbuild', 'src/lib/exportPptx.ts', '--bundle', '--format=cjs', '--platform=node',
    '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
    '--define:import.meta.env={}', `--outfile=${BUNDLE}`, '--log-level=error'], { cwd: FE, stdio: 'inherit' })
  globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } }
  globalThis.window = globalThis.window || {}
  const EP = require(BUNDLE)
  must(typeof EP.markdownToOutline === 'function' && typeof EP.outlineToMarkdown === 'function'
    && typeof EP.layoutElements === 'function',
    '拿到纯函数：markdownToOutline / outlineToMarkdown / layoutElements', { keys: Object.keys(EP).length })

  /* ══════════ A) 往返 + 版式差异（fixture，确定性） ══════════ */
  const FIXED = ['edu-goal', 'edu-explain', 'two-col', 'edu-summary'].filter(x => known.includes(x))
  must(FIXED.length >= 4, '固定 4 种版式用于 fixture（全部来自已知集合）', { FIXED })
  const opts = { subject: '语文', grade: '四年级', title: '版式多样性自证' }

  const mkOutline = (layouts) => layouts.map((layout, i) => ({
    title: `第 ${i + 1} 页`, bullets: ['要点一', '要点二'], layout,
  }))

  const build = (layouts) => {
    const outline = mkOutline(layouts)
    const md = EP.outlineToMarkdown(outline, opts)
    return { outline, md, back: EP.markdownToOutline(md) }
  }

  const good = build(FIXED)
  must(good.back.length === FIXED.length, '往返页数不变', { pages: good.back.length })
  const kept = good.back.map(s => s.layout)
  must(JSON.stringify(kept) === JSON.stringify(FIXED),
    '① 往返不丢版式：每页 layout 原样保留', { want: FIXED, got: kept })

  const sigOf = (s, layout, styleKey = '') => JSON.stringify(
    EP.layoutElements(s, layout, styleKey).map(el => [Math.round(el.x || 0), Math.round(el.y || 0), Math.round(el.w || 0), Math.round(el.h || 0)]))

  // ② 版式真的有差异（**行为判据**，按实现意图分三层 —— 首版要求"所有版式两两不同"，把设计如此当成了缺陷：
  //   `exportPptx.ts:814-821` 明写"教学目标/课堂小结/课后作业：**有真实 bullets 时不走三栏占位骨架**，
  //    直接列 bullets（几何按风格给）"，故它们与纯文本页共用单列几何是**有意为之**）。
  // ⚠ 必须用**干净 slide**（只带 content，不带 `slots`/`layout`）：`layoutElements(slide, layout, …)` 在 slide
  //   自带 slots 时会**优先用 slots**，此时换 layout 参数不生效 —— 首版拿 markdown 往返得到的 `back[0]`
  //   （含 edu-goal 的 slots）去比 4 种版式，结果误得"只有 2 种几何"（不是产品缺陷，是我传错了被测对象）。
  const clean = { title: '示例页', bullets: ['要点一', '要点二'] }
  const STRUCTURED = ['edu-explain', 'two-col', 'edu-cover', 'edu-example', 'edu-phenomenon'].filter(x => known.includes(x))
  const structuredSigs = STRUCTURED.map(l => ({ l, sig: sigOf(clean, l) }))
  const uniqStructured = new Set(structuredSigs.map(x => x.sig))
  must(STRUCTURED.length >= 4 && uniqStructured.size === STRUCTURED.length,
    `②a 结构化版式的几何**两两不同**（${STRUCTURED.join('/')} → ${uniqStructured.size} 种不同几何）—— 否则"换版式"只是标签游戏`,
    { uniq: uniqStructured.size, want: STRUCTURED.length })

  const SINGLE_COL = ['edu-goal', 'edu-summary', 'edu-homework', 'content-text'].filter(x => known.includes(x))
  const singleSigs = SINGLE_COL.map(l => ({ l, sig: sigOf(clean, l, '') }))
  const uniqSingle = new Set(singleSigs.map(x => x.sig))
  must(uniqSingle.size === 1,
    `②b 有 bullets 时，"单列组"（${SINGLE_COL.join('/')}）**共用单列几何**（有意为之，见 exportPptx.ts:814-821）`,
    { uniq: uniqSingle.size, sig: singleSigs[0].sig.slice(0, 60) })
  // 这条直接守一个**历史缺陷**：这些几何曾被写死 `6/23/88/64`（换风格也一样，是"一个头面"的来源之一），
  // 现在注释明写"几何按风格给" → 故必须随 styleKey 变化。
  const styled = ['ink', 'china', 'tech'].map(k => sigOf(clean, SINGLE_COL[0], k))
  must(new Set(styled).size === styled.length,
    '②c 单列几何**随风格变化**（守"几何按风格给"：曾写死 6/23/88/64，换风格也一样）',
    { ink: styled[0].slice(0, 40), china: styled[1].slice(0, 40), tech: styled[2].slice(0, 40) })

  // ②d 几何**随内容变化**：空内容页不产出文本元素（实测 `[]`）。
  //   注：exportPptx 的注释说"无内容时回退占位骨架"，而 `edu-goal` 走的路径实际返回空数组 ——
  //   断言只描述**实际行为**（内容为空 ⇒ 不产出元素），不替它圆注释。
  const empty = sigOf({ title: '空页', bullets: [] }, SINGLE_COL[0])
  must(empty !== sigOf(clean, SINGLE_COL[0]),
    '②d 几何随内容变化：空内容页不产出文本元素（≠ 有内容时的单列几何）',
    { empty })

  const distinct = (arr) => [...new Set(arr.filter(Boolean))]
  must(distinct(kept).length >= MIN_DISTINCT,
    `① 多样性达标：fixture 里出现 ${distinct(kept).length} 种版式（阈值 ≥${MIN_DISTINCT}）`, { distinct: distinct(kept) })

  /* ③ 用**一份"像真实课件"的多页 deck** 验证多样性（8 页 6 种版式）：
   *    为什么不用库里的真实课件 —— 实测 staging 现存 PPT 件只有 2 个 **E2E 基线件**（1 页、无版式标注），
   *    拿它当"真实产物"样本等于自欺；真实课件的多样性在生成链路上另有守卫（`verify_orchestration` 等）。
   *    这里用确定性 deck 把"一份课件真的用出多种版式"钉住：往返保留 + 至少 5 种不同几何。 */
  const DECK = ['edu-cover', 'edu-goal', 'edu-explain', 'edu-explain', 'two-col', 'edu-example', 'edu-summary', 'edu-homework']
    .filter(x => known.includes(x))
  if (DECK.length >= 6) {
    const deck = build(DECK)
    must(JSON.stringify(deck.back.map(s => s.layout)) === JSON.stringify(DECK),
      `③ 多页 deck 往返保留全部版式（${DECK.length} 页）`, { got: deck.back.map(s => s.layout) })
    const deckSigs = new Set(deck.back.map((s, i) => sigOf(clean, DECK[i])))
    must(distinct(deck.back.map(s => s.layout)).length >= 5 && deckSigs.size >= 5,
      '③ 多页 deck 真的用出多种版式：≥5 种不同版式 → ≥5 种不同几何',
      { layouts: distinct(deck.back.map(s => s.layout)).length, geoms: deckSigs.size })
  } else {
    console.log(`   [SKIP] 逐页多版式 deck 未验证（已知集合里可用的版式不足：${DECK.length}）`)
  }

  /* ── 变异自检（**强形态**，2026-09-29 升级）─────────────────────────────
   * 旧形态：把 4 页的 layout 参数都传成同一个（喂坏输入给判据）—— 只证明比较函数会算。
   * 新形态：**真改被测源码**（`exportPptx.ts` 里"把 layout 标注写进 markdown"那一行改成永远写同一个），
   *        复制成临时件 `__qa_mut_exportPptx.ts` 重新打包，再用**同一批判据**去判它 → 必须变红。
   *        跑完 finally 删除临时件（被测源码本体一行不动）。 */
  if (MUTATE) {
    const srcPath = path.join(FE, 'src/lib/exportPptx.ts')
    const mutPath = path.join(FE, 'src/lib/__qa_mut_exportPptx.ts')
    const mutBundle = '/tmp/qaMutLayoutDiversity.cjs'
    const orig = fs.readFileSync(srcPath, 'utf8')
    const patched = orig.replace('if (s.layout) lines.push(`<!-- layout: ${s.layout} -->`)',
      'if (s.layout) lines.push(`<!-- layout: edu-goal -->`)')
    try {
      must(patched !== orig,
        '【变异测试·前置】源码注入点匹配成功（否则说明实现变了，需更新注入点 —— 不是"变异通过"）', {})
      fs.writeFileSync(mutPath, patched)
      execFileSync('npx', ['esbuild', 'src/lib/__qa_mut_exportPptx.ts', '--bundle', '--format=cjs', '--platform=node',
        '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
        '--define:import.meta.env={}', `--outfile=${mutBundle}`, '--log-level=error'], { cwd: FE, stdio: 'inherit' })
      const EP2 = require(mutBundle)
      const back2 = EP2.markdownToOutline(EP2.outlineToMarkdown(mkOutline(FIXED), opts))
      const kept2 = back2.map(s => s.layout)
      must(JSON.stringify(kept2) !== JSON.stringify(FIXED) && new Set(kept2).size === 1,
        '【变异测试·真注入】真改被测源码（layout 标注永远写同一个）后重打包 → "往返不丢版式"与多样性判据**必须变红**（只剩 1 种）',
        { got: [...new Set(kept2)], want: FIXED })
      must(distinct(kept2).length < MIN_DISTINCT,
        `【变异测试·真注入】重打包后的产物在"多样性达标（≥${MIN_DISTINCT}）"这条上也确实不达标`,
        { distinct: distinct(kept2) })
    } finally {
      try { fs.unlinkSync(mutPath) } catch { /* 已删除 */ }
    }
  }

  /* ══════════ B) 真实课件：不得自创版式（硬）+ 多样性计数（登记） ══════════ */
  const lg = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })).json()
  must(!!lg.token, '教师登录成功（取真实课件样本）', { user: lg.user && lg.user.name })
  const H = { Authorization: 'Bearer ' + lg.token }
  const l = await (await fetch(`${BASE}/api/materials`, { headers: H })).json()
  // 只取**非 E2E 基线件**当"真实产物"样本：把守卫自建的 fixture 当产品样本 = 自欺
  const all = (Array.isArray(l) ? l : (l.items || []))
    .filter(m => (m.format || '') === 'ppt' && m.id && !String(m.name || '').startsWith('__E2E'))
  // 样本挑选：先取内容、按**页数**排序取最多的两件 —— 首版只取列表前两个，抽到的是 1 页 E2E 件，
  // "多样性计数"无从谈起（那次只登记不判红，但样本选得不好等于白跑）。
  const fetched = []
  for (const m of all.slice(0, 6)) {
    const d = await (await fetch(`${BASE}/api/materials/${m.id}`, { headers: H })).json()
    const back = EP.markdownToOutline(String(d.content || ''))
    fetched.push({ id: m.id, name: m.name, back, pages: back.length })
  }
  fetched.sort((a, b) => b.pages - a.pages)
  const ppts = fetched.slice(0, 2)
  if (!ppts.length || ppts[0].pages === 0) {
    console.log('   [note] 库内无**真实** ppt 课件（现存只有守卫自建的 E2E 基线件）→ '
      + '「不得自创版式」这一条**未在真实产物上验证**（确定性判据 ①②③ 已覆盖渲染层语义）')
  } else {
    for (const p of ppts) {
      const d = await (await fetch(`${BASE}/api/materials/${p.id}`, { headers: H })).json()
      const md = String(d.content || '')
      const back = EP.markdownToOutline(md)
      const used = distinct(back.map(s => s.layout))
      const invented = back.map(s => s.layout).filter(x => x && !known.includes(x))
      must(invented.length === 0,
        `③ 不得自创版式：真实课件《${String(p.name).slice(0, 18)}》用到的版式全部在已知集合内`,
        { invented: [...new Set(invented)], used })
      const pages = back.length
      console.log(`   [sample] 《${String(p.name).slice(0, 18)}》${pages} 页，用了 ${used.length} 种版式：${used.join(',') || '(无标注)'}`)
      if (pages >= 6) {
        must(used.length >= MIN_DISTINCT,
          `③ 真实课件多样性：${pages} 页里出现 ${used.length} 种版式（阈值 ≥${MIN_DISTINCT}）`, { used })
      } else {
        console.log(`   [note] 该样本仅 ${pages} 页 → 多样性阈值不适用（不判红，也不假装通过）`)
      }
    }
  }

  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
})
