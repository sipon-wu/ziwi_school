const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

// 五类资源：列表端点 + 路径前缀 + 场景关键词
const RES = [
  { key: 'lessonplan', api: '/api/lesson-plans', prefix: 'lesson-plans', scene: '教案' },
  { key: 'exercise',   api: '/api/exercises',    prefix: 'exercises',    scene: '习题' },
  { key: 'exam',       api: '/api/exams',         prefix: 'exams',        scene: '试卷' },
  { key: 'sheet',      api: '/api/sheets',        prefix: 'sheets',      scene: '题单' },
  { key: 'assignment', api: '/api/assignments',   prefix: 'assignments', scene: '作业' },
]

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('CONSOLE: ' + m.text()) })

  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const j = await r.json()
  const token = j.token || (j.data && j.data.token)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.evaluate((t) => localStorage.setItem('zhiwei_token', t), token)

  // 取每类一个真实 id（无则用占位 id 仅验证路由映射）
  const ids = {}
  for (const res of RES) {
    try {
      const rr = await fetch(`${BASE}${res.api}`, { headers: { Authorization: 'Bearer ' + token } })
      const jj = await rr.json()
      const arr = Array.isArray(jj) ? jj : (jj.data || jj.items || (jj.list) || [])
      ids[res.key] = arr[0] ? arr[0].id : ('__dummy__' + res.key)
    } catch (e) { ids[res.key] = '__dummy__' + res.key }
  }

  let allPass = true

  for (const res of RES) {
    const id = ids[res.key]
    const viewUrl = `${BASE}/${res.prefix}/${id}`
    await page.goto(viewUrl, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2600)
    const v = await page.evaluate((scene) => {
      const body = (document.body.innerText || '').replace(/\s+/g, ' ')
      const btns = [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim())
      const hasEditor = btns.some(t => t === 'AI 模式' || t === '文档模式')
      const hasEdit = btns.some(t => t === '编辑')
      return { rendered: body.length > 150 && (hasEditor || hasEdit || body.includes(scene)), login: location.pathname === '/login', path: location.pathname }
    }, res.scene)
    const viewOk = v.rendered && !v.login && v.path.endsWith(String(id))

    const editUrl = viewUrl + '/edit'
    await page.goto(editUrl, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2600)
    const e = await page.evaluate((scene) => {
      const body = (document.body.innerText || '').replace(/\s+/g, ' ')
      const btns = [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim())
      const hasEditor = btns.some(t => t === 'AI 模式' || t === '文档模式')
      const hasEdit = btns.some(t => t === '编辑')
      return { rendered: body.length > 150 && (hasEditor || hasEdit || body.includes(scene)), login: location.pathname === '/login', path: location.pathname }
    }, res.scene)
    const editOk = e.rendered && !e.login && e.path.endsWith('/edit')

    // 旧链接兼容
    let compatOk = true, compatMsg = ''
    if (res.key === 'exercise') {
      await page.goto(viewUrl + '?preview=1', { waitUntil: 'networkidle' }); await page.waitForTimeout(2200)
      const c = await page.evaluate((scene) => {
        const body = (document.body.innerText || '').replace(/\s+/g, ' ')
        const btns = [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim())
        const hasEditor = btns.some(t => t === 'AI 模式' || t === '文档模式')
        return { rendered: body.length > 150 && (hasEditor || body.includes(scene)), login: location.pathname === '/login' }
      }, res.scene)
      compatOk = c.rendered && !c.login; compatMsg = '?preview=1兼容'
    } else if (res.key === 'lessonplan') {
      await page.goto(viewUrl + '/view', { waitUntil: 'networkidle' }); await page.waitForTimeout(2200)
      const c = await page.evaluate((scene) => {
        const body = (document.body.innerText || '').replace(/\s+/g, ' ')
        const btns = [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim())
        const hasEdit = btns.some(t => t === '编辑')
        return { rendered: body.length > 150 && (hasEdit || body.includes(scene)), login: location.pathname === '/login' }
      }, res.scene)
      compatOk = c.rendered && !c.login; compatMsg = '/view兼容'
    }

    const pass = viewOk && editOk && compatOk
    if (!pass) allPass = false
    console.log(`[${res.key}] view(/:id)=${viewOk} edit(/:id/edit)=${editOk} ${compatMsg && compatOk !== undefined ? compatMsg + '=' + compatOk : ''} => ${pass ? 'PASS' : 'FAIL'}`)
    if (!viewOk) console.log(`    view path=${v.path} rendered=${v.rendered} login=${v.login}`)
    if (!editOk) console.log(`    edit path=${e.path} rendered=${e.rendered} login=${e.login}`)
  }

  console.log('=== errors ===')
  console.log(pageErrors.length ? pageErrors.slice(0, 10).join('\n') : '(none)')
  console.log(allPass ? 'ALL PASS' : 'SOME FAIL')
  await browser.close()
  process.exit(allPass ? 0 : 1)
})().catch(e => { console.error('SCRIPT_FAIL', e); process.exit(1) })
