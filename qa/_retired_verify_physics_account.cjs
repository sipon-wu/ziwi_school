// ── 已退役（2026-09-29，用户选「2 清存量守卫」）────────────────────────────
// 原用途：物理教师 13800000028 全流程验证
// 退役理由：**从未登记进 `qa/run_all.cjs` 的守卫清单 ⇒ 不在 runner / 门禁 / CI 里执行** ——
//   它是"历史脚本"而不是"守卫"：没人跑它，就没人知道它的断言是否还成立（本轮之前还实测发现
//   这类文件多数带"静默通过"形状，见 `qa/gate_assert_hygiene.cjs` 的 R1~R4）。留着只会让人误以为这块有覆盖。
// 接管者：**无接管** → **覆盖缺口**（该性质目前没有自动守卫；见本文末尾缺口清单）
// 复活方式：去掉文件名前缀 `_retired_` 即可重新被扫描；要长期有效则**必须登记进 `qa/run_all.cjs`**（写 covers）。
// ──────────────────────────────────────────────────────────────────────
/**
 * 物理教师 13800000028 全流程验证
 * 验证：登录 → 出题/教案页渲染 → 保存教案草稿 → 持久化验证
 */
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000028'
const PASS = process.env.PASS || 'teacher123'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const path = require('path')
const fs = require('fs')

const SHOTS = path.join(__dirname, 'shots_physics')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true })
const summary = []
const rec = (s, st, d) => { const l=`[${st}] ${s}: ${d}`; console.log(l); summary.push(l) }

;(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] })
  const p = await b.newPage({ ignoreHTTPSErrors: true })
  p.on('pageerror', e => rec('pageError', 'FAIL', e.message.slice(0,120)))

  // 1. 新账号登录
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[placeholder="请输入手机号"]', PHONE)
  await p.fill('input[placeholder="请输入密码"]', PASS)
  await p.click('button[type=submit]')
  await sleep(2000)
  rec('登录', p.url().includes('/login')?'WARN':'PASS', `落地=${new URL(p.url()).pathname}`)
  await p.screenshot({ path: path.join(SHOTS, '01-login.png') })

  // 2. 检查工作台顶部是否显示 物理/八年级
  const topText = await p.evaluate(() => document.body.innerText.slice(0, 500))
  rec('工作台', topText.includes('物理') ? 'PASS' : 'WARN', `含物理=${topText.includes('物理')} 含八年级=${topText.includes('八年级')}`)
  await p.screenshot({ path: path.join(SHOTS, '02-dashboard.png') })

  // 3. 出题页
  await p.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' })
  await sleep(8000)
  const exText = await p.evaluate(() => document.body.innerText.slice(0, 400))
  const hasPhysics = exText.includes('物理')
  const genBtn = p.locator('button', { hasText: '会话式补充出题要求' })
  const genDisabled = await genBtn.isDisabled().catch(() => true)
  rec('出题页', 'PASS', `含物理=${hasPhysics} AI生成按钮disabled=${genDisabled}`)
  await p.screenshot({ path: path.join(SHOTS, '03-exgen.png') })

  // 4. 教案新建 → 保存草稿
  await p.goto(BASE + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })
  await sleep(8000)
  const lpPhysics = exText.includes('物理')
  const titleInput = p.locator('input[placeholder="请在这里输入标题"]')
  if (await titleInput.count() > 0) {
    await titleInput.fill('八年级物理·光的折射定律')
    await sleep(500)
    rec('教案标题', 'PASS', '已填写: 八年级物理·光的折射定律')
  }
  const saveBtn = p.locator('button').filter({ hasText: /保存/ })
  if (await saveBtn.count() > 0) {
    await saveBtn.first().click()
    await sleep(2000)
    rec('教案保存', 'PASS', '保存操作已触发')
  }
  await p.screenshot({ path: path.join(SHOTS, '04-lp-save.png') })

  // 5. pageError 汇总
  rec('pageError汇总', 'PASS', '运行期无崩溃')

  console.log('\n' + '='.repeat(60))
  console.log('  物理教师 13800000028 · 验证简报')
  console.log('='.repeat(60))
  summary.forEach(s => console.log('  ' + s))
  console.log('='.repeat(60))
  console.log(`  截图: ${SHOTS}/`)
  console.log('='.repeat(60))

  await b.close()
})()
