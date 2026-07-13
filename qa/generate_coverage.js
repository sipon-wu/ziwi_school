// 预发布环境全量产出物生成 + 指标采集
// 目标：每个年级×学科 ≥3 个真实 AI 产出物（课件+出题+教案）留存平台，并记录真实场景指标。
const fs = require('fs')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const SCHOOL = process.env.SCHOOL || '00000000-4000-0000-0000-000000000001'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const CONC = parseInt(process.env.CONC || '3', 10)
const ONLY = process.env.ONLY || '' // 可选：只跑某个学科做分批
const GRADEONLY = process.env.GRADEONLY || '' // 可选：只跑某个年级

const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理']
const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']
const KG_MAP = { '生物学': '生物', '思想政治': '政治', '道德与法治': '政治' }
const EXAM_TYPES = {
  '语文': ['choice', 'fill', 'reading', 'essay'],
  '数学': ['choice', 'fill', 'calculation', 'application'],
  '英语': ['choice', 'fill', 'reading', 'cloze'],
  '物理': ['choice', 'fill', 'calculation', 'application'],
  '化学': ['choice', 'fill', 'calculation', 'application'],
  '生物': ['choice', 'fill', 'short_answer', 'application'],
  '政治': ['choice', 'fill', 'essay', 'short_answer'],
  '历史': ['choice', 'fill', 'essay', 'short_answer'],
  '地理': ['choice', 'fill', 'short_answer', 'application'],
}
// 串行化考试保存：后端 exams 主键为时间戳，并发写入会撞主键（exams_pkey 重复）
let _examLock = Promise.resolve()
function withExamLock(fn) {
  const run = _examLock.then(fn, fn)
  _examLock = run.then(() => {}, () => {})
  return run
}

const GENERIC = {
  '语文': '阅读与表达', '数学': '数与代数', '英语': 'Unit 话题',
  '物理': '力与运动', '化学': '物质的变化', '生物': '生命的结构',
  '政治': '品格与责任', '历史': '朝代与文明', '地理': '家乡与地球',
}

// 从知识图谱解析真实课题名（按学科/年级）
function buildTopicMap() {
  const obj = JSON.parse(fs.readFileSync(__dirname + '/../code/backend/data/knowledge_seed.json', 'utf8'))
  const nodes = obj.kg_nodes || []
  const map = {}
  for (const n of nodes) {
    const p = (n.version_key || '').split('_')
    const subj = KG_MAP[p[1]] || p[1]
    const grade = p[3] || ''
    if (!SUBJECTS.includes(subj) || !GRADES.includes(grade)) continue
    const key = subj + '|' + grade
    map[key] = map[key] || []
    if (n.ming_cheng && !map[key].includes(n.ming_cheng)) map[key].push(n.ming_cheng)
  }
  return map
}
const TOPIC_MAP = buildTopicMap()

function topicsFor(subj, grade) {
  const t = TOPIC_MAP[subj + '|' + grade] || []
  if (t.length >= 3) return t.slice(0, 3)
  const out = t.slice()
  let i = 0
  while (out.length < 3) { out.push((t[i % Math.max(1, t.length)] || GENERIC[subj]) + (t.length ? '' : `（${grade}）`)); i++ }
  return out
}

const PROGRESS = __dirname + '/coverage_progress.json'
const METRICS = __dirname + '/coverage_metrics.json'
function loadJSON(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }
let progress = loadJSON(PROGRESS, {})
let metrics = loadJSON(METRICS, [])

async function post(path, body, token) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 90000)
  try {
    const r = await fetch(BASE + '/api' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const txt = await r.text()
    let json
    try { json = JSON.parse(txt) } catch { json = { _raw: txt.slice(0, 200) } }
    return { status: r.status, json }
  } catch (e) {
    return { status: 0, json: { _err: String(e) } }
  } finally {
    clearTimeout(t)
  }
}
async function callWithRetry(path, body, token, tries = 5) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      const res = await post(path, body, token)
      if (res.status === 200 && !res.json._raw && !String(res.json.code || '').includes('FAIL') && !String(res.json.code || '').includes('UNAVAILABLE')) return res
      last = res
    } catch (e) { last = { status: 0, json: { _err: String(e) } } }
    await new Promise(r => setTimeout(r, 3000 * (i + 1)))
  }
  return last
}
async function saveWithRetry(path, body, token, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      const res = await post(path, body, token)
      if (res.status === 200) return res
      last = res
    } catch (e) { last = { status: 0, json: { _err: String(e) } } }
    await new Promise(r => setTimeout(r, 2000 * (i + 1)))
  }
  return last
}

