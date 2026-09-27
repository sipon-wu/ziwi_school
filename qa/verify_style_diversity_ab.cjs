/**
 * P0-a 的 DoD 守卫：**风格差异式** E2E（2026-09-27 立 · 1-1）
 *
 * 依据（《0911 Skill服务化与验收防伪方案》）：
 *   · 里程碑 **P0-a 的 DoD**：「同一内容用 **6 个 theme_id** 渲染，**主色 / 骨架 / DOM 签名至少两项不同**（E2E 断言）」
 *   · 第五章 M1/M2/**M3**：断言必须**差异式**（禁"存在式"）；主观目标设代理指标；**必须过变异测试与负控**。
 *
 * 为什么必须真链路（M4）：只调内部函数会漏掉"参数没传到渲染器"这类缺陷 ——
 *   实测过的同类事故：G4 时序 bug（用闭包旧值渲染）、G3 皮肤表与 CwTheme id 不对齐。
 *   故本脚本**走真实链路**：建同内容、不同 theme_id 的 H5 课件 → 打开编辑器 → 从
 *   `iframe(srcDoc=cwH5Html)` 里读**渲染结果**（与课堂投屏同一份 HTML）。
 *
 * 三个差异代理指标（全部取自渲染后的 DOM，不用截图）：
 *   ① **主色相**：body 渐变 + 各 `section.scene` 背景色 → 取色相集合 → 两两最大角距 ≥ 25°？（M2）
 *   ② **骨架类**：`body.class` 的 `morph-* / mv-* / layout-*` + `data-motif` + `.sk-*` 集合
 *   ③ **结构签名**：`section.scene` 的 `data-type` 序列 + 每幕 `scene-inner` 子元素标签序列
 *
 * 断言：
 *   A. 每个 fixture 的 `body[data-theme]` **等于**其 theme_id（主题真的到达渲染器，不是回落 storybook）
 *   B. **两两之间 ≥2 项不同**（DoD 原文；逐对输出矩阵，便于报告）
 *   C. **负控**：同一主题的两次独立渲染 → 三项指标**全同**（证明指标能判"同"，不是恒真）
 *
 * 变异测试（M3，按需跑）：`MUTATE=1 node qa/verify_style_diversity_ab.cjs`
 *   → 建 6 个**同主题**的 fixture（模拟"theme 参数被打死/未生效"这类缺陷），
 *     断言"可区分对数 = 0"；若它仍然全绿，说明本套件**无效**（脚本自身报错）。
 */
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')
const { session, h5Content } = require('./lib/cwFixture.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const THEMES = ['zgf-ink-wash', 'te-quantum-blue', 'fr-mint', 'aca-edu-blue', 'sp-cartoon', 'min-classic-blue']
const MUTATE = !!process.env.MUTATE
const CONTENT = h5Content()

const rgbToHue = (r, g, b) => {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (d === 0) return null
  let h
  if (mx === r) h = ((g - b) / d) % 6
  else if (mx === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return (h * 60 + 360) % 360
}
const hueDist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 360 - d) }

/** 从 iframe 内提取三项指标（在页面上下文执行） */
const extract = () => {
  const body = document.body
  // 取色：**按位置**收集，不做"集合内两两比"（否则同一主题跟自己比也会"不同"——主题内部本就有深浅差，
  // 上一版就因此让负控假红：集合完全相同，却算出 rgb=73）。
  const parseColors = (s) => [...String(s || '').matchAll(/rgba?\(([^)]+)\)/g)]
    .map(m => m[1].split(',').map(Number))
    .filter(p => p.length >= 3 && (p.length < 4 || p[3] > 0.05))
    .map(p => p.slice(0, 3))
  const bodyCs = getComputedStyle(body)
  // 主题**本色**取自渲染器定义的 CSS 变量（--accent/--accent2/--bg1/--bg2，见 renderer.ts:992）。
  // 为什么不用 body 渐变本身：渐变是 `mixWhite(primary,0.8)` 的**浅色调**，深色主题的浅色都趋近白，
  // 会把"水墨黑 vs 科技蓝"算成几乎相同（实测 rgb 仅 20，属**指标低估**）。
  const norm = (c) => {
    if (!c) return null
    const d = document.createElement('div'); d.style.color = c; document.body.appendChild(d)
    const out = getComputedStyle(d).color; d.remove()
    const p = (out.match(/rgba?\(([^)]+)\)/) || [])[1]
    return p ? p.split(',').map(Number).slice(0, 3) : null
  }
  const themeColors = ['--accent', '--accent2', '--bg1', '--bg2']
    .map(v => norm(bodyCs.getPropertyValue(v).trim()))
    .filter(Boolean)
  const scenes = [...document.querySelectorAll('section.scene')]
  const skelSet = [...document.querySelectorAll('[class*="sk-"]')]
    .flatMap(el => [...el.classList].filter(c => c.startsWith('sk-')))
  return {
    themeReached: body.dataset.theme || '',
    motif: body.dataset.motif || '',
    layout: body.dataset.layout || '',
    bodyClasses: [...body.classList],
    /** 主题本色（--accent/--accent2/--bg1/--bg2）—— 位置有意义，逐位比对 */
    primary: themeColors,
    /** 每幕背景色（位置对应幕序） */
    sceneBgs: scenes.map(s => {
      const cs = getComputedStyle(s)
      return (parseColors(cs.backgroundImage)[0]) || (parseColors(cs.backgroundColor)[0]) || null
    }),
    skeleton: [...new Set([...body.classList, 'motif:' + (body.dataset.motif || ''), ...skelSet])].sort().join('|'),
    structure: scenes.map(s => (s.dataset.type || '?') + ':' + [...(s.querySelector('.scene-inner')?.children || [])].map(c => c.tagName).join(',')).join(' / '),
  }
}

