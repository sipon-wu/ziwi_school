/**
 * 编辑器外壳一致性 + 路由可达不白屏（6 个编辑器）+ **坏数据不白屏** —— 2026-09-29 立
 *
 * 覆盖退役文件（见 `qa/RETIRED.md` 缺口清单）：`verify_shell_consistency`（题单/教案/出题/组卷/试卷/课件
 * 外壳一致）、`verify_view_unified` / `verify_cw_view_unified`（查看态统一 EditorLayout + 全屏预览出口）、
 * `verify_route_consistency`（路由可达）。（`verify_list_open_mode` 的"点行=预览"已由
 * `qa/verify_courseware_entries.cjs` 接管，本守卫不重复。）
 *
 * 为什么值得守：6 个编辑器共用**同一个外壳** `EditorLayout`（管左栏/右栏/footer/**全屏预览 overlay**）。
 * 谁把某一页改成自己画的壳，教师就会遇到"这页有预览、那页没有""预览不走全屏而是跳走"这类**不一致**；
 * 而**坏数据把编辑器搞白屏**（空 content / 非法内容）更是课堂上直接卡死 —— 两者都不报错，只能靠真页面守。
 *
 * 判据：
 *   ① **6 个编辑器新建页都不白屏**（教案 / 课件 / 出题 / 组卷 / 题单 / 作业）、pageerror = 0；
 *   ② **都有 footer「预览」入口**（同一个外壳给的，不是各页自己画的）；
 *   ③ 点「预览」→ 出现**同一个全屏承载层**（`PreviewOverlay` 根：`fixed inset-0 z-50`），且**点前后计数必须变化**
 *      （不变＝要么没打开、要么页面本来就有一层 → 判据失效，会当场报出来）；
 *   ④ **坏数据不白屏**（强形态注入）：造一份课件 → psql **真改库**把 `content` 置空 / 置成非法内容 →
 *      重开编辑页仍**不白屏**、pageerror 仍为 0（有兜底与空态）。跑完写回原内容 + 删测试件。
 *
 * 变异（M3 · **强形态**）：④ 的"真改库塞坏数据"本身就是真注入，MUTATE=1 时把它的证据显式断言出来
 *   （真改库 → 页面仍可渲染）；若编辑器对坏数据没有兜底（白屏/异常），这两条必红。
 *   ⚠ 如实标注：③ 是跑**线上真实产物**的集成冒烟（源码改动要重新构建部署才生效），故 ③ 的证明力弱于 ④，
 *     本守卫**不声称** ③ 被变异过。
 *
 * 用法：`node qa/verify_editor_shell.cjs`（约 90s：6 个页面 + 一次坏数据注入）
 *       `MUTATE=1 node qa/verify_editor_shell.cjs`
 */
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')
const { session, h5Content } = require('./lib/cwFixture.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const MUTATE = process.env.MUTATE === '1'
const STAMP = Date.now()
const NAME = `__E2E外壳自检_${STAMP}`
/** 6 个编辑器（都是同一个 `EditorLayout` 的宿主，见 `grep -l EditorLayout src/pages/`） */
const EDITORS = [
  ['教案', '/lesson-plans/new'],
  ['课件', '/courseware/ppt/new'],
  ['出题', '/exercises/new'],
  ['组卷', '/exams/new'],
  ['题单', '/sheets/new'],
  ['作业', '/assignments/new'],
]
const OVERLAY = 'fixed inset-0 z-50'   // PreviewOverlay 根 class（全屏承载层）

const SSH = process.env.SSH_TARGET || 'root@193.112.163.147'
const ENV_FILE = process.env.ENV_FILE || '/opt/zhiwei/code/deploy/.env.staging'
const psql = (sql) => {
  try {
    return execFileSync('ssh', [SSH,
      `set -a; . ${ENV_FILE}; set +a; docker exec -i zhiwei-postgres-staging psql -U "$DB_USER" -d "$DB_NAME" -t -A -c ${JSON.stringify(sql)}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map(s => s.trim()).filter(s => s && !/^WARNING|^DETAIL|^HINT|collation/i.test(s)).join('\n')
  } catch { return null }
}
const b64set = (text) => `convert_from(decode('${Buffer.from(text, 'utf8').toString('base64')}','base64'),'UTF8')`

let br, id
let createdByVisit = []   // 本轮冒烟过程中产品自动存出的草稿 id（收尾必须清掉）
;(async () => {
  const { H, get } = await session()
  br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  const lg = await (await fetch(`${B}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
  })).json()
  must(!!lg.token, '教师登录成功', { user: lg.user && lg.user.name })
  await p.goto(`${B}/login`, { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])

  /** 打开一页并采集：文本长度 / 预览按钮 / 全屏层计数（点前点后）/ 新出现的 pageerror 数 */
  const visit = async (path) => {
    const errBefore = errs.length
    await p.goto(`${B}${path}`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(7000)
    const before = await p.evaluate((OV) => ({
      len: (document.body.innerText || '').replace(/\s+/g, ' ').length,
      layers: [...document.querySelectorAll('div')].filter(d => (d.className || '').includes(OV)).length,
      hasPreview: [...document.querySelectorAll('button')].some(b => /预览/.test(b.innerText || '')),
      url: location.pathname,
    }), OVERLAY)
    let after = null
    if (before.hasPreview) {
      await p.locator('button', { hasText: '预览' }).first().click().catch(() => { })
      await p.waitForTimeout(3000)
      after = await p.evaluate((OV) => ({
        layers: [...document.querySelectorAll('div')].filter(d => (d.className || '').includes(OV)).length,
        len: (document.body.innerText || '').replace(/\s+/g, ' ').length,
      }), OVERLAY)
    }
    return { ...before, after, newErrs: errs.length - errBefore }
  }

  /* ── ① 六页不白屏 ② 都有预览入口 ③ 点预览 → 同一个全屏层 ── */
  /* ⚠ 副作用登记（2026-09-29 实测踩到）：打开 `/xxx/new` 并点「预览」会**自动存出一份草稿**
   *   （名字「未命名_课件」）。首次上线这条守卫时它留下 3 份垃圾，把共享基线件挤出素材列表 →
   *   同一轮全量里 `verify_preview_pure` 失败、`verify_cover_elements` 抛异常记未验证
   *   （隔离复跑又全绿 —— 典型的"测试污染"。教训：**冒烟也要登记并清理自己造的数据**）。
   *   故：进入前记一遍素材 id，跑完把本次新产生的删掉；finally 里再兜底删一次。 */
  const listIds = async () => ((await (await fetch(`${B}/api/materials`, { headers: H })).json()).items || []).map(m => m.id)
  const idsBefore = new Set(await listIds())
  const rows = []
  for (const [label, path] of EDITORS) {
    const r = await visit(path)
    rows.push({ label, path, ...r })
    console.log(`   [${label}] ${path} 文本=${r.len} 预览按钮=${r.hasPreview} 层(点前 ${r.layers} → 点后 ${r.after ? r.after.layers : '-'}) 新 pageerror=${r.newErrs}`)
  }
  createdByVisit = (await listIds()).filter(x => !idsBefore.has(x))
  console.log(`   [note] 这 6 页冒烟过程中产品自动存出的草稿 ${createdByVisit.length} 份（建页即自动存草稿＝产品行为；本守卫负责清掉，不留污染）`)
  for (const mid of createdByVisit) await fetch(`${B}/api/materials/${mid}`, { method: 'DELETE', headers: H })
  const leftAfter = (await listIds()).filter(x => !idsBefore.has(x))
  must(leftAfter.length === 0,
    '④ **本守卫不留副作用**：冒烟期间产品自动存出的草稿已全部清掉（测试污染会挤掉共享基线件、把别的守卫搞红）',
    { created: createdByVisit.length, left: leftAfter.length })
  createdByVisit = leftAfter   // 若仍有残留，交给 finally 再兜底删
  const blank = rows.filter(r => r.len < 250)
  must(blank.length === 0,
    `① **6 个编辑器页都不白屏**（文本长度 ≥ 250；实测 ${rows.map(r => `${r.label}:${r.len}`).join(' / ')}）`,
    { blank: blank.map(r => `${r.label}(${r.len})`) })
  must(errs.length === 0, '① 打开这 6 页期间 pageerror = 0', { errs })
  const noPreview = rows.filter(r => !r.hasPreview)
  must(noPreview.length === 0,
    '② 6 个编辑器**都有 footer「预览」入口**（同一个 `EditorLayout` 给的，不是各页自己画的）',
    { missing: noPreview.map(r => r.label) })
  const noLayer = rows.filter(r => !r.after || r.after.layers <= r.layers)
  must(noLayer.length === 0,
    `③ 点「预览」都打开**同一个全屏承载层**（\`${OVERLAY}\`，且点前点后计数必须变化 —— 不变则判据失效）`,
    { failed: noLayer.map(r => `${r.label}(前${r.layers}→后${r.after ? r.after.layers : '-'})`) })

  /* ── ④ 强形态注入：真改库塞坏数据 → 必须不白屏 ── */
  const cr = await (await fetch(`${B}/api/materials/json`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: NAME, type: 'courseware', format: 'ppt', content: h5Content(), status: 'draft', subject: '语文', grade: '四年级' }),
  })).json()
  id = cr && cr.id
  must(!!id, '造一份课件（用于坏数据注入）', { id })
  const orig = String((await get(`/api/materials/${id}`)).content || '')
  const editPath = `/courseware/ppt/${id}/edit`
  const base = await visit(editPath)
  must(base.len >= 250, '④ 前置：正常内容下该课件编辑页可正常渲染', { len: base.len })

  /* ⚠ 载荷不能含 NUL（`\u0000`）：PostgreSQL 的 `text` 不允许 NUL 字节，UPDATE 会直接报错
   *   （首版就踩到：psql 返回 null → 被 SKIP 分支吞掉，看着像"环境不可用"，其实是**夹具本身非法**）。 */
  const cases = [
    ['空内容', ''],
    ['非法内容（未闭合标记 + 坏 base64 + 控制字符）', '**未闭合{{{\u0007\u0007<!-- CW-EL:!!!not-base64!!! -->\n### 乱码\u0007段<unclosed'],
  ]
  const skips = []
  for (const [label, bad] of cases) {
    const r1 = psql(`UPDATE materials SET content = ${b64set(bad)} WHERE id='${id}'`)
    if (r1 === null) {
      skips.push(`坏数据用例「${label}」（改库不可用）`)
      continue
    }
    const rid = await visit(editPath)
    must(rid.len >= 250 && rid.newErrs === 0,
      `【变异测试·真注入】psql **真改库**把 content 置为「${label}」后，编辑页仍**不白屏**（文本 ${rid.len}）且无 pageerror`
      + ' —— 坏数据有兜底，而不是把教师卡在白屏上',
      { case: label, len: rid.len, newErrs: rid.newErrs })
  }
  if (MUTATE) {
    const back = psql(`UPDATE materials SET content = ${b64set(orig)} WHERE id='${id}'`)
    must(back !== null, '【变异测试·收尾】原内容已写回', {})
    const r2 = await visit(editPath)
    must(r2.len >= 250 && r2.newErrs === 0, '【变异测试·真注入】写回后编辑页仍正常（注入可逆、不留污染）', { len: r2.len })
  } else {
    psql(`UPDATE materials SET content = ${b64set(orig)} WHERE id='${id}'`)   // 收尾：无条件写回
  }

  report()
  if (skips.length) {
    // M7：skip ≠ pass —— 有未验证项就按"未验证"退出（退出码 2），不要伪装成全绿
    console.log('   [SKIP] 以下判据**未验证**（skip ≠ pass）：' + skips.join('；'))
    process.exitCode = 2
  }
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
}).finally(async () => {
  try { await br?.close() } catch { /* noop */ }
  try {
    const lg = await (await fetch(`${B}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
    })).json()
    for (const mid of createdByVisit || []) {           // 兜底：异常中断时也要清掉冒烟产生的草稿
      await fetch(`${B}/api/materials/${mid}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + lg.token } }).catch(() => { })
    }
  } catch { /* noop */ }
  if (!id) return
  try {
    const lg = await (await fetch(`${B}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
    })).json()
    const st = (await fetch(`${B}/api/materials/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + lg.token } })).status
    console.log(`   [cleanup] 测试课件已删除：${st}`)
  } catch (e) {
    console.log(`   [cleanup] 删除失败：${e.message}`)
  }
})
