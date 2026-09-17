// 生成「PPT×2 风格 + H5×2 风格」共 4 份课件（2026-09-15）
// 与 gen_today.cjs 同一条源头链路：知识点实体 → 教案 → 课件 → 落库（含生成配方）→ 回读
// 差异：只跑 4 份（ppt/h5 × 国风/科技），标题带**当天日期**，末尾给出可目测的清单。
const B = 'http://school1.ziwi.cn'
const D = new Date().toISOString().slice(0, 10)   // 2026-09-15
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const H = (t) => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + t })
const post = async (u, t, b) => {
  const r = await fetch(B + u, { method: 'POST', headers: H(t), body: JSON.stringify(b) })
  const x = await r.text()
  try { return JSON.parse(x) } catch { throw new Error(u + ' 非 JSON: ' + x.slice(0, 140)) }
}
const get = async (u, t) => (await fetch(B + u, { headers: H(t) })).json()

const LESSON = { subject: '语文', grade: '四年级', title: '观潮', keyword: '观潮' }
const JOBS = [
  { fmt: 'ppt', style: 'china', label: 'PPT·国风' },
  { fmt: 'ppt', style: 'tech', label: 'PPT·科技' },
  { fmt: 'h5', style: 'china', label: 'H5·国风' },
  { fmt: 'h5', style: 'tech', label: 'H5·科技' },
]
const THEME = { china: 'zgf-ink-wash', tech: 'te-quantum-blue', fresh: 'fr-mint', academic: 'min-classic-blue' }

;(async () => {
  const t = (await post('/api/auth/login', '', { phone: '13800000002', password: 'teacher123' })).token

  // ── ① 源头：知识点实体 ──
  const kg = await get('/api/ai/knowledge/nodes?q=' + encodeURIComponent(LESSON.keyword) + '&limit=30', t)
  const nodes = (kg.nodes || []).filter(n => Number(n.level) >= 4)
  const ids = nodes.map(n => n.id), names = nodes.map(n => n.name)
  const versionId = (nodes[0] && nodes[0].version_id) || ''
  const unit = (nodes[0] && nodes[0].unit) || ''
  log('① 源头取点：' + nodes.length + ' 个知识点 · 版本=' + versionId + ' · 单元=' + unit)
  if (!ids.length) throw new Error('未取到知识点，链路中止')

  // ── ② 教案 ──
  const t1 = Date.now()
  const lp = await post('/api/ai/lesson-plan/generate', t, {
    subject: LESSON.subject, grade: LESSON.grade, lesson_title: LESSON.title,
    textbook_unit: unit, period: 1, selected_knowledge_ids: ids, knowledge_points: names,
  })
  const lpContent = lp.content || ''
  log('② 教案：' + lpContent.length + ' 字 · ' + ((Date.now() - t1) / 1000).toFixed(0) + 's')
  if (!lpContent.trim()) throw new Error('教案为空')
  const lpMat = await post('/api/materials/json', t, {
    name: '《' + LESSON.title + '》教案（' + D + '）', type: 'lesson_plan', format: 'ppt', tag: 'lesson',
    content: lpContent, status: 'draft', grade: LESSON.grade, subject: LESSON.subject,
    textbook_version_id: versionId, unit,
  })
  const lpId = lpMat.id || (lpMat.data && lpMat.data.id)
  log('   教案落库 id=' + lpId)

  // ── ③④ 逐份生成 + 落库 ──
  const out = []
  for (const j of JOBS) {
    const t0 = Date.now()
    log('③ 生成 ' + j.label + '（' + D + '）…')
    const gen = await post('/api/ai/courseware/generate', t, {
      subject: LESSON.subject, grade: LESSON.grade, lesson_title: LESSON.title,
      format: j.fmt, content: lpContent,
      textbook_unit: unit, textbook_version_id: versionId,
      selected_knowledge_ids: ids, knowledge_points: names,
      style_tag: j.style, style_mode: 'preset', divergence_level: 'standard',
      lesson_plan_id: lpId,
    })
    const q = gen.quality_report || {}
    const md = gen.courseware_markdown || ''
    const notes = (q.notes || []).filter(n => /兜底/.test(n))
    log('   ✔ ' + j.label + ' 模型=' + gen.model + ' ERR=' + q.error_count + ' 页=' + q.pages
      + ' 正文=' + md.length + '字 耗时=' + ((Date.now() - t0) / 1000).toFixed(0) + 's')
    if (notes.length) log('     平台兜底：' + notes.slice(0, 3).join(' / '))

    const m = await post('/api/materials/json', t, {
      name: '《' + LESSON.title + '》' + j.label + '（' + D + '）',
      type: 'courseware', format: j.fmt, tag: j.style,
      content: md, status: 'draft', grade: LESSON.grade, subject: LESSON.subject,
      theme_id: THEME[j.style] || 'zgf-ink-wash',
      textbook_version_id: (gen.scope_resolved || {}).textbook_version_id || versionId,
      unit: (gen.scope_resolved || {}).unit || unit, lesson_plan_id: lpId,
      gen_params: JSON.stringify({ style_tag: j.style, source: 'styles-4x', captured_at: new Date().toISOString() }),
    })
    const id = m.id || (m.data && m.data.id)
    // ── ⑤ 回读 ──
    const back = await get('/api/materials/' + id, t)
    log('     落库回读：name=' + back.name + ' · theme_id=' + back.theme_id + ' · 正文=' + String(back.content || '').length + '字')
    out.push({ label: j.label, fmt: j.fmt, style: j.style, id, err: q.error_count, pages: q.pages, len: md.length, theme: back.theme_id })
  }

  console.log('\n===== 交付清单（今天 ' + D + '）=====')
  out.forEach(o => console.log(
    o.label.padEnd(9) + ' ERR=' + String(o.err).padEnd(3) + ' 页=' + String(o.pages).padEnd(3)
    + ' ' + String(o.len).padEnd(6) + '字 theme=' + String(o.theme).padEnd(20)
    + ' ' + B + '/courseware/' + o.fmt + '/' + o.id + '/edit'))
  console.log('\n列表页（目测入口）：' + B + '/courseware/ppt  ·  ' + B + '/courseware/h5')
  console.log('===== DONE =====')
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
