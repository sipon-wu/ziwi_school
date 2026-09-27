// 课件风格多样化 E2E 专项验证（真浏览器）
// 目的：
//   A) H5 课件「宽/窄视图自适应」——在 1440(投屏) / 768(平板) / 390(手机) 三档宽度下
//      测量 .story-root 与 .scene 的实际尺寸、内边距、字号与是否横向溢出。
//   B) PPT 课件「版式多样性」——逐页抓取页面结构签名，统计一份课件里出现了几种不同版式。
// 用法：BASE=http://school1.ziwi.cn node qa/verify_style_diversity.cjs
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const SHOT_DIR = process.env.SHOT_DIR || path.join(__dirname, 'shots_style_diversity')

const H5_SAMPLES = (process.env.H5_IDS || '').split(',').filter(Boolean)
const PPT_SAMPLES = (process.env.PPT_IDS || '').split(',').filter(Boolean)

const results = []
let skipped = 0 // 三态：SKIP（未验证）—— 既不算 PASS 也不算 FAIL（M7：skip ≠ pass）
const rec = (id, ok, detail) => {
  results.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`)
}

;(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(e.message))

  // ── 登录（Node 侧取 token 注入，避开脆弱的 UI 表单）──
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const j = await r.json()
  const token = j.token || (j.data && j.data.token)
  if (!token) { console.log('LOGIN_FAIL', JSON.stringify(j)); process.exit(1) }

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), token)

  // ── 样本自寻（2026-09-27 整改假绿）────────────────────────────────────
  // 此前样本只来自 `H5_IDS`/`PPT_IDS` 环境变量，**默认空** → 两个 for 循环都不执行 →
  // results 为空 → 汇总打印 "0 PASS / 0 FAIL" 并 `process.exit(0)`：**没跑任何断言却报绿**。
  // 这正是《0911》§5.2 M7 点名的"静默跳过当通过"。现改为：环境变量没给就**自己从库里找**；
  // 真的找不到样本 → 显式 SKIP 且退出码 2（**skip ≠ pass**）。
  const discover = async (kind) => {
    try {
      const r = await fetch(`${BASE}/api/materials`, { headers: { Authorization: 'Bearer ' + token } })
      const j = await r.json()
      const items = Array.isArray(j) ? j : (j.items || [])
      return items.filter(m => (m.format || '') === kind && m.id).slice(0, 2).map(m => m.id)
    } catch { return [] }
  }
  if (!H5_SAMPLES.length) H5_SAMPLES.push(...await discover('h5'))
  if (!PPT_SAMPLES.length) PPT_SAMPLES.push(...await discover('ppt'))
  console.log(`   [samples] H5=${H5_SAMPLES.length} 个 / PPT=${PPT_SAMPLES.length} 个（环境变量未给则从库内自寻）`)
  if (!H5_SAMPLES.length) console.log('   [SKIP] H5 段**未验证**（库内无 h5 课件样本；不计入通过）')
  if (!PPT_SAMPLES.length) console.log('   [SKIP] PPT 段**未验证**（库内无 ppt 课件样本；不计入通过）')

  // ══════════ A) H5 宽窄自适应【本段已废弃 · 见下方说明】══════════
  // ⚠ 2026-09-27 纠正：本段**测量方法错了**，曾据此误报"产品三档无自适应"。
  //   它直接开 `/courseware/h5/:id` —— 那是**编辑器页**，H5 只是嵌在编辑器画布 `iframe(srcDoc=播放器HTML)`
  //   里，且编辑器会 postMessage 强制开 HD 舞台；外层 setViewportSize 动不到 iframe 内宽
  //   （实测 958 → 286 → 390 时塌成 0）→ "三档 padding 完全相同""scene/文档宽比=0.000"两组数字都不可信。
  // H5 舞台口径（HD 固定 1280×720 等比 / 手机档撤舞台自适应）已由 `qa/verify_h5_stage.cjs`
  //   用**正确方法**覆盖（取播放器 HTML 独立渲染三档，29 断言）。此处整段跳过、计入 SKIP（未验证），
  //   不再对 H5 下任何断言。原实现（129 行）已删除（2026-09-27 当日清理）。
  for (const id of H5_SAMPLES) {
    skipped++
    console.log(`   [SKIP] H5-${id.slice(0, 8)} **未验证**（本段测量方法已废弃 → 改由 qa/verify_h5_stage.cjs 覆盖）`)
  }

  // ══════════ B) PPT 版式多样性 ══════════
  for (const id of PPT_SAMPLES) {
    await page.goto(`${BASE}/courseware/ppt/${id}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    if (page.url().includes('/login')) { rec(`PPT-${id.slice(0, 8)}-ENTER`, false, '被重定向到登录页'); continue }

    // 逐页采集「结构签名」：页面内元素的类名集合（忽略具体内容差异）
    const signatures = []
    const MAXPAGES = 20
    for (let i = 0; i < MAXPAGES; i++) {
      const sig = await page.evaluate(() => {
        // 预览画布：优先取含 data-layout / 幻灯片容器
        const cands = Array.from(document.querySelectorAll('[data-layout], .slide, .ppt-slide, [class*="slide"]'))
        if (!cands.length) return null
        const el = cands.find(e => e.getBoundingClientRect().width > 100) || cands[0]
        const cls = (el.className || '').toString()
        const layout = el.getAttribute('data-layout') || (cls.match(/layout-[\w-]+/i) || [null])[0] || null
        // 内部块结构：直接子元素的类名序列
        const kids = Array.from(el.children).map(c => (c.className || '').toString().split(' ')[0]).filter(Boolean)
        return { layout, cls: cls.slice(0, 120), kids: kids.slice(0, 8).join('>') }
      })
      if (!sig) break
      signatures.push(sig)
      await page.screenshot({ path: path.join(SHOT_DIR, `ppt_${id.slice(0, 8)}_p${i}.png`) })
      // 下一页
      const next = page.locator('button:has-text("下一页")').first()
      if (await next.count() === 0 || !(await next.isVisible().catch(() => false))) break
      const disabled = await next.isDisabled().catch(() => true)
      if (disabled) break
      await next.click().catch(() => {})
      await page.waitForTimeout(450)
    }

    if (!signatures.length) {
      // 采集不到页 = **守卫自身**（选择器/进入预览的方式）过期，不是被测对象的缺陷 →
      // 按 M7 三态记 **SKIP（未验证）**，既不谎报 PASS，也不冤枉产品为 FAIL。
      // ⚠ P2 存量：本段的 `[data-layout]/.slide/...` 选择器需随新版 PPT 预览标记更新。
      skipped++
      console.log(`   [SKIP] PPT-${id.slice(0, 8)}-PAGES **未验证**：未采集到幻灯片页（选择器待更新）`)
      continue
    }
    const uniq = new Set(signatures.map(s => `${s.layout || '?'} | ${s.kids}`))
    const layouts = signatures.map(s => s.layout).filter(Boolean)
    const uniqLayouts = [...new Set(layouts)]
    console.log(`\n  [PPT ${id.slice(0, 8)}] 共 ${signatures.length} 页，版式标注：${uniqLayouts.join(', ') || '(无 data-layout 属性)'}`)
    console.log(`  去重后结构签名 ${uniq.size} 种：`)
    for (const u of uniq) console.log(`    - ${u}`)
    rec(`PPT-${id.slice(0, 8)}-LAYOUT_DIVERSITY`, uniq.size >= 3,
      `${signatures.length} 页中出现 ${uniq.size} 种不同版式结构（阈值≥3 视为多样化）`)
  }

  await browser.close()

  const fail = results.filter(r => !r.ok)
  console.log(`\n==== 汇总: ${results.length - fail.length} PASS / ${fail.length} FAIL / ${skipped} SKIP（未验证） / 共 ${results.length + skipped} ====`)
  console.log(`截图目录: ${SHOT_DIR}`)
  if (pageErrors.length) console.log(`页面异常 ${pageErrors.length} 条: ${pageErrors.slice(0, 3).join(' | ')}`)
  // 断言下限（2026-09-27，M7「skip = fail」）：**没有任何断言**绝不能算通过。
  // 历史行为：样本为空 → 打印 "0 PASS / 0 FAIL" → exit 0（假绿，CI 与 runner 都看不出来）。
  if (results.length === 0) {
    console.log('==== SKIP（未验证）：本套件**未执行任何断言** → 退出码 2（不当作通过）====')
    process.exit(2)
  }
  process.exit(fail.length ? 1 : 0)
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(2) })
