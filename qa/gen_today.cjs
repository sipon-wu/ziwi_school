// 从源头生成「不同风格课件」（2026-09-14）
// 链路：知识点实体（DB 接口）→ 教案 → 课件（PPT/H5 × 多风格）→ 落库含生成配方 → 回读验证
// 目的：① 出一批可供人工查看的不同风格成品 ② 每个课件都留下"从源头到落库"的逐步证据
const B = 'http://school1.ziwi.cn'
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
  { fmt: 'ppt', style: 'fresh', label: 'PPT·清新' },
  { fmt: 'h5', style: 'china', label: 'H5·国风' },
  { fmt: 'h5', style: 'tech', label: 'H5·科技' },
]
const THEME = { china: 'zgf-ink-wash', tech: 'te-quantum-blue', fresh: 'fr-mint', academic: 'min-classic-blue' }

;(async () => {
  const t = (await post('/api/auth/login', '', { phone: '13800000002', password: 'teacher123' })).token

  // ── ① 源头：知识点实体（从 DB 接口取，不手写 ID）──
  const kg = await get('/api/ai/knowledge/nodes?q=' + encodeURIComponent(LESSON.keyword) + '&limit=30', t)
  const nodes = (kg.nodes || []).filter(n => Number(n.level) >= 4)     // level 4 = 知识点级
  const ids = nodes.map(n => n.id)
  const names = nodes.map(n => n.name)
  const versionId = (nodes[0] && nodes[0].version_id) || ''
  const unit = (nodes[0] && nodes[0].unit) || ''
  const prereq = [...new Set(nodes.flatMap(n => n.prerequisites || []))]
  log('① 源头取点：' + nodes.length + ' 个知识点')
  log('   实体：' + nodes.map(n => n.id + '→' + n.name).join(' / '))
  log('   教材版本 version_id=' + versionId + ' · 单元=' + unit + ' · 图谱前置=' + (prereq.join('/') || '（无）'))
  if (!ids.length) throw new Error('未取到知识点，链路中止')

  // ── ② 教案（含课标对齐）──
  const t1 = Date.now()
  const lp = await post('/api/ai/lesson-plan/generate', t, {
    subject: LESSON.subject, grade: LESSON.grade, lesson_title: LESSON.title,
    textbook_unit: unit, period: 1,
    selected_knowledge_ids: ids, knowledge_points: names,
  })
  const lpContent = lp.content || ''
  log('② 教案：' + lpContent.length + ' 字 · 模型=' + lp.model + ' · 耗时=' + ((Date.now() - t1) / 1000).toFixed(0) + 's'
    + ' · 课标对齐=' + JSON.stringify(lp.curriculum_alignments || []))
  if (!lpContent.trim()) throw new Error('教案为空')
  // 教案落库（作为课件的"来源教案"实体引用）
  const lpMat = await post('/api/materials/json', t, {
    name: '《' + LESSON.title + '》教案（源头链路 ' + new Date().toISOString().slice(0, 10) + '）',
    type: 'lesson_plan', format: 'ppt', tag: 'lesson',
    content: lpContent, status: 'draft',
    grade: LESSON.grade, subject: LESSON.subject,
    textbook_version_id: versionId, unit,
  })
  const lpId = lpMat.id || (lpMat.data && lpMat.data.id)
  log('   教案素材已落库 id=' + lpId)

  // ── ③④⑤ 逐份生成课件 ──
  const out = []
  for (const j of JOBS) {
    const t0 = Date.now()
    log('③ 生成 ' + j.label + ' …')
    const gen = await post('/api/ai/courseware/generate', t, {
      subject: LESSON.subject, grade: LESSON.grade, lesson_title: LESSON.title,
      format: j.fmt, content: lpContent,                       // 教案作参照（与前端同路径）
      textbook_unit: unit, textbook_version_id: versionId,      // 教材版本实体引用
      selected_knowledge_ids: ids, knowledge_points: names,
      style_tag: j.style, style_mode: 'preset', divergence_level: 'standard',
      lesson_plan_id: lpId,
    })
    const sr = gen.scope_resolved || {}
    const q = gen.quality_report || {}
    const md = gen.courseware_markdown || ''
    const secs = ((Date.now() - t0) / 1000).toFixed(0)
    log('   ✔ ' + j.label + ' 模型=' + gen.model + ' ERR=' + q.error_count + ' 页=' + q.pages + ' 正文=' + md.length + '字 耗时=' + secs + 's')
    log('     配方：知识面=' + sr.source + ' 前置=' + sr.prereq_source + JSON.stringify(sr.prerequisites || [])
      + ' version_id=' + (sr.textbook_version_id || '(空)') + ' 单元=' + (sr.unit || '(空)'))
    log('     发散=' + JSON.stringify(sr.divergence || {}))

    // ── ④ 落库（含配方 gen_params）──
    const gp = {
      scope_resolved: sr,
      textbook_version_name: '（由 version_id 解析）',
      unit, divergence_level: 'standard', style_tag: j.style,
      lesson_plan_id: lpId,
      source: 'source-chain', captured_at: new Date().toISOString(),
      chain: {
        knowledge_nodes: nodes.map(n => ({ id: n.id, name: n.name })),
        curriculum_alignments: lp.curriculum_alignments || [],
        lesson_plan_excerpt: lpContent.slice(0, 160),
      },
    }
    const m = await post('/api/materials/json', t, {
      name: '《' + LESSON.title + '》' + j.label + '（源头链路 ' + new Date().toISOString().slice(0, 10) + '）',
      type: 'courseware', format: j.fmt, tag: j.style,
      content: md, status: 'draft',
      grade: LESSON.grade, subject: LESSON.subject,
      theme_id: THEME[j.style] || 'zgf-ink-wash',
      textbook_version_id: sr.textbook_version_id || versionId,
      unit: sr.unit || unit, lesson_plan_id: lpId,
      gen_params: JSON.stringify(gp),
    })
    const id = m.id || (m.data && m.data.id)

    // ── ⑤ 回读验证溯源列真的落库 ──
    const back = await get('/api/materials/' + id, t)
    log('     落库回读：textbook_version_id=' + JSON.stringify(back.textbook_version_id)
      + ' unit=' + JSON.stringify(back.unit) + ' gen_params=' + String(back.gen_params || '').length + '字')
    const url = B + '/courseware/' + j.fmt + '/' + id + '/edit'
    log('     URL ' + url)
    out.push({ label: j.label, id, url, err: q.error_count, pages: q.pages, secs, model: gen.model, len: md.length })
  }

  console.log('\n===== 交付清单 =====')
  out.forEach(o => console.log(o.label.padEnd(9) + ' ERR=' + String(o.err).padEnd(3) + ' 页=' + String(o.pages).padEnd(3) + ' ' + o.secs + 's  ' + o.url))
  console.log('教案 id = ' + lpId)
  console.log('===== DONE =====')
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
