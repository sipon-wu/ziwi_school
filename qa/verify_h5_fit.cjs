/**
 * H5「整页适配舞台」（HD 档下内容高于可用高度 → 等比缩放，缩放后**整页可见、无滚动**）—— 2026-09-29 立
 *
 * 为什么补这条：清退存量守卫时 `verify_h5_fit` 退役，而**"整页适配"这块没有登记守卫**
 * （见 `qa/RETIRED.md` 缺口清单）。这是教师原话"画布没适应 HD"的正面：投屏/HD 档下内容超屏若不适配，
 * 页面就会被裁掉或需要滚动 —— 课堂上直接看不见内容，但**页面不报错**，所以必须用测量守。
 *
 * 做法（沿用退役脚本的正确测量法，避开了它踩过的坑）：
 *   用**同一渲染器**（`courseware-h5/index.ts`）把 markdown 渲成本地 HTML → 在**画布窗格尺寸**的视口里
 *   用 `?hd=1` **强开 HD** → 逐页翻，量 `avail = scene.clientHeight - 上下 padding` 与
 *   `innerH = .scene-inner` 的 **渲染高（transform 后 rect）**。
 *   ⚠ 关键：判"整页是否可见"必须看**渲染后 rect**，不能看 `scrollHeight`
 *     （transform 不改布局，scrollHeight 恒为未缩放高度 → 看它永远"溢出"，是**测量口径错**）。
 *
 * 判据：
 *   ① `?hd=1` 真的进了 HD 档（`body.hd`）且舞台是 16:9；
 *   ② **逐页** `innerH <= avail`（缩放后整页可见、无滚动）；
 *   ③ **前置**：至少有一页**确实触发了等比适配**（`.fit`）—— 否则"都放得下"说明这个视口/内容
 *      压根压不出溢出，本判据就成了**真空通过**，此时按 M7 记 **未验证**（skip ≠ pass）；
 *   ④ 全程 pageerror = 0。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时**真改被测源码**（临时副本 `renderer.ts`：把 `fitToStage` 里
 *   的 `transform: scale(k)` 去掉＝取消等比适配）→ ②③ 必须变红。跑完删临时件，本体不动。
 *
 * 用法：`node qa/verify_h5_fit.cjs`（约 15s：一次打包 + 一次真浏览器）
 *       `MUTATE=1 node qa/verify_h5_fit.cjs`
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')

const FE = path.join(__dirname, '..', 'code', 'frontend')
const B_IDX = '/tmp/qaH5Fit.cjs'
const B_MUT = '/tmp/qaMutH5Fit.cjs'
const HTML = '/tmp/qa_h5_fit.html'
const MUTATE = process.env.MUTATE === '1'

const bundle = (entry, out) => execFileSync('npx',
  ['esbuild', entry, '--bundle', '--format=cjs', '--platform=node',
    '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
    '--define:import.meta.env={}', `--outfile=${out}`, '--log-level=error'],
  { cwd: FE, stdio: 'inherit' })

/** 夹具：4 个场景，其中「长页」故意堆到远超一屏（用于触发等比适配）
 *  ⚠ 首版只堆 14 行 → 实测内容渲染高 274px < 可用 475px，**压不出溢出** → 守卫按 M7 记了"未验证"（对，不是错），
 *    但那样这条判据就没被真正检验过。现加到 32 行、句子也更长，确保 HD 档下必然超过可用高度。 */
const LONG = Array.from({ length: 32 }, (_, i) => `- 长页要点第${i + 1}条：这一行文字用来把整页内容顶到明显超出可用高度，好让等比适配真正被触发。`)
const MD = [
  '# 整页适配自检',
  '> 学科: 语文',
  '> 年级: 四年级',
  '',
  '## 场景一 短页',
  '短内容一行。',
  '',
  '## 场景二 长页',
  ...LONG,
  '',
  '## 场景三 中等',
  '- 甲',
  '- 乙',
  '- 丙',
  '',
  '## 场景四 短页二',
  '再来一行。',
  '',
].join('\n')

