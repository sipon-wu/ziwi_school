// H5 课件重跑（staging）：按**原归属账号**各自登录重生成，产出「新素材·草稿」，绝不改动已发布原件。
//
// 为什么必须用映射文件驱动（重要）：
//   GET /api/materials 返回的是**全校**素材而非按用户过滤，同一学校的不同账号看到同一份列表。
//   若用它收集任务，24 个账号会重复收集出 466 份（应 57 份），且归属全乱。
//   故改由 DB 导出映射 qa/h5_owner_map.tsv（id|名称|学科|年级|theme|归属手机|状态|学校）驱动。
//
// 原则（用户 2026-09-03 定案）：已发布课件不可原地修改，只能"拿来借用生成新版本"
//   → 本脚本只 POST /api/materials/json 新建（status=draft），绝不 PUT 原件。
//   注：模型虽有 parent_ids 字段，但其语义是「装饰组件→其元件的 asset_id 数组」，
//       **不是**课件版本血缘，不可挪用；正确血缘需新增字段（如 derived_from），待定。
//
// 已知边界：H5 版式恒为 scene（SKILL.md 明写"每页 layout 必须是 scene"且渲染端忽略 layout），
//   重跑提升的是场景数、交互类型丰富度、角色刻画与窄屏密度，不改变版式。
//
// 用法：node qa/diversify_h5_styles.cjs           （全部 57 份）
//       START=0 LIMIT=3 DRY=1 node ...            （小步试跑）
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PASS = process.env.PASS || 'teacher123'
const MAP = process.env.MAP || path.join(__dirname, 'h5_owner_map.tsv')
const START = parseInt(process.env.START || '0', 10)
const LIMIT = parseInt(process.env.LIMIT || '0', 10)
const DELAY_MS = parseInt(process.env.DELAY_MS || '3500', 10)
const DRY = process.env.DRY === '1'

const THEME_TO_STYLE = {
  'fr-mint': 'fresh', 'zgf-ink-wash': 'china', 'sp-cartoon': 'cartoon',
  'te-quantum-blue': 'tech', 'aca-edu-blue': 'academic', 'min-classic-blue': 'minimal',
}

// 交互丰富度 + 窄屏密度约束（对应用户"以窄屏兜底"原则在内容侧的落地）
const H5_REQ =
  '请提升交互类型丰富度与场景节奏：在 read(点读)、readalong(跟读)、quiz(随堂选择)、' +
  'reveal(点击揭示)、draw(现场绘图)、focus(重点条) 中至少用到 4 种，且分布在不同场景；' +
  '角色要有明确性格区分（一个爱提问、一个爱抢答、一个负责纠正），不要三个人说一样的话；' +
  '每个场景旁白不超过 2 句、单场景气泡不超过 3 条，确保窄屏一屏放得下；' +
  '不要用"小结/总结"这类教案式标题，用角色对话自然收束。'

const sleep = ms => new Promise(r => setTimeout(r, ms))
const count = (md, re) => (String(md || '').match(re) || []).length
const inter = (md) => ({
  read: count(md, /<!--\s*read:/g), readalong: count(md, /<!--\s*readalong:/g),
  quiz: count(md, /<!--\s*quiz:/g), reveal: count(md, /<!--\s*reveal:/g),
  draw: count(md, /<!--\s*draw:/g), focus: count(md, /<!--\s*focus:/g),
})
const sum = o => Object.values(o).reduce((a, b) => a + b, 0)

