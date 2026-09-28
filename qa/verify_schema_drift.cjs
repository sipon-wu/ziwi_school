/**
 * 库结构 ↔ 迁移/代码 对账守卫（2026-09-27 立 · 0-2/0-1）
 *
 * 为什么必须有：**同一类事故已经两次**，且两次都不是靠代码审查发现的——
 *   ① `audit_logs` 表在存量库**不存在**（DDL 写在 001 基线，而 `deploy.sh` 只跑 `NNNN_*.sql`、
 *      **显式跳过 001 基线**）→ IT 审计写入被 `_ =` 吞掉 → **审计为零**且无人察觉；
 *   ② `users` 缺 `gender` / `region` 列（代码白名单里在用）→ `PUT /api/user/profile` **500**，
 *      教师改「性别/地区/头像」必失败（= `QA_BugList_20260707` 的 B002/B003，7 月挂到 9 月）。
 * 共同点：**"代码/迁移里有、库里没有"没有任何机制发现**。本守卫把它变成一条可执行红线。
 *
 * 本脚本守：
 *   ① **迁移声明 ⊇ 库实际**：解析 `code/backend/migrations/*.sql`（001 基线 + 增量；排除 *.down.sql）里声明的
 *      表与列，与 `information_schema` 比对 —— 缺表/缺列即红（① 正是能抓住上述两次事故的那条）。
 *   ② **代码期望字段清单**：迁移里没声明、但**代码会写**的列（如 users.gender/region）→ 缺即红。
 *   **②b（2026-09-29 补盲区）**：Go 模型**显式声明了表名**（`TableName()`）时，该表**必须在库中存在** →
 *      缺即红。旧版把这种情形与"猜不出表名"一并 `skipStructs` **静默跳过** —— 恰是假绿形状；
 *      实测抓到的第一个：`model.ExerciseSheet` → `exercise_sheets` 表不存在（没进 AutoMigrate、迁移也没有），
 *      导致 `/api/worksheets` 全 500 而无任何门禁报警。
 *   ③ **功能回读**：`PUT /api/user/profile` 六个字段（name/gender/phone/email/region/avatar）逐个保存 →
 *      **200 且查库回读一致**，随后**还原原值**（不留测试数据）。
 *
 * 依赖：可 ssh 到部署机执行 psql（查库）。ssh 不可用时 ①②③ 显式标 **SKIP（未验证）**，**不伪装通过**（M3/M7）。
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { must, report } = require('./lib/assert.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const SSH = process.env.SSH_TARGET || 'root@193.112.163.147'
const ENV_FILE = process.env.ENV_FILE || '/opt/zhiwei/code/deploy/.env.staging'
const PG_CONTAINER = process.env.PG_CONTAINER || 'zhiwei-postgres-staging'
const MIG_DIR = path.join(__dirname, '..', 'code', 'backend', 'migrations')

/** 代码会写、但（历史上）没有任何迁移声明的列 —— 逐条附"谁在写" */
const CODE_EXPECTED = [
  { table: 'users', column: 'gender', why: 'PUT /api/user/profile 白名单（auth_handler.go:224）' },
  { table: 'users', column: 'region', why: 'PUT /api/user/profile 白名单（auth_handler.go:227）' },
]

