/**
 * H5 绘本课件的互动组件（8 类渲染 / **XSS 转义** / 真浏览器不执行 / 向后兼容）—— 2026-09-29 立
 *
 * 为什么补这条：清退存量守卫时 `verify_h5_interactive`（7 组件 + XSS + 横屏 + 向后兼容）退役，
 * 而**"H5 互动组件"这块没有登记守卫**（见 `qa/RETIRED.md` 缺口清单）。H5 会被**投屏/扫码**打开、
 * 内容含 AI 生成文本与用户填的 URL → **XSS 是真实对外面**；组件挂不上则是"学生看不到互动"。
 *
 * 被测对象（**同一份产物链路**，非另写一份逻辑）：`src/lib/courseware-h5/index.ts`
 *   `mdToStory(md)`（注释语法 → Story）→ `buildStoryH5(story)`（自包含 HTML，落库就是 `materials.h5_html`）。
 *
 * 判据：
 *   ① **8 类组件都渲染出各自的标记**（点读 / 跟读 / 选择 / 揭示 / 绘图 / 音频 / 视频 / 弹层）——
 *      逐个列出缺失项，不写"≥N 类"这种模糊话；
 *   ② **静态转义**：标题/正文/答案/URL 里塞的 `<script>`、`onerror=` **不得**以裸形式出现在 HTML 里，
 *      且必须能看到转义实体（`&lt;script&gt;`）；
 *   ③ **真浏览器不执行**：把生成的 HTML 丢进真浏览器 → 注入的 `window.__xss` **必须没被置位**、pageerror=0，
 *      且互动组件在真 DOM 里存在（不只是字符串里有）；
 *   ④ **向后兼容**：未知互动类型 / 残缺 quiz（`quiz:null`）→ **不抛错、也不渲染**（老课件不炸、不冒脏组件）；
 *   ⑤ 产物含 **HD 舞台/固定比例**运行时代码（与落库的 `h5_html` 同源，交叉印证）。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时**真改被测源码**（临时副本 `renderer.ts`：把 `esc()` 改成恒等）
 *   → ②③ 必须变红（**安全类判据**，最值得守）。跑完删除临时件，被测源码本体不动。
 *
 * 用法：`node qa/verify_h5_interactive.cjs`（约 15s：一次打包 + 一次真浏览器）
 *       `MUTATE=1 node qa/verify_h5_interactive.cjs`
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')

const FE = path.join(__dirname, '..', 'code', 'frontend')
const B_IDX = '/tmp/qaH5Index.cjs'
const B_MUT = '/tmp/qaMutH5Index.cjs'
const MUTATE = process.env.MUTATE === '1'

const bundle = (entry, out) => execFileSync('npx',
  ['esbuild', entry, '--bundle', '--format=cjs', '--platform=node',
    '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
    '--define:import.meta.env={}', `--outfile=${out}`, '--log-level=error'],
  { cwd: FE, stdio: 'inherit' })

/** 注入用的 XSS 载荷（分别落在：问答题干 / 揭示答案 / 绘图标题 / 音频 URL / 弹层内容 / 场景标题） */
const XSS = {
  script: '<script>window.__xss=1</script>',
  imgErr: '<img src=x onerror="window.__xss=2">',
  attr: '" onerror="window.__xss=3',
}
const MD = [
  '# H5组件自检',
  '> 学科: 语文',
  '> 年级: 四年级',
  '',
  '## 场景一 点读',
  '<!-- read: apple | 苹果 -->',
  '',
  '## 场景二 跟读',
  '<!-- readalong: I like apples. -->',
  '',
  `## 场景三 选择 ${XSS.script}`,
  `<!-- quiz: 题干 ${XSS.script} | 甲 | 乙 | 0 -->`,
  '',
  '## 场景四 揭示',
  `<!-- reveal: 点我揭晓 => 答案 ${XSS.imgErr} -->`,
  '',
  '## 场景五 绘图',
  `<!-- draw: 画个太阳 ${XSS.script} -->`,
  '',
  '## 场景六 音频',
  `<!-- audio: https://x/a.mp3${XSS.attr} -->`,
  '',
  '## 场景七 视频',
  '<!-- video: https://x/v.mp4 -->',
  '',
  '## 场景八 弹层',
  `<!-- popup: 了解更多 => 弹层内容 ${XSS.script} -->`,
  '',
].join('\n')

/** 期望组件标记（逐类列缺，不写模糊话） */
const EXPECT = [
  ['点读 read', ['interact read-zone', 'read-word']],
  ['跟读 readalong', ['readalong-zone', 'readalong-item']],
  ['选择 quiz', ['quiz-zone', 'quiz-opt']],
  ['揭示 reveal', ['reveal-zone', 'reveal-btn']],
  ['绘图 draw', ['draw-zone', 'draw-canvas']],
  ['音频 audio', ['<audio controls']],
  ['视频 video', ['<video controls']],
  ['弹层 popup', ['popup-trigger']],
]

