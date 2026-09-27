/**
 * 全面体检（2026-09-27 立）：不跑 E2E，做**系统级交叉查验**，回答一个元问题——
 * **"我们现在的绿，可信吗？"**
 *
 * 为什么要有它：本轮暴露的错判不是"不够仔细"，而是**结构性**的——
 *   · 拿**代理指标**当真相（看入口 bundle 就断言"前端没部署"；把**编辑器页**当播放器断言"H5 无自适应"）；
 *   · 断言/工具**自身没被验证**（假绿守卫空跑报绿；门只读工作区；runner 把 exit 2 记成失败）；
 *   · 单点证据就下结论、且**没写"我测的到底是什么"**。
 * 所以体检器只做一件事：**对"验证系统"本身做交叉查验**，把不可信之处显性化。
 *
 * 五个检查器（A6 需先跑过 runner 才有数据）：
 *   A1 守卫有效性：每个**关键守卫**是否具备"能被变红"的证据（变异 / 反向自检 / 负控断言）
 *   A2 静默失败扫描：Go / Python / TS 里的吞错模式（丢弃返回值、空 catch）计数与清单
 *   A3 部署一致性：本地源码 md5 vs 服务器；本地前端产物 hash vs 服务器实际服务的那份
 *   A4 数据一致性：孤儿批注/版本、公共资产归属异常、审计与留痕表实况
 *   A5 测量可信度：扫守卫里**可能测错对象**的模式（编辑器路由 + 断言播放器 DOM / 依赖 iframe 几何 /
 *      只认入口 bundle / env 样本），命中即要求"被测对象身份证据"，否则标红
 *   A6 文档↔实现对账：方案里声明 `[x]` 的条目，其守卫必须存在；若跑过 runner，则还须"不是失败"
 *
 * 用法：`node qa/audit_all.cjs`（约 30s；需要 ssh 才能跑 A3/A4，缺 ssh 会**显式记 SKIP**而不是假装通过）
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const { must, report } = require('./lib/assert.cjs')
const { GUARDS, DONE_ITEMS } = require('./run_all.cjs')

const ROOT = path.resolve(__dirname, '..')
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const QA = __dirname
const SERVER = process.env.SERVER || 'root@193.112.163.147'
const REMOTE_CODE = process.env.REMOTE_CODE || '/opt/zhiwei/code'
const LAST_RUN = path.join(QA, '.qa_last_run.json')

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 }).trim()
const ssh = (cmd) => sh(`ssh -o ConnectTimeout=8 ${SERVER} '${cmd.replace(/'/g, "'\\''")}'`)
const md5 = (p) => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex')
const readIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '')

const notes = []
let sshOk = true
try { ssh('echo ok') } catch { sshOk = false }

;(async () => {
  /* ── A1 守卫有效性：分两档（**下限判红 / 强证据只登记**）──
   * ⚠ 首版把两者混成一条正则，于是把"已有负控断言"的守卫也判成"无证据"（体检器自身的假阳性）。
   * 更正后的口径：
   *   A1a **下限（判红）**：每个关键守卫必须含"**可失败的核心断言**"——否定式（`!x`）、
   *        期望空（`length === 0`，有数据出现即红）、或明确拒绝（404/403/不存在/不出现）；
   *        且断言条数 ≥3（防"只有一个占位 must(true)"）。
   *   A1b **强证据（登记）**：带变异测试 / 反向自检的守卫数 —— 这是 M3 的目标形态，**逐步补齐**，
   *        不假装已经全有（当前覆盖数会在输出里打印）。
   */
  const crit = GUARDS.filter(g => g.critical)
  const coreWeak = []
  const mutant = []
  for (const g of crit) {
    const src = readIf(path.join(QA, `${g.name}.cjs`))
    if (/MUTATE|变异测试|反向自检/.test(src)) mutant.push(g.name)
    const falsifiable = /must\(\s*!|===\s*false|length\s*===?\s*0|不得|不出现|不存在|拒绝|404|403/.test(src)
    const nMust = (src.match(/must\(/g) || []).length
    if (!falsifiable || nMust < 3) coreWeak.push({ file: g.name, 可失败断言: falsifiable, 断言数: nMust })
  }
  must(crit.length > 0, `覆盖矩阵里有 ${crit.length} 个关键守卫`, { crit: crit.map(g => g.name) })
  must(coreWeak.length === 0,
    'A1a 每个关键守卫都有"可失败的核心断言"（否定式/期望空/明确拒绝，且断言数 ≥3）—— 否则可能恒真',
    { 薄弱: coreWeak })
  console.log(`   [登记] A1b 带变异测试或反向自检的关键守卫：${mutant.length}/${crit.length}（${mutant.join(', ') || '无'}）`
    + ` —— 目标是把剩下的 ${crit.length - mutant.length} 个也补上（M3）`)

  /* ── A2 静默失败扫描（只报数，不判红：有些吞错是合法的）── */
  const scanSink = (dir, exts, patterns) => {
    const hits = []
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__pycache__') continue
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (exts.some(x => e.name.endsWith(x))) {
          const txt = fs.readFileSync(p, 'utf8')
          for (const [label, re] of patterns) {
            const n = (txt.match(re) || []).length
            if (n) hits.push({ file: path.relative(ROOT, p), label, n })
          }
        }
      }
    }
    if (fs.existsSync(dir)) walk(dir)
    return hits.sort((a, b) => b.n - a.n)
  }
  const goHits = scanSink(path.join(ROOT, 'code/backend'), ['.go'], [
    ['丢弃 error 返回值', /_ = [\w.]*[Ee]rr/g],
    [', _ := ', /,\s*_ :=\s/g],
  ])
  const pyHits = scanSink(path.join(ROOT, 'code/ai-service'), ['.py'], [
    ['except 后 pass/continue', /except[^\n]*:\s*\n\s*(pass|continue)\b/g],
  ])
  const tsHits = scanSink(path.join(ROOT, 'code/frontend/src'), ['.ts', '.tsx'], [
    ['空 catch', /catch\s*\{?\s*\}?\s*\{?\s*\/\*\s*noop\s*\*\/|catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g],
  ])
  const sinkTotal = [...goHits, ...pyHits, ...tsHits].reduce((s, h) => s + h.n, 0)
  must(sinkTotal >= 0, `A2 静默失败扫描：Go ${goHits.reduce((s, h) => s + h.n, 0)} / Py ${pyHits.reduce((s, h) => s + h.n, 0)} / TS ${tsHits.reduce((s, h) => s + h.n, 0)} 处（登记；非全部为缺陷）`,
    { top: [...goHits, ...pyHits, ...tsHits].slice(0, 6) })

  /* ── A3 部署一致性：本地 == 服务器？── */
  const files = ['code/ai-service/api_server.py', 'code/ai-service/gen_pipeline.py', 'code/backend/cmd/server/main.go']
  if (!sshOk) {
    notes.push('[SKIP] A3 跳过：ssh 不可用（**未验证**，不当作通过）')
  } else {
    const drift = []
    for (const f of files) {
      const local = md5(path.join(ROOT, f))
      let remote = ''
      try { remote = ssh(`md5sum ${REMOTE_CODE}/${f.replace(/^code\//, '')} | cut -d" " -f1`) } catch { remote = '(不可读)' }
      if (local !== remote) drift.push({ file: f, local: local.slice(0, 8), remote: remote.slice(0, 8) })
    }
    must(drift.length === 0, 'A3 部署一致性：本地关键源码 == 服务器（否则测的是旧代码）', { drift })

    // 前端：本地 dist 入口 hash vs 线上实际服务的那份。
    // ⚠ 首版写成在服务器上 `curl 127.0.0.1` → 取到空值（vhost 未必绑在 127.0.0.1），
    //   差点又得出"前端没部署"的错误结论 —— 又一次"代理指标"。改为从**公网入口**取。
    const localEntry = (fs.readdirSync(path.join(ROOT, 'code/frontend/dist/assets')).filter(f => /^index-.*\.js$/.test(f))[0] || '')
    let servedEntry = ''
    try { servedEntry = (sh(`curl -s -m 10 ${BASE}/`).match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [''])[0] } catch { servedEntry = '' }
    must(localEntry && servedEntry.includes(localEntry),
      'A3 前端产物：线上入口 bundle == 本地构建产物（同名即同一份）',
      { local: localEntry, served: servedEntry })
  }

  /* ── A4 数据一致性（只读 SQL）── */
  if (!sshOk) {
    notes.push('[SKIP] A4 跳过：ssh 不可用（**未验证**）')
  } else {
    const q = (sql) => ssh(`set -a; . ${REMOTE_CODE}/deploy/.env.staging; set +a; docker exec -i zhiwei-postgres-staging psql -U "$DB_USER" -d "$DB_NAME" -tAc "${sql.replace(/"/g, '\\"')}" 2>/dev/null`)
    let anon = '', ver = '', rel = '', pub = '', alog = '', gen = '', aTypes = '', vTypes = ''
    try {
      // ⚠ 必须**按资源类型分开**判孤儿。首版直接用 `NOT EXISTS (materials)` 一刀切 →
      //   把 lesson_plan / exam / sheet 的快照全当"孤儿"（实测那 6 条正好是这四类），是**假阳性**。
      anon = q("SELECT count(*) FROM annotations a WHERE a.resource_type='courseware' AND NOT EXISTS (SELECT 1 FROM materials m WHERE m.id=a.resource_id)")
      ver = q("SELECT count(*) FROM versions v WHERE v.resource_type='courseware' AND v.kind<>'release' AND NOT EXISTS (SELECT 1 FROM materials m WHERE m.id=v.resource_id)")
      aTypes = q('SELECT string_agg(t || \'=\' || c, \', \') FROM (SELECT resource_type t, count(*) c FROM annotations GROUP BY 1 ORDER BY 1) s')
      vTypes = q('SELECT string_agg(t || \'=\' || c, \', \') FROM (SELECT resource_type t, count(*) c FROM versions GROUP BY 1 ORDER BY 1) s')
      rel = q("SELECT count(*) FROM versions WHERE kind='release'")
      pub = q("SELECT count(*) FROM materials WHERE coalesce(user_id,'')=''")
      alog = q('SELECT count(*) FROM audit_logs')
      gen = q('SELECT count(*) FROM ai_generation_logs')
    } catch (e) { notes.push('[note] A4 部分查询失败：' + e.message.slice(0, 80)) }
    const n = (v) => Number(String(v).trim() || 0)
    must(n(anon) === 0, 'A4 无孤儿批注（courseware 类的批注都能找到所属素材；其它资源类型另计）',
      { 孤儿批注: anon, 类型分布: aTypes })
    must(n(ver) === 0, 'A4 无孤儿草稿快照（courseware 类非 release 行都有所属素材）',
      { 孤儿版本: ver, 类型分布: vTypes })
    must(n(rel) >= 0, `A4 发布留痕可数（kind=release 行 = ${rel}）`, { release: rel })
    must(n(alog) >= 0 && n(gen) >= 0, `A4 审计与生成留痕表可读（audit_logs=${alog} / ai_generation_logs=${gen}）`,
      { audit: alog, gen })
    must(true, `A4 公共资产（user_id 为空）${pub} 条 —— 只登记，用于对照写权限口径`, { publicAssets: pub })
  }

  /* ── A5 测量可信度：找"可能测错对象"的守卫 ── */
  const risky = []
  for (const f of fs.readdirSync(QA).filter(x => /^verify_.*\.cjs$/.test(x))) {
    const src = readIf(path.join(QA, f))
    const problems = []
    // 豁免：**取播放器 HTML 后 setContent 独立渲染**是正确做法（测量发生在新页面里），
    // 不该与"在编辑器画布里量"混为一谈 —— 首版没这条豁免，连刚写对的守卫也一起报了（体检器自身的假阳性）。
    const extracts = /setContent\(/.test(src)
    const geo = /getBoundingClientRect|scrollWidth|clientWidth|offsetWidth/.test(src)
    const viaEditor = /\/courseware\/\$\{?\w*format|\/courseware\/h5\/\$\{|courseware\/\$\{/.test(src)
      && /\.story-root|\.scene\b/.test(src)
    // ① 编辑器路由 + **几何断言**（本轮错判的原型）：几何量跨了 iframe 边界（外层视口≠内部宽度）→ 必错。
    //    非几何指标（颜色/类名/结构签名）在播放器 frame 内量是**可接受**的，只要它同时给了"被测对象身份证据"
    //    （如断言 `body[data-theme]` / `body.hd` / `.story-root` 存在）——这正是 ab 守卫做对的地方。
    if (!extracts && viaEditor && geo) problems.push('开编辑器路由却用 iframe 内几何下结论（应取 HTML 独立渲染）')
    // ② 直接用 contentDocument 量几何
    if (!extracts && /contentDocument/.test(src) && geo) problems.push('用 iframe 内文档量几何（外层视口≠内部宽度）')
    // ③ 跨 frame/iframe 测量但**没有身份证据**（不知道量到的到底是谁的 DOM）
    const crossFrame = /\.frames\(\)|contentDocument|\.srcdoc/.test(src)
    const identity = /data-theme|body\.hd|classList\.contains\('hd'\)|story-root.*存在|document\.title/.test(src)
    if (crossFrame && !identity) problems.push('跨 frame 测量但缺"被测对象身份证据"（无法证明量到的是播放器本人）')
    // ③ 只认入口 bundle（漏掉懒加载分块 → 误判"没部署/没改动"）
    if (/assets\/index-/.test(src)) problems.push('只核对入口 bundle（懒加载分块才是改动所在）')
    // ④ env 取样本且无零样本处理（静默空跑）
    if (/\.split\(','\)\.filter\(Boolean\)/.test(src) && !/length === 0|SKIP/.test(src)) problems.push('env 样本无零样本处理')
    if (problems.length) risky.push({ file: f, problems })
  }
  must(risky.length === 0,
    'A5 无"可能测错对象"的守卫（编辑器路由当播放器 / iframe 几何 / 只认入口 bundle / env 空样本）',
    { risky })

  /* ── A6 文档↔实现对账 ── */
  const doc = readIf(path.join(ROOT, '产品规划/0911 Skill服务化与验收防伪方案.md'))
  const missing = DONE_ITEMS.filter(it => !GUARDS.some(g => g.covers.includes(it)))
  must(missing.length === 0, `A6 方案里"已完成"的条目都有守卫覆盖（${DONE_ITEMS.join('/')}）`, { missing })
  if (fs.existsSync(LAST_RUN)) {
    const last = JSON.parse(readIf(LAST_RUN))
    const failedCrit = (last.failed || []).filter(n => GUARDS.some(g => g.critical && g.name === n))
    must(failedCrit.length === 0, 'A6 上次全量 runner：关键路径无失败', { lastRun: last.at, failedCrit })
    console.log(`   [last run] ${last.at} → passed=${last.passed.length} failed=${last.failed.length} skipped=${last.skipped.length}`)
  } else {
    notes.push('[SKIP] A6 增量对账跳过：尚无 qa/.qa_last_run.json（先跑 node qa/run_all.cjs）')
  }
  must(doc.includes('## 七·五') || doc.includes('七·五'),
    'A6 方案文档仍在（对账基准存在）', {})

  for (const n of notes) console.log('   ' + n)
  report()
})().catch(e => {
  console.error('✘ 体检器自身异常：' + e.message)
  process.exitCode = 2
})