/** 读库实际结构（`表|列` 集合）；ssh/psql 不可用返回 null —— 变异注入后需要**重新读一遍**，故抽成函数 */
const readHave = () => {
  const rows = psql(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'`)
  return rows === null ? null : new Set(rows.filter(r => r.includes('|')).map(r => r))
}

const psql = (sql) => {
  try {
    return execFileSync('ssh', [SSH,
      `set -a; . ${ENV_FILE}; set +a; docker exec -i ${PG_CONTAINER} psql -U "$DB_USER" -d "$DB_NAME" -t -A -F"|" -c ${JSON.stringify(sql)}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map(s => s.trim())
      .filter(s => s && !/^WARNING|^DETAIL|^HINT|collation/i.test(s))
  } catch { return null }
}

/** Go 字段/结构体名 → 列/表名（对齐 GORM 的 NamingStrategy）。
 *  ⚠ 两个坑，都是本扫描器自己踩过的（写对之前误报了 3 次）：
 *   ① **连续大写＝缩写**：`AIGenerated` → `ai_generated`（不是 `aigenerated`）；
 *   ② **常见缩写的复数**：`AttachmentURLs` → `attachment_urls`（不是 `attachment_ur_ls`）——
 *      GORM 用 jinzhu/inflection 的 commonInitialisms（ID/URL/API/…）先断开缩写。
 *  于是这里同口径处理：先按"缩写(+复数)"断词（长的优先，避免 GUID 被 ID 抢匹配），再断大小写边界。 */
const INITIALISMS = ['API', 'ASCII', 'CPU', 'CSS', 'DNS', 'EOF', 'GUID', 'HTML', 'HTTP', 'HTTPS', 'ID', 'IP', 'JSON', 'LHS', 'QPS', 'RAM', 'RHS', 'RPC', 'SLA', 'SMTP', 'SQL', 'SSH', 'TCP', 'TLS', 'TTL', 'UDP', 'UI', 'UID', 'UUID', 'URI', 'URL', 'UTF8', 'VM', 'XML', 'XSRF', 'XSS']
  .sort((a, b) => b.length - a.length)
const INITIALISM_RE = new RegExp(`(${INITIALISMS.join('|')})(s?)(?![a-z])`, 'g')

const snakeCase = (s) => {
  // 先把缩写整词抽成占位符（否则后续"大写串+大写小写"规则会把 `URLs` 劈成 `UR_Ls`）
  const tokens = []
  let out = s.replace(INITIALISM_RE, (m) => { tokens.push(m); return `\u0000${tokens.length - 1}\u0000` })
  out = out
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => `_${tokens[+i]}_`)
  return out.replace(/_+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}

/** 解析 Go 模型（internal/model/*.go）：表名 + 标量字段对应的列名（**运行时真源**） */
function parseModels() {
  const dir = path.join(__dirname, '..', 'code', 'backend', 'internal', 'model')
  const out = []
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.go'))) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8')
    const tableOf = new Map()
    /* ⚠ 正则坑（2026-09-29 实测修）：旧写法 `\(\s*\w*\s*\*?([A-Z]\w*)\s*\)` 在**值接收者** `func (ExerciseSheet)`
     *   上会贪婪地把 "Exercise" 吃掉、只捕到 "Sheet" → `tableOf` 查不到 → `declared=null` → 落进"猜表名"分支
     *   被静默跳过（于是 `exercise_sheets` 缺表这件事**两次都没被发现**）。
     *   现改为"取 `)` 前**最后一个**大写开头的标识符"，两种接收者写法都对。 */
    for (const m of src.matchAll(/func\s*\([^)]*?([A-Z]\w*)\s*\)\s*TableName\(\)\s*string\s*\{\s*return\s*"([^"]+)"/g)) {
      tableOf.set(m[1], m[2])
    }
    for (const m of src.matchAll(/type\s+([A-Z]\w*)\s+struct\s*\{([\s\S]*?)\n\}/g)) {
      const struct = m[1]
      const cols = new Map()
      for (const line of m[2].split('\n')) {
        const f = line.match(/^\s+([A-Z]\w*)\s+(\*?(?:string|int|int64|int32|uint|bool|float64|time\.Time))\s*(`[^`]*`)?/)
        if (!f) continue
        const name = f[1]
        const gormTag = f[3] ? ((f[3].match(/gorm:"([^"]*)"/) || [])[1] || '') : ''
        if (/(^|;)\s*-\s*(;|$)/.test(gormTag)) continue // gorm:"-" → 不落库（如 LessonPlan 的 ClassID/TextbookVersionID）
        let col = (gormTag.match(/column:(\w+)/) || [])[1]
        if (!col) col = snakeCase(name)
        cols.set(col, name)
      }
      out.push({ struct, file, declared: tableOf.get(struct) || null, cols })
    }
  }
  return out
}


