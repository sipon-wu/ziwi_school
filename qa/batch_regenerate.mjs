// 批量重跑现有课件：用新风格骨架语言（api_server 已注入）重新生成 H5 课件内容并回写。
// 百炼限流策略：并发 1、间隔 2s、429 退避 30s 重试最多 3 次、网络错重试；断点续跑（进度文件）。
// 用法：node batch_regenerate.mjs [limit]   例：node batch_regenerate.mjs 3   （先小批验证）
import fs from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { markdownToStorybookH5 } = await import('file:///Users/sipon/CodeBuddy/AI教案/qa/dist-h5/courseware-h5.mjs')
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const BASE = 'https://school1.ziwi.cn/api'
const THEME2STYLE = {
  'zgf-ink-wash': 'china', 'te-quantum-blue': 'tech', 'fr-mint': 'fresh',
  'aca-edu-blue': 'academic', 'sp-cartoon': 'cartoon', 'min-classic-blue': 'minimal',
}
const LIMIT = process.argv[2] ? parseInt(process.argv[2], 10) : 9999
const PROGRESS = '/tmp/batch_regen_progress.json'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const done = new Set(fs.existsSync(PROGRESS) ? JSON.parse(fs.readFileSync(PROGRESS)) : [])

const { token } = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
})).json()
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

async function gen(lesson, subject, grade, style) {
  const r = await fetch(`${BASE}/ai/courseware/generate`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      subject, grade, lesson_title: lesson, content: '', school_id: 'sch-0001',
      textbook_version: '', selected_knowledge_ids: [], knowledge_points: [],
      prerequisite_points: [], curriculum_codes: [], divergence_level: 'standard',
      edge_enabled: false, edge_categories: [], style_tag: style, style_profile: '',
      style_mode: 'preset', format: 'h5',
    }),
  })
  if (r.status === 429) { const e = new Error('rate'); e.retry = true; throw e }
  const j = await r.json()
  return j.courseware_markdown || ''
}

const list = await (await fetch(`${BASE}/materials`, { headers: H })).json()
let items = (list.items || []).filter((it) => it.format === 'h5' || it.type === 'courseware')
items = items.filter((it) => !done.has(it.id)).slice(0, LIMIT)
console.log(`待处理 ${items.length} 个（已跳过 ${done.size} 个已完成）`)

for (const it of items) {
  const lesson = (it.name || '').match(/《[^》]+》/)?.[0] || it.name || '未命名课题'
  const style = THEME2STYLE[it.theme_id] || 'china'
  let md = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    try { md = await gen(lesson, it.subject, it.grade, style); break }
    catch (e) {
      if (e.retry) { console.log(`  [${it.id}] 429 退避30s (${attempt + 1}/3)`); await sleep(30000); continue }
      throw e
    }
  }
  if (!md) { console.log(`  [${it.id}] 生成失败，跳过`); continue }
  const html = markdownToStorybookH5(md, {
    subject: it.subject, grade: it.grade, title: lesson, teacherName: '李老师',
    themeId: it.theme_id, colorRoot: '',
  })
  const r = await fetch(`${BASE}/materials/${it.id}`, {
    method: 'PUT', headers: H,
    body: JSON.stringify({
      content: md, h5_html: html, subject: it.subject, grade: it.grade,
      theme_id: it.theme_id, name: it.name, format: it.format || 'h5', type: it.type || 'courseware',
    }),
  })
  console.log(`  [${it.id}] 更新 status=${r.status} lesson=${lesson} style=${style}`)
  done.add(it.id)
  fs.writeFileSync(PROGRESS, JSON.stringify([...done]))
  await sleep(2000)
}
console.log('BATCH_DONE')
