/**
 * 知识点「单元/节点按教材收口」守卫（2026-09-18 立，对应 DECISIONS 待办 C3）
 *
 * 背景（本轮实测取证）：
 *   · `/api/ai/knowledge/nodes` 此前只按 `version_id` 过滤，而前端只有 学科/年级/册别 → 只能不传
 *     → 接口返回**混合 28 个教材版本**的节点（且节点无 subject/grade 字段），前端预选"取前 6 个"与学科无关。
 *   · 单元下拉源 `/textbook-math.json` **源码与部署产物都不存在** → `currentUnits` 恒空 = 下拉一直是死的。
 * 修复（2026-09-18）：后端支持 `subject/grade/volume` → 解析 kg version_id；前端单元改读后端。
 *
 * 本脚本守：① API 带上下文时**只返回单一版本**的节点（不再混合）；② 单元接口按教材返回单元；
 *          ③ 教案新建页的**单元下拉不再为空**（UI 级）。
 */
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const CTX = 'subject=' + encodeURIComponent('语文') + '&grade=' + encodeURIComponent('四年级') + '&volume=' + encodeURIComponent('上册')

let br
;(async () => {
  const lg = await (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }) })).json()
  must(!!lg.token, '登录成功（测试账号）')
  const H = { Authorization: 'Bearer ' + lg.token }
  const get = async p => (await (await fetch(B + p, { headers: H })).json())

  /* ① 单元接口：按 学科/年级/册别 收口 */
  const u = await get(`/api/ai/knowledge/units?limit=200&${CTX}`)
  const units = (u.units || []).map(x => String(x.unit || ''))
  must(units.length >= 5, '单元接口按教材返回单元（语文四上应 ≥5 个单元）', { count: units.length, sample: units.slice(0, 4) })
  must(units.every(x => x && !/^[0-9]+$/.test(x)), '单元名全为可读名（无纯数字编码）', { units: units.slice(0, 6) })
  must(!!u.version_id, '接口回传解析出的 version_id（便于溯源）', { version_id: u.version_id })

  /* ② 节点接口：必须**只返回单一版本**（此前混合 28 个版本） */
  const n = await get(`/api/ai/knowledge/nodes?limit=2000&${CTX}`)
  const nodes = n.nodes || []
  must(nodes.length > 0, '节点接口按教材返回节点', { count: nodes.length })
  const vers = [...new Set(nodes.map(x => String(x.version_id || '')))]
  must(vers.length === 1, '节点只来自**单一教材版本**（收口生效，不再混合多版本）', { versions: vers.length, sample: vers.slice(0, 3) })
  const unitsOfNodes = [...new Set(nodes.map(x => x.unit))]
  must(unitsOfNodes.every(x => units.length === 0 || units.includes(x)), '节点单元 ⊆ 单元接口返回值（两接口同源同口径）', { nodesUnits: unitsOfNodes.length, apiUnits: units.length })

  /* ③ 兜底：上下文解析不到时应回退旧行为（不返回空，避免打断前端预选） */
  const bogus = await get('/api/ai/knowledge/units?limit=50&subject=' + encodeURIComponent('不存在的学科') + '&grade=' + encodeURIComponent('不存在的年级'))
  must((bogus.units || []).length > 0, '上下文解析不到时回退旧行为（不返回空，避免打断编辑器预选）', { fallbackUnits: (bogus.units || []).length, version_id: bogus.version_id })

  /* ④ UI：教案新建页的单元下拉不再为空（此前 source 文件缺失 → 恒空） */
  br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1400, height: 900 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.addInitScript(t => localStorage.setItem('zhiwei_token', t), lg.token)
  await p.goto(B + '/lesson-plans/new', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(9000)
  const sel = await p.evaluate(() => {
    const opts = [...document.querySelectorAll('select')].map(s => ({ n: s.options.length, first: s.options[0]?.text || '' }))
    return opts.filter(o => o.n > 1)
  })
  must(sel.length >= 1, '教案新建页出现**单元下拉**（选项 >1）', { selects: sel.slice(0, 4) })

  must(errs.length === 0, '全程 pageerror = 0', { errs })
  report()
})().catch(async e => {
  console.error('✘ 脚本异常：' + e.message)
  try { if (br) await br.close() } catch { /* ignore */ }
  process.exit(2)
}).finally(async () => { try { if (br) await br.close() } catch { /* ignore */ } })
