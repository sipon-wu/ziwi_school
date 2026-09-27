/**
 * H5 舞台口径守卫：**HD 等比档** vs **手机档**（2026-09-27 立）
 *
 * 口径出处（不靠猜，全在代码里）：`code/frontend/src/lib/courseware-h5/renderer.ts`
 *   · **HD 档**（视口宽 ≥1024 且高 ≥576，或 `?hd=1`，或父窗口 postMessage `cw-h5-hd`）：
 *     `.story-root` 是**固定 1280×720 逻辑舞台**，`transform:scale(var(--hd-s))`，
 *     `--hd-s = min(innerWidth/1280, innerHeight/720)`。
 *     设计目的（`:939`）：课堂投屏"不再忽高忽低"、与编辑器画布同一比例。
 *     → 因此**padding / 字号不随宽度变化是设计如此**，不是缺陷。
 *   · **手机档**（<1024）：`body.hd` 缺席，`.story-root` 回到 `width:100%;max-width:960px` 自适应阅读。
 *
 * ⚠ 上一版（`verify_style_diversity.cjs` 的 H5 段）**测量方法错了**，据此误报过"产品无自适应"：
 *   它直接开 `/courseware/h5/:id` —— 那是**编辑器页**，H5 只是嵌在编辑器画布 `iframe(srcDoc=播放器HTML)`
 *   里，且编辑器 `postMessage` **强制开 HD**。于是外层 `setViewportSize` 动不到 iframe 内宽
 *   （实测 iframe 内宽 958 → 286 → 0，390 时塌成 0）——两组数字（"三档差异""padding 恒定"）都不可信。
 *
 * 本守卫的正确做法：**把播放器 HTML 取出来，用 `setContent` 在三个视口各自独立渲染**（验的是播放器本身）。
 *
 * 断言：
 *   ① 能取到播放器 HTML（取不到 → SKIP：未验证，退出码 2）
 *   ② HD 档（1440×900）：`body.hd` 在场；舞台逻辑宽 1280；`scale ≈ min(vw/1280, vh/720)`；**无横向溢出**
 *   ③ 手机档（768×900 / 390×844）：`body.hd` **缺席**（撤舞台）；根宽 ≤ 视口 +2；**场景宽 > 0（不许被压塌）**；无横向溢出
 *   ④ 档位切换在 1024 附近真实发生（三档 hd 标志应为 true/false/false）—— 这就是"宽窄自适应"的策略性证据
 *
 * 用法：BASE=http://school1.ziwi.cn node qa/verify_h5_stage.cjs
 */
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
// [宽, 高]：1440×900 属 HD 档；768×900 与 390×844 都 <1024 → 手机档
const TIERS = [[1440, 900], [768, 900], [390, 844]]
/** `MUTATE=1`：变异模式——**改被测对象**（剥掉 `syncHd()`）而不是改期望值，验证判据真的在看 `body.hd` */
const MUTATE = process.env.MUTATE === '1'

/** 从编辑器画布里取出**播放器 HTML**（srcDoc 的 outerHTML；same-origin iframe 可直读） */
async function extractPlayerHtml(page) {
  const grab = () => page.evaluate(() => {
    const pick = (d) => (d && d.querySelector('.story-root')) ? d : null
    if (pick(document)) return document.documentElement.outerHTML
    for (const f of document.querySelectorAll('iframe')) {
      try { if (pick(f.contentDocument)) return f.contentDocument.documentElement.outerHTML } catch { /* 跨域忽略 */ }
    }
    return null
  })
  let html = await grab()
  if (!html) {
    for (const label of ['预览', 'H5 预览', '播放']) {
      const b = page.locator(`button:has-text("${label}")`).first()
      if (await b.count() > 0 && await b.isVisible().catch(() => false)) {
        await b.click().catch(() => {})
        await page.waitForTimeout(2500)
        html = await grab()
        if (html) break
      }
    }
  }
  if (!html) return null
  // 【变异测试】注入（2026-09-27，A1b）：剥掉 `syncHd()` 调用 → 播放器不再按视口启用 HD 舞台。
  // 这**改的是被测对象**、不是期望值：判据若仍报"HD 已启用"，说明它没真的在看 body.hd。
  const withHtml = MUTATE ? html.replace(/\bsyncHd\(\)/g, 'void 0') : html
  // 编辑器会 postMessage 强制给播放器加 `class="hd"`；独立渲染时该脚本会按自身视口重算，
  // 但为免"初始类"干扰测量，这里先摘掉 hd（脚本 load 时会按真实视口再决定）。
  return withHtml.replace(/<body([^>]*?)class="([^"]*)"/, (m, pre, cls) =>
    `<body${pre}class="${cls.split(/\s+/).filter(c => c && c !== 'hd').join(' ')}"`)
}

