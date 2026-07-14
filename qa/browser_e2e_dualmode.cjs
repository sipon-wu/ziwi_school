const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'

async function safeJson(res) {
  const t = await res.text()
  try { return JSON.parse(t) } catch (e) { console.log('BADJSON status=' + res.status + ' head=' + t.slice(0, 100)); throw e }
}
const post = async (u, b, t) => safeJson(await fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (t || '') }, body: JSON.stringify(b) }))
const getJ = async (u, t) => safeJson(await fetch(B + u, { headers: { Authorization: 'Bearer ' + (t || '') } }))
const del = (u, t) => fetch(B + u, { method: 'DELETE', headers: { Authorization: 'Bearer ' + (t || '') } }).then(r => r.status)

;(async () => {
  const report = { steps: [], pass: true }
  const log = (name, ok, info) => { report.steps.push({ name, ok, info }); if (!ok) report.pass = false; console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' :: ' + info : '')) }

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push('console:' + m.text()) })

  const L = await post('/api/auth/login', { phone: '13800000002', password: 'teacher123' })
  const token = L.token
  await page.addInitScript((tok) => { localStorage.setItem('zhiwei_token', tok); try { localStorage.setItem('user', JSON.stringify({ name: '王老师', school_name: '测试校' })) } catch {} }, token)

  // 1) 草稿箱修复：建一条异学科/年级草稿（修复前会被全局上下文硬藏）
  const titleA = '双模式验收_物理七年级_' + Date.now()
  await post('/api/lesson-plans', { title: titleA, subject: '物理', grade: '七年级', status: 'draft', content: '# 验收正文' }, token)
  await page.goto(B + '/lesson-plans', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const visibleA = await page.locator(`text=${titleA}`).count()
  log('草稿箱修复-异学科草稿可见', visibleA > 0, 'count=' + visibleA)

  // 2) 双模式编辑器
  await page.goto(B + '/lesson-plans/new', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const hasToggle = await page.locator('text=文档模式').count()
  log('编辑器-模式切换可见', hasToggle > 0)
  await page.locator('button:has-text("文档模式")').first().click()
  await page.waitForTimeout(3000)
  const hasMd = await page.locator('.w-md-editor').count()
  log('文档模式-MDEditor 渲染', hasMd > 0, 'editors=' + hasMd)
  const ta = page.locator('.w-md-editor textarea').first()
  if (await ta.count() > 0) { await ta.click(); await ta.fill('# 文档模式正文\n\n腾讯文档式自由排版验收。'); await page.waitForTimeout(300) }
  const titleInput = page.locator('input[placeholder="请在这里输入标题"]')
  if (await titleInput.count() > 0) await titleInput.fill('双模式验收_文档模式_' + Date.now())
  await page.locator('button:has-text("保存为草稿")').click()
  await page.waitForTimeout(1500)
  await page.goto(B + '/lesson-plans', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const savedDoc = await page.locator(`text=双模式验收_文档模式`).count()
  log('文档模式-保存落库', savedDoc > 0, 'count=' + savedDoc)

  // 3) 预览编辑选择浮层
  const planLink = page.locator('tr:has-text("双模式验收_文档模式")').first()
  if (await planLink.count() > 0) {
    await planLink.click()
    await page.waitForTimeout(1000)
    await page.locator('button:has-text("编辑")').click()
    await page.waitForTimeout(500)
    const chooser = await page.locator('text=选择编辑模式').count()
    log('预览-编辑选择浮层出现', chooser > 0)
    if (chooser > 0) {
      await page.locator('button:has-text("文档模式")').first().click()
      await page.waitForTimeout(3000)
      const url = page.url()
      const md2 = await page.locator('.w-md-editor').count()
      log('浮层-选文档模式进入编辑器', url.includes('mode=doc') && md2 > 0, 'url=' + url + ' md=' + md2)
    }
  } else {
    log('预览-编辑选择浮层出现', false, '未找到计划链接')
  }

  log('页面错误数', errors.length === 0, 'errors=' + errors.slice(0, 3).join(' | '))

  // 清理
  const list = await getJ('/api/lesson-plans', token)
  const items = list.items || []
  let cleaned = 0
  for (const p of items) { if (/双模式验收/.test(p.title || '')) { await del('/api/lesson-plans/' + p.id, token); cleaned++ } }
  console.log('cleaned:', cleaned)

  await browser.close()
  console.log('REPORT ' + JSON.stringify(report))
})().catch(e => { console.log('FATAL', e.message); console.log(e.stack); process.exit(1) })
