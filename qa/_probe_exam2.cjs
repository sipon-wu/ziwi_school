const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function realLogin(page, phone, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.fill('input[placeholder="请输入手机号"]', phone)
  await page.fill('input[placeholder="请输入密码"]', password)
  await page.click('button[type=submit]')
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await sleep(2500)
}

;(async () => {
  console.error('BOOT')
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const pe = []
  page.on('pageerror', e => pe.push(String(e.message || e)))
  const netlog = []
  page.on('response', async (resp) => {
    const u = resp.url()
    if (u.includes('/api/ai/exam/generate')) {
      let b = ''
      try { b = (await resp.text()).slice(0, 600) } catch {}
      netlog.push({ status: resp.status(), body: b })
      console.error('RESP generate status=', resp.status(), 'body=', b.slice(0, 300))
    }
  })
  page.on('requestfailed', r => { if (r.url().includes('/api/ai/exam/generate')) console.error('REQ FAILED', r.failure() && r.failure().errorText) })

  await realLogin(page, '13800000002', 'teacher123')
  console.error('LOGGED')

  await page.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(8000)

  // 读取 autoSelect 选中的知识点 ID 数
  const sel = await page.evaluate(() => {
    const m = document.body.innerText.match(/\((\d+)\/12\)/)
    return m ? m[1] : 'NA'
  })
  console.error('selectedIds count =', sel)

  let detail = ''
  try {
    await page.locator('button', { hasText: '小微对话' }).first().click()
    await sleep(1500)
    const inp = page.locator('input[placeholder="输入补充需求..."]')
    await inp.fill('请出几道基础选择题'); await inp.press('Enter')
    await sleep(13000)
    const apply = page.locator('button', { hasText: '应用到当前内容' })
    if (await apply.count() > 0) {
      await apply.first().click()
      await page.waitForFunction(() => /学生卷 Word|重新生成|出题失败/.test(document.body.innerText), { timeout: 60000 }).catch(() => {})
      const hasQ = await page.evaluate(() => /学生卷 Word|重新生成/.test(document.body.innerText))
      const failed = await page.evaluate(() => { const m = document.body.innerText.match(/出题失败[:：]?([^\n]*)/); return m ? m[0] : null })
      detail = hasQ ? 'PASS:题目已渲染' : (failed ? 'FAIL toast=' + failed : 'WARN 60s未渲染')
    } else { detail = 'apply按钮未出现' }
  } catch (e) { detail = 'ERR ' + e.message }
  console.log('=== 出题端到端 ===', detail)
  console.log('=== netlog(后端响应) ===', JSON.stringify(netlog, null, 2))
  console.log('=== pageerror count=', pe.length, JSON.stringify(pe.slice(0,3)))
  await browser.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
