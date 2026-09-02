// 课件风格/版式多样化改造脚本（staging）
// 背景：现有 35 份 PPT 课件 78% 的页面集中在 content-2col + title-body 两种版式，
//       edu-cover / edu-example 出现 0 次。经实测：显式提出版式多样性要求后，
//       单份课件可从 2 种版式提升到 9~10 种。
// 做法：对每份 PPT 课件，把「现有正文」作为参考传入重生成（保主题与知识点连贯），
//       按现有 theme_id 映射回风格（保持视觉身份不变），再 PUT 回 content。
// 安全：改造前已备份 qa/courseware_backup_*.sql，可回滚。
// 限流：每次生成后 sleep DELAY_MS，失败跳过并记录，不中断整体。
// 用法：
//   node qa/diversify_courseware_styles.cjs            # 全部
//   START=0 LIMIT=8 node qa/diversify_courseware_styles.cjs   # 分批
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const START = parseInt(process.env.START || '0', 10)
const LIMIT = parseInt(process.env.LIMIT || '0', 10) // 0 = 全部
const DELAY_MS = parseInt(process.env.DELAY_MS || '4000', 10)
const DRY = process.env.DRY === '1' // 只生成不写回，用于试跑

// theme_id → style_tag（保持课件既有视觉身份，不擅自换风格）
const THEME_TO_STYLE = {
  'fr-mint': 'fresh',
  'zgf-ink-wash': 'china',
  'sp-cartoon': 'cartoon',
  'te-quantum-blue': 'tech',
  'aca-edu-blue': 'academic',
  'min-classic-blue': 'minimal',
}

const LAYOUT_REQUIREMENT =
  '务必丰富版式多样性，让每页视觉结构不同：必须包含 1 个 edu-cover 封面页（首页，标题即课件名）、' +
  '1 个 edu-goal 学习目标、至少 1 个 content-grid（短要点网格）、1 个 image-text（图文混排）、' +
  '1 个 compare-table（对比表）、1 个 edu-example（例题/范例精讲）、1 个 edu-summary（课堂小结）、' +
  '1 个 edu-homework（分层作业）；其余内容页在 title-body 与 content-2col 之间交替，避免连续 3 页以上同版式。'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const layoutsOf = (md) => {
  const m = (md || '').match(/<!--\s*layout:\s*([a-zA-Z0-9_-]+)\s*-->/g) || []
  return m.map(s => (s.match(/layout:\s*([a-zA-Z0-9_-]+)/) || [])[1]).filter(Boolean)
}

;(async () => {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const token = (await login.json()).token
  if (!token) { console.log('LOGIN_FAIL'); process.exit(1) }
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const listRes = await fetch(`${BASE}/api/materials`, { headers: H })
  const listJson = await listRes.json()
  const all = Array.isArray(listJson) ? listJson : (listJson.items || listJson.data || [])
  const ppts = all.filter(m => m.category === 'courseware' && m.format === 'ppt')
  console.log(`素材总数 ${all.length}，PPT 课件 ${ppts.length} 份`)

  const targets = LIMIT > 0 ? ppts.slice(START, START + LIMIT) : ppts.slice(START)
  console.log(`本批处理 ${targets.length} 份（START=${START} LIMIT=${LIMIT || '全部'}）DRY=${DRY}\n`)

  const report = []
  for (let i = 0; i < targets.length; i++) {
    const m = targets[i]
    const before = layoutsOf(m.content || '')
    const style = THEME_TO_STYLE[m.theme_id] || ''
    const tag = `[${i + 1}/${targets.length}] ${(m.name || '').slice(0, 22)}`
    try {
      const genRes = await fetch(`${BASE}/api/ai/courseware/generate`, {
        method: 'POST', headers: H,
        body: JSON.stringify({
          subject: m.subject || '', grade: m.grade || '',
          lesson_title: (m.name || '').replace(/_课件$/, '').replace(/PPT课件$/, '').trim(),
          content: m.content || '',           // 原正文作参考，保主题/知识点连贯
          textbook_version: m.textbook_version || '',
          unit: '', period: 1, format: 'ppt',
          style_tag: style, divergence_level: 'standard',
          extra_requirements: LAYOUT_REQUIREMENT,
          school_id: m.school_id || '',
        }),
      })
      const gen = await genRes.json()
      const md = gen.courseware_markdown || ''
      if (!md) { console.log(`${tag} 生成返回空，跳过`); report.push({ id: m.id, name: m.name, ok: false, why: 'empty' }); await sleep(DELAY_MS); continue }

      const after = layoutsOf(md)
      const uniqAfter = [...new Set(after)]
      if (!DRY) {
        const putRes = await fetch(`${BASE}/api/materials/${m.id}`, {
          method: 'PUT', headers: H,
          body: JSON.stringify({ content: md, theme_id: m.theme_id, name: m.name }),
        })
        if (!putRes.ok) { console.log(`${tag} 写回失败 HTTP ${putRes.status}`); report.push({ id: m.id, name: m.name, ok: false, why: `put ${putRes.status}` }); await sleep(DELAY_MS); continue }
      }
      console.log(`${tag} 风格=${style || '(未映射)'} 版式 ${before.length ? [...new Set(before)].length : '?'}种/共${before.length}页 → ${uniqAfter.length}种/共${after.length}页  [${uniqAfter.join(',')}]`)
      report.push({ id: m.id, name: m.name, style, pages: after.length, layoutsBefore: [...new Set(before)].length, layoutsAfter: uniqAfter.length, ok: true })
    } catch (e) {
      console.log(`${tag} 异常：${e.message}`)
      report.push({ id: m.id, name: m.name, ok: false, why: e.message })
    }
    await sleep(DELAY_MS)
  }

  const out = path.join(__dirname, `diversify_report_${START}_${Date.now()}.json`)
  fs.writeFileSync(out, JSON.stringify(report, null, 2))
  const okN = report.filter(r => r.ok).length
  const avgAfter = (report.filter(r => r.ok).reduce((s, r) => s + r.layoutsAfter, 0) / (okN || 1)).toFixed(1)
  console.log(`\n==== 成功 ${okN}/${report.length}，改造后平均版式种类 ${avgAfter} 种 ====`)
  console.log(`明细: ${out}`)
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(2) })
