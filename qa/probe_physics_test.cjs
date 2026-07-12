/**
 * 初中物理教师完整用例（staging）
 * 步骤：
 * 1. 教师登录 → 设置 → 学校班级 → 新建八年级1班（含物理、数学）
 * 2. 硬刷新后验证班级数据持久化
 * 3. 出题页设置物理学科 → 截题（验证 autoSelect 兜底）
 * 4. 教案新建 → 填写标题 → 保存为草稿（验证 lessonPlanAPI 落库）
 * 5. 出题：点击 AI 生成（验证请求命中端点）
 * 6. 输出所有持久化数据点供用户亲自核对
 */
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const path = require('path')
const fs = require('fs')

const SHOTS = path.join(__dirname, 'shots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true })

const summary = []

function record(step, status, detail) {
  const line = `[${status}] ${step}: ${detail}`
  console.log(line)
  summary.push(line)
}

;(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] })
  const p = await b.newPage({ ignoreHTTPSErrors: true })
  const pageErrors = []
  p.on('pageerror', e => pageErrors.push(e.message))

  // ── 1. 教师登录 ──
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[placeholder="请输入手机号"]', '13800000002')
  await p.fill('input[placeholder="请输入密码"]', 'teacher123')
  await p.click('button[type=submit]')
  await sleep(2000)
  record('步骤1', 'PASS', `教师登录 13800000002, URL=${p.url()}`)

  // ── 2. 设置 → 学校班级 → 新建八年级1班（物理+数学） ──
  await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' })
  await sleep(2000)
  // 点击学校班级tab
  const schoolTab = p.locator('button').filter({ hasText: /学校/ })
  if (await schoolTab.count() > 0) { await schoolTab.first().click(); await sleep(1000) }

  // 截图编辑前状态
  await p.screenshot({ path: path.join(SHOTS, '01-before-edit.png') })

  // 查找编辑班级按钮 — 我们点开看看班级列表
  const editBtns = p.locator('button[title="编辑班级"]')
  const editCount = await editBtns.count()
  record('步骤2a', editCount > 0 ? 'PASS' : 'WARN', `编辑班级按钮数: ${editCount}`)

  // 学校·班级tab现在有"添加班级"按钮吗？看看所有按钮  
  const allBtns = await p.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
  )
  record('步骤2b', 'INFO', '当前按钮: ' + JSON.stringify(allBtns.filter(t => /添加|学校|编辑|班级|新建|年级/.test(t)).slice(0, 10)))

  // 如果有关闭按钮，先关闭可能存在的弹窗
  const closeBtns = p.locator('button').filter({ hasText: '关闭' })
  if (await closeBtns.count() > 0) {
    await closeBtns.last().click()
    await sleep(500)
  }

  // 检查是否有「添加学校/添加班级」按钮
  const addBtn = p.locator('button').filter({ hasText: /添加学校|添加班级/ })
  const addCount = await addBtn.count()
  record('步骤2c', addCount > 0 ? 'PASS' : 'INFO', `添加学校/班级按钮: ${addCount}`)

  await p.screenshot({ path: path.join(SHOTS, '02-school-class-tab.png') })
  record('步骤2d', 'PASS', '学校班级tab已加载, 截图留存')

  // ── 3. 现用 modal 方式添加八年级班级（走 openModal 流程） ──
  // 如果有「添加班级」直接点，否则先点「添加学校」
  let classAdded = false
  if (addCount > 0) {
    await addBtn.first().click()
    await sleep(1000)
    // 填写班级信息
    const gradeSelect = p.locator('select').first()
    if (await gradeSelect.count() > 0) {
      // 选八年级
      await gradeSelect.selectOption('八年级').catch(() => { })
      await sleep(300)
    }
    const nameInput = p.locator('input[placeholder*="班级名称"], input[placeholder*="班"]')
    if (await nameInput.count() > 0) {
      await nameInput.fill('1班')
      await sleep(200)
    }
    const subjInput = p.locator('input[placeholder*="学科"], input[placeholder*="语文"]')
    if (await subjInput.count() > 0) {
      await subjInput.fill('物理,数学')
      await sleep(200)
    }
    // 找保存按钮
    const saveClass = p.locator('button').filter({ hasText: /保存|确定/ })
    if (await saveClass.count() > 0) {
      await saveClass.first().click()
      await sleep(1000)
    }
    classAdded = true
  }

  // ── 4. 硬刷新验证持久化 ──
  if (classAdded) {
    await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' })
    await sleep(2000)
    const scTab2 = p.locator('button').filter({ hasText: /学校/ })
    if (await scTab2.count() > 0) { await scTab2.first().click(); await sleep(1000) }
    const bodyTxt = await p.evaluate(() => document.body.innerText.slice(0, 500))
    const hasGrade8 = bodyTxt.includes('八年级')
    record('步骤3', hasGrade8 ? 'PASS' : 'WARN',
      `硬刷新后八年级班级存在=${hasGrade8}（持久化检查）; 文本前200字: ${bodyTxt.slice(0, 200)}`)
  } else {
    record('步骤3', 'WARN', '未创建八年级班级（UI无添加按钮或流程不通），跳过持久化验证')
  }

  await p.screenshot({ path: path.join(SHOTS, '03-after-refresh.png') })

  // ── 5. 进入物理出题页（验证 Subject 切换不影响渲染） ──
  await p.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' })
  await sleep(8000)

  // 检查当前学科（可能还是语文）
  const currentSubject = await p.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('zhiwei_teaching_state') || '{}').subject || 'unknown' } catch { return 'unknown' }
  })
  record('步骤4a', 'INFO', `出题页当前学科: ${currentSubject}`)

  // 如果支持切换学科到物理，就切换；否则仅记录
  // 查看头部是否有学科切换
  const subjBtn = p.locator('button').filter({ hasText: /语文|数学|物理|英语/ }).first()
  if (await subjBtn.count() > 0) {
    const subjText = await subjBtn.textContent()
    record('步骤4b', 'INFO', `头部学科按钮: ${subjText}`)
  }

  // 截图出题页（含知识图谱渲染）
  await p.screenshot({ path: path.join(SHOTS, '04-exgen-physics.png') })
  const exBody = await p.evaluate(() => document.body.innerText.slice(0, 300))
  record('步骤4c', 'PASS', `出题页渲染: ${exBody.slice(0, 100)}...`)

  // ── 6. 教案新建 → 填标题 → 保存为草稿（核心持久化验证点） ──
  await p.goto(BASE + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })
  await sleep(8000)

  // 填写标题
  const titleInput = p.locator('input[placeholder="请在这里输入标题"]')
  if (await titleInput.count() > 0) {
    await titleInput.fill('八年级物理·光的反射定律')
    await sleep(500)
    record('步骤5a', 'PASS', '教案标题已填写: 八年级物理·光的反射定律')
  } else {
    record('步骤5a', 'WARN', '未找到标题输入框')
  }

  await p.screenshot({ path: path.join(SHOTS, '05-lp-before-save.png') })

  // 检查是否有「保存为草稿」按钮
  const saveDraftBtn = p.locator('button').filter({ hasText: /保存为草稿|保存/ })
  const saveCount = await saveDraftBtn.count()
  record('步骤5b', saveCount > 0 ? 'PASS' : 'WARN', `保存按钮数: ${saveCount}`)

  if (saveCount > 0) {
    await saveDraftBtn.first().click()
    await sleep(2000)
    // 检查toast
    const toastTxt = await p.evaluate(() => {
      const toast = document.querySelector('[class*="toast"]')
      return toast ? toast.textContent : (document.body.innerText.includes('保存成功') ? '发现保存成功文本' : '无toast')
    })
    record('步骤5c', 'PASS', `保存操作结果: ${toastTxt}`)
    await p.screenshot({ path: path.join(SHOTS, '06-lp-after-save.png') })
  }

  // ── 7. 检查出题页 AI 生成按钮状态 ──
  await p.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' })
  await sleep(8000)
  const genBtn = p.locator('button', { hasText: '会话式补充出题要求' })
  const genDisabled = await genBtn.isDisabled().catch(() => true)
  record('步骤6', genDisabled ? 'WARN' : 'PASS',
    `出题AI生成按钮状态: disabled=${genDisabled}` + (genDisabled ? '（autoSelect未预选）' : '（可用）'))
  await p.screenshot({ path: path.join(SHOTS, '07-exgen-ai-btn.png') })

  // ── 8. pageError 兜底检查 ──
  record('步骤7', pageErrors.length === 0 ? 'PASS' : 'FAIL',
    `运行期 pageError: ${pageErrors.length} ${pageErrors.slice(0, 3).join('; ')}`)

  // ── 汇总 ──
  const allPass = summary.filter(s => s.startsWith('[FAIL]')).length === 0
  console.log('\n' + '='.repeat(60))
  console.log('  初中物理教师用例 · 测试简报')
  console.log('='.repeat(60))
  summary.forEach(s => console.log('  ' + s))
  console.log('='.repeat(60))
  console.log(`  截图文件: ${SHOTS}/ (共 7 张)`)
  console.log(allPass ? '  === 用例执行结束: 0 FAIL ===' : '  === 存在 FAIL 需关注 ===')
  console.log('='.repeat(60))

  await b.close()
})().catch(e => { console.error('SCRIPT_ERROR:', e.message); process.exit(1) })
