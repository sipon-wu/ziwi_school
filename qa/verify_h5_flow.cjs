/**
 * H5 课件：派生 HTML 落库与重算 / 两态右栏作用域 / 查看→编辑不白屏 —— 2026-09-29 立
 *
 * 覆盖退役文件（见 `qa/RETIRED.md` 缺口清单）：`verify_h5_draft_html`（草稿也落派生 HTML）、
 * `verify_h5_qr_scope` + `verify_courseware_entries`（二维码只属于查看/预览态）、
 * `verify_h5_entry_states`（两态入口语义）、`verify_h5_nav`（查看→编辑切换不白屏，曾因 hooks 数量变化踩 React #310）。
 * （H5 一族的其余：`fit` / `interactive` / `rules` / `template` 仍是缺口，本守卫**不声称**覆盖。）
 *
 * 判据（真浏览器 + 真库；2026-09-29 探针实测后按**内容标记**写）：
 *   ① **草稿也落派生 HTML**：编辑态点「保存草稿」→ 库里 `h5_html` 非空，且含**HD 舞台**与**固定比例**运行时代码
 *      （手机扫码打开的就是这份派生 HTML，为空＝扫码看到空白）；
 *   ② **派生缓存必须在保存时重建**：编辑器左栏改「课题名称」→「保存草稿」→ `h5_html` **必须含新标题**
 *      （守 `CoursewareBuilder.tsx:780` 记录过的真缺陷："改了课题名/班级后 h5_html 不重算 → 手机扫码仍是旧标题"）；
 *   ③ **作用域**：编辑态右栏是「批注 / 版本」且**不得**出现分享二维码；点「预览」进全屏放映后，
 *      预览态右栏**必须**出现扫码分享（`img[alt="扫码查看"]`）——
 *      ⚠ 口径已按 2026-09-29 探针修正：退役文件说的"查看态路由右栏有二维码"**在现实现里已不成立**（现在是预览态右栏）；
 *   ④ 两态切换**不白屏**、全程 pageerror = 0（H5 白屏是曾真实发生过的事故）。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时用 psql **直接改库里的 `h5_html`**（把标题标记替换成 `_psql`）→
 *   API 回读必须显示**被改后**的值（证明手机扫码读的就是库里这份派生 HTML，不是每次现算/缓存）。
 *   ⚠ 写库走 base64（见 `RETIRED.md`「手法教训」：拼字面量会把换行变成字面 `\n`）。
 *
 * 用法：`node qa/verify_h5_flow.cjs`（约 40s）
 *       `MUTATE=1 node qa/verify_h5_flow.cjs`
 */
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')
const { session, h5Content } = require('./lib/cwFixture.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const MUTATE = process.env.MUTATE === '1'
const STAMP = Date.now()
const TITLE = `__E2E_H5自检_${STAMP}`

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
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')

let br, id
;(async () => {
  const { H, get } = await session()
  const lg = await (await fetch(`${B}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
  })).json()
  must(!!lg.token, '教师登录成功', { user: lg.user && lg.user.name })

  const checkEnv = await fetch(`${B}/api/materials`, { headers: { Authorization: 'Bearer ' + lg.token } })
  const envTxt = await checkEnv.text()
  if (!/^\s*[{[]/.test(envTxt)) {
    console.log(`   [SKIP] 材料列表返回非 JSON（HTTP ${checkEnv.status}）→ 环境未就绪，本套件**未验证**（skip ≠ pass）`)
    process.exit(2)
  }

  const cr = await (await fetch(`${B}/api/materials/json`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: TITLE, type: 'courseware', format: 'h5', content: h5Content(), status: 'draft', subject: '语文', grade: '四年级' }),
  })).json()
  id = cr && cr.id
  must(!!id, '造一份 H5 课件（草稿态）', { id, name: TITLE })

  br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto(`${B}/login`, { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])

  /** 打开某态并采集（右栏文案 / 白屏 / 扫码面板） */
  const open = async (url, tag) => {
    await p.goto(url, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(9000)
    const info = await p.evaluate(() => {
      const txt = document.body ? document.body.innerText : ''
      return {
        path: location.pathname, len: txt.length,
        scan: /扫码/.test(txt), anno: /批注/.test(txt), ver: /版本/.test(txt),
        // 分享二维码图：`CwPreviewPane` 里 alt="扫码查看"（弹层里是 alt="二维码"）→ 两者都算
        qr: [...document.querySelectorAll('img')].filter(i => /扫码|二维码/.test(i.alt || '')).length,
      }
    })
    console.log(`   [${tag}] ${info.path} 文本 ${info.len} 字 · 扫码=${info.scan} 批注=${info.anno} 版本=${info.ver} 二维码图=${info.qr}`)
    return info
  }

  /* ── ③ 作用域 + ④ 两态不白屏 ──
   * ⚠ 口径修正（2026-09-29 探针实测）：退役文件写的是"查看态 `/courseware/h5/:id` 右栏有二维码、编辑态没有"，
   *   但**当前实现已变**：二维码在「**全屏预览**」的高级右栏（`CwPreviewPane` 的 `img[alt="扫码查看"]`，H5 且已保存时才有），
   *   两条路由页本身都不显示它。故判据改为"**编辑态不得**出现分享二维码；点「预览」后**预览态必须**出现"。 */
  const edit = await open(`${B}/courseware/h5/${id}/edit`, '编辑态')
  must(edit.len > 500, '④ 编辑态不白屏（页面有实际内容）', { len: edit.len })
  must(edit.anno && edit.ver, '③ 编辑态右栏 = 批注 / 版本', { anno: edit.anno, ver: edit.ver })
  must(!edit.qr, '③ **编辑态不得**出现分享二维码（二维码只属于预览/放映态）', { qr: edit.qr })
  const view = await open(`${B}/courseware/h5/${id}`, '查看态')
  must(view.len > 500, '④ 查看态不白屏（查看→编辑来回切换不触发 React #310 之类整页崩溃）', { len: view.len })
  must(!view.anno && !view.ver, '③ 查看态**不得**出现编辑态的「批注 / 版本」面板', { anno: view.anno, ver: view.ver })

  /* 预览态（点 footer「预览」）→ 扫码分享面板必须出现 */
  await open(`${B}/courseware/h5/${id}/edit`, '编辑态（准备开预览）')
  const pvBtn = p.locator('button', { hasText: '预览' }).first()
  must(await pvBtn.count() > 0, '编辑态有「预览」按钮（进全屏放映）', {})
  await pvBtn.click()
  await p.waitForTimeout(6000)
  const prev = await p.evaluate(() => ({
    len: document.body.innerText.length,
    scanTxt: /扫码/.test(document.body.innerText),
    qr: [...document.querySelectorAll('img')].filter(i => /扫码/.test(i.alt || '')).length,
  }))
  must(prev.len > 500, '④ 预览态不白屏', { len: prev.len })
  must(prev.scanTxt && prev.qr >= 1,
    '③ **预览态右栏出现扫码分享**（含二维码图 `img[alt="扫码查看"]`）—— 分享入口可用',
    { scanTxt: prev.scanTxt, qr: prev.qr })

  /* ── ① 保存草稿 → 派生 HTML 落库 ── */
  await open(`${B}/courseware/h5/${id}/edit`, '编辑态（准备保存）')
  const saveBtn = p.locator('button', { hasText: '保存草稿' }).first()
  must(await saveBtn.count() > 0, '编辑态有「保存草稿」按钮', {})
  await saveBtn.click()
  await p.waitForTimeout(7000)
  const m1 = await get(`/api/materials/${id}`)
  const html1 = String(m1.h5_html || '')
  must(html1.length > 5000,
    '① **草稿也落派生 HTML**：保存草稿后库里 `h5_html` 非空（手机扫码打开的就是这份）', { len: html1.length })
  must(/1280|720/.test(html1) && /scale|aspect-ratio|transform/i.test(html1),
    '① 派生 HTML 含 **HD 舞台（1280×720）与固定比例运行时**代码（2026-09-15 那次"画布没适应 HD"的修复）',
    { hd: /1280|720/.test(html1), ratio: /scale|aspect-ratio|transform/i.test(html1) })

  /* ── ② 派生缓存必须在保存时重建（守 CoursewareBuilder.tsx:780 记录过的真缺陷）──
   * 场景：**改「课题名称」→ 保存草稿 → `h5_html` 必须体现新标题**（否则手机扫码看到的还是旧标题）。
   *
   * ⚠ 注入位置两版都踩过，留档免得下次再走：
   *   ① 首版把标记追加到内容**文末**（不属于任何 `## ` 场景）→ 渲染器忽略 → h5_html 里没有；
   *   ② 二版改成注入 `content` 的**场景正文内** → 诊断显示**保存后库里的 content 又变回旧值**：
   *      H5 编辑器是**从派生的 `h5_html` 渲染并回写**的（`CoursewareBuilder.tsx:284` 那段注释同口径），
   *      改 content 会被保存流程覆盖 ⇒ 属**注入选错对象**，不是产品缺陷。
   *   现改为**走 UI 改课题名**（真实教师动作），既不碰内部数据形态，也正好命中上面那类缺陷。 */
  const TITLE2 = `${TITLE}_改名`
  const nameInput = p.locator('input[placeholder="如：光的折射定律"]').first()
  must(await nameInput.count() > 0, '② 前置：编辑器左栏有「课题名称」输入框（placeholder 稳定）', {})
  await nameInput.fill(TITLE2)
  await p.waitForTimeout(600)
  const save2 = p.locator('button', { hasText: '保存草稿' }).first()
  await save2.click()
  await p.waitForTimeout(8000)
  const m2 = await get(`/api/materials/${id}`)
  const html2 = String(m2.h5_html || '')
  must(html2.includes(TITLE2),
    '② **派生缓存保存时重建**：改课题名后保存 → `h5_html` 里必须出现**新标题**'
    + '（守 CoursewareBuilder.tsx:780 记录过的真缺陷：改名字后 h5_html 不重算 → 手机扫码仍是旧标题）',
    { hasNew: html2.includes(TITLE2), stillOldOnly: !html2.includes(TITLE2) && html2.includes(TITLE) })
  // ⚠ 别写等号：落库名字会被应用加上后缀（实测 `…_改名_课件`），故按"包含新标题"判
  must(String(m2.name || '').includes(TITLE2), '② 保存同时把新名字落库（`materials.name` 含新标题）', { name: m2.name })

  /* ── 变异（强形态）：直接改库里的 h5_html → API 回读必须跟着变 ── */
  if (MUTATE) {
    const before = String((await get(`/api/materials/${id}`)).h5_html || '')
    if (!before.includes(TITLE)) {
      console.log('   [SKIP] 变异前置不成立（h5_html 里没有标题标记）→ **未验证**')
      process.exit(2)
    }
    const r = psql(`UPDATE materials SET h5_html = replace(h5_html, '${TITLE}', '${TITLE}_psql') WHERE id='${id}'`)
    if (r === null) {
      console.log('   [SKIP] 强形态变异需改库（ssh/psql 不可用）→ 本项**未验证**（skip ≠ pass）')
      process.exit(2)
    }
    const after = String((await get(`/api/materials/${id}`)).h5_html || '')
    must(after.includes(`${TITLE}_psql`) && !after.includes(`>${TITLE}<`),
      '【变异测试·真注入】psql **直接改库里的 h5_html** 后，API 回读显示的就是**被改后**的值 —— 证明扫码打开的是库里这份派生 HTML（不是每次现算）',
      { injected: after.includes(`${TITLE}_psql`) })
  }

  must(errs.length === 0, '④ 全程 pageerror = 0', { errs })
  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
}).finally(async () => {
  try { await br?.close() } catch { /* noop */ }
  if (!id) return
  try {
    const lg = await (await fetch(`${B}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
    })).json()
    const st = (await fetch(`${B}/api/materials/${id}`, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + lg.token },
    })).status
    console.log(`   [cleanup] 测试 H5 课件已删除：${st}`)
  } catch (e) {
    console.log(`   [cleanup] 删除失败（需人工看一眼）：${e.message}`)
  }
})