function parseMigrations() {
  const tables = new Map()
  const add = (t, c, src) => {
    if (!tables.has(t)) tables.set(t, new Map())
    if (!tables.get(t).has(c)) tables.get(t).set(c, src)
  }
  // 注意：**必须包含 001 基线**（`001_init_schema.up.sql` 是 3 位数字前缀）。
  // 上一版用 `^\d{4}_` 过滤把基线排除了 → 而 `audit_logs` 恰是基线里的表，等于抓不到那次事故（自证盲区）。
  const files = fs.readdirSync(MIG_DIR).filter(f => /^\d{3,4}_.*\.sql$/.test(f) && !f.endsWith('.down.sql')).sort()
  for (const f of files) {
    const lines = fs.readFileSync(path.join(MIG_DIR, f), 'utf8').split('\n')
    let cur = null
    for (const line of lines) {
      const create = line.match(/^\s*CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([A-Za-z_][\w.]*)/i)
      if (create) { cur = create[1].split('.').pop(); if (!tables.has(cur)) tables.set(cur, new Map()); continue }
      if (cur) {
        if (/^\s*\)\s*;/.test(line)) { cur = null; continue }
        // 列定义行：`    col TYPE ...`；跳过约束行
        const col = line.match(/^\s{2,}([A-Za-z_]\w*)\s+(VARCHAR|TEXT|UUID|TIMESTAMPTZ|TIMESTAMP|INT|INTEGER|BIGINT|BOOLEAN|JSONB|JSON|NUMERIC|DECIMAL|DATE|SERIAL|CHAR)\b/i)
        if (col && !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)$/i.test(col[1])) add(cur, col[1], f)
        continue
      }
      const alter = line.match(/ALTER TABLE\s+([A-Za-z_][\w.]*)\s+ADD COLUMN(?:\s+IF NOT EXISTS)?\s+([A-Za-z_]\w*)/i)
      if (alter) add(alter[1].split('.').pop(), alter[2], f)
    }
  }
  return { tables, files }
}

