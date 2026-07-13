// 验证三个契约修复（预发布 school1.ziwi.cn）
const B = 'http://school1.ziwi.cn'
const post = (u, b, t) => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) }).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) }))
const get = (u, t) => fetch(B + u, { headers: { Authorization: 'Bearer ' + t } }).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) }))
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const L = await post('/api/auth/login', { phone: '13800000002', password: 'teacher123' })
  const t = L.data.token || (L.data.data && L.data.data.token)
  if (!t) { console.log('LOGIN FAIL', JSON.stringify(L)); return }
  console.log('login ok, token len', t.length)
  const out = []

  // ── 修复 #1：单题保存到 /api/exercises（前端 questionBankAPI.save 的新路径）──
  const q1 = await post('/api/exercises', {
    stem: '验证题：1+1=?', question_type: 'choice', answer: '2', analysis: '基础加法',
    subject: '数学', grade: '一年级', difficulty: 'L2', source: 'ai_generated',
  }, t)
  out.push(['#1 单题保存 /api/exercises', q1.status, 'id=' + (q1.data.id || 'NONE')])
  // 旧路径 /api/questions 应 404（确认契约已切换）
  const old = await post('/api/questions', { stem: 'x' }, t)
  out.push(['#1 旧路径 /api/questions', old.status, '(期望404)'])

  // ── 修复 #2：并发建卷，主键为 UUID，不撞 exams_pkey ──
  const mk = (i) => post('/api/exams', { title: '并发验证卷' + i + '_' + Date.now(), subject: '数学', grade: '一年级', total_score: 100, duration_minutes: 45, difficulty: 'L2' }, t)
  const rs = await Promise.all([mk(1), mk(2), mk(3)])
  const ids = rs.map(r => r.data.id)
  const distinct = new Set(ids).size === 3
  const all201 = rs.every(r => r.status === 201)
  out.push(['#2 并发建卷3', rs.map(r => r.status).join(','), 'UUID distinct=' + distinct + ' ids=' + JSON.stringify(ids)])

  // ── 修复 #3：建卷带 curriculum_alignments 并读回（验证列已加+落库）──
  const ex = await post('/api/exams', {
    title: '对标验证卷_' + Date.now(), subject: '数学', grade: '一年级',
    total_score: 100, duration_minutes: 45, difficulty: 'L2',
    curriculum_alignments: JSON.stringify([{ code: 'M-1-1-1', content: '1-20各数的认识', aligned: true }]),
  }, t)
  const exId = ex.data.id
  await sleep(500)
  const got = await get('/api/exams/' + exId, t)
  out.push(['#3 建卷带对标', ex.status, '返回curric=' + JSON.stringify(got.data.curriculum_alignments)])

  // ── 修复 #3b：gen_exam 传 curriculum_codes 应返回非空 curriculum_alignments ──
  const gen = await post('/api/ai/exam/generate', {
    subject: '数学', grade: '一年级', difficulty: 'L2', count: 3,
    question_types: ['choice'], purpose: 'test',
    selected_knowledge_ids: [], curriculum_codes: ['M-1-1-1'],
    textbook_version: '',
  }, t)
  out.push(['#3b gen_exam 对标', gen.status, 'curriculum_alignments=' + JSON.stringify(gen.data.curriculum_alignments)])

  console.log('\n==== 验证结果 ====')
  for (const r of out) console.log(`[${r[0]}] status=${r[1]} | ${r[2]}`)
})().catch(e => { console.log('ERR', e.message) })
