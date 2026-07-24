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
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const pe = [], cerr = [], clog = []
  page.on('pageerror', e => pe.push(String(e.message || e)))
  page.on('console', m => { const t = m.type(); if (t === 'error') cerr.push(m.text()); else if (t==='warning') clog.push(m.text()) })
  page.on('response', async (resp) => {
    if (resp.url().includes('/api/ai/exam/generate')) {
      let b=''; try { b=(await resp.text()).slice(0,200) } catch {}
      console.error('RESP generate status=', resp.status(), 'len=', (await resp.text()).length)
    }
  })

  await realLogin(page, '13800000002', 'teacher123')
  await page.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(8000)

  try {
    await page.locator('button', { hasText: '小微对话' }).first().click()
    await sleep(1500)
    const inp = page.locator('input[placeholder="输入补充需求..."]')
    await inp.fill('请出几道基础选择题'); await inp.press('Enter')
    await sleep(13000)
    const apply = page.locator('button', { hasText: '应用到当前内容' })
    if (await apply.count() > 0) await apply.first().click()
  } catch (e) { console.error('FLOW ERR', e.message) }

  await sleep(20000)
  const dom = await page.evaluate(() => {
    const cards = document.querySelectorAll('.bg-\\[\\#F6F7F8\\]').length
    const hasStudentWord = /学生卷 Word/.test(document.body.innerText)
    const hasFail = /出题失败/.test(document.body.innerText)
    const loading = /正在生成|生成中/.test(document.body.innerText)
    // 找加载态按钮
    const genBtn = [...document.querySelectorAll('button')].find(b => /小微对话|生成/.test(b.innerText||''))
    return { cards, hasStudentWord, hasFail, loading, genBtnText: genBtn ? (genBtn.innerText||'').replace(/\s+/g,' ').trim() : null, bodySnip: document.body.innerText.slice(0, 200) }
  })
  console.log('=== DOM after wait ===')
  console.log(JSON.stringify(dom, null, 2))
  console.log('=== pageerror ===', JSON.stringify(pe.slice(0,5)))
  console.log('=== console.error ===', JSON.stringify(cerr.slice(0,8), null, 2))
  console.log('=== console.warn(count) ===', clog.length)
  await browser.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
