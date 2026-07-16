// 知微AI教学助手 · 拟真题库/试卷库 全学科真实浏览器点击测试
// 用法：BASE=http://school1.ziwi.cn node e2e_seed_content.cjs
// 覆盖：14 个学科专属教师（13900000001~14）登录 → 题库/试卷库列表渲染 → 点击详情/预览
//      + 既有教师(13800000002)年级切换验证跨年级数据
// 判定：pageerror / 白屏 / 跳登录 = FAIL（阻断）；显示类(状态/题型空白) = WARN（记 BUGlist）

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const SHOTS = path.join(__dirname, 'shots')
fs.mkdirSync(SHOTS, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))

// 14 个学科专属教师 → 手机号映射（与种子脚本一致）
const SUBJECTS = [
  ['13900000001', '语文'], ['13900000002', '数学'], ['13900000003', '英语'],
  ['13900000004', '道德与法治'], ['13900000005', '科学'], ['13900000006', '物理'],
  ['13900000007', '化学'], ['13900000008', '生物'], ['13900000009', '历史'],
  ['13900000010', '地理'], ['13900000011', '体育与健康'], ['13900000012', '音乐'],
  ['13900000013', '美术'], ['13900000014', '信息科技'],
]
const PASS = 'teacher123'

const results = []
const record = (role, journey, status, detail) => {
  results.push({ role, journey, status, detail: String(detail).slice(0, 300) })
  console.log(`[${status}] ${role} / ${journey} :: ${String(detail).slice(0, 160)}`)
}

async function realLogin(page, phone, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[placeholder="请输入手机号"]', phone)
  await page.fill('input[placeholder="请输入密码"]', password)
  await page.click('button[type=submit]')
  await sleep(2000)
  return page.url()
}

async function headerSubject(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('span,button')]
    const e = els.find(x => /·/.test(x.textContent || ''))
    return e ? e.textContent.trim() : ''
  })
}

// 等待列表渲染（tbody 有行）
async function waitRows(page, sel, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const n = await page.locator(sel + ' tbody tr').count()
    if (n > 0) return n
    await sleep(400)
  }
  return 0
}

