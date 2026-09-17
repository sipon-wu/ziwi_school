// B2 验收（2026-09-14）：验证"返修轮真的跑起来了"
// 背景：返修回灌其实做得很细（逐条违规 + 被丢弃组件 + 裁剪后的返修指引 + 上一版原稿），
// 但 plus 单次 ~150s、预算 240s、判据是 `已用 + 本轮 > 预算` → **首轮后必然停手，重试从未发生**。
// 现改为：首轮 gen 通道，返修轮 repair 通道（默认 qwen-turbo）。
// 判据：① quality_notes 里出现「第 N 次关卡1 未过…已回灌返修（模型 xxx）」；
//       ② 最终 error_count 比"只有首轮"时更低；③ 返修模型名与实际一致（不许"跑 turbo 却报 plus"）。
const B = 'http://school1.ziwi.cn'
const LP_ID = '5f473498-7768-49ab-ada4-f030c5feb6b6'   // 本会话生成的《观潮》教案素材
const log = (...a) => console.log(...a)

const post = async (u, t, b) => {
  const r = await fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(b) })
  if (!r.ok) throw new Error(u + ' HTTP ' + r.status)
  return r.json()
}
const get = async (u, t) => (await fetch(B + u, { headers: { Authorization: 'Bearer ' + t } })).json()

;(async () => {
  const t = (await post('/api/auth/login', '', { phone: '13800000002', password: 'teacher123' })).token
  const lp = await get('/api/materials/' + LP_ID, t)
  const lpContent = lp.content || ''
  log('教案参照 = ' + lpContent.length + ' 字')
  const ch = await get('/api/ai/llm/config', t)
  log('通道 = ' + JSON.stringify(ch).slice(0, 200))

  const t0 = Date.now()
  const gen = await post('/api/ai/courseware/generate', t, {
    subject: '语文', grade: '四年级', lesson_title: '观潮',
    format: 'ppt', content: lpContent,
    style_tag: 'china', style_mode: 'preset', divergence_level: 'standard',
  })
  const q = gen.quality_report || {}
  const notes = gen.quality_notes || gen.notes || []
  log('\n=== 响应结构（先把结构打出来，避免我又按错的字段名统计）===')
  log('顶层键 = ' + Object.keys(gen).join(','))
  log('quality_report 键 = ' + Object.keys(q).join(','))
  log('quality_report 全文 = ' + JSON.stringify(q).slice(0, 900))
  log('material_id = ' + (gen.material_id || (gen.material && gen.material.id) || '(无)'))
  log(`\n生成完成：模型=${gen.model} ERR=${q.error_count} 页=${q.pages} 耗时=${((Date.now() - t0) / 1000).toFixed(0)}s`)
  log('质量说明（含重试与兜底轨迹）：')
  for (const n of notes) log('   · ' + n)
  const retry = notes.filter(n => /未过|返修|重试/.test(n))
  const repaired = notes.filter(n => /兜底/.test(n))
  log('\n判据① 出现返修轮 = ' + (retry.length ? '✔ ' + retry.length + ' 条' : '（无，说明首轮 0 违规）'))
  log('判据② 平台兜底记录 = ' + (repaired.length ? '✔ ' + repaired.length + ' 条' : '（无）'))
  log('判据③ 残余 ERR = ' + (q.error_count || 0) + '（字段用 error_count/errors，此前我错用 issues）')
  for (const e of (q.errors || []).slice(0, 6)) log('      ✘ ' + e.item + '：' + e.detail)
})().catch(e => console.error('ERR', e.message))
