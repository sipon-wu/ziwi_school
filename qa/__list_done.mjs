import fs from 'fs'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const BASE = 'https://school1.ziwi.cn/api'
const ids = JSON.parse(fs.readFileSync('/tmp/batch_regen_progress.json'))
const { token } = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
})).json()
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
const rows = []
for (const id of ids) {
  const d = await (await fetch(`${BASE}/materials/${id}`, { headers: H })).json()
  rows.push({ id, name: d.name || d.title || '(无名称)', theme: d.theme_id || '', subject: d.subject || '', grade: d.grade || '' })
}
rows.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
let out = `已完成重跑课件（共 ${rows.length} 个）\n`
for (const r of rows) out += `${r.name} | ${r.subject}${r.grade} | 风格:${r.theme} | ID:${r.id}\n`
fs.writeFileSync('/Users/sipon/CodeBuddy/AI教案/qa/__done_list.txt', out)
console.log(out)
