/**
 * 工具层守卫：`template.query` / `asset.search`（P0-b · 2026-09-27 立）
 *
 * 依据《0911 Skill服务化与验收防伪方案》§三 + §七 P0-b：
 *   · 工具层是**确定性**的（词表映射 / 匹配度排序，**不调 LLM**）；
 *   · 契约：① 渲染只读 styleDNA 快照（不读 template_id）② `skeletonClass` 必须真实驱动版式几何
 *           ③ **资产只存形状**（`asset.search` 的 params 不含色值，颜色由 styleDNA 渲染时填）；
 *   · P0-b 的 DoD：「同内容喂不同 `style_tag`，返回的 `skeletonClass`/`styleDNA` 有**可观测差异**；变异测试通过」。
 *
 * 本脚本守四件事：
 *   ① **漂移对账**：Python 镜像（`code/ai-service/style_tools.py`）↔ 单一事实源（前端 `styleRegistry.ts` 的
 *      STYLES + STYLE_STRUCTURE）**逐字段相等** —— 任一边改了另一边没跟上 → 红（本项目反复吃过的"两处漂移"坑）。
 *   ② **DoD 差异式**：9 个风格 → 返回的 `skeletonClass` + `styleDNA` 组合**两两可区分**（9/9 唯一）。
 *   ③ **兜底显式**：`style_tag` 缺省/未知时按 学段→学科 兜底，且 **`fallback=true` 明示**（不许静默给个风格了事）。
 *   ④ **asset.search 契约**：数量 = need × factor、params **不含色值**、同输入结果确定、资产在库中存在。
 *
 * 变异测试（M3 · 按需 · **强形态**）：`MUTATE=1 node qa/verify_style_tools.cjs`
 *   → 先正常跑完全部对账，再**真改被测服务**：容器内 `style_tools.py` 的 china 风格 `font: kai → hei` + 重启
 *     ai-service → 断言"漂移对账**必须**报出 china.font"；随后从容器内备份还原 + 重启 + **自检**工具返回与事实源
 *     重新一致（不留污染）。旧形态"把 9 次请求打成同一个标签"证明力弱（只证明比较函数会算），已移除。
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { must, report } = require('./lib/assert.cjs')
const { session, B } = require('./lib/cwFixture.cjs')

const MUTATE = !!process.env.MUTATE
const SSH = process.env.SSH_TARGET || 'root@193.112.163.147'
const ENV_FILE = process.env.ENV_FILE || '/opt/zhiwei/code/deploy/.env.staging'
const PG = process.env.PG_CONTAINER || 'zhiwei-postgres-staging'
const REG = path.join(__dirname, '..', 'code', 'frontend', 'src', 'lib', 'styleRegistry.ts')
const FONT_MAP = { F_KAI: 'kai', F_SONG: 'song', F_HEI: 'hei', F_YAHEI: 'yahei' }

const psql = (sql) => {
  try {
    return execFileSync('ssh', [SSH,
      `set -a; . ${ENV_FILE}; set +a; docker exec -i ${PG} psql -U "$DB_USER" -d "$DB_NAME" -t -A -c ${JSON.stringify(sql)}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map(s => s.trim()).filter(s => s && !/^WARNING|^DETAIL|^HINT|collation/i.test(s))
  } catch { return null }
}

/** 解析 styleRegistry.ts：STYLES 与 STYLE_STRUCTURE（单一事实源） */
function parseTsRegistry() {
  const src = fs.readFileSync(REG, 'utf8')
  const styles = {}
  for (const key of ['china', 'minimal', 'tech', 'fresh', 'academic', 'cartoon', 'flat', 'business', 'basic']) {
    const block = (src.match(new RegExp(`\\n  ${key}: \\{([\\s\\S]*?)\\n  \\},`)) || [])[1] || ''
    const g = (re) => (block.match(re) || [])[1]
    const morph = block.match(/morph: \{ density: '([^']+)', motion: '([^']+)', motif: '([^']+)' \}/) || []
    styles[key] = {
      h5Layout: g(/h5Layout: '([^']+)'/),
      density: morph[1], motion: morph[2], motif: morph[3],
      decor: g(/decor: '([^']+)'/),
      font: FONT_MAP[g(/font: (\w+)/)] || g(/font: (\w+)/),
      themeId: g(/themeId: '([^']+)'/),
    }
  }
  const structure = {}
  for (const key of Object.keys(styles)) {
    // 注意：TS 里为对齐加过**多个空格**（如 `corner: 'seal',     titleStyle:`）→ 字段分隔必须用 `,\s*`
    const m = src.match(new RegExp(`\\n  ${key}:\\s*\\{ gutter: ([\\d.]+),\\s*rail: '([^']+)',\\s*texture: '([^']+)',\\s*corner: '([^']+)',\\s*titleStyle: '([^']+)',\\s*radius: (\\d+),\\s*border: '([^']+)',\\s*mark: '([^']+)' \\}`))
    structure[key] = m ? { gutter: Number(m[1]), rail: m[2], texture: m[3], corner: m[4], titleStyle: m[5], radius: Number(m[6]), border: m[7], mark: m[8] } : null
  }
  return { styles, structure }
}

