/**
 * verify_layout_consistency.cjs — 布局一致性巡检
 *
 * 检查 教案 / 出题 / 组卷 三个页面的 Doc 模式布局是否对齐同一标准：
 * - Header 含 AI/DOC 模式切换
 * - EditorLayout 左面板 (466px) 可折叠 + chip 恢复
 * - 编辑区内含 180px 导航面板（章节导航 / 题目导航）
 * - A4 纸面存在（有内容时固定 794px）
 * - 左面板含元数据显示
 *
 * 注意：部分元素（A4纸面、导航面板条目）需要先生成内容才可见，
 * 本脚本只检查组件结构存在性（"暂无题目" / "暂无标题" 等空态也视为组件存在）。
 *
 * 用法:
 *   BASE=http://school1.ziwi.cn node qa/verify_layout_consistency.cjs
 * 退出码: 0=PASS 1=FAIL
 */

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const SHOTS_DIR = path.join(__dirname, '_shots')
const LOGS_DIR = path.join(__dirname, '_logs')
const LOGFILE = path.join(LOGS_DIR, 'vlayout_' + Date.now() + '.log')

const sleep = ms => new Promise(r => setTimeout(r, ms))
function log(msg) {
  const ts = new Date().toISOString().slice(11, 19)
  const line = '[' + ts + '] ' + msg
  try { fs.appendFileSync(LOGFILE, line + '\n') } catch { }
  process.stderr.write(line + '\n')
}
function emit(res, code) { process.stdout.write(JSON.stringify(res) + '\n'); process.exit(code) }

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[placeholder="请输入手机号"]', PHONE)
  await page.fill('input[placeholder="请输入密码"]', PASS)
  await page.click('button[type=submit]')
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await sleep(2500)
}

/** 检查页面文档模式三大结构：Header切换 / 左面板折叠 / 导航面板 / 统一 footer 预览 */
async function checkPageLayout(page, name, url, navLabel) {
  log('check ' + name)
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(5000)

  const checks = {}

  // 1. Header — AI/文档模式切换
  checks.modeToggle = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].map(b => b.innerText.replace(/\s+/g, ' ').trim())
    return btns.some(t => t.includes('AI 模式')) && btns.some(t => t.includes('文档模式'))
  })

  // 2. 统一底边栏预览按钮（必须在切文档模式前检查，切后按钮变"返回编辑"）
  checks.footerPreviewBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    return btns.some(b => b.innerText.trim() === '预览')
  })

  // 3. 点击 footer 预览按钮 → 验证切换到 secondary/文档模式
  const fpb = page.locator('button', { hasText: '预览' }).last()
  if (await fpb.count() > 0) {
    await fpb.click().catch(() => {})
    await sleep(3000)
    // 文档模式 tab 应变为 active（bg-white 高亮）
    checks.footerPreviewWorks = await page.evaluate(() => {
      const docTab = [...document.querySelectorAll('button')].find(b =>
        b.innerText.includes('文档模式')
      )
      return docTab ? docTab.className.includes('bg-white') : false
    })
    // 按钮文本应切换为"返回编辑"
    checks.footerPreviewToggle = await page.evaluate(() => {
      return document.body.innerText.includes('返回编辑')
    })
    // 再从预览切回编辑
    const backBtn = page.locator('button', { hasText: '返回编辑' }).last()
    if (await backBtn.count() > 0) await backBtn.click().catch(() => {})
    await sleep(2000)
  } else {
    checks.footerPreviewWorks = false
    checks.footerPreviewToggle = false
  }

  // 4. Header 切文档模式（面板折叠/导航面板/纸面渲染检查用）
  const docBtn = page.locator('button', { hasText: '文档模式' })
  if (await docBtn.count() > 0) {
    await docBtn.first().click().catch(() => {})
    await sleep(3000)
  }

  // 5. 左面板折叠按钮
  checks.leftCollapse = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    return btns.some(b => b.innerText.includes('收起左侧面板') || b.title === '收起左侧面板')
  })

  // 6. 导航面板（章节导航 / 题目导航）
  checks.navPanel = await page.evaluate((label) => {
    const text = document.body.innerText
    return text.includes(label) || text.includes('展开' + label)
  }, navLabel)

  // 7. 编辑区渲染
  checks.editorArea = await page.evaluate(() => {
    return !!document.querySelector('.ProseMirror') ||
      document.body.innerText.includes('该试卷暂无题目') ||
      document.body.innerText.includes('暂无题目') ||
      document.body.innerText.includes('请在 AI 模式') ||
      !!document.querySelector('[class*="Paper"]') ||
      !!document.querySelector('[style*="height: 1122"]')
  })

  // 8. 左面板元数据
  checks.leftMeta = await page.evaluate(() => {
    const text = document.body.innerText
    return text.includes('学科') && (text.includes('年级') || text.includes('班级'))
  })

  return checks
}

