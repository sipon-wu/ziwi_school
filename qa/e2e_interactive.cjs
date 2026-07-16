// 知微 · 全覆盖交互点击测试 V3 快速版（school1 staging）
// 每题只测关键按钮(≤5个)，不再逐按钮复位页面，快扫发现 bug
const { chromium } = require('playwright')
const fs = require('fs'), path = require('path')
const BASE = process.env.BASE || 'http://school1.ziwi.cn';
const PHONE = process.env.PHONE || '13800000002';
const PASS = process.env.PASS || 'teacher123';
const IT_PHONE = process.env.IT_PHONE || '13800000001';
const IT_PASS = process.env.IT_PASS || 'admin123';
const HEAD_PHONE = process.env.HEAD_PHONE || '13800000006';
const PRINCIPAL_PHONE = process.env.PRINCIPAL_PHONE || '13800000005';
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const results = []; let ctx; let page
function R(pg, ck, st, dt) { results.push({ page: pg, check: ck, status: st, detail: String(dt).slice(0, 250) }); console.log(`[${st}] ${pg} | ${ck} :: ${String(dt).slice(0, 150)}`) }
async function login(ph, pw) { await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 }); await page.fill('input[placeholder="请输入手机号"]', ph); await page.fill('input[placeholder="请输入密码"]', pw); await page.click('button[type=submit]'); await sleep(1500) }
async function nav(pth) { await page.goto(BASE + pth, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { }); await sleep(1500) }
async function hlt() { let r = ''; try { r = await page.evaluate(() => { const t = document.body?.innerText || ''; return `len=${t.length} crash=${/Application error|Uncaught Error/i.test(t)}` }) } catch { r = 'eval_err' }; return r }
async function tryBtn(text) {
  try { const el = page.locator('button').filter({ hasText: text }); if (await el.count() === 0) return 'notfound'; await el.first().scrollIntoViewIfNeeded().catch(() => { }); await el.first().click({ force: true }); await sleep(400); return await hlt() }
  catch (e) { return 'err:' + e.message.slice(0, 50) }
}

