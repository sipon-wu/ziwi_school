/**
 * 教案 Word 导出：**内容完整 + 不泄漏内部配方**（真链路 + **真改被测源码**注入）—— 2026-09-29 立
 *
 * 为什么补这条：清退存量守卫时，`verify_docx_no_model`（导出不泄漏配方）与 `verify_export_formula`
 * （公式导出）等历史脚本退役，而**"导出"这块当时没有任何登记守卫**（见 `qa/RETIRED.md` 覆盖缺口清单）。
 *
 * 背景（为什么要守）：教案 Word 会被**打印、发给家长**；`生成模型(qwen-plus)` 与"知识面来源 / 发散边界 /
 * 前置来源"同级，属**内部配方**，一旦出现在成品里就是对外泄露。这条曾经真的漏过（2026-09-15 修复）。
 *
 * 判据（真打包导出器的真实产物，不读码推断）：
 *   ① 导出成功且字节数正常；
 *   ② **正文真的进了 docx**（我们传入的唯一标记出现在 document.xml 文本里）；
 *   ③ **公式以图片资源嵌入**（zip 里有 `word/media/*.png` —— 纯文本降级不算通过）；
 *   ④ **不泄漏内部配方**：即便把 `model: 'qwen-plus'` 传进去，成品可见文本里**不得**出现
 *      `生成模型 / qwen / 发散边界 / 前置来源 / 知识面来源`。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时**真改被测源码**（把"生成模型"重新写回标题行）→ 复制成
 *   `__qa_mut_exportDocx.ts` 重新打包 → ④ 那条判据**必须能抓到泄漏**（证明它不是恒真，也证明
 *   "干净版不含"不是因为整段文本压根没被写入 docx）。跑完删除临时件，被测源码本体一行不动。
 *
 * 用法：`node qa/verify_export_no_leak.cjs`（约 30s：一次 esbuild + 一次真浏览器导出）
 *       `MUTATE=1 node qa/verify_export_no_leak.cjs`
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const FE = path.join(__dirname, '..', 'code', 'frontend')
const IIFE = '/tmp/qaExportDocx.iife.js'
const MUT_IIFE = '/tmp/qaMutExportDocx.iife.js'
const DOCX = '/tmp/qa_plan_check.docx'
const MUT_DOCX = '/tmp/qa_mut_plan_check.docx'
const MUTATE = process.env.MUTATE === '1'

const MARK = '__E2E导出自检__'
// ⚠ 正文标记**不能带下划线**：`__QAMARK__` 在 markdown 里是**加粗语法**，会被 marked 吃掉
// （2026-09-29 实测：首版就这么写的，判据报"正文没进 docx"，其实是标记自己消失了）。改用中文书名号。
const BODY_MARK = '【自检正文标记QAMARK】'   // 正文唯一标记：证明"内容真的写进了 docx"
const LEAK_KEYS = ['生成模型', 'qwen', '发散边界', '前置来源', '知识面来源']
const CONTENT = [
  `# ${MARK}`,
  '',
  '## 教学目标',
  `1. 认识并理解本课核心概念（自检标记 ${BODY_MARK}）。`,
  '2. 有感情地朗读课文。',
  '',
  '## 教学过程',
  '- 推导勾股关系：$a^{2}+b^{2}=c^{2}$',
].join('\n')
const META = {
  subject: '语文', grade: '四年级', title: MARK, textbookUnit: '统编版 · 第一单元',
  period: 1, model: 'qwen-plus', date: '2026/9/29',   // ⚠ 故意传入模型名：成品里**必须**看不到它
}

const bundle = (entry, outfile) => execFileSync('npx',
  ['esbuild', entry, '--bundle', '--format=iife', `--global-name=${outfile === MUT_IIFE ? 'ExpDocxMut' : 'ExpDocx'}`,
    '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
    `--outfile=${outfile}`, '--log-level=error'], { cwd: FE, stdio: 'inherit' })

/** 解出 docx 的可见文本 + 媒体条目（不依赖浏览器） */
const readDocx = (file) => {
  const xml = execFileSync('unzip', ['-p', file, 'word/document.xml']).toString('utf8')
  const text = xml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const list = execFileSync('unzip', ['-l', file]).toString('utf8')
  const media = (list.match(/word\/media\/[^\s]+/g) || []).length
  return { text, media, bytes: fs.statSync(file).size }
}

