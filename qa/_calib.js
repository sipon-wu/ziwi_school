const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const SCHOOL = process.env.SCHOOL || '00000000-4000-0000-0000-000000000001'

async function post(path, body, token) {
  const r = await fetch(BASE + '/api' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  })
  const txt = await r.text()
  let json
  try { json = JSON.parse(txt) } catch { json = { _raw: txt.slice(0, 300) } }
  return { status: r.status, json }
}

;(async () => {
  console.log('== connectivity ==')
  const h = await post('/ai/health', {})
  console.log('health', h.status, JSON.stringify(h.json).slice(0, 120))

  console.log('== login ==')
  const login = await post('/auth/login', { phone: '13800000002', password: 'teacher123' })
  console.log('login', login.status, Object.keys(login.json))
  const token = login.json.token || login.json.data?.token
  console.log('token?', !!token, 'len', token ? token.length : 0)
  if (!token) { console.log('LOGIN FAIL', JSON.stringify(login.json).slice(0, 300)); process.exit(1) }

  const cases = [
    ['courseware', '/ai/courseware/generate', { subject: '语文', grade: '四年级', lesson_title: '观潮', school_id: SCHOOL, divergence_level: 'standard' }],
    ['exam', '/ai/exam/generate', { subject: '数学', grade: '三年级', lesson_title: '分数的初步认识', school_id: SCHOOL, count: 5, types: ['choice', 'fill'], difficulty: 'L2' }],
    ['lessonplan', '/ai/lesson-plan/generate', { subject: '英语', grade: '五年级', lesson_title: 'My Family', school_id: SCHOOL, period: 1, format_template: '3d_objective' }],
  ]
  for (const [name, path, body] of cases) {
    const t0 = Date.now()
    let res, tries = 0
    while (tries < 3) {
      tries++
      res = await post(path, body, token)
      if (res.status === 200 && !res.json._raw) break
      await new Promise(r => setTimeout(r, 4000))
    }
    const ms = Date.now() - t0
    const j = res.json
    console.log(`\n== ${name} (${ms}ms, status ${res.status}, tries ${tries}) ==`)
    console.log('keys:', Object.keys(j).join(','))
    if (name === 'courseware') {
      console.log('md len', (j.courseware_markdown || '').length, 'divergence', (j.divergence_map || []).length, 'gen_ms', j.generation_time_ms)
    } else if (name === 'exam') {
      console.log('questions', (j.questions || []).length, 'curric', (j.curriculum_alignments || []).length, 'gen_ms', j.generation_time_ms)
    } else {
      console.log('content len', (j.content || '').length, 'curric', (j.curriculum_alignments || []).length, 'gen_ms', j.generation_time_ms)
    }
  }
  console.log('\nDONE')
})().catch(e => { console.error('ERR', e); process.exit(1) })