async function generateCombo(subj, grade, token) {
  const topics = topicsFor(subj, grade)
  const results = []
  const base = { subject: subj, grade, school_id: SCHOOL }
  console.log(`  [${subj}${grade}] start`)

  // 1) 课件
  {
    const t0 = Date.now()
    const res = await callWithRetry('/ai/courseware/generate', { ...base, lesson_title: topics[0], divergence_level: 'standard' }, token)
    const dur = Date.now() - t0
    const md = res.json.courseware_markdown || ''
    let saved = false, err = ''
    if (md && res.status === 200) {
      const s = await saveWithRetry('/materials/json', { name: `${topics[0]}_课件`, type: 'courseware', tag: subj + grade, content: md }, token)
      saved = (s.status === 200 || s.status === 201); err = saved ? '' : JSON.stringify(s.json).slice(0, 120)
    } else err = 'gen_fail:' + res.status
    results.push({ type: 'courseware', topic: topics[0], dur_ms: dur, ok: saved, out_len: md.length, div_count: (res.json.divergence_map || []).length, kp_len: (res.json.knowledge_scope || []).length, curric: (res.json.curriculum_alignments || []).length, err })
  }
  // 2) 出题
  {
    const t0 = Date.now()
    const res = await callWithRetry('/ai/exam/generate', { ...base, lesson_title: topics[1], question_types: EXAM_TYPES[subj], count: 6, difficulty: 'L2' }, token)
    const dur = Date.now() - t0
    const qs = res.json.questions || []
    const diff = {}
    qs.forEach(q => { diff[q.difficulty] = (diff[q.difficulty] || 0) + 1 })
    let saved = false, err = ''
    if (qs.length && res.status === 200) {
      const payload = {
        title: `${topics[1]}_智能组卷`,
        subject: subj, grade,
        questions: JSON.stringify(qs.map(q => ({
          type: q.type, content: q.content, difficulty: q.difficulty,
          options: q.options, answer: q.answer, analysis: q.analysis, knowledge_points: q.knowledge_points || [],
        }))),
        total_score: qs.length * 5, duration_minutes: 40, difficulty: 'L2',
      }
      const s = await withExamLock(() => saveWithRetry('/exams', payload, token))
      saved = (s.status === 200 || s.status === 201); err = saved ? '' : JSON.stringify(s.json).slice(0, 120)
    } else err = 'gen_fail:' + res.status
    results.push({ type: 'exam', topic: topics[1], dur_ms: dur, ok: saved, q_count: qs.length, diff_dist: diff, kp_len: (res.json.knowledge_scope || []).length, curric: (res.json.curriculum_alignments || []).length, err })
  }
  console.log(`  [${subj}${grade}] exam done ok=${results[1].ok}`)
  // 3) 教案
  {
    const t0 = Date.now()
    const res = await callWithRetry('/ai/lesson-plan/generate', { ...base, lesson_title: topics[2], period: 1, format_template: 'core_literacy' }, token)
    const dur = Date.now() - t0
    const content = res.json.content || ''
    let saved = false, err = ''
    if (content && res.status === 200) {
      const s = await saveWithRetry('/lesson-plans', { subject: subj, grade, title: topics[2] + ' 教案', content, school_id: SCHOOL }, token)
      saved = (s.status === 200 || s.status === 201); err = saved ? '' : JSON.stringify(s.json).slice(0, 120)
    } else err = 'gen_fail:' + res.status
    results.push({ type: 'lessonplan', topic: topics[2], dur_ms: dur, ok: saved, out_len: content.length, kp_len: (res.json.knowledge_scope || []).length, curric: (res.json.curriculum_alignments || []).length, err })
  }
  return results
}

async function main() {
  console.log('login...')
  let token = null
  for (let i = 0; i < 5 && !token; i++) {
    const login = await post('/auth/login', { phone: PHONE, password: PASS })
    token = login.json.token
    if (!token) { console.log(`login retry ${i + 1}...`, login.status, login.json.code || ''); await new Promise(r => setTimeout(r, 3000)) }
  }
  if (!token) { console.log('LOGIN FAIL'); process.exit(1) }
  console.log('token ok')

  const combos = []
  for (const g of GRADES) for (const s of SUBJECTS) {
    if (ONLY && s !== ONLY) continue
    if (GRADEONLY && g !== GRADEONLY) continue
    const key = s + '|' + g
    if (progress[key]) continue
    combos.push([s, g])
  }
  console.log(`pending combos: ${combos.length}`)
  let idx = 0
  let active = 0
  const queue = combos.slice()
  let sinceLogin = 0

  async function refresh() {
    for (let i = 0; i < 5; i++) {
      const r = await post('/auth/login', { phone: PHONE, password: PASS })
      if (r.json.token) return r.json.token
      await new Promise(r => setTimeout(r, 3000))
    }
    return null
  }

  async function worker() {
    while (queue.length) {
      const [s, g] = queue.shift()
      const key = s + '|' + g
      const t0 = Date.now()
      let res
      try { res = await generateCombo(s, g, token) } catch (e) { res = [{ type: 'error', err: String(e) }] }
      const okCount = res.filter(r => r.ok).length
      if (okCount === 3) progress[key] = { ok: okCount, items: res.length, ms: Date.now() - t0 }
      metrics.push({ combo: key, ms: Date.now() - t0, ok: okCount, items: res })
      fs.writeFileSync(PROGRESS, JSON.stringify(progress))
      fs.writeFileSync(METRICS, JSON.stringify(metrics))
      idx++; sinceLogin++
      console.log(`[${idx}/${combos.length}] ${key} -> ${okCount}/3 ok  (${res.map(r => r.type + ':' + (r.ok ? 'Y' : 'N')).join(',')})`)
      if (sinceLogin >= 20) {
        const nt = await refresh()
        if (nt) { token = nt; sinceLogin = 0; console.log('  token refreshed') }
      }
    }
  }
  const workers = []
  for (let i = 0; i < CONC; i++) workers.push(worker())
  await Promise.all(workers)
  const done = Object.keys(progress).length
  console.log(`\nALL DONE. combos processed: ${done}. metrics -> ${METRICS}`)
  process.exit(0)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