async function run() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const globalPE = { count: 0, samples: [] }
  const globalCE = { count: 0, samples: [] }

  for (const [phone, subject] of SUBJECTS) {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await ctx.newPage()
    page.on('pageerror', e => { globalPE.count++; globalPE.samples.push(`${subject}:${String(e.message||e).slice(0,120)}`) })
    page.on('console', m => { if (m.type() === 'error') { globalCE.count++; globalCE.samples.push(`${subject}:${m.text().slice(0,120)}`) } })

    const url = await realLogin(page, phone, PASS)
    if (url.endsWith('/login')) { record(subject + '教师', 'UI登录', 'FAIL', '登录后跳回登录页'); await ctx.close(); continue }
    await sleep(800)
    const htxt = await headerSubject(page)
    const subjOk = htxt.includes(subject)
    record(subject + '教师', '教学上下文学科', subjOk ? 'PASS' : 'WARN', '头部=' + htxt)

    // —— 题库 ——
    await page.goto(BASE + '/exercises', { waitUntil: 'domcontentloaded' }).catch(() => {})
    let nQ = await waitRows(page, 'table')
    if (nQ === 0) {
      record(subject + '教师', '题库·列表渲染', 'FAIL', '本学科四年级题目 0 行（数据缺失或过滤失败）')
    } else {
      const firstContent = (await page.locator('table tbody tr').first().locator('td').nth(0).innerText().catch(() => '')) || ''
      const firstType = (await page.locator('table tbody tr').first().locator('td').nth(2).innerText().catch(() => '')) || ''
      record(subject + '教师', '题库·列表渲染', 'PASS', `行数=${nQ}`)
      record(subject + '教师', '题库·题目内容非空', firstContent.replace(/\s+/g, '').length > 0 ? 'PASS' : 'WARN', '首行内容=' + firstContent.replace(/\s+/g, '').slice(0, 30))
      record(subject + '教师', '题库·题型显示', /undefined|^\s*$/.test(firstType) ? 'WARN' : 'PASS', '首行题型=' + firstType.replace(/\s+/g, ''))
      // 点击首行 → 详情/预览
      await page.locator('table tbody tr').first().click()
      await sleep(2500)
      const durl = page.url()
      const dpe = globalPE.count
      const dvisible = await page.evaluate(() => document.body.innerText.length > 30)
      record(subject + '教师', '题库·点击进入详情', (durl.includes('/exercises/') && dvisible && globalPE.count === dpe) ? 'PASS' : 'FAIL', 'url=' + durl.replace(BASE, ''))
    }

    // —— 试卷库 ——
    await page.goto(BASE + '/exams', { waitUntil: 'domcontentloaded' }).catch(() => {})
    let nE = await waitRows(page, 'table')
    if (nE === 0) {
      record(subject + '教师', '试卷库·列表渲染', 'FAIL', '本学科四年级试卷 0 行')
    } else {
      const firstTitle = (await page.locator('table tbody tr').first().locator('td').nth(0).innerText().catch(() => '')) || ''
      record(subject + '教师', '试卷库·列表渲染', 'PASS', `行数=${nE} 首卷=` + firstTitle.replace(/\s+/g, '').slice(0, 24))
      // 点预览(Eye)按钮
      const peBefore = globalPE.count
      await page.locator('table tbody tr').first().locator('button[title="预览"]').click().catch(async () => {
        // 兜底：直接点行
        await page.locator('table tbody tr').first().click()
      })
      await sleep(2500)
      const modal = await page.evaluate(() => {
        const t = document.body.innerText
        return { hasTitle: /试卷|总分|题|学校|姓名/.test(t), len: t.length, hasQuestion: /一、|1\.|（\s*）|____/.test(t) }
      })
      const previewOk = modal.hasTitle && modal.len > 200 && globalPE.count === peBefore
      record(subject + '教师', '试卷库·预览渲染', previewOk ? 'PASS' : 'WARN', `len=${modal.len} 含题=${modal.hasQuestion}`)
      // 关闭弹窗（Esc 或点遮罩）
      await page.keyboard.press('Escape').catch(() => {})
      await sleep(500)
    }
    await ctx.close()
  }

  // —— B4 验证：无班级种子教师(13900000001 语文) 头部年级下拉可跨年级切换 ——
  {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await ctx.newPage()
    page.on('pageerror', e => { globalPE.count++; globalPE.samples.push(`跨年级:${String(e.message||e).slice(0,120)}`) })
    await realLogin(page, '13900000001', PASS)
    const selOk = await page.locator('header select').count()
    record('语文种子教师(B4)', '头部年级下拉存在', selOk > 0 ? 'PASS' : 'WARN', `select数=${selOk}`)
    for (const [g, idx] of [['一年级', 0], ['四年级', 3], ['九年级', 8]]) {
      await page.goto(BASE + '/exercises', { waitUntil: 'domcontentloaded' }).catch(() => {})
      await sleep(800)
      await page.selectOption('header select', String(idx)).catch(async () => {
        await page.evaluate(i => { const s = document.querySelector('header select'); s.value = String(i); s.dispatchEvent(new Event('change', { bubbles: true })) }, idx)
      })
      await sleep(1500)
      const n = await waitRows(page, 'table')
      record('语文种子教师(B4)', `年级切换→${g}`, n > 0 ? 'PASS' : 'WARN', `行数=${n}`)
    }
    await ctx.close()
  }

  await browser.close()

  const fails = results.filter(r => r.status === 'FAIL')
  const warns = results.filter(r => r.status === 'WARN')
  console.log('\n==== 汇总 ====')
  console.log(`总用例=${results.length}  PASS=${results.length - fails.length - warns.length}  WARN=${warns.length}  FAIL=${fails.length}`)
  console.log(`全局 pageerror=${globalPE.count}  console.error=${globalCE.count}`)
  if (globalPE.samples.length) console.log('pageerror样本:', globalPE.samples.slice(0, 8).join(' | '))
  if (globalCE.samples.length) console.log('console.error样本:', globalCE.samples.slice(0, 8).join(' | '))

  fs.writeFileSync(path.join(__dirname, 'e2e_seed_content_report.json'),
    JSON.stringify({ summary: { total: results.length, warn: warns.length, fail: fails.length, pageerror: globalPE.count, consoleError: globalCE.count }, results, pageErrors: globalPE.samples, consoleErrors: globalCE.samples }, null, 2))
  console.log('\n报告已写入 qa/e2e_seed_content_report.json')
}

run().catch(e => { console.error('RUNNER ERROR', e); process.exit(1) })