;(async () => {
  const S = await session()
  const post = async (p, body) => (await fetch(B + p, { method: 'POST', headers: S.H, body: JSON.stringify(body) })).json()
  const TQ = '/api/ai/courseware/tools/template.query'
  const AS = '/api/ai/courseware/tools/asset.search'

  /* ① 漂移对账：TS（事实源）↔ 工具返回（Python 镜像） */
  const ts = parseTsRegistry()
  const keys = Object.keys(ts.styles)
  must(keys.length === 9 && keys.every(k => ts.styles[k].h5Layout && ts.styles[k].themeId), '解析到 TS 风格表 9 条（事实源）', { keys })
  must(keys.every(k => ts.structure[k]), '解析到 TS 结构语汇 9 条（STYLE_STRUCTURE）', {})

  /** 逐字段对账（抽成函数：正常对账与**变异后的复算**用同一口径，不许两套标准） */
  const driftOf = (k, r) => {
    const t = ts.styles[k]
    const d = r.styleDNA || {}
    const cmp = {
      styleKey: r.styleKey === k,
      themeId: r.themeId === t.themeId,
      font: d.font === t.font,
      density: d.density === t.density,
      motion: d.motion === t.motion,
      motif: d.motif === t.motif,
      decorVocab: d.decorVocab === t.decor,
      structure: JSON.stringify(d.structure) === JSON.stringify(ts.structure[k]),
      skeleton: String(r.skeletonClass || '').includes(`layout-${t.h5Layout}`)
        && String(r.skeletonClass || '').includes(`morph-${t.density}`)
        && String(r.skeletonClass || '').includes(`mv-${t.motion}`),
      colorSource: d.colorSource === 'theme_id', // 配色单一事实源仍在渲染端（不复制主题色）
    }
    const out = []
    for (const [f, ok] of Object.entries(cmp)) {
      if (!ok) out.push(`${k}.${f}（TS=${JSON.stringify({ l: t.h5Layout, f: t.font, d: t.density, m: t.motion, mo: t.motif, dec: t.decor, th: t.themeId, st: ts.structure[k] })} / tool=${JSON.stringify({ sk: r.styleKey, th: r.themeId, font: d.font, structure: d.structure, skeleton: r.skeletonClass })}）`)
    }
    return out
  }

  const drift = []
  const results = {}
  for (const k of keys) {
    // 变异模式**不再**把 9 次请求打成同一个标签（那是"喂坏数据给判据"）——
    // 一律用真标签跑正常对账；注入改在**末尾真改被测服务**（见文件尾）。
    const r = await post(TQ, { style_tag: k, kind: 'h5', stage: 'primary', subject: '语文' })
    results[k] = r
    drift.push(...driftOf(k, r))
    must(r.resolvedFrom && r.resolvedFrom.fallback === false, `风格 ${k}：显式 style_tag 不被判为兜底`, { resolvedFrom: r.resolvedFrom })
  }
  must(drift.length === 0, '① 漂移对账：工具返回与 styleRegistry.ts（单一事实源）逐字段一致', { drift: drift.slice(0, 6) })

  /* ② DoD：9 个风格的 (skeletonClass, styleDNA) 组合两两可区分 */
  const sig = (r) => JSON.stringify([r.skeletonClass, r.styleDNA])
  const sigs = keys.map(k => sig(results[k]))
  const uniq = new Set(sigs)
  const pairDiff = (() => {
    let ok = 0
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = results[keys[i]], b = results[keys[j]]
      const dims = [
        a.skeletonClass !== b.skeletonClass,
        a.styleDNA.decorVocab !== b.styleDNA.decorVocab || a.styleDNA.font !== b.styleDNA.font,
        JSON.stringify(a.styleDNA.structure) !== JSON.stringify(b.styleDNA.structure),
      ].filter(Boolean).length
      if (dims >= 1) ok++
    }
    return ok
  })()
  must(uniq.size === keys.length, '② DoD：9 个风格的 skeletonClass+styleDNA 组合**互不相同**（可观测差异）', { unique: uniq.size, total: keys.length })
  must(pairDiff === 36, '② DoD：任意两风格至少在「骨架 / 装饰词+字体 / 结构语汇」之一上不同（36 对全覆盖）', { ok: pairDiff, total: 36 })

  /* ③ 兜底必须显式 */
  {
    const fb1 = await post(TQ, { style_tag: '', stage: 'primary', subject: '语文' })
    must(fb1.resolvedFrom && fb1.resolvedFrom.fallback === true && !!fb1.resolvedFrom.reason,
      '③ 风格缺省 → 按学段兜底且**显式标记** fallback + 原因', { resolvedFrom: fb1.resolvedFrom })
    const fb2 = await post(TQ, { style_tag: 'zzz-unknown-style', stage: 'senior', subject: '数学' })
    must(fb2.resolvedFrom && fb2.resolvedFrom.fallback === true && !!ts.styles[fb2.styleKey],
      '③ 未知风格 → 兜底同样显式标记（不静默），且兜底结果落在风格表内', { resolvedFrom: fb2.resolvedFrom, styleKey: fb2.styleKey })
    const fb3 = await post(TQ, { style_tag: 'zgf-ink-wash', kind: 'ppt' })
    must(fb3.styleKey === 'china', '③ 用主题 id 表达风格（zgf-* → china）也能解析', { got: fb3.styleKey })
  }

  /* ④ asset.search 契约 */
  {
    const a1 = await post(AS, { styleId: 'china', stage: 'primary', subject: '语文', need: 1, factor: 3, medium: 'ppt' })
    const a2 = await post(AS, { styleId: 'china', stage: 'primary', subject: '语文', need: 1, factor: 3, medium: 'ppt' })
    const a3 = await post(AS, { styleId: 'china', stage: 'primary', subject: '语文', need: 3, factor: 3, medium: 'ppt' })
    must(Array.isArray(a2.items), '④ asset.search 返回 items 数组', { keys: Object.keys(a2) })
    must(a2.total <= 1 * 3 && a2.total >= 1, '④ 数量 = need × factor 的上界成立（need=1, factor=3 → ≤3 且 ≥1）', { total: a2.total })
    must(a3.total >= a2.total, '④ need 增大 → 返回数量不减少（factor 生效，受库存封顶）', { n1: a2.total, n3: a3.total })
    must(JSON.stringify(a1.items.map(i => i.assetId)) === JSON.stringify(a2.items.map(i => i.assetId)),
      '④ 同输入两次调用结果一致（确定性，无 LLM/随机）', {})
    const bad = a3.items.flatMap(i => Object.entries(i.params || {}))
      .filter(([k, v]) => /colou?r/i.test(k) || (typeof v === 'string' && /#[0-9a-f]{3,8}\b/i.test(v)))
    must(bad.length === 0, '④ 契约③：params **只含形状/语义槽、不含色值**（颜色由 styleDNA 渲染时填入）', { bad: bad.slice(0, 4) })
    const ids = a3.items.map(i => i.assetId).filter(Boolean)
    const dbRows = psql(`SELECT count(*) FROM materials WHERE id IN (${ids.map(i => `'${i}'`).join(',') || "''"})`)
    if (dbRows === null) must(true, 'SKIP：ssh 不可用 → 资产存在性**未验证**（不计入通过）')
    else must(dbRows[0] === String(ids.length), '④ 返回的 assetId **确实存在于库**（materials 表）', { got: dbRows[0], want: ids.length })
    must(a2.items.every(i => i.params && i.params.medium && i.params.shape && typeof i.params.role === 'string'),
      '④ params 含形状/语义槽（shape/medium/role）', { sample: a2.items[0] && a2.items[0].params })
  }

  /* ── 【强形态变异 · 真注入】（2026-09-29 升级）────────────────────────────
   * 旧形态：把 9 次请求的 style_tag 全换成同一个（喂坏数据给判据 → 只证明比较函数会算）。
   * 新形态：**真改被测服务** —— 把容器里 `style_tools.py` 中 china 风格的 `font: kai` 改成 `hei`，
   *        重启 ai-service → 工具返回与事实源（styleRegistry.ts）不一致 → 漂移对账**必须报出 china.font**。
   *        跑完从容器内备份还原并再次重启，自检"工具返回与事实源重新一致"（不留污染）。
   * 风险控制：备份在容器内 `/tmp/style_tools.py.qa.bak`；还原在 finally 里**无条件**执行；
   *          仓库源码才是真源（万一还原失败：`bash code/deploy/deploy.sh staging` 即可恢复）。 */
  if (MUTATE) {
    const C = process.env.AI_CONTAINER || 'zhiwei-ai-staging'
    const F = '/app/style_tools.py'
    const BAK = '/tmp/style_tools.py.qa.bak'
    const sh = (cmd) => {
      try { return execFileSync('ssh', [SSH, cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null }
    }
    const ready = async () => {
      for (let i = 0; i < 20; i++) {
        const r = await fetch(B + TQ, { method: 'POST', headers: S.H, body: JSON.stringify({ style_tag: 'china', kind: 'h5' }) }).catch(() => null)
        if (r && r.ok) return true
        await new Promise(x => setTimeout(x, 3000))
      }
      return false
    }
    const chinaOf = async () => post(TQ, { style_tag: 'china', kind: 'h5' })

    must(sh(`docker exec ${C} cp ${F} ${BAK} && echo ok`) !== null, '【变异测试·前置】容器内工具源码已备份', { bak: BAK })
    const line0 = String(sh(`docker exec ${C} sed -n '/zgf-ink-wash/p' ${F}`) || '')
    must(/"font": "kai"/.test(line0), '【变异测试·前置】定位到 china 风格行（font=kai）', { line: line0.trim().slice(0, 60) })
    try {
      sh(`docker exec ${C} sed -i '/zgf-ink-wash/ s/"font": "kai"/"font": "hei"/' ${F}`)
      sh(`docker restart ${C} >/dev/null 2>&1; echo restarted`)
      must(await ready(), '【变异测试·前置】注入后 ai-service 重新就绪（重启等待 ≤60s）', {})
      const rMut = await chinaOf()
      must((rMut.styleDNA || {}).font === 'hei',
        '【变异测试·真注入】真改容器内工具源码后，工具确实返回 font=hei（说明改对了地方）',
        { tool: (rMut.styleDNA || {}).font })
      const d2 = driftOf('china', rMut)
      must(d2.some(x => x.startsWith('china.font')),
        '【变异测试·真注入】工具返回与事实源不一致 → 漂移对账**必须报出 china.font**（证明对账真在读被测服务，不是读常量）',
        { drift: d2.slice(0, 3) })
    } finally {
      sh(`docker exec ${C} cp ${BAK} ${F}`)
      sh(`docker restart ${C} >/dev/null 2>&1; echo restarted`)
    }
    must(await ready(), '【变异测试·收尾】还原后 ai-service 重新就绪', {})
    const rBack = await chinaOf()
    must((rBack.styleDNA || {}).font === ts.styles.china.font,
      '【变异测试·收尾】还原已完成：工具返回与事实源重新一致（环境无残留污染）',
      { tool: (rBack.styleDNA || {}).font, ts: ts.styles.china.font })
  }

  report()
})().catch(e => {
  console.error('✘ 脚本异常：' + e.message)
  process.exit(2)
})
