const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const B = 'http://school1.ziwi.cn'

// 登录助手（与既有脚本一致）
async function safeJson(res) {
  const t = await res.text()
  try { return JSON.parse(t) } catch (e) { console.log('BADJSON status=' + res.status + ' head=' + t.slice(0, 120)); throw e }
}
const post = async (u, b, t) => safeJson(await fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(b) }))
const getJ = async (u, t) => safeJson(await fetch(B + u, { headers: { Authorization: 'Bearer ' + t } }))

// 拟真真人课题库（文理不同学科，每次随机抽取，保证"新用例 + 真实产出"）
const CASES = [
  { subject: '物理', grade: '八年级', title: '凸透镜成像规律', extra: '多放实验图示与光路图，结合生活案例（照相机/投影仪）' },
  { subject: '语文', grade: '九年级', title: '岳阳楼记', extra: '突出景物描写层次与"先忧后乐"主旨，适合诵读' },
  { subject: '化学', grade: '九年级', title: '质量守恒定律', extra: '用实验（白磷燃烧/硫酸铜+铁钉）佐证，强调微观解释' },
  { subject: '生物', grade: '七年级', title: '光合作用与呼吸作用', extra: '对比表格呈现，联系农业生产（合理密植/昼夜温差）' },
]

;(async () => {
  fs.mkdirSync(path.join(__dirname, 'downloads'), { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push('console:' + m.text()) })

  const L = await post('/api/auth/login', { phone: '13800000002', password: 'teacher123' })
  const token = L.token
  await page.addInitScript((tok) => { localStorage.setItem('zhiwei_token', tok); try { localStorage.setItem('user', JSON.stringify({ name: '王老师', school_name: '测试校' })) } catch {} }, token)

  // 本次随机抽取 2 个不同课题（若不足则全取）
  const pool = [...CASES]
  const picked = []
  while (picked.length < Math.min(2, pool.length)) {
    const i = Math.floor(Math.random() * pool.length)
    picked.push(pool.splice(i, 1)[0])
  }
  console.log('本轮拟真课题：', picked.map(c => `${c.subject}${c.grade}《${c.title}》`).join('  |  '))

  const report = { cases: [], pass: true }
  const fail = (name, ok, info) => { if (!ok) report.pass = false; console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' :: ' + info : '')) }

  for (const c of picked) {
    const stamp = Date.now()
    const title = `${c.title}_拟真_${stamp}`
    const caseR = { subject: c.subject, grade: c.grade, title: c.title, steps: {}, errors: [] }
    try {
      // 1) 进入素材库，打开 AI 生成课件
      await page.goto(B + '/materials', { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
      await page.getByRole('button', { name: 'AI 生成课件' }).click()
      await page.waitForSelector('text=AI 生成课件', { timeout: 8000 })
      const dlg = page.locator('div.fixed.inset-0.z-50').filter({ hasText: 'AI 生成课件' }).last()

      // 2) 选学科 / 年级 / 填课题（限定在生成对话框内，避免跨 DOM 误匹配）
      await dlg.locator('div.grid.grid-cols-2 select').nth(0).selectOption(c.subject)
      await dlg.locator('div.grid.grid-cols-2 select').nth(1).selectOption(c.grade)
      await dlg.locator('input[placeholder="如：光的折射定律"]').fill(title)
      const extra = dlg.locator('textarea[placeholder*="多放实验图示"]')
      if (await extra.count() > 0) await extra.fill(c.extra)
      // 发散度=标准（默认）；开启边缘知识（科学探究精神）
      await dlg.locator('label:has-text("融入价值观") input').check()
      const edge = dlg.locator('label:has-text("科学探究精神") input')
      if (await edge.count() > 0) await edge.check()

      // 3) 课前问诊（出现则作答，超时跳过不阻塞）
      try {
        await page.waitForSelector('p:has-text("课前问诊")', { timeout: 12000 })
        const quizBox = page.locator('div', { has: page.locator('p', { hasText: '课前问诊' }) })
        const qsel = quizBox.locator('select')
        const n = await qsel.count()
        for (let i = 0; i < n; i++) {
          const opts = await qsel.nth(i).locator('option').count()
          if (opts > 1) await qsel.nth(i).selectOption({ index: 1 }).catch(() => {})
        }
        caseR.steps.consult = 'answered ' + n
      } catch (e) { caseR.steps.consult = 'skip(no load)' }

      // 4) 生成课件（AI 可能较慢，长超时）
      await dlg.getByRole('button', { name: '生成课件', exact: true }).click()
      await page.waitForSelector('text=PPT 课件提纲', { timeout: 90000 })
      await page.waitForTimeout(500)

      // 5) 丰富性统计：提纲页数 + 每页要点数
      const pages1 = await page.locator('span', { hasText: /^P\d+$/ }).count()
      const tas1 = await page.locator('textarea[placeholder="每条要点一行"]').count()
      let bullets1 = 0
      for (let i = 0; i < tas1; i++) {
        const v = await page.locator('textarea[placeholder="每条要点一行"]').nth(i).inputValue()
        bullets1 += v.split('\n').filter(x => x.trim()).length
      }
      caseR.steps.genPages = pages1
      caseR.steps.genBullets = bullets1
      caseR.steps.genTextarea = tas1
      fail(`[${c.subject}${c.grade}·${c.title}] 生成-提纲页数充足(>=5)`, pages1 >= 5, 'pages=' + pages1)
      fail(`[${c.subject}${c.grade}·${c.title}] 生成-要点充实(总>=10)`, bullets1 >= 10, 'bullets=' + bullets1)

      // 6) AI 润色提纲（render-ppt，精炼要点 + 讲稿）
      await page.locator('button:has-text("✨ AI 润色提纲")').click()
      await page.waitForSelector('button:has-text("✨ AI 润色提纲"):not([disabled])', { timeout: 90000 })
      await page.waitForTimeout(500)
      const pages2 = await page.locator('span', { hasText: /^P\d+$/ }).count()
      const tas2 = await page.locator('textarea[placeholder="每条要点一行"]').count()
      let bullets2 = 0
      for (let i = 0; i < tas2; i++) {
        const v = await page.locator('textarea[placeholder="每条要点一行"]').nth(i).inputValue()
        bullets2 += v.split('\n').filter(x => x.trim()).length
      }
      caseR.steps.polishPages = pages2
      caseR.steps.polishBullets = bullets2
      fail(`[${c.subject}${c.grade}·${c.title}] 润色-提纲仍丰富(>=5)`, pages2 >= 5, 'pages=' + pages2)

      // 7) 播放 / 阅读（PPT 在线预览，验证页数）
      await page.locator('button:has-text("播放 / 阅读")').click()
      await page.waitForSelector('text=PPT 在线预览', { timeout: 10000 })
      await page.waitForTimeout(400)
      const pgText = await page.locator('.fixed.inset-0.z-\\[70\\]').locator('text=/\\d+ \\/ \\d+/').first().innerText().catch(() => '0 / 0')
      const playTotal = parseInt((pgText.match(/\/\s*(\d+)/) || [])[1] || '0', 10)
      caseR.steps.playTotal = playTotal
      fail(`[${c.subject}${c.grade}·${c.title}] 播放-幻灯片页数(>=6)`, playTotal >= 6, 'total=' + playTotal)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)

      // 8) 导出 PPT（前端 pptxgenjs 生成下载）
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        page.locator('button:has-text("导出 PPT")').click(),
      ])
      const fname = path.join(__dirname, 'downloads', `${title}.pptx`)
      await dl.saveAs(fname)
      const sz = fs.existsSync(fname) ? fs.statSync(fname).size : 0
      caseR.steps.pptxBytes = sz
      fail(`[${c.subject}${c.grade}·${c.title}] 导出PPT成功(>0)`, sz > 0, 'bytes=' + sz)

      // 9) 保存到素材库（入库，数据保留）
      await page.locator('button:has-text("保存到素材库")').click()
      let saved = false
      try {
        await page.waitForSelector('text=课件已保存到素材库', { timeout: 20000 })
        saved = true
      } catch (e) {
        const blocked = await page.locator('text=发布校验未通过').count()
        caseR.steps.blockedByValidate = blocked > 0
      }
      if (saved) {
        const mats = await getJ('/api/materials', token)
        const items = mats.items || mats.data || []
        saved = items.some(m => (m.name || '').includes(title))
      }
      caseR.steps.saved = saved
      fail(`[${c.subject}${c.grade}·${c.title}] 保存到素材库成功`, saved, saved ? '已入库' : '未入库(数据保留在预览未通过校验?)')
    } catch (e) {
      caseR.error = e.message
      report.pass = false
      console.log('FAIL 课题异常 :: ' + c.title + ' :: ' + e.message)
    }
    report.cases.push(caseR)
    // 回到素材库，准备下一个（不删除任何数据）
    await page.goto(B + '/materials', { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(500)
  }

  fail('全局-页面错误数', errors.length === 0, 'errors=' + errors.slice(0, 4).join(' | '))

  // 记录本次拟真运行（保留痕迹，便于追溯"每次新用例"）
  const logLine = `[${new Date().toISOString()}] 拟真课题: ${picked.map(c => c.subject + c.grade + '《' + c.title + '》').join('; ')} | 结果: ${report.pass ? 'PASS' : 'FAIL'}\n`
  fs.appendFileSync(path.join(__dirname, 'realistic_runs.log'), logLine)

  await browser.close()
  console.log('REPORT ' + JSON.stringify(report, null, 2))
})().catch(e => { console.log('FATAL', e.message); console.log(e.stack); process.exit(1) })