let br
;(async () => {
  bundle('src/lib/courseware-h5/index.ts', B_IDX)
  const H5 = require(B_IDX)
  must(typeof H5.mdToStory === 'function' && typeof H5.buildStoryH5 === 'function',
    '打包成功：H5 产物链路（mdToStory → buildStoryH5）可用', { keys: Object.keys(H5).length })

  const story = H5.mdToStory(MD, { subject: '语文', grade: '四年级', teacherName: '李老师' })
  const html = H5.buildStoryH5(story)
  must(html.length > 3000, '产物是自包含 H5（一份 HTML 字符串）', { len: html.length })

  /* ① 8 类组件标记齐全 */
  const missing = []
  for (const [name, marks] of EXPECT) {
    for (const mk of marks) if (!html.includes(mk)) missing.push(`${name} → 缺 ${mk}`)
  }
  must(missing.length === 0, `① 8 类互动组件都渲染出各自标记（共 ${EXPECT.length} 类）`, { missing })

  /* ② 静态转义：不得出现裸脚本/裸事件处理器，且必须见转义实体
     ⚠ 正则要写准（首版踩到）：`/\sonerror=/` 会把**已转义的** `onerror=&quot;…` 也算成裸的 →
     必须要求引号**未被转义**（`onerror="`），才代表真的成了属性。 */
  const rawScript = /<script>window\.__xss/.test(html)
  const rawHandler = /\sonerror="/.test(html)
  must(!rawScript && !rawHandler,
    '② **静态转义**：`<script>` / 裸 `onerror="` 不得出现在产物里（H5 会被投屏/扫码打开，这是对外面）',
    { rawScript, rawHandler })
  must(html.includes('&lt;script&gt;'),
    '② 能看到转义实体（`&lt;script&gt;`）→ 说明是"被转义"，不是"整段被丢掉"', {})

  /* ③ 真浏览器：不执行 + 组件在真 DOM 里 */
  br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.setContent(html, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  const dom = await p.evaluate(() => ({
    xss: window.__xss === undefined ? null : window.__xss,
    quiz: document.querySelectorAll('.quiz-zone').length,
    reveal: document.querySelectorAll('.reveal-btn').length,
    read: document.querySelectorAll('.read-word').length,
    audio: document.querySelectorAll('audio').length,
    video: document.querySelectorAll('video').length,
  }))
  must(dom.xss === null,
    '③ **真浏览器不执行**：注入的 `window.__xss` 没被置位（转义真的生效，不是只在字符串里看着像）', { xss: dom.xss })
  must(dom.quiz >= 1 && dom.reveal >= 1 && dom.read >= 1 && dom.audio >= 1 && dom.video >= 1,
    '③ 互动组件在**真 DOM** 里存在（选择/揭示/点读/音频/视频）', { dom })
  must(errs.length === 0, '③ 全程 pageerror = 0', { errs })

  /* ④ 向后兼容：未知类型 / 残缺 quiz 不抛错、不渲染 */
  const base = story.scenes[0]
  const weird = { ...story, scenes: [...story.scenes,
    { ...base, title: '未知类型', interaction: { type: 'ghost-type' } },
    { ...base, title: '残缺 quiz', interaction: { type: 'quiz', quiz: null } },
  ] }
  let weirdHtml = null, threw = null
  try { weirdHtml = H5.buildStoryH5(weird) } catch (e) { threw = e.message }
  must(!threw && typeof weirdHtml === 'string' && weirdHtml.length > 3000,
    '④ **向后兼容**：未知互动类型 / 残缺 quiz（`quiz:null`）不抛错、照常出产物', { threw })
  must(!/ghost-type/.test(weirdHtml || ''),
    '④ 未知类型**不冒脏组件**（不把 type 原样写进产物）', { leaked: /ghost-type/.test(weirdHtml || '') })

  /* ⑤ 与落库 h5_html 同源：HD 舞台 + 固定比例 */
  must(/1280|720/.test(html) && /scale|aspect-ratio|transform/i.test(html),
    '⑤ 产物含 **HD 舞台（1280×720）与固定比例**运行时代码（与库里 `h5_html` 同源，交叉印证）', {})

  /* ── 变异（强形态）：真改被测源码把 esc() 置为恒等 → ②③ 必须红 ── */
  if (MUTATE) {
    const srcPath = path.join(FE, 'src/lib/courseware-h5/renderer.ts')
    const mutPath = path.join(FE, 'src/lib/courseware-h5/__qa_mut_renderer.ts')
    const orig = fs.readFileSync(srcPath, 'utf8')
    const TARGET = "return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;')"
    const patched = orig.replace(TARGET, "return (s || '')")
    try {
      must(patched !== orig, '【变异测试·前置】源码注入点匹配成功（esc 的实现行）', {})
      fs.writeFileSync(mutPath, patched)
      // 临时副本替换 index.ts 的 renderer 引用不可行 → 直接打包**变异后的 renderer** + 原 mdToStory
      const bMutRenderer = '/tmp/qaMutH5Renderer.cjs'
      bundle('src/lib/courseware-h5/__qa_mut_renderer.ts', bMutRenderer)
      const MR = require(bMutRenderer)
      const mutHtml = MR.buildStoryH5(story)
      must(/<script>window\.__xss/.test(mutHtml) || /\sonerror="/.test(mutHtml),
        '【变异测试·真注入】把 `esc()` 改成恒等（等于不转义）后重打包 → 产物里**出现裸脚本/裸事件处理器** → ② 判据**必须能抓到**',
        { rawScript: /<script>window\.__xss/.test(mutHtml), rawHandler: /\sonerror="/.test(mutHtml) })
      const p2 = await br.newPage({ viewport: { width: 1440, height: 900 } })
      await p2.setContent(mutHtml, { waitUntil: 'domcontentloaded' })
      await p2.waitForTimeout(1200)
      const xss = await p2.evaluate(() => (window.__xss === undefined ? null : window.__xss))
      must(xss !== null,
        '【变异测试·真注入】同一份产物在**真浏览器里确实执行了注入脚本**（`window.__xss` 被置位）→ ③ 判据**必须能抓到**',
        { xss })
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
  for (const f of [B_IDX, B_MUT]) { try { fs.rmSync(f, { force: true }) } catch { /* noop */ } }
})