async function main() {
  try { fs.mkdirSync(LOGS_DIR, { recursive: true }) } catch {}
  try { fs.mkdirSync(SHOTS_DIR, { recursive: true }) } catch {}
  log('START')

  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const pe = [], cerr = []
  page.on('pageerror', e => pe.push(String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()) })

  const res = { status: 'FAIL', checks: {}, verdicts: [] }

  try {
    await login(page)

    // 检查教案
    const lp = await checkPageLayout(page, '教案', '/lesson-plans/new', '章节导航')
    res.checks['教案·footerPreviewBtn'] = lp.footerPreviewBtn
    res.checks['教案·footerPreviewWorks'] = lp.footerPreviewWorks
    res.checks['教案·footerPreviewToggle'] = lp.footerPreviewToggle
    res.checks['教案·modeToggle'] = lp.modeToggle
    res.checks['教案·navPanel'] = lp.navPanel
    res.checks['教案·editorArea'] = lp.editorArea
    if (!lp.modeToggle) res.verdicts.push('教案·无AI/文档模式切换')
    if (!lp.footerPreviewBtn) res.verdicts.push('教案·统一footer无预览按钮')
    if (!lp.footerPreviewWorks) res.verdicts.push('教案·预览按钮未切换到文档模式')
    if (!lp.navPanel) res.verdicts.push('教案·无章节导航面板')
    if (!lp.leftCollapse) res.verdicts.push('教案·左面板无折叠按钮')
    if (!lp.editorArea) res.verdicts.push('教案·编辑区未渲染')
    if (!lp.leftMeta) res.verdicts.push('教案·左面板无元数据')

    // 检查出题
    const ex = await checkPageLayout(page, '出题', '/exercises/new', '题目导航')
    res.checks['出题·footerPreviewBtn'] = ex.footerPreviewBtn
    res.checks['出题·footerPreviewWorks'] = ex.footerPreviewWorks
    res.checks['出题·footerPreviewToggle'] = ex.footerPreviewToggle
    res.checks['出题·modeToggle'] = ex.modeToggle
    res.checks['出题·navPanel'] = ex.navPanel
    res.checks['出题·leftCollapse'] = ex.leftCollapse
    res.checks['出题·editorArea'] = ex.editorArea
    res.checks['出题·leftMeta'] = ex.leftMeta
    if (!ex.modeToggle) res.verdicts.push('出题·无AI/文档模式切换')
    if (!ex.footerPreviewBtn) res.verdicts.push('出题·统一footer无预览按钮')
    if (!ex.footerPreviewWorks) res.verdicts.push('出题·预览按钮未切换到文档模式')
    if (!ex.navPanel) res.verdicts.push('出题·无题目导航面板')
    if (!ex.leftCollapse) res.verdicts.push('出题·左面板无折叠按钮')
    if (!ex.editorArea) res.verdicts.push('出题·编辑区未渲染')
    if (!ex.leftMeta) res.verdicts.push('出题·左面板无元数据')

    // 检查组卷
    const eb = await checkPageLayout(page, '组卷', '/exams/new', '题目导航')
    res.checks['组卷·footerPreviewBtn'] = eb.footerPreviewBtn
    res.checks['组卷·footerPreviewWorks'] = eb.footerPreviewWorks
    res.checks['组卷·footerPreviewToggle'] = eb.footerPreviewToggle
    res.checks['组卷·modeToggle'] = eb.modeToggle
    res.checks['组卷·navPanel'] = eb.navPanel
    res.checks['组卷·leftCollapse'] = eb.leftCollapse
    res.checks['组卷·editorArea'] = eb.editorArea
    res.checks['组卷·leftMeta'] = eb.leftMeta
    if (!eb.modeToggle) res.verdicts.push('组卷·无AI/文档模式切换')
    if (!eb.footerPreviewBtn) res.verdicts.push('组卷·统一footer无预览按钮')
    if (!eb.footerPreviewWorks) res.verdicts.push('组卷·预览按钮未切换到文档模式')
    if (!eb.leftCollapse) res.verdicts.push('组卷·左面板无折叠按钮')
    if (!eb.editorArea) res.verdicts.push('组卷·编辑区未渲染')
    if (!eb.leftMeta) res.verdicts.push('组卷·左面板无元数据')

    // 终判
    const fails = Object.entries(res.checks).filter(([, v]) => v === false).length
    res.checks.pageErrors = pe.length
    res.checks.consoleErrors = cerr.length
    if (fails === 0) {
      res.status = 'PASS'
      res.verdicts.push('三个页面布局结构一致：mode切换+导航面板+左面板折叠+编辑区+元数据+统一footer预览')
    } else {
      res.status = 'FAIL'
    }
    if (pe.length) res.verdicts.push('pageerror=' + pe.length)
    if (cerr.length) res.verdicts.push('consoleError=' + cerr.length)

    await page.screenshot({ path: path.join(SHOTS_DIR, 'vlayout.png') }).catch(() => {})
  } catch (e) {
    res.status = 'FAIL'
    res.verdicts.push('异常: ' + (e.message || e))
    res.checks.exception = (e.stack || e.message)
    log('EXCEPTION: ' + (e.stack || e.message))
  }

  await browser.close()
  emit(res, res.status === 'PASS' ? 0 : 1)
}

main().catch(e => {
  process.stdout.write(JSON.stringify({ status: 'FAIL', verdicts: ['FATAL ' + (e.message || e)] }) + '\n')
  process.exit(1)
})