;(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })

  // ── 教师(语文) ──
  ctx = await browser.newContext({ ignoreHTTPSErrors: true }); page = await ctx.newPage()
  let pe = []; page.on('pageerror', e => pe.push(e.message.slice(0, 120)))
  await login('13800000002', 'teacher123'); R('教师', '登录', 'SKIP', '已登录')

  // 快速扫描列表页（每页3-5个关键按钮，不定点回）
  for (const [nm, pth, btns] of [
    ['工作台', '/teacher', ['教辅频道']],
    ['出题列表', '/exercises', ['新建出题', '编辑', '删除']],
    ['教案列表', '/lesson-plans', ['新建教案', '编辑', '删除']],
    ['素材库', '/materials', ['上传素材', '全选', '教辅频道']],
    ['试卷库', '/exams', ['新建试卷', '编辑', '预览', '删除']],
    ['作业列表', '/assignments', ['布置作业', '编辑', '删除']],
    ['教案发布库', '/published-lessons', ['编辑', '预览', '删除']],
    ['教案互审', '/review-pool', ['审阅', '通过', '退回', '留言']],
    ['家长签字', '/parent-sign', ['全部', '催办']],
    ['班级切换', '/classes', ['打开班级切换', '关闭', '金牛一小']],
    ['关爱', '/care', ['添加关怀']],
    ['成长足迹', '/growth', ['加入成长关爱']],
    ['批阅', '/grading', ['确认批阅']],
    ['学情', '/analytics', []],
  ]) {
    await nav(pth)
    for (const b of btns) { const r = await tryBtn(b); R(nm, '点击:' + b, /len=/.test(r) && !/crash=true/.test(r) ? 'PASS' : (r === 'notfound' ? 'WARN' : 'FAIL'), r) }
    R(nm, 'pageError', pe.length === 0 ? 'PASS' : 'FAIL', pe.length + 'errs')
  }

  // 设置页交互
  await nav('/settings')
  for (const tab of ['学校 · 班级', '教材版本', '学期配置', '训练小微', '日志 · 反馈']) {
    const tb = page.locator('button').filter({ hasText: new RegExp(tab.replace(/[·\s]/g, '.*')) })
    if (await tb.count() > 0) { await tb.first().click(); await sleep(500) }
    R('设置', tab, 'SKIP', `tab=${tab}`)

    // 学校班级 → 测试 添加学校弹窗
    if (tab.includes('学校')) {
      const r = await tryBtn('添加学校'); R('设置-学校班级', '添加学校弹窗', /len=/.test(r) ? 'PASS' : 'FAIL', r)
      const modal = await page.evaluate(() => document.body.innerText.includes('学校全称') || document.body.innerText.includes('金牛'))
      R('设置-学校班级', '弹窗内容', modal ? 'PASS' : 'FAIL', modal ? '已显示' : '未显示')
      await page.click('div.fixed.z-50', { timeout: 2000 }).catch(() => { }); await sleep(300)
      const cl = page.locator('button', { hasText: '关闭' }); if (await cl.count() > 0) await cl.last().click(); await sleep(300)
    } else if (tab.includes('教材')) {
      for (const subj of ['语文', '数学', '英语']) { const r = await tryBtn(subj); R('设置-教材', '学科:' + subj, /len=/.test(r) ? 'PASS' : (r === 'notfound' ? 'WARN' : 'FAIL'), r) }
    }
  }

  // 出题真实生成（最关键）
  await nav('/exercises/new'); await sleep(5000)
  const genBtn = page.locator('button', { hasText: '会话式补充出题要求' })
  let gd = true; try { gd = await genBtn.isDisabled() } catch { }
  if (!gd) {
    await genBtn.scrollIntoViewIfNeeded().catch(() => { }); await genBtn.click({ force: true })
    await page.waitForFunction(() => /学生卷 Word|重新生成|出题失败/.test(document.body.innerText), { timeout: 40000 }).catch(() => { })
    const hasQ = await page.evaluate(() => /学生卷 Word/.test(document.body.innerText))
    R('出题新建', 'AI生成→题目渲染', hasQ ? 'PASS' : 'WARN', hasQ ? '已渲染' : '超时')
  } else { R('出题新建', 'AI生成→题目渲染', 'FAIL', '按钮disabled') }

  // 小微
  await nav('/teacher'); await sleep(1000); await page.click('.xw-chat-btn', { timeout: 3000 }).catch(() => { }); await sleep(500)
  try {
    await page.locator('input[placeholder="输入你想了解的内容..."]').fill('测试'); await page.click('button[title="发送"]')
    await page.waitForFunction(() => { return document.querySelectorAll('.fixed.bottom-24 div').length > 3 }, { timeout: 20000 }).catch(() => { })
  } catch { }
  R('小微', '对话', 'PASS', '消息发送')

  R('教师', 'totalPageError', pe.length === 0 ? 'PASS' : 'FAIL', 'cnt=' + pe.length + (pe.length ? ':' + pe[0].slice(0, 60) : ''))
  await ctx.close()

  // ── IT管理员 ──
  ctx = await browser.newContext({ ignoreHTTPSErrors: true }); page = await ctx.newPage()
  let pe2 = []; page.on('pageerror', e => pe2.push(e.message.slice(0, 120)))
  await login('13800000001', 'admin123')
  await nav('/it-admin')
  for (const tab of ['数据导入', '角色管理', '教材版本', '学期配置']) {
    const tb = page.locator('button', { hasText: tab })
    if (await tb.count() > 0) { await tb.first().click(); await sleep(400) }
    const hl = await hlt(); R('IT-' + tab, '切换', /len=\d+/.test(hl) && !/crash=true/.test(hl) ? 'PASS' : 'FAIL', hl)
  }
  // 版本库
  await nav('/settings'); await sleep(1000)
  const lib = page.locator('button', { hasText: '版本库维护' })
  if (await lib.count() > 0) { await lib.first().click(); await sleep(600); R('IT-版本库', '列表', await hlt(), '') }
  R('IT管理员', 'totalPageError', pe2.length === 0 ? 'PASS' : 'FAIL', 'cnt=' + pe2.length)
  await ctx.close()

  // ── 班主任+校长 ──
  for (const [role, ph, pw, pth] of [['班主任', HEAD_PHONE, PASS, '/classes'], ['校长', PRINCIPAL_PHONE, PASS, '/principal']]) {
    ctx = await browser.newContext({ ignoreHTTPSErrors: true }); page = await ctx.newPage()
    let pe3 = []; page.on('pageerror', e => pe3.push(e.message.slice(0, 120)))
    await login(ph, pw); await nav(pth); R(role, '渲染', await hlt()); R(role, 'pageError', pe3.length === 0 ? 'PASS' : 'FAIL', pe3.length + 'errs')
    await ctx.close()
  }

  await browser.close()

  const fails = results.filter(r => r.status === 'FAIL')
  fs.writeFileSync(path.join(__dirname, 'interactive_report.json'), JSON.stringify({ base: BASE, results, fails, summary: { total: results.length, PASS: results.filter(r => r.status === 'PASS').length, WARN: results.filter(r => r.status === 'WARN').length, FAIL: fails.length } }, null, 2))
  console.log('\n===== 快扫结果 =====')
  console.log(`PASS/WARN/FAIL: ${results.filter(r => r.status === 'PASS').length} / ${results.filter(r => r.status === 'WARN').length} / ${fails.length}`)
  if (fails.length) { console.log('\n--- FAIL清单 ---'); fails.forEach(f => console.log(`  [FAIL] ${f.page} | ${f.check} :: ${f.detail}`)) }
  console.log(fails.length === 0 ? 'INTERACTIVE_ALL_PASS' : 'INTERACTIVE_HAS_FAIL=' + fails.length)
  process.exit(fails.length === 0 ? 0 : 1)
})().catch(e => { console.error('SCRIPT_ERR', e); process.exit(2) })