let br
const created = []
;(async () => {
  const S = await session()
  const H = S.H
  /* ── 建 fixture：同内容 × 6 主题（变异模式：全部同一主题）── */
  for (const [i, th] of THEMES.entries()) {
    const theme = MUTATE ? THEMES[0] : th
    const name = `__E2E风格自证_${th}_0927`
    const r = await fetch(B + '/api/materials/json', {
      method: 'POST', headers: H,
      body: JSON.stringify({ name, type: 'courseware', format: 'h5', content: CONTENT, status: 'draft', subject: '语文', grade: '四年级', theme_id: theme }),
    })
    const m = await r.json()
    if (!m || !m.id) throw new Error(`建 fixture 失败（${th}）：${JSON.stringify(m).slice(0, 120)}`)
    created.push({ id: m.id, theme, want: th, i })
  }
  must(created.length === 6, `建出 6 个同内容 / 不同 theme_id 的 H5 fixture${MUTATE ? '（变异模式：theme 全部相同）' : ''}`, { ids: created.map(c => c.id.slice(0, 8)) })

  br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto(B + '/login', { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [S.lg.token, S.lg.user])

  /** 打开课件编辑器并等 H5 画布 iframe 就绪 → 取指标 */
  const measure = async (id) => {
    await p.goto(`${B}/courseware/h5/${id}/edit`, { waitUntil: 'domcontentloaded' })
    let frame = null
    for (let i = 0; i < 40 && !frame; i++) { // 最多等 ~20s
      await p.waitForTimeout(500)
      for (const f of p.frames()) {
        if (f === p.mainFrame()) continue
        try { if (await f.evaluate(() => !!(document.body && document.body.dataset.theme))) { frame = f; break } } catch { /* 跨域/未就绪 */ }
      }
    }
    if (!frame) return null
    return frame.evaluate(extract)
  }

  const metrics = []
  for (const c of created) {
    const m = await measure(c.id)
    must(!!m, `打开 theme=${c.theme} 的 H5 课件并读到画布渲染结果`, { id: c.id.slice(0, 8) })
    metrics.push({ ...c, m })
  }

  /* A. 主题真的到达渲染器（否则"头面一样"的原始缺陷会重现） */
  for (const x of metrics) {
    must(x.m && x.m.themeReached === x.theme, `渲染结果的 body[data-theme] = ${x.theme}（参数确实到达渲染器，非回落 storybook）`, { got: x.m && x.m.themeReached })
  }

  /* B. DoD：两两 ≥2 项不同 */
  /**
   * 主色差异 = 「色相角距」**或**「RGB 距离」取最大者。
   * 为什么加 RGB 兜底：**灰度主题（如水墨 zgf）色相未定义** —— 只比色相会退化成恒 0°，
   * 上一版就因此在 `zgf-ink-wash` 与 4 个主题之间误报"主色相同"（那是**指标缺陷**，不是产品问题：
   * 水墨黑白与薄荷绿肉眼差极大）。两个值都打印出来，便于人工核对而非"调测试到变绿"。
   */
  /** 逐位比对主色：body 主色（2 位）+ 每幕背景（按幕序逐位） */
  const maxColorDiff = (a, b) => {
    const pairs = []
    for (let i = 0; i < Math.min(a.primary.length, b.primary.length); i++) pairs.push([a.primary[i], b.primary[i]])
    for (let i = 0; i < Math.min(a.sceneBgs.length, b.sceneBgs.length); i++) {
      if (a.sceneBgs[i] && b.sceneBgs[i]) pairs.push([a.sceneBgs[i], b.sceneBgs[i]])
    }
    let mh = 0, mr = 0
    for (const [x, y] of pairs) {
      const hx = rgbToHue(...x), hy = rgbToHue(...y)
      if (hx !== null && hy !== null) mh = Math.max(mh, hueDist(hx, hy))
      mr = Math.max(mr, Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]))
    }
    return { hue: Math.round(mh), rgb: Math.round(mr), n: pairs.length }
  }
  const dColor = ({ hue, rgb }) => hue >= 25 || rgb >= 60
  const pairs = []
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const a = metrics[i].m, b = metrics[j].m
      const cd = maxColorDiff(a, b)
      const dColorDiff = dColor(cd)
      const dSkel = a.skeleton !== b.skeleton
      const dStruct = a.structure !== b.structure
      const dims = [dColorDiff, dSkel, dStruct].filter(Boolean).length
      pairs.push({ a: metrics[i].want, b: metrics[j].want, dColor: dColorDiff, dSkel, dStruct, dims, hue: cd.hue, rgb: cd.rgb })
    }
  }
  const distinguishable = pairs.filter(x => x.dims >= 2)
  console.log('   两两矩阵（C=主色[色相≥25° 或 RGB距离≥60] / S=骨架 / T=结构）:')
  for (const x of pairs) console.log(`     ${x.a.padEnd(18)} vs ${x.b.padEnd(18)} C=${x.dColor ? '✔' : '✘'}(${x.hue}°/${x.rgb}) S=${x.dSkel ? '✔' : '✘'} T=${x.dStruct ? '✔' : '✘'} → ${x.dims} 项`)

  if (MUTATE) {
    /* 变异模式：注入了"主题参数无效"缺陷 → 本套件必须**判红**（即可区分对数 = 0） */
    must(distinguishable.length === 0,
      '【变异测试】注入"6 个课件同主题"缺陷后，本套件**确实变红**（可区分对数 = 0 → 证明断言不是恒真）',
      { distinguishable: distinguishable.length, pairs: pairs.length })
  } else {
    must(distinguishable.length === pairs.length,
      `DoD：6 个主题**两两之间 ≥2 项不同**（共 ${pairs.length} 对）`,
      { ok: distinguishable.length, total: pairs.length, failed: pairs.filter(x => x.dims < 2).map(x => `${x.a}|${x.b}:${x.dims}`) })
  }

  /* C. 负控：同一主题的两次独立渲染 → 三项全同（证明指标能判"同"） */
  if (!MUTATE) {
    const twice = await measure(created[0].id)
    const a = metrics[0].m
    const ctrl = twice ? maxColorDiff(a, twice) : null
    // 注意：负控必须**同主题**才成立 —— 若第二次渲染的 data-theme 变了，那是"主题回落"缺陷（不是指标问题），要单独暴露
    must(!!twice && twice.themeReached === created[0].theme,
      '【负控前置】同一课件两次渲染的 body[data-theme] 一致（若不一致 = 主题间歇回落，属缺陷）',
      { want: created[0].theme, first: a.themeReached, second: twice && twice.themeReached })
    must(!!twice && twice.skeleton === a.skeleton && twice.structure === a.structure && ctrl.hue === 0 && ctrl.rgb === 0,
      '【负控】同主题渲染两次 → 三项指标全同（指标能判"同"，非恒真）',
      { color: ctrl, skelSame: twice && twice.skeleton === a.skeleton, structSame: twice && twice.structure === a.structure })
  }

  must(errs.length === 0, '全程 pageerror=0', { errs })
  report()
})().catch(e => {
  console.error('✘ 脚本异常：' + e.message)
  process.exitCode = 2
}).finally(async () => {
  try { await br?.close() } catch { /* noop */ }
  const { H } = await session() // 收尾单独取会话：主流程若中途抛错也要能清理
  const out = []
  for (const c of created) out.push({ name: THEMES[c.i], status: (await fetch(`${B}/api/materials/${c.id}`, { method: 'DELETE', headers: H })).status })
  console.log('   [cleanup] ' + JSON.stringify(out))
})