;(async () => {
  const lg = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })).json()
  must(!!lg.token, '教师登录成功（取样本用）', { user: lg.user && lg.user.name })
  const H = { Authorization: 'Bearer ' + lg.token }

  const l = await (await fetch(`${BASE}/api/materials`, { headers: H })).json()
  const items = (Array.isArray(l) ? l : (l.items || [])).filter(m => (m.format || '') === 'h5' && m.id)
  if (!items.length) {
    console.log('   [SKIP] 库内无 h5 课件样本 → 本套件**未验证**（skip ≠ pass）')
    process.exit(2)
  }
  const samples = items.slice(0, 2)
  console.log(`   [samples] h5 课件 ${samples.length} 个`)

  const browser = await chromium.launch()
  for (const m of samples) {
    const tag = `H5-${m.id.slice(0, 8)}`
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await page.evaluate(t => localStorage.setItem('zhiwei_token', t), lg.token)
    await page.goto(`${BASE}/courseware/h5/${m.id}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    const html = await extractPlayerHtml(page)
    await page.close()

    must(!!html && html.length > 1000, `${tag} 取到播放器 HTML（编辑器画布即播放器 srcDoc）`,
      { chars: (html || '').length, name: m.name })
    if (!html) continue

    const rows = []
    for (const [vw, vh] of TIERS) {
      const p = await browser.newPage({ viewport: { width: vw, height: vh } })
      await p.setContent(html, { waitUntil: 'load' })
      await p.waitForTimeout(800)
      rows.push(await p.evaluate(() => {
        const root = document.querySelector('.story-root')
        const scene = document.querySelector('.scene.active') || document.querySelector('.scene')
        const cs = root ? getComputedStyle(root) : null
        const sc = scene ? getComputedStyle(scene) : null
        const mtx = cs && /matrix\(([-\d.]+)/.exec(cs.transform || '')
        const num = (v) => Math.round(parseFloat(v) || 0)
        const title = scene && scene.querySelector('.scene-title')
        return {
          vw: window.innerWidth, vh: window.innerHeight,
          hd: document.body.classList.contains('hd'),
          rootCssW: cs && Math.round(parseFloat(cs.width) || 0),
          rootW: root ? Math.round(root.getBoundingClientRect().width) : 0,
          scale: mtx ? Number(mtx[1]) : 1,
          sceneW: scene ? Math.round(scene.getBoundingClientRect().width) : 0,
          padL: sc ? num(sc.paddingLeft) : null,
          titleFont: title ? num(getComputedStyle(title).fontSize) : null,
          overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        }
      }))
      await p.close()
    }
    const [hd, mob768, mob390] = rows
    console.log(`   ${tag} 三档：${rows.map(r => `${r.vw}px(hd=${r.hd} scale=${r.scale.toFixed(3)} root=${r.rootW} scene=${r.sceneW}`) .join(' | ')}`)

    /* ② HD 档：固定 1280×720 逻辑舞台 + 等比缩放 + 无溢出 */
    const want = Math.min(hd.vw / 1280, hd.vh / 720)
    if (MUTATE) {
      // 注入（syncHd 被剥掉）后舞台**不得**启用 —— 反过来证明下面那组断言真的在看 body.hd。
      must(hd.hd === false, `${tag} 【变异测试】剥掉 syncHd() → HD 舞台不再启用（判据确实在读 body.hd）`, { hd: hd.hd })
    } else {
      must(hd.hd === true, `${tag} HD 档（1440×900）启用固定舞台（body.hd）`, { hd: hd.hd })
      must(hd.rootCssW === 1280, `${tag} HD 档舞台逻辑宽 = 1280（16:9 固定舞台，非按内容撑开）`, { cssW: hd.rootCssW })
      must(Math.abs(hd.scale - want) < 0.02, `${tag} HD 档等比缩放 scale ≈ min(vw/1280, vh/720)`,
        { scale: hd.scale, want: Number(want.toFixed(3)) })
      must(!hd.overflowX, `${tag} HD 档无横向溢出`, { rootW: hd.rootW, vw: hd.vw })
    }

    /* ③ 手机档：撤舞台 + 自适应宽度 + 场景不被压塌 + 无溢出 */
    for (const [i, r] of [[768, mob768], [390, mob390]]) {
      must(r.hd === false, `${tag} 手机档（${i}px）**撤掉**固定舞台（body.hd 缺席）`, { hd: r.hd })
      must(r.rootW <= r.vw + 2, `${tag} 手机档（${i}px）根宽随视口（≤ 视口+2）`, { rootW: r.rootW, vw: r.vw })
      must(r.sceneW > 0, `${tag} 手机档（${i}px）场景未被压塌（宽 > 0）`, { sceneW: r.sceneW })
      must(!r.overflowX, `${tag} 手机档（${i}px）无横向溢出`, { sceneW: r.sceneW, vw: r.vw })
    }

    /* ④ 档位切换真的发生在 1024 边界（变异模式下 1440 档被注入破坏，故跳过） */
    if (!MUTATE) {
      must(hd.hd && !mob768.hd && !mob390.hd,
        `${tag} 三档档位切换正确（1440→HD / 768、390→手机）`, { flags: rows.map(r => r.hd) })
    }
  }
  await browser.close()
  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
})