let br
;(async () => {
  bundle('src/lib/exportDocx.ts', IIFE)
  must(fs.existsSync(IIFE) && fs.statSync(IIFE).size > 1000, '① 导出器可打包（esbuild → IIFE）', { size: fs.statSync(IIFE).size })

  br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1280, height: 800 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto(`${B}/login`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  const reached = await p.evaluate(() => /知微/.test(document.title + document.body.innerText)).catch(() => false)
  if (!reached) {
    console.log('   [SKIP] 打不开真实站点（环境未就绪）→ 本套件**未验证**（skip ≠ pass）')
    process.exit(2)
  }
  await p.addScriptTag({ path: IIFE })

  /** 在真页面里跑导出（公式渲染依赖浏览器 canvas/KaTeX），取回字节 */
  const runExport = (g) => p.evaluate(async ([g, content, meta]) => {
    const blob = await window[g].exportLessonPlanToDocx(content, meta)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    return { b64: btoa(s), len: bytes.length }
  }, [g, CONTENT, META])

  const out = await runExport('ExpDocx')
  fs.writeFileSync(DOCX, Buffer.from(out.b64, 'base64'))
  const d = readDocx(DOCX)
  must(d.bytes > 2000 && d.bytes === out.len, '① 导出成功且字节数正常（真 docx 产物）', { bytes: d.bytes })
  must(d.text.includes(MARK) && d.text.includes(BODY_MARK),
    '② **正文真的进了 docx**（标题与正文唯一标记出现在 document.xml 可见文本里）',
    { hasTitle: d.text.includes(MARK), hasBody: d.text.includes(BODY_MARK), sample: d.text.slice(0, 90) })
  must(d.media >= 1,
    '③ **公式以图片资源嵌入**（zip 内含 word/media/*.png）—— 退化成纯文本不算通过',
    { media: d.media })
  const leaks = LEAK_KEYS.filter(k => d.text.includes(k))
  must(leaks.length === 0,
    `④ **不泄漏内部配方**：即便传入 \`model=qwen-plus\`，成品可见文本里不得出现 ${LEAK_KEYS.join(' / ')}`,
    { leaks, sample: d.text.slice(0, 120) })

  /* ── 变异（强形态）：真改被测源码把"生成模型"写回标题行 → ④ 必须能抓到 ── */
  if (MUTATE) {
    const srcPath = path.join(FE, 'src/lib/exportDocx.ts')
    const mutPath = path.join(FE, 'src/lib/__qa_mut_exportDocx.ts')
    const orig = fs.readFileSync(srcPath, 'utf8')
    const patched = orig.replace("new TextRun({ text: meta.title || '教案', bold: true, size: 36, font: 'SimSun' })",
      "new TextRun({ text: (meta.title || '教案') + '｜生成模型：' + (meta.model || ''), bold: true, size: 36, font: 'SimSun' })")
    try {
      must(patched !== orig,
        '【变异测试·前置】源码注入点匹配成功（否则说明实现变了，需更新注入点 —— 不是"变异通过"）', {})
      fs.writeFileSync(mutPath, patched)
      bundle('src/lib/__qa_mut_exportDocx.ts', MUT_IIFE)
      await p.addScriptTag({ path: MUT_IIFE })
      const mout = await runExport('ExpDocxMut')
      fs.writeFileSync(MUT_DOCX, Buffer.from(mout.b64, 'base64'))
      const md = readDocx(MUT_DOCX)
      const mLeaks = LEAK_KEYS.filter(k => md.text.includes(k))
      must(md.text.includes(BODY_MARK),
        '【变异测试·前置】注入版产物仍**包含正文**（证明差异来自注入，不是"整份都没写进去"）',
        { hasBody: md.text.includes(BODY_MARK) })
      must(mLeaks.includes('生成模型') && mLeaks.includes('qwen'),
        '【变异测试·真注入】真改被测源码把"生成模型"写回标题行后重打包 → ④ 的判据**必须抓到泄漏**（证明它不是恒真）',
        { leaks: mLeaks, sample: md.text.slice(0, 120) })
      must(leaks.length === 0,
        '【变异测试·对照】同一批次里**未注入**的产物仍然干净（不是"两条都脏"或"两条都干净"）',
        { clean: leaks })
    } finally {
      try { fs.unlinkSync(mutPath) } catch { /* 已删除 */ }
    }
  }

  must(errs.length === 0, '全程 pageerror = 0', { errs })
  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
}).finally(async () => {
  try { await br?.close() } catch { /* noop */ }
  for (const f of [DOCX, MUT_DOCX, IIFE, MUT_IIFE]) { try { fs.rmSync(f, { force: true }) } catch { /* noop */ } }
})