let br
;(async () => {
  bundle('src/lib/courseware-h5/index.ts', B_IDX)
  const H5 = require(B_IDX)
  const html = H5.markdownToStorybookH5(MD, { subject: '语文', grade: '四年级', teacherName: '李老师' })
  fs.writeFileSync(HTML, html)
  must(html.length > 3000 && /scene-inner/.test(html) && /fitToStage/.test(html),
    '同一渲染器渲出本地 HTML（含 `.scene-inner` 与适配逻辑）', { len: html.length })

  br = await chromium.launch()
  // 视口＝画布窗格尺寸（退役脚本实测的形态：窄而矮，才能压出"内容超过可用高度"）
  const p = await br.newPage({ viewport: { width: 900, height: 520 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto(`file://${HTML}?hd=1`, { waitUntil: 'load' })
  await p.waitForTimeout(1200)

  /* ① HD 档 + 舞台比例 */
  const st = await p.evaluate(() => {
    const r = document.querySelector('.story-root').getBoundingClientRect()
    return { hd: document.body.classList.contains('hd'), w: Math.round(r.width), h: Math.round(r.height), ratio: +(r.width / r.height).toFixed(3) }
  })
  must(st.hd === true, '① `?hd=1` 真的进入 HD 档（`body.hd`）', { hd: st.hd })
  must(Math.abs(st.ratio - 1.778) <= 0.03, '① 舞台是 16:9（1280×720 逻辑舞台）', { stage: `${st.w}×${st.h}`, ratio: st.ratio })

  /* ② 逐页测量 */
  const total = await p.evaluate(() => document.querySelectorAll('.scene').length)
  must(total >= 3, '夹具渲出多页（可逐页测）', { scenes: total })
  const rows = []
  for (let i = 0; i < total; i++) {
    if (i > 0) {
      await p.evaluate(() => document.querySelector('.nav-bar .next')?.click())
      await p.waitForTimeout(700)
    }
    rows.push(await p.evaluate(() => {
      const sc = document.querySelector('.scene.active')
      if (!sc) return { title: '(无 active 场景)', fits: false, fit: false, avail: 0, innerH: 0 }
      const inner = sc.querySelector('.scene-inner')
      const cs = getComputedStyle(sc)
      const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
      const avail = sc.clientHeight - pad
      // ⚠ 量的是**渲染后** rect（含 transform 缩放），不是 scrollHeight —— 见文件头说明
      const innerH = inner ? inner.getBoundingClientRect().height : 0
      return {
        title: (sc.querySelector('.scene-title') || {}).innerText || '(无标题)',
        avail: Math.round(avail), innerH: Math.round(innerH),
        fit: sc.classList.contains('fit'), fits: innerH <= avail + 2,
      }
    }))
    const r = rows[rows.length - 1]
    console.log(`   P${i + 1} ${String(r.title).slice(0, 12).padEnd(14)} 可用=${r.avail} 内容渲染高=${r.innerH} ${r.fit ? '已等比适配' : '本就不超'} 整页可见=${r.fits}`)
  }
  const bad = rows.filter(r => !r.fits)
  must(bad.length === 0,
    '② **逐页整页可见**：缩放后内容渲染高 ≤ 可用高（无裁切、无需滚动）',
    { bad: bad.map(r => `${r.title}(可用${r.avail}/内容${r.innerH})`) })

  /* ③ 前置：必须真的触发过一次等比适配，否则本判据是真空的 */
  const fitted = rows.filter(r => r.fit)
  if (fitted.length === 0) {
    console.log('   [SKIP] 前置不成立：这个视口/内容下**没有任何页触发等比适配** → "整页可见"判据属**未验证**（skip ≠ pass）')
    console.log('          （要让它有意义就得压出溢出：加长内容或缩小视口，二者都属夹具问题，不是产品缺陷）')
    must(errs.length === 0, '④ 全程 pageerror = 0', { errs })
    report()
    process.exit(2)
  }
  must(fitted.length > 0,
    `③ 前置成立：有 ${fitted.length} 页**确实超过可用高度、靠等比缩放才放下**（否则本判据真空）`,
    { fitted: fitted.map(r => r.title) })
  must(errs.length === 0, '④ 全程 pageerror = 0', { errs })

  /* ── 变异（强形态）：真改被测源码把等比缩放去掉 → ②③ 必须红 ── */
  if (MUTATE) {
    const srcPath = path.join(FE, 'src/lib/courseware-h5/renderer.ts')
    const mutPath = path.join(FE, 'src/lib/courseware-h5/__qa_mut_fit.ts')
    const orig = fs.readFileSync(srcPath, 'utf8')
    /* ⚠ 注入点选择有讲究（首版踩到）：只删 `transform: scale(k)` 那一行**不算"取消适配"** ——
     *   后面那句 `inner.style.width = 'calc(100% / k)'`（宽度补偿）还在，会把文字重排得更矮，
     *   结果页面反而"不溢出了"，变异自检因此**红不了**（看着像守卫无效，其实是注入不忠实）。
     *   正确注入：让 `fitToStage` **整体提前 return**（等于彻底关掉等比适配）。 */
    const TARGET = 'if (!document.body.classList.contains(\'hd\') || need <= avail + 1) return;'
    const patched = orig.replace(TARGET, 'if (true) return;')
    try {
      must(patched !== orig && /if \(true\) return;/.test(patched),
        '【变异测试·前置】源码注入点匹配成功（`fitToStage` 的适配门槛行）', {})
      fs.writeFileSync(mutPath, patched)
      bundle('src/lib/courseware-h5/__qa_mut_fit.ts', B_MUT)
      const M = require(B_MUT)
      // ⚠ 变异包是 **renderer.ts**（只有 buildStoryH5），没有 index 的 markdownToStorybookH5
      //   → 用原 bundle 的 mdToStory 产出 story，再交给变异版渲染（story 是纯数据，跨 bundle 无副作用）
      const mutHtml = M.buildStoryH5(H5.mdToStory(MD, { subject: '语文', grade: '四年级' }))
      fs.writeFileSync(HTML.replace('.html', '_mut.html'), mutHtml)
      const p2 = await br.newPage({ viewport: { width: 900, height: 520 } })
      await p2.goto(`file://${HTML.replace('.html', '_mut.html')}?hd=1`, { waitUntil: 'load' })
      await p2.waitForTimeout(1200)
      const t2 = await p2.evaluate(() => document.querySelectorAll('.scene').length)
      let anyOverflow = false, anyFit = false
      for (let i = 0; i < t2; i++) {
        if (i > 0) { await p2.evaluate(() => document.querySelector('.nav-bar .next')?.click()); await p2.waitForTimeout(600) }
        const m = await p2.evaluate(() => {
          const sc = document.querySelector('.scene.active')
          if (!sc) return { fits: true, fit: false }
          const cs = getComputedStyle(sc)
          const avail = sc.clientHeight - ((parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0))
          const innerH = sc.querySelector('.scene-inner')?.getBoundingClientRect().height || 0
          return { fits: innerH <= avail + 2, fit: sc.classList.contains('fit') }
        })
        if (!m.fits) anyOverflow = true
        if (m.fit) anyFit = true
      }
      must(anyOverflow,
        '【变异测试·真注入】把 `fitToStage` 的等比缩放去掉后 → **出现"内容超过可用高度仍不缩放"的页** ⇒ ② 判据**必须能抓到**（这正是"画布没适应 HD"的形态）', { anyOverflow })
      must(!anyFit,
        '【变异测试·真注入】同一变异下**没有任何页带 `.fit`** ⇒ ③ 的"前置"也能抓到（说明前置不是在凑数）', { anyFit })
      await p2.close()
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
  for (const f of [B_IDX, B_MUT, HTML, HTML.replace('.html', '_mut.html')]) { try { fs.rmSync(f, { force: true }) } catch { /* noop */ } }
})
