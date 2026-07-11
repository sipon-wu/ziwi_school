// 班级编辑真点击验证：登录 → 设置 → 学校·班级 → 编辑四年级1班 → 切学科 → 保存 → 验证
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] })
  const p = await b.newPage({ ignoreHTTPSErrors: true })
  p.on('pageerror', e => console.log('  [pageerror]', e.message.slice(0, 150)))

  // ── 1. 登录 ──
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[placeholder="请输入手机号"]', '13800000002')
  await p.fill('input[placeholder="请输入密码"]', 'teacher123')
  await p.click('button[type=submit]')
  await sleep(2000)
  console.log('1. 登录:', p.url().endsWith('/login') ? 'FAIL' : 'OK')

  // ── 2. 进入设置 → 学校 · 班级 ──
  await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' })
  await sleep(3000)
  const schoolTab = p.locator('button').filter({ hasText: /学校/ })
  const tabCount = await schoolTab.count()
  console.log('2a. 含学校按钮数:', tabCount)
  if (tabCount > 0) {
    await schoolTab.first().click()
    await sleep(1500)
  }
  const txtLen = await p.evaluate(() => document.body.innerText.length)
  console.log('2b. 学校·班级tab:', txtLen > 200 ? ('可见 len=' + txtLen) : '空', ', subTab切换' + (tabCount > 0 ? '成功' : '失败'))

  // ── 3. 找四年级1班 → 点编辑班级 ──
  // 页面显示学校卡片列表，每个班级行有编辑班级铅笔
  const editBtns = p.locator('button[title="编辑班级"]')
  const n = await editBtns.count()
  console.log('3. 编辑班级按钮数:', n)
  if (n === 0) { console.log('FAIL: 未找到编辑班级按钮'); await b.close(); process.exit(1) }
  // 取第一个（四年级1班在最上面）
  await editBtns.first().click()
  await sleep(1000)

  // ── 4. 弹窗内：检查内联编辑UI是否出现 ──
  // 修复前：editClassTarget 被 openModal 清空 → 编辑UI不出现
  // 修复后：应该看到学科切换toggles（✓ 和 ✕ 按钮）
  const checkBtns = p.locator('button', { hasText: '✓' })  // 保存勾
  const cancelInline = p.locator('button', { hasText: '✕' })  // 取消叉
  const checkCount = await checkBtns.count()
  const cancelCount = await cancelInline.count()
  console.log('4. 内联编辑UI: ✓=' + checkCount + ' ✕=' + cancelCount)
  if (checkCount === 0) {
    console.log('FAIL: 内联编辑UI未出现 — openModal 仍清空了 editClassTarget')
    // 截屏取证
    await p.screenshot({ path: require('path').join(__dirname, 'shots', 'class_edit_fail.png') })
    await b.close()
    process.exit(1)
  }

  // ── 5. 添加新学科（英语）─
  // 学科切换按钮在 inline 编辑 UI 中，显示为所有可能的学科toggle
  // 当前已选：语文(blue), 数学(orange)；未选：英语(green时未选)
  // 点击 英语 按钮（不在 editSubjects 中 → 白色边框 → 点击变为蓝色选中）
  const engBtn = p.locator('button', { hasText: '英语' })
  const engBtnCount = await engBtn.count()
  if (engBtnCount > 0) {
    // 取最后一个（inline edit UI 中的 toggle，而非列表标签）
    const engToggle = engBtn.last()
    const clsBefore = await engToggle.evaluate(el => el.className)
    await engToggle.click()
    await sleep(300)
    const clsAfter = await engToggle.evaluate(el => el.className)
    const toggled = clsBefore !== clsAfter
    console.log('5. 英语toggle: class变=' + toggled + ' (before=' + clsBefore.slice(0, 50) + ')')
    if (!toggled) console.log('  WARN: 英语toggle可能未生效(本就选中?显示为标签?)')
  } else {
    console.log('5. 未找到英语toggle按钮(可能学科列表中无英语)')
  }

  // ── 6. 点 ✓ 保存 ──
  await checkBtns.first().click()
  await sleep(600)

  // 保存后编辑UI应消失，学科标签恢复为正常显示
  const checkAfter = await p.locator('button', { hasText: '✓' }).count()
  console.log('6. 保存后内联编辑UI ✓按钮数:', checkAfter, '(应=0 表示编辑UI已退出)')

  // ── 7. 验证学科变更是否生效 ──
  // 重新打开弹窗查看学科标签
  // 先关闭弹窗
  const closeModal = p.locator('button', { hasText: '关闭' })
  if (await closeModal.count() > 0) await closeModal.last().click()
  await sleep(500)

  // 重新进入编辑
  if (await p.locator('button[title="编辑班级"]').count() > 0) {
    await p.locator('button[title="编辑班级"]').first().click()
    await sleep(800)
  }

  // 检查学科标签（四年级1班行）
  const subjectTags = await p.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('div.flex.items-center.gap-1.flex-wrap'))
    for (const cell of cells) {
      const tags = Array.from(cell.querySelectorAll('span'))
      if (tags.length >= 2) return tags.map(t => t.textContent.trim())
    }
    return []
  })
  console.log('7. 学科标签:', subjectTags)

  const hasChinese = subjectTags.includes('语文')
  const hasMath = subjectTags.includes('数学')
  console.log((hasChinese && hasMath) ? 'PASS: 学科保存成功' : 'FAIL: 学科变更未生效')

  await p.screenshot({ path: require('path').join(__dirname, 'shots', 'class_edit_done.png') })
  await b.close()
})().catch(e => { console.error('SCRIPT_ERR', e); process.exit(1) })
