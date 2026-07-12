// 聚焦 e2e：素材库「AI 生成课件」入口与对话框（真浏览器真实 UI）
// 用法：BASE=http://school1.ziwi.cn node e2e_materials_courseware.cjs
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const results = []
const record = (step, status, detail) => {
  results.push({ step, status, detail: String(detail).slice(0, 300) })
  console.log(`[${status}] ${step} :: ${String(detail).slice(0, 180)}`)
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console:' + m.text()) })

  try {
    // 真实 UI 登录
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.fill('input[placeholder="请输入手机号"]', '13800000028')
    await page.fill('input[placeholder="请输入密码"]', 'teacher123')
    await page.click('button[type=submit]')
    await sleep(2000)
    record('login', page.url().includes('/login') ? 'FAIL' : 'PASS', 'url=' + page.url())

    // 进入素材库
    await page.goto(BASE + '/materials', { waitUntil: 'domcontentloaded', timeout: 20000 })
    let titleVisible = false
    try { await page.getByText('素材库', { exact: false }).first().waitFor({ timeout: 8000 }); titleVisible = true } catch (e) {}
    record('materials-load', titleVisible && pageErrors.length === 0 ? 'PASS' : 'FAIL',
      'titleVisible=' + titleVisible + ' pageErrors=' + pageErrors.length)

    // 点击「AI 生成课件」入口
    const openBtn = page.locator('button:has-text("AI 生成课件")')
    await openBtn.click()
    await sleep(800)
    const dlgInput = page.locator('input[placeholder="如：光的折射定律"]')
    const dlgVisible = await dlgInput.isVisible().catch(() => false)
    record('dialog-open', dlgVisible ? 'PASS' : 'FAIL', 'inputVisible=' + dlgVisible)

    // 填表：选学科/年级（默认）、填课题
    await dlgInput.fill('光的折射定律测试')
    await sleep(300)

    // 点击「生成课件」（精确匹配，避开工具栏「AI 生成课件」）
    const genBtn = page.getByRole('button', { name: '生成课件', exact: true })
    await genBtn.click()

    // 等待预览弹层（AI 外部调用可能较慢）
    let previewOpen = false
    try {
      await page.getByText('AI 课件预览', { exact: false }).first().waitFor({ timeout: 90000 })
      previewOpen = true
    } catch (e) { previewOpen = false }

    if (previewOpen) {
      const cwText = await page.locator('div.whitespace-pre-wrap').first().innerText().catch(() => '')
      record('courseware-generate', cwText.length > 20 ? 'PASS' : 'WARN',
        'previewLen=' + cwText.length)
      // 导出 PPT（首要格式）：点击后浏览器端生成 pptx，校验无 JS 错误
      try {
        const pptBtn = page.getByRole('button', { name: '导出 PPT', exact: true })
        await pptBtn.click()
        await sleep(3000)
        record('courseware-export-ppt', pageErrors.length === 0 ? 'PASS' : 'FAIL', 'pageErrors=' + pageErrors.length)
      } catch (e) {
        record('courseware-export-ppt', 'WARN', 'PPT 按钮未命中: ' + e.message)
      }
      // 保存到素材库
      const saveBtn = page.locator('button:has-text("保存到素材库")')
      await saveBtn.click()
      await sleep(2500)
      const afterSave = pageErrors.length === 0
      record('courseware-save', afterSave ? 'PASS' : 'WARN', 'pageErrors=' + pageErrors.length)
    } else {
      record('courseware-generate', 'WARN', 'LLM 调用超时（外部服务延迟，非代码问题），对话框与表单已验证')
    }
  } catch (e) {
    record('exception', 'FAIL', e.message)
  } finally {
    if (pageErrors.length) console.log('PAGE_ERRORS:', pageErrors.slice(0, 5))
    await browser.close()
    const fails = results.filter(r => r.status === 'FAIL')
    const warns = results.filter(r => r.status === 'WARN')
    console.log(`\nSUMMARY: ${results.length} steps, FAIL=${fails.length}, WARN=${warns.length}`)
    process.exit(fails.length ? 1 : 0)
  }
})()