async function login(phone) {
  // 连续登录偶发瞬时失败，重试 3 次
  for (let i = 0; i < 3; i++) {
    try {
      const j = await (await fetch(`${BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password: PASS }),
      })).json()
      if (j.token) return j.token
    } catch {}
    await sleep(1200 * (i + 1))
  }
  return null
}

;(async () => {
  const rows = fs.readFileSync(MAP, 'utf8').trim().split('\n').filter(Boolean)
    .map(l => l.split('|'))
    .map(([id, name, subject, grade, theme, phone, , school]) => ({ id, name, subject, grade, theme, phone, school }))
  console.log(`映射载入 ${rows.length} 份 H5 课件，归属 ${new Set(rows.map(r => r.phone)).size} 个账号\n`)

  const byPhone = new Map()
  for (const r of rows) {
    if (!byPhone.has(r.phone)) byPhone.set(r.phone, [])
    byPhone.get(r.phone).push(r)
  }

  // 展平为按账号分组的任务序列
  let jobs = []
  for (const [phone, list] of byPhone) jobs.push({ phone, list })
  const targets = LIMIT > 0 ? jobs.slice(START, START + LIMIT) : jobs.slice(START)

  const report = []
  let idx = 0, total = targets.reduce((s, j) => s + j.list.length, 0)
  for (const { phone, list } of targets) {
    const token = await login(phone)
    if (!token) { console.log(`账号 ${phone} 登录失败，跳过其 ${list.length} 份`); report.push(...list.map(m => ({ id: m.id, phone, ok: false, why: 'login_failed' }))); continue }
    const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    console.log(`── 账号 ${phone}（${list.length} 份）──`)

    for (const meta of list) {
      idx++
      const m = await (await fetch(`${BASE}/api/materials/${meta.id}`, { headers: H })).json().catch(() => null)
      if (!m || !m.content) { console.log(`  [${idx}/${total}] ${meta.name} 取原内容失败`); report.push({ ...meta, ok: false, why: 'fetch_content' }); continue }
      const before = { scenes: count(m.content, /^## /gm), ...inter(m.content) }
      const style = THEME_TO_STYLE[meta.theme] || ''
      const baseName = (meta.name || '').replace(/_课件$/, '').replace(/H5互动课件$/, '').trim()
      try {
        const gen = await (await fetch(`${BASE}/api/ai/courseware/generate`, {
          method: 'POST', headers: H,
          body: JSON.stringify({
            subject: meta.subject, grade: meta.grade, lesson_title: baseName,
            content: m.content, unit: '', period: 1, format: 'h5',
            style_tag: style, divergence_level: 'standard',
            extra_requirements: H5_REQ, school_id: meta.school || '',
          }),
        })).json()
        const md = gen.courseware_markdown || ''
        if (!md) { console.log(`  [${idx}/${total}] ${baseName} 生成空`); report.push({ ...meta, ok: false, why: 'empty' }); await sleep(DELAY_MS); continue }
        const after = { scenes: count(md, /^## /gm), ...inter(md) }
        let newId = null
        if (!DRY) {
          const cr = await fetch(`${BASE}/api/materials/json`, {
            method: 'POST', headers: H,
            body: JSON.stringify({
              name: `${baseName} H5互动课件（重制版）`, type: 'courseware', format: 'h5',
              content: md, status: 'draft', grade: meta.grade, subject: meta.subject,
              theme_id: meta.theme, tag: m.tag || '',
            }),
          })
          if (!cr.ok) {
            const e = await cr.json().catch(() => ({}))
            console.log(`  [${idx}/${total}] ${baseName} 新建失败 HTTP ${cr.status} ${e.message || ''}`)
            report.push({ ...meta, ok: false, why: `create ${cr.status} ${e.message || ''}` }); await sleep(DELAY_MS); continue
          }
          newId = (await cr.json()).id
        }
        console.log(`  [${idx}/${total}] ${baseName.slice(0, 20)} 场景 ${before.scenes}→${after.scenes} 交互 ${sum(before)}→${sum(after)} [read${after.read}/跟读${after.readalong}/quiz${after.quiz}/揭示${after.reveal}/绘${after.draw}] ${newId ? '→ ' + newId.slice(0, 8) : '(DRY)'}`)
        report.push({ ...meta, newId, before, after, ok: true })
      } catch (e) {
        console.log(`  [${idx}/${total}] ${baseName} 异常 ${e.message}`)
        report.push({ ...meta, ok: false, why: e.message })
      }
      await sleep(DELAY_MS)
    }
  }

  const out = path.join(__dirname, `diversify_h5_report_${Date.now()}.json`)
  fs.writeFileSync(out, JSON.stringify(report, null, 2))
  const okN = report.filter(r => r.ok).length
  const avgS = (report.filter(r => r.ok).reduce((s, r) => s + r.after.scenes, 0) / (okN || 1)).toFixed(1)
  const avgI = (report.filter(r => r.ok).reduce((s, r) => s + sum(r.after), 0) / (okN || 1)).toFixed(1)
  console.log(`\n==== 成功 ${okN}/${report.length}｜重跑后平均场景 ${avgS}、平均交互 ${avgI} ====`)
  console.log(`明细: ${out}`)
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(2) })
