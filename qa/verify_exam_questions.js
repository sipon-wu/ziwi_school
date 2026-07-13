const B = 'http://school1.ziwi.cn'
const post = (u, b, t) => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) }).then(r => r.json())
const get = (u, t) => fetch(B + u, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json())

;(async () => {
  const L = await post('/api/auth/login', { phone: '13800000002', password: 'teacher123' })
  const t = L.token || (L.data && L.data.token)
  if (!t) { console.log('LOGIN FAIL', JSON.stringify(L)); return }
  console.log('token len', t.length)

  const qs = [
    { id: 'ai_verify_1', stem: '1+1=?', type: 'choice', options: 'A.1 B.2 C.3', answer: 'B', analysis: '基础运算', difficulty: 'L2', score: 10, sort: 1 },
    { id: 'ai_verify_2', stem: '2×3=?', type: 'choice', options: 'A.5 B.6 C.7', answer: 'B', analysis: '乘法口诀', difficulty: 'L2', score: 10, sort: 2 },
  ]
  const createBody = {
    title: '验证-题目落库', subject: '数学', grade: '四年级',
    questions: JSON.stringify(qs),
    total_score: 100, duration_minutes: 45, status: 'draft',
    curriculum_alignments: JSON.stringify(['GB-MATH-4-01']),
  }
  const c = await post('/api/exams', createBody, t)
  console.log('CREATE status ok? id=', c.id || c.ID, 'err=', c.error || '')

  if (!c.id && !c.ID) { console.log('CREATE FAILED', JSON.stringify(c)); return }
  const id = c.id || c.ID
  const g = await get('/api/exams/' + id, t)
  let parsed = []
  try { parsed = typeof g.questions === 'string' ? JSON.parse(g.questions) : (g.questions || []) } catch (e) { parsed = [] }
  console.log('READ BACK questions length =', parsed.length)
  console.log('first q stem =', parsed[0] && (parsed[0].stem || parsed[0].content))
  console.log('curriculum_alignments =', g.curriculum_alignments || g.CurriculumAlign)

  // 对比旧行为：只传 question_ids（题目不应落库）
  const oldBody = { title: '验证-旧行为', subject: '数学', grade: '四年级', question_ids: ['ai_x1', 'ai_x2'], total_score: 100, status: 'draft' }
  const o = await post('/api/exams', oldBody, t)
  if (o.id || o.ID) {
    const og = await get('/api/exams/' + (o.id || o.ID), t)
    let op = []
    try { op = typeof og.questions === 'string' ? JSON.parse(og.questions) : (og.questions || []) } catch (e) { op = [] }
    console.log('OLD-BEHAVIOR (question_ids only) questions length =', op.length, '(预期 0)')
  }
  console.log(parsed.length === 2 ? 'PASS: 题目已落库' : 'FAIL: 题目未落库')
})()
