// 取已完成批量重跑的课件，按 theme 各选一个代表，本地用新骨架渲染器渲染并截图。
import fs from 'fs'
import { chromium } from 'playwright'
const { markdownToStorybookH5 } = await import('file:///Users/sipon/CodeBuddy/AI教案/qa/dist-h5/courseware-h5.mjs')
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const BASE = 'https://school1.ziwi.cn/api'
const SHOTS = '/Users/sipon/CodeBuddy/AI教案/qa/batch_shots'
fs.mkdirSync(SHOTS, { recursive: true })

const done = new Set(JSON.parse(fs.readFileSync('/tmp/batch_regen_progress.json')))
const { token } = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
})).json()
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
const list = await (await fetch(`${BASE}/materials`, { headers: H })).json()
const items = (list.items || []).filter((it) => done.has(it.id))
const byTheme = {}
for (const it of items) if (!byTheme[it.theme_id]) byTheme[it.theme_id] = it
const reps = Object.values(byTheme)
console.log('代表风格数', reps.length, reps.map((r) => r.theme_id))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 })
const outs = []
for (const it of reps) {
  const det = await (await fetch(`${BASE}/materials/${it.id}`, { headers: H })).json()
  const md = det.content || ''
  const html = markdownToStorybookH5(md, {
    subject: it.subject, grade: it.grade, title: it.name || '课件',
    teacherName: '李老师', themeId: it.theme_id, colorRoot: '',
  })
  const f = `${SHOTS}/${it.theme_id}.html`
  fs.writeFileSync(f, html)
  await page.goto('file://' + f)
  await page.waitForTimeout(400)
  const p = `${SHOTS}/${it.theme_id}.png`
  await page.screenshot({ path: p })
  outs.push(p)
  console.log('截图', it.theme_id, it.name)
}
await browser.close()
console.log('OUTS ' + outs.join(' '))