;(async () => {
  /* ── 取库实际结构 ── */
  const have = readHave()
  if (have === null) {
    must(true, 'SKIP①：ssh/psql 不可用 → 迁移↔库 对账**未验证**（不计入通过）')
    must(true, 'SKIP②：同上 → 代码期望字段**未验证**')
  } else {
    const dbTables = new Set([...have].map(s => s.split('|')[0]))
    const { tables, files } = parseMigrations()
    must(tables.size > 0, `解析到迁移声明的表（${files.length} 个迁移文件）`, { tables: tables.size })

    /* ① 迁移声明的表/列 → 库中必须存在 */
    const missBaseline = [], missIncr = [], missBaseCols = []
    for (const [t, cols] of tables) {
      const srcs = [...cols.values()]
      const baselineOnly = srcs.length > 0 && srcs.every(s => s.startsWith('001'))
      if (!dbTables.has(t)) { (baselineOnly ? missBaseline : missIncr).push(t); continue }
      for (const [c, src] of cols) if (!have.has(`${t}|${c}`)) missBaseCols.push(`${t}.${c}(${src})`)
    }
    /* 【强形态变异】（2026-09-29 升级）—— 旧形态是往**期望清单**塞一条假列（改期望值，弱：只证明"清单会参与比对"）。
     * 现在**真改库结构**：把迁移声明的一列 `RENAME COLUMN` 改名 → 迁移↔库 对账必须报"库中缺该列"。
     * 为什么用改名而不是删列：**零数据损失**，且可秒级改回；跑完自检"列已恢复"，不留结构改动。 */
    if (process.env.MUTATE === '1') {
      const probe = { t: 'ai_generation_logs', c: 'duration_ms' }   // 选它：迁移 0012 声明、且本守卫运行期间无生成动作会写它
      const missingDeclared = (h) => {
        const out = []
        const dbt = new Set([...h].map(s => s.split('|')[0]))
        for (const [t, cols] of tables) {
          if (!dbt.has(t)) { out.push(`${t}.(表缺失)`); continue }
          for (const [c, src] of cols) if (!h.has(`${t}|${c}`)) out.push(`${t}.${c}(${src})`)
        }
        return out
      }
      must(have.has(`${probe.t}|${probe.c}`), '【变异测试·前置】探测列此刻存在于库中', { probe })
      const r1 = psql(`ALTER TABLE ${probe.t} RENAME COLUMN ${probe.c} TO ${probe.c}_qa_probe`)
      if (r1 === null) {
        console.log('   [SKIP] 强形态变异需改库结构（ALTER 失败）→ 本项**未验证**（skip ≠ pass）')
        process.exit(2)
      }
      try {
        const h2 = readHave()
        const miss = h2 ? missingDeclared(h2) : []
        must(miss.some(x => x.startsWith(`${probe.t}.${probe.c}`)),
          '【变异测试·真注入】把库里该列**真改名**后，迁移↔库 对账必须报"库中缺该列"（证明对账真在读库，不是读缓存/常量）',
          { missing: miss.slice(0, 6) })
      } finally {
        psql(`ALTER TABLE ${probe.t} RENAME COLUMN ${probe.c}_qa_probe TO ${probe.c}`)
      }
      const h3 = readHave()
      must(!!h3 && h3.has(`${probe.t}|${probe.c}`), '【变异测试·收尾】改回后该列已恢复（守卫不留库结构改动）', {})
    }

    /* ② Go 模型（运行时真源）声明的列 → 库中必须存在（**判红**） */
    const models = parseModels()
    const skipStructs = []
    const missModelCols = []
    const missModelTables = []
    for (const m of models) {
      let table = m.declared
      if (!table) {
        const snake = snakeCase(m.struct)
        table = [snake + 's', snake + 'es', snake].find(c => dbTables.has(c)) || null
        if (!table) { skipStructs.push(m.struct); continue }   // 没声明表名、也猜不出 → 未验证（会打印出来）
      } else if (!dbTables.has(table)) {
        /* ⚠ 这正是本守卫**存在的理由**（`audit_logs` 那次事故就是"代码/模型声明了、库里没有"）。
         *   旧版把这种情形跟"猜不出表名"一起丢进 skipStructs → **静默跳过 = 假绿**。
         *   2026-09-29 实测抓到：`model.ExerciseSheet` 声明 `exercise_sheets`，但**没进 AutoMigrate、迁移里也没有**
         *   → 表根本不存在 → `/api/worksheets` 全 500；而本守卫当时报的是"全部通过"。已改为**判红**。 */
        missModelTables.push(`${table} ← ${m.struct}.TableName()（声明了表名，库里不存在）`)
        continue
      }
      for (const [c, field] of m.cols) if (!have.has(`${table}|${c}`)) missModelCols.push(`${table}.${c} ← ${m.struct}.${field}`)
    }

    // 判红口径（分级 —— 依据"谁在运行时读它"）：
    //   · **Go 模型**声明的列缺失 → 红（运行时会 SELECT/INSERT 它，缺了就 500）
    //   · **增量迁移**声明的表缺失 → 红（audit_logs 事故即此类；发现后已用 0010 补，此后回归即红）
    //   · **代码期望字段**（迁移没声明、但 handler 白名单在写）缺失 → 红（本文件 CODE_EXPECTED）
    //   · **基线(001)独有**的表/列缺失 → **登记为 note**：基线是"从零建库"的蓝图，与存量库存在历史旧差
    //     （实测：`lesson_plans.unit/lesson_period/...` 在模型里是 `textbook_unit/period/...`，
    //      而 `class_id/textbook_version_id/custom_tags/supplement_text` 是 `gorm:"-"`（故意不落库）；
    //      `users.wechat_openid` 与库里/模型里的 `wechat_open_id` 也只是命名旧差）
    /* 「原生 SQL 建表」白名单（2026-09-29）：这些表**故意**不走 AutoMigrate（分区/vector/HNSW 等 GORM 不支持），
     * 由 main.go 的幂等原生 SQL 建；模型仅供**查询扫描**用 → 字段级差异**登记不判红**（与"仅基线声明的缺列"同一口径），
     * 但必须**逐条打印**、且**表本身不存在仍判红**。加白名单必须写清理由，禁止"整表忽略"。 */
    const RAW_SQL_TABLES = {
      tb_lesson_source: 'ensureDistillSchema() 幂等原生 SQL 建 32 分区表（含 vector(1024)/HNSW）；模型仅用于查询扫描，无写入路径',
    }
    const missModelColsHard = []
    const missModelColsNote = []
    for (const x of missModelCols) {
      const t = x.split('.')[0]
      ;(RAW_SQL_TABLES[t] ? missModelColsNote : missModelColsHard).push(x)
    }

    must(missModelColsHard.length === 0, '**Go 模型**声明的列在库中全部存在（运行时真源）', { missing: missModelColsHard.slice(0, 12) })
    must(missModelTables.length === 0,
      '**Go 模型声明了表名 → 库里必须有该表**（喂：没进 AutoMigrate / 迁移漏写 这一类；2026-09-29 补盲区）',
      { missing: missModelTables })
    if (missModelColsNote.length) {
      console.log(`   [note] 原生 SQL 建表（白名单）的字段级差异 ${missModelColsNote.length} 个（登记不判红）：`, missModelColsNote.slice(0, 6))
      console.log(`          → 理由：${Object.values(RAW_SQL_TABLES)[0]}`)
    }
    must(missIncr.length === 0, '增量迁移声明的**表**在库中存在', { missing: missIncr })
    if (missBaseCols.length) console.log(`   [note] 仅基线(001)声明、库中缺的列 ${missBaseCols.length} 个（蓝图旧差，登记不判红）：`, missBaseCols.slice(0, 8))
    if (missBaseline.length) console.log(`   [note] 仅基线(001)声明、库中缺的表 ${missBaseline.length} 个（登记不判红）：`, missBaseline.slice(0, 8))
    if (skipStructs.length) console.log(`   [note] 无法定位表名的模型（未参与对账）：`, skipStructs.slice(0, 8))
    must(models.length > 0, '解析到 Go 模型（参与对账）', { models: models.length })

    /* ② 代码期望字段（原"往清单塞一条假列"的**弱形态已移除**：2026-09-29 起由上面的"真改库结构"自证） */
    const missCode = CODE_EXPECTED.filter(x => !have.has(`${x.table}|${x.column}`))
    must(missCode.length === 0, '代码期望字段（迁移未声明）在库中已补齐', { missing: missCode.map(x => `${x.table}.${x.column} ← ${x.why}`) })
  }

  /* ── ③ 功能回读：PUT /api/user/profile 六个字段 ── */
  const lg = await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
  })).json()
  must(!!lg.token, '登录成功（测试账号）')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }
  const uid = lg.user && lg.user.id
  const PNG1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
  const CASES = [
    { field: 'name', value: '__E2E资料校验', col: 'name' },
    { field: 'gender', value: '男', col: 'gender' },
    { field: 'region', value: '__E2E地区', col: 'region' },
    { field: 'email', value: '__e2e_profile@example.com', col: 'email' },
    { field: 'phone', value: '13800000002', col: 'phone' }, // 保持原号，只验通路（避免唯一约束/会话失效）
    { field: 'avatar', value: PNG1x1, col: 'avatar_url' },
  ]
  const orig = {}
  for (const c of CASES) {
    const v = psql(`SELECT coalesce(${c.col},'') FROM users WHERE id='${uid}'`)
    orig[c.field] = v && v[0] ? v[0] : ''
  }
  for (const c of CASES) {
    const r = await fetch(B + '/api/user/profile', { method: 'PUT', headers: H, body: JSON.stringify({ [c.field]: c.value }) })
    const back = psql(`SELECT coalesce(${c.col},'') FROM users WHERE id='${uid}'`)
    const got = back && back[0] ? back[0] : ''
    const ok = r.status === 200 && got === c.value
    must(ok, `PUT {${c.field}} → 200 且查库回读一致（列 ${c.col}）`, { status: r.status, back: String(got).slice(0, 32) })
  }
  /* 还原（用 psql 还原，因为 PUT 只接受非空值；name/phone 也确保回落原值） */
  for (const c of CASES) {
    psql(`UPDATE users SET ${c.col}='${String(orig[c.field]).replace(/'/g, "''")}' WHERE id='${uid}'`)
  }
  const restored = CASES.every(c => {
    const v = psql(`SELECT coalesce(${c.col},'') FROM users WHERE id='${uid}'`)
    return v && (v[0] || '') === String(orig[c.field])
  })
  must(restored, '六个字段均已还原为原值（不留测试数据）', { orig: Object.fromEntries(Object.entries(orig).map(([k, v]) => [k, String(v).slice(0, 24)])) })

  report()
})().catch(e => {
  console.error('✘ 脚本异常：' + e.message)
  process.exit(2)
})
